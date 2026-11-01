import { registerGsap } from '../lib/motion';
import { makeShards, type Pt } from './shards';
import type { Frame } from './snapshot';

export interface ShatterPlan {
  count: number;
  /** Crack lines run out from the impact (seconds). */
  crack: number;
  /** Shards fly off (seconds), right after the crack. */
  fly: number;
}

interface Piece {
  img: HTMLCanvasElement;
  /** Bounding box of the shard, CSS px. */
  bx: number;
  by: number;
  bw: number;
  bh: number;
  c: Pt;
  dir: Pt;
  /** Final scale: < 1 falls away from the viewer, > 1 flies towards them. */
  depth: number;
  m: { x: number; y: number; r: number; s: number; a: number };
}

/**
 * Breaks `source` on `canvas`: cracks radiate from the impact under a white flash, then
 * Voronoi shards pop apart and fly off with rotation and depth. Returns a cancel function
 * (stops without calling `ondone`).
 * `onfly` fires when the shards start to move, `ondone` at the planned end; a timer backs
 * GSAP's rAF ticker up, so a stalled frame loop (or a fake clock) still finishes.
 */
export function shatter(
  canvas: HTMLCanvasElement,
  source: Frame,
  impact: { x: number; y: number },
  plan: ShatterPlan,
  rnd: () => number,
  onfly: () => void,
  ondone: () => void,
): () => void {
  const gsap = registerGsap();
  let tl: ReturnType<typeof gsap.timeline> | undefined;
  let finished = false;
  // Offscreen shard canvases: zero them when done so mobile GPUs get the memory back at once.
  const scratch: HTMLCanvasElement[] = [];
  const cancel = () => {
    finished = true;
    tl?.kill();
    clearTimeout(fallback);
    for (const c of scratch) c.width = c.height = 0;
    scratch.length = 0;
  };
  const finish = () => {
    if (finished) return;
    cancel();
    ondone();
  };
  const fallback = setTimeout(finish, (plan.crack + plan.fly) * 1000 + 120);

  const { width: w, height: h, scale } = source;
  canvas.width = source.canvas.width;
  canvas.height = source.canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return cancel; // the fallback timer still ends it

  const shards = makeShards(w, h, impact, plan.count, rnd);
  const diag = Math.hypot(w, h);
  const maxD = Math.max(...shards.map((s) => dist(s.centroid, impact)), 1);

  // Crack pattern: jagged rays from the impact, a spider-web ring or two, and the shard seams.
  const rays: Pt[][] = [];
  const nRays = 9 + Math.floor(rnd() * 5);
  for (let i = 0; i < nRays; i++) {
    let a = ((i + rnd() * 0.7) / nRays) * Math.PI * 2;
    const len = diag * (0.25 + rnd() * 0.45);
    const ray: Pt[] = [[impact.x, impact.y]];
    let x = impact.x;
    let y = impact.y;
    for (let run = 0; run < len; ) {
      const step = 14 + rnd() * 34;
      a += (rnd() - 0.5) * 0.5;
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      run += step;
      ray.push([x, y]);
    }
    rays.push(ray);
  }
  const cracks = new Path2D();
  for (const ray of rays) {
    cracks.moveTo(ray[0][0], ray[0][1]);
    for (const [x, y] of ray.slice(1)) cracks.lineTo(x, y);
  }
  for (const ringR of [26 + rnd() * 18, 70 + rnd() * 50]) {
    const at = rays.map((ray) => pointAt(ray, ringR));
    at.forEach((p, i) => {
      const q = at[(i + 1) % at.length];
      if (!p || !q || rnd() < 0.25) return;
      // Web strands sag a little towards the impact.
      const mx = (p[0] + q[0]) / 2;
      const my = (p[1] + q[1]) / 2;
      cracks.moveTo(p[0], p[1]);
      cracks.quadraticCurveTo(mx + (impact.x - mx) * 0.12, my + (impact.y - my) * 0.12, q[0], q[1]);
    });
  }
  const seams = new Path2D();
  for (const s of shards) seams.addPath(polyPath(s.points));

  // Pre-cut every shard into its own small canvas, with a glassy sheen and a white edge.
  const pieces: Piece[] = shards.map((s) => {
    const xs = s.points.map((p) => p[0]);
    const ys = s.points.map((p) => p[1]);
    const bx = Math.floor(Math.min(...xs)) - 2;
    const by = Math.floor(Math.min(...ys)) - 2;
    const bw = Math.ceil(Math.max(...xs)) + 2 - bx;
    const bh = Math.ceil(Math.max(...ys)) + 2 - by;
    const img = document.createElement('canvas');
    scratch.push(img);
    img.width = Math.max(1, Math.round(bw * scale));
    img.height = Math.max(1, Math.round(bh * scale));
    const p = img.getContext('2d');
    if (p) {
      p.scale(scale, scale);
      p.translate(-bx, -by);
      const path = polyPath(s.points);
      p.clip(path);
      p.drawImage(source.canvas, 0, 0, w, h);
      const k = 0.06 + rnd() * 0.12;
      const sheen = p.createLinearGradient(bx, by, bx + bw, by + bh);
      sheen.addColorStop(0, `rgba(255,255,255,${k})`);
      sheen.addColorStop(0.45, 'rgba(255,255,255,0)');
      sheen.addColorStop(1, `rgba(0,0,0,${k})`);
      p.fillStyle = sheen;
      p.fillRect(bx, by, bw, bh);
      // Clipped, so only the inner half of each stroke shows: a bright bevel with a thin dark rim.
      p.lineJoin = 'round';
      p.strokeStyle = 'rgba(255,255,255,0.75)';
      p.lineWidth = 2.2;
      p.stroke(path);
      p.strokeStyle = 'rgba(0,0,0,0.35)';
      p.lineWidth = 0.8;
      p.stroke(path);
    }
    const d = dist(s.centroid, impact);
    const ang = (d > 1 ? Math.atan2(s.centroid[1] - impact.y, s.centroid[0] - impact.x) : rnd() * Math.PI * 2) + (rnd() - 0.5) * 0.5;
    return {
      img, bx, by, bw, bh,
      c: s.centroid,
      dir: [Math.cos(ang), Math.sin(ang)],
      depth: rnd() < 0.3 ? 1.2 + rnd() * 0.45 : 0.45 + rnd() * 0.35,
      m: { x: 0, y: 0, r: 0, s: 1, a: 1 },
    };
  });
  // Pieces flying towards the viewer are drawn on top.
  const order = [...pieces].sort((a, b) => a.depth - b.depth);

  const st = { crack: 0, flash: 0, pop: 0, flying: false };
  const crackReach = maxD + diag * 0.1;

  function draw() {
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    if (!st.flying) {
      ctx.drawImage(source.canvas, 0, 0, w, h);
      // Cracks run out from the impact: reveal them inside a growing circle.
      ctx.save();
      ctx.beginPath();
      ctx.arc(impact.x, impact.y, Math.max(1, st.crack * crackReach), 0, Math.PI * 2);
      ctx.clip();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 0.8;
      ctx.stroke(seams);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 3;
      ctx.stroke(cracks);
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.lineWidth = 1.2;
      ctx.stroke(cracks);
      ctx.restore();
      // The crushed spot where the glass was hit.
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(impact.x, impact.y, 3 + st.crack * 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const pop = st.pop * 5;
      for (const p of order) {
        if (p.m.a <= 0.01) continue;
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.translate(p.c[0] + p.m.x + p.dir[0] * pop, p.c[1] + p.m.y + p.dir[1] * pop);
        ctx.rotate(p.m.r);
        ctx.scale(p.m.s, p.m.s);
        ctx.globalAlpha = p.m.a;
        ctx.drawImage(p.img, p.bx - p.c[0], p.by - p.c[1], p.bw, p.bh);
      }
      ctx.globalAlpha = 1;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    }
    if (st.flash > 0.01) {
      const r = Math.max(w, h) * (0.25 + (1 - st.flash) * 0.6);
      const g = ctx.createRadialGradient(impact.x, impact.y, 0, impact.x, impact.y, r);
      g.addColorStop(0, `rgba(255,255,255,${0.9 * st.flash})`);
      g.addColorStop(0.25, `rgba(235,240,255,${0.35 * st.flash})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }

  tl = gsap.timeline({ onUpdate: draw, onComplete: finish });
  tl.to(st, { crack: 1, duration: plan.crack, ease: 'power2.out' }, 0);
  tl.fromTo(st, { flash: 1 }, { flash: 0, duration: plan.crack + Math.min(0.25, plan.fly * 0.4), ease: 'sine.in' }, 0);
  tl.call(() => {
    st.flying = true;
    onfly();
  }, [], plan.crack);
  tl.to(st, { pop: 1, duration: Math.min(0.09, plan.fly * 0.3), ease: 'power2.out' }, plan.crack);
  for (const p of pieces) {
    // Pieces near the impact go first; all are gone by the planned end.
    const delay = (dist(p.c, impact) / maxD) * plan.fly * 0.18;
    const dur = plan.fly - delay;
    const reach = diag * (0.55 + rnd() * 0.6) * (p.depth > 1 ? 1.3 : 1);
    tl.to(p.m, {
      x: p.dir[0] * reach,
      y: p.dir[1] * reach + h * (0.3 + rnd() * 0.5),
      r: (rnd() - 0.5) * 2.6,
      s: p.depth,
      duration: dur,
      ease: 'power3.in',
    }, plan.crack + delay);
    tl.to(p.m, { a: 0, duration: dur * 0.3, ease: 'power1.in' }, plan.crack + delay + dur * 0.7);
  }
  draw();
  try {
    navigator.vibrate?.(30);
  } catch {
    /* no haptics */
  }
  return cancel;
}

function dist(p: Pt, o: { x: number; y: number }): number {
  return Math.hypot(p[0] - o.x, p[1] - o.y);
}

function polyPath(points: Pt[]): Path2D {
  const path = new Path2D();
  points.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.closePath();
  return path;
}

/** The point `r` along a polyline from its start, or undefined when the line is shorter. */
function pointAt(line: Pt[], r: number): Pt | undefined {
  let run = 0;
  for (let i = 1; i < line.length; i++) {
    const [x0, y0] = line[i - 1];
    const [x1, y1] = line[i];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    if (run + seg >= r) {
      const t = (r - run) / seg;
      return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
    }
    run += seg;
  }
  return undefined;
}
