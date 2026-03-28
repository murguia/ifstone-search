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

/**
 * Search for similar chunks with index-topic boosting
 *
 * Chunks that Stone himself categorized via his annual index get a 20%
 * score boost when query keywords match their index_topics. This means
 * Stone's own categorization influences ranking — a search for "McCarthy"
 * will prioritize articles he indexed under MCCARTHY over articles that
 * merely mention the name.
 */
export async function searchSimilarChunks(
  embedding: number[],
  query: string,
  topK: number = 5,
  filters: SearchFilters = {}
) {
  const index = pinecone.index(PINECONE_INDEX_NAME);

  const fetchK = Math.min(topK * 3, 30);

  const filterConditions = buildPineconeFilter(filters);

  const queryParams: any = {
    vector: embedding,
    topK: fetchK,
    includeMetadata: true,
  };
  if (Object.keys(filterConditions).length > 0) {
    queryParams.filter = filterConditions;
  }

  const results = await index.query(queryParams);

  const matches = results.matches || [];

  const TOPIC_BOOST = 1.20; // 20% boost when query keywords match index_topics
  const queryWords = query.toUpperCase().split(/\s+/).filter((w) => w.length > 2);

  const boostedMatches = matches.map((match) => {
    const metadata = match.metadata as Record<string, any>;
    let boosted = false;

    if (metadata?.has_index_topics) {
      try {
        const topics: string[] = JSON.parse(metadata.index_topics || '[]');
        const topicsUpper = topics.join(' ').toUpperCase();
        boosted = queryWords.some((word) => topicsUpper.includes(word));
      } catch {
        // malformed index_topics — skip boosting
      }
    }

    return {
      ...match,
      score: boosted ? (match.score || 0) * TOPIC_BOOST : (match.score || 0),
      _wasBoosted: boosted,
    };
  });

  boostedMatches.sort((a, b) => (b.score || 0) - (a.score || 0));

  return boostedMatches.slice(0, topK);
}
