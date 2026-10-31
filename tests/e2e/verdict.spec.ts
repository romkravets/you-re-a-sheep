import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const ui = JSON.parse(readFileSync('content/uk/ui.json', 'utf8')) as Record<string, string>;
const patterns = JSON.parse(readFileSync('content/uk/patterns.json', 'utf8')) as { skill: string; line: string }[];
const reveal = '/tests/e2e/verdict-harness.html?view=reveal';

test('shows level, verdict lines, disclaimer', async ({ page }) => {
  await page.goto('/tests/e2e/verdict-harness.html?percent=62&pattern=none');
  await expect(page.getByTestId('level-name')).toHaveText('Боксер');
  await expect(page.getByTestId('level-of')).toHaveText('Рівень 3 з 5');
  await expect(page.getByTestId('percent')).toContainText('62%');
  await expect(page.getByTestId('percent')).toContainText(ui.percentLabel);
  await expect(page.getByRole('listitem').filter({ hasText: 'Ти пішов за натовпом.' })).toBeVisible();
  await expect(page.getByText('Це не IQ-тест. Це дзеркало.')).toBeVisible();
  await page.getByRole('button', { name: 'Пройти ще раз' }).click();
  expect(await page.evaluate(() => (window as unknown as { __retried: number }).__retried)).toBe(1);
});

test('shows pattern when set and hides it when null', async ({ page }) => {
  await page.goto('/tests/e2e/verdict-harness.html?pattern=herd');
  const line = patterns.find((p) => p.skill === 'herd')!.line;
  await expect(page.getByTestId('pattern')).toContainText(ui.patternPrefix);
  await expect(page.getByTestId('pattern')).toContainText(line);
  // One sentence: «Твій шаблон: ти …», prefix and line on the same line.
  await expect(page.getByTestId('pattern')).toHaveText(`${ui.patternPrefix} ${line}`);
  const displays = await page.getByTestId('pattern').evaluate((el) => [...el.children].map((c) => getComputedStyle(c).display));
  expect(displays.every((d) => d === 'inline')).toBe(true);
  await page.goto('/tests/e2e/verdict-harness.html?pattern=none');
  await expect(page.getByTestId('level-name')).toBeVisible();
  await expect(page.getByTestId('pattern')).toHaveCount(0);
  await expect(page.getByText(ui.patternPrefix)).toHaveCount(0);
});

test('reveal types lines then shows title and continues on tap', async ({ page }) => {
  await page.clock.install();
  await page.goto(reveal);
  await expect(page.getByTestId('reveal')).toBeVisible();
  await expect(page.getByText("You're a sheep")).toHaveCount(0);
  await page.clock.runFor(3500);
  await expect(page.getByText("You're a sheep")).toBeVisible();
  await expect(page.getByTestId('reveal')).toContainText('Ферма існує.');
  await page.getByTestId('reveal').click();
  expect(await page.evaluate(() => (window as unknown as { __continued: number }).__continued)).toBe(1);
});

test('reveal auto-continues after 4 s', async ({ page }) => {
  await page.clock.install();
  await page.goto(reveal);
  await expect(page.getByTestId('reveal')).toBeVisible();
  await page.clock.runFor(20000);
  await expect(page.getByText("You're a sheep")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __continued: number }).__continued)).toBe(1);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('reduced motion shows reveal text immediately', async ({ page }) => {
    await page.clock.install();
    await page.goto(reveal);
    await expect(page.getByText("You're a sheep")).toBeVisible();
    await expect(page.getByTestId('reveal')).toContainText('Ти щойно побачив, як вони працюють.');
    await page.clock.runFor(700); // input guard against a double tap carried over from the quiz
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => (window as unknown as { __continued: number }).__continued)).toBe(1);
  });
});

test('reveal ignores taps and keys for the first 600 ms and held keys', async ({ page }) => {
  await page.clock.install();
  await page.goto(reveal);
  await expect(page.getByTestId('reveal')).toBeVisible();
  const continued = () => page.evaluate(() => (window as unknown as { __continued?: number }).__continued ?? 0);
  await page.getByTestId('reveal').click();
  await page.keyboard.press('Enter');
  expect(await continued()).toBe(0);
  await page.clock.runFor(700);
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true })));
  expect(await continued()).toBe(0);
  await page.keyboard.press('Enter');
  expect(await continued()).toBe(1);
});
