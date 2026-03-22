/**
 * Index Parser for I.F. Stone's Weekly
 *
 * Parses yearly index files to extract:
 * - Topics and subtopics
 * - Article titles and descriptions
 * - Issue/page references
 * - Structured metadata
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import fs from 'fs/promises';

config({ path: '.env.local' });

interface IndexArticle {
  title?: string;
  description: string;
  reference: string; // "12-1" or "Jan 24:2-3"
  issueNumber?: number;
  pageNumber?: string;
  date?: string;
}

interface IndexEntry {
  topic: string;
  year: number;
  filename: string;
  articles: IndexArticle[];
  rawText: string;
}

interface ParsedIndexDatabase {
  totalEntries: number;
  totalArticles: number;
  years: number[];
  entries: IndexEntry[];
}

/**
 * Detect if a filename is an index file
 */
export function isIndexFile(filename: string): boolean {
  return /I\d+\.pdf$/.test(filename);
}

/**
 * Extract year from index filename
 */
export function extractYearFromFilename(filename: string): number {
  const match = filename.match(/(\d{4})I\d+\.pdf/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * Detect reference format based on year
 */
export function detectReferenceFormat(year: number): 'issue-page' | 'date-page' {
  // Based on observation: 1953-1958 use issue-page, 1959+ use date:page
  return year <= 1958 ? 'issue-page' : 'date-page';
}

export type { IndexArticle, IndexEntry, ParsedIndexDatabase };

/**
 * Parse issue-page reference (e.g., "12-1", "46-3d")
 */
function parseIssuePageReference(ref: string): { issueNumber?: number; pageNumber?: string } {
  const match = ref.match(/(\d+)-(\d+[a-d]?)/);
  if (match) {
    return {
      issueNumber: parseInt(match[1]),
      pageNumber: match[2],
    };
  }
  return {};
}

/**
 * Parse date:page reference (e.g., "Jan 24:2-3", "Nov 14:2", "Apr 25:1-4")
 */
function parseDatePageReference(ref: string): { date?: string; pageNumber?: string } {
  // Match variations: "Jan 24:2-3", "Apr  25:1-4" (with multiple spaces)
  const match = ref.match(/([A-Z][a-z]{2,3})\s+(\d{1,2}):(\d+(?:-\d+)?[a-d]?)/);
  if (match) {
    return {
      date: `${match[1]} ${match[2]}`,
      pageNumber: match[3],
    };
  }
  return {};
}

/**
 * Extract article title from quotes
 */
function extractTitle(text: string): string | undefined {
  const match = text.match(/["""']([^"""']+)["""']/);
  return match ? match[1] : undefined;
}

/**
 * Parse a single index entry line
 */
function parseIndexLine(
  line: string,
  year: number,
  format: 'issue-page' | 'date-page'
): IndexArticle[] {
  const articles: IndexArticle[] = [];

  // Skip empty lines and headers
  if (!line.trim() || line.length < 10) return articles;

  // Split by semicolons to get individual article references
  const parts = line.split(/;(?=\s*[A-Z]|\s*\d|\s*["""'])/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    let reference = '';
    let description = trimmed;
    let parsed = {};

    if (format === 'issue-page') {
      // Look for issue-page pattern: "12-1", "46-3d"
      const match = trimmed.match(/\b(\d{1,2}-\d+[a-d]?)\b/g);
      if (match && match.length > 0) {
        reference = match[match.length - 1]; // Use last match
        parsed = parseIssuePageReference(reference);
      }
    } else {
      // Look for date:page pattern: "Jan 24:2-3", "Apr  25:1-4"
      // Find ALL occurrences in the line (there might be multiple articles)
      const regex = /([A-Z][a-z]{2,3})\s+(\d{1,2}):(\d+(?:-\d+)?[a-d]?)/g;
      let match;
      const matches = [];

      while ((match = regex.exec(trimmed)) !== null) {
        matches.push({
          reference: match[0],
          index: match.index,
        });
      }

      // If we found multiple refs, split the description
      if (matches.length === 1) {
        reference = matches[0].reference;
        parsed = parseDatePageReference(reference);
      } else if (matches.length > 1) {
        // Multiple articles in one line - create separate entries
        for (let i = 0; i < matches.length; i++) {
          const m = matches[i];
          const nextIndex = i < matches.length - 1 ? matches[i + 1].index : trimmed.length;
          const desc = trimmed.substring(i === 0 ? 0 : matches[i].index - 10, nextIndex).trim();

          articles.push({
            title: extractTitle(desc),
            description: desc,
            reference: m.reference,
            ...parseDatePageReference(m.reference),
          });
        }
        continue; // Skip the regular push below
      }
    }

    if (reference) {
      articles.push({
        title: extractTitle(trimmed),
        description: trimmed,
        reference,
        ...parsed,
      });
    }
  }

  return articles;
}

/**
 * Parse index text into structured entries
 */
export function parseIndexText(text: string, filename: string, debug = false): IndexEntry[] {
  const entries: IndexEntry[] = [];
  const year = extractYearFromFilename(filename);
  const format = detectReferenceFormat(year);

  if (debug) console.log(`\n[DEBUG] Parsing ${filename}, Year: ${year}, Format: ${format}`);

  // Split into lines
  const lines = text.split('\n');

  let currentTopic = '';
  let currentTopicLines: string[] = [];
  let inIndexSection = false;
  let debugLineCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect when we're in the actual index section (after headers)
    if (!inIndexSection) {
      if (
        line.includes('Index to Volume') ||
        /^[A-Z][A-Z\s-]{2,}:/.test(line.trim()) ||
        /^[A-Z][A-Z\s-]{2,}\./.test(line.trim())
      ) {
        inIndexSection = true;
        if (debug) console.log(`[DEBUG] Index section started at line ${i}: "${line.substring(0, 60)}"`);
      } else {
        continue;
      }
    }

    // Skip licensing and header noise
    if (
      line.includes('LICENSED TO UNZ.ORG') ||
      line.includes('ELECTRONIC REPRODUCTION') ||
      line.includes('KRAUS REPRINT')
    ) {
      continue;
    }

    // Detect new topic (ALL CAPS followed by period or colon)
    // Handle both formats: "TOPIC: text" and "TOPIC.  text" (with multiple spaces)
    const topicMatch = line.match(/^([A-Z][A-Z\s&,\-]{2,}?)[\.:]\s+(.+)$/);

    if (debug && debugLineCount < 10 && line.trim() && !line.includes('LICENSED') && !line.includes('PROHIBITED')) {
      console.log(`[DEBUG] Line ${i}: "${line.substring(0, 80)}" -> Match: ${!!topicMatch}`);
      debugLineCount++;
    }

    if (topicMatch) {
      if (debug) console.log(`[DEBUG] Found topic: "${topicMatch[1]}"`);

      // Save previous topic if exists
      if (currentTopic && currentTopicLines.length > 0) {
        const rawText = currentTopicLines.join(' ');
        const articles: IndexArticle[] = [];

        for (const topicLine of currentTopicLines) {
          articles.push(...parseIndexLine(topicLine, year, format));
        }

        if (articles.length > 0) {
          entries.push({
            topic: currentTopic,
            year,
            filename,
            articles,
            rawText,
          });
        }
      }

      // Start new topic
      currentTopic = topicMatch[1].trim();
      currentTopicLines = [topicMatch[2].trim()];
    } else if (currentTopic && line.trim()) {
      // Continuation of current topic
      currentTopicLines.push(line.trim());
    }
  }

  // Don't forget the last topic
  if (currentTopic && currentTopicLines.length > 0) {
    const rawText = currentTopicLines.join(' ');
    const articles: IndexArticle[] = [];

    for (const topicLine of currentTopicLines) {
      articles.push(...parseIndexLine(topicLine, year, format));
    }

    if (articles.length > 0) {
      entries.push({
        topic: currentTopic,
        year,
        filename,
        articles,
        rawText,
      });
    }
  }

  return entries;
}

/**
 * Main function to parse all index files
 */
async function main() {
  console.log('🔍 Parsing I.F. Stone\'s Weekly Index Files...\n');

  // Load extracted documents
  const extractedPath = resolve(process.cwd(), 'data/extracted-documents.json');
  const extractedData = JSON.parse(await fs.readFile(extractedPath, 'utf-8'));

  const database: ParsedIndexDatabase = {
    totalEntries: 0,
    totalArticles: 0,
    years: [],
    entries: [],
  };

  // Find and parse all index files
  for (const doc of extractedData) {
    const filename = doc.metadata.filename;

    if (isIndexFile(filename)) {
      const year = extractYearFromFilename(filename);
      console.log(`📚 Parsing ${filename} (${year})...`);

      // Enable debug for 1960 to see what's happening
      const entries = parseIndexText(doc.text, filename, year === 1960);

      const articleCount = entries.reduce((sum, e) => sum + e.articles.length, 0);
      console.log(`   Found ${entries.length} topics with ${articleCount} article references`);

      database.entries.push(...entries);
      database.totalEntries += entries.length;
      database.totalArticles += articleCount;

      if (!database.years.includes(year)) {
        database.years.push(year);
      }
    }
  }

  database.years.sort();

  // Save structured index database
  const outputPath = resolve(process.cwd(), 'data/index-database.json');
  await fs.writeFile(outputPath, JSON.stringify(database, null, 2));

  console.log('\n✅ Index Database Created!');
  console.log(`   Total Topics: ${database.totalEntries}`);
  console.log(`   Total Article References: ${database.totalArticles}`);
  console.log(`   Years: ${database.years.join(', ')}`);
  console.log(`   Saved to: ${outputPath}`);

  // Show some sample entries
  console.log('\n📋 Sample Entries:');
  const samples = database.entries.slice(0, 3);
  for (const entry of samples) {
    console.log(`\n   ${entry.topic} (${entry.year})`);
    console.log(`   ${entry.articles.length} articles`);
    if (entry.articles[0]) {
      console.log(`   Example: ${entry.articles[0].reference} - ${entry.articles[0].description.substring(0, 80)}...`);
    }
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
