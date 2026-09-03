import { test, expect } from '@playwright/test';

test('named guides persist and can restore the active core guide', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try demo' }).click();

  await expect(page.locator('.named-guides-manager')).toBeVisible();
  await page.locator('#guideX').fill('18');
  await page.locator('#guideX').dispatchEvent('input');
  await page.locator('#namedGuideName').fill('Character center');
  await page.locator('#namedGuideAxis').selectOption('x');
  await page.locator('#namedGuideValue').fill('18');
  await page.locator('#namedGuideAdd').click();

  await expect(page.locator('.named-guide-row')).toHaveCount(1);
  await expect(page.locator('.named-guide-row')).toContainText('Character center');

  await page.locator('#guideX').fill('3');
  await page.locator('#guideX').dispatchEvent('input');
  await page.locator('.named-guide-main').click();
  await expect(page.locator('#guideX')).toHaveValue('18');

  const stored = await page.evaluate(() => localStorage.getItem('sss-named-guides-v1'));
  expect(stored).toContain('Character center');

  const toggle = page.locator('.named-guide-toggle input');
  await toggle.uncheck();
  await expect(page.locator('[data-guide-count]')).toHaveText('0/1');
});
