import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import type { ParsedIndexDatabase } from './parse-index';

// Load environment variables from .env.local
config({ path: '.env.local' });

interface ExtractedDocument {
  id: string;
  text: string;
  metadata: {
    year: string;
    filename: string;
    pages: number;
    date?: string;
    isIndex?: boolean;
    indexYear?: number;
    referenceFormat?: 'issue-page' | 'date-page';
  };
}

interface Chunk {
  id: string;
  text: string;
  metadata: {
    documentId: string;
    year: string;
    filename: string;
    chunkIndex: number;
    date?: string;
    isIndex?: boolean;
    indexYear?: number;
    referenceFormat?: string;
    topicName?: string;
  };
}

interface EmbeddedChunk extends Chunk {
  embedding: number[];
}

// Configuration
const CHUNK_SIZE = 500; // tokens (approximately)
const CHUNK_OVERLAP = 50; // tokens
const EMBEDDING_MODEL = 'text-embedding-3-small';
const PINECONE_INDEX_NAME = 'ifstone-weekly';
const BATCH_SIZE = 100; // Upload in batches

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  // Simple word-based chunking (approximately 1 token = 0.75 words)
  const words = text.split(/\s+/);
  const wordsPerChunk = Math.floor(chunkSize * 0.75);
  const wordsOverlap = Math.floor(overlap * 0.75);

  const chunks: string[] = [];
  let i = 0;

  while (i < words.length) {
    const chunk = words.slice(i, i + wordsPerChunk).join(' ');
    if (chunk.trim().length > 0) {
      chunks.push(chunk);
    }
    i += wordsPerChunk - wordsOverlap;
  }

  return chunks;
}

function createChunks(documents: ExtractedDocument[], indexDatabase?: ParsedIndexDatabase): Chunk[] {
  const chunks: Chunk[] = [];

  for (const doc of documents) {
    // Special handling for index files
    if (doc.metadata.isIndex && indexDatabase) {
      // Find all topics for this index file
      const indexEntries = indexDatabase.entries.filter(
        (entry) => entry.filename === doc.metadata.filename
      );

      // Create one chunk per topic entry
      indexEntries.forEach((entry, index) => {
        const metadata: Chunk['metadata'] = {
          documentId: doc.id,
          year: doc.metadata.year,
          filename: doc.metadata.filename,
          chunkIndex: index,
          date: doc.metadata.date,
          isIndex: true,
          indexYear: doc.metadata.indexYear,
          referenceFormat: doc.metadata.referenceFormat,
          topicName: entry.topic,
        };

        // Format the text nicely for this topic
        const topicText = `${entry.topic} (${entry.year}):\n${entry.rawText}`;

        chunks.push({
          id: `${doc.id}-topic-${index}`,
          text: topicText,
          metadata,
        });
      });

      console.log(`  📚 Created ${indexEntries.length} topic chunks for ${doc.metadata.filename}`);
    } else {
      // Regular document chunking
      const textChunks = chunkText(doc.text, CHUNK_SIZE, CHUNK_OVERLAP);

      textChunks.forEach((chunkText, index) => {
        const metadata: Chunk['metadata'] = {
          documentId: doc.id,
          year: doc.metadata.year,
          filename: doc.metadata.filename,
          chunkIndex: index,
          date: doc.metadata.date,
        };

        chunks.push({
          id: `${doc.id}-chunk-${index}`,
          text: chunkText,
          metadata,
        });
      });
    }
  }

  return chunks;
}

async function generateEmbeddings(
  chunks: Chunk[],
  openai: OpenAI
): Promise<EmbeddedChunk[]> {
  console.log(`Generating embeddings for ${chunks.length} chunks...`);

  const embeddedChunks: EmbeddedChunk[] = [];
  const batchSize = 100; // OpenAI allows batch embedding

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map((c) => c.text);

    try {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: texts,
      });

      batch.forEach((chunk, index) => {
        embeddedChunks.push({
          ...chunk,
          embedding: response.data[index].embedding,
        });
      });

      console.log(`  Progress: ${Math.min(i + batchSize, chunks.length)}/${chunks.length} chunks embedded`);
    } catch (error) {
      console.error(`Error generating embeddings for batch starting at ${i}:`, error);
      throw error;
    }

    // Rate limiting - be nice to the API
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return embeddedChunks;
}

async function uploadToPinecone(
  embeddedChunks: EmbeddedChunk[],
  pinecone: Pinecone
): Promise<void> {
  console.log(`\nUploading ${embeddedChunks.length} embeddings to Pinecone...`);

  const index = pinecone.index(PINECONE_INDEX_NAME);

  // Upload in batches
  for (let i = 0; i < embeddedChunks.length; i += BATCH_SIZE) {
    const batch = embeddedChunks.slice(i, i + BATCH_SIZE);

    const vectors = batch.map((chunk) => {
      const metadata: Record<string, any> = {
        text: chunk.text,
        documentId: chunk.metadata.documentId,
        year: chunk.metadata.year,
        filename: chunk.metadata.filename,
        chunkIndex: chunk.metadata.chunkIndex,
        date: chunk.metadata.date || '',
      };

      // Add index-specific metadata
      if (chunk.metadata.isIndex) {
        metadata.isIndex = true;
        metadata.indexYear = chunk.metadata.indexYear;
        metadata.referenceFormat = chunk.metadata.referenceFormat || '';
        metadata.topicName = chunk.metadata.topicName || '';
      }

      return {
        id: chunk.id,
        values: chunk.embedding,
        metadata,
      };
    });

    try {
      await index.upsert(vectors);
      console.log(`  Uploaded ${Math.min(i + BATCH_SIZE, embeddedChunks.length)}/${embeddedChunks.length} vectors`);
    } catch (error) {
      console.error(`Error uploading batch starting at ${i}:`, error);
      throw error;
    }

    // Small delay between batches
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function main() {
  // Check for API keys
  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable is not set');
    process.exit(1);
  }

  if (!process.env.PINECONE_API_KEY) {
    console.error('Error: PINECONE_API_KEY environment variable is not set');
    process.exit(1);
  }

  // Initialize clients
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });

  // Load extracted documents
  const dataPath = path.join(__dirname, '../data/extracted-documents.json');
  if (!fs.existsSync(dataPath)) {
    console.error(`Error: Extracted documents not found at ${dataPath}`);
    console.error('Please run npm run process-pdfs first.');
    process.exit(1);
  }

  console.log('Loading extracted documents...');
  const documents: ExtractedDocument[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  console.log(`Loaded ${documents.length} documents\n`);

  // Load index database
  const indexDbPath = path.join(__dirname, '../data/index-database.json');
  let indexDatabase: ParsedIndexDatabase | undefined;

  if (fs.existsSync(indexDbPath)) {
    console.log('Loading index database...');
    indexDatabase = JSON.parse(fs.readFileSync(indexDbPath, 'utf-8'));
    console.log(`Loaded ${indexDatabase.totalEntries} index topics from ${indexDatabase.years.length} years\n`);
  } else {
    console.log('⚠️  Index database not found. Run npm run parse-index first for better index handling.\n');
  }

  // Create chunks
  console.log('Creating chunks...');
  const chunks = createChunks(documents, indexDatabase);
  console.log(`Created ${chunks.length} chunks\n`);

  // Generate embeddings
  const embeddedChunks = await generateEmbeddings(chunks, openai);

  // Skip saving embeddings to file (too large - over 500MB)
  console.log(`\nSkipping local backup (file too large). Uploading directly to Pinecone...`);

  // Upload to Pinecone
  await uploadToPinecone(embeddedChunks, pinecone);

  // Calculate statistics
  const indexChunks = chunks.filter((c) => c.metadata.isIndex);
  const regularChunks = chunks.filter((c) => !c.metadata.isIndex);

  console.log('\n' + '='.repeat(60));
  console.log('Embedding generation and upload complete!');
  console.log(`Total chunks: ${embeddedChunks.length}`);
  console.log(`  - Regular article chunks: ${regularChunks.length}`);
  console.log(`  - Index topic chunks: ${indexChunks.length}`);
  console.log(`Pinecone index: ${PINECONE_INDEX_NAME}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
