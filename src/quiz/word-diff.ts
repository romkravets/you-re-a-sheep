export interface Seg { text: string; changed: boolean }

/** Word-level diff via LCS. Returns the `before` and `after` word lists with changed words flagged. */
export function wordDiff(before: string, after: string): { before: Seg[]; after: Seg[] } {
  const a = before.split(/\s+/).filter(Boolean);
  const b = after.split(/\s+/).filter(Boolean);
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const outA: Seg[] = [];
  const outB: Seg[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      outA.push({ text: a[i++], changed: false });
      outB.push({ text: b[j++], changed: false });
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      outA.push({ text: a[i++], changed: true });
    } else {
      outB.push({ text: b[j++], changed: true });
    }
  }
  while (i < a.length) outA.push({ text: a[i++], changed: true });
  while (j < b.length) outB.push({ text: b[j++], changed: true });
  return { before: outA, after: outB };
}
