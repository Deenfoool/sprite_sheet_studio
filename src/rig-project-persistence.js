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

  function serializeExtras() {
    return {
      version: 2,
      rigging: serialize(),
      skeletal: globalThis.__SSSSkeletal?.serialize?.() ?? null,
      ik: globalThis.__SSSIK?.serialize?.() ?? null,
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
    if (!extras || ![1, 2].includes(extras.version)) return;
    restoringExtras = true;
    try {
      if (extras.rigging) await restore(extras.rigging);
      if (extras.skeletal) globalThis.__SSSSkeletal?.restore?.(extras.skeletal);
      if (extras.ik) globalThis.__SSSIK?.restore?.(extras.ik);
      else globalThis.__SSSIK?.reset?.();
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
            version: 2,
            rigging: data.rigging || data.extensions?.rigging || null,
            skeletal: data.skeletal || data.extensions?.skeletal || null,
            ik: data.ik || data.extensions?.ik || null
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

  globalThis.__SSSRigPersistence = { serialize, restore, reset, serializeExtras, restoreExtras };
  void restoreAutosavedExtrasWhenReady();
})();
