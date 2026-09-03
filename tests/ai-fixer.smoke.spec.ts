import { test, expect } from '@playwright/test';

test('AI Fixer detects duplicate frames and renders a similarity heatmap', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try demo' }).click();
  await expect(page.locator('#frames .frame-card')).toHaveCount(5);

  await page.locator('#duplicateBtn').click();
  await expect(page.locator('#frames .frame-card')).toHaveCount(6);

  await page.locator('#aiAnalyze').click();
  await expect(page.locator('#aiHeatmap')).toBeVisible();
  await expect(page.locator('#aiSimilarityHeatmap')).toBeVisible();
  await expect(page.locator('[data-ai-duplicates]')).not.toContainText('none detected');

  const diagnostics = await page.evaluate(() => {
    const api = globalThis.__SSSAIFixer;
    const report = api?.diagnostics?.();
    return report ? {
      duplicatePairs: report.duplicatePairs.length,
      duplicateFrames: report.duplicateFrames.length,
      matrixSize: report.matrix.length
    } : null;
  });

  expect(diagnostics).not.toBeNull();
  expect(diagnostics?.duplicatePairs).toBeGreaterThanOrEqual(1);
  expect(diagnostics?.duplicateFrames).toBeGreaterThanOrEqual(2);
  expect(diagnostics?.matrixSize).toBe(6);
});

test('AI Fixer flags an extreme transformed frame as a broken-frame suspect', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try demo' }).click();
  await expect(page.locator('#frames .frame-card')).toHaveCount(5);

  const cards = page.locator('#frames .frame-card');
  await cards.last().click();
  await page.locator('#extScaleSelect').selectOption('4');
  await page.locator('#extScaleApply').click();

  await page.locator('#aiAnalyze').click();
  await expect(page.locator('[data-ai-broken]')).not.toContainText('none detected');
  await expect(cards.last()).toHaveClass(/diagnostic-error/);

  const brokenFrames = await page.evaluate(() => globalThis.__SSSAIFixer?.diagnostics?.()?.brokenFrames ?? []);
  expect(brokenFrames.length).toBeGreaterThanOrEqual(1);
});
