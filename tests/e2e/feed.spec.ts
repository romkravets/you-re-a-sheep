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

test('dwell marks auto-advance as auto and a manual leave as not', async ({ page }) => {
  await page.clock.install();
  await page.goto(H);
  await expect(page.getByTestId('clip-ph-1')).toBeVisible();
  await page.clock.runFor(4500 + 200); // ph-1 → ph-2 by the timer
  await expect.poll(() => page.evaluate(() => (window as any).__feed.index())).toBe(1);
  await page.getByTestId('feed').focus();
  await page.keyboard.press('ArrowDown'); // ph-2 → ph-3 by hand
  await expect.poll(() => page.evaluate(() => (window as any).__feed.index())).toBe(2);
  const dwells = (await page.evaluate(() => (window as any).__events)).filter((e: { kind: string }) => e.kind === 'dwell');
  expect(dwells[0]).toMatchObject({ clipId: 'ph-1', auto: true });
  expect(dwells[1]).toMatchObject({ clipId: 'ph-2' });
  expect(dwells[1].auto).toBeFalsy();
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

test('sound button toggles: unmutes on first tap, mutes on second', async ({ page }) => {
  await page.goto(H);
  const video = page.locator('video[data-clip-id="ph-1"]');
  await expect(video).toHaveJSProperty('muted', true);
  await page.getByTestId('sound').first().click();
  await expect(video).toHaveJSProperty('muted', false);
  await page.getByTestId('sound').first().click();
  await expect(video).toHaveJSProperty('muted', true);
});

test('like tap does not unmute', async ({ page }) => {
  await page.goto(H);
  await page.getByTestId('like').first().click();
  await expect(page.locator('video[data-clip-id="ph-1"]')).toHaveJSProperty('muted', true);
});

test('AbortError from play() does not downgrade the clip to poster', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('interrupted', 'AbortError'));
  });
  await page.goto(H);
  await expect(page.getByTestId('poster-ph-1')).toBeVisible();
  await expect(page.locator('video[data-clip-id="ph-1"]')).toHaveCount(1);
});

test('NotAllowedError from play() falls back to poster', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'));
  });
  await page.goto(H);
  await expect(page.getByTestId('poster-ph-1')).toBeVisible();
  await expect(page.locator('video[data-clip-id="ph-1"]')).toHaveCount(0);
});

test('NotAllowedError on unmuted play() retries muted and keeps the video (iOS)', async ({ page }) => {
  await page.addInitScript(() => {
    const real = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      if (this.muted === false) return Promise.reject(new DOMException('needs muted', 'NotAllowedError'));
      return real.call(this);
    };
  });
  await page.goto(H);
  const video = page.locator('video[data-clip-id="ph-1"]');
  await expect(video).toHaveCount(1);
  await page.getByTestId('sound').first().click();
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.evaluate(() => (window as any).__feed.index())).toBe(1);
  const v2 = page.locator('video[data-clip-id="ph-2"]');
  await expect(v2).toHaveCount(1);
  await expect(v2).toHaveJSProperty('muted', true);
  await expect(v2).toHaveClass(/on/);
});
