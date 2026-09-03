import { test, expect } from '@playwright/test';

test('boots the complete editor runtime without page errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Try demo' })).toBeVisible();
  await expect(page.locator('#uploadZone')).toBeVisible();
  await expect(page.locator('#anchorSelect option[value="custom"]')).toHaveCount(1);
  await expect(page.locator('#bgSelect option[value="custom"]')).toHaveCount(1);

  await expect(page.getByRole('button', { name: /Rigging/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Diagnostics/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Multi-atlas/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Aseprite/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Animated PNG/i })).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('demo animation plays and exports through workers', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await page.getByRole('button', { name: 'Try demo' }).click();

  await expect(page.locator('#frames .frame-card')).toHaveCount(5);
  await expect(page.locator('#frameCount')).toHaveText('5');

  const play = page.locator('#playBtn');
  await play.click();
  await expect(play).toContainText('Pause');
  await page.waitForTimeout(180);
  await play.click();
  await expect(play).toContainText('Play');

  const gifDownload = page.waitForEvent('download');
  await page.locator('#gifBtn').click();
  const gif = await gifDownload;
  expect(gif.suggestedFilename()).toMatch(/\.gif$/i);

  const apngButton = page.getByRole('button', { name: /Animated PNG/i });
  const apngDownload = page.waitForEvent('download');
  await apngButton.click();
  const apng = await apngDownload;
  expect(apng.suggestedFilename()).toMatch(/\.png$/i);

  expect(pageErrors).toEqual([]);
});

test('custom anchors and full SSS project save are available', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try demo' }).click();

  await page.locator('#anchorSelect').selectOption('custom');
  await expect(page.getByRole('button', { name: /Pick anchor on preview/i })).toBeVisible();

  await page.getByRole('button', { name: /Pick anchor on preview/i }).click();
  const preview = page.locator('#previewCanvas');
  const box = await preview.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.8);
  }
  await expect(page.locator('#customAnchorHint')).toContainText('anchor');

  const projectDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save .sss' }).click();
  const project = await projectDownload;
  expect(project.suggestedFilename()).toMatch(/\.sss$/i);
});

test('rigging, IK locks and skeletal scale controls are mounted', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Rigging/i }).click();

  await expect(page.locator('.rig-overlay')).toBeVisible();
  await expect(page.locator('#ikEnable')).toBeVisible();
  await expect(page.locator('#ikLockA')).toBeVisible();
  await expect(page.locator('#ikLockB')).toBeVisible();

  await page.getByRole('button', { name: /Load parts/i }).isVisible();
  await expect(page.locator('#rigPartScaleX')).toBeAttached();
  await expect(page.locator('#rigPartScaleY')).toBeAttached();
  await expect(page.locator('#skAnimSelect')).toBeVisible();

  await page.getByRole('button', { name: /Back to animator/i }).click();
  await expect(page.locator('.rig-overlay')).toHaveClass(/hidden/);
});

test('built-in diagnostics complete and can export a report', async ({ page }) => {
  await page.goto('/?selftest=1');

  await expect(page.locator('.sss-diagnostics')).toBeVisible();
  const summary = page.locator('[data-diag-summary]');
  await expect(summary).toContainText('passed');
  await expect(page.locator('.sss-diagnostics-row')).toHaveCount(18);

  const reportDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export report JSON/i }).click();
  const report = await reportDownload;
  expect(report.suggestedFilename()).toBe('sprite-sheet-studio-diagnostics.json');
});
