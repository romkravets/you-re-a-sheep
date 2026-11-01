/**
 * Rasterises what is on screen right before the glass breaks, without html2canvas:
 * the active feed clip (its <video> frame or poster) plus its overlay text, or a
 * stand-in for the «Стоп» screen. Text is drawn as text, which is good enough for
 * the ~120 ms the frame stays whole.
 */

export interface Frame {
  canvas: HTMLCanvasElement;
  /** CSS pixels (the viewport). */
  width: number;
  height: number;
  /** Device pixels per CSS pixel in `canvas`. */
  scale: number;
}

const MAX_SCALE = 2;
const DEFAULT_GLOW = '#6b2bff';

function blank(): { frame: Frame; ctx: CanvasRenderingContext2D } | null {
  const width = Math.max(1, Math.round(window.innerWidth));
  const height = Math.max(1, Math.round(window.innerHeight));
  const scale = Math.min(window.devicePixelRatio || 1, MAX_SCALE);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  return { frame: { canvas, width, height, scale }, ctx };
}

type Box = { x: number; y: number; width: number; height: number };

function drawCover(ctx: CanvasRenderingContext2D, media: CanvasImageSource, mw: number, mh: number, r: Box) {
  if (!mw || !mh) return;
  const k = Math.max(r.width / mw, r.height / mh);
  const w = mw * k;
  const h = mh * k;
  ctx.drawImage(media, r.x + (r.width - w) / 2, r.y + (r.height - h) / 2, w, h);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > max) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
  }
  return lines;
}

const px = (v: string) => parseFloat(v) || 0;
const clear = (c: string) => !c || c === 'transparent' || /rgba\(.*,\s*0\)$/.test(c);

/** Paints one element's box (background, borders) and, for text-only content, its text. */
function paintBox(ctx: CanvasRenderingContext2D, cs: CSSStyleDeclaration, r: DOMRect) {
  const radius = Math.min(px(cs.borderTopLeftRadius), r.height / 2);
  if (!clear(cs.backgroundColor)) {
    ctx.fillStyle = cs.backgroundColor;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.width, r.height, radius);
    ctx.fill();
  }
  const bt = px(cs.borderTopWidth);
  const bl = px(cs.borderLeftWidth);
  if (bt > 0 && cs.borderTopStyle !== 'none') {
    ctx.strokeStyle = cs.borderTopColor;
    ctx.lineWidth = bt;
    ctx.beginPath();
    ctx.roundRect(r.x + bt / 2, r.y + bt / 2, r.width - bt, r.height - bt, Math.max(0, radius - bt / 2));
    ctx.stroke();
  } else if (bl > 0 && cs.borderLeftStyle !== 'none') {
    ctx.fillStyle = cs.borderLeftColor;
    ctx.fillRect(r.x, r.y, bl, r.height);
  }
}

function paintText(ctx: CanvasRenderingContext2D, text: string, cs: CSSStyleDeclaration, r: DOMRect) {
  if (!text) return;
  const size = px(cs.fontSize) || 16;
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`;
  ctx.fillStyle = cs.color;
  ctx.textBaseline = 'middle';
  const lh = cs.lineHeight === 'normal' ? size * 1.25 : px(cs.lineHeight) || size * 1.25;
  const left = r.x + px(cs.paddingLeft) + px(cs.borderLeftWidth);
  const top = r.y + px(cs.paddingTop) + px(cs.borderTopWidth);
  const max = r.width - px(cs.paddingLeft) - px(cs.paddingRight) - px(cs.borderLeftWidth) - px(cs.borderRightWidth);
  const align = cs.textAlign === 'center' ? 'center' : 'left';
  ctx.textAlign = align;
  const x = align === 'center' ? left + max / 2 : left;
  wrap(ctx, text, Math.max(10, max + 1)).forEach((line, i) => ctx.fillText(line, x, top + lh * (i + 0.5)));
  ctx.textAlign = 'left';
}

/**
 * A tiny rasteriser for simple screens: boxes for every visible element and text for
 * elements whose content is text only (or mixed inline content, drawn as one paragraph).
 * Subtrees matching `skip` are left out.
 */
function paintTree(ctx: CanvasRenderingContext2D, el: Element, alpha: number, skip: string, vw: number, vh: number) {
  if (el.matches(skip)) return;
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden') return;
  const a = alpha * (px(cs.opacity) || (cs.opacity === '0' ? 0 : 1));
  if (a <= 0.01) return;
  const r = el.getBoundingClientRect();
  if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return;
  if (el instanceof SVGElement) {
    paintSvg(ctx, el, cs, r, a);
    return;
  }
  ctx.globalAlpha = a;
  paintBox(ctx, cs, r);
  const kids = [...el.childNodes];
  const hasText = kids.some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
  const elems = kids.filter((n): n is Element => n.nodeType === Node.ELEMENT_NODE);
  const inline = elems.every((k) => getComputedStyle(k).display.startsWith('inline') && !(k instanceof SVGElement));
  if (hasText && inline) {
    paintText(ctx, (el as HTMLElement).innerText?.trim() ?? el.textContent?.trim() ?? '', cs, r);
    return;
  }
  for (const k of elems) paintTree(ctx, k, a, skip, vw, vh);
  ctx.globalAlpha = 1;
}

/** Inline icons: every <path d> filled with the svg's fill colour, scaled to its box. */
function paintSvg(ctx: CanvasRenderingContext2D, svg: SVGElement, cs: CSSStyleDeclaration, r: DOMRect, alpha: number) {
  const vb = (svg as SVGSVGElement).viewBox?.baseVal;
  if (!vb || !vb.width) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(r.x, r.y);
  ctx.scale(r.width / vb.width, r.height / vb.height);
  ctx.translate(-vb.x, -vb.y);
  ctx.fillStyle = cs.fill && cs.fill !== 'none' ? cs.fill : '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 3;
  for (const p of svg.querySelectorAll('path')) {
    const d = p.getAttribute('d');
    if (d) ctx.fill(new Path2D(d));
  }
  ctx.restore();
}

/** The current feed frame: neon backdrop (desktop), the active clip's video frame or poster, its texts and icons. */
export function snapshotFeed(feed: HTMLElement | null): Frame | null {
  const b = blank();
  if (!b) return null;
  const { frame, ctx } = b;
  if (!feed) return frame;
  try {
    const { width: vw, height: vh } = frame;
    const col = feed.getBoundingClientRect();
    const narrow = col.width < vw - 40;
    const glow = (feed.parentElement && getComputedStyle(feed.parentElement).getPropertyValue('--glow').trim()) || DEFAULT_GLOW;
    if (narrow) {
      // The desktop neon halo round the 9:16 column.
      ctx.save();
      ctx.translate(vw / 2, vh / 2);
      ctx.scale(vw / vh, 1);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, (Math.hypot(vw, vh) / 2) * 0.7 * (vh / vw));
      g.addColorStop(0, glow);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = g;
      ctx.fillRect(-vw, -vh, vw * 2, vh * 2);
      ctx.restore();
    }
    const radius = narrow ? 14 : 0;
    ctx.save();
    if (narrow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = 80;
    }
    ctx.beginPath();
    ctx.roundRect(col.x, col.y, col.width, col.height, radius);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.clip();

    const clip = feed.querySelector('article[aria-hidden="false"]') ?? feed.querySelector('article');
    if (clip) {
      const video = clip.querySelector('video');
      const poster = clip.querySelector<HTMLImageElement>('img.poster');
      if (video && video.classList.contains('on') && video.readyState >= 2) {
        video.pause(); // the feed is over: freeze the frame we are about to break
        drawCover(ctx, video, video.videoWidth, video.videoHeight, col);
      } else if (poster?.complete && poster.naturalWidth) drawCover(ctx, poster, poster.naturalWidth, poster.naturalHeight, col);
      // The same shade as FeedClip's .shade.
      const bottom = ctx.createLinearGradient(0, col.y + col.height, 0, col.y + col.height * 0.62);
      bottom.addColorStop(0, 'rgba(0,0,0,0.62)');
      bottom.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bottom;
      ctx.fillRect(col.x, col.y, col.width, col.height);
      const top = ctx.createLinearGradient(0, col.y, 0, col.y + col.height * 0.16);
      top.addColorStop(0, 'rgba(0,0,0,0.28)');
      top.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = top;
      ctx.fillRect(col.x, col.y, col.width, col.height);
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 3;
      for (const el of clip.querySelectorAll('.overlay, .rail, .meta')) paintTree(ctx, el, 1, '.hint', vw, vh);
    }
    ctx.restore();
  } catch {
    /* a tainted or half-loaded frame: the black frame still breaks fine */
  }
  return frame;
}

/**
 * Stand-in for the «Стоп» screen (DOM text we can't rasterise cheaply): the last feed
 * frame darkened under a neon tint, plus the screen's own text boxes when `screen` is given
 * (otherwise only the red «🛑 Стоп.» kicker).
 */
export function stopStandIn(feedFrame: Frame | null, screen?: HTMLElement | null): Frame | null {
  const b = blank();
  if (!b) return feedFrame;
  const { frame, ctx } = b;
  const { width: w, height: h } = frame;
  try {
    if (feedFrame) {
      ctx.globalAlpha = 0.34;
      ctx.drawImage(feedFrame.canvas, 0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    // Neon tint, then the same dark vignette that keeps «Стоп» readable.
    ctx.globalCompositeOperation = 'screen';
    const tint = ctx.createLinearGradient(0, 0, w, h);
    tint.addColorStop(0, 'rgba(255,45,138,0.16)');
    tint.addColorStop(0.55, 'rgba(107,43,255,0.2)');
    tint.addColorStop(1, 'rgba(0,229,255,0.1)');
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    const v = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) / 2);
    v.addColorStop(0, 'rgba(0,0,0,0.5)');
    v.addColorStop(1, 'rgba(0,0,0,0.78)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);

    const grid = screen?.querySelector('[data-testid="grid"]');
    if (grid) {
      paintTree(ctx, grid, 1, '[aria-hidden="true"]', w, h);
    } else {
      const x = Math.max(16, (w - 1024) / 2 + 16);
      ctx.font = `800 17.6px ${getComputedStyle(document.documentElement).getPropertyValue('--font-feed') || 'system-ui'}`;
      ctx.fillStyle = '#ff3b30';
      ctx.textBaseline = 'top';
      ctx.fillText('🛑 Стоп.', x, w >= 900 ? 64 : 48);
    }
  } catch {
    /* keep whatever got drawn */
  }
  return frame;
}

/**
 * Frees a frame's backing store (a full-screen canvas at up to 2× is several MB on a phone) once
 * nothing draws from it. `inUse` is a frame still on screen — if it is this one, it is kept.
 * Returns null so callers can write `frame = releaseFrame(frame)`.
 */
export function releaseFrame(frame: Frame | null, inUse?: Frame | null): null {
  if (frame && frame !== inUse) {
    frame.canvas.width = 0;
    frame.canvas.height = 0;
  }
  return null;
}
