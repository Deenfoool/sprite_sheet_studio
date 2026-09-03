const app = document.querySelector('#app');

function showFatal(error) {
  console.error('[Sprite Sheet Studio] startup failed', error);
  if (!app) return;
  const message = error instanceof Error ? error.message : String(error);
  app.innerHTML = `
    <main style="min-height:100vh;display:grid;place-items:center;background:#080d16;color:#e8edf6;font:14px system-ui;padding:24px">
      <div style="max-width:680px;border:1px solid #213149;border-radius:14px;background:#0e1624;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.3)">
        <h1 style="margin:0 0 10px;font-size:20px">Sprite Sheet Studio</h1>
        <p style="margin:0 0 12px;color:#9cadc3;line-height:1.55">The editor could not start.</p>
        <pre style="white-space:pre-wrap;word-break:break-word;margin:0;padding:12px;border-radius:9px;background:#080d16;color:#ff9bad;border:1px solid #3b2631;font:12px ui-monospace,monospace">${escapeHtml(message)}</pre>
      </div>
    </main>`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
}

function stripMainTypeScript(source) {
  let code = source;

  code = code
    .replace(/^import\s+['"]\.\/styles\.css['"];?\s*$/m, '')
    .replace(/^import\s+['"]\.\/smart-tools\.css['"];?\s*$/m, '')
    .replace(/import\s+\{\s*GIFEncoder\s*,\s*quantize\s*,\s*applyPalette\s*\}\s+from\s+['"]gifenc['"];?/, "import { GIFEncoder, quantize, applyPalette } from './vendor/gifenc.esm.js';")
    .replace(/import\s+\{\s*zipSync\s*\}\s+from\s+['"]fflate['"];?/, "import { zipSync } from './zip-store.js';")
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*['"]\.\/sprite-tools['"];?/, "import { alignCanvases, cloneCanvas, get2d, opaqueBounds, suggestTransparentGrid, trimTransparent } from './sprite-tools.js';")
    .replace(/type\s+SpriteFrame\s*=\s*\{[\s\S]*?const\s+state\s*:\s*AppState\s*=/, 'const state =')
    .replace(/function\s+q<T\s+extends\s+Element>\(selector:\s*string\):\s*T/g, 'function q(selector)')
    .replace(/\bq<[^>]+>/g, 'q')
    .replace(/\.querySelector<[^>]+>/g, '.querySelector')
    .replace(/document\.querySelector<[^>]+>/g, 'document.querySelector')
    .replace(/const\s+frames\s*:\s*SpriteFrame\[\]\s*=/g, 'const frames =')
    .replace(/const\s+labels\s*:\s*Record<AnchorMode,\s*string>\s*=/g, 'const labels =')
    .replace(/const\s+anchorLabels\s*:\s*Record<AnchorMode,\s*string>\s*=/g, 'const anchorLabels =')
    .replace(/const\s+files\s*:\s*Record<string,\s*Uint8Array>\s*=/g, 'const files =')
    .replace(/\(color:\s*number\[\]\)\s*=>/g, '(color) =>')
    .replace(/\s+as\s+AnchorMode\b/g, '')
    .replace(/\s+as\s+PreviewBackground\b/g, '')
    .replace(/\s+as\s+HTMLElement\s*\|\s*null\b/g, '')
    .replace(/function\s+transformCurrent\(kind:\s*'flip-x'\s*\|\s*'flip-y'\s*\|\s*'rotate'\)/g, 'function transformCurrent(kind)')
    .replace(/:\s*\{\s*width:\s*number;\s*height:\s*number\s*\}\s*\{/g, ' {')
    .replace(/\):\s*Promise<void>\s*\{/g, ') {')
    .replace(/\):\s*HTMLCanvasElement\s*\{/g, ') {')
    .replace(/\):\s*CanvasRenderingContext2D\s*\{/g, ') {')
    .replace(/\):\s*string\s*\{/g, ') {')
    .replace(/\):\s*number\s*\{/g, ') {')
    .replace(/\):\s*void\s*\{/g, ') {')
    .replace(/\b(fileList|value|selector|width|height|now|frame|busy|message|blob|filename|color)\s*:\s*(?:FileList\s*\|\s*File\[\]|string|number|boolean|HTMLCanvasElement|SpriteFrame|Blob|CanvasRenderingContext2D)(?=\s*[,)=])/g, '$1');

  return code;
}

async function boot() {
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    await import('/src/main-v2.ts');
    return;
  }

  const response = await fetch('./src/main-v2.ts', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Could not load editor source: HTTP ${response.status}`);
  const source = await response.text();
  const js = stripMainTypeScript(source);

  const blobUrl = URL.createObjectURL(new Blob([`${js}\n//# sourceURL=sprite-sheet-studio-runtime.js`], { type: 'text/javascript' }));
  try {
    await import(blobUrl);
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }
}

boot().catch(showFatal);
