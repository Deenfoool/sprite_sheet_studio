(() => {
  const rig = {
    open: false,
    width: 900,
    height: 600,
    bones: [],
    parts: [],
    selectedBoneId: null,
    selectedPartId: null,
    drag: null
  };

  function rigId(prefix) {
    return `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
  }

  function resetRig() {
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
    renderRigUi();
    drawRig();
  }

  function boneById(id) {
    return rig.bones.find((bone) => bone.id === id) || null;
  }

  function partById(id) {
    return rig.parts.find((part) => part.id === id) || null;
  }

  function radians(degrees) {
    return degrees * Math.PI / 180;
  }

  function degrees(radiansValue) {
    return radiansValue * 180 / Math.PI;
  }

  function rotatePoint(x, y, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return { x: x * c - y * s, y: x * s + y * c };
  }

  function worldBone(bone, cache = new Map()) {
    if (!bone) return null;
    if (cache.has(bone.id)) return cache.get(bone.id);
    let startX;
    let startY;
    let rotation;

    if (!bone.parentId) {
      startX = bone.x;
      startY = bone.y;
      rotation = radians(bone.rotation);
    } else {
      const parent = boneById(bone.parentId);
      const parentWorld = worldBone(parent, cache);
      if (!parentWorld) return null;
      const offset = rotatePoint(bone.x, bone.y, parentWorld.rotation);
      startX = parentWorld.endX + offset.x;
      startY = parentWorld.endY + offset.y;
      rotation = parentWorld.rotation + radians(bone.rotation);
    }

    const result = {
      startX,
      startY,
      rotation,
      endX: startX + Math.cos(rotation) * bone.length,
      endY: startY + Math.sin(rotation) * bone.length
    };
    cache.set(bone.id, result);
    return result;
  }

  function descendantsOf(id) {
    const result = [];
    const visit = (parentId) => {
      rig.bones.filter((bone) => bone.parentId === parentId).forEach((child) => {
        result.push(child.id);
        visit(child.id);
      });
    };
    visit(id);
    return result;
  }

  const rigButton = document.createElement('button');
  rigButton.className = 'btn';
  rigButton.textContent = 'Rigging';
  rigButton.title = 'Open Bone Rigging workspace';
  const topActions = document.querySelector('.top-actions');
  topActions.append(rigButton);

  const overlay = document.createElement('div');
  overlay.className = 'rig-overlay hidden';
  overlay.innerHTML = `
    <div class="rig-topbar">
      <div class="rig-title">Bone Rigging <span class="rig-mode-badge">MVP</span><small>parts → bones → hierarchy</small></div>
      <div class="rig-top-actions">
        <button class="btn" id="rigLoadParts">Load parts</button>
        <input id="rigPartsInput" type="file" accept="image/png,image/webp" multiple hidden />
        <button class="btn" id="rigExport">Export rig JSON</button>
        <button class="btn danger" id="rigReset">Reset</button>
        <button class="btn primary" id="rigClose">Back to animator</button>
      </div>
    </div>
    <div class="rig-layout">
      <aside class="rig-sidebar">
        <section class="rig-section">
          <div class="rig-section-head"><span class="rig-section-title">Skeleton</span><button class="btn" id="rigAddBone">+ Bone</button></div>
          <div class="rig-tree" id="rigTree"></div>
        </section>
        <section class="rig-section">
          <div class="rig-section-head"><span class="rig-section-title">Sprite parts</span><span class="rig-item-meta" id="rigPartCount">0 parts</span></div>
          <div class="rig-parts" id="rigParts"></div>
        </section>
      </aside>
      <main class="rig-stage">
        <div class="rig-canvas-wrap">
          <canvas id="rigCanvas" width="900" height="600"></canvas>
          <div class="rig-hint">Drag a bone endpoint to rotate/resize · drag its joint to reposition · select parts in the left panel</div>
        </div>
      </main>
      <aside class="rig-inspector">
        <section class="rig-section" id="rigBoneInspector">
          <div class="rig-section-head"><span class="rig-section-title">Bone</span><button class="btn rig-danger" id="rigDeleteBone">Delete</button></div>
          <div class="rig-field"><label>Name</label><input id="rigBoneName" /></div>
          <div class="rig-field"><label>Parent</label><select id="rigBoneParent"></select></div>
          <div class="rig-two">
            <div class="rig-field"><label>Offset X</label><input id="rigBoneX" type="number" step="1" /></div>
            <div class="rig-field"><label>Offset Y</label><input id="rigBoneY" type="number" step="1" /></div>
          </div>
          <div class="rig-two">
            <div class="rig-field"><label>Rotation °</label><input id="rigBoneRotation" type="number" step="1" /></div>
            <div class="rig-field"><label>Length</label><input id="rigBoneLength" type="number" min="1" step="1" /></div>
          </div>
          <label class="rig-check"><span>Visible</span><input id="rigBoneVisible" type="checkbox" checked /></label>
        </section>
        <section class="rig-section" id="rigPartInspector">
          <div class="rig-section-head"><span class="rig-section-title">Sprite attachment</span><button class="btn rig-danger" id="rigDeletePart">Delete</button></div>
          <div class="rig-empty" id="rigPartEmpty">Select a sprite part to attach it to a bone.</div>
          <div id="rigPartFields" hidden>
            <div class="rig-field"><label>Name</label><input id="rigPartName" /></div>
            <div class="rig-field"><label>Attached bone</label><select id="rigPartBone"></select></div>
            <div class="rig-two">
              <div class="rig-field"><label>Offset X</label><input id="rigPartX" type="number" step="1" /></div>
              <div class="rig-field"><label>Offset Y</label><input id="rigPartY" type="number" step="1" /></div>
            </div>
            <div class="rig-two">
              <div class="rig-field"><label>Pivot X</label><input id="rigPartPivotX" type="number" step="1" /></div>
              <div class="rig-field"><label>Pivot Y</label><input id="rigPartPivotY" type="number" step="1" /></div>
            </div>
            <div class="rig-three">
              <div class="rig-field"><label>Rotation °</label><input id="rigPartRotation" type="number" step="1" /></div>
              <div class="rig-field"><label>Z order</label><input id="rigPartZ" type="number" step="1" /></div>
              <div class="rig-field"><label>Opacity</label><input id="rigPartOpacity" type="number" min="0" max="1" step="0.05" /></div>
            </div>
            <label class="rig-check"><span>Visible</span><input id="rigPartVisible" type="checkbox" checked /></label>
          </div>
        </section>
      </aside>
    </div>`;
  document.body.append(overlay);

  const r = {
    tree: overlay.querySelector('#rigTree'),
    parts: overlay.querySelector('#rigParts'),
    partCount: overlay.querySelector('#rigPartCount'),
    canvas: overlay.querySelector('#rigCanvas'),
    loadParts: overlay.querySelector('#rigLoadParts'),
    partsInput: overlay.querySelector('#rigPartsInput'),
    export: overlay.querySelector('#rigExport'),
    reset: overlay.querySelector('#rigReset'),
    close: overlay.querySelector('#rigClose'),
    addBone: overlay.querySelector('#rigAddBone'),
    deleteBone: overlay.querySelector('#rigDeleteBone'),
    boneName: overlay.querySelector('#rigBoneName'),
    boneParent: overlay.querySelector('#rigBoneParent'),
    boneX: overlay.querySelector('#rigBoneX'),
    boneY: overlay.querySelector('#rigBoneY'),
    boneRotation: overlay.querySelector('#rigBoneRotation'),
    boneLength: overlay.querySelector('#rigBoneLength'),
    boneVisible: overlay.querySelector('#rigBoneVisible'),
    partEmpty: overlay.querySelector('#rigPartEmpty'),
    partFields: overlay.querySelector('#rigPartFields'),
    deletePart: overlay.querySelector('#rigDeletePart'),
    partName: overlay.querySelector('#rigPartName'),
    partBone: overlay.querySelector('#rigPartBone'),
    partX: overlay.querySelector('#rigPartX'),
    partY: overlay.querySelector('#rigPartY'),
    partPivotX: overlay.querySelector('#rigPartPivotX'),
    partPivotY: overlay.querySelector('#rigPartPivotY'),
    partRotation: overlay.querySelector('#rigPartRotation'),
    partZ: overlay.querySelector('#rigPartZ'),
    partOpacity: overlay.querySelector('#rigPartOpacity'),
    partVisible: overlay.querySelector('#rigPartVisible')
  };

  function openRig() {
    rig.open = true;
    overlay.classList.remove('hidden');
    renderRigUi();
    drawRig();
  }

  function closeRig() {
    rig.open = false;
    overlay.classList.add('hidden');
  }

  function renderTree() {
    r.tree.innerHTML = '';
    const renderChildren = (parentId, depth) => {
      rig.bones.filter((bone) => bone.parentId === parentId).forEach((bone) => {
        const button = document.createElement('button');
        button.className = `rig-tree-item${bone.id === rig.selectedBoneId && !rig.selectedPartId ? ' active' : ''}`;
        button.innerHTML = `<span class="rig-item-main"><span class="rig-tree-indent" style="--indent:${depth * 12}px"></span><span>◆</span><span class="rig-item-name">${bone.name}</span></span><span class="rig-item-meta">${Math.round(bone.length)}px</span>`;
        button.addEventListener('click', () => {
          rig.selectedBoneId = bone.id;
          rig.selectedPartId = null;
          renderRigUi();
          drawRig();
        });
        r.tree.append(button);
        renderChildren(bone.id, depth + 1);
      });
    };
    renderChildren(null, 0);
  }

  function renderParts() {
    r.parts.innerHTML = '';
    r.partCount.textContent = `${rig.parts.length} part${rig.parts.length === 1 ? '' : 's'}`;
    if (!rig.parts.length) {
      r.parts.innerHTML = '<div class="rig-empty">Load transparent PNG/WebP body parts: head, torso, arms, legs…</div>';
      return;
    }
    [...rig.parts].sort((a, b) => b.z - a.z).forEach((part) => {
      const button = document.createElement('button');
      button.className = `rig-part-item${part.id === rig.selectedPartId ? ' active' : ''}`;
      const thumb = document.createElement('span');
      thumb.className = 'rig-part-thumb';
      const canvas = document.createElement('canvas');
      canvas.width = part.bitmap.width;
      canvas.height = part.bitmap.height;
      get2d(canvas).drawImage(part.bitmap, 0, 0);
      thumb.append(canvas);
      const main = document.createElement('span');
      main.className = 'rig-item-main';
      main.append(thumb);
      const name = document.createElement('span');
      name.className = 'rig-item-name';
      name.textContent = part.name;
      main.append(name);
      const meta = document.createElement('span');
      meta.className = 'rig-item-meta';
      meta.textContent = boneById(part.boneId)?.name || 'unbound';
      button.append(main, meta);
      button.addEventListener('click', () => {
        rig.selectedPartId = part.id;
        rig.selectedBoneId = part.boneId || rig.selectedBoneId;
        renderRigUi();
        drawRig();
      });
      r.parts.append(button);
    });
  }

  function populateBoneSelect(select, selectedId, allowNone = false, excludeIds = []) {
    select.innerHTML = '';
    if (allowNone) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'None';
      select.append(option);
    }
    rig.bones.forEach((bone) => {
      if (excludeIds.includes(bone.id)) return;
      const option = document.createElement('option');
      option.value = bone.id;
      option.textContent = bone.name;
      select.append(option);
    });
    select.value = selectedId || '';
  }

  function renderInspectors() {
    const bone = boneById(rig.selectedBoneId) || rig.bones[0];
    rig.selectedBoneId = bone?.id || null;
    if (bone) {
      r.boneName.value = bone.name;
      populateBoneSelect(r.boneParent, bone.parentId, true, [bone.id, ...descendantsOf(bone.id)]);
      r.boneX.value = String(Math.round(bone.x * 100) / 100);
      r.boneY.value = String(Math.round(bone.y * 100) / 100);
      r.boneRotation.value = String(Math.round(bone.rotation * 100) / 100);
      r.boneLength.value = String(Math.round(bone.length * 100) / 100);
      r.boneVisible.checked = bone.visible;
      r.deleteBone.disabled = bone.id === 'root';
      r.boneParent.disabled = bone.id === 'root';
    }

    const part = partById(rig.selectedPartId);
    r.partFields.hidden = !part;
    r.partEmpty.hidden = Boolean(part);
    r.deletePart.disabled = !part;
    if (part) {
      r.partName.value = part.name;
      populateBoneSelect(r.partBone, part.boneId, true);
      r.partX.value = String(part.x);
      r.partY.value = String(part.y);
      r.partPivotX.value = String(part.pivotX);
      r.partPivotY.value = String(part.pivotY);
      r.partRotation.value = String(part.rotation);
      r.partZ.value = String(part.z);
      r.partOpacity.value = String(part.opacity);
      r.partVisible.checked = part.visible;
    }
  }

  function renderRigUi() {
    renderTree();
    renderParts();
    renderInspectors();
  }

  function drawPart(ctx, part, cache) {
    if (!part.visible) return;
    const bone = boneById(part.boneId);
    const world = bone ? worldBone(bone, cache) : { startX: rig.width / 2, startY: rig.height / 2, rotation: 0 };
    const offset = rotatePoint(part.x, part.y, world.rotation);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, part.opacity));
    ctx.translate(world.startX + offset.x, world.startY + offset.y);
    ctx.rotate(world.rotation + radians(part.rotation));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(part.bitmap, -part.pivotX, -part.pivotY);
    ctx.restore();
  }

  function drawBone(ctx, bone, cache) {
    if (!bone.visible) return;
    const world = worldBone(bone, cache);
    if (!world) return;
    const selected = bone.id === rig.selectedBoneId && !rig.selectedPartId;
    ctx.save();
    ctx.lineWidth = selected ? 4 : 3;
    ctx.strokeStyle = selected ? '#5ec4ff' : '#63d7b7';
    ctx.fillStyle = selected ? '#d9f2ff' : '#b8f3df';
    ctx.beginPath();
    ctx.moveTo(world.startX, world.startY);
    ctx.lineTo(world.endX, world.endY);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(world.startX, world.startY, selected ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(world.endX, world.endY, selected ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawRig() {
    const ctx = get2d(r.canvas);
    ctx.clearRect(0, 0, rig.width, rig.height);
    const cache = new Map();
    [...rig.parts].sort((a, b) => a.z - b.z).forEach((part) => drawPart(ctx, part, cache));
    rig.bones.forEach((bone) => drawBone(ctx, bone, cache));
  }

  function addBone() {
    const parentId = rig.selectedBoneId || 'root';
    const id = rigId('bone');
    rig.bones.push({
      id,
      name: `Bone ${rig.bones.length}`,
      parentId,
      x: 0,
      y: 0,
      rotation: 0,
      length: 60,
      visible: true
    });
    rig.selectedBoneId = id;
    rig.selectedPartId = null;
    renderRigUi();
    drawRig();
  }

  function deleteBone() {
    const bone = boneById(rig.selectedBoneId);
    if (!bone || bone.id === 'root') return;
    const ids = new Set([bone.id, ...descendantsOf(bone.id)]);
    rig.bones = rig.bones.filter((item) => !ids.has(item.id));
    rig.parts.forEach((part) => { if (ids.has(part.boneId)) part.boneId = 'root'; });
    rig.selectedBoneId = bone.parentId || 'root';
    rig.selectedPartId = null;
    renderRigUi();
    drawRig();
  }

  async function loadParts(files) {
    const images = Array.from(files).filter((file) => /^image\/(png|webp)$/i.test(file.type));
    for (const file of images) {
      const bitmap = await createImageBitmap(file);
      const selectedBone = boneById(rig.selectedBoneId) || boneById('root');
      rig.parts.push({
        id: rigId('part'),
        name: file.name.replace(/\.[^.]+$/, ''),
        sourceName: file.name,
        bitmap,
        boneId: selectedBone?.id || 'root',
        x: 0,
        y: 0,
        pivotX: Math.round(bitmap.width / 2),
        pivotY: Math.round(bitmap.height / 2),
        rotation: 0,
        z: rig.parts.length,
        opacity: 1,
        visible: true
      });
    }
    if (images.length) rig.selectedPartId = rig.parts[rig.parts.length - 1].id;
    renderRigUi();
    drawRig();
    toast(`${images.length} rig part${images.length === 1 ? '' : 's'} loaded`);
  }

  function deletePart() {
    const part = partById(rig.selectedPartId);
    if (!part) return;
    part.bitmap.close?.();
    rig.parts = rig.parts.filter((item) => item.id !== part.id);
    rig.selectedPartId = null;
    renderRigUi();
    drawRig();
  }

  function exportRig() {
    const data = {
      version: 1,
      app: 'Sprite Sheet Studio',
      canvas: { width: rig.width, height: rig.height },
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
        z: part.z,
        opacity: part.opacity,
        visible: part.visible,
        width: part.bitmap.width,
        height: part.bitmap.height
      }))
    };
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'sprite-rig.json');
    toast('Rig JSON exported');
  }

  function canvasPoint(event) {
    const rect = r.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (r.canvas.width / rect.width),
      y: (event.clientY - rect.top) * (r.canvas.height / rect.height)
    };
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function hitBone(point) {
    const cache = new Map();
    for (let index = rig.bones.length - 1; index >= 0; index -= 1) {
      const bone = rig.bones[index];
      const world = worldBone(bone, cache);
      if (!world || !bone.visible) continue;
      if (distance(point, { x: world.endX, y: world.endY }) <= 12) return { bone, mode: 'end' };
      if (distance(point, { x: world.startX, y: world.startY }) <= 12) return { bone, mode: 'start' };
    }
    return null;
  }

  function updateDrag(point) {
    if (!rig.drag) return;
    const bone = boneById(rig.drag.boneId);
    if (!bone) return;
    const cache = new Map();
    const world = worldBone(bone, cache);
    if (!world) return;

    if (rig.drag.mode === 'end') {
      const angleWorld = Math.atan2(point.y - world.startY, point.x - world.startX);
      let parentRotation = 0;
      if (bone.parentId) parentRotation = worldBone(boneById(bone.parentId), cache)?.rotation || 0;
      bone.rotation = degrees(angleWorld - parentRotation);
      bone.length = Math.max(4, Math.hypot(point.x - world.startX, point.y - world.startY));
    } else if (!bone.parentId) {
      bone.x = point.x;
      bone.y = point.y;
    } else {
      const parentWorld = worldBone(boneById(bone.parentId), cache);
      if (!parentWorld) return;
      const delta = { x: point.x - parentWorld.endX, y: point.y - parentWorld.endY };
      const local = rotatePoint(delta.x, delta.y, -parentWorld.rotation);
      bone.x = local.x;
      bone.y = local.y;
    }
    renderInspectors();
    drawRig();
  }

  function bindBoneInputs() {
    const update = () => {
      const bone = boneById(rig.selectedBoneId);
      if (!bone) return;
      bone.name = r.boneName.value.trim() || bone.name;
      if (bone.id !== 'root') bone.parentId = r.boneParent.value || null;
      bone.x = Number(r.boneX.value) || 0;
      bone.y = Number(r.boneY.value) || 0;
      bone.rotation = Number(r.boneRotation.value) || 0;
      bone.length = Math.max(1, Number(r.boneLength.value) || 1);
      bone.visible = r.boneVisible.checked;
      renderTree();
      renderParts();
      drawRig();
    };
    [r.boneName, r.boneParent, r.boneX, r.boneY, r.boneRotation, r.boneLength, r.boneVisible].forEach((input) => input.addEventListener('input', update));
    r.boneParent.addEventListener('change', update);
  }

  function bindPartInputs() {
    const update = () => {
      const part = partById(rig.selectedPartId);
      if (!part) return;
      part.name = r.partName.value.trim() || part.name;
      part.boneId = r.partBone.value || 'root';
      part.x = Number(r.partX.value) || 0;
      part.y = Number(r.partY.value) || 0;
      part.pivotX = Number(r.partPivotX.value) || 0;
      part.pivotY = Number(r.partPivotY.value) || 0;
      part.rotation = Number(r.partRotation.value) || 0;
      part.z = Number(r.partZ.value) || 0;
      part.opacity = Math.max(0, Math.min(1, Number(r.partOpacity.value)));
      part.visible = r.partVisible.checked;
      renderParts();
      drawRig();
    };
    [r.partName, r.partBone, r.partX, r.partY, r.partPivotX, r.partPivotY, r.partRotation, r.partZ, r.partOpacity, r.partVisible].forEach((input) => input.addEventListener('input', update));
    r.partBone.addEventListener('change', update);
  }

  rigButton.addEventListener('click', openRig);
  r.close.addEventListener('click', closeRig);
  r.addBone.addEventListener('click', addBone);
  r.deleteBone.addEventListener('click', deleteBone);
  r.loadParts.addEventListener('click', () => r.partsInput.click());
  r.partsInput.addEventListener('change', () => {
    if (r.partsInput.files?.length) void loadParts(r.partsInput.files);
    r.partsInput.value = '';
  });
  r.deletePart.addEventListener('click', deletePart);
  r.export.addEventListener('click', exportRig);
  r.reset.addEventListener('click', () => { if (window.confirm('Reset the current rig?')) resetRig(); });

  r.canvas.addEventListener('pointerdown', (event) => {
    const point = canvasPoint(event);
    const hit = hitBone(point);
    if (!hit) return;
    rig.selectedBoneId = hit.bone.id;
    rig.selectedPartId = null;
    rig.drag = { boneId: hit.bone.id, mode: hit.mode };
    r.canvas.setPointerCapture(event.pointerId);
    renderRigUi();
    drawRig();
  });
  r.canvas.addEventListener('pointermove', (event) => {
    if (rig.drag) updateDrag(canvasPoint(event));
  });
  const stopDrag = (event) => {
    if (!rig.drag) return;
    rig.drag = null;
    try { r.canvas.releasePointerCapture(event.pointerId); } catch {}
  };
  r.canvas.addEventListener('pointerup', stopDrag);
  r.canvas.addEventListener('pointercancel', stopDrag);

  bindBoneInputs();
  bindPartInputs();
  resetRig();
})();