import { describe, it, expect } from 'vitest';
import { formatPages } from '../lib/pages';

describe('formatPages', () => {
  it('formats a single page', () => {
    expect(formatPages([3])).toBe('p. 3');
  });

  it('formats a contiguous range', () => {
    expect(formatPages([2, 3])).toBe('pp. 2–3');
    expect(formatPages([1, 2, 3])).toBe('pp. 1–3');
  });

  it('formats non-contiguous pages as a list', () => {
    expect(formatPages([1, 4])).toBe('pp. 1, 4');
  });

  it('mixes ranges and gaps', () => {
    expect(formatPages([1, 2, 4])).toBe('pp. 1–2, 4');
    expect(formatPages([1, 2, 4, 5, 7])).toBe('pp. 1–2, 4–5, 7');
  });

  it('sorts unordered input', () => {
    expect(formatPages([4, 1])).toBe('pp. 1, 4');
  });

  it('returns empty string for empty/missing input', () => {
    expect(formatPages([])).toBe('');
    expect(formatPages(null)).toBe('');
    expect(formatPages(undefined)).toBe('');
  });
});
