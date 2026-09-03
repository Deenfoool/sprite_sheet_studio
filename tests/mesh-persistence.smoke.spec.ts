import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test('full SSS project persists mesh topology and bone weights', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try demo' }).click();
  await page.getByRole('button', { name: /Rigging/i }).click();

  await page.evaluate(() => {
    const mesh = (globalThis as any).__SSSMesh?.state;
    if (!mesh) throw new Error('Mesh runtime missing');
    mesh.cols = 1;
    mesh.rows = 1;
    mesh.vertices = [
      { u: 0, v: 0, offsetX: 1, offsetY: 2, weights: { root: 1 } },
      { u: 32, v: 0, offsetX: 0, offsetY: 0, weights: { root: 0.75 } },
      { u: 32, v: 32, offsetX: -1, offsetY: 0, weights: { root: 0.5 } }
    ];
    mesh.triangles = [[0, 1, 2]];
    mesh.bindWorld = { root: { startX: 10, startY: 20, rotation: 0, endX: 90, endY: 20 } };
    mesh.bindLocals = { root: { x: 10, y: 20, rotation: 0, length: 80, visible: true } };
    mesh.bindPart = null;
  });

  await page.getByRole('button', { name: /Back to animator/i }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save .sss' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();

  if (path) {
    const project = JSON.parse(await readFile(path, 'utf8'));
    expect(project.mesh).toBeTruthy();
    expect(project.mesh.version).toBe(1);
    expect(project.mesh.vertices).toHaveLength(3);
    expect(project.mesh.triangles).toEqual([[0, 1, 2]]);
    expect(project.mesh.vertices[0].weights.root).toBe(1);
    expect(project.mesh.vertices[0].offsetX).toBe(1);
  }
});
