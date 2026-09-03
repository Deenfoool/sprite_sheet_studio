import { test, expect } from '@playwright/test';

test('IK solver priorities order shared-parent chains and persist in serialization', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Rigging/i }).click();

  await expect(page.locator('.ik-priority-panel')).toBeVisible();

  const result = await page.evaluate(() => {
    const rig = (globalThis as any).__SSSRig;
    const ik = (globalThis as any).__SSSIK;
    const priority = (globalThis as any).__SSSIKPriority;
    if (!rig || !ik || !priority) throw new Error('IK priority runtime missing');

    const root = rig.state.bones[0];
    const makeBone = (id: string, name: string, y: number) => ({
      id,
      name,
      parentId: root.id,
      x: 0,
      y,
      rotation: 0,
      length: 55,
      visible: true
    });
    rig.state.bones = [root, makeBone('priority-a', 'Priority A', -12), makeBone('priority-b', 'Priority B', 12)];
    rig.render();

    ik.reset();
    const a = ik.addChain('priority-a');
    const b = ik.addChain('priority-b');
    if (!a || !b) throw new Error('Could not create IK chains');
    a.priority = 50;
    b.priority = -20;
    priority.ensureAll();

    ik.state.activeChainId = a.id;
    const conflicts = priority.conflictsFor(a).map((item: any) => item.id);
    const order = priority.order().map((item: any) => ({ id: item.id, priority: item.priority }));
    const serialized = ik.serialize();

    return { aId: a.id, bId: b.id, conflicts, order, serialized };
  });

  expect(result.conflicts).toContain(result.bId);
  expect(result.order.map((item) => item.priority)).toEqual([-20, 50]);
  const savedA = result.serialized.chains.find((chain: any) => chain.id === result.aId);
  const savedB = result.serialized.chains.find((chain: any) => chain.id === result.bId);
  expect(savedA.priority).toBe(50);
  expect(savedB.priority).toBe(-20);
});
