import { test, expect } from '@playwright/test';

const H = '/tests/e2e/feed-harness.html';

test('swipe advances and emits like/share events', async ({ page, isMobile }) => {
  await page.goto(H);
  const idx = () => page.evaluate(() => (window as any).__feed.index());
  await expect(page.getByTestId('clip-ph-1')).toBeVisible();
  await page.getByTestId('like').first().click();
  await page.getByTestId('share').first().click();
  if (isMobile) {
    // Real touch swipe (finger moves up 200px) via CDP.
    const box = (await page.getByTestId('feed').boundingBox())!;
    const x = box.x + box.width / 2;
    const y0 = box.y + box.height * 0.7;
    const cdp = await page.context().newCDPSession(page);
    const pt = (y: number) => [{ x, y }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(y0) });
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(y0 - i * 25) });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.keyboard.press('ArrowDown');
  }
  await expect.poll(idx).toBe(1);
  const events = await page.evaluate(() => (window as any).__events);
  expect(events).toEqual(expect.arrayContaining([
    { kind: 'like', clipId: 'ph-1' },
    { kind: 'share', clipId: 'ph-1' },
    expect.objectContaining({ kind: 'dwell', clipId: 'ph-1' }),
  ]));
});

test('passive user reaches done in <= 8x4.5s + 2s', async ({ page }) => {
  await page.clock.install();
  await page.goto(H);
  await expect(page.getByTestId('clip-ph-1')).toBeVisible();
  await page.clock.runFor(8 * 4500 + 2000);
  await expect.poll(() => page.evaluate(() => (window as any).__done)).toBe(true);
});

test('video failure falls back to poster', async ({ page }) => {
  await page.route('**/*.webm', (r) => r.abort());
  await page.route('**/*.mp4', (r) => r.abort());
  await page.clock.install();
  await page.goto(H);
  await expect(page.getByTestId('poster-ph-1')).toBeVisible();
  await page.clock.runFor(8 * 4500 + 2000);
  await expect.poll(() => page.evaluate(() => (window as any).__done)).toBe(true);
});

test('desktop shows centred column and keyboard works', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'desktop only');
  await page.goto(H);
  const col = page.getByTestId('feed');
  const box = (await col.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThan(4);
  expect(Math.abs(box.height - vp.height * 0.92)).toBeLessThan(4);
  expect(Math.abs(box.width / box.height - 9 / 16)).toBeLessThan(0.01);
  await expect(page.getByTestId('hint')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.evaluate(() => (window as any).__feed.index())).toBe(1);
  await expect(page.getByTestId('hint')).toBeHidden();
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => page.evaluate(() => (window as any).__feed.index())).toBe(0);
});
