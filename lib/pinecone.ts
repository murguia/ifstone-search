import { Pinecone } from '@pinecone-database/pinecone';
import { buildPineconeFilter, SearchFilters } from './filters';

if (!process.env.PINECONE_API_KEY) {
  throw new Error('PINECONE_API_KEY is not set');
}

export const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

export const PINECONE_INDEX_NAME = 'ifstone-weekly';

// Re-export for consumers
export { buildPineconeFilter, type SearchFilters } from './filters';

export async function searchSimilarChunks(
  embedding: number[],
  topK: number = 5,
  filters: SearchFilters = {}
) {
  const index = pinecone.index(PINECONE_INDEX_NAME);

  const filterConditions = buildPineconeFilter(filters);

  const queryParams: any = {
    vector: embedding,
    topK,
    includeMetadata: true,
  };
  if (Object.keys(filterConditions).length > 0) {
    queryParams.filter = filterConditions;
  }

  const results = await index.query(queryParams);

  return results.matches || [];
}
