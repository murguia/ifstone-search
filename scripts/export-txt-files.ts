/**
 * Export extracted documents to individual TXT files
 */

import fs from 'fs';
import path from 'path';

interface ExtractedDocument {
  id: string;
  text: string;
  metadata: {
    year: string;
    filename: string;
    pages: number;
    date?: string;
    isIndex?: boolean;
  };
}

async function main() {
  const dataPath = path.join(__dirname, '../data/extracted-documents.json');
  const outputDir = path.join(__dirname, '../public/articles');

  console.log('Loading extracted documents...');
  const documents: ExtractedDocument[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  console.log(`Loaded ${documents.length} documents\n`);

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let exportedCount = 0;
  let skippedCount = 0;

  for (const doc of documents) {
    const yearDir = path.join(outputDir, doc.metadata.year);

    // Create year directory if needed
    if (!fs.existsSync(yearDir)) {
      fs.mkdirSync(yearDir, { recursive: true });
    }

    // Generate filename (remove .pdf extension)
    const txtFilename = doc.metadata.filename.replace('.pdf', '.txt');
    const txtPath = path.join(yearDir, txtFilename);

    // Create file content with metadata header
    const header = `I.F. Stone's Weekly
${doc.metadata.isIndex ? 'INDEX' : 'Article'}
Year: ${doc.metadata.year}
Filename: ${doc.metadata.filename}
${doc.metadata.date ? `Date: ${doc.metadata.date}` : ''}
${'='.repeat(60)}

`;

    const content = header + doc.text;

    // Write file
    fs.writeFileSync(txtPath, content, 'utf-8');
    exportedCount++;

    if (exportedCount % 50 === 0) {
      console.log(`Exported ${exportedCount}/${documents.length} files...`);
    }
  }

  // Calculate total size
  const getTotalSize = (dir: string): number => {
    let size = 0;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        size += getTotalSize(filePath);
      } else {
        size += stat.size;
      }
    }
    return size;
  };

  const totalSize = getTotalSize(outputDir);

  console.log('\n' + '='.repeat(60));
  console.log('Export Complete!');
  console.log(`Exported: ${exportedCount} files`);
  console.log(`Skipped: ${skippedCount} files`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log('='.repeat(60));
}

main().catch(console.error);
