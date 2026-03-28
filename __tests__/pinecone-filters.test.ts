import { describe, it, expect } from 'vitest';
import { buildPineconeFilter } from '../lib/filters';

describe('buildPineconeFilter', () => {
  it('returns empty object when no filters provided', () => {
    expect(buildPineconeFilter({})).toEqual({});
  });

  it('filters by a single type', () => {
    expect(buildPineconeFilter({ type: 'quotation-transcription' })).toEqual({
      type: 'quotation-transcription',
    });
  });

  it('expands "article" type to analysis and note', () => {
    expect(buildPineconeFilter({ type: 'article' })).toEqual({
      type: { $in: ['analysis', 'note'] },
    });
  });

  it('filters by author', () => {
    expect(buildPineconeFilter({ author: 'I.F. Stone' })).toEqual({
      author: 'I.F. Stone',
    });
  });

  it('filters by year', () => {
    expect(buildPineconeFilter({ year: '1953' })).toEqual({
      year: '1953',
    });
  });

  it('combines multiple filters', () => {
    expect(buildPineconeFilter({ type: 'analysis', author: 'I.F. Stone', year: '1953' })).toEqual({
      type: 'analysis',
      author: 'I.F. Stone',
      year: '1953',
    });
  });

  it('combines article type expansion with other filters', () => {
    expect(buildPineconeFilter({ type: 'article', author: 'Jennings Perry' })).toEqual({
      type: { $in: ['analysis', 'note'] },
      author: 'Jennings Perry',
    });
  });

  it('ignores undefined filter values', () => {
    expect(buildPineconeFilter({ type: undefined, author: 'I.F. Stone' })).toEqual({
      author: 'I.F. Stone',
    });
  });

  it('ignores empty string filter values', () => {
    expect(buildPineconeFilter({ type: '', author: '' })).toEqual({});
  });
});
