import { test, expect } from '@playwright/test';

test('skeletal property tracks show changed lanes and scrub to keyframes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Rigging/i }).click();

  await expect(page.locator('.skeletal-tracks-shell')).toBeVisible();
  await expect(page.locator('#skTracksFilter')).toBeVisible();

  await page.locator('#skRange').fill('0');
  await page.locator('#skKey').click();

  await page.locator('#skRange').fill('10');
  await page.locator('#skRange').dispatchEvent('input');
  await page.evaluate(() => {
    const rig = (globalThis as any).__SSSRig;
    const root = rig?.state?.bones?.[0];
    if (!root) throw new Error('Root bone missing');
    root.rotation += 35;
    rig.draw();
  });
  await page.locator('#skKey').click();

  await expect(page.locator('.skeletal-track-key')).toHaveCount(await page.locator('.skeletal-track-key').count());
  const keyCount = await page.locator('.skeletal-track-key').count();
  expect(keyCount).toBeGreaterThan(1);
  await expect(page.locator('[data-sk-track-summary]')).toContainText('keys');

  const frameTenMarker = page.locator('.skeletal-track-key[aria-label*="frame 10"]').first();
  await expect(frameTenMarker).toBeVisible();
  await frameTenMarker.click();
  await expect(page.locator('#skRange')).toHaveValue('10');
});
