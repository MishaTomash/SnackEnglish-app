/**
 * Розраховує відсоток схожості двох рядків (від 0 до 100%) за алгоритмом Левенштейна.
 */
export function calculateSimilarity(actual: string, expected: string): number {
  const clean = (str: string): string =>
    str
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()?'"–—]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const a = clean(actual);
  const b = clean(expected);

  if (!a && !b) return 100;
  if (!a || !b) return 0;
  if (a === b) return 100;

  const matrix: number[][] = Array.from({ length: b.length + 1 }, () =>
    new Array<number>(a.length + 1).fill(0),
  );

  for (let i = 0; i <= a.length; i += 1) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j += 1) {
    for (let i = 1; i <= a.length; i += 1) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator,
      );
    }
  }

  const distance = matrix[b.length][a.length];
  const maxLength = Math.max(a.length, b.length);
  const ratio = (maxLength - distance) / maxLength;

  return Math.round(ratio * 100);
}
