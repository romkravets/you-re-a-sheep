import { test, expect, type Page } from '@playwright/test';

const FEED_MS = 8 * 4500 + 2000;
const LEVELS = /Вівця|Моллі|Боксер|Бенджамін|Орвелл/;

async function answerOne(page: Page) {
  await page.getByTestId('option-a').click();
  await page.getByTestId('conf-maybe').click();
  const why = page.getByTestId('why-a');
  if (await why.isVisible().catch(() => false)) await why.click();
  await page.getByTestId('next').click();
}

async function toStop1(page: Page) {
  await page.clock.install();
  await page.goto('/?seed=123');
  await expect(page.getByTestId('feed')).toBeVisible();
  await page.clock.runFor(FEED_MS);
  await expect(page.getByTestId('question-screen')).toBeVisible();
}

async function toReality(page: Page) {
  await toStop1(page);
  for (let i = 0; i < 3; i++) await answerOne(page);
  await page.clock.runFor(700);
  await expect(page.getByTestId('question-screen')).toHaveClass(/paper/);
}

test('first paint is the feed', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('video, img[data-testid^="poster-"]').first()).toBeVisible({ timeout: 1500 });
  await expect(page.getByText("You're a sheep")).toHaveCount(0);
  await expect(page.getByText(/почати/i)).toHaveCount(0);
});

async function toVerdict(page: Page) {
  await toReality(page);
  for (let i = 0; i < 3; i++) await answerOne(page);
  await expect(page.getByTestId('reveal')).toBeVisible();
  await page.clock.runFor(20000);
}

test('full run passes reveal (title only there) and reaches verdict', async ({ page }) => {
  await toReality(page);
  await expect(page.getByText("You're a sheep")).toHaveCount(0);
  for (let i = 0; i < 3; i++) await answerOne(page);
  await expect(page.getByTestId('reveal')).toBeVisible();
  await expect(page.getByText("You're a sheep")).toHaveCount(0);
  await page.clock.runFor(3500);
  await expect(page.getByText("You're a sheep")).toBeVisible();
  await page.clock.runFor(10000);
  await expect(page.getByTestId('level-name')).toHaveText(LEVELS);
  await expect(page.getByText('Це не IQ-тест')).toBeVisible();
});

test('reload restarts cleanly', async ({ page }) => {
  await toReality(page);
  await page.reload();
  await expect(page.getByTestId('feed')).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
});

test('back button does not leave mid-test', async ({ page }) => {
  await toStop1(page);
  await page.goBack();
  await expect(page.getByTestId('question-screen')).toBeVisible();
  expect(new URL(page.url()).origin).toBe('http://localhost:4173');
});

test('back button after the test behaves normally (leaves the app)', async ({ page }) => {
  await page.goto('about:blank');
  await toVerdict(page);
  await expect(page.getByTestId('level-name')).toBeVisible();
  await page.goBack().catch(() => null);
  await expect.poll(() => page.url()).toBe('about:blank');
});

test('after the test the Back guard is gone even when the app is the first page in the tab', async ({ page }) => {
  await toVerdict(page);
  await expect(page.getByTestId('level-name')).toBeVisible();
  // No leftover same-page entries: with nothing before the app, Back has nowhere to go (button disabled),
  // instead of silently eating several presses.
  await expect.poll(() => page.evaluate(() => (window as unknown as { navigation: { canGoBack: boolean } }).navigation.canGoBack)).toBe(false);
});

test('back pressed twice mid-test still stays', async ({ page }) => {
  await toStop1(page);
  await page.goBack();
  await page.goBack();
  await expect(page.getByTestId('question-screen')).toBeVisible();
});

test('feed traps do not move the meter during the feed and reach the verdict', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?seed=123');
  await expect(page.getByTestId('feed')).toBeVisible();
  await page.getByTestId('clip-p1-clickbait').getByTestId('like').dispatchEvent('click');
  await page.getByTestId('clip-p1-fake').getByTestId('share').dispatchEvent('click');
  await expect(page.getByTestId('clip-p1-fake').getByTestId('share')).toHaveAttribute('aria-pressed', 'true');
  const meter = page.getByRole('progressbar');
  await expect(meter).toHaveAttribute('aria-valuenow', '0');
  await page.clock.runFor(4000);
  await expect(page.getByTestId('feed')).toBeVisible();
  await expect(meter).toHaveAttribute('aria-valuenow', '0');
  await page.clock.runFor(FEED_MS);
  await expect(page.getByTestId('question-screen')).toBeVisible();
  await expect(meter).not.toHaveAttribute('aria-valuenow', '0');
  for (let i = 0; i < 3; i++) await answerOne(page);
  await page.clock.runFor(700);
  await expect(page.getByTestId('question-screen')).toHaveClass(/paper/);
  for (let i = 0; i < 3; i++) await answerOne(page);
  await expect(page.getByTestId('reveal')).toBeVisible();
  await page.clock.runFor(20000);
  await expect(page.getByTestId('verdict')).toContainText('Ти переслав фейк.');
});

test('retry starts a new run from the feed', async ({ page }) => {
  await toVerdict(page);
  await page.getByRole('button', { name: 'Пройти ще раз' }).click();
  await expect(page.getByTestId('feed')).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
});

test('the «Стоп» screen shatters onto paper that is already there', async ({ page }) => {
  await toStop1(page);
  for (let i = 0; i < 3; i++) await answerOne(page);
  await expect(page.getByTestId('crack-canvas')).toBeAttached();
  await expect(page.getByTestId('question-screen')).toHaveClass(/paper/);
  await page.clock.runFor(1500);
  await expect(page.getByTestId('crack-canvas')).toHaveCount(0);
});

test('three quick Backs during the shatter onto paper still stay', async ({ page }) => {
  await toStop1(page);
  for (let i = 0; i < 3; i++) await answerOne(page);
  await expect(page.getByTestId('crack-canvas')).toBeAttached();
  await page.goBack();
  await page.goBack();
  await page.goBack();
  await expect(page.getByTestId('question-screen')).toHaveClass(/paper/);
  expect(new URL(page.url()).origin).toBe('http://localhost:4173');
});
