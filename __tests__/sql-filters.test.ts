import { describe, it, expect } from 'vitest';
import { buildSqlWhere } from '../lib/filters';

describe('buildSqlWhere', () => {
  it('returns empty fragment and no params when no filters', () => {
    const params: any[] = [];
    expect(buildSqlWhere({}, 'articles', params)).toBe('');
    expect(params).toEqual([]);
  });

  it('expands "article" type to "not a quotation-transcription"', () => {
    const params: any[] = [];
    expect(buildSqlWhere({ type: 'article' }, 'articles', params)).toBe(
      ' AND articles.type <> $1'
    );
    expect(params).toEqual(['quotation-transcription']);
  });

  it('filters by a specific type', () => {
    const params: any[] = [];
    expect(buildSqlWhere({ type: 'analysis' }, 'articles', params)).toBe(
      ' AND articles.type = $1'
    );
    expect(params).toEqual(['analysis']);
  });

  it('coerces year to a number (year column is int)', () => {
    const params: any[] = [];
    buildSqlWhere({ year: '1953' }, 'articles', params);
    expect(params).toEqual([1953]);
  });

  it('builds a date range', () => {
    const params: any[] = [];
    expect(
      buildSqlWhere({ dateFrom: '1953-01-01', dateTo: '1954-06-30' }, 'a', params)
    ).toBe(' AND a.date >= $1 AND a.date <= $2');
    expect(params).toEqual(['1953-01-01', '1954-06-30']);
  });

  it('numbers placeholders continuing from a pre-populated params array', () => {
    const params: any[] = ['[0,0,0]']; // $1 already taken (e.g. the query vector)
    const frag = buildSqlWhere({ author: 'I.F. Stone', year: '1953' }, 'articles', params);
    expect(frag).toBe(' AND articles.author = $2 AND articles.year = $3');
    expect(params).toEqual(['[0,0,0]', 'I.F. Stone', 1953]);
  });

  it('combines multiple filters with AND', () => {
    const params: any[] = [];
    expect(
      buildSqlWhere({ type: 'article', author: 'Jennings Perry' }, 'articles', params)
    ).toBe(' AND articles.type <> $1 AND articles.author = $2');
    expect(params).toEqual(['quotation-transcription', 'Jennings Perry']);
  });
});
