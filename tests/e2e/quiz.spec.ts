import { test, expect } from '@playwright/test';

const H = (q: string, theme = 'feed-stop') => `/tests/e2e/quiz-harness.html?q=${q}&theme=${theme}`;
const answers = (page: import('@playwright/test').Page) => page.evaluate(() => (window as any).__answers);

test('wrong answer shows correct option and explanation', async ({ page }) => {
  await page.goto(H('farm'));
  await page.getByTestId('option-c').click();
  await page.getByTestId('conf-maybe').click();
  const ex = page.getByTestId('explanation');
  await expect(ex).toContainText('❌ Неправильно');
  await expect(ex).toContainText('Це реклама');
  await expect(ex).toContainText('Це жарт');
  await expect(ex).toContainText('Заклик «всі мають побачити»');
});

test('keyboard 2, confidence 3, then Enter answers b with confidence sure', async ({ page }) => {
  await page.goto(H('recall'));
  await page.keyboard.press('2');
  await page.keyboard.press('3');
  await expect(page.getByTestId('explanation')).toContainText('✅ Так');
  await page.keyboard.press('Enter');
  expect(await answers(page)).toEqual([{ questionId: 'q-recall', chosen: 'b', confidence: 'sure' }]);
});

test('confidence is asked before the explanation', async ({ page }) => {
  await page.goto(H('farm'));
  await page.getByTestId('option-a').click();
  await expect(page.getByText('Наскільки ти впевнений?')).toBeVisible();
  await expect(page.getByText('✅')).toHaveCount(0);
  await expect(page.getByText('❌')).toHaveCount(0);
  await page.getByTestId('conf-guess').click();
  await expect(page.getByText('Так. А чому?')).toBeVisible();
});

test('why only after a correct answer with why', async ({ page }) => {
  await page.goto(H('farm'));
  await page.getByTestId('option-a').click();
  await page.getByTestId('conf-sure').click();
  await expect(page.getByText('Так. А чому?')).toBeVisible();

  await page.goto(H('farm'));
  await page.getByTestId('option-b').click();
  await page.getByTestId('conf-sure').click();
  await expect(page.getByText('Так. А чому?')).toHaveCount(0);
  await expect(page.getByTestId('explanation')).toBeVisible();

  await page.goto(H('recall'));
  await page.getByTestId('option-b').click();
  await page.getByTestId('conf-sure').click();
  await expect(page.getByText('Так. А чому?')).toHaveCount(0);
  await expect(page.getByTestId('explanation')).toBeVisible();
});

test('wrong why shows lucky-guess explanation and onanswer receives whyChosen', async ({ page }) => {
  await page.goto(H('farm'));
  await page.getByTestId('option-a').click();
  await page.getByTestId('conf-guess').click();
  await page.getByTestId('why-a').click();
  const ex = page.getByTestId('explanation');
  await expect(ex).toContainText('✅ Так, але причина інша');
  await expect(ex).toContainText('Бо є заклик ділитись');
  await page.getByTestId('next').click();
  expect(await answers(page)).toEqual([
    { questionId: 'q-farm', chosen: 'a', confidence: 'guess', whyChosen: 'a' },
  ]);
});

test('herd shows crowd hint and reveal line appended', async ({ page }) => {
  await page.goto(H('herd'));
  await expect(page.getByTestId('option-c')).toContainText('👥 87%');
  await page.getByTestId('option-c').click();
  await page.getByTestId('conf-sure').click();
  await expect(page.getByTestId('explanation')).toContainText('Цієї цифри не було — це пастка.');
});

test('rewritten shows before and after with the diff highlighted', async ({ page }) => {
  await page.goto(H('rewritten', 'paper'));
  await expect(page.getByText('Було')).toHaveCount(0);
  await page.getByTestId('option-a').click();
  await page.getByTestId('conf-sure').click();
  await expect(page.getByText('Було', { exact: true })).toBeVisible();
  await expect(page.getByText('Стало', { exact: true })).toBeVisible();
  await expect(page.getByTestId('diff-before').locator('mark')).toHaveText(['5%', '2024']);
  await expect(page.getByTestId('diff-after').locator('mark')).toHaveText(['15%', '2025']);
});

test('sheep meter is labelled and reflects value', async ({ page }) => {
  await page.goto(H('recall') + '&meter=60');
  await expect(page.getByText('рівень вівці')).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60');
});

test('desktop paper theme renders two columns', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'desktop only');
  await page.goto(H('farm', 'paper'));
  const cols = await page.getByTestId('grid').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(cols).toBe(2);
});

test('state resets when the question prop changes on the same instance', async ({ page }) => {
  await page.goto(H('recall'));
  await page.keyboard.press('2');
  await page.keyboard.press('3');
  await page.keyboard.press('Enter');
  await page.evaluate(() => (window as any).__setQuestion('herd'));
  await expect(page.getByTestId('option-a')).toBeEnabled();
  await expect(page.getByTestId('explanation')).toHaveCount(0);
  await page.getByTestId('option-a').click();
  await page.getByTestId('conf-maybe').click();
  await page.getByTestId('why-a').click();
  await page.getByTestId('next').click();
  const a = await answers(page);
  expect(a).toHaveLength(2);
  expect(a[1]).toEqual({ questionId: 'q-herd', chosen: 'a', confidence: 'maybe', whyChosen: 'a' });
});

// enemy stamp and vanishing text: deferred past the pilot.
