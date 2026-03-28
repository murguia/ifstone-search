export interface CitationPart {
  type: 'text' | 'citation';
  value: string;
  num?: number;
}

/**
 * Parse text containing [1], [2] style citations into structured parts.
 */
export function parseCitations(text: string): CitationPart[] {
  const parts = text.split(/(\[\d+\])/g);
  return parts
    .filter((p) => p !== '')
    .map((part) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (match) {
        return { type: 'citation' as const, value: part, num: parseInt(match[1], 10) };
      }
      return { type: 'text' as const, value: part };
    });
}
