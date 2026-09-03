const app = document.querySelector('#app');
const gifModuleUrl = new URL('./vendor/gifenc.esm.js', import.meta.url).href;
const zipModuleUrl = new URL('./zip-store.js', import.meta.url).href;
const toolsModuleUrl = new URL('./sprite-tools.js', import.meta.url).href;

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

function stripParamTypes(params) {
  return params.split(',').map((part) => {
    const raw = part.trim();
    if (!raw) return raw;
    const equalAt = raw.indexOf('=');
    const left = equalAt >= 0 ? raw.slice(0, equalAt).trim() : raw;
    const right = equalAt >= 0 ? raw.slice(equalAt) : '';
    const colonAt = left.indexOf(':');
    const cleanLeft = colonAt >= 0 ? left.slice(0, colonAt).trim().replace(/\?$/, '') : left;
    return `${cleanLeft}${right ? ` ${right}` : ''}`;
  }).join(', ');
}

function stripFunctionTypes(code) {
  return code.replace(
    /function\s+([A-Za-z_$][\w$]*)\s*(?:<[^>{}]*>)?\s*\(([^()]*)\)\s*(?::\s*(?:Promise<[^>]+>|[A-Za-z_$][\w$]*(?:\[\])?|\{[^{}]*\}))?\s*\{/g,
    (_match, name, params) => `function ${name}(${stripParamTypes(params)}) {`
  );
}

function stripMainTypeScript(source) {
  let code = source;

  code = code
    .replace(/^import\s+['"]\.\/styles\.css['"];?\s*$/m, '')
    .replace(/^import\s+['"]\.\/smart-tools\.css['"];?\s*$/m, '')
    .replace(/import\s+\{\s*GIFEncoder\s*,\s*quantize\s*,\s*applyPalette\s*\}\s+from\s+['"]gifenc['"];?/, `import { GIFEncoder, quantize, applyPalette } from '${gifModuleUrl}';`)
    .replace(/import\s+\{\s*zipSync\s*\}\s+from\s+['"]fflate['"];?/, `import { zipSync } from '${zipModuleUrl}';`)
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*['"]\.\/sprite-tools['"];?/, `import { alignCanvases, cloneCanvas, get2d, opaqueBounds, suggestTransparentGrid, trimTransparent } from '${toolsModuleUrl}';`)
    .replace(/type\s+SpriteFrame\s*=\s*\{[\s\S]*?const\s+state\s*:\s*AppState\s*=/, 'const state =')
    .replace(/\bq<[^>]+>/g, 'q')
    .replace(/\.querySelector<[^>]+>/g, '.querySelector')
    .replace(/document\.querySelector<[^>]+>/g, 'document.querySelector')
    .replace(/\b(const|let|var)\s+([A-Za-z_$][\w$]*)\s*:\s*(?:Record<[^=;\n]+>|[A-Za-z_$][\w$]*(?:\[\])?)\s*=/g, '$1 $2 =')
    .replace(/\(([A-Za-z_$][\w$]*)\s*:\s*[^)]+\)\s*=>/g, '($1) =>')
    .replace(/\s+as\s+(?:AnchorMode|PreviewBackground|HTMLElement\s*\|\s*null)\b/g, '');

  code = stripFunctionTypes(code);

  return code;
}

async function boot() {
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    await import('/src/main-v2.ts');
    return;
  }

  const sourceUrl = new URL('./main-v2.ts', import.meta.url);
  const response = await fetch(sourceUrl, { cache: 'no-cache' });
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
