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

function checkWebpCanvasEncoding() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext('2d');
    ctx?.fillRect(0, 0, 2, 2);
    const encoded = canvas.toDataURL('image/webp');
    const ok = encoded.startsWith('data:image/webp');
    result('Canvas WebP encoding', ok, ok ? 'image/webp supported' : 'browser fell back to another format');
  } catch (error) {
    result('Canvas WebP encoding', false, error instanceof Error ? error.message : String(error));
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

  checkWebpCanvasEncoding();
  result('createImageBitmap', typeof createImageBitmap === 'function', typeof createImageBitmap);
  result('IndexedDB', typeof indexedDB !== 'undefined', typeof indexedDB);
  result('Web Worker', typeof Worker === 'function', typeof Worker);
  result('CompressionStream', typeof CompressionStream === 'function', typeof CompressionStream);
  result('matchMedia / reduced motion', typeof matchMedia === 'function', typeof matchMedia);
  result('Project System', Boolean(globalThis.__SSSProject), globalThis.__SSSProject ? 'bridge ready' : 'bridge missing');
  result('Rigging', Boolean(globalThis.__SSSRig), globalThis.__SSSRig ? 'bridge ready' : 'bridge missing');
  result('Skeletal library', Boolean(globalThis.__SSSSkeletal), globalThis.__SSSSkeletal ? 'bridge ready' : 'bridge missing');
  result('Skeletal easing persistence', Boolean(globalThis.__SSSSkeletalEasing), globalThis.__SSSSkeletalEasing ? 'easing extension ready' : 'extension missing');
  result('Rig project persistence', Boolean(globalThis.__SSSRigPersistence), globalThis.__SSSRigPersistence ? 'full .sss integration ready' : 'persistence bridge missing');
  result('Multi-chain IK', Boolean(globalThis.__SSSIK?.state?.chains && Array.isArray(globalThis.__SSSIK.state.chains)), globalThis.__SSSIK ? `${globalThis.__SSSIK.state.chains.length} configured chain(s)` : 'solver missing');
  result('IK pole targets', Boolean(globalThis.__SSSIKPole), globalThis.__SSSIKPole ? 'pole-target runtime ready' : 'pole-target runtime missing');
  result('IK stretch', Boolean(globalThis.__SSSIKStretch), globalThis.__SSSIKStretch ? 'stretch runtime ready' : 'stretch runtime missing');
  result('AI Fixer similarity diagnostics', Boolean(globalThis.__SSSAIFixer), globalThis.__SSSAIFixer ? 'duplicate/broken-frame/heatmap runtime ready' : 'AI Fixer diagnostics bridge missing');
  result('Accessibility runtime', Boolean(globalThis.__SSSAccessibility), globalThis.__SSSAccessibility ? 'a11y bridge ready' : 'accessibility module missing');
  result('Skip link', Boolean(document.querySelector('.sss-skip-link')), document.querySelector('.sss-skip-link') ? 'mounted' : 'missing');
  result('Live region', Boolean(document.querySelector('#sss-live-region')), document.querySelector('#sss-live-region') ? 'mounted' : 'missing');
  result('Source cell selection UI', Boolean(document.querySelector('[data-source-cell-status]')), document.querySelector('[data-source-cell-status]') ? 'mounted' : 'missing');
  result('Object Slice UI', Boolean(document.querySelector('#objectSliceBtn')), document.querySelector('#objectSliceBtn') ? 'mounted' : 'missing');
  result('Cleanup comparison UI', Boolean(document.querySelector('.cleanup-compare')), document.querySelector('.cleanup-compare') ? 'mounted' : 'missing');
  result('Onion stack UI', Boolean(document.querySelector('[data-onion-depth]')), document.querySelector('[data-onion-depth]') ? 'mounted' : 'missing');
  result('Animated WebP export', Array.from(document.querySelectorAll('.export-grid button')).some((button) => button.textContent?.includes('Animated WebP')), 'export button');
  result('Unity package export', Array.from(document.querySelectorAll('.export-grid button')).some((button) => button.textContent?.includes('Unity package')), 'export button');

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
    checkFetch('./src/custom-anchor.js', 'Custom anchor module'),
    checkFetch('./src/source-cell-selection.js', 'Source cell selection module'),
    checkFetch('./src/object-slicer.js', 'Object Slice module'),
    checkFetch('./src/cleanup-compare.js', 'Cleanup comparison module'),
    checkFetch('./src/onion-stack.js', 'Onion stack module'),
    checkFetch('./src/ai-fixer.js', 'AI Fixer diagnostics module'),
    checkFetch('./src/animated-webp.js', 'Animated WebP module'),
    checkFetch('./src/unity-package.js', 'Unity package module'),
    checkFetch('./src/skeletal-easing-persistence.js', 'Skeletal easing persistence module'),
    checkFetch('./src/ik-pole.js', 'IK pole-target module'),
    checkFetch('./src/ik-stretch.js', 'IK stretch module'),
    checkFetch('./src/accessibility.js', 'Accessibility module'),
    checkFetch('./src/rig-project-persistence.js', 'Rig project persistence module'),
    checkFetch('./scripts/build-runtime-bundle.mjs', 'Committed runtime generator')
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
