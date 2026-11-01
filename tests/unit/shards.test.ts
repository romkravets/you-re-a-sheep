import { describe, it, expect } from 'vitest';
import { makeShards } from '../../src/crack/shards';
import { makeRng } from '../../src/lib/rng';

function area(points: [number, number][]): number {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

const cases = [
  { w: 412, h: 915, count: 28, impact: { x: 200, y: 470 } },
  { w: 1440, h: 900, count: 44, impact: { x: 730, y: 440 } },
  { w: 412, h: 915, count: 8, impact: { x: 220, y: 430 } },
];

describe('makeShards', () => {
  it.each(cases)('shards cover the area ($w×$h, $count)', ({ w, h, count, impact }) => {
    const shards = makeShards(w, h, impact, count, makeRng(7));
    const total = shards.reduce((s, sh) => s + area(sh.points), 0);
    expect(Math.abs(total - w * h)).toBeLessThanOrEqual(w * h * 0.01);
  });

  it.each(cases)('count respected ($count)', ({ w, h, count, impact }) => {
    expect(makeShards(w, h, impact, count, makeRng(3))).toHaveLength(count);
  });

  it('deterministic with seeded rnd', () => {
    const a = makeShards(412, 915, { x: 200, y: 470 }, 28, makeRng(42));
    const b = makeShards(412, 915, { x: 200, y: 470 }, 28, makeRng(42));
    const c = makeShards(412, 915, { x: 200, y: 470 }, 28, makeRng(43));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  // The 8-shard «stop» flash is left out: with 5 near seeds every near cell is on the hull and reaches the edges.
  it.each(cases.filter((c) => c.count >= 28))('bias: at least half of the centroids near the impact ($count)', ({ w, h, count, impact }) => {
    for (let seed = 1; seed <= 20; seed++) {
      const shards = makeShards(w, h, impact, count, makeRng(seed));
      const r = 0.35 * Math.min(w, h);
      const near = shards.filter((s) => Math.hypot(s.centroid[0] - impact.x, s.centroid[1] - impact.y) <= r).length;
      expect(near / shards.length).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('centroid lies inside the shard bounding box; polygons are open (no repeated first point)', () => {
    for (const s of makeShards(412, 915, { x: 30, y: 30 }, 28, makeRng(9))) {
      const xs = s.points.map((p) => p[0]);
      const ys = s.points.map((p) => p[1]);
      expect(s.centroid[0]).toBeGreaterThanOrEqual(Math.min(...xs));
      expect(s.centroid[0]).toBeLessThanOrEqual(Math.max(...xs));
      expect(s.centroid[1]).toBeGreaterThanOrEqual(Math.min(...ys));
      expect(s.centroid[1]).toBeLessThanOrEqual(Math.max(...ys));
      expect(s.points[0]).not.toEqual(s.points[s.points.length - 1]);
    }
  });
});
