// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import levelsJson from '../../content/uk/levels.json';
import { cardText, shareOrDownload, drawStoryCard, cardEmoji, glyphMissing } from '../../src/lib/storycard';
import type { Level } from '../../src/lib/types';

const levels = levelsJson as unknown as Level[];
const lvl = (id: string) => levels.find((l) => l.id === id)!;

describe('cardText', () => {
  it('cardText for boxer 73', () => {
    const t = cardText(lvl('boxer'), 73);
    expect(t.kicker).toBe('Я — Боксер. 73%');
    expect(t.dare).toBe('Доведи, що ні →');
    expect(t.slogan).toBe(lvl('boxer').slogan);
    // challengeLine minus its «Я — Боксер 🐎:» self-intro, which the kicker already says
    expect(t.headline).toBe('Вірю, поки не перевірю. А ти хоч раз перевіряв?');
  });

  it('never repeats the level name in the headline', () => {
    for (const l of levels) {
      const t = cardText(l, 50);
      expect(t.headline).not.toContain(l.name);
      expect(t.headline.length).toBeGreaterThan(5);
      expect(t.headline[0]).toBe(t.headline[0].toUpperCase());
    }
    expect(cardText(lvl('sheep'), 18).headline).toBe('Спорим, ти теж?');
    expect(cardText(lvl('orwell'), 95).headline).toBe('Стрічка мене не розвела. Тебе — розведе.');
  });

  it('keeps a challengeLine that has no self-intro as is', () => {
    expect(cardText({ ...lvl('sheep'), challengeLine: 'А ти, мабуть, вівця.' }, 10).headline).toBe('А ти, мабуть, вівця.');
  });
});

describe('shareOrDownload', () => {
  const blob = new Blob(['png'], { type: 'image/png' });
  const nav = navigator as unknown as Record<string, unknown>;

  afterEach(() => {
    delete nav.share;
    delete nav.canShare;
    vi.restoreAllMocks();
  });

  function spyDownload() {
    URL.createObjectURL = vi.fn(() => 'blob:card');
    URL.revokeObjectURL = vi.fn();
    const clicks: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicks.push(this); });
    return clicks;
  }

  it('shareOrDownload uses navigator.share with files when canShare', async () => {
    const clicks = spyDownload();
    const share = vi.fn(async () => {});
    nav.share = share;
    nav.canShare = vi.fn(() => true);
    await expect(shareOrDownload(blob, 'card.png')).resolves.toBe('shared');
    expect(share).toHaveBeenCalledTimes(1);
    const files = (share.mock.calls[0] as unknown as [{ files: File[] }])[0].files;
    expect(files[0].name).toBe('card.png');
    expect(files[0].type).toBe('image/png');
    expect(clicks).toHaveLength(0);
  });

  it('falls back to <a download> when share missing or rejects with non-AbortError', async () => {
    const clicks = spyDownload();
    await expect(shareOrDownload(blob, 'a.png')).resolves.toBe('downloaded');
    expect(clicks[0].download).toBe('a.png');
    expect(clicks[0].href).toContain('blob:card');

    nav.share = vi.fn(async () => { throw new DOMException('nope', 'NotAllowedError'); });
    nav.canShare = vi.fn(() => true);
    await expect(shareOrDownload(blob, 'b.png')).resolves.toBe('downloaded');
    expect(clicks[1].download).toBe('b.png');

    nav.canShare = vi.fn(() => false);
    await expect(shareOrDownload(blob, 'c.png')).resolves.toBe('downloaded');
    expect(clicks).toHaveLength(3);
  });

  it('AbortError (user cancelled) resolves \'shared\' without download', async () => {
    const clicks = spyDownload();
    nav.share = vi.fn(async () => { throw new DOMException('cancelled', 'AbortError'); });
    nav.canShare = vi.fn(() => true);
    await expect(shareOrDownload(blob, 'card.png')).resolves.toBe('shared');
    expect(clicks).toHaveLength(0);
  });
});


/** A 2D context stub that records fillText and answers measurements. */
function fakeCtx(measure: (t: string) => number = (t) => t.length * 20, pixels: (t: string) => number[] = () => [0, 0, 0, 0]) {
  const texts: string[] = [];
  let last = '';
  const target: Record<string, unknown> = {
    fillText: (t: string) => { texts.push(t); last = t; },
    measureText: (t: string) => ({ width: measure(t) }),
    createLinearGradient: () => ({ addColorStop() {} }),
    getImageData: () => ({ data: Uint8ClampedArray.from(pixels(last)) }),
  };
  const ctx = new Proxy(target, {
    get: (o, k) => (k in o ? o[k as string] : () => undefined),
    set: (o, k, v) => { o[k as string] = v; return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, texts };
}

describe('drawStoryCard', () => {
  const img = { width: 10, height: 10 } as unknown as CanvasImageSource;

  it('draws the address when siteLabel is set', () => {
    const { ctx, texts } = fakeCtx();
    drawStoryCard(ctx, { level: lvl('boxer'), percent: 62, siteLabel: 'example.org', characterImg: img });
    expect(texts).toContain('example.org');
  });

  it('draws no address line when siteLabel is blank', () => {
    const { ctx, texts } = fakeCtx();
    drawStoryCard(ctx, { level: lvl('boxer'), percent: 62, siteLabel: '', characterImg: img });
    expect(texts.filter((t) => !t.trim())).toEqual([]);
    expect(texts.length).toBeGreaterThan(3);
  });
});

describe('emoji fallback', () => {
  it('a glyph that measures and renders like the tofu reference is missing', () => {
    const { ctx } = fakeCtx(() => 50, () => [1, 2, 3, 255]);
    expect(glyphMissing(ctx, '🫏')).toBe(true);
    expect(cardEmoji(ctx, '🫏')).toBe('🐴');
  });

  it('a glyph with its own width is present', () => {
    const { ctx } = fakeCtx((t) => (t === '🫏' ? 64 : 50));
    expect(glyphMissing(ctx, '🫏')).toBe(false);
    expect(cardEmoji(ctx, '🫏')).toBe('🫏');
  });

  it('same width but different ink is present', () => {
    const { ctx } = fakeCtx(() => 50, (t) => (t === '🫏' ? [200, 10, 10, 255] : [0, 0, 0, 255]));
    expect(glyphMissing(ctx, '🫏')).toBe(false);
  });
});
