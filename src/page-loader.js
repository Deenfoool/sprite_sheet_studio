const app = document.querySelector('#app');
const gifModuleUrl = new URL('./vendor/gifenc.esm.js', import.meta.url).href;
const zipModuleUrl = new URL('./zip-store.js', import.meta.url).href;
const toolsModuleUrl = new URL('./sprite-tools.js', import.meta.url).href;
const extensionUrl = new URL('./editor-extensions.js', import.meta.url);
const customAnchorUrl = new URL('./custom-anchor.js', import.meta.url);
const engineExportsUrl = new URL('./engine-exports.js', import.meta.url);
const apngExportUrl = new URL('./apng-export.js', import.meta.url);
const asepriteExportUrl = new URL('./aseprite-export.js', import.meta.url);
const aiFixerUrl = new URL('./ai-fixer.js', import.meta.url);
const uxToolsUrl = new URL('./ux-tools.js', import.meta.url);
const performanceUrl = new URL('./performance.js', import.meta.url);
const performanceGuardsUrl = new URL('./performance-guards.js', import.meta.url);
const riggingUrl = new URL('./rigging.js', import.meta.url);
const skeletalAnimationUrl = new URL('./skeletal-animation.js', import.meta.url);
const meshUrl = new URL('./mesh.js', import.meta.url);
const ikUrl = new URL('./ik.js', import.meta.url);

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
    .replace(/import\s*\{[\s\S]*?\}\s*from\s+['"]\.\/sprite-tools['"];?/, `import { alignCanvases, cloneCanvas, get2d, opaqueBounds, suggestTransparentGrid, trimTransparent } from '${toolsModuleUrl}';`)
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

async function fetchText(url, label) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Could not load ${label}: HTTP ${response.status}`);
  return response.text();
}

function patchProjectExtension(extension) {
  let code = extension;
  const cloneNeedle = `      hold: frame.hold ?? 1\n    };`;
  const serializeNeedle = `          hold: frame.hold ?? 1,\n          png: frame.canvas.toDataURL('image/png')`;
  const deserializeNeedle = `          hold: Math.max(1, Number(frame.hold) || 1),\n          canvas: await canvasFromDataUrl(frame.png)`;

  if (!code.includes(cloneNeedle) || !code.includes(serializeNeedle) || !code.includes(deserializeNeedle)) {
    throw new Error('Project System custom-anchor patch markers were not found.');
  }

  code = code
    .replace(cloneNeedle, `      hold: frame.hold ?? 1,\n      customAnchor: frame.customAnchor ? { ...frame.customAnchor } : null\n    };`)
    .replace(serializeNeedle, `          hold: frame.hold ?? 1,\n          customAnchor: frame.customAnchor ? { ...frame.customAnchor } : null,\n          png: frame.canvas.toDataURL('image/png')`)
    .replace(deserializeNeedle, `          hold: Math.max(1, Number(frame.hold) || 1),\n          customAnchor: frame.customAnchor && Number.isFinite(frame.customAnchor.u) && Number.isFinite(frame.customAnchor.v)\n            ? { u: Number(frame.customAnchor.u), v: Number(frame.customAnchor.v) }\n            : null,\n          canvas: await canvasFromDataUrl(frame.png)`);
  return code;
}

function exposeProjectBridge(extension) {
  const marker = '  void restoreAutosave();\n})();';
  if (!extension.includes(marker)) throw new Error('Project System runtime marker was not found.');
  const bridge = `  globalThis.__SSSProject = {\n    runtime: () => captureRuntimeProject(),\n    serialized: () => serializeProject(),\n    autosave: () => scheduleAutosave()\n  };\n\n  void restoreAutosave();\n})();`;
  return extension.replace(marker, bridge);
}

function exposeRigBridge(rigging) {
  const marker = '  resetRig();\n})();';
  if (!rigging.includes(marker)) throw new Error('Rigging runtime marker was not found.');
  const bridge = `  globalThis.__SSSRig = {\n    state: rig,\n    draw: () => drawRig(),\n    render: () => renderRigUi(),\n    boneById: (id) => boneById(id),\n    partById: (id) => partById(id)\n  };\n\n  resetRig();\n})();`;
  return rigging.replace(marker, bridge);
}

async function boot() {
  const sourceUrl = new URL('./main-v2.ts', import.meta.url);
  const [source, extension, customAnchor, engineExports, apngExport, asepriteExport, aiFixer, uxTools, performanceTools, performanceGuards, rigging, skeletalAnimation, mesh, ik] = await Promise.all([
    fetchText(sourceUrl, 'editor source'),
    fetchText(extensionUrl, 'project system'),
    fetchText(customAnchorUrl, 'custom anchor tools'),
    fetchText(engineExportsUrl, 'engine exporters'),
    fetchText(apngExportUrl, 'APNG exporter'),
    fetchText(asepriteExportUrl, 'Aseprite exporter'),
    fetchText(aiFixerUrl, 'AI sprite fixer'),
    fetchText(uxToolsUrl, 'professional editor tools'),
    fetchText(performanceUrl, 'performance tools'),
    fetchText(performanceGuardsUrl, 'performance guards'),
    fetchText(riggingUrl, 'bone rigging workspace'),
    fetchText(skeletalAnimationUrl, 'skeletal animation editor'),
    fetchText(meshUrl, 'mesh deformation'),
    fetchText(ikUrl, 'inverse kinematics')
  ]);

  const projectExtension = exposeProjectBridge(patchProjectExtension(extension));
  const js = `${stripMainTypeScript(source)}\n\n${projectExtension}\n\n${customAnchor}\n\n${engineExports}\n\n${apngExport}\n\n${asepriteExport}\n\n${aiFixer}\n\n${uxTools}\n\n${performanceTools}\n\n${performanceGuards}\n\n${exposeRigBridge(rigging)}\n\n${skeletalAnimation}\n\n${mesh}\n\n${ik}`;

  const blobUrl = URL.createObjectURL(new Blob([`${js}\n//# sourceURL=sprite-sheet-studio-runtime.js`], { type: 'text/javascript' }));
  try {
    await import(blobUrl);
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }
}

boot().catch(showFatal);
