import { describe, it, expect } from 'vitest';
import { wordDiff } from '../../src/quiz/word-diff';

describe('wordDiff', () => {
  it('marks only changed words on both sides', () => {
    const d = wordDiff('зростання на 5% у 2024 році', 'зростання на 15% у 2025 році');
    expect(d.before.filter((s) => s.changed).map((s) => s.text)).toEqual(['5%', '2024']);
    expect(d.after.filter((s) => s.changed).map((s) => s.text)).toEqual(['15%', '2025']);
    expect(d.after.map((s) => s.text).join(' ')).toBe('зростання на 15% у 2025 році');
  });
  it('identical text has no changes', () => {
    const d = wordDiff('а б в', 'а б в');
    expect([...d.before, ...d.after].some((s) => s.changed)).toBe(false);
  });
  it('handles insertions and deletions', () => {
    const d = wordDiff('один два три', 'один три чотири');
    expect(d.before.filter((s) => s.changed).map((s) => s.text)).toEqual(['два']);
    expect(d.after.filter((s) => s.changed).map((s) => s.text)).toEqual(['чотири']);
  });
});
