let panel = null;
let initialized = false;

const MODULE_URLS = [
  'stable-project-tools.js',
  'stable-cleanup-tools.js',
  'stable-object-tools.js',
  'stable-ai-tools.js',
  'stable-export-tools.js',
  'stable-rig-lazy.js',
  'stable-skeletal-lazy.js',
  'stable-ik-lazy.js',
  'stable-mesh-lazy.js'
];

const $ = (selector, root = document) => root.querySelector(selector);

function row(label, status, detail = '') {
  const node = document.createElement('div');
  node.className = 'sss-module-row';
  const left = document.createElement('div');
  const strong = document.createElement('strong'); strong.textContent = label;
  const small = document.createElement('div'); small.className = 'muted'; small.textContent = detail;
  left.append(strong, small);
  const badge = document.createElement('strong'); badge.textContent = status; badge.style.color = status === 'PASS' ? '#16c79a' : status === 'WARN' ? '#ffc76b' : '#ff8da0';
  node.append(left, badge); return node;
}

async function checkModuleFiles() {
  const base = new URL('./', import.meta.url);
  const results = [];
  for (const file of MODULE_URLS) {
    try {
      const response = await fetch(new URL(file, base), { cache: 'no-store' });
      results.push({ file, ok: response.ok, detail: response.ok ? `${response.status} · ${response.headers.get('content-length') || 'size unknown'}` : `HTTP ${response.status}` });
    } catch (error) {
      results.push({ file, ok: false, detail: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
}

async function run() {
  const output = $('#stableDiagnosticsOutput', panel); output.innerHTML = '';
  const button = $('#stableDiagnosticsRun', panel); button.disabled = true;
  try {
    output.append(row('Stable core ready', document.documentElement.dataset.sssReady === 'stable' ? 'PASS' : 'FAIL', `ready=${document.documentElement.dataset.sssReady || 'unset'}`));

    try {
      const canvas = document.createElement('canvas'); canvas.width = 2; canvas.height = 2;
      const ctx = canvas.getContext('2d'); ctx.fillRect(0,0,1,1); output.append(row('Canvas 2D', ctx ? 'PASS' : 'FAIL', ctx ? 'Context created' : 'No context'));
    } catch (error) { output.append(row('Canvas 2D','FAIL',String(error))); }

    output.append(row('createImageBitmap', typeof createImageBitmap === 'function' ? 'PASS' : 'FAIL', typeof createImageBitmap));
    output.append(row('DataTransfer', typeof DataTransfer === 'function' ? 'PASS' : 'WARN', typeof DataTransfer === 'function' ? 'Project/Object restore supported' : 'Programmatic timeline restore unavailable'));
    output.append(row('Web Worker', typeof Worker === 'function' ? 'PASS' : 'WARN', typeof Worker));
    output.append(row('CompressionStream', typeof CompressionStream === 'function' ? 'PASS' : 'WARN', typeof CompressionStream));
    output.append(row('IndexedDB', typeof indexedDB !== 'undefined' ? 'PASS' : 'WARN', 'Not used during stable startup'));
    output.append(row('Lucide CDN', globalThis.lucide?.createIcons ? 'PASS' : 'WARN', globalThis.lucide?.createIcons ? 'Loaded on demand' : 'Not loaded; text controls still work'));

    try {
      const { zipSync } = await import('./zip-store.js');
      const bytes = zipSync({ 'diagnostic.txt': new TextEncoder().encode('ok') });
      const zipOk = bytes[0] === 0x50 && bytes[1] === 0x4b;
      output.append(row('ZIP encoder', zipOk ? 'PASS' : 'FAIL', `${bytes.length} bytes`));
    } catch (error) { output.append(row('ZIP encoder','FAIL',error instanceof Error ? error.message : String(error))); }

    const moduleResults = await checkModuleFiles();
    moduleResults.forEach((result) => output.append(row(`File: ${result.file}`, result.ok ? 'PASS' : 'FAIL', result.detail)));

    const cards = document.querySelectorAll('.frame-card').length;
    const preview = document.querySelector('#previewCanvas');
    const rawMb = preview instanceof HTMLCanvasElement ? preview.width * preview.height * Math.max(1,cards) * 4 / 1024 / 1024 : 0;
    output.append(row('Current frame memory estimate', rawMb < 128 ? 'PASS' : 'WARN', `${cards} frames · ~${rawMb.toFixed(1)} MB raw at current frame size`));
  } finally {
    button.disabled = false;
  }
}

function createPanel() {
  panel = document.createElement('section'); panel.className = 'sss-module-panel';
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start"><div><h3>Diagnostics</h3><div class="muted">Nothing runs until Run diagnostics is pressed.</div></div><button class="btn" data-diagnostics-close>Close</button></div>
    <div class="sss-module-toolbar"><button class="btn green" id="stableDiagnosticsRun">Run diagnostics</button></div>
    <div class="sss-module-grid" id="stableDiagnosticsOutput"></div>`;
  document.body.append(panel);
  $('[data-diagnostics-close]',panel).addEventListener('click',()=>panel.hidden=true);
  $('#stableDiagnosticsRun',panel).addEventListener('click',()=>void run());
}

export async function open() {
  if (!initialized) { initialized=true; createPanel(); }
  panel.hidden=false;
}
