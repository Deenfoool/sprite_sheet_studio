import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const srcDir = path.join(root, 'src');

const read = (name) => fs.readFile(path.join(srcDir, name), 'utf8');

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
  if (markers.some((marker) => !code.includes(marker))) {
    throw new Error('Rigging scale patch markers were not found.');
  }

  return code
    .replace(uiNeedle, `${uiNeedle}\n            <div class="rig-two">\n              <div class="rig-field"><label>Scale X</label><input id="rigPartScaleX" type="number" min="-10" max="10" step="0.05" value="1" /></div>\n              <div class="rig-field"><label>Scale Y</label><input id="rigPartScaleY" type="number" min="-10" max="10" step="0.05" value="1" /></div>\n            </div>`)
    .replace(refsNeedle, `    partRotation: overlay.querySelector('#rigPartRotation'),\n    partScaleX: overlay.querySelector('#rigPartScaleX'),\n    partScaleY: overlay.querySelector('#rigPartScaleY'),\n    partZ: overlay.querySelector('#rigPartZ'),`)
    .replace(inspectNeedle, `      r.partRotation.value = String(part.rotation);\n      r.partScaleX.value = String(part.scaleX ?? 1);\n      r.partScaleY.value = String(part.scaleY ?? 1);\n      r.partZ.value = String(part.z);`)
    .replace(drawNeedle, `    ctx.rotate(world.rotation + radians(part.rotation));\n    ctx.scale(part.scaleX ?? 1, part.scaleY ?? 1);\n    ctx.imageSmoothingEnabled = false;`)
    .replace(loadNeedle, `        rotation: 0,\n        scaleX: 1,\n        scaleY: 1,\n        z: rig.parts.length,`)
    .replace(exportNeedle, `        rotation: part.rotation,\n        scaleX: part.scaleX ?? 1,\n        scaleY: part.scaleY ?? 1,\n        z: part.z,`)
    .replace(updateNeedle, `      part.rotation = Number(r.partRotation.value) || 0;\n      part.scaleX = Number.isFinite(Number(r.partScaleX.value)) ? Number(r.partScaleX.value) : 1;\n      part.scaleY = Number.isFinite(Number(r.partScaleY.value)) ? Number(r.partScaleY.value) : 1;\n      part.z = Number(r.partZ.value) || 0;`)
    .replace(inputsNeedle, `[r.partName, r.partBone, r.partX, r.partY, r.partPivotX, r.partPivotY, r.partRotation, r.partScaleX, r.partScaleY, r.partZ, r.partOpacity, r.partVisible]`);
}

function patchSkeletalScale(skeletal) {
  const captureNeedle = `        rotation: part.rotation,\n        z: part.z,`;
  const applyNeedle = `      part.rotation = value.rotation;\n      part.z = value.z;`;
  const mirrorNeedle = `    Object.values(mirrored.parts || {}).forEach((part) => {\n      part.x = -part.x;\n      part.rotation = -part.rotation;\n    });`;
  if (!skeletal.includes(captureNeedle) || !skeletal.includes(applyNeedle) || !skeletal.includes(mirrorNeedle)) {
    throw new Error('Skeletal scale patch markers were not found.');
  }
  return skeletal
    .replace(captureNeedle, `        rotation: part.rotation,\n        scaleX: part.scaleX ?? 1,\n        scaleY: part.scaleY ?? 1,\n        z: part.z,`)
    .replace(applyNeedle, `      part.rotation = value.rotation;\n      part.scaleX = Number.isFinite(value.scaleX) ? value.scaleX : 1;\n      part.scaleY = Number.isFinite(value.scaleY) ? value.scaleY : 1;\n      part.z = value.z;`)
    .replace(mirrorNeedle, `    Object.values(mirrored.parts || {}).forEach((part) => {\n      part.x = -part.x;\n      part.rotation = -part.rotation;\n      part.scaleX = -(part.scaleX ?? 1);\n    });`);
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

function exposeSkeletalBridge(skeletal) {
  const marker = '  renderAnimationSelect();\n})();';
  if (!skeletal.includes(marker)) throw new Error('Skeletal runtime marker was not found.');
  const bridge = `  function serializeSkeletalLibrary() {\n    return {\n      version: 1,\n      activeName,\n      currentFrame,\n      animations: Object.fromEntries([...library.entries()].map(([name, anim]) => [name, {\n        fps: anim.fps,\n        length: anim.length,\n        loop: anim.loop,\n        interpolation: anim.interpolation,\n        keyframes: Object.fromEntries([...anim.keyframes.entries()].map(([frame, pose]) => [String(frame), clonePose(pose)]))\n      }]))\n    };\n  }\n\n  function restoreSkeletalLibrary(data) {\n    if (!data || data.version !== 1 || !data.animations || typeof data.animations !== 'object') return;\n    playing = false;\n    playBtn.textContent = '▶';\n    library.clear();\n    Object.entries(data.animations).forEach(([name, raw]) => {\n      const anim = newAnimation(name);\n      anim.fps = Math.max(1, Math.min(60, Number(raw.fps) || 12));\n      anim.length = Math.max(1, Math.min(600, Number(raw.length) || 24));\n      anim.loop = raw.loop !== false;\n      anim.interpolation = ['step', 'linear', 'ease'].includes(raw.interpolation) ? raw.interpolation : 'linear';\n      anim.keyframes = new Map(Object.entries(raw.keyframes || {}).map(([frame, pose]) => [Number(frame), clonePose(pose)]).filter(([frame]) => Number.isFinite(frame)));\n      library.set(name, anim);\n    });\n    if (!library.size) library.set('idle', newAnimation('idle'));\n    activeName = library.has(data.activeName) ? data.activeName : library.keys().next().value;\n    currentFrame = Math.max(0, Math.min(animation().length, Number(data.currentFrame) || 0));\n    playhead = currentFrame;\n    renderAnimationSelect();\n    setCurrentFrame(currentFrame, true);\n  }\n\n  function resetSkeletalLibrary() {\n    playing = false;\n    playBtn.textContent = '▶';\n    library.clear();\n    library.set('idle', newAnimation('idle'));\n    activeName = 'idle';\n    currentFrame = 0;\n    playhead = 0;\n    renderAnimationSelect();\n  }\n\n  globalThis.__SSSSkeletal = {\n    serialize: () => serializeSkeletalLibrary(),\n    restore: (data) => restoreSkeletalLibrary(data),\n    reset: () => resetSkeletalLibrary()\n  };\n\n  renderAnimationSelect();\n})();`;
  return skeletal.replace(marker, bridge);
}

function transpileCore(source) {
  let code = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      removeComments: false
    },
    fileName: 'main-v2.ts',
    reportDiagnostics: true
  }).outputText;

  code = code
    .replace(/^import\s+['"]\.\/styles\.css['"];?\s*$/m, '')
    .replace(/^import\s+['"]\.\/smart-tools\.css['"];?\s*$/m, '')
    .replace(/from\s+['"]gifenc['"]/g, "from './vendor/gifenc.esm.js'")
    .replace(/from\s+['"]fflate['"]/g, "from './zip-store.js'")
    .replace(/from\s+['"]\.\/sprite-tools['"]/g, "from './sprite-tools.js'");

  return code.trim();
}

const files = await Promise.all([
  read('main-v2.ts'),
  read('editor-extensions.js'),
  read('custom-anchor.js'),
  read('engine-exports.js'),
  read('multi-atlas.js'),
  read('apng-export.js'),
  read('aseprite-export.js'),
  read('ai-fixer.js'),
  read('ux-tools.js'),
  read('performance.js'),
  read('performance-guards.js'),
  read('rigging.js'),
  read('skeletal-animation.js'),
  read('mesh.js'),
  read('ik.js'),
  read('rig-project-persistence.js')
]);

const [
  source,
  extension,
  customAnchor,
  engineExports,
  multiAtlas,
  apngExport,
  asepriteExport,
  aiFixer,
  uxTools,
  performanceTools,
  performanceGuards,
  rigging,
  skeletalAnimation,
  mesh,
  ik,
  rigProjectPersistence
] = files;

const sections = [
  transpileCore(source),
  exposeProjectBridge(patchProjectExtension(extension)),
  customAnchor,
  engineExports,
  multiAtlas,
  apngExport,
  asepriteExport,
  aiFixer,
  uxTools,
  performanceTools,
  performanceGuards,
  exposeRigBridge(patchRiggingScale(rigging)),
  exposeSkeletalBridge(patchSkeletalScale(skeletalAnimation)),
  mesh,
  ik,
  rigProjectPersistence
];

const banner = `/* Sprite Sheet Studio committed runtime bundle.\n * Generated by scripts/build-runtime-bundle.mjs. Do not edit directly.\n */\n`;
const output = `${banner}${sections.map((section) => section.trim()).join('\n\n')}\n`;
const outputPath = path.join(srcDir, 'runtime.bundle.js');
await fs.writeFile(outputPath, output, 'utf8');
console.log(`Wrote ${path.relative(root, outputPath)} (${Buffer.byteLength(output)} bytes)`);
