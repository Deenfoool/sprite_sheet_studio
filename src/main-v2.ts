import './styles.css';
import './smart-tools.css';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { zipSync } from 'fflate';
import {
  type AnchorMode,
  alignCanvases,
  cloneCanvas,
  get2d,
  opaqueBounds,
  suggestTransparentGrid,
  trimTransparent
} from './sprite-tools';

type SpriteFrame = {
  id: string;
  name: string;
  canvas: HTMLCanvasElement;
  hold: number;
};

type PreviewBackground = 'checker' | 'white' | 'black';

type AppState = {
  source: ImageBitmap | null;
  sourceName: string;
  frames: SpriteFrame[];
  currentIndex: number;
  playing: boolean;
  playbackCursor: number;
  lastAdvance: number;
  rows: number;
  cols: number;
  paddingX: number;
  paddingY: number;
  spacingX: number;
  spacingY: number;
  fps: number;
  loop: boolean;
  pingPong: boolean;
  zoom: number;
  previewBg: PreviewBackground;
  anchorMode: AnchorMode;
  onionSkin: boolean;
  onionOpacity: number;
};

const state: AppState = {
  source: null,
  sourceName: 'No source loaded',
  frames: [],
  currentIndex: 0,
  playing: false,
  playbackCursor: 0,
  lastAdvance: performance.now(),
  rows: 1,
  cols: 1,
  paddingX: 0,
  paddingY: 0,
  spacingX: 0,
  spacingY: 0,
  fps: 8,
  loop: true,
  pingPong: false,
  zoom: 4,
  previewBg: 'checker',
  anchorMode: 'bottom-center',
  onionSkin: false,
  onionOpacity: 0.24
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

app.innerHTML = `
  <main class="app-shell">
    <header class="topbar">
      <div class="brand">
        <img class="brand-logo" src="./logo-mark.svg" alt="" aria-hidden="true" />
        <div class="brand-copy">
          <div class="brand-title">Sprite Sheet <strong>Studio</strong></div>
          <div class="brand-subtitle">Upload → Slice → Align → Animate → Export</div>
        </div>
      </div>
      <div class="top-actions">
        <span class="badge">LOCAL-FIRST</span>
        <span class="badge smart-badge">SMART TOOLS</span>
        <button class="btn" id="demoBtn">Try demo</button>
        <button class="btn danger" id="clearBtn" disabled>Clear</button>
      </div>
    </header>

    <section class="workspace">
      <aside class="sidebar">
        <div class="panel-section">
          <div class="section-head">
            <h2 class="section-title">Import</h2>
            <span class="section-note">PNG / WebP</span>
          </div>
          <div class="upload-zone" id="uploadZone" tabindex="0" role="button" aria-label="Import sprite sheet or frames">
            <div>
              <div class="upload-icon">＋</div>
              <div class="upload-title">Drop sprite sheet here</div>
              <div class="upload-sub">or click to browse. Multiple files become an animation sequence.</div>
            </div>
          </div>
          <input id="fileInput" class="hidden" type="file" accept="image/png,image/webp" multiple />
          <div class="privacy-line"><b>●</b><span>Images stay in your browser. Nothing is uploaded.</span></div>
        </div>

        <div class="panel-section smart-panel">
          <div class="section-head">
            <h2 class="section-title">Smart tools</h2>
            <span class="section-note">alpha-aware</span>
          </div>
          <button class="btn smart-action" id="autoSliceBtn" disabled>
            <span><b>Auto Slice</b><small>detect rows & columns</small></span><i>✦</i>
          </button>
          <div class="smart-divider"></div>
          <div class="field wide">
            <label for="anchorSelect">Alignment anchor</label>
            <select class="select" id="anchorSelect">
              <option value="bottom-center">Feet / bottom center</option>
              <option value="center">Bounding center</option>
              <option value="center-mass">Center of mass</option>
            </select>
          </div>
          <div class="btn-row smart-buttons">
            <button class="btn grow" id="trimBtn" disabled>Trim transparent</button>
            <button class="btn grow" id="alignBtn" disabled>Auto Align</button>
          </div>
          <div class="smart-status" id="smartStatus">Load a sheet to enable automatic cleanup.</div>
        </div>

        <div class="panel-section">
          <div class="section-head">
            <h2 class="section-title">Slice grid</h2>
            <span class="section-note" id="frameSizeLabel">—</span>
          </div>
          <div class="field-grid">
            <div class="field"><label for="colsInput">Columns</label><input class="control" id="colsInput" type="number" min="1" max="128" value="1" /></div>
            <div class="field"><label for="rowsInput">Rows</label><input class="control" id="rowsInput" type="number" min="1" max="128" value="1" /></div>
            <div class="field"><label for="paddingXInput">Padding X</label><input class="control" id="paddingXInput" type="number" min="0" value="0" /></div>
            <div class="field"><label for="paddingYInput">Padding Y</label><input class="control" id="paddingYInput" type="number" min="0" value="0" /></div>
            <div class="field"><label for="spacingXInput">Spacing X</label><input class="control" id="spacingXInput" type="number" min="0" value="0" /></div>
            <div class="field"><label for="spacingYInput">Spacing Y</label><input class="control" id="spacingYInput" type="number" min="0" value="0" /></div>
          </div>
          <div class="btn-row" style="margin-top:10px">
            <button class="btn grow" id="resliceBtn" disabled>Apply grid</button>
          </div>
        </div>

        <div class="panel-section">
          <div class="section-head"><h2 class="section-title">Frame tools</h2></div>
          <div class="btn-row">
            <button class="btn" id="duplicateBtn" disabled>Duplicate</button>
            <button class="btn" id="deleteBtn" disabled>Delete</button>
            <button class="btn" id="reverseBtn" disabled>Reverse</button>
          </div>
        </div>
      </aside>

      <section class="canvas-stage">
        <div class="preview-stage">
          <div class="preview-toolbar">
            <div class="canvas-label"><i></i><span id="previewLabel">Preview</span></div>
            <div class="preview-actions">
              <button class="btn" id="fitBtn" disabled>Fit</button>
              <button class="btn primary" id="playBtn" disabled>▶ Play</button>
            </div>
          </div>
          <div class="preview-surface" id="previewSurface" data-bg="checker">
            <div class="empty-preview" id="emptyPreview">
              <div class="big">Your animation appears here</div>
              <p>Load a sprite sheet or separate frames, then use Smart tools to clean and align them.</p>
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
          <div class="field wide" style="margin-bottom:10px">
            <label for="fpsInput">FPS <span id="fpsValue">8</span></label>
            <input id="fpsInput" type="range" min="1" max="30" value="8" />
          </div>
          <div class="control-line"><span>Loop</span><label class="switch"><input id="loopInput" type="checkbox" checked /><span></span></label></div>
          <div class="control-line"><span>Ping-pong</span><label class="switch"><input id="pingPongInput" type="checkbox" /><span></span></label></div>
        </div>

        <div class="panel-section">
          <div class="section-head"><h2 class="section-title">Preview</h2></div>
          <div class="field wide" style="margin-bottom:9px"><label for="zoomSelect">Pixel zoom</label><select class="select" id="zoomSelect"><option value="1">1×</option><option value="2">2×</option><option value="3">3×</option><option value="4" selected>4×</option><option value="6">6×</option><option value="8">8×</option></select></div>
          <div class="field wide"><label for="bgSelect">Background</label><select class="select" id="bgSelect"><option value="checker">Checkerboard</option><option value="white">White</option><option value="black">Black</option></select></div>
        </div>

        <div class="panel-section">
          <div class="section-head"><h2 class="section-title">Cleanup info</h2></div>
          <div class="control-line"><span>Opaque bounds</span><span class="value" id="opaqueSize">—</span></div>
          <div class="control-line"><span>Anchor</span><span class="value" id="anchorInfo">Feet</span></div>
          <div class="control-line"><span>Transparent area</span><span class="value" id="transparentInfo">—</span></div>
        </div>

        <div class="panel-section">
          <div class="section-head"><h2 class="section-title">Frame animation</h2><span class="section-note">current frame</span></div>
          <div class="field wide" style="margin-bottom:9px"><label for="holdInput">Frame hold ×<span id="holdValue">1</span></label><input id="holdInput" type="range" min="1" max="8" value="1" /></div>
          <div class="control-line"><span>Onion skin</span><label class="switch"><input id="onionInput" type="checkbox" /><span></span></label></div>
          <div class="field wide" id="onionOpacityField"><label for="onionOpacityInput">Ghost opacity <span id="onionOpacityValue">24%</span></label><input id="onionOpacityInput" type="range" min="5" max="60" value="24" /></div>
          <div class="btn-row transform-row">
            <button class="btn grow" id="flipXBtn" disabled>Flip X</button>
            <button class="btn grow" id="flipYBtn" disabled>Flip Y</button>
            <button class="btn grow" id="rotateBtn" disabled>Rotate 90°</button>
          </div>
        </div>

        <div class="panel-section">
          <div class="section-head"><h2 class="section-title">Export</h2><span class="section-note">client-side</span></div>
          <div class="export-grid">
            <button class="btn green export-btn" id="gifBtn" disabled><span>Animated GIF</span><small>loop settings</small></button>
            <button class="btn export-btn" id="sheetBtn" disabled><span>Sprite sheet PNG</span><small>horizontal strip</small></button>
            <button class="btn export-btn" id="sequenceBtn" disabled><span>PNG sequence</span><small>ZIP archive</small></button>
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
      <div class="timeline-bar">
        <div><span class="section-title">Timeline</span><span class="timeline-info" id="timelineInfo">&nbsp; No frames</span></div>
        <div class="timeline-actions"><span class="timeline-info">Drag frames to reorder · ← → select · Space play</span></div>
      </div>
      <div class="frames" id="frames"></div>
    </section>
  </main>
  <div class="toast" id="toast"></div>
`;

function q<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`Missing element ${selector}`);
  return node;
}

const el = {
  uploadZone: q<HTMLDivElement>('#uploadZone'),
  fileInput: q<HTMLInputElement>('#fileInput'),
  sourceCanvas: q<HTMLCanvasElement>('#sourceCanvas'),
  previewCanvas: q<HTMLCanvasElement>('#previewCanvas'),
  previewSurface: q<HTMLDivElement>('#previewSurface'),
  emptyPreview: q<HTMLDivElement>('#emptyPreview'),
  frames: q<HTMLDivElement>('#frames'),
  rows: q<HTMLInputElement>('#rowsInput'),
  cols: q<HTMLInputElement>('#colsInput'),
  paddingX: q<HTMLInputElement>('#paddingXInput'),
  paddingY: q<HTMLInputElement>('#paddingYInput'),
  spacingX: q<HTMLInputElement>('#spacingXInput'),
  spacingY: q<HTMLInputElement>('#spacingYInput'),
  fps: q<HTMLInputElement>('#fpsInput'),
  fpsValue: q<HTMLSpanElement>('#fpsValue'),
  loop: q<HTMLInputElement>('#loopInput'),
  pingPong: q<HTMLInputElement>('#pingPongInput'),
  zoom: q<HTMLSelectElement>('#zoomSelect'),
  bg: q<HTMLSelectElement>('#bgSelect'),
  anchor: q<HTMLSelectElement>('#anchorSelect'),
  play: q<HTMLButtonElement>('#playBtn'),
  fit: q<HTMLButtonElement>('#fitBtn'),
  clear: q<HTMLButtonElement>('#clearBtn'),
  demo: q<HTMLButtonElement>('#demoBtn'),
  autoSlice: q<HTMLButtonElement>('#autoSliceBtn'),
  trim: q<HTMLButtonElement>('#trimBtn'),
  align: q<HTMLButtonElement>('#alignBtn'),
  reslice: q<HTMLButtonElement>('#resliceBtn'),
  duplicate: q<HTMLButtonElement>('#duplicateBtn'),
  remove: q<HTMLButtonElement>('#deleteBtn'),
  reverse: q<HTMLButtonElement>('#reverseBtn'),
  gif: q<HTMLButtonElement>('#gifBtn'),
  sheet: q<HTMLButtonElement>('#sheetBtn'),
  sequence: q<HTMLButtonElement>('#sequenceBtn'),
  sourceName: q<HTMLDivElement>('#sourceName'),
  sourceDimensions: q<HTMLDivElement>('#sourceDimensions'),
  frameSizeLabel: q<HTMLSpanElement>('#frameSizeLabel'),
  frameCount: q<HTMLSpanElement>('#frameCount'),
  canvasSize: q<HTMLSpanElement>('#canvasSize'),
  duration: q<HTMLSpanElement>('#durationValue'),
  timelineInfo: q<HTMLSpanElement>('#timelineInfo'),
  previewLabel: q<HTMLSpanElement>('#previewLabel'),
  smartStatus: q<HTMLDivElement>('#smartStatus'),
  opaqueSize: q<HTMLSpanElement>('#opaqueSize'),
  anchorInfo: q<HTMLSpanElement>('#anchorInfo'),
  transparentInfo: q<HTMLSpanElement>('#transparentInfo'),
  hold: q<HTMLInputElement>('#holdInput'),
  holdValue: q<HTMLSpanElement>('#holdValue'),
  onion: q<HTMLInputElement>('#onionInput'),
  onionOpacity: q<HTMLInputElement>('#onionOpacityInput'),
  onionOpacityValue: q<HTMLSpanElement>('#onionOpacityValue'),
  flipX: q<HTMLButtonElement>('#flipXBtn'),
  flipY: q<HTMLButtonElement>('#flipYBtn'),
  rotate: q<HTMLButtonElement>('#rotateBtn'),
  toast: q<HTMLDivElement>('#toast')
};

function uid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function clampInt(value: string, min: number, max = Number.MAX_SAFE_INTEGER): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

async function loadFiles(fileList: FileList | File[]): Promise<void> {
  const files = Array.from(fileList).filter((file) => /^image\/(png|webp)$/i.test(file.type));
  if (!files.length) return toast('Please choose PNG or WebP files.', true);
  stopPlayback();

  try {
    if (files.length === 1) {
      state.source?.close();
      state.source = await createImageBitmap(files[0]);
      state.sourceName = files[0].name;
      Object.assign(state, { rows: 1, cols: 1, paddingX: 0, paddingY: 0, spacingX: 0, spacingY: 0 });
      syncSliceInputs();
      sliceSource();
      el.smartStatus.textContent = 'Ready. Try Auto Slice, then Trim / Auto Align.';
      toast(`Loaded ${files[0].name}`);
    } else {
      state.source?.close();
      state.source = null;
      state.sourceName = `${files.length} separate frames`;
      const decoded = await Promise.all(files.map(async (file) => ({ file, bitmap: await createImageBitmap(file) })));
      decoded.sort((a, b) => naturalCompare(a.file.name, b.file.name));
      state.frames = decoded.map(({ file, bitmap }) => {
        const canvas = createCanvas(bitmap.width, bitmap.height);
        get2d(canvas).drawImage(bitmap, 0, 0);
        bitmap.close();
        return { id: uid(), name: file.name, canvas, hold: 1 };
      });
      state.currentIndex = 0;
      drawSourcePlaceholder();
      renderAll();
      el.smartStatus.textContent = 'Sequence loaded. Trim and Auto Align are available.';
      toast(`Loaded ${files.length} frames`);
    }
  } catch (error) {
    console.error(error);
    toast('Could not decode one of the images.', true);
  }
}

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function syncSliceInputs(): void {
  el.rows.value = String(state.rows);
  el.cols.value = String(state.cols);
  el.paddingX.value = String(state.paddingX);
  el.paddingY.value = String(state.paddingY);
  el.spacingX.value = String(state.spacingX);
  el.spacingY.value = String(state.spacingY);
}

function readSliceInputs(): void {
  state.rows = clampInt(el.rows.value, 1, 128);
  state.cols = clampInt(el.cols.value, 1, 128);
  state.paddingX = clampInt(el.paddingX.value, 0, 100000);
  state.paddingY = clampInt(el.paddingY.value, 0, 100000);
  state.spacingX = clampInt(el.spacingX.value, 0, 100000);
  state.spacingY = clampInt(el.spacingY.value, 0, 100000);
  syncSliceInputs();
}

function sliceSource(): void {
  if (!state.source) return;
  readSliceInputs();
  const usableW = state.source.width - state.paddingX * 2 - state.spacingX * (state.cols - 1);
  const usableH = state.source.height - state.paddingY * 2 - state.spacingY * (state.rows - 1);
  const frameW = Math.floor(usableW / state.cols);
  const frameH = Math.floor(usableH / state.rows);
  if (frameW < 1 || frameH < 1) return toast('Grid settings leave no room for a frame.', true);

  const frames: SpriteFrame[] = [];
  let index = 0;
  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const sx = state.paddingX + col * (frameW + state.spacingX);
      const sy = state.paddingY + row * (frameH + state.spacingY);
      const canvas = createCanvas(frameW, frameH);
      get2d(canvas).drawImage(state.source, sx, sy, frameW, frameH, 0, 0, frameW, frameH);
      frames.push({ id: uid(), name: `frame_${String(index + 1).padStart(2, '0')}.png`, canvas, hold: 1 });
      index += 1;
    }
  }
  state.frames = frames;
  state.currentIndex = 0;
  drawSourceWithGrid(frameW, frameH);
  renderAll();
}

function autoSliceSource(): void {
  if (!state.source) return;
  const suggestion = suggestTransparentGrid(state.source, state.source.width, state.source.height);
  if (!suggestion) {
    el.smartStatus.textContent = 'No reliable transparent separators found. Use the manual grid.';
    toast('Auto Slice could not find a reliable grid.', true);
    return;
  }

  state.rows = suggestion.rows;
  state.cols = suggestion.cols;
  state.paddingX = state.paddingY = state.spacingX = state.spacingY = 0;
  syncSliceInputs();
  sliceSource();
  const confidence = Math.round(suggestion.confidence * 100);
  el.smartStatus.innerHTML = `Detected <b>${state.cols} × ${state.rows}</b> grid · confidence ${confidence}%`;
  toast(`Auto Slice: ${state.cols} columns × ${state.rows} rows`);
}

function trimAllFrames(): void {
  if (!state.frames.length) return;
  stopPlayback();
  const before = normalizedSize();
  state.frames = state.frames.map((frame) => ({ ...frame, canvas: trimTransparent(frame.canvas) }));
  const after = normalizedSize();
  renderAll();
  el.smartStatus.innerHTML = `Trimmed transparent edges · <b>${before.width}×${before.height}</b> → <b>${after.width}×${after.height}</b>`;
  toast('Transparent edges trimmed');
}

function alignAllFrames(): void {
  if (!state.frames.length) return;
  stopPlayback();
  const trimmed = state.frames.map((frame) => trimTransparent(frame.canvas));
  const aligned = alignCanvases(trimmed, state.anchorMode);
  state.frames = state.frames.map((frame, index) => ({ ...frame, canvas: aligned[index] }));
  state.currentIndex = Math.min(state.currentIndex, state.frames.length - 1);
  renderAll();
  const size = normalizedSize();
  const labels: Record<AnchorMode, string> = { 'bottom-center': 'feet', center: 'center', 'center-mass': 'center of mass' };
  el.smartStatus.innerHTML = `Aligned ${state.frames.length} frames by <b>${labels[state.anchorMode]}</b> · ${size.width}×${size.height}`;
  toast('Frames aligned and normalized');
}

function drawSourceWithGrid(frameW?: number, frameH?: number): void {
  if (!state.source) return drawSourcePlaceholder();
  el.sourceCanvas.width = state.source.width;
  el.sourceCanvas.height = state.source.height;
  const ctx = get2d(el.sourceCanvas);
  ctx.clearRect(0, 0, el.sourceCanvas.width, el.sourceCanvas.height);
  ctx.drawImage(state.source, 0, 0);
  const usableW = state.source.width - state.paddingX * 2 - state.spacingX * (state.cols - 1);
  const usableH = state.source.height - state.paddingY * 2 - state.spacingY * (state.rows - 1);
  const fw = frameW ?? Math.floor(usableW / state.cols);
  const fh = frameH ?? Math.floor(usableH / state.rows);
  ctx.save();
  ctx.strokeStyle = '#29a5ff';
  ctx.lineWidth = Math.max(1, Math.min(el.sourceCanvas.width, el.sourceCanvas.height) / 350);
  ctx.setLineDash([ctx.lineWidth * 5, ctx.lineWidth * 3]);
  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const x = state.paddingX + col * (fw + state.spacingX);
      const y = state.paddingY + row * (fh + state.spacingY);
      ctx.strokeRect(x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, fw - ctx.lineWidth, fh - ctx.lineWidth);
    }
  }
  ctx.restore();
}

function drawSourcePlaceholder(): void {
  el.sourceCanvas.width = 1;
  el.sourceCanvas.height = 1;
  get2d(el.sourceCanvas).clearRect(0, 0, 1, 1);
}

function playbackSequence(): number[] {
  const base = state.frames.map((_, index) => index);
  if (!state.pingPong || base.length < 3) return base;
  return [...base, ...base.slice(1, -1).reverse()];
}

function startPlayback(): void {
  if (!state.frames.length) return;
  state.playing = true;
  const sequence = playbackSequence();
  state.playbackCursor = Math.max(0, sequence.indexOf(state.currentIndex));
  state.lastAdvance = performance.now();
  updatePlayButton();
}

function stopPlayback(): void {
  state.playing = false;
  updatePlayButton();
}

function advancePlayback(): void {
  const sequence = playbackSequence();
  if (!sequence.length) return;
  state.playbackCursor += 1;
  if (state.playbackCursor >= sequence.length) {
    if (state.loop) state.playbackCursor = 0;
    else {
      state.playbackCursor = sequence.length - 1;
      stopPlayback();
    }
  }
  state.currentIndex = sequence[state.playbackCursor] ?? 0;
  renderPreview();
  renderTimelineActive();
}

function tick(now: number): void {
  if (state.playing && state.frames.length) {
    const currentHold = state.frames[state.currentIndex]?.hold ?? 1;
    const delay = (1000 / state.fps) * currentHold;
    if (now - state.lastAdvance >= delay) {
      state.lastAdvance = now - ((now - state.lastAdvance) % delay);
      advancePlayback();
    }
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

function updatePlayButton(): void {
  el.play.textContent = state.playing ? '❚❚ Pause' : '▶ Play';
}

function normalizedSize(): { width: number; height: number } {
  return state.frames.reduce((acc, frame) => ({
    width: Math.max(acc.width, frame.canvas.width),
    height: Math.max(acc.height, frame.canvas.height)
  }), { width: 1, height: 1 });
}

function drawNormalizedFrame(frame: SpriteFrame): HTMLCanvasElement {
  const { width, height } = normalizedSize();
  const canvas = createCanvas(width, height);
  const x = Math.floor((width - frame.canvas.width) / 2);
  const y = height - frame.canvas.height;
  get2d(canvas).drawImage(frame.canvas, x, y);
  return canvas;
}

function renderPreview(): void {
  if (!state.frames.length) {
    el.previewCanvas.classList.add('hidden');
    el.emptyPreview.classList.remove('hidden');
    el.previewLabel.textContent = 'Preview';
    return;
  }
  state.currentIndex = Math.min(state.currentIndex, state.frames.length - 1);
  const frame = state.frames[state.currentIndex];
  const normalized = drawNormalizedFrame(frame);
  el.previewCanvas.width = normalized.width;
  el.previewCanvas.height = normalized.height;
  const previewCtx = get2d(el.previewCanvas);
  previewCtx.clearRect(0, 0, normalized.width, normalized.height);
  if (state.onionSkin && state.frames.length > 1) {
    const prevIndex = Math.max(0, state.currentIndex - 1);
    const nextIndex = Math.min(state.frames.length - 1, state.currentIndex + 1);
    previewCtx.globalAlpha = state.onionOpacity;
    if (prevIndex !== state.currentIndex) previewCtx.drawImage(drawNormalizedFrame(state.frames[prevIndex]), 0, 0);
    if (nextIndex !== state.currentIndex) previewCtx.drawImage(drawNormalizedFrame(state.frames[nextIndex]), 0, 0);
    previewCtx.globalAlpha = 1;
  }
  previewCtx.drawImage(normalized, 0, 0);
  el.previewCanvas.style.width = `${normalized.width * state.zoom}px`;
  el.previewCanvas.style.height = `${normalized.height * state.zoom}px`;
  el.previewCanvas.classList.remove('hidden');
  el.emptyPreview.classList.add('hidden');
  el.previewLabel.textContent = `Frame ${state.currentIndex + 1} · ${frame.canvas.width}×${frame.canvas.height}`;
}

function renderTimeline(): void {
  el.frames.innerHTML = '';
  if (!state.frames.length) {
    el.frames.innerHTML = '<div class="empty-timeline">Frames will appear here after import</div>';
    return;
  }

  state.frames.forEach((frame, index) => {
    const card = document.createElement('div');
    card.className = `frame-card${index === state.currentIndex ? ' active' : ''}`;
    card.draggable = true;
    card.dataset.index = String(index);

    const thumb = document.createElement('div');
    thumb.className = 'frame-thumb';
    const canvas = cloneCanvas(frame.canvas);
    thumb.append(canvas);

    const foot = document.createElement('div');
    foot.className = 'frame-foot';
    foot.innerHTML = `<span class="frame-number">#${String(index + 1).padStart(2, '0')}</span><span class="frame-size">${frame.canvas.width}×${frame.canvas.height} · ×${frame.hold}</span>`;
    card.append(thumb, foot);

    card.addEventListener('click', () => {
      stopPlayback();
      state.currentIndex = index;
      renderPreview();
      renderTimelineActive();
    });
    card.addEventListener('dragstart', (event) => {
      event.dataTransfer?.setData('text/plain', String(index));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragover', (event) => { event.preventDefault(); card.classList.add('drag-over'); });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', (event) => {
      event.preventDefault();
      card.classList.remove('drag-over');
      const from = Number(event.dataTransfer?.getData('text/plain'));
      if (!Number.isInteger(from) || from === index || from < 0 || from >= state.frames.length) return;
      const [moved] = state.frames.splice(from, 1);
      state.frames.splice(index, 0, moved);
      state.currentIndex = index;
      renderAll();
    });
    el.frames.append(card);
  });
}

function renderTimelineActive(): void {
  el.frames.querySelectorAll('.frame-card').forEach((node, index) => node.classList.toggle('active', index === state.currentIndex));
  el.frames.querySelector<HTMLElement>('.frame-card.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  renderStats();
}

function renderStats(): void {
  const count = state.frames.length;
  const size = normalizedSize();
  el.frameCount.textContent = String(count);
  el.canvasSize.textContent = count ? `${size.width}×${size.height}` : '—';
  const duration = count ? playbackSequence().reduce((sum, frameIndex) => sum + (state.frames[frameIndex]?.hold ?? 1), 0) / state.fps : 0;
  el.duration.textContent = count ? `${duration.toFixed(duration < 10 ? 2 : 1)}s` : '—';
  el.timelineInfo.textContent = count ? `  ${count} frame${count === 1 ? '' : 's'} · ${state.fps} FPS` : '  No frames';
  el.sourceName.textContent = state.sourceName;
  el.sourceDimensions.textContent = state.source
    ? `${state.source.width}×${state.source.height}px · ${state.cols}×${state.rows} grid`
    : count ? 'Imported as separate images' : 'Drop a file to begin';
  el.frameSizeLabel.textContent = count ? `${state.frames[0].canvas.width}×${state.frames[0].canvas.height}` : '—';

  const frame = state.frames[state.currentIndex];
  if (frame) {
    const bounds = opaqueBounds(frame.canvas);
    if (bounds) {
      const total = frame.canvas.width * frame.canvas.height;
      const opaqueBox = bounds.width * bounds.height;
      el.opaqueSize.textContent = `${bounds.width}×${bounds.height}`;
      el.transparentInfo.textContent = `${Math.max(0, Math.round((1 - opaqueBox / total) * 100))}%+`;
    } else {
      el.opaqueSize.textContent = 'empty';
      el.transparentInfo.textContent = '100%';
    }
  } else {
    el.opaqueSize.textContent = '—';
    el.transparentInfo.textContent = '—';
  }

  const anchorLabels: Record<AnchorMode, string> = { 'bottom-center': 'Feet', center: 'Center', 'center-mass': 'Mass' };
  el.anchorInfo.textContent = anchorLabels[state.anchorMode];
  el.hold.value = String(frame?.hold ?? 1);
  el.holdValue.textContent = String(frame?.hold ?? 1);
  el.onion.checked = state.onionSkin;
  el.onionOpacity.value = String(Math.round(state.onionOpacity * 100));
  el.onionOpacityValue.textContent = `${Math.round(state.onionOpacity * 100)}%`;

  const enabled = count > 0;
  [el.play, el.fit, el.clear, el.trim, el.align, el.duplicate, el.remove, el.reverse, el.flipX, el.flipY, el.rotate, el.gif, el.sheet, el.sequence]
    .forEach((button) => { button.disabled = !enabled; });
  el.reslice.disabled = !state.source;
  el.autoSlice.disabled = !state.source;
}

function renderAll(): void {
  renderPreview();
  renderTimeline();
  renderStats();
  updatePlayButton();
}

function duplicateCurrent(): void {
  if (!state.frames.length) return;
  const original = state.frames[state.currentIndex];
  const duplicate: SpriteFrame = { id: uid(), name: `${original.name.replace(/\.png$/i, '')}_copy.png`, canvas: cloneCanvas(original.canvas), hold: original.hold };
  state.frames.splice(state.currentIndex + 1, 0, duplicate);
  state.currentIndex += 1;
  renderAll();
}

function deleteCurrent(): void {
  if (!state.frames.length) return;
  state.frames.splice(state.currentIndex, 1);
  state.currentIndex = Math.max(0, Math.min(state.currentIndex, state.frames.length - 1));
  if (!state.frames.length) stopPlayback();
  renderAll();
}

function reverseFrames(): void {
  if (state.frames.length < 2) return;
  state.frames.reverse();
  state.currentIndex = state.frames.length - 1 - state.currentIndex;
  renderAll();
}

function transformCurrent(kind: 'flip-x' | 'flip-y' | 'rotate'): void {
  const frame = state.frames[state.currentIndex];
  if (!frame) return;
  stopPlayback();
  const source = frame.canvas;
  const rotated = kind === 'rotate';
  const out = createCanvas(rotated ? source.height : source.width, rotated ? source.width : source.height);
  const ctx = get2d(out);
  if (kind === 'flip-x') {
    ctx.translate(out.width, 0);
    ctx.scale(-1, 1);
  } else if (kind === 'flip-y') {
    ctx.translate(0, out.height);
    ctx.scale(1, -1);
  } else {
    ctx.translate(out.width, 0);
    ctx.rotate(Math.PI / 2);
  }
  ctx.drawImage(source, 0, 0);
  frame.canvas = out;
  renderAll();
  toast(kind === 'rotate' ? 'Frame rotated 90°' : `Frame ${kind === 'flip-x' ? 'flipped horizontally' : 'flipped vertically'}`);
}

function fitPreview(): void {
  if (!state.frames.length) return;
  const size = normalizedSize();
  const rect = el.previewSurface.getBoundingClientRect();
  const maxW = Math.max(1, rect.width - 64);
  const maxH = Math.max(1, rect.height - 64);
  const raw = Math.min(maxW / size.width, maxH / size.height);
  const allowed = [1, 2, 3, 4, 6, 8];
  const fit = [...allowed].reverse().find((value) => value <= raw) ?? 1;
  state.zoom = fit;
  el.zoom.value = String(fit);
  renderPreview();
}

function clearProject(): void {
  stopPlayback();
  state.source?.close();
  state.source = null;
  state.sourceName = 'No source loaded';
  state.frames = [];
  state.currentIndex = 0;
  Object.assign(state, { rows: 1, cols: 1, paddingX: 0, paddingY: 0, spacingX: 0, spacingY: 0 });
  syncSliceInputs();
  drawSourcePlaceholder();
  el.smartStatus.textContent = 'Load a sheet to enable automatic cleanup.';
  renderAll();
}

function generateDemo(): void {
  clearProject();
  const offsets = [0, -2, -3, -1, 0];
  state.frames = offsets.map((offset, index) => {
    const canvas = createCanvas(38 + (index % 2) * 2, 36);
    const ctx = get2d(canvas);
    ctx.translate(3 + (index % 2), 4 + offset);
    drawPixelS(ctx, index % 2 ? '#21c79b' : '#1687ff');
    return { id: uid(), name: `demo_${index + 1}.png`, canvas, hold: index === 2 ? 2 : 1 };
  });
  state.sourceName = 'Built-in uneven SSS demo';
  state.currentIndex = 0;
  renderAll();
  el.smartStatus.textContent = 'Demo intentionally jitters. Press Auto Align to stabilize it.';
  toast('Uneven demo loaded — try Auto Align');
}

function drawPixelS(ctx: CanvasRenderingContext2D, color: string): void {
  const map = ['11111', '11000', '11111', '00011', '11111'];
  const scale = 4;
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  map.forEach((row, y) => [...row].forEach((cell, x) => { if (cell === '1') ctx.fillRect(x * scale + 1, y * scale + 1, scale, scale); }));
  ctx.fillStyle = color;
  map.forEach((row, y) => [...row].forEach((cell, x) => { if (cell === '1') ctx.fillRect(x * scale, y * scale, scale, scale); }));
}

async function exportGif(): Promise<void> {
  if (!state.frames.length) return;
  setExportBusy(true, 'Encoding…');
  try {
    const gif = GIFEncoder();
    const sequence = playbackSequence();
    sequence.forEach((frameIndex, sequenceIndex) => {
      const delay = Math.max(20, Math.round((1000 / state.fps) * (state.frames[frameIndex]?.hold ?? 1)));
      const canvas = drawNormalizedFrame(state.frames[frameIndex]);
      const image = get2d(canvas).getImageData(0, 0, canvas.width, canvas.height);
      const palette = quantize(image.data, 256, { format: 'rgba4444', oneBitAlpha: true });
      const indexed = applyPalette(image.data, palette, 'rgba4444');
      const transparentIndex = palette.findIndex((color: number[]) => color.length > 3 && color[3] === 0);
      gif.writeFrame(indexed, canvas.width, canvas.height, {
        palette,
        delay,
        repeat: sequenceIndex === 0 ? (state.loop ? 0 : -1) : undefined,
        transparent: transparentIndex >= 0,
        transparentIndex: transparentIndex >= 0 ? transparentIndex : 0,
        dispose: 2
      });
    });
    gif.finish();
    downloadBlob(new Blob([gif.bytes()], { type: 'image/gif' }), 'sprite-animation.gif');
    toast('GIF exported');
  } catch (error) {
    console.error(error);
    toast('GIF export failed.', true);
  } finally {
    setExportBusy(false);
  }
}

async function exportSpriteSheet(): Promise<void> {
  if (!state.frames.length) return;
  const { width, height } = normalizedSize();
  const sheet = createCanvas(width * state.frames.length, height);
  const ctx = get2d(sheet);
  state.frames.forEach((frame, index) => ctx.drawImage(drawNormalizedFrame(frame), index * width, 0));
  downloadBlob(await canvasToBlob(sheet), 'sprite-sheet.png');
  toast('Sprite sheet exported');
}

async function exportSequence(): Promise<void> {
  if (!state.frames.length) return;
  setExportBusy(true, 'Packing…');
  try {
    const files: Record<string, Uint8Array> = {};
    for (let index = 0; index < state.frames.length; index += 1) {
      const blob = await canvasToBlob(drawNormalizedFrame(state.frames[index]));
      files[`frames/frame_${String(index + 1).padStart(3, '0')}.png`] = new Uint8Array(await blob.arrayBuffer());
    }
    downloadBlob(new Blob([zipSync(files, { level: 6 })], { type: 'application/zip' }), 'sprite-frames.zip');
    toast('PNG sequence exported');
  } catch (error) {
    console.error(error);
    toast('PNG sequence export failed.', true);
  } finally {
    setExportBusy(false);
  }
}

function setExportBusy(busy: boolean, label = ''): void {
  [el.gif, el.sheet, el.sequence].forEach((button) => { button.disabled = busy || !state.frames.length; });
  if (busy) {
    el.gif.dataset.original = el.gif.innerHTML;
    el.gif.innerHTML = `<span>${label}</span><small>please wait</small>`;
  } else if (el.gif.dataset.original) {
    el.gif.innerHTML = el.gif.dataset.original;
    delete el.gif.dataset.original;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Canvas export failed')), 'image/png'));
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

let toastTimer = 0;
function toast(message: string, error = false): void {
  window.clearTimeout(toastTimer);
  el.toast.textContent = message;
  el.toast.classList.toggle('error', error);
  el.toast.classList.add('show');
  toastTimer = window.setTimeout(() => el.toast.classList.remove('show'), 2400);
}

el.uploadZone.addEventListener('click', () => el.fileInput.click());
el.uploadZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); el.fileInput.click(); }
});
el.fileInput.addEventListener('change', () => {
  if (el.fileInput.files?.length) void loadFiles(el.fileInput.files);
  el.fileInput.value = '';
});
for (const eventName of ['dragenter', 'dragover']) {
  el.uploadZone.addEventListener(eventName, (event) => { event.preventDefault(); el.uploadZone.classList.add('is-dragging'); });
}
for (const eventName of ['dragleave', 'drop']) {
  el.uploadZone.addEventListener(eventName, (event) => { event.preventDefault(); el.uploadZone.classList.remove('is-dragging'); });
}
el.uploadZone.addEventListener('drop', (event) => {
  if (event.dataTransfer?.files.length) void loadFiles(event.dataTransfer.files);
});
document.addEventListener('paste', (event) => {
  const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith('image/'));
  if (files.length) void loadFiles(files);
});

el.reslice.addEventListener('click', sliceSource);
el.autoSlice.addEventListener('click', autoSliceSource);
el.trim.addEventListener('click', trimAllFrames);
el.align.addEventListener('click', alignAllFrames);
[el.rows, el.cols, el.paddingX, el.paddingY, el.spacingX, el.spacingY].forEach((input) => {
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') sliceSource(); });
});
el.anchor.addEventListener('change', () => {
  state.anchorMode = el.anchor.value as AnchorMode;
  renderStats();
  el.smartStatus.textContent = 'Anchor changed. Press Auto Align to apply it.';
});

el.play.addEventListener('click', () => state.playing ? stopPlayback() : startPlayback());
el.fit.addEventListener('click', fitPreview);
el.clear.addEventListener('click', clearProject);
el.demo.addEventListener('click', generateDemo);
el.duplicate.addEventListener('click', duplicateCurrent);
el.remove.addEventListener('click', deleteCurrent);
el.reverse.addEventListener('click', reverseFrames);
el.fps.addEventListener('input', () => {
  state.fps = clampInt(el.fps.value, 1, 30);
  el.fpsValue.textContent = String(state.fps);
  renderStats();
});
el.loop.addEventListener('change', () => { state.loop = el.loop.checked; renderStats(); });
el.pingPong.addEventListener('change', () => { state.pingPong = el.pingPong.checked; state.playbackCursor = 0; renderStats(); });
el.zoom.addEventListener('change', () => { state.zoom = Number(el.zoom.value) || 1; renderPreview(); });
el.bg.addEventListener('change', () => {
  state.previewBg = el.bg.value as PreviewBackground;
  el.previewSurface.dataset.bg = state.previewBg;
});
el.hold.addEventListener('input', () => {
  const frame = state.frames[state.currentIndex];
  if (!frame) return;
  frame.hold = clampInt(el.hold.value, 1, 8);
  el.holdValue.textContent = String(frame.hold);
  renderStats();
  renderTimeline();
});
el.onion.addEventListener('change', () => { state.onionSkin = el.onion.checked; renderPreview(); });
el.onionOpacity.addEventListener('input', () => {
  state.onionOpacity = clampInt(el.onionOpacity.value, 5, 60) / 100;
  el.onionOpacityValue.textContent = `${Math.round(state.onionOpacity * 100)}%`;
  renderPreview();
});
el.flipX.addEventListener('click', () => transformCurrent('flip-x'));
el.flipY.addEventListener('click', () => transformCurrent('flip-y'));
el.rotate.addEventListener('click', () => transformCurrent('rotate'));

el.gif.addEventListener('click', () => void exportGif());
el.sheet.addEventListener('click', () => void exportSpriteSheet());
el.sequence.addEventListener('click', () => void exportSequence());

window.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  if (target?.matches('input, select, textarea')) return;
  if (event.code === 'Space') { event.preventDefault(); state.playing ? stopPlayback() : startPlayback(); }
  if (event.key === 'Delete' || event.key === 'Backspace') deleteCurrent();
  if (event.key === 'ArrowRight' && state.frames.length) {
    stopPlayback();
    state.currentIndex = Math.min(state.frames.length - 1, state.currentIndex + 1);
    renderPreview();
    renderTimelineActive();
  }
  if (event.key === 'ArrowLeft' && state.frames.length) {
    stopPlayback();
    state.currentIndex = Math.max(0, state.currentIndex - 1);
    renderPreview();
    renderTimelineActive();
  }
});

drawSourcePlaceholder();
renderAll();
