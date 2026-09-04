let panel = null;
let initialized = false;
const MAX_PIXELS = 8_000_000;
const MAX_COMPONENTS = 512;

const $ = (selector, root = document) => root.querySelector(selector);

function setStatus(text, kind = '') {
  const node = $('[data-object-status]', panel);
  if (!node) return;
  node.textContent = text;
  node.dataset.kind = kind;
}

function sourceCanvas() {
  const canvas = $('#sourceCanvas');
  if (!(canvas instanceof HTMLCanvasElement) || canvas.width <= 1 || canvas.height <= 1) return null;
  return canvas;
}

function colorDistance(r, g, b, a, bg) {
  const dr = r - bg.r;
  const dg = g - bg.g;
  const db = b - bg.b;
  const da = (a - bg.a) * 0.5;
  return Math.sqrt(dr * dr + dg * dg + db * db + da * da);
}

function cornerColor(data, width, height) {
  const points = [[0,0],[width - 1,0],[0,height - 1],[width - 1,height - 1]];
  let r = 0, g = 0, b = 0, a = 0;
  points.forEach(([x,y]) => {
    const i = (y * width + x) * 4;
    r += data[i]; g += data[i + 1]; b += data[i + 2]; a += data[i + 3];
  });
  return { r: r / 4, g: g / 4, b: b / 4, a: a / 4 };
}

function mergeBoxes(boxes, gap) {
  if (gap <= 0 || boxes.length < 2) return boxes;
  const result = [...boxes];
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < result.length; i += 1) {
      for (let j = i + 1; j < result.length; j += 1) {
        const a = result[i], b = result[j];
        const separated = a.maxX + gap < b.minX || b.maxX + gap < a.minX || a.maxY + gap < b.minY || b.maxY + gap < a.minY;
        if (separated) continue;
        result[i] = {
          minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY),
          maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY),
          area: a.area + b.area
        };
        result.splice(j, 1);
        changed = true;
        break outer;
      }
    }
  }
  return result;
}

async function detectComponents(canvas, options) {
  const width = canvas.width, height = canvas.height, pixels = width * height;
  if (pixels > MAX_PIXELS) throw new Error(`Object Slice is limited to ${(MAX_PIXELS / 1_000_000).toFixed(0)} MP in stable mode. This sheet is ${(pixels / 1_000_000).toFixed(1)} MP.`);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D unavailable.');
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const visited = new Uint8Array(pixels);
  const stack = new Int32Array(pixels);
  const bg = cornerColor(data, width, height);
  const boxes = [];
  const mode = options.mode;
  const tolerance = options.tolerance;
  const minArea = options.minArea;

  const foreground = (index) => {
    const p = index * 4;
    if (mode === 'transparent') return data[p + 3] > 8;
    return colorDistance(data[p], data[p + 1], data[p + 2], data[p + 3], bg) > tolerance;
  };

  for (let start = 0; start < pixels; start += 1) {
    if (visited[start]) continue;
    visited[start] = 1;
    if (!foreground(start)) continue;

    let top = 0;
    stack[top++] = start;
    let area = 0;
    let minX = width, minY = height, maxX = -1, maxY = -1;

    while (top > 0) {
      const index = stack[--top];
      const x = index % width;
      const y = Math.floor(index / width);
      area += 1;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;

      const neighbors = [];
      if (x > 0) neighbors.push(index - 1);
      if (x + 1 < width) neighbors.push(index + 1);
      if (y > 0) neighbors.push(index - width);
      if (y + 1 < height) neighbors.push(index + width);
      for (const next of neighbors) {
        if (visited[next]) continue;
        visited[next] = 1;
        if (foreground(next)) stack[top++] = next;
      }
    }

    if (area >= minArea) boxes.push({ minX, minY, maxX, maxY, area });
    if (boxes.length > MAX_COMPONENTS) throw new Error(`More than ${MAX_COMPONENTS} objects detected. Increase minimum area or background tolerance.`);
    if (boxes.length % 24 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return mergeBoxes(boxes, options.mergeGap).sort((a, b) => {
    const rowTolerance = Math.max(4, Math.min(a.maxY - a.minY + 1, b.maxY - b.minY + 1) * 0.35);
    if (Math.abs(a.minY - b.minY) <= rowTolerance) return a.minX - b.minX;
    return a.minY - b.minY;
  });
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not encode PNG frame.')), 'image/png'));
}

async function applyBoxes(canvas, boxes) {
  if (!boxes.length) throw new Error('No sprite objects were detected.');
  if (typeof DataTransfer !== 'function') throw new Error('This browser cannot send detected objects to the stable timeline.');
  const transfer = new DataTransfer();
  for (let index = 0; index < boxes.length; index += 1) {
    const box = boxes[index];
    const width = box.maxX - box.minX + 1;
    const height = box.maxY - box.minY + 1;
    const out = document.createElement('canvas');
    out.width = width; out.height = height;
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, box.minX, box.minY, width, height, 0, 0, width, height);
    const blob = await canvasBlob(out);
    transfer.items.add(new File([blob], `object-${String(index + 1).padStart(3, '0')}.png`, { type: 'image/png' }));
    if (index % 12 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const input = $('#fileInput');
  if (!(input instanceof HTMLInputElement)) throw new Error('Stable file input was not found.');
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

async function run() {
  const canvas = sourceCanvas();
  if (!canvas) return setStatus('Load one sprite sheet first. Separate-frame imports have no source sheet to scan.', 'error');
  const runButton = $('#stableObjectRun', panel);
  runButton.disabled = true;
  try {
    const mode = $('#stableObjectMode', panel)?.value || 'transparent';
    const tolerance = Math.max(0, Math.min(255, Number($('#stableObjectTolerance', panel)?.value) || 36));
    const minArea = Math.max(1, Number($('#stableObjectMinArea', panel)?.value) || 6);
    const mergeGap = Math.max(0, Math.min(64, Number($('#stableObjectMergeGap', panel)?.value) || 0));
    setStatus(`Scanning ${canvas.width}×${canvas.height}…`);
    const boxes = await detectComponents(canvas, { mode, tolerance, minArea, mergeGap });
    setStatus(`Detected ${boxes.length} object${boxes.length === 1 ? '' : 's'}. Preparing frames…`);
    await applyBoxes(canvas, boxes);
    setStatus(`Sent ${boxes.length} objects to timeline.`, 'ok');
  } catch (error) {
    console.error(error);
    setStatus(error instanceof Error ? error.message : 'Object Slice failed.', 'error');
  } finally {
    runButton.disabled = false;
  }
}

function createPanel() {
  panel = document.createElement('section');
  panel.className = 'sss-module-panel';
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start">
      <div><h3>Object Slice</h3><div class="muted">Connected-component slicing. Runs only after you press Detect & Slice.</div></div>
      <button class="btn" data-object-close>Close</button>
    </div>
    <div class="sss-module-grid" style="margin-top:14px">
      <div class="sss-module-row"><span>Background mode</span><select id="stableObjectMode"><option value="transparent">Transparent alpha</option><option value="corner">Corner color</option></select></div>
      <div class="sss-module-row"><span>Color tolerance</span><input id="stableObjectTolerance" type="number" min="0" max="255" value="36" /></div>
      <div class="sss-module-row"><span>Minimum object area</span><input id="stableObjectMinArea" type="number" min="1" max="100000" value="6" /></div>
      <div class="sss-module-row"><span>Merge gap</span><input id="stableObjectMergeGap" type="number" min="0" max="64" value="0" /></div>
    </div>
    <div class="sss-module-toolbar"><button class="btn green" id="stableObjectRun">Detect & Slice</button></div>
    <div class="sss-module-row"><span>Status</span><strong data-object-status>Ready</strong></div>
    <div class="muted" style="margin-top:10px">Stable guard: analysis stops before processing sheets above ${(MAX_PIXELS / 1_000_000).toFixed(0)} megapixels.</div>`;
  document.body.append(panel);
  $('[data-object-close]', panel)?.addEventListener('click', () => panel.hidden = true);
  $('#stableObjectRun', panel)?.addEventListener('click', () => void run());
}

export async function open() {
  if (!initialized) { initialized = true; createPanel(); }
  panel.hidden = false;
  const canvas = sourceCanvas();
  setStatus(canvas ? `Ready · ${canvas.width}×${canvas.height}` : 'Load one sprite sheet to enable detection.');
}
