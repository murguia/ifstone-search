import { describe, it, expect, vi, beforeEach } from 'vitest';

// lib/openai throws at import if OPENAI_API_KEY is unset and would make a real
// network call; mock it so these tests exercise only parse/validation logic.
vi.mock('../lib/openai', () => ({
  openai: { chat: { completions: { create: vi.fn() } } },
}));

// lib/db throws at import without DATABASE_URL and would hit a real DB; mock the
// pool so loadAuthors() returns a fixed corpus author set.
vi.mock('../lib/db', () => ({
  pool: {
    query: vi.fn().mockResolvedValue({
      rows: [
        { author: 'I.F. Stone', n: 3261 },
        { author: 'Jennings Perry', n: 36 },
      ],
    }),
  },
}));

import { parseQuery, sanitizeParsedQuery } from '../lib/self-query';
import { openai } from '../lib/openai';

const create = openai.chat.completions.create as unknown as ReturnType<typeof vi.fn>;
const mockLLM = (obj: unknown) =>
  create.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(obj) } }] });

// Stand-in for the corpus author set passed into the pure validator.
const AUTHORS = new Set(['I.F. Stone', 'Jennings Perry']);

describe('sanitizeParsedQuery (guardrails)', () => {
  it('keeps a fully valid parse', () => {
    const r = sanitizeParsedQuery(
      {
        semanticQuery: 'Vietnam war',
        type: 'article',
        author: 'I.F. Stone',
        year: null,
        dateFrom: null,
        dateTo: '1963-11-21',
        interpretation: "I.F. Stone's own articles before Nov 1963",
      },
      'orig',
      AUTHORS
    );
    expect(r.semanticQuery).toBe('Vietnam war');
    expect(r.filters).toEqual({ type: 'article', author: 'I.F. Stone', dateTo: '1963-11-21' });
    expect(r.interpretation).toBe("I.F. Stone's own articles before Nov 1963");
  });

  it('keeps a recurring author that exists in the corpus', () => {
    const r = sanitizeParsedQuery({ semanticQuery: 'x', author: 'Jennings Perry' }, 'q', AUTHORS);
    expect(r.filters.author).toBe('Jennings Perry');
  });

  it('drops an author not present in the corpus', () => {
    const r = sanitizeParsedQuery({ semanticQuery: 'x', author: 'Walter Lippmann' }, 'q', AUTHORS);
    expect(r.filters.author).toBeUndefined();
  });

  it('drops an unknown type', () => {
    const r = sanitizeParsedQuery({ semanticQuery: 'x', type: 'op-ed' }, 'q', AUTHORS);
    expect(r.filters.type).toBeUndefined();
  });

  it('drops a year outside the corpus', () => {
    expect(sanitizeParsedQuery({ semanticQuery: 'x', year: 1900 }, 'q', AUTHORS).filters.year).toBeUndefined();
    expect(sanitizeParsedQuery({ semanticQuery: 'x', year: 1980 }, 'q', AUTHORS).filters.year).toBeUndefined();
  });

  it('accepts an in-corpus year as a string', () => {
    expect(sanitizeParsedQuery({ semanticQuery: 'x', year: 1963 }, 'q', AUTHORS).filters.year).toBe('1963');
  });

  it('drops out-of-range and malformed dates', () => {
    expect(sanitizeParsedQuery({ semanticQuery: 'x', dateTo: '1492-01-01' }, 'q', AUTHORS).filters.dateTo).toBeUndefined();
    expect(sanitizeParsedQuery({ semanticQuery: 'x', dateFrom: 'banana' }, 'q', AUTHORS).filters.dateFrom).toBeUndefined();
    expect(sanitizeParsedQuery({ semanticQuery: 'x', dateTo: '1965-13-40' }, 'q', AUTHORS).filters.dateTo).toBeUndefined();
  });

  it('drops both dates when dateFrom > dateTo', () => {
    const r = sanitizeParsedQuery({ semanticQuery: 'x', dateFrom: '1965-01-01', dateTo: '1960-01-01' }, 'q', AUTHORS);
    expect(r.filters.dateFrom).toBeUndefined();
    expect(r.filters.dateTo).toBeUndefined();
  });

  it('falls back to the question when semanticQuery is empty', () => {
    expect(sanitizeParsedQuery({ semanticQuery: '' }, 'the original question', AUTHORS).semanticQuery).toBe(
      'the original question'
    );
  });

  it('blanks interpretation when no filters survive', () => {
    const r = sanitizeParsedQuery(
      { semanticQuery: 'McCarthy', interpretation: 'should not show' },
      'McCarthy',
      AUTHORS
    );
    expect(r.filters).toEqual({});
    expect(r.interpretation).toBe('');
  });
});

describe('parseQuery', () => {
  beforeEach(() => create.mockReset());

  it('returns sanitized filters for a valid LLM response', async () => {
    mockLLM({
      semanticQuery: 'nuclear test ban treaty',
      type: null,
      author: null,
      year: 1963,
      dateFrom: null,
      dateTo: null,
      interpretation: 'Articles from 1963',
    });
    const r = await parseQuery('nuclear test ban treaty in 1963');
    expect(r.semanticQuery).toBe('nuclear test ban treaty');
    expect(r.filters).toEqual({ year: '1963' });
  });

  it('keeps an inferred author that exists in the corpus', async () => {
    mockLLM({
      semanticQuery: 'civil rights',
      type: null,
      author: 'Jennings Perry',
      year: null,
      dateFrom: null,
      dateTo: null,
      interpretation: "Jennings Perry's articles on civil rights",
    });
    const r = await parseQuery('what did Jennings Perry write about civil rights');
    expect(r.filters.author).toBe('Jennings Perry');
  });

  it('drops an inferred author absent from the corpus', async () => {
    mockLLM({
      semanticQuery: 'foreign policy',
      type: null,
      author: 'Walter Lippmann',
      year: null,
      dateFrom: null,
      dateTo: null,
      interpretation: "Walter Lippmann on foreign policy",
    });
    const r = await parseQuery('what did Walter Lippmann write about foreign policy');
    expect(r.filters.author).toBeUndefined();
  });

  it('falls back to plain search when the LLM call throws', async () => {
    create.mockRejectedValueOnce(new Error('network down'));
    const r = await parseQuery('anything');
    expect(r).toEqual({ semanticQuery: 'anything', filters: {}, interpretation: '' });
  });

  it('falls back when the LLM returns invalid JSON', async () => {
    create.mockResolvedValueOnce({ choices: [{ message: { content: 'not json' } }] });
    const r = await parseQuery('weird query');
    expect(r).toEqual({ semanticQuery: 'weird query', filters: {}, interpretation: '' });
  });
});
