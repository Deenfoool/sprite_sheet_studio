let panel = null;
let initialized = false;
const MAX_PIXELS = 32_000_000;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function setStatus(text, kind = '') {
  const node = $('[data-cleanup-status]', panel);
  if (!node) return;
  node.textContent = text;
  node.dataset.kind = kind;
}

function cloneCanvas(source) {
  const out = document.createElement('canvas'); out.width = source.width; out.height = source.height;
  const ctx = out.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(source, 0, 0); return out;
}

function captureFrames() {
  const cards = $$('.frame-card');
  if (!cards.length) throw new Error('No frames loaded.');
  const selected = Math.max(0, cards.findIndex((card) => card.classList.contains('active')));
  const frames = [];
  let pixels = 0;
  for (let index = 0; index < cards.length; index += 1) {
    $$('.frame-card')[index]?.click();
    const preview = $('#previewCanvas');
    if (!(preview instanceof HTMLCanvasElement) || preview.classList.contains('hidden')) continue;
    pixels += preview.width * preview.height;
    if (pixels > MAX_PIXELS) throw new Error(`Cleanup guard: frame set exceeds ${(MAX_PIXELS / 1_000_000).toFixed(0)} megapixels of source canvas.`);
    frames.push({ name: `frame-${String(index + 1).padStart(3, '0')}.png`, canvas: cloneCanvas(preview) });
  }
  $$('.frame-card')[Math.min(selected, frames.length - 1)]?.click();
  return frames;
}

function opaqueBounds(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (data[(y * canvas.width + x) * 4 + 3] <= 0) continue;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return maxX >= minX ? { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 } : null;
}

function trimCanvas(canvas) {
  const bounds = opaqueBounds(canvas);
  if (!bounds) return cloneCanvas(canvas);
  const out = document.createElement('canvas'); out.width = bounds.width; out.height = bounds.height;
  out.getContext('2d').drawImage(canvas, bounds.minX, bounds.minY, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
  return out;
}

function centerOfMass(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let sum = 0, sx = 0, sy = 0;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const alpha = data[(y * canvas.width + x) * 4 + 3] / 255;
      if (!alpha) continue;
      sum += alpha; sx += (x + 0.5) * alpha; sy += (y + 0.5) * alpha;
    }
  }
  return sum ? { x: sx / sum, y: sy / sum } : { x: canvas.width / 2, y: canvas.height / 2 };
}

function anchorFor(canvas, mode) {
  const bounds = opaqueBounds(canvas);
  if (!bounds) return { x: canvas.width / 2, y: canvas.height / 2 };
  if (mode === 'center-mass') return centerOfMass(canvas);
  if (mode === 'center') return { x: (bounds.minX + bounds.maxX + 1) / 2, y: (bounds.minY + bounds.maxY + 1) / 2 };
  return { x: (bounds.minX + bounds.maxX + 1) / 2, y: bounds.maxY + 1 };
}

function alignFrames(frames, mode, trimFirst) {
  const working = frames.map((frame) => ({ ...frame, canvas: trimFirst ? trimCanvas(frame.canvas) : cloneCanvas(frame.canvas) }));
  const items = working.map((frame) => ({ ...frame, anchor: anchorFor(frame.canvas, mode) }));
  let minLeft = 0, minTop = 0, maxRight = 0, maxBottom = 0;
  items.forEach((item) => {
    minLeft = Math.min(minLeft, -item.anchor.x);
    minTop = Math.min(minTop, -item.anchor.y);
    maxRight = Math.max(maxRight, item.canvas.width - item.anchor.x);
    maxBottom = Math.max(maxBottom, item.canvas.height - item.anchor.y);
  });
  const width = Math.max(1, Math.ceil(maxRight - minLeft));
  const height = Math.max(1, Math.ceil(maxBottom - minTop));
  const targetX = -minLeft, targetY = -minTop;
  return items.map((item) => {
    const out = document.createElement('canvas'); out.width = width; out.height = height;
    const ctx = out.getContext('2d'); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(item.canvas, Math.round(targetX - item.anchor.x), Math.round(targetY - item.anchor.y));
    return { name: item.name, canvas: out };
  });
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG encoding failed.')), 'image/png'));
}

async function replaceTimeline(frames) {
  if (typeof DataTransfer !== 'function') throw new Error('This browser cannot send processed frames back to the timeline.');
  const transfer = new DataTransfer();
  for (let index = 0; index < frames.length; index += 1) {
    transfer.items.add(new File([await canvasBlob(frames[index].canvas)], frames[index].name, { type: 'image/png' }));
    if (index % 8 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const input = $('#fileInput');
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

async function trimAll() {
  const button = $('#stableTrimAll', panel); button.disabled = true;
  try {
    setStatus('Capturing frames…');
    const frames = captureFrames();
    const output = frames.map((frame) => ({ ...frame, canvas: trimCanvas(frame.canvas) }));
    setStatus('Encoding trimmed frames…');
    await replaceTimeline(output);
    setStatus(`Trimmed ${output.length} frames.`, 'ok');
  } catch (error) {
    console.error(error); setStatus(error instanceof Error ? error.message : 'Trim failed.', 'error');
  } finally { button.disabled = false; }
}

async function autoAlign() {
  const button = $('#stableAlignAll', panel); button.disabled = true;
  try {
    setStatus('Capturing frames…');
    const frames = captureFrames();
    const mode = $('#stableAlignMode', panel).value;
    const trimFirst = $('#stableAlignTrim', panel).checked;
    setStatus(`Aligning ${frames.length} frames…`);
    const output = alignFrames(frames, mode, trimFirst);
    await replaceTimeline(output);
    setStatus(`Aligned ${output.length} frames to ${mode}.`, 'ok');
  } catch (error) {
    console.error(error); setStatus(error instanceof Error ? error.message : 'Align failed.', 'error');
  } finally { button.disabled = false; }
}

function createPanel() {
  panel = document.createElement('section'); panel.className = 'sss-module-panel';
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start"><div><h3>Cleanup+</h3><div class="muted">Batch cleanup loaded only on demand.</div></div><button class="btn" data-cleanup-close>Close</button></div>
    <div class="sss-module-grid" style="margin-top:14px">
      <div class="sss-module-row"><div><strong>Trim all</strong><div class="muted">Crop transparent borders on every frame.</div></div><button class="btn" id="stableTrimAll">Trim all</button></div>
      <div class="sss-module-row"><span>Alignment anchor</span><select id="stableAlignMode"><option value="bottom-center">Feet / bottom center</option><option value="center">Bounding center</option><option value="center-mass">Center of mass</option></select></div>
      <div class="sss-module-row"><span>Trim before align</span><input id="stableAlignTrim" type="checkbox" checked></div>
      <div class="sss-module-row"><div><strong>Auto Align all</strong><div class="muted">Normalize canvas and place the selected anchor at one shared point.</div></div><button class="btn green" id="stableAlignAll">Align all</button></div>
      <div class="sss-module-row"><span>Status</span><strong data-cleanup-status>Ready</strong></div>
    </div>
    <div class="muted" style="margin-top:10px">Guard: batch cleanup stops before capturing more than ${(MAX_PIXELS / 1_000_000).toFixed(0)} megapixels.</div>`;
  document.body.append(panel);
  $('[data-cleanup-close]', panel).addEventListener('click', () => panel.hidden = true);
  $('#stableTrimAll', panel).addEventListener('click', () => void trimAll());
  $('#stableAlignAll', panel).addEventListener('click', () => void autoAlign());
}

export async function open() {
  if (!initialized) { initialized = true; createPanel(); }
  panel.hidden = false;
  setStatus($$('.frame-card').length ? `Ready · ${$$('.frame-card').length} frames` : 'Load frames first.');
}
