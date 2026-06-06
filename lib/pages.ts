// Format an article's page-number array as a citation string:
//   [3] -> "p. 3"   [2,3] -> "pp. 2–3"   [1,4] -> "pp. 1, 4"   [1,2,4] -> "pp. 1–2, 4"
// Contiguous runs collapse to ranges; gaps stay comma-separated. Empty -> "".
export function formatPages(pages?: number[] | null): string {
  if (!pages || pages.length === 0) return '';

  const sorted = [...pages].sort((a, b) => a - b);
  const runs: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  const flush = () => runs.push(start === prev ? `${start}` : `${start}–${prev}`);

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) {
      prev = sorted[i];
    } else {
      flush();
      start = prev = sorted[i];
    }
  }
  flush();

  return `${sorted.length === 1 ? 'p.' : 'pp.'} ${runs.join(', ')}`;
}
