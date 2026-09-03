(() => {
  const rigApi = globalThis.__SSSRig;
  if (!rigApi) return;

  function bitmapDataUrl(part) {
    if (part.dataUrl) return part.dataUrl;
    const bitmap = part.bitmap;
    if (!bitmap) return null;
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, 0, 0);
    part.dataUrl = canvas.toDataURL('image/png');
    return part.dataUrl;
  }

  function serialize() {
    const rig = rigApi.state;
    return {
      version: 1,
      canvas: { width: rig.width, height: rig.height },
      selectedBoneId: rig.selectedBoneId,
      selectedPartId: rig.selectedPartId,
      bones: rig.bones.map((bone) => ({ ...bone })),
      parts: rig.parts.map((part) => ({
        id: part.id,
        name: part.name,
        sourceName: part.sourceName,
        boneId: part.boneId,
        x: part.x,
        y: part.y,
        pivotX: part.pivotX,
        pivotY: part.pivotY,
        rotation: part.rotation,
        scaleX: part.scaleX ?? 1,
        scaleY: part.scaleY ?? 1,
        z: part.z,
        opacity: part.opacity,
        visible: part.visible,
        image: bitmapDataUrl(part)
      }))
    };
  }

  async function bitmapFromDataUrl(dataUrl) {
    const response = await fetch(dataUrl);
    if (!response.ok) throw new Error(`Could not decode rig asset: HTTP ${response.status}`);
    const blob = await response.blob();
    return createImageBitmap(blob);
  }

  async function restore(data) {
    if (!data || data.version !== 1) return;
    const rig = rigApi.state;

    rig.parts.forEach((part) => part.bitmap?.close?.());
    rig.width = Math.max(1, Number(data.canvas?.width) || 900);
    rig.height = Math.max(1, Number(data.canvas?.height) || 600);
    rig.bones = Array.isArray(data.bones) && data.bones.length
      ? data.bones.map((bone) => ({ ...bone }))
      : [{ id: 'root', name: 'Root', parentId: null, x: rig.width / 2, y: rig.height / 2, rotation: -90, length: 80, visible: true }];
    rig.parts = [];

    for (const raw of Array.isArray(data.parts) ? data.parts : []) {
      if (!raw.image) continue;
      try {
        const bitmap = await bitmapFromDataUrl(raw.image);
        rig.parts.push({
          id: raw.id || `part-${crypto.randomUUID?.() || Math.random()}`,
          name: raw.name || 'part',
          sourceName: raw.sourceName || `${raw.name || 'part'}.png`,
          bitmap,
          dataUrl: raw.image,
          boneId: rig.bones.some((bone) => bone.id === raw.boneId) ? raw.boneId : 'root',
          x: Number(raw.x) || 0,
          y: Number(raw.y) || 0,
          pivotX: Number(raw.pivotX) || 0,
          pivotY: Number(raw.pivotY) || 0,
          rotation: Number(raw.rotation) || 0,
          scaleX: Number.isFinite(Number(raw.scaleX)) ? Number(raw.scaleX) : 1,
          scaleY: Number.isFinite(Number(raw.scaleY)) ? Number(raw.scaleY) : 1,
          z: Number(raw.z) || 0,
          opacity: Math.max(0, Math.min(1, Number(raw.opacity ?? 1))),
          visible: raw.visible !== false
        });
      } catch (error) {
        console.error('[Sprite Sheet Studio] failed to restore rig part', raw.name, error);
      }
    }

    rig.selectedBoneId = rig.bones.some((bone) => bone.id === data.selectedBoneId) ? data.selectedBoneId : (rig.bones[0]?.id || null);
    rig.selectedPartId = rig.parts.some((part) => part.id === data.selectedPartId) ? data.selectedPartId : null;
    rigApi.render();
    rigApi.draw();
  }

  function reset() {
    const rig = rigApi.state;
    rig.parts.forEach((part) => part.bitmap?.close?.());
    rig.width = 900;
    rig.height = 600;
    rig.bones = [{
      id: 'root',
      name: 'Root',
      parentId: null,
      x: rig.width / 2,
      y: rig.height / 2,
      rotation: -90,
      length: 80,
      visible: true
    }];
    rig.parts = [];
    rig.selectedBoneId = 'root';
    rig.selectedPartId = null;
    rigApi.render();
    rigApi.draw();
  }

  function scheduleProjectSave() {
    globalThis.__SSSProject?.autosave?.();
  }

  document.addEventListener('input', (event) => {
    if (event.target instanceof Element && event.target.closest('.rig-overlay')) scheduleProjectSave();
  });
  document.addEventListener('change', (event) => {
    if (event.target instanceof Element && event.target.closest('.rig-overlay')) scheduleProjectSave();
  });
  document.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('.rig-overlay button')) setTimeout(scheduleProjectSave, 0);
  });
  document.addEventListener('pointerup', (event) => {
    if (event.target instanceof Element && event.target.closest('.rig-overlay')) scheduleProjectSave();
  });

  globalThis.__SSSRigPersistence = { serialize, restore, reset };
})();
