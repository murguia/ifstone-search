export interface SearchFilters {
  type?: string;
  author?: string;
  year?: string;
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
