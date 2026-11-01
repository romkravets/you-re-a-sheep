import type { Level } from './types';

/** Instagram/TikTok story size. Top ~250 px and bottom ~300 px sit under the app's own UI. */
export const CARD_W = 1080;
export const CARD_H = 1920;

// Mirrors --poster-* in src/styles/tokens.css (canvas can't read CSS variables cheaply).
const RED = '#c8241c';
const CREAM = '#efe4cf';
const BLACK = '#1a1a1a';
const POSTER = 'Unbounded, system-ui, sans-serif';
const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

export interface CardText { kicker: string; headline: string; dare: string; slogan: string }

/**
 * Copy for the card. `challengeLine` opens with its own self-intro («Я — Боксер 🐎: …»), which
 * the kicker already says, so the headline keeps only the dare that follows it.
 */
export function cardText(level: Level, percent: number): CardText {
  const rest = level.challengeLine.replace(/^Я\s*—\s*[^.:!?]*[.:]\s*/u, '');
  const headline = rest ? rest[0].toUpperCase() + rest.slice(1) : level.challengeLine;
  return { kicker: `Я — ${level.name}. ${percent}%`, headline, dare: 'Доведи, що ні →', slogan: level.slogan };
}

export interface CardData { level: Level; percent: number; siteLabel: string; characterImg?: CanvasImageSource }

/** Waits (at most ~3 s) for the poster face with Cyrillic glyphs; the card still draws on fallback fonts. */
export async function prepareCardFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const load = Promise.all([
    document.fonts.load(`900 64px ${POSTER}`, 'ЯЇЄҐ%'),
    document.fonts.load(`400 40px ${POSTER}`, 'abc.'),
  ]).catch(() => undefined);
  await Promise.race([load, new Promise((r) => setTimeout(r, 3000))]);
}

/** Draws the poster at 1080×1920. Fonts must already be loaded (see prepareCardFonts). */
export function drawStoryCard(ctx: CanvasRenderingContext2D, d: CardData): void {
  const t = cardText(d.level, d.percent);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  rays(ctx);
  grain(ctx);

  // Character on a sun disc.
  const cx = CARD_W / 2, cy = 462, r = 190;
  ctx.fillStyle = BLACK;
  circle(ctx, cx, cy, r + 16);
  ctx.fillStyle = CREAM;
  circle(ctx, cx, cy, r);
  ctx.strokeStyle = RED;
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.arc(cx, cy, r - 18, 0, Math.PI * 2); ctx.stroke();
  character(ctx, d, cx, cy, r * 1.7);

  // Kicker: «Я — БОКСЕР. 73%», percent in red.
  let y = cy + r + 120;
  const pct = `${d.percent}%`;
  const who = t.kicker.endsWith(pct) ? t.kicker.slice(0, -pct.length) : `${t.kicker} `;
  const kSize = fit(ctx, (s) => `900 ${s}px ${POSTER}`, (who + pct).toUpperCase(), 940, 88, 48);
  ctx.font = `900 ${kSize}px ${POSTER}`;
  const whoW = ctx.measureText(who.toUpperCase()).width;
  const total = whoW + ctx.measureText(pct).width;
  ctx.textAlign = 'left';
  ctx.fillStyle = BLACK;
  ctx.fillText(who.toUpperCase(), cx - total / 2, y);
  ctx.fillStyle = RED;
  ctx.fillText(pct, cx - total / 2 + whoW, y);
  ctx.textAlign = 'center';

  // Headline on a black band, −3°.
  y += 55;
  const head = block(ctx, t.headline.toUpperCase(), 900, 92, 52, 3);
  const bandH = head.lines.length * head.lh + 96;
  band(ctx, y + bandH / 2, bandH, -3, BLACK, () => {
    ctx.fillStyle = RED;
    ctx.fillRect(-CARD_W, -bandH / 2 + 18, CARD_W * 2, 6);
    ctx.fillRect(-CARD_W, bandH / 2 - 24, CARD_W * 2, 6);
    ctx.fillStyle = CREAM;
    ctx.font = `900 ${head.size}px ${POSTER}`;
    lines(ctx, head.lines, -((head.lines.length - 1) * head.lh) / 2 + head.size * 0.36, head.lh);
  });
  y += bandH + 40;

  // Dare.
  const dSize = fit(ctx, (s) => `900 ${s}px ${POSTER}`, t.dare.toUpperCase(), 940, 64, 40);
  ctx.font = `900 ${dSize}px ${POSTER}`;
  ctx.fillStyle = RED;
  y += dSize;
  ctx.fillText(t.dare.toUpperCase().replace(/ →$/, ' →'), cx, y);
  y += 45;

  // Slogan on a red band, +2°.
  const slo = block(ctx, t.slogan.toUpperCase(), 940, 50, 34, 3);
  const sloH = slo.lines.length * slo.lh + 56;
  band(ctx, y + sloH / 2, sloH, 2, RED, () => {
    ctx.fillStyle = CREAM;
    ctx.font = `900 ${slo.size}px ${POSTER}`;
    lines(ctx, slo.lines, -((slo.lines.length - 1) * slo.lh) / 2 + slo.size * 0.36, slo.lh);
  });
  y += sloH + 20 + 62; // + the 2° tilt's drop at the right edge

  // Site address, kept above the bottom ~300 px.
  ctx.font = `400 42px ${POSTER}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
  ctx.fillStyle = BLACK;
  ctx.fillText(d.siteLabel, cx, Math.min(y, CARD_H - 300));

  // Footer strip (sits under the story reply bar; nothing important here).
  ctx.fillStyle = RED;
  ctx.fillRect(0, CARD_H - 210, CARD_W, 10);
  ctx.fillStyle = BLACK;
  ctx.fillRect(0, CARD_H - 190, CARD_W, 190);
  ctx.restore();
}

/** Renders the card offscreen and encodes it as PNG. */
export async function renderStoryCard(d: CardData): Promise<Blob> {
  await prepareCardFonts();
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  drawStoryCard(canvas.getContext('2d')!, d);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}

/** System share sheet with the file when it can take files; otherwise a plain download. */
export async function shareOrDownload(blob: Blob, filename: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: blob.type || 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] });
      return 'shared';
    } catch (e) {
      if ((e as { name?: string } | null)?.name === 'AbortError') return 'shared'; // user closed the sheet
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'downloaded';
}

// ── drawing helpers ──────────────────────────────────────────────────────────

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

/** Alternating red/cream rays fanning out of the top-left corner, fading into paper lower down. */
function rays(ctx: CanvasRenderingContext2D) {
  const ox = -120, oy = -160, n = 22, reach = 3000;
  const from = -0.05, to = Math.PI / 2 + 0.05, step = (to - from) / n;
  ctx.fillStyle = RED;
  for (let i = 0; i < n; i += 2) {
    const a0 = from + i * step, a1 = a0 + step;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + Math.cos(a0) * reach, oy + Math.sin(a0) * reach);
    ctx.lineTo(ox + Math.cos(a1) * reach, oy + Math.sin(a1) * reach);
    ctx.closePath();
    ctx.fill();
  }
  // Fully faded by the kicker line so red type never sits on a red ray.
  const fade = ctx.createLinearGradient(0, 400, 0, 700);
  fade.addColorStop(0, 'rgba(239, 228, 207, 0)');
  fade.addColorStop(1, 'rgba(239, 228, 207, 0.94)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 400, CARD_W, CARD_H - 400);
}

/** Deterministic ink speckle so the paper doesn't look flat. */
function grain(ctx: CanvasRenderingContext2D) {
  let s = 1940;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  ctx.fillStyle = 'rgba(26, 26, 26, 0.07)';
  for (let i = 0; i < 1800; i++) ctx.fillRect(rnd() * CARD_W, rnd() * CARD_H, 1 + rnd() * 2.5, 1 + rnd() * 2.5);
}

/** The character: engraving if given, else the level emoji as a solid black silhouette. */
function character(ctx: CanvasRenderingContext2D, d: CardData, cx: number, cy: number, size: number) {
  if (d.characterImg) {
    const { width, height } = d.characterImg as { width: number; height: number };
    const iw = Number(width) || size, ih = Number(height) || size;
    const k = size / Math.max(iw, ih), w = iw * k, h = ih * k;
    ctx.drawImage(d.characterImg, cx - w / 2, cy - h / 2, w, h);
    return;
  }
  const s = Math.round(size);
  const off = document.createElement('canvas');
  off.width = s; off.height = s;
  const o = off.getContext('2d');
  if (!o) return;
  o.textAlign = 'center';
  o.textBaseline = 'middle';
  o.font = `${Math.round(s * 0.76)}px ${EMOJI}`;
  o.fillText(d.level.emoji, s / 2, s * 0.53);
  o.globalCompositeOperation = 'source-in';
  o.fillStyle = BLACK;
  o.fillRect(0, 0, s, s);
  ctx.drawImage(off, cx - s / 2, cy - s / 2);
}

function band(ctx: CanvasRenderingContext2D, cy: number, h: number, deg: number, fill: string, inner: () => void) {
  ctx.save();
  ctx.translate(CARD_W / 2, cy);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.fillStyle = fill;
  ctx.fillRect(-CARD_W, -h / 2, CARD_W * 2, h);
  inner();
  ctx.restore();
}

function lines(ctx: CanvasRenderingContext2D, ls: string[], y0: number, lh: number) {
  ls.forEach((l, i) => ctx.fillText(l, 0, y0 + i * lh));
}

/** Largest size (step 2) at which `text` fits on one line. */
function fit(ctx: CanvasRenderingContext2D, font: (s: number) => string, text: string, maxW: number, max: number, min: number) {
  for (let s = max; s > min; s -= 2) {
    ctx.font = font(s);
    if (ctx.measureText(text).width <= maxW) return s;
  }
  return min;
}

/** Largest size at which `text` wraps into at most `maxLines` lines of `maxW`. */
function block(ctx: CanvasRenderingContext2D, text: string, maxW: number, max: number, min: number, maxLines: number) {
  for (let s = max; ; s -= 2) {
    ctx.font = `900 ${s}px ${POSTER}`;
    const ls = wrap(ctx, text, maxW);
    if ((ls.length <= maxLines && ls.every((l) => ctx.measureText(l).width <= maxW)) || s <= min) {
      return { size: s, lh: Math.round(s * 1.14), lines: ls };
    }
  }
}

/** Greedy word wrap; a dash never starts a line. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.replace(/ ([—–→])/g, ' $1').split(' ');
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(next).width > maxW) { out.push(cur); cur = w; } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}
