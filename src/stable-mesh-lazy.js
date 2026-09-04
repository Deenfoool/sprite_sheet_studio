let initialized = false;
let panel = null;
let meshCanvas = null;
let originalRigDraw = null;
let selectedVertex = -1;
let selectedWeightBoneId = null;
let activePartId = null;
let previousPartVisibility = null;

const mesh = {
  enabled: false,
  cols: 5,
  rows: 5,
  vertices: [],
  triangles: [],
  weights: [],
  bindBones: {},
  bindPart: null,
  showWire: true
};

const $ = (selector, root = document) => root.querySelector(selector);
const rad = (degrees) => degrees * Math.PI / 180;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const cloneData = (value) => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));

async function ensureRig() {
  if (!globalThis.__SSSStableRig) {
    const module = await import('./stable-rig-lazy.js?v=20260904-lazy4');
    await module.open();
  }
  return globalThis.__SSSStableRig;
}

function rig() {
  const api = globalThis.__SSSStableRig;
  if (!api) throw new Error('Rigging workspace is unavailable.');
  return api;
}

function boneById(id) { return rig().state.bones.find((bone) => bone.id === id) || null; }
function partById(id) { return rig().state.parts.find((part) => part.id === id) || null; }

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
    const parentWorld = worldBone(boneById(bone.parentId), cache);
    if (!parentWorld) return null;
    const offset = rotatePoint(bone.x, bone.y, parentWorld.rotation);
    startX = parentWorld.endX + offset.x; startY = parentWorld.endY + offset.y; rotation = parentWorld.rotation + rad(bone.rotation);
  }
  const result = { startX, startY, rotation, endX: startX + Math.cos(rotation) * bone.length, endY: startY + Math.sin(rotation) * bone.length };
  cache.set(bone.id, result); return result;
}

function partWorld(part) {
  const bone = boneById(part.boneId);
  const bw = bone ? worldBone(bone) : { startX: rig().state.width / 2, startY: rig().state.height / 2, rotation: 0 };
  const offset = rotatePoint(part.x, part.y, bw.rotation);
  return { x: bw.startX + offset.x, y: bw.startY + offset.y, rotation: bw.rotation + rad(part.rotation), scaleX: part.scaleX ?? 1, scaleY: part.scaleY ?? 1 };
}

function partPointToWorld(part, u, v, transform = partWorld(part)) {
  const local = rotatePoint((u - part.pivotX) * transform.scaleX, (v - part.pivotY) * transform.scaleY, transform.rotation);
  return { x: transform.x + local.x, y: transform.y + local.y };
}

function captureBind() {
  const part = partById(activePartId);
  if (!part) throw new Error('Select a sprite part in Rigging first.');
  mesh.bindBones = {};
  rig().state.bones.forEach((bone) => {
    const world = worldBone(bone);
    if (world) mesh.bindBones[bone.id] = { startX: world.startX, startY: world.startY, rotation: world.rotation };
  });
  mesh.bindPart = {
    boneId: part.boneId, x: part.x, y: part.y, pivotX: part.pivotX, pivotY: part.pivotY,
    rotation: part.rotation, scaleX: part.scaleX ?? 1, scaleY: part.scaleY ?? 1
  };
}

function generateGrid() {
  const part = partById(activePartId);
  if (!part) throw new Error('Select a sprite part first.');
  mesh.cols = clamp(Number($('#stableMeshCols', panel)?.value) || 5, 2, 16);
  mesh.rows = clamp(Number($('#stableMeshRows', panel)?.value) || 5, 2, 16);
  mesh.vertices = [];
  mesh.triangles = [];
  for (let y = 0; y < mesh.rows; y += 1) {
    for (let x = 0; x < mesh.cols; x += 1) {
      mesh.vertices.push({ u: x / (mesh.cols - 1) * part.canvas.width, v: y / (mesh.rows - 1) * part.canvas.height });
    }
  }
  for (let y = 0; y < mesh.rows - 1; y += 1) {
    for (let x = 0; x < mesh.cols - 1; x += 1) {
      const a = y * mesh.cols + x, b = a + 1, c = a + mesh.cols, d = c + 1;
      if ((x + y) % 2 === 0) mesh.triangles.push([a,b,d],[a,d,c]);
      else mesh.triangles.push([a,b,c],[b,d,c]);
    }
  }
  captureBind();
  autoWeights();
  selectedVertex = mesh.vertices.length ? 0 : -1;
  selectedWeightBoneId = rig().state.bones[0]?.id || null;
  mesh.enabled = true;
  hideOriginalPart(true);
  updatePointerMode();
  renderUi(); renderMesh();
}

function bindWorldPoint(vertex) {
  const part = partById(activePartId);
  if (!part || !mesh.bindPart) return { x: vertex.u, y: vertex.v };
  const raw = { ...part, ...mesh.bindPart };
  const bone = boneById(raw.boneId);
  const bw = bone ? mesh.bindBones[bone.id] : { startX: rig().state.width / 2, startY: rig().state.height / 2, rotation: 0 };
  const offset = rotatePoint(raw.x, raw.y, bw?.rotation || 0);
  const transform = { x: (bw?.startX || 0) + offset.x, y: (bw?.startY || 0) + offset.y, rotation: (bw?.rotation || 0) + rad(raw.rotation), scaleX: raw.scaleX ?? 1, scaleY: raw.scaleY ?? 1 };
  return partPointToWorld(raw, vertex.u, vertex.v, transform);
}

function autoWeights() {
  if (!mesh.vertices.length) return;
  const bones = rig().state.bones.map((bone) => ({ bone, bind: mesh.bindBones[bone.id] })).filter((item) => item.bind);
  mesh.weights = mesh.vertices.map((vertex) => {
    const world = bindWorldPoint(vertex);
    const ranked = bones.map(({ bone, bind }) => ({ boneId: bone.id, distance: Math.hypot(world.x - bind.startX, world.y - bind.startY) })).sort((a,b) => a.distance - b.distance).slice(0,2);
    if (!ranked.length) return {};
    if (ranked.length === 1) return { [ranked[0].boneId]: 1 };
    const a = 1 / Math.max(1, ranked[0].distance), b = 1 / Math.max(1, ranked[1].distance), sum = a + b;
    return { [ranked[0].boneId]: a / sum, [ranked[1].boneId]: b / sum };
  });
  renderUi(); renderMesh();
}

function normalizedWeights(raw) {
  const entries = Object.entries(raw || {}).filter(([, weight]) => Number(weight) > .0001).sort((a,b) => b[1] - a[1]).slice(0,4);
  const total = entries.reduce((sum, [,weight]) => sum + Number(weight), 0);
  if (!total) return {};
  return Object.fromEntries(entries.map(([id, weight]) => [id, Number(weight) / total]));
}

function deformedVertex(index) {
  const vertex = mesh.vertices[index];
  const base = bindWorldPoint(vertex);
  const weights = normalizedWeights(mesh.weights[index]);
  const entries = Object.entries(weights);
  if (!entries.length) return base;
  let x = 0, y = 0, total = 0;
  entries.forEach(([boneId, weight]) => {
    const bind = mesh.bindBones[boneId], current = worldBone(boneById(boneId));
    if (!bind || !current) return;
    const local = rotatePoint(base.x - bind.startX, base.y - bind.startY, -bind.rotation);
    const moved = rotatePoint(local.x, local.y, current.rotation);
    x += (current.startX + moved.x) * weight; y += (current.startY + moved.y) * weight; total += weight;
  });
  return total ? { x: x / total, y: y / total } : base;
}

function triangleTransform(src, dst) {
  const [s0,s1,s2] = src, [d0,d1,d2] = dst;
  const det = s0.u * (s1.v - s2.v) + s1.u * (s2.v - s0.v) + s2.u * (s0.v - s1.v);
  if (Math.abs(det) < 1e-6) return null;
  const a = (d0.x * (s1.v - s2.v) + d1.x * (s2.v - s0.v) + d2.x * (s0.v - s1.v)) / det;
  const c = (d0.x * (s2.u - s1.u) + d1.x * (s0.u - s2.u) + d2.x * (s1.u - s0.u)) / det;
  const e = (d0.x * (s1.u * s2.v - s2.u * s1.v) + d1.x * (s2.u * s0.v - s0.u * s2.v) + d2.x * (s0.u * s1.v - s1.u * s0.v)) / det;
  const b = (d0.y * (s1.v - s2.v) + d1.y * (s2.v - s0.v) + d2.y * (s0.v - s1.v)) / det;
  const d = (d0.y * (s2.u - s1.u) + d1.y * (s0.u - s2.u) + d2.y * (s1.u - s0.u)) / det;
  const f = (d0.y * (s1.u * s2.v - s2.u * s1.v) + d1.y * (s2.u * s0.v - s0.u * s2.v) + d2.y * (s0.u * s1.v - s1.u * s0.v)) / det;
  return { a,b,c,d,e,f };
}

function renderMesh() {
  if (!meshCanvas) return;
  const ctx = meshCanvas.getContext('2d');
  ctx.clearRect(0, 0, meshCanvas.width, meshCanvas.height);
  if (!mesh.enabled || !activePartId || !mesh.vertices.length) return;
  const part = partById(activePartId); if (!part) return;
  const dest = mesh.vertices.map((_, index) => deformedVertex(index));

  mesh.triangles.forEach((tri) => {
    const src = tri.map((index) => mesh.vertices[index]);
    const dst = tri.map((index) => dest[index]);
    const m = triangleTransform(src, dst); if (!m) return;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(dst[0].x, dst[0].y); ctx.lineTo(dst[1].x, dst[1].y); ctx.lineTo(dst[2].x, dst[2].y); ctx.closePath(); ctx.clip();
    ctx.setTransform(m.a,m.b,m.c,m.d,m.e,m.f); ctx.imageSmoothingEnabled = false; ctx.drawImage(part.canvas,0,0); ctx.restore();
  });

  if (mesh.showWire) {
    ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.strokeStyle = 'rgba(80,190,255,.7)'; ctx.lineWidth = 1;
    mesh.triangles.forEach((tri) => { ctx.beginPath(); tri.forEach((index,i) => { const p = dest[index]; if (i) ctx.lineTo(p.x,p.y); else ctx.moveTo(p.x,p.y); }); ctx.closePath(); ctx.stroke(); });
    dest.forEach((point,index) => { ctx.fillStyle = index === selectedVertex ? '#16c79a' : '#8fd1ff'; ctx.beginPath(); ctx.arc(point.x,point.y,index === selectedVertex ? 5 : 3,0,Math.PI*2); ctx.fill(); });
    ctx.restore();
  }
}

function hideOriginalPart(hide) {
  const part = partById(activePartId); if (!part) return;
  if (hide) {
    if (previousPartVisibility === null) previousPartVisibility = part.visible !== false;
    part.visible = false;
  } else if (previousPartVisibility !== null) {
    part.visible = previousPartVisibility; previousPartVisibility = null;
  }
  if (originalRigDraw) originalRigDraw();
}

function selectCurrentPart() {
  const selected = rig().state.selectedPartId;
  if (!selected) throw new Error('Select a sprite part in the Rigging left panel first.');
  if (activePartId && activePartId !== selected) hideOriginalPart(false);
  activePartId = selected; mesh.enabled = false; mesh.vertices = []; mesh.triangles = []; mesh.weights = []; mesh.bindBones = {}; mesh.bindPart = null; selectedVertex = -1; selectedWeightBoneId = rig().state.bones[0]?.id || null; previousPartVisibility = null;
  updatePointerMode(); renderUi(); renderMesh();
}

function canvasPoint(event) {
  const rect = meshCanvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * meshCanvas.width / rect.width, y: (event.clientY - rect.top) * meshCanvas.height / rect.height };
}

function pointerDown(event) {
  if (!mesh.enabled || !mesh.showWire) return;
  const point = canvasPoint(event); let best = -1, distance = 14;
  mesh.vertices.forEach((_,index) => { const p = deformedVertex(index), d = Math.hypot(point.x-p.x,point.y-p.y); if (d < distance) { distance = d; best = index; } });
  if (best >= 0) { selectedVertex = best; renderUi(); renderMesh(); }
}

function updatePointerMode() {
  if (!meshCanvas) return;
  meshCanvas.style.pointerEvents = mesh.enabled && mesh.showWire ? 'auto' : 'none';
  meshCanvas.style.cursor = mesh.enabled && mesh.showWire ? 'crosshair' : 'default';
}

function renderUi() {
  if (!panel) return;
  const part = partById(activePartId);
  $('[data-mesh-part]', panel).textContent = part ? part.name : 'No part selected';
  $('#stableMeshCols', panel).value = String(mesh.cols); $('#stableMeshRows', panel).value = String(mesh.rows); $('#stableMeshWire', panel).checked = mesh.showWire;
  const vertexInfo = $('[data-mesh-vertex]', panel); vertexInfo.textContent = selectedVertex >= 0 ? `Vertex ${selectedVertex + 1} / ${mesh.vertices.length}` : 'No vertex selected';
  const boneSelect = $('#stableMeshBone', panel);
  const validIds = new Set(rig().state.bones.map((bone) => bone.id));
  if (!selectedWeightBoneId || !validIds.has(selectedWeightBoneId)) selectedWeightBoneId = rig().state.bones[0]?.id || null;
  boneSelect.innerHTML = '';
  rig().state.bones.forEach((bone) => { const option = document.createElement('option'); option.value = bone.id; option.textContent = bone.name; boneSelect.append(option); });
  boneSelect.value = selectedWeightBoneId || '';
  const weight = selectedVertex >= 0 && selectedWeightBoneId ? Number(mesh.weights[selectedVertex]?.[selectedWeightBoneId] || 0) : 0;
  $('#stableMeshWeight', panel).value = String(Math.round(weight*1000)/1000);
  $('[data-mesh-counts]', panel).textContent = `${mesh.vertices.length} vertices · ${mesh.triangles.length} triangles`;
}

function updateWeight() {
  if (selectedVertex < 0) return;
  const boneId = selectedWeightBoneId || $('#stableMeshBone', panel).value; if (!boneId) return;
  const weight = clamp(Number($('#stableMeshWeight', panel).value) || 0,0,1);
  mesh.weights[selectedVertex] ||= {}; mesh.weights[selectedVertex][boneId] = weight; mesh.weights[selectedVertex] = normalizedWeights(mesh.weights[selectedVertex]);
  renderUi(); renderMesh();
}

function serialize() {
  return { version: 2, activePartId, selectedWeightBoneId, enabled: mesh.enabled, cols: mesh.cols, rows: mesh.rows, vertices: mesh.vertices, triangles: mesh.triangles, weights: mesh.weights, bindBones: mesh.bindBones, bindPart: mesh.bindPart, showWire: mesh.showWire };
}

function restore(data) {
  if (!data) return;
  if (activePartId && activePartId !== data.activePartId) hideOriginalPart(false);
  activePartId = data.activePartId || null; selectedWeightBoneId = data.selectedWeightBoneId || null; mesh.enabled = Boolean(data.enabled); mesh.cols = Number(data.cols)||5; mesh.rows = Number(data.rows)||5;
  mesh.vertices = (data.vertices||[]).map((v)=>({...v})); mesh.triangles = (data.triangles||[]).map((t)=>[...t]); mesh.weights = (data.weights||[]).map((w)=>({...w})); mesh.bindBones = cloneData(data.bindBones||{}); mesh.bindPart = data.bindPart ? {...data.bindPart}:null; mesh.showWire = data.showWire !== false;
  if (mesh.enabled) hideOriginalPart(true); updatePointerMode(); renderUi(); renderMesh();
}

function createUi() {
  const inspector = document.querySelector('.rig-inspector'); const wrap = document.querySelector('.rig-canvas-wrap'); const rigCanvas = document.querySelector('#rigCanvas');
  if (!inspector || !wrap || !(rigCanvas instanceof HTMLCanvasElement)) throw new Error('Rigging UI is incomplete.');
  panel = document.createElement('section'); panel.className = 'rig-section'; panel.dataset.stableMeshPanel = '1';
  panel.innerHTML = `
    <div class="rig-section-head"><span class="rig-section-title">Mesh Deformation</span><span class="rig-mode-badge">LAZY MESH</span></div>
    <div class="rig-empty" data-mesh-part>No part selected</div>
    <button class="btn" id="stableMeshUsePart">Use selected part</button>
    <div class="rig-two" style="margin-top:8px"><div class="rig-field"><label>Grid columns</label><input id="stableMeshCols" type="number" min="2" max="16" value="5"></div><div class="rig-field"><label>Grid rows</label><input id="stableMeshRows" type="number" min="2" max="16" value="5"></div></div>
    <div class="rig-two"><button class="btn" id="stableMeshGenerate">Generate grid</button><button class="btn" id="stableMeshAutoWeight">Auto weights</button></div>
    <label class="rig-check"><span>Wireframe / pick vertices</span><input id="stableMeshWire" type="checkbox" checked></label>
    <div class="rig-empty">Turn wireframe off to pass pointer input through to the bone rig.</div>
    <div class="rig-empty" data-mesh-counts>0 vertices · 0 triangles</div>
    <div class="rig-empty" data-mesh-vertex>No vertex selected</div>
    <div class="rig-field"><label>Bone weight</label><select id="stableMeshBone"></select></div><div class="rig-field"><label>Weight 0..1</label><input id="stableMeshWeight" type="number" min="0" max="1" step=".05" value="0"></div>
    <button class="btn" id="stableMeshApplyWeight">Apply weight</button>
    <button class="btn rig-danger" id="stableMeshDisable" style="margin-top:8px">Disable mesh preview</button>`;
  inspector.append(panel);

  meshCanvas = document.createElement('canvas'); meshCanvas.width = rigCanvas.width; meshCanvas.height = rigCanvas.height; meshCanvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;z-index:4;touch-action:none'; wrap.append(meshCanvas); meshCanvas.addEventListener('pointerdown',pointerDown);

  $('#stableMeshUsePart',panel).addEventListener('click',()=>{ try{selectCurrentPart();}catch(error){$('[data-mesh-part]',panel).textContent=error.message;} });
  $('#stableMeshGenerate',panel).addEventListener('click',()=>{ try{if(!activePartId)selectCurrentPart();generateGrid();}catch(error){$('[data-mesh-part]',panel).textContent=error.message;} });
  $('#stableMeshAutoWeight',panel).addEventListener('click',autoWeights);
  $('#stableMeshWire',panel).addEventListener('change',(event)=>{mesh.showWire=event.target.checked;updatePointerMode();renderMesh();});
  $('#stableMeshBone',panel).addEventListener('change',(event)=>{selectedWeightBoneId=event.target.value||null;renderUi();});
  $('#stableMeshApplyWeight',panel).addEventListener('click',updateWeight);
  $('#stableMeshDisable',panel).addEventListener('click',()=>{mesh.enabled=false;hideOriginalPart(false);updatePointerMode();renderMesh();renderUi();});

  const api = rig(); originalRigDraw = api.draw.bind(api); api.draw = ()=>{originalRigDraw();renderMesh();};
}

export async function open() {
  await ensureRig();
  if (!initialized) {
    initialized=true; createUi(); globalThis.__SSSStableMesh={mesh,serialize,restore,render:renderMesh,generate:generateGrid,autoWeights};
  }
  document.querySelector('.rig-overlay')?.classList.remove('hidden'); rig().state.open=true; panel.hidden=false; meshCanvas.hidden=false; updatePointerMode(); renderUi(); renderMesh();
}
