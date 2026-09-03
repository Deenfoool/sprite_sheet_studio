import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

async function setFourFrameFixture(page) {
  const encoded = await readFile('tests/fixtures/transparent-4-frame-sheet.png.base64', 'utf8');
  const buffer = Buffer.from(encoded.trim(), 'base64');
  await page.locator('#fileInput').setInputFiles({
    name: 'transparent-4-frame-sheet.png',
    mimeType: 'image/png',
    buffer
  });
  await expect(page.locator('#sourceName')).toContainText('transparent-4-frame-sheet.png');
}

async function loadFourFrameFixture(page) {
  await setFourFrameFixture(page);
  await page.locator('#autoSliceBtn').click();
  await expect(page.locator('#colsInput')).toHaveValue('4');
  await expect(page.locator('#rowsInput')).toHaveValue('1');
}

async function canvasSupportsWebp(page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    return canvas.toDataURL('image/webp').startsWith('data:image/webp');
  });
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
  await expect(page.getByRole('button', { name: /Object Slice/i })).toBeAttached();

  await expect(page.getByRole('button', { name: /Rigging/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Diagnostics/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Multi-atlas/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Aseprite/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Animated PNG/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Animated WebP/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Unity package/i })).toBeVisible();
  await expect(page.locator('.sss-skip-link')).toBeAttached();
  await expect(page.locator('#sss-live-region')).toBeAttached();

  expect(pageErrors).toEqual([]);
});

test('loads a real transparent sprite sheet and auto-slices four frames', async ({ page }) => {
  await page.goto('/');
  await loadFourFrameFixture(page);
  await expect(page.locator('#frames .frame-card')).toHaveCount(4);
  await expect(page.locator('#frameCount')).toHaveText('4');
});

test('Object Slice detects irregular foreground objects without a manual grid', async ({ page }) => {
  await page.goto('/');
  await setFourFrameFixture(page);
  const objectSlice = page.getByRole('button', { name: /Object Slice/i });
  await expect(objectSlice).toBeEnabled();
  await objectSlice.click();
  await expect(page.locator('#frames .frame-card')).toHaveCount(4);
  await expect(page.locator('#sourceName')).toContainText('4 separate frames');
  await expect(page.locator('#smartStatus')).toContainText('Object Slice found 4');
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

test('demo animation plays and exports GIF and APNG', async ({ page }) => {
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

test('Animated WebP muxer produces RIFF animation when Canvas WebP encoding is supported', async ({ page }) => {
  await page.goto('/');
  const supportsWebp = await canvasSupportsWebp(page);
  test.skip(!supportsWebp, 'Canvas WebP encoding is not available in this browser engine');

  await page.getByRole('button', { name: 'Try demo' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Animated WebP/i }).click();
  const webp = await downloadPromise;
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
});

test('custom anchors, skeletal easing and IK persist in a full SSS project', async ({ page }) => {
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

  await page.getByRole('button', { name: /Rigging/i }).click();
  await page.locator('#skInterp').selectOption('bezier');
  await page.locator('#skCurveX1').fill('0.2');
  await page.locator('#skCurveY1').fill('0.1');
  await page.locator('#skCurveX2').fill('0.7');
  await page.locator('#skCurveY2').fill('0.9');
  await page.locator('#skCurveY2').blur();

  await page.locator('#rigAddBone').click();
  await page.locator('#ikAddChain').click();
  await expect(page.locator('#ikChainSelect option')).toHaveCount(1);
  await page.getByRole('button', { name: /Back to animator/i }).click();

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
    expect(saved.ik).toBeTruthy();
    expect(saved.ik.chains).toHaveLength(1);
    expect(saved.animations.idle.frames[0].customAnchor).toBeTruthy();
    expect(saved.skeletal.easingExtensions?.idle?.interpolation).toBe('bezier');
    expect(saved.skeletal.easingExtensions?.idle?.curve).toEqual([0.2, 0.1, 0.7, 0.9]);
  }
});

test('rigging supports multiple simultaneous IK chains', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Rigging/i }).click();

  await expect(page.locator('.rig-overlay')).toBeVisible();
  await expect(page.locator('#ikEnable')).toBeVisible();
  await expect(page.locator('#ikLockA')).toBeVisible();
  await expect(page.locator('#ikLockB')).toBeVisible();
  await expect(page.locator('#ikChainSelect')).toBeVisible();
  await expect(page.getByRole('button', { name: /Load parts/i })).toBeVisible();
  await expect(page.locator('#rigPartScaleX')).toBeAttached();
  await expect(page.locator('#rigPartScaleY')).toBeAttached();
  await expect(page.locator('#skAnimSelect')).toBeVisible();
  await expect(page.locator('#skCurvePreview')).toBeVisible();

  await page.locator('#rigAddBone').click();
  await page.locator('#ikAddChain').click();
  await expect(page.locator('#ikChainSelect option')).toHaveCount(1);

  await page.locator('#rigTree .rig-tree-item').first().click();
  await page.locator('#rigAddBone').click();
  await page.locator('#ikAddChain').click();
  await expect(page.locator('#ikChainSelect option')).toHaveCount(2);
  await expect(page.locator('#ikChainCount')).toHaveText('2 chains');

  await page.locator('#ikEnable').check();
  await expect(page.locator('#ikStatus')).toContainText('2 total targets');

  await page.getByRole('button', { name: /Back to animator/i }).click();
  await expect(page.locator('.rig-overlay')).toHaveClass(/hidden/);
});

test('accessibility runtime exposes skip link, live region and reduced-motion state', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const skip = page.locator('.sss-skip-link');
  await expect(skip).toHaveAttribute('href', '#sss-main-workspace');
  await skip.focus();
  await expect(skip).toBeFocused();

  await expect(page.locator('#previewCanvas')).toHaveAttribute('role', 'img');
  await expect(page.locator('#sourceCanvas')).toHaveAttribute('role', 'img');
  await expect(page.locator('#sss-live-region')).toHaveAttribute('aria-live', 'polite');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.reducedMotion)).toBe('true');

  await page.getByRole('button', { name: 'Try demo' }).click();
  await expect(page.locator('#sss-live-region')).not.toHaveText('');
});

test('built-in diagnostics complete and can export a report', async ({ page }) => {
  await page.goto('/?selftest=1');

  await expect(page.locator('.sss-diagnostics')).toBeVisible();
  const summary = page.locator('[data-diag-summary]');
  await expect(summary).toContainText('passed');
  const diagnosticsCount = await page.locator('.sss-diagnostics-row').count();
  expect(diagnosticsCount).toBeGreaterThanOrEqual(32);

  const reportDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export report JSON/i }).click();
  const report = await reportDownload;
  expect(report.suggestedFilename()).toBe('sprite-sheet-studio-diagnostics.json');
});
