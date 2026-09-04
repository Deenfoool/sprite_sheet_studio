const app = document.querySelector('#app');
const gifModuleUrl = new URL('./vendor/gifenc.esm.js', import.meta.url).href;
const zipModuleUrl = new URL('./zip-store.js', import.meta.url).href;
const toolsModuleUrl = new URL('./sprite-tools.js', import.meta.url).href;
const extensionUrl = new URL('./editor-extensions.js', import.meta.url);
const customAnchorUrl = new URL('./custom-anchor.js', import.meta.url);
const engineExportsUrl = new URL('./engine-exports.js', import.meta.url);
const multiAtlasUrl = new URL('./multi-atlas.js', import.meta.url);
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
const rigProjectPersistenceUrl = new URL('./rig-project-persistence.js', import.meta.url);

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

function patchRiggingScale(rigging) {
  let code = rigging;
  const uiNeedle = `            <div class="rig-three">\n              <div class="rig-field"><label>Rotation °</label><input id="rigPartRotation" type="number" step="1" /></div>\n              <div class="rig-field"><label>Z order</label><input id="rigPartZ" type="number" step="1" /></div>\n              <div class="rig-field"><label>Opacity</label><input id="rigPartOpacity" type="number" min="0" max="1" step="0.05" /></div>\n            </div>`;
  const refsNeedle = `    partRotation: overlay.querySelector('#rigPartRotation'),\n    partZ: overlay.querySelector('#rigPartZ'),`;
  const inspectNeedle = `      r.partRotation.value = String(part.rotation);\n      r.partZ.value = String(part.z);`;
  const drawNeedle = `    ctx.rotate(world.rotation + radians(part.rotation));\n    ctx.imageSmoothingEnabled = false;`;
  const loadNeedle = `        rotation: 0,\n        z: rig.parts.length,`;
  const exportNeedle = `        rotation: part.rotation,\n        z: part.z,`;
  const updateNeedle = `      part.rotation = Number(r.partRotation.value) || 0;\n      part.z = Number(r.partZ.value) || 0;`;
  const inputsNeedle = `[r.partName, r.partBone, r.partX, r.partY, r.partPivotX, r.partPivotY, r.partRotation, r.partZ, r.partOpacity, r.partVisible]`;

  const markers = [uiNeedle, refsNeedle, inspectNeedle, drawNeedle, loadNeedle, exportNeedle, updateNeedle, inputsNeedle];
  if (markers.some((marker) => !code.includes(marker))) throw new Error('Rigging scale patch markers were not found.');

  code = code
    .replace(uiNeedle, `${uiNeedle}\n            <div class="rig-two">\n              <div class="rig-field"><label>Scale X</label><input id="rigPartScaleX" type="number" min="-10" max="10" step="0.05" value="1" /></div>\n              <div class="rig-field"><label>Scale Y</label><input id="rigPartScaleY" type="number" min="-10" max="10" step="0.05" value="1" /></div>\n            </div>`)
    .replace(refsNeedle, `    partRotation: overlay.querySelector('#rigPartRotation'),\n    partScaleX: overlay.querySelector('#rigPartScaleX'),\n    partScaleY: overlay.querySelector('#rigPartScaleY'),\n    partZ: overlay.querySelector('#rigPartZ'),`)
    .replace(inspectNeedle, `      r.partRotation.value = String(part.rotation);\n      r.partScaleX.value = String(part.scaleX ?? 1);\n      r.partScaleY.value = String(part.scaleY ?? 1);\n      r.partZ.value = String(part.z);`)
    .replace(drawNeedle, `    ctx.rotate(world.rotation + radians(part.rotation));\n    ctx.scale(part.scaleX ?? 1, part.scaleY ?? 1);\n    ctx.imageSmoothingEnabled = false;`)
    .replace(loadNeedle, `        rotation: 0,\n        scaleX: 1,\n        scaleY: 1,\n        z: rig.parts.length,`)
    .replace(exportNeedle, `        rotation: part.rotation,\n        scaleX: part.scaleX ?? 1,\n        scaleY: part.scaleY ?? 1,\n        z: part.z,`)
    .replace(updateNeedle, `      part.rotation = Number(r.partRotation.value) || 0;\n      part.scaleX = Number.isFinite(Number(r.partScaleX.value)) ? Number(r.partScaleX.value) : 1;\n      part.scaleY = Number.isFinite(Number(r.partScaleY.value)) ? Number(r.partScaleY.value) : 1;\n      part.z = Number(r.partZ.value) || 0;`)
    .replace(inputsNeedle, `[r.partName, r.partBone, r.partX, r.partY, r.partPivotX, r.partPivotY, r.partRotation, r.partScaleX, r.partScaleY, r.partZ, r.partOpacity, r.partVisible]`);

  return code;
}

function patchSkeletalScale(skeletal) {
  let code = skeletal;
  const captureNeedle = `        rotation: part.rotation,\n        z: part.z,`;
  const applyNeedle = `      part.rotation = value.rotation;\n      part.z = value.z;`;
  const mirrorNeedle = `    Object.values(mirrored.parts || {}).forEach((part) => {\n      part.x = -part.x;\n      part.rotation = -part.rotation;\n    });`;
  if (!code.includes(captureNeedle) || !code.includes(applyNeedle) || !code.includes(mirrorNeedle)) {
    throw new Error('Skeletal scale patch markers were not found.');
  }
  return code
    .replace(captureNeedle, `        rotation: part.rotation,\n        scaleX: part.scaleX ?? 1,\n        scaleY: part.scaleY ?? 1,\n        z: part.z,`)
    .replace(applyNeedle, `      part.rotation = value.rotation;\n      part.scaleX = Number.isFinite(value.scaleX) ? value.scaleX : 1;\n      part.scaleY = Number.isFinite(value.scaleY) ? value.scaleY : 1;\n      part.z = value.z;`)
    .replace(mirrorNeedle, `    Object.values(mirrored.parts || {}).forEach((part) => {\n      part.x = -part.x;\n      part.rotation = -part.rotation;\n      part.scaleX = -(part.scaleX ?? 1);\n    });`);
}

function exposeProjectBridge(extension) {
  const marker = '  void restoreAutosave();\n})();';
  if (!extension.includes(marker)) throw new Error('Project System runtime marker was not found.');
  const bridge = `  let pendingStartupAutosave = null;\n\n  function pngDimensionsFromDataUrl(url) {\n    try {\n      if (typeof url !== 'string' || !url.startsWith('data:image/png;base64,')) return null;\n      const base64 = url.slice(url.indexOf(',') + 1, url.indexOf(',') + 1 + 64);\n      const binary = atob(base64);\n      if (binary.length < 24) return null;\n      const byte = (index) => binary.charCodeAt(index) & 255;\n      const width = (((byte(16) << 24) >>> 0) + (byte(17) << 16) + (byte(18) << 8) + byte(19)) >>> 0;\n      const height = (((byte(20) << 24) >>> 0) + (byte(21) << 16) + (byte(22) << 8) + byte(23)) >>> 0;\n      return width > 0 && height > 0 ? { width, height } : null;\n    } catch {\n      return null;\n    }\n  }\n\n  function estimateAutosaveCost(saved) {\n    let frames = 0;\n    let encodedBytes = 0;\n    let rawBytes = 0;\n    for (const animation of Object.values(saved?.animations || {})) {\n      for (const frame of animation?.frames || []) {\n        frames += 1;\n        const png = typeof frame?.png === 'string' ? frame.png : '';\n        const comma = png.indexOf(',');\n        const encoded = comma >= 0 ? png.length - comma - 1 : png.length;\n        encodedBytes += Math.ceil(encoded * 0.75);\n        const dimensions = pngDimensionsFromDataUrl(png);\n        if (dimensions) rawBytes += dimensions.width * dimensions.height * 4;\n      }\n    }\n    return { frames, encodedBytes, rawBytes };\n  }\n\n  function initializeEmptyProjectAfterDeferredRestore() {\n    if (!animations.size) animations.set('idle', captureAnimation());\n    renderAnimationSelect();\n    resetHistory();\n  }\n\n  function mountRestoreAutosaveButton() {\n    if (document.querySelector('[data-sss-restore-autosave]')) return;\n    const button = document.createElement('button');\n    button.className = 'btn';\n    button.dataset.sssRestoreAutosave = '1';\n    button.textContent = 'Restore autosave';\n    button.title = 'Restore the saved project that was deferred to keep startup responsive';\n    button.addEventListener('click', async () => {\n      if (!pendingStartupAutosave || button.disabled) return;\n      button.disabled = true;\n      setSaveStatus('restoring…', 'saving');\n      try {\n        const saved = pendingStartupAutosave;\n        pendingStartupAutosave = null;\n        await deserializeProject(saved);\n        setSaveStatus('restored', 'saved');\n        button.remove();\n        toast('Autosaved project restored');\n      } catch (error) {\n        console.error(error);\n        pendingStartupAutosave = null;\n        setSaveStatus('restore failed', 'error');\n        button.remove();\n        toast('Autosave restore failed. Your saved data was left untouched.', true);\n      }\n    });\n    document.querySelector('.top-actions')?.append(button);\n  }\n\n  async function restoreAutosaveSafely() {\n    try {\n      const saved = await getAutosave();\n      autosaveReady = true;\n      if (saved && Object.keys(saved.animations || {}).length) {\n        const cost = estimateAutosaveCost(saved);\n        const forceDeferred = new URLSearchParams(location.search).get('no-restore') === '1';\n        const heavy = forceDeferred || cost.frames > 64 || cost.encodedBytes > 16 * 1024 * 1024 || cost.rawBytes > 96 * 1024 * 1024;\n        if (heavy) {\n          pendingStartupAutosave = saved;\n          initializeEmptyProjectAfterDeferredRestore();\n          setSaveStatus('autosave available', 'saved');\n          mountRestoreAutosaveButton();\n          console.warn('[Sprite Sheet Studio] deferred heavy autosave restore', cost);\n        } else {\n          await deserializeProject(saved);\n          setSaveStatus('restored', 'saved');\n          toast('Autosaved project restored');\n        }\n      } else {\n        animations.set('idle', captureAnimation());\n        renderAnimationSelect();\n        resetHistory();\n        setSaveStatus('autosave on', 'saved');\n      }\n    } catch (error) {\n      console.error(error);\n      autosaveReady = true;\n      if (!animations.size) animations.set('idle', captureAnimation());\n      renderAnimationSelect();\n      resetHistory();\n      setSaveStatus('autosave unavailable', 'error');\n    }\n  }\n\n  globalThis.__SSSProject = {\n    runtime: () => captureRuntimeProject(),\n    serialized: () => serializeProject(),\n    autosave: () => scheduleAutosave(),\n    restoreDeferredAutosave: async () => {\n      if (!pendingStartupAutosave) return false;\n      const saved = pendingStartupAutosave;\n      pendingStartupAutosave = null;\n      await deserializeProject(saved);\n      return true;\n    }\n  };\n\n  void restoreAutosaveSafely();\n})();`;
  return extension.replace(marker, bridge);
}

function exposeRigBridge(rigging) {
  const marker = '  resetRig();\n})();';
  if (!rigging.includes(marker)) throw new Error('Rigging runtime marker was not found.');
  const bridge = `  globalThis.__SSSRig = {\n    state: rig,\n    draw: () => drawRig(),\n    render: () => renderRigUi(),\n    boneById: (id) => boneById(id),\n    partById: (id) => partById(id)\n  };\n\n  resetRig();\n})();`;
  return rigging.replace(marker, bridge);
}

function exposeSkeletalBridge(skeletal) {
  const marker = '  renderAnimationSelect();\n})();';
  if (!skeletal.includes(marker)) throw new Error('Skeletal runtime marker was not found.');
  const bridge = `  function serializeSkeletalLibrary() {\n    return {\n      version: 1,\n      activeName,\n      currentFrame,\n      animations: Object.fromEntries([...library.entries()].map(([name, anim]) => [name, {\n        fps: anim.fps,\n        length: anim.length,\n        loop: anim.loop,\n        interpolation: anim.interpolation,\n        keyframes: Object.fromEntries([...anim.keyframes.entries()].map(([frame, pose]) => [String(frame), clonePose(pose)]))\n      }]))\n    };\n  }\n\n  function restoreSkeletalLibrary(data) {\n    if (!data || data.version !== 1 || !data.animations || typeof data.animations !== 'object') return;\n    playing = false;\n    playBtn.textContent = '▶';\n    library.clear();\n    Object.entries(data.animations).forEach(([name, raw]) => {\n      const anim = newAnimation(name);\n      anim.fps = Math.max(1, Math.min(60, Number(raw.fps) || 12));\n      anim.length = Math.max(1, Math.min(600, Number(raw.length) || 24));\n      anim.loop = raw.loop !== false;\n      anim.interpolation = ['step', 'linear', 'ease'].includes(raw.interpolation) ? raw.interpolation : 'linear';\n      anim.keyframes = new Map(Object.entries(raw.keyframes || {}).map(([frame, pose]) => [Number(frame), clonePose(pose)]).filter(([frame]) => Number.isFinite(frame)));\n      library.set(name, anim);\n    });\n    if (!library.size) library.set('idle', newAnimation('idle'));\n    activeName = library.has(data.activeName) ? data.activeName : library.keys().next().value;\n    currentFrame = Math.max(0, Math.min(animation().length, Number(data.currentFrame) || 0));\n    playhead = currentFrame;\n    renderAnimationSelect();\n    setCurrentFrame(currentFrame, true);\n  }\n\n  function resetSkeletalLibrary() {\n    playing = false;\n    playBtn.textContent = '▶';\n    library.clear();\n    library.set('idle', newAnimation('idle'));\n    activeName = 'idle';\n    currentFrame = 0;\n    playhead = 0;\n    renderAnimationSelect();\n  }\n\n  globalThis.__SSSSkeletal = {\n    serialize: () => serializeSkeletalLibrary(),\n    restore: (data) => restoreSkeletalLibrary(data),\n    reset: () => resetSkeletalLibrary()\n  };\n\n  renderAnimationSelect();\n})();`;
  return skeletal.replace(marker, bridge);
}

async function boot() {
  const sourceUrl = new URL('./main-v2.ts', import.meta.url);
  const [source, extension, customAnchor, engineExports, multiAtlas, apngExport, asepriteExport, aiFixer, uxTools, performanceTools, performanceGuards, rigging, skeletalAnimation, mesh, ik, rigProjectPersistence] = await Promise.all([
    fetchText(sourceUrl, 'editor source'),
    fetchText(extensionUrl, 'project system'),
    fetchText(customAnchorUrl, 'custom anchor tools'),
    fetchText(engineExportsUrl, 'engine exporters'),
    fetchText(multiAtlasUrl, 'multi-atlas exporter'),
    fetchText(apngExportUrl, 'APNG exporter'),
    fetchText(asepriteExportUrl, 'Aseprite exporter'),
    fetchText(aiFixerUrl, 'AI sprite fixer'),
    fetchText(uxToolsUrl, 'professional editor tools'),
    fetchText(performanceUrl, 'performance tools'),
    fetchText(performanceGuardsUrl, 'performance guards'),
    fetchText(riggingUrl, 'bone rigging workspace'),
    fetchText(skeletalAnimationUrl, 'skeletal animation editor'),
    fetchText(meshUrl, 'mesh deformation'),
    fetchText(ikUrl, 'inverse kinematics'),
    fetchText(rigProjectPersistenceUrl, 'rig project persistence')
  ]);

  const projectExtension = exposeProjectBridge(patchProjectExtension(extension));
  const rigRuntime = exposeRigBridge(patchRiggingScale(rigging));
  const skeletalRuntime = exposeSkeletalBridge(patchSkeletalScale(skeletalAnimation));
  const js = `${stripMainTypeScript(source)}\n\n${projectExtension}\n\n${customAnchor}\n\n${engineExports}\n\n${multiAtlas}\n\n${apngExport}\n\n${asepriteExport}\n\n${aiFixer}\n\n${uxTools}\n\n${performanceTools}\n\n${performanceGuards}\n\n${rigRuntime}\n\n${skeletalRuntime}\n\n${mesh}\n\n${ik}\n\n${rigProjectPersistence}`;

  const blobUrl = URL.createObjectURL(new Blob([`${js}\n//# sourceURL=sprite-sheet-studio-runtime.js`], { type: 'text/javascript' }));
  try {
    await import(blobUrl);
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }
}

boot().catch(showFatal);