import { pool } from './db';
import { buildSqlWhere, SearchFilters } from './filters';

export { type SearchFilters } from './filters';

const RRF_K = 60;        // RRF constant; damps the tail
const CANDIDATES = 50;   // per-ranker pool feeding the fusion

interface Match {
  metadata: Record<string, any>;
  score: number;
}

// Hybrid search over the Postgres serving layer: semantic (two-level: best
// distance across an article's article-level and section vectors) + lexical
// (websearch_to_tsquery over articles.fts), fused by Reciprocal Rank Fusion.
// Returns { metadata, score } matches; the chat route builds context and
// sources from these.
export async function searchArticles(
  queryText: string,
  embedding: number[],
  topK: number = 10,
  filters: SearchFilters = {}
): Promise<Match[]> {
  const vec = `[${embedding.join(',')}]`;

  // Semantic ranker. $1 (the query vector) is reused for both legs; filter
  // placeholders follow, applied to both legs (sections joined back to articles).
  const semParams: any[] = [vec];
  const artWhere = buildSqlWhere(filters, 'articles', semParams);
  const secWhere = buildSqlWhere(filters, 'a', semParams);
  semParams.push(CANDIDATES);
  const semSql = `
    SELECT article_id FROM (
      SELECT article_id, min(dist) AS dist FROM (
        SELECT article_id, embedding <=> $1::vector AS dist
        FROM articles WHERE embedding IS NOT NULL${artWhere}
        UNION ALL
        SELECT s.article_id, s.embedding <=> $1::vector AS dist
        FROM sections s JOIN articles a USING (article_id)
        WHERE s.embedding IS NOT NULL${secWhere}
      ) u GROUP BY article_id
    ) g ORDER BY dist LIMIT $${semParams.length}`;

  // Lexical ranker. $1 (the query text) is reused in the match and the rank.
  const lexParams: any[] = [queryText];
  const lexWhere = buildSqlWhere(filters, 'articles', lexParams);
  lexParams.push(CANDIDATES);
  const lexSql = `
    SELECT article_id FROM articles
    WHERE fts @@ websearch_to_tsquery('english', $1)${lexWhere}
    ORDER BY ts_rank(fts, websearch_to_tsquery('english', $1)) DESC
    LIMIT $${lexParams.length}`;

  const [sem, lex] = await Promise.all([
    pool.query(semSql, semParams),
    pool.query(lexSql, lexParams),
  ]);

  // Reciprocal Rank Fusion: sum 1/(k+rank) across rankers.
  const scores = new Map<string, number>();
  const fold = (rows: any[]) =>
    rows.forEach((r, i) =>
      scores.set(r.article_id, (scores.get(r.article_id) || 0) + 1 / (RRF_K + i + 1))
    );
  fold(sem.rows);
  fold(lex.rows);

  const top = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([id]) => id);
  if (top.length === 0) return [];

  // Hydrate the winners with the metadata the route expects (date/year as strings).
  const { rows } = await pool.query(
    `SELECT article_id, title, to_char(date, 'YYYY-MM-DD') AS date,
            year::text AS year, author, type, full_text, file_id, index_topics, pages
     FROM articles WHERE article_id = ANY($1)`,
    [top]
  );
  const byId = new Map(rows.map((r) => [r.article_id, r]));

  return top.map((id) => ({ metadata: byId.get(id), score: scores.get(id)! }));
}
