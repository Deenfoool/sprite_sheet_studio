let overlay = null;
let initialized = false;

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

const $ = (selector, root = document) => root.querySelector(selector);
const uid = (prefix) => `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const rad = (degrees) => degrees * Math.PI / 180;
const deg = (radians) => radians * 180 / Math.PI;

function ensureStyles() {
  if (document.querySelector('link[data-stable-rig-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './src/rigging.css?v=20260904-lazy1';
  link.dataset.stableRigCss = '1';
  document.head.append(link);
}

function resetState() {
  rig.bones = [{ id: 'root', name: 'Root', parentId: null, x: rig.width / 2, y: rig.height / 2, rotation: -90, length: 80, visible: true }];
  rig.parts = [];
  rig.selectedBoneId = 'root';
  rig.selectedPartId = null;
  rig.drag = null;
}

function boneById(id) { return rig.bones.find((bone) => bone.id === id) || null; }
function partById(id) { return rig.parts.find((part) => part.id === id) || null; }

function rotatePoint(x, y, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: x * c - y * s, y: x * s + y * c };
}

function worldBone(bone, cache = new Map()) {
  if (!bone) return null;
  if (cache.has(bone.id)) return cache.get(bone.id);
  let startX, startY, rotation;
  if (!bone.parentId) {
    startX = bone.x; startY = bone.y; rotation = rad(bone.rotation);
  } else {
    const parent = boneById(bone.parentId);
    const parentWorld = worldBone(parent, cache);
    if (!parentWorld) return null;
    const offset = rotatePoint(bone.x, bone.y, parentWorld.rotation);
    startX = parentWorld.endX + offset.x;
    startY = parentWorld.endY + offset.y;
    rotation = parentWorld.rotation + rad(bone.rotation);
  }
  const result = { startX, startY, rotation, endX: startX + Math.cos(rotation) * bone.length, endY: startY + Math.sin(rotation) * bone.length };
  cache.set(bone.id, result);
  return result;
}

function descendantsOf(id) {
  const result = [];
  const visit = (parentId) => rig.bones.filter((bone) => bone.parentId === parentId).forEach((bone) => { result.push(bone.id); visit(bone.id); });
  visit(id);
  return result;
}

function draw() {
  if (!overlay) return;
  const canvas = $('#rigCanvas', overlay);
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  const cache = new Map();

  [...rig.parts].sort((a, b) => a.z - b.z).forEach((part) => {
    if (!part.visible || !part.canvas) return;
    const bone = boneById(part.boneId);
    const world = bone ? worldBone(bone, cache) : { startX: rig.width / 2, startY: rig.height / 2, rotation: 0 };
    const offset = rotatePoint(part.x, part.y, world.rotation);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, part.opacity));
    ctx.translate(world.startX + offset.x, world.startY + offset.y);
    ctx.rotate(world.rotation + rad(part.rotation));
    ctx.scale(part.scaleX ?? 1, part.scaleY ?? 1);
    ctx.drawImage(part.canvas, -part.pivotX, -part.pivotY);
    ctx.restore();
  });

  rig.bones.forEach((bone) => {
    if (!bone.visible) return;
    const world = worldBone(bone, cache);
    if (!world) return;
    const selected = bone.id === rig.selectedBoneId && !rig.selectedPartId;
    ctx.strokeStyle = selected ? '#56adff' : '#6f8198';
    ctx.fillStyle = selected ? '#1687ff' : '#30445f';
    ctx.lineWidth = selected ? 4 : 3;
    ctx.beginPath(); ctx.moveTo(world.startX, world.startY); ctx.lineTo(world.endX, world.endY); ctx.stroke();
    ctx.beginPath(); ctx.arc(world.startX, world.startY, selected ? 7 : 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = selected ? '#16c79a' : '#8294ab';
    ctx.beginPath(); ctx.arc(world.endX, world.endY, selected ? 7 : 5, 0, Math.PI * 2); ctx.fill();
  });
}

function populateSelect(select, selected, { allowNone = false, exclude = [] } = {}) {
  select.innerHTML = '';
  if (allowNone) {
    const none = document.createElement('option'); none.value = ''; none.textContent = 'None'; select.append(none);
  }
  rig.bones.forEach((bone) => {
    if (exclude.includes(bone.id)) return;
    const option = document.createElement('option'); option.value = bone.id; option.textContent = bone.name; select.append(option);
  });
  select.value = selected || '';
}

function renderTree() {
  const tree = $('#rigTree', overlay); tree.innerHTML = '';
  const renderChildren = (parentId, depth) => {
    rig.bones.filter((bone) => bone.parentId === parentId).forEach((bone) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `rig-tree-item${bone.id === rig.selectedBoneId && !rig.selectedPartId ? ' active' : ''}`;
      button.innerHTML = `<span class="rig-item-main"><span class="rig-tree-indent" style="--indent:${depth * 12}px"></span><span>◆</span><span class="rig-item-name"></span></span><span class="rig-item-meta">${Math.round(bone.length)}px</span>`;
      button.querySelector('.rig-item-name').textContent = bone.name;
      button.addEventListener('click', () => { rig.selectedBoneId = bone.id; rig.selectedPartId = null; renderUi(); draw(); });
      tree.append(button); renderChildren(bone.id, depth + 1);
    });
  };
  renderChildren(null, 0);
}

function thumbCanvas(source) {
  const out = document.createElement('canvas');
  const scale = Math.min(24 / source.width, 24 / source.height, 1);
  out.width = Math.max(1, Math.round(source.width * scale)); out.height = Math.max(1, Math.round(source.height * scale));
  out.getContext('2d').drawImage(source, 0, 0, out.width, out.height);
  return out;
}

function renderParts() {
  const host = $('#rigParts', overlay); host.innerHTML = '';
  $('#rigPartCount', overlay).textContent = `${rig.parts.length} part${rig.parts.length === 1 ? '' : 's'}`;
  if (!rig.parts.length) { host.innerHTML = '<div class="rig-empty">Load transparent PNG/WebP body parts.</div>'; return; }
  [...rig.parts].sort((a,b) => b.z - a.z).forEach((part) => {
    const button = document.createElement('button'); button.type = 'button';
    button.className = `rig-part-item${part.id === rig.selectedPartId ? ' active' : ''}`;
    const main = document.createElement('span'); main.className = 'rig-item-main';
    const thumb = document.createElement('span'); thumb.className = 'rig-part-thumb'; thumb.append(thumbCanvas(part.canvas));
    const name = document.createElement('span'); name.className = 'rig-item-name'; name.textContent = part.name;
    const meta = document.createElement('span'); meta.className = 'rig-item-meta'; meta.textContent = boneById(part.boneId)?.name || 'unbound';
    main.append(thumb, name); button.append(main, meta);
    button.addEventListener('click', () => { rig.selectedPartId = part.id; rig.selectedBoneId = part.boneId || rig.selectedBoneId; renderUi(); draw(); });
    host.append(button);
  });
}

function renderInspector() {
  const bone = boneById(rig.selectedBoneId) || rig.bones[0];
  const part = partById(rig.selectedPartId);
  if (bone) {
    $('#rigBoneName', overlay).value = bone.name;
    populateSelect($('#rigBoneParent', overlay), bone.parentId, { allowNone: true, exclude: [bone.id, ...descendantsOf(bone.id)] });
    $('#rigBoneX', overlay).value = String(Math.round(bone.x * 100) / 100);
    $('#rigBoneY', overlay).value = String(Math.round(bone.y * 100) / 100);
    $('#rigBoneRotation', overlay).value = String(Math.round(bone.rotation * 100) / 100);
    $('#rigBoneLength', overlay).value = String(Math.round(bone.length * 100) / 100);
    $('#rigBoneVisible', overlay).checked = bone.visible !== false;
    $('#rigDeleteBone', overlay).disabled = bone.id === 'root';
    $('#rigBoneParent', overlay).disabled = bone.id === 'root';
  }
  $('#rigPartFields', overlay).hidden = !part;
  $('#rigPartEmpty', overlay).hidden = Boolean(part);
  $('#rigDeletePart', overlay).disabled = !part;
  if (part) {
    $('#rigPartName', overlay).value = part.name;
    populateSelect($('#rigPartBone', overlay), part.boneId, { allowNone: true });
    $('#rigPartX', overlay).value = String(part.x); $('#rigPartY', overlay).value = String(part.y);
    $('#rigPartPivotX', overlay).value = String(part.pivotX); $('#rigPartPivotY', overlay).value = String(part.pivotY);
    $('#rigPartRotation', overlay).value = String(part.rotation); $('#rigPartScaleX', overlay).value = String(part.scaleX ?? 1); $('#rigPartScaleY', overlay).value = String(part.scaleY ?? 1);
    $('#rigPartZ', overlay).value = String(part.z); $('#rigPartOpacity', overlay).value = String(part.opacity); $('#rigPartVisible', overlay).checked = part.visible !== false;
  }
}

function renderUi() { renderTree(); renderParts(); renderInspector(); }

async function fileToCanvas(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0); bitmap.close(); return canvas;
}

async function loadParts(files) {
  for (const file of [...files]) {
    const canvas = await fileToCanvas(file);
    rig.parts.push({ id: uid('part'), name: file.name.replace(/\.[^.]+$/, ''), canvas, boneId: rig.selectedBoneId || 'root', x: 0, y: 0, pivotX: canvas.width / 2, pivotY: canvas.height / 2, rotation: 0, scaleX: 1, scaleY: 1, z: rig.parts.length, opacity: 1, visible: true });
  }
  if (rig.parts.length) rig.selectedPartId = rig.parts.at(-1).id;
  renderUi(); draw();
}

function addBone() {
  const parent = boneById(rig.selectedBoneId) || rig.bones[0];
  const bone = { id: uid('bone'), name: `Bone ${rig.bones.length}`, parentId: parent?.id || 'root', x: 0, y: 0, rotation: 0, length: 60, visible: true };
  rig.bones.push(bone); rig.selectedBoneId = bone.id; rig.selectedPartId = null; renderUi(); draw();
}

function deleteBone() {
  const bone = boneById(rig.selectedBoneId); if (!bone || bone.id === 'root') return;
  rig.bones.filter((item) => item.parentId === bone.id).forEach((item) => { item.parentId = bone.parentId; });
  rig.parts.filter((part) => part.boneId === bone.id).forEach((part) => { part.boneId = bone.parentId || 'root'; });
  rig.bones = rig.bones.filter((item) => item.id !== bone.id); rig.selectedBoneId = bone.parentId || 'root'; rig.selectedPartId = null; renderUi(); draw();
}

function updateBoneFromInputs() {
  const bone = boneById(rig.selectedBoneId); if (!bone) return;
  bone.name = $('#rigBoneName', overlay).value || bone.name;
  if (bone.id !== 'root') bone.parentId = $('#rigBoneParent', overlay).value || null;
  bone.x = Number($('#rigBoneX', overlay).value) || 0; bone.y = Number($('#rigBoneY', overlay).value) || 0;
  bone.rotation = Number($('#rigBoneRotation', overlay).value) || 0; bone.length = Math.max(1, Number($('#rigBoneLength', overlay).value) || 1); bone.visible = $('#rigBoneVisible', overlay).checked;
  renderUi(); draw();
}

function updatePartFromInputs() {
  const part = partById(rig.selectedPartId); if (!part) return;
  part.name = $('#rigPartName', overlay).value || part.name; part.boneId = $('#rigPartBone', overlay).value || null;
  part.x = Number($('#rigPartX', overlay).value) || 0; part.y = Number($('#rigPartY', overlay).value) || 0;
  part.pivotX = Number($('#rigPartPivotX', overlay).value) || 0; part.pivotY = Number($('#rigPartPivotY', overlay).value) || 0;
  part.rotation = Number($('#rigPartRotation', overlay).value) || 0;
  part.scaleX = Number.isFinite(Number($('#rigPartScaleX', overlay).value)) ? Number($('#rigPartScaleX', overlay).value) : 1;
  part.scaleY = Number.isFinite(Number($('#rigPartScaleY', overlay).value)) ? Number($('#rigPartScaleY', overlay).value) : 1;
  part.z = Number($('#rigPartZ', overlay).value) || 0; part.opacity = Math.max(0, Math.min(1, Number($('#rigPartOpacity', overlay).value))); part.visible = $('#rigPartVisible', overlay).checked;
  renderUi(); draw();
}

function deletePart() {
  if (!rig.selectedPartId) return;
  rig.parts = rig.parts.filter((part) => part.id !== rig.selectedPartId); rig.selectedPartId = null; renderUi(); draw();
}

function canvasPoint(event) {
  const canvas = $('#rigCanvas', overlay); const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
}

function hitBone(point) {
  const cache = new Map(); let best = null;
  rig.bones.forEach((bone) => {
    const w = worldBone(bone, cache); if (!w) return;
    const endDistance = Math.hypot(point.x - w.endX, point.y - w.endY);
    const startDistance = Math.hypot(point.x - w.startX, point.y - w.startY);
    if (endDistance < 12 && (!best || endDistance < best.distance)) best = { bone, mode: 'end', distance: endDistance };
    if (startDistance < 10 && (!best || startDistance < best.distance)) best = { bone, mode: 'start', distance: startDistance };
  });
  return best;
}

function pointerDown(event) {
  const hit = hitBone(canvasPoint(event)); if (!hit) return;
  rig.selectedBoneId = hit.bone.id; rig.selectedPartId = null; rig.drag = { boneId: hit.bone.id, mode: hit.mode }; renderUi(); draw();
  $('#rigCanvas', overlay).setPointerCapture?.(event.pointerId);
}

function pointerMove(event) {
  if (!rig.drag) return;
  const bone = boneById(rig.drag.boneId); if (!bone) return;
  const point = canvasPoint(event);
  if (rig.drag.mode === 'end') {
    const world = worldBone(bone); if (!world) return;
    const angle = Math.atan2(point.y - world.startY, point.x - world.startX);
    const parentWorld = bone.parentId ? worldBone(boneById(bone.parentId)) : null;
    bone.rotation = deg(angle - (parentWorld?.rotation || 0));
    bone.length = Math.max(4, Math.hypot(point.x - world.startX, point.y - world.startY));
  } else if (!bone.parentId) {
    bone.x = point.x; bone.y = point.y;
  } else {
    const parentWorld = worldBone(boneById(bone.parentId)); if (!parentWorld) return;
    const local = rotatePoint(point.x - parentWorld.endX, point.y - parentWorld.endY, -parentWorld.rotation);
    bone.x = local.x; bone.y = local.y;
  }
  renderInspector(); draw();
}

function pointerUp() { rig.drag = null; renderUi(); draw(); }

function canvasDataUrl(canvas) { return canvas.toDataURL('image/png'); }
function serialize() {
  return {
    version: 2,
    width: rig.width,
    height: rig.height,
    bones: rig.bones.map((bone) => ({ ...bone })),
    parts: rig.parts.map((part) => ({ id: part.id, name: part.name, boneId: part.boneId, x: part.x, y: part.y, pivotX: part.pivotX, pivotY: part.pivotY, rotation: part.rotation, scaleX: part.scaleX ?? 1, scaleY: part.scaleY ?? 1, z: part.z, opacity: part.opacity, visible: part.visible, png: canvasDataUrl(part.canvas) }))
  };
}

async function canvasFromDataUrl(url) {
  const blob = await (await fetch(url)).blob(); const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height; canvas.getContext('2d').drawImage(bitmap, 0, 0); bitmap.close(); return canvas;
}

async function restore(data) {
  if (!data?.bones) return;
  rig.width = Number(data.width) || 900; rig.height = Number(data.height) || 600;
  rig.bones = data.bones.map((bone) => ({ ...bone })); rig.parts = [];
  for (const raw of data.parts || []) rig.parts.push({ ...raw, canvas: await canvasFromDataUrl(raw.png) });
  rig.selectedBoneId = rig.bones[0]?.id || null; rig.selectedPartId = null;
  const canvas = $('#rigCanvas', overlay); canvas.width = rig.width; canvas.height = rig.height;
  renderUi(); draw();
}

function downloadRig() {
  const blob = new Blob([JSON.stringify(serialize(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'sprite-rig.json'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function createOverlay() {
  ensureStyles();
  overlay = document.createElement('div'); overlay.className = 'rig-overlay hidden';
  overlay.innerHTML = `
    <div class="rig-topbar"><div class="rig-title">Bone Rigging <span class="rig-mode-badge">LAZY</span><small>loaded only on demand</small></div><div class="rig-top-actions"><button class="btn" id="rigLoadParts">Load parts</button><input id="rigPartsInput" type="file" accept="image/png,image/webp" multiple hidden><button class="btn" id="rigExport">Export rig JSON</button><button class="btn danger" id="rigReset">Reset</button><button class="btn primary" id="rigClose">Back to animator</button></div></div>
    <div class="rig-layout">
      <aside class="rig-sidebar"><section class="rig-section"><div class="rig-section-head"><span class="rig-section-title">Skeleton</span><button class="btn" id="rigAddBone">+ Bone</button></div><div class="rig-tree" id="rigTree"></div></section><section class="rig-section"><div class="rig-section-head"><span class="rig-section-title">Sprite parts</span><span class="rig-item-meta" id="rigPartCount">0 parts</span></div><div class="rig-parts" id="rigParts"></div></section></aside>
      <main class="rig-stage"><div class="rig-canvas-wrap"><canvas id="rigCanvas" width="900" height="600"></canvas><div class="rig-hint">Drag bone endpoint to rotate/resize · drag joint to reposition</div></div></main>
      <aside class="rig-inspector">
        <section class="rig-section"><div class="rig-section-head"><span class="rig-section-title">Bone</span><button class="btn rig-danger" id="rigDeleteBone">Delete</button></div><div class="rig-field"><label>Name</label><input id="rigBoneName"></div><div class="rig-field"><label>Parent</label><select id="rigBoneParent"></select></div><div class="rig-two"><div class="rig-field"><label>Offset X</label><input id="rigBoneX" type="number"></div><div class="rig-field"><label>Offset Y</label><input id="rigBoneY" type="number"></div></div><div class="rig-two"><div class="rig-field"><label>Rotation °</label><input id="rigBoneRotation" type="number"></div><div class="rig-field"><label>Length</label><input id="rigBoneLength" type="number" min="1"></div></div><label class="rig-check"><span>Visible</span><input id="rigBoneVisible" type="checkbox" checked></label></section>
        <section class="rig-section"><div class="rig-section-head"><span class="rig-section-title">Sprite attachment</span><button class="btn rig-danger" id="rigDeletePart">Delete</button></div><div class="rig-empty" id="rigPartEmpty">Select a sprite part.</div><div id="rigPartFields" hidden><div class="rig-field"><label>Name</label><input id="rigPartName"></div><div class="rig-field"><label>Attached bone</label><select id="rigPartBone"></select></div><div class="rig-two"><div class="rig-field"><label>Offset X</label><input id="rigPartX" type="number"></div><div class="rig-field"><label>Offset Y</label><input id="rigPartY" type="number"></div></div><div class="rig-two"><div class="rig-field"><label>Pivot X</label><input id="rigPartPivotX" type="number"></div><div class="rig-field"><label>Pivot Y</label><input id="rigPartPivotY" type="number"></div></div><div class="rig-three"><div class="rig-field"><label>Rotation °</label><input id="rigPartRotation" type="number"></div><div class="rig-field"><label>Z order</label><input id="rigPartZ" type="number"></div><div class="rig-field"><label>Opacity</label><input id="rigPartOpacity" type="number" min="0" max="1" step=".05"></div></div><div class="rig-two"><div class="rig-field"><label>Scale X</label><input id="rigPartScaleX" type="number" step=".05"></div><div class="rig-field"><label>Scale Y</label><input id="rigPartScaleY" type="number" step=".05"></div></div><label class="rig-check"><span>Visible</span><input id="rigPartVisible" type="checkbox" checked></label></div></section>
      </aside>
    </div>`;
  document.body.append(overlay);

  $('#rigClose', overlay).addEventListener('click', () => { rig.open = false; overlay.classList.add('hidden'); });
  $('#rigLoadParts', overlay).addEventListener('click', () => $('#rigPartsInput', overlay).click());
  $('#rigPartsInput', overlay).addEventListener('change', (event) => { void loadParts(event.target.files); event.target.value = ''; });
  $('#rigAddBone', overlay).addEventListener('click', addBone); $('#rigDeleteBone', overlay).addEventListener('click', deleteBone); $('#rigDeletePart', overlay).addEventListener('click', deletePart);
  $('#rigExport', overlay).addEventListener('click', downloadRig); $('#rigReset', overlay).addEventListener('click', () => { if (confirm('Reset the rig?')) { resetState(); renderUi(); draw(); } });
  ['rigBoneName','rigBoneParent','rigBoneX','rigBoneY','rigBoneRotation','rigBoneLength','rigBoneVisible'].forEach((id) => $(`#${id}`, overlay).addEventListener('change', updateBoneFromInputs));
  ['rigPartName','rigPartBone','rigPartX','rigPartY','rigPartPivotX','rigPartPivotY','rigPartRotation','rigPartScaleX','rigPartScaleY','rigPartZ','rigPartOpacity','rigPartVisible'].forEach((id) => $(`#${id}`, overlay).addEventListener('change', updatePartFromInputs));
  const canvas = $('#rigCanvas', overlay); canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', pointerMove); canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', pointerUp);
}

export async function open() {
  if (!initialized) {
    initialized = true; resetState(); createOverlay(); renderUi(); draw();
    globalThis.__SSSStableRig = { state: rig, serialize, restore, draw, render: renderUi, open: () => open(), close: () => { rig.open = false; overlay.classList.add('hidden'); } };
  }
  rig.open = true; overlay.classList.remove('hidden'); renderUi(); draw();
  globalThis.lucide?.createIcons?.({ attrs: { 'stroke-width': 2, 'aria-hidden': 'true' } });
}
