import { Delaunay } from 'd3-delaunay';

export type Pt = [number, number];
export interface Shard {
  points: Pt[];
  centroid: Pt;
}

/** Share of the seeds thrown close to the impact, and how close (fraction of min(w, h)). */
const NEAR_SHARE = 0.6;
const NEAR_RADIUS = 0.25;

/**
 * Cuts a w×h rectangle into `count` glass shards: Voronoi cells of seeds biased towards
 * the impact point (60% of them within 25% of min(w, h)), so pieces are small where
 * the glass was hit and large at the edges. Pure; deterministic for a seeded `rnd`.
 */
export function makeShards(w: number, h: number, impact: { x: number; y: number }, count: number, rnd: () => number): Shard[] {
  const near = Math.round(count * NEAR_SHARE);
  const radius = NEAR_RADIUS * Math.min(w, h);
  const seeds: Pt[] = [];
  const inside = (x: number, y: number) => x > 0 && x < w && y > 0 && y < h;

  // Angles are stratified (one slot each, jittered) so the cracks radiate all round the impact.
  const far = count - near;
  for (let i = 0; i < count; i++) {
    const nearSeed = i < near;
    const slots = nearSeed ? near : far;
    const slot = nearSeed ? i : i - near;
    let p: Pt | undefined;
    for (let tries = 0; tries < 12 && !p; tries++) {
      const a = ((slot + rnd()) / slots) * Math.PI * 2;
      const reach = nearSeed ? radius * Math.sqrt(rnd()) : radius * 1.15 + rnd() ** 2 * (edgeDistance(w, h, impact, a) - radius * 1.15);
      const x = impact.x + Math.cos(a) * reach;
      const y = impact.y + Math.sin(a) * reach;
      if (inside(x, y)) p = [x, y];
    }
    seeds.push(p ?? [w * (0.001 + 0.998 * rnd()), h * (0.001 + 0.998 * rnd())]);
  }

  const voronoi = Delaunay.from(seeds).voronoi([0, 0, w, h]);
  const shards: Shard[] = [];
  for (let i = 0; i < count; i++) {
    const cell = voronoi.cellPolygon(i);
    if (!cell || cell.length < 4) continue; // a duplicate seed: practically never with float seeds
    const points = cell.slice(0, -1).map(([x, y]) => [x, y] as Pt);
    shards.push({ points, centroid: centroid(points) });
  }
  return shards;
}

/** Distance from the impact to the rectangle's edge along angle `a`. */
function edgeDistance(w: number, h: number, o: { x: number; y: number }, a: number): number {
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const tx = dx > 1e-9 ? (w - o.x) / dx : dx < -1e-9 ? -o.x / dx : Infinity;
  const ty = dy > 1e-9 ? (h - o.y) / dy : dy < -1e-9 ? -o.y / dy : Infinity;
  return Math.max(0, Math.min(tx, ty));
}

/** Area centroid of a simple polygon. */
function centroid(points: Pt[]): Pt {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    const f = x1 * y2 - x2 * y1;
    a += f;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  if (Math.abs(a) < 1e-9) return points[0];
  return [cx / (3 * a), cy / (3 * a)];
}
