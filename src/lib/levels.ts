import type { Level } from './types';

/** Level whose [min, max] range contains percent (clamped to 0–100). */
export function levelFor(percent: number, levels: Level[]): Level {
  const p = Math.min(100, Math.max(0, Math.round(percent)));
  return levels.find((l) => p >= l.min && p <= l.max) ?? levels[levels.length - 1];
}
