let panel = null;
let initialized = false;
let activeAnimation = 'idle';
const animations = new Map();
let history = [];
let historyIndex = -1;
let restoring = false;
let capturing = false;
let historyTimer = 0;
const HISTORY_LIMIT = 10;
const HISTORY_PIXEL_LIMIT = 8_000_000;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function toast(message) {
  const node = $('#toast');
  if (!node) return;
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 1800);
}

function activeFrameIndex() {
  return Math.max(0, $$('.frame-card').findIndex((node) => node.classList.contains('active')));
}

function currentFrameCount() {
  return $$('.frame-card').length;
}

function historyAllowed() {
  const count = currentFrameCount();
  const preview = $('#previewCanvas');
  if (!(preview instanceof HTMLCanvasElement) || !count) return true;
  return count <= 48 && preview.width * preview.height * count <= HISTORY_PIXEL_LIMIT;
}

function captureCurrentClip({ historyMode = false } = {}) {
  if (capturing) return null;
  const buttons = $$('.frame-card');
  const fps = Number($('#fpsInput')?.value) || 8;
  const loop = Boolean($('#loopInput')?.checked);
  const pingPong = Boolean($('#pingInput')?.checked);
  if (!buttons.length) return { frames: [], fps, loop, pingPong };
  if (historyMode && !historyAllowed()) return null;

  capturing = true;
  try {
    const selected = activeFrameIndex();
    const frames = [];
    for (let index = 0; index < buttons.length; index += 1) {
      const fresh = $$('.frame-card')[index];
      if (!(fresh instanceof HTMLButtonElement)) continue;
      fresh.click();
      const preview = $('#previewCanvas');
      if (!(preview instanceof HTMLCanvasElement) || preview.classList.contains('hidden')) continue;
      frames.push({
        name: `frame-${String(index + 1).padStart(3, '0')}.png`,
        png: preview.toDataURL('image/png'),
        width: preview.width,
        height: preview.height
      });
    }
    const restore = $$('.frame-card')[Math.min(selected, Math.max(0, frames.length - 1))];
    if (restore instanceof HTMLButtonElement) restore.click();
    return { frames, fps, loop, pingPong };
  } finally {
    capturing = false;
  }
}

function syncActiveClip() {
  if (restoring || capturing) return;
  const clip = captureCurrentClip();
  if (clip) animations.set(activeAnimation, clip);
}

function runtimeExtrasSnapshot() {
  return {
    rig: globalThis.__SSSStableRig?.serialize?.() ?? null,
    skeletal: globalThis.__SSSStableSkeletal?.serialize?.() ?? null,
    ik: globalThis.__SSSStableIK?.serialize?.() ?? null,
    mesh: globalThis.__SSSStableMesh?.serialize?.() ?? null
  };
}

function projectSnapshot() {
  syncActiveClip();
  return {
    version: 3,
    app: 'Sprite Sheet Studio',
    runtime: 'stable-lazy',
    activeAnimation,
    savedAt: new Date().toISOString(),
    animations: Object.fromEntries([...animations.entries()].map(([name, clip]) => [name, clip])),
    extras: runtimeExtrasSnapshot()
  };
}

function dataUrlToFile(dataUrl, name) {
  const comma = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const type = /data:([^;]+)/.exec(header)?.[1] || 'image/png';
  return new File([bytes], name || 'frame.png', { type });
}

function waitForFrameCount(expected, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const check = () => {
      if (currentFrameCount() === expected) return resolve();
      if (performance.now() - started > timeoutMs) return reject(new Error(`Timed out waiting for ${expected} frames.`));
      setTimeout(check, 35);
    };
    check();
  });
}

async function restoreClip(clip) {
  restoring = true;
  try {
    const clear = $('#clearBtn');
    if (!clip?.frames?.length) {
      clear?.click();
    } else {
      if (typeof DataTransfer !== 'function') throw new Error('This browser does not support programmatic project restore.');
      const transfer = new DataTransfer();
      clip.frames.forEach((frame, index) => transfer.items.add(dataUrlToFile(frame.png, frame.name || `frame-${index + 1}.png`)));
      const input = $('#fileInput');
      if (!(input instanceof HTMLInputElement)) throw new Error('Stable file input was not found.');
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await waitForFrameCount(clip.frames.length);
    }

    const fps = $('#fpsInput');
    if (fps instanceof HTMLInputElement) {
      fps.value = String(Math.max(1, Math.min(30, Number(clip?.fps) || 8)));
      fps.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const loop = $('#loopInput');
    if (loop instanceof HTMLInputElement) {
      loop.checked = clip?.loop !== false;
      loop.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const ping = $('#pingInput');
    if (ping instanceof HTMLInputElement) {
      ping.checked = Boolean(clip?.pingPong);
      ping.dispatchEvent(new Event('change', { bubbles: true }));
    }
  } finally {
    restoring = false;
  }
}

async function restoreExtras(extras) {
  if (!extras || typeof extras !== 'object') return;
  let openedRig = false;
  if (extras.rig) {
    setStatus('Restoring rig…');
    const module = await import('./stable-rig-lazy.js?v=20260904-lazy4');
    await module.open();
    await globalThis.__SSSStableRig?.restore?.(extras.rig);
    openedRig = true;
  }
  if (extras.skeletal) {
    setStatus('Restoring skeletal animations…');
    const module = await import('./stable-skeletal-lazy.js?v=20260904-lazy4');
    await module.open();
    globalThis.__SSSStableSkeletal?.restore?.(extras.skeletal);
    openedRig = true;
  }
  if (extras.ik) {
    setStatus('Restoring IK…');
    const module = await import('./stable-ik-lazy.js?v=20260904-lazy4');
    await module.open();
    globalThis.__SSSStableIK?.restore?.(extras.ik);
    openedRig = true;
  }
  if (extras.mesh) {
    setStatus('Restoring mesh…');
    const module = await import('./stable-mesh-lazy.js?v=20260904-lazy4');
    await module.open();
    globalThis.__SSSStableMesh?.restore?.(extras.mesh);
    openedRig = true;
  }
  if (openedRig) globalThis.__SSSStableRig?.close?.();
}

function uniqueName(raw) {
  const base = String(raw || 'animation').trim().replace(/\s+/g, '-').toLowerCase() || 'animation';
  if (!animations.has(base)) return base;
  let suffix = 2;
  while (animations.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function renderAnimationUi() {
  if (!panel) return;
  const select = $('#stableAnimationSelect', panel);
  if (!(select instanceof HTMLSelectElement)) return;
  select.innerHTML = '';
  animations.forEach((_, name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    select.append(option);
  });
  select.value = activeAnimation;
  const count = $('[data-project-animation-count]', panel);
  if (count) count.textContent = `${animations.size} animation${animations.size === 1 ? '' : 's'}`;
  updateHistoryButtons();
}

function setStatus(text, kind = '') {
  const node = $('[data-project-status]', panel);
  if (!node) return;
  node.textContent = text;
  node.dataset.kind = kind;
}

function resetHistory() {
  const clip = captureCurrentClip({ historyMode: true });
  history = clip ? [clip] : [];
  historyIndex = clip ? 0 : -1;
  updateHistoryButtons();
  if (!clip && currentFrameCount()) setStatus('Undo paused for large project', 'warn');
}

function pushHistory() {
  if (restoring || capturing) return;
  const clip = captureCurrentClip({ historyMode: true });
  if (!clip) {
    setStatus('Undo paused for large project', 'warn');
    return;
  }
  history = history.slice(0, historyIndex + 1);
  history.push(clip);
  if (history.length > HISTORY_LIMIT) history.shift();
  historyIndex = history.length - 1;
  animations.set(activeAnimation, clip);
  updateHistoryButtons();
  setStatus('History checkpoint saved', 'ok');
}

function scheduleHistory() {
  if (restoring || capturing) return;
  clearTimeout(historyTimer);
  historyTimer = setTimeout(pushHistory, 40);
}

async function undo() {
  if (historyIndex <= 0) return;
  historyIndex -= 1;
  await restoreClip(history[historyIndex]);
  animations.set(activeAnimation, history[historyIndex]);
  updateHistoryButtons();
  setStatus('Undo', 'ok');
}

async function redo() {
  if (historyIndex < 0 || historyIndex >= history.length - 1) return;
  historyIndex += 1;
  await restoreClip(history[historyIndex]);
  animations.set(activeAnimation, history[historyIndex]);
  updateHistoryButtons();
  setStatus('Redo', 'ok');
}

function updateHistoryButtons() {
  if (!panel) return;
  const undoBtn = $('#stableUndo', panel);
  const redoBtn = $('#stableRedo', panel);
  if (undoBtn) undoBtn.disabled = historyIndex <= 0;
  if (redoBtn) redoBtn.disabled = historyIndex < 0 || historyIndex >= history.length - 1;
}

async function switchAnimation(name) {
  if (!animations.has(name) || name === activeAnimation) return;
  syncActiveClip();
  activeAnimation = name;
  await restoreClip(animations.get(name));
  renderAnimationUi();
  resetHistory();
  setStatus(`Opened ${name}`, 'ok');
}

async function addAnimation(duplicateCurrent = false) {
  syncActiveClip();
  const raw = prompt('Animation name', animations.has('walk') ? 'animation' : 'walk');
  if (raw === null) return;
  const name = uniqueName(raw);
  const clip = duplicateCurrent ? captureCurrentClip() : { frames: [], fps: Number($('#fpsInput')?.value) || 8, loop: true, pingPong: false };
  animations.set(name, clip);
  activeAnimation = name;
  await restoreClip(clip);
  renderAnimationUi();
  resetHistory();
  setStatus(`Created ${name}`, 'ok');
}

function renameAnimation() {
  const raw = prompt('Rename animation', activeAnimation);
  if (raw === null) return;
  const next = String(raw).trim().replace(/\s+/g, '-').toLowerCase();
  if (!next || next === activeAnimation) return;
  if (animations.has(next)) return setStatus('That animation name already exists', 'error');
  syncActiveClip();
  const clip = animations.get(activeAnimation);
  animations.delete(activeAnimation);
  animations.set(next, clip);
  activeAnimation = next;
  renderAnimationUi();
  setStatus(`Renamed to ${next}`, 'ok');
}

async function deleteAnimation() {
  if (animations.size <= 1) return setStatus('A project needs at least one animation', 'error');
  if (!confirm(`Delete animation “${activeAnimation}”?`)) return;
  animations.delete(activeAnimation);
  activeAnimation = animations.keys().next().value;
  await restoreClip(animations.get(activeAnimation));
  renderAnimationUi();
  resetHistory();
  setStatus('Animation deleted', 'ok');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function saveProject() {
  setStatus('Serializing project…');
  try {
    const project = projectSnapshot();
    const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
    downloadBlob(blob, 'sprite-sheet-studio.sss');
    const extras = Object.values(project.extras || {}).filter(Boolean).length;
    setStatus(`Saved ${(blob.size / 1024 / 1024).toFixed(1)} MB · ${extras} advanced workspace${extras === 1 ? '' : 's'}`, 'ok');
  } catch (error) {
    console.error(error);
    setStatus(error instanceof Error ? error.message : 'Project save failed', 'error');
  }
}

async function loadProjectFile(file) {
  setStatus('Loading project…');
  const data = JSON.parse(await file.text());
  if (!data?.animations || typeof data.animations !== 'object') throw new Error('Invalid .sss project file.');
  restoring = true;
  animations.clear();
  for (const [name, clip] of Object.entries(data.animations)) animations.set(name, clip);
  if (!animations.size) animations.set('idle', { frames: [], fps: 8, loop: true, pingPong: false });
  activeAnimation = animations.has(data.activeAnimation) ? data.activeAnimation : animations.keys().next().value;
  restoring = false;
  await restoreClip(animations.get(activeAnimation));
  await restoreExtras(data.extras);
  renderAnimationUi();
  resetHistory();
  setStatus('Project loaded', 'ok');
  toast('Project loaded');
}

function installHistoryHooks() {
  const mutationIds = new Set(['demoBtn','clearBtn','applyGridBtn','autoSliceBtn','duplicateBtn','deleteBtn','reverseBtn','trimBtn','flipXBtn','flipYBtn','rotateBtn']);
  document.addEventListener('click', (event) => {
    if (capturing || restoring) return;
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (button?.id && mutationIds.has(button.id)) scheduleHistory();
  });
  ['fpsInput','loopInput','pingInput'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', scheduleHistory);
  });
  $('#fileInput')?.addEventListener('change', () => setTimeout(scheduleHistory, 80));
}

function createPanel() {
  panel = document.createElement('section');
  panel.className = 'sss-module-panel';
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start">
      <div><h3>Project & Undo</h3><div class="muted">Loaded on demand. No startup autosave and no background canvas decoding.</div></div>
      <button class="btn" data-project-close>Close</button>
    </div>
    <div class="sss-module-toolbar">
      <button class="btn" id="stableUndo">Undo</button>
      <button class="btn" id="stableRedo">Redo</button>
      <button class="btn" id="stableCheckpoint">Checkpoint</button>
      <button class="btn green" id="stableSaveProject">Save .sss</button>
      <button class="btn" id="stableLoadProject">Load .sss</button>
      <input type="file" id="stableProjectInput" accept=".sss,application/json" hidden />
    </div>
    <div class="sss-module-row">
      <div><strong>Animations</strong><div class="muted" data-project-animation-count></div></div>
      <select id="stableAnimationSelect"></select>
    </div>
    <div class="sss-module-toolbar">
      <button class="btn" id="stableAddAnimation">New animation</button>
      <button class="btn" id="stableDuplicateAnimation">Duplicate animation</button>
      <button class="btn" id="stableRenameAnimation">Rename</button>
      <button class="btn danger" id="stableDeleteAnimation">Delete</button>
    </div>
    <div class="sss-module-row"><span>Project status</span><strong data-project-status>Ready</strong></div>
    <div class="muted" style="margin-top:10px">Undo keeps up to ${HISTORY_LIMIT} checkpoints and pauses automatically for large frame sets to protect memory. Advanced Rig/Skeletal/IK/Mesh state is included only when those workspaces have been opened.</div>`;
  document.body.append(panel);

  $('[data-project-close]', panel)?.addEventListener('click', () => panel.hidden = true);
  $('#stableUndo', panel)?.addEventListener('click', () => void undo());
  $('#stableRedo', panel)?.addEventListener('click', () => void redo());
  $('#stableCheckpoint', panel)?.addEventListener('click', pushHistory);
  $('#stableSaveProject', panel)?.addEventListener('click', saveProject);
  $('#stableLoadProject', panel)?.addEventListener('click', () => $('#stableProjectInput', panel)?.click());
  $('#stableProjectInput', panel)?.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    loadProjectFile(file).catch((error) => { console.error(error); setStatus(error.message || 'Project load failed', 'error'); });
    event.target.value = '';
  });
  $('#stableAnimationSelect', panel)?.addEventListener('change', (event) => void switchAnimation(event.target.value));
  $('#stableAddAnimation', panel)?.addEventListener('click', () => void addAnimation(false));
  $('#stableDuplicateAnimation', panel)?.addEventListener('click', () => void addAnimation(true));
  $('#stableRenameAnimation', panel)?.addEventListener('click', renameAnimation);
  $('#stableDeleteAnimation', panel)?.addEventListener('click', () => void deleteAnimation());
}

export async function open() {
  if (!initialized) {
    initialized = true;
    animations.set('idle', captureCurrentClip() || { frames: [], fps: 8, loop: true, pingPong: false });
    createPanel();
    renderAnimationUi();
    resetHistory();
    installHistoryHooks();
  }
  panel.hidden = false;
  renderAnimationUi();
  setStatus('Ready', 'ok');
}
