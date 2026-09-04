let initialized = false;
let panel = null;
let targetCanvas = null;
let activeChainId = null;
let draggingChainId = null;
const chains = [];

const $ = (selector, root = document) => root.querySelector(selector);
const uid = () => `ik-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const rad = (degrees) => degrees * Math.PI / 180;
const deg = (radians) => radians * 180 / Math.PI;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

async function ensureRig() {
  if (!globalThis.__SSSStableRig) {
    const module = await import('./stable-rig-lazy.js?v=20260904-lazy1');
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
    const pw = worldBone(parent, cache);
    if (!pw) return null;
    const offset = rotatePoint(bone.x, bone.y, pw.rotation);
    startX = pw.endX + offset.x; startY = pw.endY + offset.y; rotation = pw.rotation + rad(bone.rotation);
  }
  const out = { startX, startY, rotation, endX: startX + Math.cos(rotation) * bone.length, endY: startY + Math.sin(rotation) * bone.length };
  cache.set(bone.id, out); return out;
}

function chainLabel(chain) {
  const end = boneById(chain.endBoneId);
  const start = end?.parentId ? boneById(end.parentId) : null;
  return start && end ? `${start.name} → ${end.name}` : 'Invalid chain';
}

function activeChain() { return chains.find((chain) => chain.id === activeChainId) || null; }

function validEndBones() { return rig().state.bones.filter((bone) => bone.parentId && boneById(bone.parentId)); }

function createChain(endBoneId) {
  const end = boneById(endBoneId) || validEndBones()[0];
  if (!end) throw new Error('Create at least two parented bones before adding IK.');
  const start = boneById(end.parentId);
  const endWorld = worldBone(end);
  const chain = {
    id: uid(), endBoneId: end.id, enabled: true,
    targetX: endWorld?.endX ?? rig().state.width / 2, targetY: endWorld?.endY ?? rig().state.height / 2,
    bend: 1, lockStart: false, lockEnd: false, stretch: false, maxStretch: 1.5,
    priority: 0, restStartLength: start.length, restEndLength: end.length
  };
  chains.push(chain); activeChainId = chain.id; return chain;
}

function solveChain(chain) {
  if (!chain?.enabled) return;
  const end = boneById(chain.endBoneId);
  const start = end?.parentId ? boneById(end.parentId) : null;
  if (!end || !start) return;

  if (!Number.isFinite(chain.restStartLength)) chain.restStartLength = start.length;
  if (!Number.isFinite(chain.restEndLength)) chain.restEndLength = end.length;
  let l1 = Math.max(1, chain.restStartLength);
  let l2 = Math.max(1, chain.restEndLength);
  const startWorld = worldBone(start);
  if (!startWorld) return;
  const p0 = { x: startWorld.startX, y: startWorld.startY };
  let dx = chain.targetX - p0.x, dy = chain.targetY - p0.y;
  let distance = Math.max(0.0001, Math.hypot(dx, dy));
  const restReach = l1 + l2;

  if (chain.stretch && distance > restReach) {
    const factor = clamp(distance / restReach, 1, Math.max(1, chain.maxStretch));
    l1 = chain.restStartLength * factor; l2 = chain.restEndLength * factor;
    start.length = l1; end.length = l2;
  } else {
    start.length = chain.restStartLength; end.length = chain.restEndLength;
    l1 = start.length; l2 = end.length;
  }

  const minReach = Math.abs(l1 - l2) + 0.0001;
  const maxReach = l1 + l2 - 0.0001;
  const solvedDistance = clamp(distance, minReach, maxReach);
  const ux = dx / distance, uy = dy / distance;
  const tx = p0.x + ux * solvedDistance, ty = p0.y + uy * solvedDistance;
  dx = tx - p0.x; dy = ty - p0.y; distance = solvedDistance;

  const along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const elbowX = p0.x + ux * along + (-uy) * height * (chain.bend >= 0 ? 1 : -1);
  const elbowY = p0.y + uy * along + ux * height * (chain.bend >= 0 ? 1 : -1);
  const startWorldAngle = Math.atan2(elbowY - p0.y, elbowX - p0.x);
  const endWorldAngle = Math.atan2(ty - elbowY, tx - elbowX);
  const parentWorld = start.parentId ? worldBone(boneById(start.parentId)) : null;

  if (!chain.lockStart) start.rotation = deg(startWorldAngle - (parentWorld?.rotation || 0));
  if (!chain.lockEnd) end.rotation = deg(endWorldAngle - startWorldAngle);
}

function solveAll() {
  [...chains].sort((a, b) => (a.priority || 0) - (b.priority || 0)).forEach(solveChain);
  rig().draw();
  drawTargets();
  renderUi();
}

function drawTargets() {
  if (!targetCanvas) return;
  const ctx = targetCanvas.getContext('2d');
  ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  chains.forEach((chain) => {
    const active = chain.id === activeChainId;
    ctx.save();
    ctx.strokeStyle = active ? '#16c79a' : '#69a5d8';
    ctx.fillStyle = active ? 'rgba(22,199,154,.18)' : 'rgba(105,165,216,.12)';
    ctx.lineWidth = active ? 2.5 : 1.5;
    ctx.beginPath(); ctx.arc(chain.targetX, chain.targetY, active ? 11 : 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(chain.targetX - 15, chain.targetY); ctx.lineTo(chain.targetX + 15, chain.targetY); ctx.moveTo(chain.targetX, chain.targetY - 15); ctx.lineTo(chain.targetX, chain.targetY + 15); ctx.stroke();
    ctx.restore();
  });
}

function canvasPoint(event) {
  const rect = targetCanvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * (targetCanvas.width / rect.width), y: (event.clientY - rect.top) * (targetCanvas.height / rect.height) };
}

function findTarget(point) {
  let best = null;
  for (const chain of chains) {
    const distance = Math.hypot(point.x - chain.targetX, point.y - chain.targetY);
    if (distance <= 18 && (!best || distance < best.distance)) best = { chain, distance };
  }
  return best?.chain || null;
}

function pointerDown(event) {
  const point = canvasPoint(event);
  const found = findTarget(point) || activeChain();
  if (!found) return;
  activeChainId = found.id; draggingChainId = found.id;
  if (!findTarget(point)) { found.targetX = point.x; found.targetY = point.y; solveAll(); }
  targetCanvas.setPointerCapture?.(event.pointerId); renderUi(); drawTargets();
}

function pointerMove(event) {
  if (!draggingChainId) return;
  const chain = chains.find((item) => item.id === draggingChainId); if (!chain) return;
  const point = canvasPoint(event); chain.targetX = point.x; chain.targetY = point.y; solveAll();
}

function pointerUp() { draggingChainId = null; }

function renderUi() {
  if (!panel) return;
  const select = $('#stableIkChain', panel);
  select.innerHTML = '';
  chains.forEach((chain, index) => {
    const option = document.createElement('option'); option.value = chain.id; option.textContent = `${index + 1}. ${chainLabel(chain)} · P${chain.priority || 0}`; select.append(option);
  });
  if (!activeChainId && chains.length) activeChainId = chains[0].id;
  select.value = activeChainId || '';

  const endSelect = $('#stableIkEnd', panel); endSelect.innerHTML = '';
  validEndBones().forEach((bone) => { const option = document.createElement('option'); option.value = bone.id; option.textContent = `${boneById(bone.parentId)?.name || '?'} → ${bone.name}`; endSelect.append(option); });

  const chain = activeChain();
  const controls = ['stableIkEnd','stableIkEnabled','stableIkBend','stableIkTargetX','stableIkTargetY','stableIkLockStart','stableIkLockEnd','stableIkStretch','stableIkMaxStretch','stableIkPriority','stableIkDelete'];
  controls.forEach((id) => { const node = $(`#${id}`, panel); if (node) node.disabled = !chain; });
  if (!chain) return;
  endSelect.value = chain.endBoneId;
  $('#stableIkEnabled', panel).checked = chain.enabled !== false;
  $('#stableIkBend', panel).value = String(chain.bend >= 0 ? 1 : -1);
  $('#stableIkTargetX', panel).value = String(Math.round(chain.targetX * 10) / 10);
  $('#stableIkTargetY', panel).value = String(Math.round(chain.targetY * 10) / 10);
  $('#stableIkLockStart', panel).checked = Boolean(chain.lockStart);
  $('#stableIkLockEnd', panel).checked = Boolean(chain.lockEnd);
  $('#stableIkStretch', panel).checked = Boolean(chain.stretch);
  $('#stableIkMaxStretch', panel).value = String(chain.maxStretch ?? 1.5);
  $('#stableIkPriority', panel).value = String(chain.priority || 0);
  const conflict = $('[data-stable-ik-conflict]', panel);
  const end = boneById(chain.endBoneId), start = end?.parentId ? boneById(end.parentId) : null;
  const shared = chains.filter((other) => other.id !== chain.id).some((other) => {
    const oe = boneById(other.endBoneId), os = oe?.parentId ? boneById(oe.parentId) : null;
    return [start?.id, end?.id].some((id) => id && [os?.id, oe?.id].includes(id));
  });
  if (conflict) conflict.textContent = shared ? 'Shared bones detected — higher priority chains solve last.' : 'No shared-bone conflict.';
}

function syncActiveFromControls() {
  const chain = activeChain(); if (!chain) return;
  const endId = $('#stableIkEnd', panel).value;
  if (endId && endId !== chain.endBoneId) {
    chain.endBoneId = endId; const end = boneById(endId), start = end?.parentId ? boneById(end.parentId) : null;
    if (start && end) { chain.restStartLength = start.length; chain.restEndLength = end.length; const w = worldBone(end); if (w) { chain.targetX = w.endX; chain.targetY = w.endY; } }
  }
  chain.enabled = $('#stableIkEnabled', panel).checked;
  chain.bend = Number($('#stableIkBend', panel).value) >= 0 ? 1 : -1;
  chain.targetX = Number($('#stableIkTargetX', panel).value) || 0; chain.targetY = Number($('#stableIkTargetY', panel).value) || 0;
  chain.lockStart = $('#stableIkLockStart', panel).checked; chain.lockEnd = $('#stableIkLockEnd', panel).checked;
  chain.stretch = $('#stableIkStretch', panel).checked; chain.maxStretch = clamp(Number($('#stableIkMaxStretch', panel).value) || 1.5, 1, 4);
  chain.priority = Math.max(-1000, Math.min(1000, Math.trunc(Number($('#stableIkPriority', panel).value) || 0)));
  solveAll();
}

function addChain() {
  try { createChain($('#stableIkEnd', panel)?.value); renderUi(); solveAll(); }
  catch (error) { $('[data-stable-ik-conflict]', panel).textContent = error.message; }
}

function deleteChain() {
  const index = chains.findIndex((chain) => chain.id === activeChainId); if (index < 0) return;
  chains.splice(index, 1); activeChainId = chains[Math.min(index, chains.length - 1)]?.id || null; renderUi(); rig().draw(); drawTargets();
}

function serialize() {
  return { version: 2, activeChainId, chains: chains.map((chain) => ({ ...chain })) };
}

function restore(data) {
  chains.splice(0, chains.length, ...(data?.chains || []).map((chain) => ({ ...chain })));
  activeChainId = chains.some((chain) => chain.id === data?.activeChainId) ? data.activeChainId : chains[0]?.id || null;
  renderUi(); solveAll();
}

function createUi() {
  const inspector = document.querySelector('.rig-inspector');
  const wrap = document.querySelector('.rig-canvas-wrap');
  const rigCanvas = document.querySelector('#rigCanvas');
  if (!inspector || !wrap || !(rigCanvas instanceof HTMLCanvasElement)) throw new Error('Rigging UI is incomplete.');

  panel = document.createElement('section'); panel.className = 'rig-section'; panel.dataset.stableIkPanel = '1';
  panel.innerHTML = `
    <div class="rig-section-head"><span class="rig-section-title">Inverse Kinematics</span><span class="rig-mode-badge">LAZY IK</span></div>
    <div class="rig-field"><label>Chain</label><select id="stableIkChain"></select></div>
    <div class="rig-two"><button class="btn" id="stableIkAdd">+ Chain</button><button class="btn rig-danger" id="stableIkDelete">Delete</button></div>
    <div class="rig-field"><label>Two-bone end</label><select id="stableIkEnd"></select></div>
    <label class="rig-check"><span>Enabled</span><input id="stableIkEnabled" type="checkbox" checked></label>
    <div class="rig-field"><label>Bend</label><select id="stableIkBend"><option value="1">Positive</option><option value="-1">Negative</option></select></div>
    <div class="rig-two"><div class="rig-field"><label>Target X</label><input id="stableIkTargetX" type="number"></div><div class="rig-field"><label>Target Y</label><input id="stableIkTargetY" type="number"></div></div>
    <div class="rig-two"><label class="rig-check"><span>Lock start</span><input id="stableIkLockStart" type="checkbox"></label><label class="rig-check"><span>Lock end</span><input id="stableIkLockEnd" type="checkbox"></label></div>
    <label class="rig-check"><span>Stretch unreachable</span><input id="stableIkStretch" type="checkbox"></label>
    <div class="rig-two"><div class="rig-field"><label>Max stretch</label><input id="stableIkMaxStretch" type="number" min="1" max="4" step=".05" value="1.5"></div><div class="rig-field"><label>Priority</label><input id="stableIkPriority" type="number" min="-1000" max="1000" value="0"></div></div>
    <div class="rig-empty" data-stable-ik-conflict>No chain yet.</div>
    <button class="btn" id="stableIkSolve">Solve now</button>`;
  inspector.append(panel);

  targetCanvas = document.createElement('canvas'); targetCanvas.width = rigCanvas.width; targetCanvas.height = rigCanvas.height;
  targetCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:5;cursor:crosshair;touch-action:none';
  wrap.append(targetCanvas);
  targetCanvas.addEventListener('pointerdown', pointerDown); targetCanvas.addEventListener('pointermove', pointerMove); targetCanvas.addEventListener('pointerup', pointerUp); targetCanvas.addEventListener('pointercancel', pointerUp);

  $('#stableIkAdd', panel).addEventListener('click', addChain); $('#stableIkDelete', panel).addEventListener('click', deleteChain); $('#stableIkSolve', panel).addEventListener('click', syncActiveFromControls);
  $('#stableIkChain', panel).addEventListener('change', (event) => { activeChainId = event.target.value; renderUi(); drawTargets(); });
  ['stableIkEnd','stableIkEnabled','stableIkBend','stableIkTargetX','stableIkTargetY','stableIkLockStart','stableIkLockEnd','stableIkStretch','stableIkMaxStretch','stableIkPriority'].forEach((id) => $(`#${id}`, panel).addEventListener('change', syncActiveFromControls));
}

export async function open() {
  await ensureRig();
  if (!initialized) {
    initialized = true; createUi();
    globalThis.__SSSStableIK = { chains, serialize, restore, solve: solveAll, drawTargets };
  }
  document.querySelector('.rig-overlay')?.classList.remove('hidden');
  rig().state.open = true;
  panel.hidden = false; targetCanvas.hidden = false;
  if (!chains.length && validEndBones().length) createChain(validEndBones()[0].id);
  renderUi(); solveAll();
}
