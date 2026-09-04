let initialized = false;
let host = null;
let playing = false;
let rafId = 0;
let lastTick = 0;
let playhead = 0;
let currentFrame = 0;
let activeName = 'idle';
let copiedPose = null;
const library = new Map();

const $ = (selector, root = document) => root.querySelector(selector);

function ensureStyles() {
  if (document.querySelector('link[data-stable-skeletal-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './src/skeletal-animation.css?v=20260904-lazy1';
  link.dataset.stableSkeletalCss = '1';
  document.head.append(link);
}

async function ensureRig() {
  if (!globalThis.__SSSStableRig) {
    const module = await import('./stable-rig-lazy.js?v=20260904-lazy1');
    await module.open();
  }
  return globalThis.__SSSStableRig;
}

function rig() {
  const api = globalThis.__SSSStableRig;
  if (!api) throw new Error('Rigging workspace is not available.');
  return api;
}

function clonePose(pose) {
  return structuredClone ? structuredClone(pose) : JSON.parse(JSON.stringify(pose));
}

function capturePose() {
  const state = rig().state;
  return {
    bones: Object.fromEntries(state.bones.map((bone) => [bone.id, {
      x: bone.x, y: bone.y, rotation: bone.rotation, length: bone.length, visible: bone.visible !== false
    }])),
    parts: Object.fromEntries(state.parts.map((part) => [part.id, {
      boneId: part.boneId, x: part.x, y: part.y, pivotX: part.pivotX, pivotY: part.pivotY,
      rotation: part.rotation, scaleX: part.scaleX ?? 1, scaleY: part.scaleY ?? 1,
      z: part.z, opacity: part.opacity, visible: part.visible !== false
    }]))
  };
}

function applyPose(pose, redrawUi = false) {
  const api = rig();
  const state = api.state;
  for (const bone of state.bones) {
    const value = pose?.bones?.[bone.id];
    if (!value) continue;
    if (Number.isFinite(value.x)) bone.x = value.x;
    if (Number.isFinite(value.y)) bone.y = value.y;
    if (Number.isFinite(value.rotation)) bone.rotation = value.rotation;
    if (Number.isFinite(value.length)) bone.length = Math.max(1, value.length);
    if (typeof value.visible === 'boolean') bone.visible = value.visible;
  }
  for (const part of state.parts) {
    const value = pose?.parts?.[part.id];
    if (!value) continue;
    if (value.boneId !== undefined) part.boneId = value.boneId;
    if (Number.isFinite(value.x)) part.x = value.x;
    if (Number.isFinite(value.y)) part.y = value.y;
    if (Number.isFinite(value.pivotX)) part.pivotX = value.pivotX;
    if (Number.isFinite(value.pivotY)) part.pivotY = value.pivotY;
    if (Number.isFinite(value.rotation)) part.rotation = value.rotation;
    if (Number.isFinite(value.scaleX)) part.scaleX = value.scaleX;
    if (Number.isFinite(value.scaleY)) part.scaleY = value.scaleY;
    if (Number.isFinite(value.z)) part.z = value.z;
    if (Number.isFinite(value.opacity)) part.opacity = value.opacity;
    if (typeof value.visible === 'boolean') part.visible = value.visible;
  }
  api.draw();
  if (redrawUi) api.render();
}

function newAnimation(name = 'idle') {
  return { name, fps: 12, length: 24, loop: true, interpolation: 'linear', keyframes: new Map() };
}

function animation() {
  if (!library.has(activeName)) library.set(activeName, newAnimation(activeName));
  return library.get(activeName);
}

function easeValue(t, mode) {
  const x = Math.max(0, Math.min(1, t));
  if (mode === 'step') return 0;
  if (mode === 'ease') return x * x * (3 - 2 * x);
  if (mode === 'ease-in') return x * x;
  if (mode === 'ease-out') return 1 - (1 - x) * (1 - x);
  return x;
}

function lerp(a, b, t) { return a + (b - a) * t; }

function interpolateObject(a = {}, b = {}, t) {
  const result = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  keys.forEach((key) => {
    const av = a[key], bv = b[key];
    if (typeof av === 'number' && typeof bv === 'number') result[key] = lerp(av, bv, t);
    else result[key] = t < 0.5 ? (av ?? bv) : (bv ?? av);
  });
  return result;
}

function interpolatePose(a, b, t) {
  const pose = { bones: {}, parts: {} };
  const boneIds = new Set([...Object.keys(a?.bones || {}), ...Object.keys(b?.bones || {})]);
  boneIds.forEach((id) => { pose.bones[id] = interpolateObject(a?.bones?.[id], b?.bones?.[id], t); });
  const partIds = new Set([...Object.keys(a?.parts || {}), ...Object.keys(b?.parts || {})]);
  partIds.forEach((id) => { pose.parts[id] = interpolateObject(a?.parts?.[id], b?.parts?.[id], t); });
  return pose;
}

function poseAt(frame) {
  const anim = animation();
  const entries = [...anim.keyframes.entries()].sort((a, b) => a[0] - b[0]);
  if (!entries.length) return null;
  const exact = anim.keyframes.get(Math.round(frame));
  if (exact && Math.abs(frame - Math.round(frame)) < 0.0001) return clonePose(exact);
  let previous = entries[0];
  let next = entries.at(-1);
  for (const entry of entries) {
    if (entry[0] <= frame) previous = entry;
    if (entry[0] >= frame) { next = entry; break; }
  }
  if (previous[0] === next[0] || anim.interpolation === 'step') return clonePose(previous[1]);
  const t = easeValue((frame - previous[0]) / (next[0] - previous[0]), anim.interpolation);
  return interpolatePose(previous[1], next[1], t);
}

function setFrame(frame, redrawUi = false) {
  const anim = animation();
  currentFrame = Math.max(0, Math.min(anim.length, Number(frame) || 0));
  playhead = currentFrame;
  const pose = poseAt(currentFrame);
  if (pose) applyPose(pose, redrawUi);
  const range = $('#stableSkRange', host);
  if (range) range.value = String(Math.round(currentFrame));
  renderReadout();
  renderMarkers();
}

function renderReadout() {
  const readout = $('[data-stable-sk-time]', host);
  if (readout) readout.textContent = `Frame ${Math.round(currentFrame)} / ${animation().length}`;
  const play = $('#stableSkPlay', host);
  if (play) play.textContent = playing ? 'Pause' : 'Play';
}

function renderMarkers() {
  const markers = $('#stableSkMarkers', host);
  if (!markers) return;
  markers.innerHTML = '';
  const anim = animation();
  [...anim.keyframes.keys()].sort((a,b) => a-b).forEach((frame) => {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = `skeletal-marker${Math.round(currentFrame) === frame ? ' current' : ''}`;
    marker.style.left = `${(frame / Math.max(1, anim.length)) * 100}%`;
    marker.style.pointerEvents = 'auto';
    marker.title = `Frame ${frame}`;
    marker.addEventListener('click', () => setFrame(frame, true));
    markers.append(marker);
  });
}

function renderAnimationSelect() {
  const select = $('#stableSkAnim', host);
  if (!select) return;
  select.innerHTML = '';
  library.forEach((_, name) => {
    const option = document.createElement('option'); option.value = name; option.textContent = name; select.append(option);
  });
  select.value = activeName;
  const anim = animation();
  $('#stableSkFps', host).value = String(anim.fps);
  $('#stableSkLength', host).value = String(anim.length);
  $('#stableSkLoop', host).checked = anim.loop;
  $('#stableSkInterp', host).value = anim.interpolation;
  $('#stableSkRange', host).max = String(anim.length);
  renderReadout(); renderMarkers();
}

function addKey() {
  animation().keyframes.set(Math.round(currentFrame), capturePose());
  renderMarkers();
}

function deleteKey() {
  animation().keyframes.delete(Math.round(currentFrame));
  renderMarkers();
}

function mirrorPose() {
  const pose = capturePose();
  Object.values(pose.bones).forEach((bone) => { bone.x = -bone.x; bone.rotation = -bone.rotation; });
  Object.values(pose.parts).forEach((part) => { part.x = -part.x; part.rotation = -part.rotation; part.scaleX = -(part.scaleX ?? 1); });
  applyPose(pose, true);
}

function stopPlayback() {
  playing = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  renderReadout();
}

function tick(now) {
  if (!playing) return;
  const anim = animation();
  if (!lastTick) lastTick = now;
  const deltaFrames = (now - lastTick) / 1000 * anim.fps;
  lastTick = now;
  playhead += deltaFrames;
  if (playhead > anim.length) {
    if (anim.loop) playhead %= Math.max(1, anim.length + 1);
    else { setFrame(anim.length, true); stopPlayback(); return; }
  }
  currentFrame = playhead;
  const pose = poseAt(currentFrame);
  if (pose) applyPose(pose, false);
  const range = $('#stableSkRange', host); if (range) range.value = String(Math.round(currentFrame));
  renderReadout();
  rafId = requestAnimationFrame(tick);
}

function togglePlayback() {
  if (playing) return stopPlayback();
  if (!animation().keyframes.size) return;
  playing = true; lastTick = 0; playhead = currentFrame;
  renderReadout();
  rafId = requestAnimationFrame(tick);
}

function uniqueName(base) {
  const clean = String(base || 'animation').trim().replace(/\s+/g, '-').toLowerCase() || 'animation';
  if (!library.has(clean)) return clean;
  let i = 2; while (library.has(`${clean}-${i}`)) i += 1; return `${clean}-${i}`;
}

function addAnimation(duplicate = false) {
  const raw = prompt('Animation name', library.has('walk') ? 'animation' : 'walk');
  if (raw === null) return;
  const name = uniqueName(raw);
  const source = animation();
  const next = newAnimation(name);
  if (duplicate) {
    next.fps = source.fps; next.length = source.length; next.loop = source.loop; next.interpolation = source.interpolation;
    next.keyframes = new Map([...source.keyframes.entries()].map(([frame, pose]) => [frame, clonePose(pose)]));
  }
  library.set(name, next); activeName = name; currentFrame = 0; playhead = 0; stopPlayback(); renderAnimationSelect();
}

function deleteAnimation() {
  if (library.size <= 1) return;
  if (!confirm(`Delete animation “${activeName}”?`)) return;
  library.delete(activeName); activeName = library.keys().next().value; currentFrame = 0; stopPlayback(); renderAnimationSelect(); setFrame(0, true);
}

function serialize() {
  return {
    version: 2,
    activeName,
    currentFrame: Math.round(currentFrame),
    animations: Object.fromEntries([...library.entries()].map(([name, anim]) => [name, {
      fps: anim.fps, length: anim.length, loop: anim.loop, interpolation: anim.interpolation,
      keyframes: Object.fromEntries([...anim.keyframes.entries()].map(([frame, pose]) => [String(frame), clonePose(pose)]))
    }]))
  };
}

function restore(data) {
  stopPlayback();
  library.clear();
  for (const [name, raw] of Object.entries(data?.animations || {})) {
    const anim = newAnimation(name);
    anim.fps = Math.max(1, Math.min(60, Number(raw.fps) || 12));
    anim.length = Math.max(1, Math.min(1200, Number(raw.length) || 24));
    anim.loop = raw.loop !== false;
    anim.interpolation = ['step','linear','ease','ease-in','ease-out'].includes(raw.interpolation) ? raw.interpolation : 'linear';
    anim.keyframes = new Map(Object.entries(raw.keyframes || {}).map(([frame, pose]) => [Number(frame), clonePose(pose)]).filter(([frame]) => Number.isFinite(frame)));
    library.set(name, anim);
  }
  if (!library.size) library.set('idle', newAnimation('idle'));
  activeName = library.has(data?.activeName) ? data.activeName : library.keys().next().value;
  currentFrame = Math.max(0, Math.min(animation().length, Number(data?.currentFrame) || 0));
  playhead = currentFrame;
  renderAnimationSelect(); setFrame(currentFrame, true);
}

function createUi() {
  ensureStyles();
  const stage = document.querySelector('.rig-stage');
  if (!stage) throw new Error('Rig stage not found.');
  host = document.createElement('section');
  host.className = 'skeletal-timeline';
  host.innerHTML = `
    <div class="skeletal-timeline-top">
      <div class="skeletal-toolbar">
        <button class="btn" id="stableSkPlay">Play</button>
        <select class="select" id="stableSkAnim"></select>
        <button class="btn" id="stableSkAdd">+ Anim</button>
        <button class="btn" id="stableSkDup">Duplicate</button>
        <button class="btn" id="stableSkDeleteAnim">Delete</button>
        <label class="skeletal-fps">FPS <input id="stableSkFps" type="number" min="1" max="60" value="12" style="width:48px"></label>
        <label>Length <input id="stableSkLength" type="number" min="1" max="1200" value="24" style="width:58px"></label>
        <button class="btn" id="stableSkHide">Hide</button>
      </div>
      <div class="skeletal-key-actions"><button class="btn" id="stableSkKey">Key pose</button><button class="btn" id="stableSkDeleteKey">Delete key</button><button class="btn" id="stableSkCopy">Copy</button><button class="btn" id="stableSkPaste">Paste</button><button class="btn" id="stableSkMirror">Mirror</button></div>
    </div>
    <div class="skeletal-track-wrap"><div class="skeletal-markers" id="stableSkMarkers"></div><input class="skeletal-range" id="stableSkRange" type="range" min="0" max="24" value="0"></div>
    <div class="skeletal-footer"><span class="skeletal-time-label" data-stable-sk-time>Frame 0 / 24</span><div class="skeletal-interp"><label>Loop <input id="stableSkLoop" type="checkbox" checked></label><label>Interpolation <select id="stableSkInterp"><option value="step">Step</option><option value="linear">Linear</option><option value="ease">Smooth</option><option value="ease-in">Ease in</option><option value="ease-out">Ease out</option></select></label></div></div>`;
  stage.append(host);

  $('#stableSkPlay', host).addEventListener('click', togglePlayback);
  $('#stableSkRange', host).addEventListener('input', (event) => { stopPlayback(); setFrame(Number(event.target.value), false); });
  $('#stableSkKey', host).addEventListener('click', addKey);
  $('#stableSkDeleteKey', host).addEventListener('click', deleteKey);
  $('#stableSkCopy', host).addEventListener('click', () => { copiedPose = capturePose(); });
  $('#stableSkPaste', host).addEventListener('click', () => { if (copiedPose) applyPose(clonePose(copiedPose), true); });
  $('#stableSkMirror', host).addEventListener('click', mirrorPose);
  $('#stableSkAdd', host).addEventListener('click', () => addAnimation(false));
  $('#stableSkDup', host).addEventListener('click', () => addAnimation(true));
  $('#stableSkDeleteAnim', host).addEventListener('click', deleteAnimation);
  $('#stableSkAnim', host).addEventListener('change', (event) => { stopPlayback(); activeName = event.target.value; currentFrame = 0; playhead = 0; renderAnimationSelect(); setFrame(0, true); });
  $('#stableSkFps', host).addEventListener('change', (event) => { animation().fps = Math.max(1, Math.min(60, Number(event.target.value) || 12)); event.target.value = String(animation().fps); });
  $('#stableSkLength', host).addEventListener('change', (event) => { animation().length = Math.max(1, Math.min(1200, Number(event.target.value) || 24)); event.target.value = String(animation().length); $('#stableSkRange', host).max = String(animation().length); setFrame(Math.min(currentFrame, animation().length)); });
  $('#stableSkLoop', host).addEventListener('change', (event) => { animation().loop = event.target.checked; });
  $('#stableSkInterp', host).addEventListener('change', (event) => { animation().interpolation = event.target.value; setFrame(currentFrame); });
  $('#stableSkHide', host).addEventListener('click', () => { stopPlayback(); host.hidden = true; });
}

export async function open() {
  await ensureRig();
  if (!initialized) {
    initialized = true;
    library.set('idle', newAnimation('idle'));
    createUi();
    renderAnimationSelect();
    globalThis.__SSSStableSkeletal = { serialize, restore, capturePose, applyPose, setFrame, library };
  }
  host.hidden = false;
  rig().state.open = true;
  document.querySelector('.rig-overlay')?.classList.remove('hidden');
  renderAnimationSelect();
  setFrame(currentFrame, true);
}
