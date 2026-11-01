export interface AccentPart { text: string; accent: boolean }

/** Splits «a *b* c» into plain and accent (red) parts; an unclosed star stays literal. */
export function splitAccent(s: string): AccentPart[] {
  const parts: AccentPart[] = [];
  const re = /\*([^*]+)\*/g;
  let last = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (m.index > last) parts.push({ text: s.slice(last, m.index), accent: false });
    parts.push({ text: m[1], accent: true });
    last = re.lastIndex;
  }
  if (last < s.length) parts.push({ text: s.slice(last), accent: false });
  return parts;
}
