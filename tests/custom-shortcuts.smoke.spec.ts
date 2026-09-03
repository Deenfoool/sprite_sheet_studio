import { test, expect } from '@playwright/test';

test('custom shortcut editor records and executes a local binding', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Shortcuts/i }).click();
  await expect(page.locator('.sss-shortcuts-modal')).toBeVisible();

  const commandSelect = page.locator('[data-shortcut-command]');
  const demoOption = commandSelect.locator('option').filter({ hasText: /Try demo/i }).first();
  const demoValue = await demoOption.getAttribute('value');
  expect(demoValue).toBeTruthy();
  await commandSelect.selectOption(demoValue!);

  await page.locator('[data-shortcut-record]').click();
  await page.keyboard.press('Alt+D');
  await expect(page.locator('[data-shortcut-record]')).toHaveText('Alt+D');
  await page.locator('[data-shortcut-add]').click();
  await expect(page.locator('.sss-shortcut-row')).toHaveCount(1);

  const stored = await page.evaluate(() => localStorage.getItem('sss-custom-shortcuts-v1'));
  expect(stored).toContain('Alt+D');

  await page.locator('[data-shortcuts-close]').click();
  await page.keyboard.press('Alt+D');
  await expect(page.locator('#frames .frame-card')).toHaveCount(5);
});
