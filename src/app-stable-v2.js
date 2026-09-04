const app = document.querySelector('#app');
if (!app) throw new Error('Missing #app');

const MiB = 1024 * 1024;
const deviceMemoryGb = Number(navigator.deviceMemory) || 4;
const RAM_BUDGET_BYTES = Math.round(Math.min(320, Math.max(128, deviceMemoryGb * 64)) * MiB);
const MAX_CANVAS_DIMENSION = 16384;
const AUTO_SLICE_PIXEL_LIMIT = 12_000_000;
const TRIM_PIXEL_LIMIT = 16_000_000;
const SINGLE_SHEET_PIXEL_LIMIT = 32_000_000;

const state = {
  source: null,
  sourceName: '',
  frames: [],
  index: 0,
  rows: 1,
  cols: 1,
  fps: 8,
  loop: true,
  pingPong: false,
  playing: false,
  direction: 1,
  lastTick: performance.now(),
  zoom: 4,
  bg: 'checker'
};

app.innerHTML = `
  <main class="app-shell">
    <header class="topbar">
      <div class="brand">
        <img class="brand-logo" src="./assets/brand/logo-mark.svg" alt="" aria-hidden="true" />
        <div class="brand-copy">
          <div class="brand-title">Sprite Sheet <strong>Studio</strong></div>
          <div class="brand-subtitle">Upload → Slice → Animate → Export</div>
        </div>
      </div>
      <div class="top-actions">
        <span class="badge">STABLE MODE</span>
        <button class="btn" id="demoBtn">Try demo</button>
        <button class="btn danger" id="clearBtn">Clear</button>
      </div>
    </header>

    <section class="workspace">
      <aside class="sidebar">
        <div class="panel-section">
          <div class="section-head"><h2 class="section-title">Import</h2><span class="section-note">PNG / WebP</span></div>
          <button class="upload-zone" id="uploadZone" type="button">
            <div>
              <div class="upload-icon">＋</div>
              <div class="upload-title">Drop sprite sheet here</div>
              <div class="upload-sub">or click to browse</div>
            </div>
          </button>
          <input id="fileInput" class="hidden" type="file" accept="image/png,image/webp" multiple />
          <div class="privacy-line"><b>●</b><span>Images stay in your browser.</span></div>
        </div>

        <div class="panel-section">
          <div class="section-head"><h2 class="section-title">Slice grid</h2><span class="section-note" id="frameSizeLabel">—</span></div>
          <div class="field-grid">
            <div class="field"><label>Columns</label><input class="control" id="colsInput" type="number" min="1" max="128" value="1" /></div>
            <div class="field"><label>Rows</label><input class="control" id="rowsInput" type="number" min="1" max="128" value="1" /></div>
          </div>
          <div class="btn-row" style="margin-top:10px">
            <button class="btn grow" id="autoSliceBtn">Auto Slice</button>
            <button class="btn grow" id="applyGridBtn">Apply grid</button>
          </div>
        </div>

        <div class="panel-section">
          <div class="section-head"><h2 class="section-title">Frame tools</h2></div>
          <div class="btn-row">
            <button class="btn" id="duplicateBtn">Duplicate</button>
            <button class="btn" id="deleteBtn">Delete</button>
            <button class="btn" id="reverseBtn">Reverse</button>
          </div>
          <div class="btn-row" style="margin-top:8px">
            <button class="btn" id="trimBtn">Trim</button>
            <button class="btn" id="flipXBtn">Flip X</button>
            <button class="btn" id="flipYBtn">Flip Y</button>
            <button class="btn" id="rotateBtn">Rotate</button>
          </div>
        </div>
      </aside>

      <section class="canvas-stage">
        <div class="preview-stage">
          <div class="preview-toolbar">
            <div class="canvas-label"><i></i><span id="previewLabel">Preview</span></div>
            <div class="preview-actions">
              <button class="btn" id="fitBtn">Fit</button>
              <button class="btn primary" id="playBtn">Play</button>
            </div>
          </div>
          <div class="preview-surface" id="previewSurface" data-bg="checker">
            <div class="empty-preview" id="emptyPreview">
              <img src="./assets/brand/logo-full.png" alt="Sprite Sheet Studio" style="max-width:240px;width:60%;height:auto;opacity:.9" />
              <p>Load a sprite sheet or separate frames to begin.</p>
            </div>
            <canvas id="previewCanvas" class="hidden"></canvas>
          </div>
        </div>
        <div class="source-strip">
          <div class="source-meta">
            <div class="source-name" id="sourceName">No source loaded</div>
            <div class="source-dim" id="sourceDimensions">Drop a file to begin</div>
          </div>
          <div class="source-view"><canvas id="sourceCanvas"></canvas></div>
        </div>
      </section>

      <aside class="inspector">
        <div class="panel-section">
          <div class="section-head"><h2 class="section-title">Playback</h2></div>
          <div class="field wide"><label>FPS <span id="fpsValue">8</span></label><input id="fpsInput" type="range" min="1" max="30" value="8" /></div>
          <div class="control-line"><span>Loop</span><label class="switch"><input id="loopInput" type="checkbox" checked /><span></span></label></div>
          <div class="control-line"><span>Ping-pong</span><label class="switch"><input id="pingInput" type="checkbox" /><span></span></label></div>
        </div>

        <div class="panel-section">
          <div class="section-head"><h2 class="section-title">Preview</h2></div>
          <div class="field wide"><label>Pixel zoom</label><select class="select" id="zoomSelect"><option value="1">1×</option><option value="2">2×</option><option value="3">3×</option><option value="4" selected>4×</option><option value="6">6×</option><option value="8">8×</option></select></div>
          <div class="field wide"><label>Background</label><select class="select" id="bgSelect"><option value="checker">Checkerboard</option><option value="white">White</option><option value="black">Black</option></select></div>
        </div>

        <div class="panel-section">
          <div class="section-head"><h2 class="section-title">Memory</h2><span class="section-note">guarded</span></div>
          <div class="control-line"><span>Raw estimate</span><span class="value" id="memoryValue">0 MB</span></div>
          <div class="control-line"><span>Budget</span><span class="value">${Math.round(RAM_BUDGET_BYTES / MiB)} MB</span></div>
        </div>

        <div class="panel-section">
          <div class="section-head"><h2 class="section-title">Export</h2><span class="section-note">local</span></div>
          <div class="export-grid">
            <button class="btn green export-btn" id="sheetBtn"><span>Sprite sheet PNG</span><small>horizontal strip</small></button>
            <button class="btn export-btn" id="frameBtn"><span>Current frame PNG</span><small>selected frame</small></button>
          </div>
        </div>

        <div class="panel-section">
          <div class="section-head"><h2 class="section-title">Animation info</h2></div>
          <div class="control-line"><span>Frames</span><span class="value" id="frameCount">0</span></div>
          <div class="control-line"><span>Canvas</span><span class="value" id="canvasSize">—</span></div>
          <div class="control-line"><span>Duration</span><span class="value" id="durationValue">—</span></div>
        </div>
      </aside>
    </section>

    <section class="timeline">
      <div class="timeline-bar"><div><span class="section-title">Timeline</span><span class="timeline-info" id="timelineInfo"> No frames</span></div></div>
      <div class="frames" id="frames"></div>
    </section>
  </main>
  <div class="toast" id="toast"></div>
`;

const $ = (selector) => document.querySelector(selector);
const el = {
  uploadZone: $('#uploadZone'), fileInput: $('#fileInput'), sourceCanvas: $('#sourceCanvas'), previewCanvas: $('#previewCanvas'),
  previewSurface: $('#previewSurface'), emptyPreview: $('#emptyPreview'), frames: $('#frames'), rows: $('#rowsInput'), cols: $('#colsInput'),
  fps: $('#fpsInput'), fpsValue: $('#fpsValue'), loop: $('#loopInput'), ping: $('#pingInput'), zoom: $('#zoomSelect'), bg: $('#bgSelect'),
  play: $('#playBtn'), fit: $('#fitBtn'), clear: $('#clearBtn'), demo: $('#demoBtn'), autoSlice: $('#autoSliceBtn'), applyGrid: $('#applyGridBtn'),
  duplicate: $('#duplicateBtn'), remove: $('#deleteBtn'), reverse: $('#reverseBtn'), trim: $('#trimBtn'), flipX: $('#flipXBtn'), flipY: $('#flipYBtn'), rotate: $('#rotateBtn'),
  sheet: $('#sheetBtn'), frame: $('#frameBtn'), sourceName: $('#sourceName'), sourceDimensions: $('#sourceDimensions'), frameSizeLabel: $('#frameSizeLabel'),
  frameCount: $('#frameCount'), canvasSize: $('#canvasSize'), duration: $('#durationValue'), timelineInfo: $('#timelineInfo'), previewLabel: $('#previewLabel'), toast: $('#toast'), memory: $('#memoryValue')
};

function ctx2d(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D unavailable');
  return ctx;
}

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function current() { return state.frames[state.index] || null; }
function canvasPixels(canvas) { return canvas ? canvas.width * canvas.height : 0; }
function rawProjectBytes(source = state.source, frames = state.frames) {
  return (canvasPixels(source) + frames.reduce((sum, frame) => sum + canvasPixels(frame.canvas), 0)) * 4;
}
function memoryInfo() {
  const rawBytes = rawProjectBytes();
  return { rawBytes, rawMb: rawBytes / MiB, budgetBytes: RAM_BUDGET_BYTES, budgetMb: RAM_BUDGET_BYTES / MiB, ratio: rawBytes / RAM_BUDGET_BYTES };
}
function assertDimensions(width, height) {
  if (width < 1 || height < 1) throw new Error('Image has invalid dimensions.');
  if (width > MAX_CANVAS_DIMENSION || height > MAX_CANVAS_DIMENSION) throw new Error(`Image exceeds the stable ${MAX_CANVAS_DIMENSION}px canvas dimension guard.`);
}
function assertBudget(bytes, label = 'Operation') {
  if (bytes > RAM_BUDGET_BYTES) throw new Error(`${label} would use about ${(bytes / MiB).toFixed(0)} MB raw, above the ${Math.round(RAM_BUDGET_BYTES / MiB)} MB stable budget.`);
}

function cloneCanvas(source) {
  const out = document.createElement('canvas');
  out.width = source.width; out.height = source.height;
  ctx2d(out).drawImage(source, 0, 0);
  return out;
}

function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.toast.classList.remove('show'), 2200);
}

function canvasFromBitmap(bitmap) {
  assertDimensions(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  ctx2d(canvas).drawImage(bitmap, 0, 0);
  return canvas;
}

async function decodeBitmap(file) {
  const bitmap = await createImageBitmap(file);
  try { assertDimensions(bitmap.width, bitmap.height); return bitmap; }
  catch (error) { bitmap.close(); throw error; }
}

async function fileToCanvas(file, projectedBytes = 0) {
  const bitmap = await decodeBitmap(file);
  try {
    assertBudget(projectedBytes + bitmap.width * bitmap.height * 4, 'Import');
    return canvasFromBitmap(bitmap);
  } finally { bitmap.close(); }
}

function sliceSource() {
  if (!state.source) return;
  const rows = clamp(Number(el.rows.value) || 1, 1, 128);
  const cols = clamp(Number(el.cols.value) || 1, 1, 128);
  state.rows = rows; state.cols = cols;
  const fw = Math.floor(state.source.width / cols);
  const fh = Math.floor(state.source.height / rows);
  if (fw < 1 || fh < 1) return;
  const framePixels = fw * fh * rows * cols;
  try { assertBudget((canvasPixels(state.source) + framePixels) * 4, 'Grid slicing'); }
  catch (error) { toast(error.message); return; }
  const frames = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const c = document.createElement('canvas'); c.width = fw; c.height = fh;
      ctx2d(c).drawImage(state.source, x * fw, y * fh, fw, fh, 0, 0, fw, fh);
      frames.push({ id: uid(), name: `frame-${String(frames.length + 1).padStart(3, '0')}.png`, canvas: c });
    }
  }
  state.frames = frames; state.index = 0; state.playing = false; state.direction = 1;
  el.frameSizeLabel.textContent = `${fw}×${fh}`;
  renderAll();
}

function transparentBands(canvas, axis) {
  const ctx = ctx2d(canvas); const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const length = axis === 'x' ? canvas.width : canvas.height;
  const cross = axis === 'x' ? canvas.height : canvas.width;
  const empty = new Array(length).fill(true);
  for (let a = 0; a < length; a++) {
    for (let b = 0; b < cross; b++) {
      const x = axis === 'x' ? a : b; const y = axis === 'x' ? b : a;
      if (data[(y * canvas.width + x) * 4 + 3] > 8) { empty[a] = false; break; }
    }
  }
  const groups = []; let start = null;
  for (let i = 0; i <= length; i++) {
    const isEmpty = i < length ? empty[i] : true;
    if (!isEmpty && start === null) start = i;
    if (isEmpty && start !== null) { groups.push([start, i - 1]); start = null; }
  }
  return groups;
}

function autoSlice() {
  if (!state.source) return toast('Load a sprite sheet first');
  if (canvasPixels(state.source) > AUTO_SLICE_PIXEL_LIMIT) return toast('Auto Slice guard: large source. Set the grid manually or use Tools → Object Slice.');
  const xs = transparentBands(state.source, 'x');
  const ys = transparentBands(state.source, 'y');
  if (xs.length > 1 || ys.length > 1) {
    el.cols.value = String(Math.max(1, xs.length)); el.rows.value = String(Math.max(1, ys.length));
    toast(`Detected ${Math.max(1, xs.length)}×${Math.max(1, ys.length)}`);
  } else toast('No transparent gutters detected; using current grid');
  sliceSource();
}

function trimCanvas(source) {
  if (canvasPixels(source) > TRIM_PIXEL_LIMIT) throw new Error('Trim guard: use Tools → Cleanup+ for very large frames.');
  const ctx = ctx2d(source); const img = ctx.getImageData(0, 0, source.width, source.height); const d = img.data;
  let minX = source.width, minY = source.height, maxX = -1, maxY = -1;
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    if (d[(y * source.width + x) * 4 + 3] > 0) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  }
  if (maxX < minX) return cloneCanvas(source);
  const out = document.createElement('canvas'); out.width = maxX - minX + 1; out.height = maxY - minY + 1;
  ctx2d(out).drawImage(source, minX, minY, out.width, out.height, 0, 0, out.width, out.height); return out;
}

function transformCurrent(kind) {
  const frame = current(); if (!frame) return;
  try {
    const src = frame.canvas; let out = document.createElement('canvas');
    if (kind === 'trim') out = trimCanvas(src);
    else if (kind === 'rotate') { out.width = src.height; out.height = src.width; const c = ctx2d(out); c.translate(out.width, 0); c.rotate(Math.PI / 2); c.drawImage(src, 0, 0); }
    else { out.width = src.width; out.height = src.height; const c = ctx2d(out); if (kind === 'flipX') { c.translate(out.width, 0); c.scale(-1, 1); } else { c.translate(0, out.height); c.scale(1, -1); } c.drawImage(src, 0, 0); }
    frame.canvas = out; renderAll();
  } catch (error) { console.error(error); toast(error.message || 'Transform failed'); }
}

function renderPreview() {
  const frame = current();
  if (!frame) { el.previewCanvas.classList.add('hidden'); el.emptyPreview.classList.remove('hidden'); el.previewLabel.textContent = 'Preview'; return; }
  el.emptyPreview.classList.add('hidden'); el.previewCanvas.classList.remove('hidden');
  const c = el.previewCanvas; c.width = frame.canvas.width; c.height = frame.canvas.height;
  ctx2d(c).drawImage(frame.canvas, 0, 0); c.style.width = `${frame.canvas.width * state.zoom}px`; c.style.height = `${frame.canvas.height * state.zoom}px`;
  el.previewLabel.textContent = `${state.index + 1} / ${state.frames.length}`;
}

function renderSource() {
  const c = el.sourceCanvas; const ctx = ctx2d(c);
  if (!state.source) { c.width = 1; c.height = 1; ctx.clearRect(0, 0, 1, 1); return; }
  c.width = state.source.width; c.height = state.source.height; ctx.drawImage(state.source, 0, 0);
}

function renderTimeline() {
  el.frames.innerHTML = '';
  state.frames.forEach((frame, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = `frame-card${i === state.index ? ' active' : ''}`;
    const c = document.createElement('canvas'); const scale = Math.min(64 / frame.canvas.width, 56 / frame.canvas.height, 1);
    c.width = Math.max(1, Math.round(frame.canvas.width * scale)); c.height = Math.max(1, Math.round(frame.canvas.height * scale)); ctx2d(c).drawImage(frame.canvas, 0, 0, c.width, c.height);
    const label = document.createElement('span'); label.textContent = String(i + 1); b.append(c, label); b.addEventListener('click', () => { state.index = i; renderPreview(); renderTimeline(); }); el.frames.append(b);
  });
}

function renderInfo() {
  const frame = current(); el.frameCount.textContent = String(state.frames.length); el.timelineInfo.textContent = state.frames.length ? ` ${state.frames.length} frames` : ' No frames';
  el.canvasSize.textContent = frame ? `${frame.canvas.width}×${frame.canvas.height}` : '—'; el.duration.textContent = state.frames.length ? `${(state.frames.length / state.fps).toFixed(2)}s` : '—';
  el.sourceName.textContent = state.sourceName || 'No source loaded'; el.sourceDimensions.textContent = state.source ? `${state.source.width}×${state.source.height}` : 'Drop a file to begin';
  el.play.textContent = state.playing ? 'Pause' : 'Play';
  const memory = memoryInfo(); el.memory.textContent = `${memory.rawMb.toFixed(1)} MB`;
}

function renderAll() { renderSource(); renderPreview(); renderTimeline(); renderInfo(); }

async function loadFiles(files) {
  const list = [...files]; if (!list.length) return;
  state.playing = false;
  if (list.length === 1) {
    const bitmap = await decodeBitmap(list[0]);
    try {
      const pixels = bitmap.width * bitmap.height;
      assertBudget(pixels * 8, 'Single-sheet import + initial frame');
      const canvas = canvasFromBitmap(bitmap);
      state.source = canvas; state.sourceName = list[0].name; el.rows.value = '1'; el.cols.value = '1'; sliceSource();
    } finally { bitmap.close(); }
  } else {
    const frames = [];
    let projectedBytes = 0;
    const sorted = list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    for (const file of sorted) {
      const bitmap = await decodeBitmap(file);
      try {
        projectedBytes += bitmap.width * bitmap.height * 4;
        assertBudget(projectedBytes, 'Separate-frame import');
        frames.push({ id: uid(), name: file.name, canvas: canvasFromBitmap(bitmap) });
      } finally { bitmap.close(); }
      if (frames.length % 8 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    state.source = null; state.sourceName = `${frames.length} separate frames`; state.frames = frames; state.index = 0; renderAll();
  }
}

function replaceFrames(frames, sourceName = 'Processed frames') {
  const normalized = frames.map((frame, index) => ({ id: frame.id || uid(), name: frame.name || `frame-${String(index + 1).padStart(3, '0')}.png`, canvas: frame.canvas }));
  assertBudget((canvasPixels(state.source) + normalized.reduce((sum, frame) => sum + canvasPixels(frame.canvas), 0)) * 4, 'Replace frames');
  state.frames = normalized; state.sourceName = sourceName; state.index = 0; state.playing = false; state.direction = 1; renderAll();
}

function clearAll() { state.source = null; state.sourceName = ''; state.frames = []; state.index = 0; state.playing = false; renderAll(); }
function duplicate() {
  const f = current(); if (!f) return;
  try { assertBudget(rawProjectBytes() + canvasPixels(f.canvas) * 4, 'Duplicate frame'); }
  catch (error) { return toast(error.message); }
  state.frames.splice(state.index + 1, 0, { id: uid(), name: f.name.replace(/\.png$/i, '-copy.png'), canvas: cloneCanvas(f.canvas) }); state.index++; renderAll();
}
function remove() { if (!state.frames.length) return; state.frames.splice(state.index, 1); state.index = clamp(state.index, 0, Math.max(0, state.frames.length - 1)); renderAll(); }
function reverse() { state.frames.reverse(); state.index = Math.max(0, state.frames.length - 1 - state.index); renderAll(); }

function advance() {
  if (state.frames.length < 2) return;
  if (state.pingPong) {
    let next = state.index + state.direction;
    if (next >= state.frames.length || next < 0) { state.direction *= -1; next = state.index + state.direction; if (!state.loop && next <= 0) state.playing = false; }
    state.index = clamp(next, 0, state.frames.length - 1);
  } else {
    if (state.index >= state.frames.length - 1) { if (state.loop) state.index = 0; else state.playing = false; }
    else state.index++;
  }
  renderPreview(); renderTimeline(); renderInfo();
}

function tick(now) {
  if (state.playing && state.frames.length) {
    const delay = 1000 / state.fps;
    if (now - state.lastTick >= delay) { state.lastTick = now; advance(); }
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

function downloadCanvas(canvas, name) {
  canvas.toBlob((blob) => { if (!blob) return; const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }, 'image/png');
}

function exportSheet() {
  if (!state.frames.length) return;
  const w = Math.max(...state.frames.map((f) => f.canvas.width)); const h = Math.max(...state.frames.map((f) => f.canvas.height));
  const outWidth = w * state.frames.length;
  if (outWidth > MAX_CANVAS_DIMENSION || h > MAX_CANVAS_DIMENSION || outWidth * h > SINGLE_SHEET_PIXEL_LIMIT) return toast('Single-sheet export guard: use Tools → Export+ for paged atlases.');
  const out = document.createElement('canvas'); out.width = outWidth; out.height = h; const ctx = ctx2d(out); ctx.imageSmoothingEnabled = false;
  state.frames.forEach((f, i) => ctx.drawImage(f.canvas, i * w + Math.floor((w - f.canvas.width) / 2), h - f.canvas.height)); downloadCanvas(out, 'sprite-sheet.png');
}

function demo() {
  state.source = null; state.sourceName = 'Built-in demo'; state.frames = [];
  for (let i = 0; i < 4; i++) { const c = document.createElement('canvas'); c.width = 32; c.height = 32; const x = ctx2d(c); x.imageSmoothingEnabled = false; x.fillStyle = '#1687ff'; x.fillRect(10, 8 + (i % 2), 12, 16); x.fillStyle = '#16c79a'; x.fillRect(12, 4 + (i % 2), 8, 6); x.fillStyle = '#fff'; x.fillRect(13, 13, 6, 3); state.frames.push({ id: uid(), name: `demo-${i + 1}.png`, canvas: c }); }
  state.index = 0; renderAll();
}

el.uploadZone.addEventListener('click', () => el.fileInput.click());
el.fileInput.addEventListener('change', () => loadFiles(el.fileInput.files).catch((e) => { console.error(e); toast(e.message || 'Could not load image'); }));
['dragenter','dragover'].forEach((name) => el.uploadZone.addEventListener(name, (e) => { e.preventDefault(); el.uploadZone.classList.add('dragging'); }));
['dragleave','drop'].forEach((name) => el.uploadZone.addEventListener(name, (e) => { e.preventDefault(); el.uploadZone.classList.remove('dragging'); }));
el.uploadZone.addEventListener('drop', (e) => loadFiles(e.dataTransfer.files).catch((error) => { console.error(error); toast(error.message || 'Could not load image'); }));
el.demo.addEventListener('click', demo); el.clear.addEventListener('click', clearAll); el.applyGrid.addEventListener('click', sliceSource); el.autoSlice.addEventListener('click', autoSlice);
el.duplicate.addEventListener('click', duplicate); el.remove.addEventListener('click', remove); el.reverse.addEventListener('click', reverse); el.trim.addEventListener('click', () => transformCurrent('trim')); el.flipX.addEventListener('click', () => transformCurrent('flipX')); el.flipY.addEventListener('click', () => transformCurrent('flipY')); el.rotate.addEventListener('click', () => transformCurrent('rotate'));
el.play.addEventListener('click', () => { if (!state.frames.length) return; state.playing = !state.playing; state.lastTick = performance.now(); renderInfo(); });
el.fps.addEventListener('input', () => { state.fps = Number(el.fps.value) || 8; el.fpsValue.textContent = String(state.fps); renderInfo(); });
el.loop.addEventListener('change', () => state.loop = el.loop.checked); el.ping.addEventListener('change', () => state.pingPong = el.ping.checked);
el.zoom.addEventListener('change', () => { state.zoom = Number(el.zoom.value) || 4; renderPreview(); });
el.bg.addEventListener('change', () => { state.bg = el.bg.value; el.previewSurface.dataset.bg = state.bg; });
el.fit.addEventListener('click', () => { const f = current(); if (!f) return; const rect = el.previewSurface.getBoundingClientRect(); const z = Math.max(1, Math.min(8, Math.floor(Math.min((rect.width - 40) / f.canvas.width, (rect.height - 40) / f.canvas.height)))); state.zoom = z; el.zoom.value = String([1,2,3,4,6,8].reduce((a,b) => Math.abs(b-z) < Math.abs(a-z) ? b : a)); renderPreview(); });
el.sheet.addEventListener('click', exportSheet); el.frame.addEventListener('click', () => { const f = current(); if (f) downloadCanvas(f.canvas, f.name || 'frame.png'); });
document.addEventListener('keydown', (e) => { if (e.code === 'Space' && !/input|select|textarea/i.test(document.activeElement?.tagName || '')) { e.preventDefault(); el.play.click(); } if (e.key === 'ArrowRight' && state.frames.length) { state.index = Math.min(state.frames.length - 1, state.index + 1); renderPreview(); renderTimeline(); } if (e.key === 'ArrowLeft' && state.frames.length) { state.index = Math.max(0, state.index - 1); renderPreview(); renderTimeline(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && state.playing) { state.playing = false; renderInfo(); } });

globalThis.__SSSStableCore = {
  state,
  getFrames: () => state.frames,
  getCurrentFrame: () => current(),
  getSource: () => state.source,
  cloneCanvas,
  replaceFrames,
  loadFiles,
  render: renderAll,
  toast,
  memoryInfo,
  budgetBytes: RAM_BUDGET_BYTES,
  assertBudget
};

renderAll();
document.documentElement.dataset.sssReady = 'stable';
document.documentElement.dataset.sssCore = 'v2';
