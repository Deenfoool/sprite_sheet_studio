let panel = null;
let initialized = false;
let lastAnalysis = null;
const MAX_FRAMES = 96;
const MAX_PIXELS = 24_000_000;
const SAMPLE = 16;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function setStatus(text, kind = '') {
  const node = $('[data-ai-status]', panel);
  if (!node) return;
  node.textContent = text;
  node.dataset.kind = kind;
}

function cloneCanvas(source) {
  const out = document.createElement('canvas'); out.width = source.width; out.height = source.height;
  out.getContext('2d').drawImage(source, 0, 0); return out;
}

function captureFrames() {
  const cards = $$('.frame-card');
  if (!cards.length) throw new Error('No frames loaded.');
  if (cards.length > MAX_FRAMES) throw new Error(`AI Fixer stable mode is limited to ${MAX_FRAMES} frames per analysis.`);
  const selected = Math.max(0, cards.findIndex((card) => card.classList.contains('active')));
  const frames = [];
  let pixels = 0;
  for (let index = 0; index < cards.length; index += 1) {
    $$('.frame-card')[index]?.click();
    const preview = $('#previewCanvas');
    if (!(preview instanceof HTMLCanvasElement) || preview.classList.contains('hidden')) continue;
    pixels += preview.width * preview.height;
    if (pixels > MAX_PIXELS) throw new Error(`AI Fixer guard: frame set exceeds ${(MAX_PIXELS / 1_000_000).toFixed(0)} megapixels.`);
    frames.push({ index, width: preview.width, height: preview.height, canvas: cloneCanvas(preview) });
  }
  $$('.frame-card')[Math.min(selected, frames.length - 1)]?.click();
  return frames;
}

function signature(canvas) {
  const sample = document.createElement('canvas'); sample.width = SAMPLE; sample.height = SAMPLE;
  const ctx = sample.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, SAMPLE, SAMPLE);
  ctx.drawImage(canvas, 0, 0, SAMPLE, SAMPLE);
  const data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
  const values = new Float32Array(SAMPLE * SAMPLE * 2);
  let opaque = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p += 2) {
    const a = data[i + 3] / 255;
    const lum = (data[i] * .2126 + data[i + 1] * .7152 + data[i + 2] * .0722) / 255;
    values[p] = lum * a;
    values[p + 1] = a;
    opaque += a;
  }
  return { values, occupancy: opaque / (SAMPLE * SAMPLE) };
}

function similarity(a, b) {
  let diff = 0;
  for (let i = 0; i < a.values.length; i += 1) diff += Math.abs(a.values[i] - b.values[i]);
  const visual = 1 - diff / a.values.length;
  const occupancy = 1 - Math.min(1, Math.abs(a.occupancy - b.occupancy));
  return Math.max(0, Math.min(1, visual * .82 + occupancy * .18));
}

function analyzeFrames(frames) {
  const signatures = frames.map((frame) => signature(frame.canvas));
  const matrix = Array.from({ length: frames.length }, () => new Float32Array(frames.length));
  for (let i = 0; i < frames.length; i += 1) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < frames.length; j += 1) {
      const score = similarity(signatures[i], signatures[j]);
      matrix[i][j] = score; matrix[j][i] = score;
    }
  }

  const duplicates = [];
  for (let i = 0; i < frames.length; i += 1) {
    for (let j = i + 1; j < frames.length; j += 1) {
      const sizeRatio = Math.max(frames[i].width * frames[i].height, frames[j].width * frames[j].height) / Math.max(1, Math.min(frames[i].width * frames[i].height, frames[j].width * frames[j].height));
      if (matrix[i][j] >= .985 && sizeRatio <= 1.08) duplicates.push({ keep: i, remove: j, score: matrix[i][j] });
    }
  }

  const broken = [];
  const medianArea = [...frames.map((frame) => frame.width * frame.height)].sort((a,b) => a-b)[Math.floor(frames.length / 2)] || 1;
  for (let i = 0; i < frames.length; i += 1) {
    const areaRatio = (frames[i].width * frames[i].height) / medianArea;
    let reason = '';
    if (areaRatio > 2.1 || areaRatio < .45) reason = `canvas area ${areaRatio.toFixed(2)}× median`;
    if (i > 0 && i + 1 < frames.length) {
      const prev = matrix[i - 1][i], next = matrix[i][i + 1], bridge = matrix[i - 1][i + 1];
      if (prev < .58 && next < .58 && bridge > .76) reason = `isolated visual jump (${Math.round(prev * 100)}% / ${Math.round(next * 100)}%)`;
    }
    if (reason) broken.push({ index: i, reason });
  }

  const firstLast = frames.length > 1 ? matrix[0][frames.length - 1] : 1;
  return { frames, signatures, matrix, duplicates, broken, firstLast };
}

function drawHeatmap(analysis) {
  const canvas = $('#stableAiHeatmap', panel);
  const n = analysis.matrix.length;
  const size = Math.max(220, Math.min(480, n * 10));
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cell = size / Math.max(1, n);
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const score = analysis.matrix[y][x];
      const light = Math.round(18 + score * 62);
      ctx.fillStyle = `hsl(${190 + score * 55} 70% ${light}%)`;
      ctx.fillRect(x * cell, y * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.strokeRect(.5,.5,size-1,size-1);
}

function renderAnalysis(analysis) {
  lastAnalysis = analysis;
  drawHeatmap(analysis);
  const summary = $('#stableAiSummary', panel);
  summary.innerHTML = '';
  const rows = [
    ['Frames', String(analysis.frames.length)],
    ['Duplicate pairs', String(analysis.duplicates.length)],
    ['Broken suspects', String(analysis.broken.length)],
    ['Loop similarity', `${Math.round(analysis.firstLast * 100)}%`]
  ];
  rows.forEach(([label, value]) => {
    const row = document.createElement('div'); row.className = 'sss-module-row'; row.innerHTML = `<span></span><strong></strong>`;
    row.querySelector('span').textContent = label; row.querySelector('strong').textContent = value; summary.append(row);
  });
  const details = $('#stableAiDetails', panel);
  details.innerHTML = '';
  analysis.duplicates.slice(0, 20).forEach((item) => {
    const line = document.createElement('div'); line.className = 'muted'; line.textContent = `Duplicate: frame ${item.remove + 1} ≈ frame ${item.keep + 1} (${Math.round(item.score * 100)}%)`; details.append(line);
  });
  analysis.broken.slice(0, 20).forEach((item) => {
    const line = document.createElement('div'); line.className = 'muted'; line.textContent = `Suspect frame ${item.index + 1}: ${item.reason}`; details.append(line);
  });
  if (!analysis.duplicates.length && !analysis.broken.length) {
    const line = document.createElement('div'); line.className = 'muted'; line.textContent = 'No obvious duplicate or isolated broken frames detected.'; details.append(line);
  }
  $('#stableAiRemoveDup', panel).disabled = !analysis.duplicates.length;
  $('#stableAiPingPong', panel).disabled = analysis.frames.length < 2;
  setStatus('Analysis complete.', 'ok');
}

async function runAnalysis() {
  const button = $('#stableAiAnalyze', panel); button.disabled = true;
  try {
    setStatus('Capturing frames…');
    const frames = captureFrames();
    setStatus('Computing signatures…');
    await new Promise((resolve) => setTimeout(resolve, 0));
    renderAnalysis(analyzeFrames(frames));
  } catch (error) {
    console.error(error); setStatus(error instanceof Error ? error.message : 'Analysis failed.', 'error');
  } finally { button.disabled = false; }
}

function removeDuplicates() {
  if (!lastAnalysis?.duplicates?.length) return;
  const uniqueRemovals = [...new Set(lastAnalysis.duplicates.map((item) => item.remove))].sort((a,b) => b-a);
  for (const index of uniqueRemovals) {
    const card = $$('.frame-card')[index];
    if (!card) continue;
    card.click(); $('#deleteBtn')?.click();
  }
  setStatus(`Removed ${uniqueRemovals.length} duplicate frame${uniqueRemovals.length === 1 ? '' : 's'}.`, 'ok');
  lastAnalysis = null;
  $('#stableAiRemoveDup', panel).disabled = true;
}

function applyPingPong() {
  const input = $('#pingInput');
  if (!(input instanceof HTMLInputElement)) return;
  input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true }));
  setStatus('Ping-pong enabled for the current animation.', 'ok');
}

function createPanel() {
  panel = document.createElement('section'); panel.className = 'sss-module-panel';
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start"><div><h3>AI Fixer Lite</h3><div class="muted">Local visual diagnostics. No upload and no analysis until you press Analyze.</div></div><button class="btn" data-ai-close>Close</button></div>
    <div class="sss-module-toolbar"><button class="btn green" id="stableAiAnalyze">Analyze</button><button class="btn" id="stableAiRemoveDup" disabled>Remove duplicates</button><button class="btn" id="stableAiPingPong" disabled>Enable ping-pong</button></div>
    <div class="sss-module-grid" id="stableAiSummary"></div>
    <div style="margin-top:14px;display:grid;grid-template-columns:minmax(220px,360px) 1fr;gap:14px;align-items:start"><canvas id="stableAiHeatmap" style="width:100%;height:auto;border:1px solid #263750;border-radius:10px;background:#08101a"></canvas><div id="stableAiDetails" style="display:grid;gap:6px"></div></div>
    <div class="sss-module-row" style="margin-top:12px"><span>Status</span><strong data-ai-status>Ready</strong></div>
    <div class="muted" style="margin-top:10px">Guard: max ${MAX_FRAMES} frames and ${(MAX_PIXELS / 1_000_000).toFixed(0)} megapixels per analysis.</div>`;
  document.body.append(panel);
  $('[data-ai-close]', panel).addEventListener('click', () => panel.hidden = true);
  $('#stableAiAnalyze', panel).addEventListener('click', () => void runAnalysis());
  $('#stableAiRemoveDup', panel).addEventListener('click', removeDuplicates);
  $('#stableAiPingPong', panel).addEventListener('click', applyPingPong);
}

export async function open() {
  if (!initialized) { initialized = true; createPanel(); }
  panel.hidden = false;
  setStatus($$('.frame-card').length ? `Ready · ${$$('.frame-card').length} frames` : 'Load frames first.');
}
