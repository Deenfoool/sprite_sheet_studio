import { test, expect } from '@playwright/test';

test('uses organized brand assets and app icon pack', async ({ page }) => {
  await page.goto('/');

  const brand = page.locator('.brand-logo');
  await expect(brand).toBeVisible();
  await expect(brand).toHaveAttribute('src', './assets/brand/logo-mark.svg');

  const lockup = page.locator('.empty-brand-lockup img');
  await expect(lockup).toBeVisible();
  await expect(lockup).toHaveAttribute('src', './assets/brand/logo-full.png');

  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute('href', './assets/icons/favicon.svg');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', './assets/icons/apple-touch-icon.png');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', './assets/icons/site.webmanifest');

  const socialImage = page.locator('meta[property="og:image"]');
  await expect(socialImage).toHaveAttribute('content', /assets\/brand\/logo-full-large\.png$/);
});

test('loads Lucide as progressive icon enhancement', async ({ page }) => {
  await page.goto('/');

  const lucideScript = page.locator('script[src*="unpkg.com/lucide"]');
  await expect(lucideScript).toHaveCount(1);

  // The editor remains text-usable even when a CDN is unavailable; when Lucide
  // is reachable, the runtime marks the document and decorates controls.
  const mode = await page.evaluate(() => document.documentElement.dataset.icons || 'fallback');
  expect(['lucide', 'fallback']).toContain(mode);
});
