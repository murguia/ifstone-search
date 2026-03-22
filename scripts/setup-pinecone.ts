import { config } from 'dotenv';
import { Pinecone } from '@pinecone-database/pinecone';

// Load environment variables from .env.local
config({ path: '.env.local' });

const PINECONE_INDEX_NAME = 'ifstone-weekly';
const EMBEDDING_DIMENSION = 1536; // text-embedding-3-small dimension

async function main() {
  if (!process.env.PINECONE_API_KEY) {
    console.error('Error: PINECONE_API_KEY environment variable is not set');
    process.exit(1);
  }

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });

  console.log('Setting up Pinecone index...\n');

  try {
    // Check if index already exists
    const existingIndexes = await pinecone.listIndexes();
    const indexExists = existingIndexes.indexes?.some(
      (index) => index.name === PINECONE_INDEX_NAME
    );

    if (indexExists) {
      console.log(`Index "${PINECONE_INDEX_NAME}" already exists.`);
      console.log('You can proceed with uploading embeddings.');
    } else {
      console.log(`Creating new index "${PINECONE_INDEX_NAME}"...`);

      await pinecone.createIndex({
        name: PINECONE_INDEX_NAME,
        dimension: EMBEDDING_DIMENSION,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1',
          },
        },
      });

      console.log('✓ Index created successfully!');
      console.log('\nNote: It may take a few minutes for the index to be fully initialized.');
      console.log('You can check the status in your Pinecone dashboard.');
    }

    console.log('\n' + '='.repeat(60));
    console.log('Pinecone setup complete!');
    console.log(`Index name: ${PINECONE_INDEX_NAME}`);
    console.log(`Dimension: ${EMBEDDING_DIMENSION}`);
    console.log(`Metric: cosine`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error('Error setting up Pinecone:', error);
    process.exit(1);
  }
}

main().catch(console.error);
