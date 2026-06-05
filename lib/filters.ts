export interface SearchFilters {
  type?: string;
  author?: string;
  year?: string;
  dateFrom?: string; // 'YYYY-MM-DD'
  dateTo?: string;   // 'YYYY-MM-DD'
}

export function buildPineconeFilter(filters: SearchFilters): Record<string, any> {
  const conditions: Record<string, any> = {};
  if (filters.type === 'article') {
    conditions.type = { $in: ['analysis', 'note'] };
  } else if (filters.type) {
    conditions.type = filters.type;
  }
  if (filters.author) conditions.author = filters.author;
  if (filters.year) conditions.year = filters.year;
  return conditions;
}

// SQL counterpart of buildPineconeFilter for the Postgres serving layer.
// Appends each value to `params` and returns an " AND ..." fragment whose
// placeholders ($N) point at those positions. `alias` is the table the
// predicates apply to (the articles table directly, or `a` when sections are
// joined back to it) so the same constraints apply to both hybrid rankers.
export function buildSqlWhere(
  filters: SearchFilters,
  alias: string,
  params: any[]
): string {
  const conds: string[] = [];
  const add = (sql: string, val: any) => {
    params.push(val);
    conds.push(sql.replace('?', `$${params.length}`));
  };
  if (filters.type === 'article') {
    add(`${alias}.type <> ?`, 'quotation-transcription');
  } else if (filters.type) {
    add(`${alias}.type = ?`, filters.type);
  }
  if (filters.author) add(`${alias}.author = ?`, filters.author);
  if (filters.year) add(`${alias}.year = ?`, Number(filters.year));
  if (filters.dateFrom) add(`${alias}.date >= ?`, filters.dateFrom);
  if (filters.dateTo) add(`${alias}.date <= ?`, filters.dateTo);
  return conds.length ? ' AND ' + conds.join(' AND ') : '';
}
