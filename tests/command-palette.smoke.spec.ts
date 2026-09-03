import { test, expect } from '@playwright/test';

test('command palette opens with keyboard and runs editor commands', async ({ page }) => {
  await page.goto('/');

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
  await expect(page.locator('.sss-command-palette')).toBeVisible();
  const search = page.locator('[data-command-search]');
  await expect(search).toBeFocused();

  await search.fill('Rigging');
  await expect(page.locator('.sss-command-row')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(page.locator('.sss-command-palette')).toHaveClass(/hidden/);
  await expect(page.locator('.rig-overlay')).toBeVisible();

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
  await expect(page.locator('.sss-command-palette')).toBeVisible();
  await search.fill('Back to animator');
  await page.keyboard.press('Enter');
  await expect(page.locator('.rig-overlay')).toHaveClass(/hidden/);
});
