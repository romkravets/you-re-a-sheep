import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const ui = JSON.parse(readFileSync('content/uk/ui.json', 'utf8')) as Record<string, string>;

test('canvas renders 1080×1920 non-blank', async ({ page }) => {
  await page.goto('/tests/e2e/storycard-harness.html?percent=18');
  await page.waitForFunction(() => (window as unknown as { __cardReady?: boolean }).__cardReady === true);
  const r = await page.evaluate(() => {
    const c = document.getElementById('card') as HTMLCanvasElement;
    const ctx = c.getContext('2d')!;
    const px = (x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data];
    return { w: c.width, h: c.height, top: px(540, 200), bottom: px(540, 1900), fontOk: document.fonts.check('900 64px Unbounded', 'Я'), digitsOk: document.fonts.check('900 40px Unbounded', '73% —→!'),
      // digits and «%» really come from Unbounded, not from the fallback face
      digitsDrawn: ['73%', '0123456789', '—!.'].every((t) => {
        ctx.font = '900 40px Unbounded, monospace';
        const own = ctx.measureText(t).width;
        ctx.font = '900 40px monospace';
        return Math.abs(own - ctx.measureText(t).width) > 1;
      }) };
  });
  expect(r.w).toBe(1080);
  expect(r.h).toBe(1920);
  expect(r.top).not.toEqual(r.bottom);
  expect(r.fontOk).toBe(true);
  expect(r.digitsOk).toBe(true);
  expect(r.digitsDrawn).toBe(true);
});

async function openVerdict(page: Page) {
  await page.goto('/tests/e2e/verdict-harness.html?percent=62&pattern=none');
  await expect(page.getByTestId('level-name')).toHaveText('Боксер');
}

test('«Кинути виклик» shares the card PNG when Web Share supports files', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__shared = [];
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (d: { files: File[] }) => { (w.__shared as unknown[]).push(d.files.map((f) => [f.name, f.type, f.size])); },
    });
  });
  await openVerdict(page);
  const btn = page.getByRole('button', { name: ui.challenge });
  // above «Пройти ще раз»
  const retryBox = (await page.getByRole('button', { name: ui.retry }).boundingBox())!;
  expect((await btn.boundingBox())!.y).toBeLessThan(retryBox.y);
  await btn.click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared.length)).toBe(1);
  const [[name, type, size]] = await page.evaluate(() => (window as unknown as { __shared: [string, string, number][][] }).__shared[0]);
  expect(name).toBe('you-re-a-sheep-boxer.png');
  expect(type).toBe('image/png');
  expect(size).toBeGreaterThan(10_000);
});

test('«Кинути виклик» downloads the card PNG without Web Share', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
  });
  await openVerdict(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: ui.challenge }).click();
  expect((await download).suggestedFilename()).toBe('you-re-a-sheep-boxer.png');
  await expect(page.getByTestId('challenge-status')).toHaveText(ui.challengeSaved);
  expect(ui.challengeSaved).toBe('Картку збережено. Якщо не бачиш її — відкрий тест у звичайному браузері.');
});
