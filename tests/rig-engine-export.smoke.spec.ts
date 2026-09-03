import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test('rig package export contains Godot Unity animation IK and mesh assets', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Rigging/i }).click();
  await expect(page.getByRole('button', { name: /Rig package/i })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Rig package/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('sprite-sheet-studio-rig-package.zip');

  const path = await download.path();
  expect(path).not.toBeNull();
  if (!path) return;

  const bytes = await readFile(path);
  expect(bytes[0]).toBe(0x50);
  expect(bytes[1]).toBe(0x4b);
  const ascii = bytes.toString('latin1');
  expect(ascii).toContain('SpriteSheetStudioRig/manifest.json');
  expect(ascii).toContain('SpriteSheetStudioRig/rig/rig-runtime.json');
  expect(ascii).toContain('SpriteSheetStudioRig/animations/skeletal-animations.json');
  expect(ascii).toContain('SpriteSheetStudioRig/ik/ik.json');
  expect(ascii).toContain('SpriteSheetStudioRig/mesh/mesh.json');
  expect(ascii).toContain('SpriteSheetStudioRig/godot/import_rig.gd');
  expect(ascii).toContain('SpriteSheetStudioRig/unity/Editor/SpriteSheetStudioRigImporter.cs');
});
