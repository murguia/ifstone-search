import { describe, it, expect, vi, beforeEach } from 'vitest';

// lib/openai throws at import if OPENAI_API_KEY is unset and would make real
// network calls; mock it so these tests exercise only validation/merge logic.
vi.mock('../lib/openai', () => ({
  openai: { chat: { completions: { create: vi.fn() } } },
  createEmbedding: vi.fn().mockResolvedValue([0.1, 0.2]),
}));

// lib/db throws at import without DATABASE_URL and would hit a real DB.
vi.mock('../lib/db', () => ({
  pool: { query: vi.fn() },
}));

// The executor's search path delegates to searchArticles; capture its args.
vi.mock('../lib/search', () => ({
  searchArticles: vi.fn().mockResolvedValue([]),
}));

import { clampTopK, buildToolFilters, executeTool } from '../lib/agent-tools';
import { dedupeMatches } from '../lib/agent';
import { searchArticles } from '../lib/search';
import { pool } from '../lib/db';

const search = searchArticles as unknown as ReturnType<typeof vi.fn>;
const query = pool.query as unknown as ReturnType<typeof vi.fn>;

// Stand-in for the corpus author set passed into the pure validator.
const AUTHORS = new Set(['I.F. Stone', 'Jennings Perry']);

describe('clampTopK', () => {
  it('defaults to 5 for missing or non-numeric values', () => {
    expect(clampTopK(undefined)).toBe(5);
    expect(clampTopK('banana')).toBe(5);
    expect(clampTopK(NaN)).toBe(5);
  });

  it('clamps to 1-10', () => {
    expect(clampTopK(0)).toBe(1);
    expect(clampTopK(-3)).toBe(1);
    expect(clampTopK(99)).toBe(10);
  });

  it('truncates fractions', () => {
    expect(clampTopK(7.9)).toBe(7);
  });
});

describe('buildToolFilters (tool-arg validation)', () => {
  it('keeps fully valid agent filters', () => {
    const r = buildToolFilters(
      {
        type: 'article',
        author: 'I.F. Stone',
        year: 1968,
        dateFrom: '1954-01-01',
      },
      {},
      AUTHORS
    );
    expect(r).toEqual({
      type: 'article',
      author: 'I.F. Stone',
      year: '1968',
      dateFrom: '1954-01-01',
    });
  });

  it('accepts a year sent as a string', () => {
    expect(buildToolFilters({ year: '1963' }, {}, AUTHORS).year).toBe('1963');
  });

  it('drops an author not present in the corpus', () => {
    expect(buildToolFilters({ author: 'Walter Lippmann' }, {}, AUTHORS).author).toBeUndefined();
  });

  it('drops an unknown type', () => {
    expect(buildToolFilters({ type: 'op-ed' }, {}, AUTHORS).type).toBeUndefined();
  });

  it('drops out-of-corpus years and dates', () => {
    const r = buildToolFilters(
      { year: 1980, dateFrom: '1492-01-01', dateTo: 'banana' },
      {},
      AUTHORS
    );
    expect(r).toEqual({});
  });

  it('drops both dates when dateFrom > dateTo', () => {
    const r = buildToolFilters(
      { dateFrom: '1965-01-01', dateTo: '1960-01-01' },
      {},
      AUTHORS
    );
    expect(r.dateFrom).toBeUndefined();
    expect(r.dateTo).toBeUndefined();
  });

  it('lets explicit UI filters override the agent', () => {
    const r = buildToolFilters(
      { author: 'Jennings Perry', year: 1955 },
      { author: 'I.F. Stone' },
      AUTHORS
    );
    expect(r).toEqual({ author: 'I.F. Stone', year: '1955' });
  });

  it('applies UI filters when the agent sends none', () => {
    expect(buildToolFilters(undefined, { dateTo: '1960-01-01' }, AUTHORS)).toEqual({
      dateTo: '1960-01-01',
    });
  });
});

describe('executeTool search_articles', () => {
  beforeEach(() => search.mockClear());

  it('searches with sanitized+merged filters and clamped top_k', async () => {
    const onProgress = vi.fn();
    await executeTool(
      'search_articles',
      { query: 'Vietnam', filters: { author: 'Nobody', year: 1968 }, top_k: 99 },
      { uiFilters: { type: 'analysis' }, allowedAuthors: AUTHORS, onProgress }
    );
    expect(search).toHaveBeenCalledWith('Vietnam', [0.1, 0.2], 10, {
      year: '1968',
      type: 'analysis',
    });
    expect(onProgress).toHaveBeenCalledWith({
      action: 'search',
      detail: 'Vietnam',
      filters: { year: '1968', type: 'analysis' },
    });
  });

  it('rejects an empty query without searching', async () => {
    const r = await executeTool(
      'search_articles',
      { query: '  ' },
      { uiFilters: {}, allowedAuthors: AUTHORS, onProgress: vi.fn() }
    );
    expect(r.content).toMatch(/query is required/);
    expect(r.matches).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });
});

describe('executeTool read_article', () => {
  it('returns not-found for an unknown article_id', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const onProgress = vi.fn();
    const r = await executeTool(
      'read_article',
      { article_id: 'nope' },
      { uiFilters: {}, allowedAuthors: AUTHORS, onProgress }
    );
    expect(r.content).toMatch(/No article found/);
    expect(r.matches).toEqual([]);
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('returns the article as a score-0 match and reports progress with its title', async () => {
    const row = { article_id: 'a1', title: 'The Tonkin Bay Mystery', full_text: 'body' };
    query.mockResolvedValueOnce({ rows: [row] });
    const onProgress = vi.fn();
    const r = await executeTool(
      'read_article',
      { article_id: 'a1' },
      { uiFilters: {}, allowedAuthors: AUTHORS, onProgress }
    );
    expect(r.matches).toEqual([{ metadata: row, score: 0 }]);
    expect(r.content).toContain('body');
    expect(onProgress).toHaveBeenCalledWith({ action: 'read', detail: 'The Tonkin Bay Mystery' });
  });
});

describe('dedupeMatches', () => {
  it('keeps the max score per article, ranks, and caps', () => {
    const m = (id: string, score: number) => ({ metadata: { article_id: id }, score });
    const r = dedupeMatches([m('a', 0.02), m('b', 0.05), m('a', 0.04), m('c', 0)], 2);
    expect(r.map((x) => x.metadata.article_id)).toEqual(['b', 'a']);
    expect(r[1].score).toBe(0.04);
  });
});
