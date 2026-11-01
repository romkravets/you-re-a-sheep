import { test, expect, type Page } from '@playwright/test';

const H = '/tests/e2e/crack-harness.html';
type W = { __crack(v: string): void; __done: boolean; __doneAt: number; __sawCanvas: boolean };

async function ready(page: Page) {
  await page.goto(H);
  await expect(page.getByTestId('poster-ph-1')).toBeVisible();
}

async function crack(page: Page, variant: 'stop' | 'feed-to-paper') {
  await page.evaluate((v) => {
    const w = window as unknown as W;
    w.__sawCanvas = false;
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="crack-canvas"]')) w.__sawCanvas = true;
    }).observe(document.body, { childList: true, subtree: true });
    w.__crack(v);
  }, variant);
}

const done = (page: Page) => page.evaluate(() => (window as unknown as W).__done);
const doneAt = (page: Page) => page.evaluate(() => (window as unknown as W).__doneAt);

test('ondone fires within 1.5 s', async ({ page }) => {
  await ready(page);
  await crack(page, 'feed-to-paper');
  const canvas = page.getByTestId('crack-canvas');
  await expect(canvas).toBeAttached();
  await expect(canvas).toHaveAttribute('aria-hidden', 'true');
  const box = (await canvas.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.width).toBeCloseTo(vp.width, 0);
  expect(box.height).toBeCloseTo(vp.height, 0);
  await expect.poll(() => done(page), { timeout: 3000 }).toBe(true);
  expect(await doneAt(page)).toBeLessThanOrEqual(1500);
  await expect(canvas).toHaveCount(0);
  await expect(page.getByTestId('paper')).toBeVisible();
});

test('shards stop catching taps once they fly', async ({ page }) => {
  await ready(page);
  await crack(page, 'feed-to-paper');
  const canvas = page.getByTestId('crack-canvas');
  await expect(canvas).toBeAttached();
  await expect.poll(() => canvas.evaluate((c) => getComputedStyle(c).pointerEvents)).toBe('none');
});

test('stop variant is a quick flash (~400 ms)', async ({ page }) => {
  await ready(page);
  await crack(page, 'stop');
  await expect.poll(() => done(page), { timeout: 3000 }).toBe(true);
  expect(await page.evaluate(() => (window as unknown as W).__sawCanvas)).toBe(true);
  expect(await doneAt(page)).toBeLessThanOrEqual(700);
});

test('reduced motion crossfades', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await crack(page, 'feed-to-paper');
  await expect(page.getByTestId('crack-fade')).toBeAttached();
  await expect.poll(() => done(page), { timeout: 3000 }).toBe(true);
  expect(await doneAt(page)).toBeLessThanOrEqual(600);
  expect(await page.evaluate(() => (window as unknown as W).__sawCanvas)).toBe(false);
  await expect(page.getByTestId('crack-fade')).toHaveCount(0);
});

test('ondone still fires when animation frames stall (fake clock)', async ({ page }) => {
  await page.clock.install();
  await ready(page);
  await crack(page, 'feed-to-paper');
  await page.clock.runFor(1500);
  await expect.poll(() => done(page)).toBe(true);
});
