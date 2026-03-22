/**
 * Add index metadata to existing extracted documents
 */

import fs from 'fs';
import path from 'path';
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

async function main() {
  const dataPath = path.join(__dirname, '../data/extracted-documents.json');

  console.log('Loading extracted documents...');
  const documents: ExtractedDocument[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  console.log(`Loaded ${documents.length} documents\n`);

  let indexCount = 0;

  // Add metadata to each document
  for (const doc of documents) {
    if (isIndexFile(doc.metadata.filename)) {
      const year = extractYearFromFilename(doc.metadata.filename);
      doc.metadata.isIndex = true;
      doc.metadata.indexYear = year;
      doc.metadata.referenceFormat = detectReferenceFormat(year);
      indexCount++;
    }
  }

  // Save updated documents
  console.log(`Adding index metadata to ${indexCount} documents...`);
  fs.writeFileSync(dataPath, JSON.stringify(documents, null, 2));

  console.log('✅ Done!');
  console.log(`   Total documents: ${documents.length}`);
  console.log(`   Index documents: ${indexCount}`);
  console.log(`   Regular documents: ${documents.length - indexCount}`);
}

main().catch(console.error);
