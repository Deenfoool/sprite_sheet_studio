import { GIFEncoder } from './vendor/gifenc.esm.js';
import { zipSync } from './zip-store.js';

const checks = [];
let initialized = false;

function result(name, ok, detail = '') {
  checks.push({ name, ok: Boolean(ok), detail: String(detail || '') });
}

async function checkFetch(path, name) {
  try {
    const response = await fetch(new URL(path, document.baseURI), { cache: 'no-cache' });
    result(name, response.ok, `HTTP ${response.status}`);
  } catch (error) {
    result(name, false, error instanceof Error ? error.message : String(error));
  }
}

async function runDiagnostics() {
  checks.length = 0;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext('2d');
    ctx?.fillRect(0, 0, 1, 1);
    result('Canvas 2D', Boolean(ctx), ctx ? '2D context available' : 'No 2D context');
  } catch (error) {
    result('Canvas 2D', false, error instanceof Error ? error.message : String(error));
  }

  result('createImageBitmap', typeof createImageBitmap === 'function', typeof createImageBitmap);
  result('IndexedDB', typeof indexedDB !== 'undefined', typeof indexedDB);
  result('Web Worker', typeof Worker === 'function', typeof Worker);
  result('CompressionStream', typeof CompressionStream === 'function', typeof CompressionStream);
  result('Project System', Boolean(globalThis.__SSSProject), globalThis.__SSSProject ? 'bridge ready' : 'bridge missing');
  result('Rigging', Boolean(globalThis.__SSSRig), globalThis.__SSSRig ? 'bridge ready' : 'bridge missing');
  result('IK', Boolean(globalThis.__SSSIK), globalThis.__SSSIK ? 'solver ready' : 'solver missing');

  try {
    const bytes = zipSync({ 'test.txt': new TextEncoder().encode('ok') }, { level: 0 });
    const ok = bytes.length > 22 && bytes[0] === 0x50 && bytes[1] === 0x4b;
    result('ZIP writer', ok, `${bytes.length} bytes`);
  } catch (error) {
    result('ZIP writer', false, error instanceof Error ? error.message : String(error));
  }

  try {
    const gif = GIFEncoder();
    gif.writeFrame(new Uint8Array([0]), 1, 1, { palette: [[0, 0, 0], [255, 255, 255]], delay: 20, repeat: 0 });
    gif.finish();
    const bytes = gif.bytes();
    const header = new TextDecoder().decode(bytes.slice(0, 6));
    result('GIF encoder', header === 'GIF89a' || header === 'GIF87a', `${header} · ${bytes.length} bytes`);
  } catch (error) {
    result('GIF encoder', false, error instanceof Error ? error.message : String(error));
  }

  await Promise.all([
    checkFetch('./src/gif-worker.js', 'GIF worker asset'),
    checkFetch('./src/apng-worker.js', 'APNG worker asset'),
    checkFetch('./src/vendor/gifenc.esm.js', 'Local GIF module'),
    checkFetch('./src/zip-store.js', 'Local ZIP module'),
    checkFetch('./src/page-loader.js', 'Pages loader'),
    checkFetch('./src/multi-atlas.js', 'Multi-atlas module'),
    checkFetch('./src/aseprite-export.js', 'Aseprite exporter'),
    checkFetch('./src/custom-anchor.js', 'Custom anchor module')
  ]);

  return {
    app: 'Sprite Sheet Studio',
    timestamp: new Date().toISOString(),
    url: location.href,
    userAgent: navigator.userAgent,
    secureContext: globalThis.isSecureContext,
    passed: checks.filter((item) => item.ok).length,
    failed: checks.filter((item) => !item.ok).length,
    checks: checks.map((item) => ({ ...item }))
  };
}

function downloadReport(report) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'sprite-sheet-studio-diagnostics.json';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function init() {
  if (initialized) return true;
  const topActions = document.querySelector('.top-actions');
  if (!topActions) return false;
  initialized = true;

  const button = document.createElement('button');
  button.className = 'btn';
  button.textContent = 'Diagnostics';
  button.title = 'Run browser smoke checks';
  topActions.append(button);

  const modal = document.createElement('div');
  modal.className = 'sss-diagnostics hidden';
  modal.innerHTML = `
    <div class="sss-diagnostics-card">
      <div class="sss-diagnostics-head">
        <div><strong>Runtime Diagnostics</strong><small>local smoke tests</small></div>
        <button class="btn" data-diag-close>Close</button>
      </div>
      <div class="sss-diagnostics-summary" data-diag-summary>Not run yet.</div>
      <div class="sss-diagnostics-list" data-diag-list></div>
      <div class="sss-diagnostics-actions">
        <button class="btn primary" data-diag-rerun>Run again</button>
        <button class="btn" data-diag-export>Export report JSON</button>
      </div>
    </div>`;
  document.body.append(modal);

  const summary = modal.querySelector('[data-diag-summary]');
  const list = modal.querySelector('[data-diag-list]');
  let lastReport = null;

  function render(report) {
    summary.textContent = `${report.passed} passed · ${report.failed} failed`;
    summary.classList.toggle('has-failures', report.failed > 0);
    list.innerHTML = '';
    report.checks.forEach((item) => {
      const row = document.createElement('div');
      row.className = `sss-diagnostics-row ${item.ok ? 'ok' : 'fail'}`;
      const icon = document.createElement('span');
      icon.textContent = item.ok ? '✓' : '×';
      const main = document.createElement('span');
      const title = document.createElement('b');
      title.textContent = item.name;
      const detail = document.createElement('small');
      detail.textContent = item.detail;
      main.append(title, detail);
      row.append(icon, main);
      list.append(row);
    });
  }

  async function openAndRun() {
    modal.classList.remove('hidden');
    summary.textContent = 'Running…';
    summary.classList.remove('has-failures');
    list.innerHTML = '<div class="sss-diagnostics-loading">Checking browser/runtime capabilities…</div>';
    lastReport = await runDiagnostics();
    render(lastReport);
  }

  button.addEventListener('click', () => void openAndRun());
  modal.querySelector('[data-diag-close]').addEventListener('click', () => modal.classList.add('hidden'));
  modal.querySelector('[data-diag-rerun]').addEventListener('click', () => void openAndRun());
  modal.querySelector('[data-diag-export]').addEventListener('click', () => { if (lastReport) downloadReport(lastReport); });
  modal.addEventListener('click', (event) => { if (event.target === modal) modal.classList.add('hidden'); });

  globalThis.__SSSDiagnostics = { run: runDiagnostics, open: openAndRun };

  if (new URLSearchParams(location.search).get('selftest') === '1') setTimeout(() => void openAndRun(), 150);
  return true;
}

if (!init()) {
  const observer = new MutationObserver(() => {
    if (!init()) return;
    observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
