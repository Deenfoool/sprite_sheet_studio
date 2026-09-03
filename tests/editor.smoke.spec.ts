import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

async function loadFourFrameFixture(page) {
  const encoded = await readFile('tests/fixtures/transparent-4-frame-sheet.png.base64', 'utf8');
  const buffer = Buffer.from(encoded.trim(), 'base64');
  await page.locator('#fileInput').setInputFiles({
    name: 'transparent-4-frame-sheet.png',
    mimeType: 'image/png',
    buffer
  });
  await expect(page.locator('#sourceName')).toContainText('transparent-4-frame-sheet.png');
  await page.locator('#autoSliceBtn').click();
  await expect(page.locator('#colsInput')).toHaveValue('4');
  await expect(page.locator('#rowsInput')).toHaveValue('1');
}

test('boots the complete editor runtime without page errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Try demo' })).toBeVisible();
  await expect(page.locator('#uploadZone')).toBeVisible();
  await expect(page.locator('#anchorSelect option[value="custom"]')).toHaveCount(1);
  await expect(page.locator('#bgSelect option[value="custom"]')).toHaveCount(1);
  await expect(page.locator('[data-source-cell-status]')).toBeAttached();
  await expect(page.getByRole('button', { name: /Trim current/i })).toBeAttached();

  await expect(page.getByRole('button', { name: /Rigging/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Diagnostics/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Multi-atlas/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Aseprite/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Animated PNG/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Animated WebP/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Unity package/i })).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('loads a real transparent sprite sheet and auto-slices four frames', async ({ page }) => {
  await page.goto('/');
  await loadFourFrameFixture(page);
  await expect(page.locator('#frames .frame-card')).toHaveCount(4);
  await expect(page.locator('#frameCount')).toHaveText('4');
});

test('source sheet cells can be excluded and restored by clicking the grid', async ({ page }) => {
  await page.goto('/');
  await loadFourFrameFixture(page);
  await expect(page.locator('#frames .frame-card')).toHaveCount(4);

  const source = page.locator('#sourceCanvas');
  const box = await source.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.mouse.click(box.x + box.width * 0.125, box.y + box.height * 0.5);
  await expect(page.locator('#frames .frame-card')).toHaveCount(3);
  await expect(page.locator('[data-source-cell-status]')).toContainText('3/4');

  await page.mouse.click(box.x + box.width * 0.125, box.y + box.height * 0.5);
  await expect(page.locator('#frames .frame-card')).toHaveCount(4);
  await expect(page.locator('[data-source-cell-status]')).toContainText('All 4');
});

test('cleanup compare and multi-frame onion controls are mounted', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try demo' }).click();

  await page.locator('#onionInput').check();
  await expect(page.locator('[data-onion-depth]')).toBeVisible();
  await page.locator('[data-onion-depth]').selectOption('3');
  await expect(page.locator('.onion-stack-overlay')).toBeAttached();

  await page.locator('#trimBtn').click();
  await expect(page.locator('.cleanup-compare')).toBeVisible();
  await expect(page.locator('[data-compare-label]')).toContainText('Trim transparent');
  await page.getByRole('button', { name: /Close comparison/i }).click();
  await expect(page.locator('.cleanup-compare')).toHaveClass(/hidden/);
});

test('demo animation plays and exports through workers and WebP muxer', async ({ page }) => {
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

  const webpDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Animated WebP/i }).click();
  const webp = await webpDownloadPromise;
  expect(webp.suggestedFilename()).toMatch(/\.webp$/i);
  const webpPath = await webp.path();
  expect(webpPath).not.toBeNull();
  if (webpPath) {
    const bytes = await readFile(webpPath);
    expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(bytes.subarray(8, 12).toString('ascii')).toBe('WEBP');
    expect(bytes.includes(Buffer.from('ANIM'))).toBe(true);
    expect(bytes.includes(Buffer.from('ANMF'))).toBe(true);
  }

  expect(pageErrors).toEqual([]);
});

test('custom anchors are persisted in a full SSS project', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try demo' }).click();

  await page.locator('#anchorSelect').selectOption('custom');
  await expect(page.getByRole('button', { name: /Pick anchor on preview/i })).toBeVisible();

  await page.getByRole('button', { name: /Pick anchor on preview/i }).click();
  const preview = page.locator('#previewCanvas');
  const box = await preview.boundingBox();
  expect(box).not.toBeNull();
  if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.8);
  await expect(page.locator('#customAnchorHint')).toContainText('anchor');

  const projectDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save .sss' }).click();
  const project = await projectDownload;
  expect(project.suggestedFilename()).toMatch(/\.sss$/i);

  const projectPath = await project.path();
  expect(projectPath).not.toBeNull();
  if (projectPath) {
    const saved = JSON.parse(await readFile(projectPath, 'utf8'));
    expect(saved.projectFormat).toBe('sss-full-project');
    expect(saved.rigging).toBeTruthy();
    expect(saved.skeletal).toBeTruthy();
    expect(saved.animations.idle.frames[0].customAnchor).toBeTruthy();
  }
});

test('rigging, IK locks and skeletal scale controls are mounted', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Rigging/i }).click();

  await expect(page.locator('.rig-overlay')).toBeVisible();
  await expect(page.locator('#ikEnable')).toBeVisible();
  await expect(page.locator('#ikLockA')).toBeVisible();
  await expect(page.locator('#ikLockB')).toBeVisible();
  await expect(page.getByRole('button', { name: /Load parts/i })).toBeVisible();
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
  const diagnosticsCount = await page.locator('.sss-diagnostics-row').count();
  expect(diagnosticsCount).toBeGreaterThanOrEqual(23);

  const reportDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export report JSON/i }).click();
  const report = await reportDownload;
  expect(report.suggestedFilename()).toBe('sprite-sheet-studio-diagnostics.json');
});
