import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';
import { isIndexFile, extractYearFromFilename, detectReferenceFormat } from './parse-index';

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

async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  } catch (error) {
    console.error(`Error extracting text from ${filePath}:`, error);
    return '';
  }
}

function extractDateFromFilename(filename: string): string | undefined {
  // Try to extract date patterns like YYYY-MM-DD or similar
  const patterns = [
    /(\d{4})-(\d{2})-(\d{2})/,  // YYYY-MM-DD
    /(\d{4})_(\d{2})_(\d{2})/,  // YYYY_MM_DD
    /(\d{2})-(\d{2})-(\d{4})/,  // MM-DD-YYYY
    /(\d{1,2})[._-](\d{1,2})[._-](\d{2,4})/,  // Various date formats
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return undefined;
}

async function processAllPDFs(basePath: string): Promise<ExtractedDocument[]> {
  const documents: ExtractedDocument[] = [];

  console.log('Starting PDF processing...');
  console.log(`Base path: ${basePath}\n`);

  // Read all year directories
  const years = fs.readdirSync(basePath).filter((file) => {
    const fullPath = path.join(basePath, file);
    return fs.statSync(fullPath).isDirectory();
  });

  for (const year of years.sort()) {
    const yearPath = path.join(basePath, year);
    console.log(`Processing year: ${year}`);

    const files = fs.readdirSync(yearPath).filter(file => file.endsWith('.pdf'));
    console.log(`  Found ${files.length} PDF files`);

    let processedCount = 0;
    for (const file of files) {
      const filePath = path.join(yearPath, file);
      const text = await extractTextFromPDF(filePath);

      if (text.trim().length > 0) {
        const documentId = `${year}-${file.replace('.pdf', '')}`;
        const isIndex = isIndexFile(file);

        const metadata: ExtractedDocument['metadata'] = {
          year,
          filename: file,
          pages: text.split('\n\n').length,
          date: extractDateFromFilename(file),
        };

        // Add index-specific metadata
        if (isIndex) {
          const indexYear = extractYearFromFilename(file);
          metadata.isIndex = true;
          metadata.indexYear = indexYear;
          metadata.referenceFormat = detectReferenceFormat(indexYear);
        }

        documents.push({
          id: documentId,
          text: text.trim(),
          metadata,
        });

        processedCount++;
        if (processedCount % 10 === 0) {
          console.log(`    Processed ${processedCount}/${files.length} files...`);
        }
      } else {
        console.log(`    ⚠️  Warning: Empty text extracted from ${file}`);
      }
    }

    console.log(`  ✓ Completed ${year}: ${processedCount} documents\n`);
  }

  return documents;
}

async function main() {
  // Path to the PDFs directory
  const pdfsPath = path.join(__dirname, '../../scripts/ifstone_pdfs');

  if (!fs.existsSync(pdfsPath)) {
    console.error(`Error: PDFs directory not found at ${pdfsPath}`);
    console.error('Please run the download script first to get the PDFs.');
    process.exit(1);
  }

  // Process all PDFs
  const documents = await processAllPDFs(pdfsPath);

  // Create data directory if it doesn't exist
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Save extracted documents to JSON file
  const outputPath = path.join(dataDir, 'extracted-documents.json');
  fs.writeFileSync(outputPath, JSON.stringify(documents, null, 2));

  console.log('='  .repeat(60));
  console.log('PDF Processing Complete!');
  console.log(`Total documents extracted: ${documents.length}`);
  console.log(`Output saved to: ${outputPath}`);
  console.log(`Total text size: ${(JSON.stringify(documents).length / 1024 / 1024).toFixed(2)} MB`);
  console.log('='  .repeat(60));
}

main().catch(console.error);
