import { test, expect } from '@playwright/test';

test('index page is Ukrainian', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.status()).toBe(200);
  const lang = await page.evaluate(() => document.documentElement.lang);
  expect(lang).toBe('uk');
});
