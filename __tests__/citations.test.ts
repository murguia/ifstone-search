import { describe, it, expect } from 'vitest';
import { parseCitations } from '../lib/citations';

describe('parseCitations', () => {
  it('returns plain text when no citations present', () => {
    const result = parseCitations('Hello world');
    expect(result).toEqual([{ type: 'text', value: 'Hello world' }]);
  });

  it('parses a single citation', () => {
    const result = parseCitations('McCarthy was investigated [1] by the Senate.');
    expect(result).toEqual([
      { type: 'text', value: 'McCarthy was investigated ' },
      { type: 'citation', value: '[1]', num: 1 },
      { type: 'text', value: ' by the Senate.' },
    ]);
  });

  it('parses multiple citations', () => {
    const result = parseCitations('Stone wrote about Korea [1] and McCarthy [3].');
    expect(result).toEqual([
      { type: 'text', value: 'Stone wrote about Korea ' },
      { type: 'citation', value: '[1]', num: 1 },
      { type: 'text', value: ' and McCarthy ' },
      { type: 'citation', value: '[3]', num: 3 },
      { type: 'text', value: '.' },
    ]);
  });

  it('parses adjacent citations', () => {
    const result = parseCitations('multiple sources [1][2][3] confirm this');
    expect(result).toEqual([
      { type: 'text', value: 'multiple sources ' },
      { type: 'citation', value: '[1]', num: 1 },
      { type: 'citation', value: '[2]', num: 2 },
      { type: 'citation', value: '[3]', num: 3 },
      { type: 'text', value: ' confirm this' },
    ]);
  });

  it('parses double-digit citation numbers', () => {
    const result = parseCitations('see [10] for details');
    expect(result).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'citation', value: '[10]', num: 10 },
      { type: 'text', value: ' for details' },
    ]);
  });

  it('handles empty string', () => {
    const result = parseCitations('');
    expect(result).toEqual([]);
  });

  it('handles citation at start of text', () => {
    const result = parseCitations('[1] Stone argued that...');
    expect(result).toEqual([
      { type: 'citation', value: '[1]', num: 1 },
      { type: 'text', value: ' Stone argued that...' },
    ]);
  });

  it('handles citation at end of text', () => {
    const result = parseCitations('Stone argued that [5]');
    expect(result).toEqual([
      { type: 'text', value: 'Stone argued that ' },
      { type: 'citation', value: '[5]', num: 5 },
    ]);
  });

  it('does not match non-numeric brackets', () => {
    const result = parseCitations('the [Source 1] reference');
    expect(result).toEqual([{ type: 'text', value: 'the [Source 1] reference' }]);
  });
});
