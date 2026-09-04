let panel = null;
let initialized = false;
const MAX_CAPTURE_PIXELS = 64_000_000;
const PAGE_SIZE = 4096;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function setStatus(text, kind = '') {
  const node = $('[data-export-status]', panel);
  if (!node) return;
  node.textContent = text;
  node.dataset.kind = kind;
}

function currentIndex() {
  return Math.max(0, $$('.frame-card').findIndex((node) => node.classList.contains('active')));
}

function cloneCanvas(source) {
  const out = document.createElement('canvas');
  out.width = source.width; out.height = source.height;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0);
  return out;
}

function captureFrames() {
  const count = $$('.frame-card').length;
  if (!count) throw new Error('No frames to export.');
  const preview = $('#previewCanvas');
  if (!(preview instanceof HTMLCanvasElement)) throw new Error('Preview canvas not found.');
  const estimate = preview.width * preview.height * count;
  if (estimate > MAX_CAPTURE_PIXELS) throw new Error(`Export capture guard: this animation is roughly ${(estimate * 4 / 1024 / 1024).toFixed(0)} MB raw. Reduce it or export fewer frames.`);

  const selected = currentIndex();
  const frames = [];
  for (let i = 0; i < count; i += 1) {
    const button = $$('.frame-card')[i];
    button?.click();
    const canvas = $('#previewCanvas');
    if (!(canvas instanceof HTMLCanvasElement) || canvas.classList.contains('hidden')) continue;
    frames.push({ index: i, name: `frame-${String(i + 1).padStart(3, '0')}.png`, canvas: cloneCanvas(canvas) });
  }
  $$('.frame-card')[Math.min(selected, Math.max(0, count - 1))]?.click();
  return frames;
}

function fps() { return Math.max(1, Number($('#fpsInput')?.value) || 8); }
function loop() { return Boolean($('#loopInput')?.checked); }

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG encoding failed.')), 'image/png'));
}

async function canvasBytes(canvas) {
  return new Uint8Array(await (await canvasBlob(canvas)).arrayBuffer());
}

function textBytes(text) { return new TextEncoder().encode(text); }

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function zipFiles(files, filename) {
  const { zipSync } = await import('./zip-store.js');
  const bytes = zipSync(files);
  downloadBlob(new Blob([bytes], { type: 'application/zip' }), filename);
}

async function exportSequence() {
  const frames = captureFrames();
  setStatus(`Encoding ${frames.length} PNG frames…`);
  const files = {};
  for (let i = 0; i < frames.length; i += 1) {
    files[`frames/${frames[i].name}`] = await canvasBytes(frames[i].canvas);
    if (i % 8 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  files['animation.json'] = textBytes(JSON.stringify({ fps: fps(), loop: loop(), frames: frames.map((frame) => frame.name) }, null, 2));
  await zipFiles(files, 'sprite-sequence.zip');
  setStatus('PNG sequence exported.', 'ok');
}

function buildAtlasPages(frames) {
  const cellW = Math.max(...frames.map((frame) => frame.canvas.width));
  const cellH = Math.max(...frames.map((frame) => frame.canvas.height));
  if (cellW > PAGE_SIZE || cellH > PAGE_SIZE) throw new Error(`A frame exceeds the ${PAGE_SIZE}px atlas page limit.`);
  const cols = Math.max(1, Math.floor(PAGE_SIZE / cellW));
  const rows = Math.max(1, Math.floor(PAGE_SIZE / cellH));
  const perPage = cols * rows;
  const pages = [];

  for (let start = 0; start < frames.length; start += perPage) {
    const slice = frames.slice(start, start + perPage);
    const usedCols = Math.min(cols, slice.length);
    const usedRows = Math.ceil(slice.length / cols);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, usedCols * cellW);
    canvas.height = Math.max(1, usedRows * cellH);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const entries = [];
    slice.forEach((frame, localIndex) => {
      const col = localIndex % cols;
      const row = Math.floor(localIndex / cols);
      const x = col * cellW + Math.floor((cellW - frame.canvas.width) / 2);
      const y = row * cellH + (cellH - frame.canvas.height);
      ctx.drawImage(frame.canvas, x, y);
      entries.push({
        name: frame.name.replace(/\.png$/i, ''),
        page: pages.length,
        frame: { x, y, w: frame.canvas.width, h: frame.canvas.height },
        cell: { x: col * cellW, y: row * cellH, w: cellW, h: cellH },
        sourceSize: { w: frame.canvas.width, h: frame.canvas.height },
        duration: Math.round(1000 / fps())
      });
    });
    pages.push({ canvas, entries, cellW, cellH });
  }
  return pages;
}

function asepriteJson(page, imageName, startIndex) {
  const frames = {};
  page.entries.forEach((entry) => {
    frames[`${entry.name}.png`] = {
      frame: entry.frame,
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: entry.frame.w, h: entry.frame.h },
      sourceSize: entry.sourceSize,
      duration: entry.duration
    };
  });
  return {
    frames,
    meta: {
      app: 'Sprite Sheet Studio',
      version: 'stable-lazy',
      image: imageName,
      format: 'RGBA8888',
      size: { w: page.canvas.width, h: page.canvas.height },
      scale: '1',
      frameTags: [{ name: 'default', from: startIndex, to: startIndex + page.entries.length - 1, direction: 'forward' }]
    }
  };
}

function phaserJson(page, imageName) {
  const frames = {};
  page.entries.forEach((entry) => {
    frames[entry.name] = {
      frame: entry.frame,
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: entry.frame.w, h: entry.frame.h },
      sourceSize: entry.sourceSize
    };
  });
  return { frames, meta: { app: 'Sprite Sheet Studio', image: imageName, size: { w: page.canvas.width, h: page.canvas.height }, scale: 1 } };
}

function godotTres(pages) {
  const ext = pages.map((_, index) => `[ext_resource type="Texture2D" path="res://atlas-${String(index + 1).padStart(3, '0')}.png" id="${index + 1}_atlas"]`).join('\n');
  const subresources = [];
  const frameRefs = [];
  let subId = 1;
  pages.forEach((page, pageIndex) => {
    page.entries.forEach((entry) => {
      subresources.push(`[sub_resource type="AtlasTexture" id="AtlasTexture_${subId}"]\natlas = ExtResource("${pageIndex + 1}_atlas")\nregion = Rect2(${entry.frame.x}, ${entry.frame.y}, ${entry.frame.w}, ${entry.frame.h})`);
      frameRefs.push(`{\n"duration": 1.0,\n"texture": SubResource("AtlasTexture_${subId}")\n}`);
      subId += 1;
    });
  });
  return `[gd_resource type="SpriteFrames" load_steps=${subId + pages.length} format=3]\n\n${ext}\n\n${subresources.join('\n\n')}\n\n[resource]\nanimations = [{\n"frames": [${frameRefs.join(',')}],\n"loop": ${loop() ? 'true' : 'false'},\n"name": &"default",\n"speed": ${fps().toFixed(2)}\n}]\n`;
}

async function exportAtlasPack() {
  const frames = captureFrames();
  setStatus(`Packing ${frames.length} frames…`);
  const pages = buildAtlasPages(frames);
  const files = {};
  const manifest = { app: 'Sprite Sheet Studio', fps: fps(), loop: loop(), pages: [], frames: [] };
  let frameOffset = 0;
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const base = `atlas-${String(index + 1).padStart(3, '0')}`;
    files[`${base}.png`] = await canvasBytes(page.canvas);
    files[`aseprite/${base}.json`] = textBytes(JSON.stringify(asepriteJson(page, `${base}.png`, frameOffset), null, 2));
    files[`phaser/${base}.json`] = textBytes(JSON.stringify(phaserJson(page, `${base}.png`), null, 2));
    manifest.pages.push({ image: `${base}.png`, width: page.canvas.width, height: page.canvas.height });
    page.entries.forEach((entry) => manifest.frames.push({ ...entry, image: `${base}.png` }));
    frameOffset += page.entries.length;
    setStatus(`Packing atlas page ${index + 1}/${pages.length}…`);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  files['manifest.json'] = textBytes(JSON.stringify(manifest, null, 2));
  files['godot/sprite_frames.tres'] = textBytes(godotTres(pages));
  files['README.txt'] = textBytes('Sprite Sheet Studio export pack\n- atlas-*.png: paged atlases\n- manifest.json: generic metadata\n- aseprite/: Aseprite-compatible JSON\n- phaser/: Phaser atlas JSON\n- godot/sprite_frames.tres: Godot 4 SpriteFrames resource\n');
  await zipFiles(files, 'sprite-atlas-pack.zip');
  setStatus(`Atlas pack exported · ${pages.length} page${pages.length === 1 ? '' : 's'}.`, 'ok');
}

async function runTask(button, task) {
  button.disabled = true;
  try { await task(); }
  catch (error) { console.error(error); setStatus(error instanceof Error ? error.message : 'Export failed.', 'error'); }
  finally { button.disabled = false; }
}

function createPanel() {
  panel = document.createElement('section');
  panel.className = 'sss-module-panel';
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start">
      <div><h3>Export+</h3><div class="muted">Loaded on demand. PNG encoding and ZIP packing run only after an export button is pressed.</div></div>
      <button class="btn" data-export-close>Close</button>
    </div>
    <div class="sss-module-grid" style="margin-top:14px">
      <div class="sss-module-row"><div><strong>PNG sequence</strong><div class="muted">Individual PNG frames + animation.json</div></div><button class="btn" id="stableExportSequence">Export ZIP</button></div>
      <div class="sss-module-row"><div><strong>Atlas package</strong><div class="muted">Paged PNG atlases + Generic/Aseprite/Phaser JSON + Godot .tres</div></div><button class="btn green" id="stableExportAtlas">Export pack</button></div>
    </div>
    <div class="sss-module-row" style="margin-top:12px"><span>Status</span><strong data-export-status>Ready</strong></div>
    <div class="muted" style="margin-top:10px">Atlas pages are capped at ${PAGE_SIZE}×${PAGE_SIZE}; large projects are split automatically.</div>`;
  document.body.append(panel);
  $('[data-export-close]', panel)?.addEventListener('click', () => panel.hidden = true);
  const sequence = $('#stableExportSequence', panel);
  const atlas = $('#stableExportAtlas', panel);
  sequence?.addEventListener('click', () => void runTask(sequence, exportSequence));
  atlas?.addEventListener('click', () => void runTask(atlas, exportAtlasPack));
}

export async function open() {
  if (!initialized) { initialized = true; createPanel(); }
  panel.hidden = false;
  setStatus($$('.frame-card').length ? `Ready · ${$$('.frame-card').length} frames` : 'Load frames before exporting.');
}
