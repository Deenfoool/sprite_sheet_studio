import { test, expect } from '@playwright/test';

test('advanced mesh topology editor retriangulates and normalizes weights', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Rigging/i }).click();

  await expect(page.locator('.mesh-topology-panel')).toBeVisible();
  await expect(page.getByRole('button', { name: /Delaunay retriangulate/i })).toBeVisible();

  const result = await page.evaluate(() => {
    const mesh = (globalThis as any).__SSSMesh?.state;
    const topology = (globalThis as any).__SSSMeshTopology;
    if (!mesh || !topology) throw new Error('Mesh topology runtime missing');

    mesh.vertices = [
      { u: 0, v: 0, offsetX: 0, offsetY: 0, weights: { root: 0.8, ghost: 0.2 } },
      { u: 100, v: 0, offsetX: 0, offsetY: 0, weights: { root: 0.6, ghost: 0.4 } },
      { u: 100, v: 100, offsetX: 0, offsetY: 0, weights: { root: 0.2, ghost: 0.8 } },
      { u: 0, v: 100, offsetX: 0, offsetY: 0, weights: { root: 0.4, ghost: 0.6 } },
      { u: 50, v: 50, offsetX: 0, offsetY: 0, weights: { root: 0.5, ghost: 0.3, tiny: 0.01, extra: 0.19 } }
    ];
    mesh.triangles = [];
    topology.retriangulate();
    topology.prune(2, 0.02);

    return {
      triangleCount: mesh.triangles.length,
      validTriangles: mesh.triangles.every((triangle: number[]) => triangle.length === 3 && new Set(triangle).size === 3),
      vertexWeights: mesh.vertices.map((vertex: any) => Object.values(vertex.weights || {}) as number[])
    };
  });

  expect(result.triangleCount).toBeGreaterThanOrEqual(4);
  expect(result.validTriangles).toBe(true);
  for (const weights of result.vertexWeights) {
    expect(weights.length).toBeLessThanOrEqual(2);
    if (weights.length) {
      expect(weights.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 5);
    }
  }
});
