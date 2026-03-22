import { Pinecone } from '@pinecone-database/pinecone';

if (!process.env.PINECONE_API_KEY) {
  throw new Error('PINECONE_API_KEY is not set');
}

export const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

export const PINECONE_INDEX_NAME = 'ifstone-weekly';

/**
 * Search for similar chunks with index boosting
 *
 * Index chunks are given a 15% score boost because they contain
 * curated references with article titles and citations
 */
export async function searchSimilarChunks(
  embedding: number[],
  topK: number = 5
) {
  const index = pinecone.index(PINECONE_INDEX_NAME);

  // Fetch more results than needed to ensure we get good coverage
  // after boosting index chunks
  const fetchK = Math.min(topK * 3, 30);

  const results = await index.query({
    vector: embedding,
    topK: fetchK,
    includeMetadata: true,
  });

  const matches = results.matches || [];

  // Apply boost to index chunks
  const INDEX_BOOST = 1.15; // 15% boost for index chunks

  const boostedMatches = matches.map((match) => {
    const metadata = match.metadata as Record<string, any>;
    const isIndex = metadata?.isIndex === true;

    // Apply boost to score
    const boostedScore = isIndex
      ? (match.score || 0) * INDEX_BOOST
      : (match.score || 0);

    return {
      ...match,
      score: boostedScore,
      // Add flag to track that this was boosted (useful for debugging)
      _wasBoosted: isIndex,
    };
  });

  // Re-sort by boosted scores and take top K
  boostedMatches.sort((a, b) => (b.score || 0) - (a.score || 0));

  return boostedMatches.slice(0, topK);
}
