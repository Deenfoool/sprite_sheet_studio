(() => {
  const rigApi = globalThis.__SSSRig;
  if (!rigApi) return;

  const DB_NAME = 'sprite-sheet-studio';
  const DB_VERSION = 1;
  const STORE_NAME = 'projects';
  const EXTRAS_KEY = 'last-project-rig-extras';
  let extrasTimer = 0;
  let restoringExtras = false;

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

  function clonePlain(value, fallback = null) {
    try { return JSON.parse(JSON.stringify(value)); } catch { return fallback; }
  }

  function serializeMesh() {
    const mesh = globalThis.__SSSMesh?.state;
    if (!mesh) return null;
    return {
      version: 1,
      enabled: Boolean(mesh.enabled),
      partId: mesh.partId || null,
      cols: Number(mesh.cols) || 5,
      rows: Number(mesh.rows) || 7,
      mode: mesh.mode || 'paint',
      selectedBoneId: mesh.selectedBoneId || 'root',
      selectedVertexIndex: Number(mesh.selectedVertexIndex) || 0,
      brushWeight: Number.isFinite(Number(mesh.brushWeight)) ? Number(mesh.brushWeight) : 1,
      brushRadius: Number.isFinite(Number(mesh.brushRadius)) ? Number(mesh.brushRadius) : 42,
      showWire: mesh.showWire !== false,
      vertices: Array.isArray(mesh.vertices) ? mesh.vertices.map((vertex) => ({
        u: Number(vertex.u) || 0,
        v: Number(vertex.v) || 0,
        offsetX: Number(vertex.offsetX) || 0,
        offsetY: Number(vertex.offsetY) || 0,
        weights: Object.fromEntries(Object.entries(vertex.weights || {}).map(([id, value]) => [id, Number(value) || 0]))
      })) : [],
      triangles: Array.isArray(mesh.triangles) ? mesh.triangles.map((triangle) => triangle.map((index) => Number(index) || 0)) : [],
      bindWorld: clonePlain(mesh.bindWorld, {}),
      bindLocals: clonePlain(mesh.bindLocals, {}),
      bindPart: clonePlain(mesh.bindPart, null)
    };
  }

  function resetMesh() {
    const mesh = globalThis.__SSSMesh?.state;
    if (!mesh) return;
    mesh.enabled = false;
    mesh.partId = null;
    mesh.cols = 5;
    mesh.rows = 7;
    mesh.vertices = [];
    mesh.triangles = [];
    mesh.bindWorld = {};
    mesh.bindLocals = {};
    mesh.bindPart = null;
    mesh.mode = 'paint';
    mesh.selectedBoneId = 'root';
    mesh.selectedVertexIndex = 0;
    mesh.brushWeight = 1;
    mesh.brushRadius = 42;
    mesh.showWire = true;
    mesh.draggingVertex = -1;
    mesh.lastPointer = null;
    const enable = document.querySelector('#meshEnable');
    if (enable instanceof HTMLInputElement) enable.checked = false;
    rigApi.draw();
    globalThis.__SSSMeshTopology?.selectVertex?.(0);
  }

  function restoreMesh(data) {
    const mesh = globalThis.__SSSMesh?.state;
    if (!mesh || !data || data.version !== 1) return;
    const validPart = rigApi.state.parts.some((part) => part.id === data.partId) ? data.partId : (rigApi.state.parts[0]?.id || null);
    const validBone = rigApi.state.bones.some((bone) => bone.id === data.selectedBoneId) ? data.selectedBoneId : (rigApi.state.bones[0]?.id || 'root');
    mesh.enabled = Boolean(data.enabled && validPart);
    mesh.partId = validPart;
    mesh.cols = Math.max(1, Math.min(64, Number(data.cols) || 5));
    mesh.rows = Math.max(1, Math.min(64, Number(data.rows) || 7));
    mesh.mode = data.mode === 'move' ? 'move' : 'paint';
    mesh.selectedBoneId = validBone;
    mesh.selectedVertexIndex = Math.max(0, Number(data.selectedVertexIndex) || 0);
    mesh.brushWeight = Math.max(0, Math.min(1, Number(data.brushWeight ?? 1)));
    mesh.brushRadius = Math.max(1, Number(data.brushRadius) || 42);
    mesh.showWire = data.showWire !== false;
    mesh.vertices = Array.isArray(data.vertices) ? data.vertices.map((vertex) => ({
      u: Number(vertex.u) || 0,
      v: Number(vertex.v) || 0,
      offsetX: Number(vertex.offsetX) || 0,
      offsetY: Number(vertex.offsetY) || 0,
      weights: Object.fromEntries(Object.entries(vertex.weights || {}).filter(([id]) => rigApi.state.bones.some((bone) => bone.id === id)).map(([id, value]) => [id, Math.max(0, Number(value) || 0)]))
    })) : [];
    mesh.triangles = Array.isArray(data.triangles)
      ? data.triangles.filter((triangle) => Array.isArray(triangle) && triangle.length === 3).map((triangle) => triangle.map((index) => Number(index) || 0)).filter((triangle) => triangle.every((index) => index >= 0 && index < mesh.vertices.length) && new Set(triangle).size === 3)
      : [];
    mesh.bindWorld = clonePlain(data.bindWorld, {});
    mesh.bindLocals = clonePlain(data.bindLocals, {});
    mesh.bindPart = clonePlain(data.bindPart, null);
    mesh.draggingVertex = -1;
    mesh.lastPointer = null;

    const enable = document.querySelector('#meshEnable');
    const partSelect = document.querySelector('#meshPart');
    const cols = document.querySelector('#meshCols');
    const rows = document.querySelector('#meshRows');
    const bone = document.querySelector('#meshBone');
    const weight = document.querySelector('#meshWeight');
    const weightNumber = document.querySelector('#meshWeightNumber');
    const radius = document.querySelector('#meshRadius');
    const wire = document.querySelector('#meshWire');
    if (enable instanceof HTMLInputElement) enable.checked = mesh.enabled;
    if (partSelect instanceof HTMLSelectElement && validPart) partSelect.value = validPart;
    if (cols instanceof HTMLInputElement) cols.value = String(mesh.cols);
    if (rows instanceof HTMLInputElement) rows.value = String(mesh.rows);
    if (bone instanceof HTMLSelectElement) bone.value = validBone;
    if (weight instanceof HTMLInputElement) weight.value = String(mesh.brushWeight);
    if (weightNumber instanceof HTMLInputElement) weightNumber.value = String(mesh.brushWeight);
    if (radius instanceof HTMLInputElement) radius.value = String(mesh.brushRadius);
    if (wire instanceof HTMLInputElement) wire.checked = mesh.showWire;

    rigApi.render();
    rigApi.draw();
    globalThis.__SSSMeshTopology?.selectVertex?.(Math.min(mesh.selectedVertexIndex, Math.max(0, mesh.vertices.length - 1)));
  }

  function serializeExtras() {
    return {
      version: 3,
      rigging: serialize(),
      skeletal: globalThis.__SSSSkeletal?.serialize?.() ?? null,
      ik: globalThis.__SSSIK?.serialize?.() ?? null,
      mesh: serializeMesh(),
      savedAt: new Date().toISOString()
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

  async function restoreExtras(extras) {
    if (!extras || ![1, 2, 3].includes(extras.version)) return;
    restoringExtras = true;
    try {
      if (extras.rigging) await restore(extras.rigging);
      if (extras.skeletal) globalThis.__SSSSkeletal?.restore?.(extras.skeletal);
      if (extras.ik) globalThis.__SSSIK?.restore?.(extras.ik);
      else globalThis.__SSSIK?.reset?.();
      if (extras.mesh) restoreMesh(extras.mesh);
      else resetMesh();
    } finally {
      restoringExtras = false;
    }
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
    resetMesh();
    rigApi.render();
    rigApi.draw();
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB failed to open'));
    });
  }

  async function putExtras(value) {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, EXTRAS_KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Rig autosave failed'));
    });
    db.close();
  }

  async function getExtras() {
    const db = await openDb();
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(EXTRAS_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Rig autosave read failed'));
    });
    db.close();
    return result;
  }

  function scheduleExtrasSave() {
    if (restoringExtras) return;
    window.clearTimeout(extrasTimer);
    extrasTimer = window.setTimeout(() => {
      try {
        void putExtras(serializeExtras()).catch((error) => console.error('[Sprite Sheet Studio] rig autosave failed', error));
      } catch (error) {
        console.error('[Sprite Sheet Studio] rig autosave serialization failed', error);
      }
    }, 550);
    globalThis.__SSSProject?.autosave?.();
  }

  function downloadProject(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function projectFileName(data) {
    const name = String(data?.name || 'sprite-project').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'sprite-project';
    return `${name}.sss`;
  }

  document.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!button) return;

    if (button.closest('.top-actions') && button.textContent?.trim() === 'Save .sss') {
      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        const data = globalThis.__SSSProject?.serialized?.();
        if (!data) throw new Error('Project serializer is unavailable.');
        const extras = serializeExtras();
        data.rigging = extras.rigging;
        data.skeletal = extras.skeletal;
        data.ik = extras.ik;
        data.mesh = extras.mesh;
        data.projectFormat = 'sss-full-project';
        downloadProject(data, projectFileName(data));
        void putExtras(extras);
      } catch (error) {
        console.error(error);
        window.alert(`Could not save full .sss project: ${error instanceof Error ? error.message : String(error)}`);
      }
      return;
    }

    if (button.closest('.top-actions') && button.textContent?.trim() === 'New') {
      setTimeout(() => {
        reset();
        globalThis.__SSSSkeletal?.reset?.();
        globalThis.__SSSIK?.reset?.();
        resetMesh();
        scheduleExtrasSave();
      }, 0);
      return;
    }

    if (button.closest('.rig-overlay')) setTimeout(scheduleExtrasSave, 0);
  }, true);

  document.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;

    if (input.matches('.project-file-input')) {
      if (input.dataset.sssExtrasBypass === '1') {
        delete input.dataset.sssExtrasBypass;
        return;
      }

      const file = input.files?.[0];
      if (!file) return;
      event.preventDefault();
      event.stopImmediatePropagation();

      void (async () => {
        try {
          const data = JSON.parse(await file.text());
          const extras = {
            version: 3,
            rigging: data.rigging || data.extensions?.rigging || null,
            skeletal: data.skeletal || data.extensions?.skeletal || null,
            ik: data.ik || data.extensions?.ik || null,
            mesh: data.mesh || data.extensions?.mesh || null
          };

          const status = document.querySelector('.project-status');
          let restored = false;
          const finish = async () => {
            if (restored) return;
            restored = true;
            await restoreExtras(extras);
            await putExtras(serializeExtras());
          };

          let observer = null;
          if (status) {
            observer = new MutationObserver(() => {
              if (!/imported/i.test(status.textContent || '')) return;
              observer?.disconnect();
              void finish();
            });
            observer.observe(status, { childList: true, subtree: true, characterData: true });
          }

          input.dataset.sssExtrasBypass = '1';
          input.dispatchEvent(new Event('change', { bubbles: true }));
          setTimeout(() => {
            observer?.disconnect();
            void finish();
          }, 2500);
        } catch (error) {
          console.error('[Sprite Sheet Studio] extended .sss import failed', error);
          input.dataset.sssExtrasBypass = '1';
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })();
      return;
    }

    if (input.closest('.rig-overlay')) scheduleExtrasSave();
  }, true);

  document.addEventListener('input', (event) => {
    if (event.target instanceof Element && event.target.closest('.rig-overlay')) scheduleExtrasSave();
  });
  document.addEventListener('pointerup', (event) => {
    if (event.target instanceof Element && event.target.closest('.rig-overlay')) scheduleExtrasSave();
  });

  async function restoreAutosavedExtrasWhenReady() {
    const saved = await getExtras().catch(() => null);
    if (!saved) return;

    const status = document.querySelector('.project-status');
    if (!status || /restored|autosave on|autosaved/i.test(status.textContent || '')) {
      await restoreExtras(saved);
      return;
    }

    const observer = new MutationObserver(() => {
      if (!/restored|autosave on|autosaved/i.test(status.textContent || '')) return;
      observer.disconnect();
      void restoreExtras(saved);
    });
    observer.observe(status, { childList: true, subtree: true, characterData: true });
    setTimeout(() => {
      observer.disconnect();
      if (!restoringExtras) void restoreExtras(saved);
    }, 2500);
  }

  globalThis.__SSSRigPersistence = { serialize, restore, reset, serializeExtras, restoreExtras, serializeMesh, restoreMesh, resetMesh };
  void restoreAutosavedExtrasWhenReady();
})();
