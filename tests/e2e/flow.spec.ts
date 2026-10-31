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

test('back button at verdict stays', async ({ page }) => {
  await toVerdict(page);
  await expect(page.getByTestId('level-name')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('level-name')).toBeVisible();
  expect(new URL(page.url()).origin).toBe('http://localhost:4173');
});

test('retry starts a new run from the feed', async ({ page }) => {
  await toVerdict(page);
  await page.getByRole('button', { name: 'Пройти ще раз' }).click();
  await expect(page.getByTestId('feed')).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
});
