let ikStretchInitialized = false;

function initIkStretch() {
  if (ikStretchInitialized) return true;

  const ikApi = globalThis.__SSSIK;
  const rigApi = globalThis.__SSSRig;
  const canvas = document.querySelector('#rigCanvas');
  const canvasWrap = canvas?.closest('.rig-canvas-wrap');
  const polePanel = document.querySelector('.ik-pole-panel');
  const chainSelect = document.querySelector('#ikChainSelect');
  const addChainButton = document.querySelector('#ikAddChain');

  if (
    !ikApi ||
    !rigApi ||
    !(canvas instanceof HTMLCanvasElement) ||
    !(canvasWrap instanceof HTMLElement) ||
    !(chainSelect instanceof HTMLSelectElement)
  ) return false;

  ikStretchInitialized = true;

  function radians(value) { return value * Math.PI / 180; }
  function rotatePoint(x, y, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return { x: x * c - y * s, y: x * s + y * c };
  }
  function boneById(id) {
    return rigApi.state.bones.find((bone) => bone.id === id) || null;
  }
  function worldBone(bone, cache = new Map()) {
    if (!bone) return null;
    if (cache.has(bone.id)) return cache.get(bone.id);
    let startX;
    let startY;
    let rotation;
    if (!bone.parentId) {
      startX = bone.x;
      startY = bone.y;
      rotation = radians(bone.rotation);
    } else {
      const parent = boneById(bone.parentId);
      const parentWorld = worldBone(parent, cache);
      if (!parentWorld) return null;
      const offset = rotatePoint(bone.x, bone.y, parentWorld.rotation);
      startX = parentWorld.endX + offset.x;
      startY = parentWorld.endY + offset.y;
      rotation = parentWorld.rotation + radians(bone.rotation);
    }
    const result = {
      startX,
      startY,
      rotation,
      endX: startX + Math.cos(rotation) * bone.length,
      endY: startY + Math.sin(rotation) * bone.length
    };
    cache.set(bone.id, result);
    return result;
  }
  function chainBones(config) {
    const endBone = boneById(config?.endBoneId);
    if (!endBone?.parentId) return null;
    const startBone = boneById(endBone.parentId);
    if (!startBone) return null;
    return { startBone, endBone };
  }
  function activeChain() {
    return ikApi.state.chains.find((chain) => chain.id === ikApi.state.activeChainId) || null;
  }
  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / Math.max(1, rect.width)),
      y: (event.clientY - rect.top) * (canvas.height / Math.max(1, rect.height))
    };
  }
  function ensureConfig(config) {
    if (!config) return;
    const selected = chainBones(config);
    if (!selected) return;
    if (typeof config.stretchEnabled !== 'boolean') config.stretchEnabled = false;
    if (!Number.isFinite(config.maxStretch)) config.maxStretch = 1.5;
    if (!Number.isFinite(config.restLengthA) || config.restLengthA <= 0) config.restLengthA = selected.startBone.length;
    if (!Number.isFinite(config.restLengthB) || config.restLengthB <= 0) config.restLengthB = selected.endBone.length;
  }
  function ensureAll() {
    ikApi.state.chains.forEach(ensureConfig);
  }
  function restoreRestLengths(config) {
    const selected = chainBones(config);
    if (!selected) return;
    ensureConfig(config);
    selected.startBone.length = Math.max(1, config.restLengthA);
    selected.endBone.length = Math.max(1, config.restLengthB);
  }
  function captureRestLengths(config) {
    const selected = chainBones(config);
    if (!selected) return;
    config.restLengthA = Math.max(1, selected.startBone.length);
    config.restLengthB = Math.max(1, selected.endBone.length);
  }
  function applyStretch(config, targetX = config.targetX, targetY = config.targetY) {
    if (!config) return;
    ensureConfig(config);
    const selected = chainBones(config);
    if (!selected) return;
    if (!config.stretchEnabled) return;

    const startWorld = worldBone(selected.startBone);
    if (!startWorld) return;
    const distance = Math.hypot(targetX - startWorld.startX, targetY - startWorld.startY);
    const baseA = Math.max(1, config.restLengthA);
    const baseB = Math.max(1, config.restLengthB);
    const baseReach = baseA + baseB;
    const scale = Math.max(1, Math.min(Math.max(1, config.maxStretch), distance / Math.max(1, baseReach)));
    selected.startBone.length = baseA * scale;
    selected.endBone.length = baseB * scale;
  }

  const panel = document.createElement('div');
  panel.className = 'ik-stretch-panel';
  panel.innerHTML = `
    <label class="rig-check compact"><span>Stretch to unreachable target</span><input id="ikStretchEnabled" type="checkbox" /></label>
    <div class="ik-stretch-grid">
      <div class="rig-field"><label for="ikMaxStretch">Maximum stretch</label><input id="ikMaxStretch" type="number" min="1" max="3" step="0.05" value="1.5" /></div>
      <button class="btn" id="ikCaptureRest" type="button">Set rest</button>
    </div>
    <div class="ik-stretch-readout" id="ikStretchReadout">Rest lengths: —</div>
  `;

  if (polePanel instanceof HTMLElement) polePanel.insertAdjacentElement('afterend', panel);
  else document.querySelector('.ik-status')?.insertAdjacentElement('afterend', panel);

  const enabledInput = panel.querySelector('#ikStretchEnabled');
  const maxStretchInput = panel.querySelector('#ikMaxStretch');
  const captureRestButton = panel.querySelector('#ikCaptureRest');
  const readout = panel.querySelector('#ikStretchReadout');

  function updateUi() {
    const config = activeChain();
    [enabledInput, maxStretchInput, captureRestButton].forEach((control) => { control.disabled = !config; });
    if (!config) {
      enabledInput.checked = false;
      maxStretchInput.value = '1.5';
      readout.textContent = 'Rest lengths: —';
      return;
    }
    ensureConfig(config);
    enabledInput.checked = config.stretchEnabled;
    maxStretchInput.value = String(config.maxStretch);
    maxStretchInput.disabled = !config.stretchEnabled;
    readout.textContent = `Rest lengths: ${Math.round(config.restLengthA * 10) / 10}px + ${Math.round(config.restLengthB * 10) / 10}px · max ×${Math.round(config.maxStretch * 100) / 100}`;
  }

  enabledInput.addEventListener('change', () => {
    const config = activeChain();
    if (!config) return;
    ensureConfig(config);
    config.stretchEnabled = enabledInput.checked;
    if (!config.stretchEnabled) restoreRestLengths(config);
    else applyStretch(config);
    ikApi.solve();
    updateUi();
  });

  maxStretchInput.addEventListener('change', () => {
    const config = activeChain();
    if (!config) return;
    config.maxStretch = Math.max(1, Math.min(3, Number(maxStretchInput.value) || 1.5));
    maxStretchInput.value = String(config.maxStretch);
    applyStretch(config);
    ikApi.solve();
    updateUi();
  });

  captureRestButton.addEventListener('click', () => {
    const config = activeChain();
    if (!config) return;
    captureRestLengths(config);
    applyStretch(config);
    ikApi.solve();
    updateUi();
  });

  chainSelect.addEventListener('change', () => setTimeout(updateUi, 0));
  addChainButton?.addEventListener('click', () => setTimeout(() => { ensureAll(); updateUi(); }, 0));
  document.querySelector('#ikDeleteChain')?.addEventListener('click', () => setTimeout(updateUi, 0));
  document.querySelector('#ikEndBone')?.addEventListener('change', () => setTimeout(() => {
    const config = activeChain();
    if (config) captureRestLengths(config);
    updateUi();
  }, 0));

  const originalSolve = ikApi.solve.bind(ikApi);
  ikApi.solve = () => {
    ensureAll();
    ikApi.state.chains.forEach((config) => applyStretch(config));
    originalSolve();
    updateUi();
  };

  let targetPointerId = null;
  canvasWrap.addEventListener('pointerdown', (event) => {
    if (!ikApi.state.enabled || event.defaultPrevented) return;
    const config = activeChain();
    if (!config?.stretchEnabled) return;
    targetPointerId = event.pointerId;
    const point = pointFromEvent(event);
    applyStretch(config, point.x, point.y);
  }, true);

  canvasWrap.addEventListener('pointermove', (event) => {
    if (targetPointerId !== event.pointerId || event.defaultPrevented) return;
    const config = activeChain();
    if (!config?.stretchEnabled) return;
    const point = pointFromEvent(event);
    applyStretch(config, point.x, point.y);
  }, true);

  function finishPointer(event) {
    if (targetPointerId === event.pointerId) targetPointerId = null;
  }
  canvasWrap.addEventListener('pointerup', finishPointer, true);
  canvasWrap.addEventListener('pointercancel', finishPointer, true);

  const targetXInput = document.querySelector('#ikTargetX');
  const targetYInput = document.querySelector('#ikTargetY');
  [targetXInput, targetYInput].forEach((input) => {
    input?.addEventListener('change', () => setTimeout(() => {
      const config = activeChain();
      if (!config?.stretchEnabled) return;
      applyStretch(config);
      ikApi.solve();
    }, 0));
  });

  const originalSerialize = ikApi.serialize.bind(ikApi);
  const originalRestore = ikApi.restore.bind(ikApi);
  const originalReset = ikApi.reset.bind(ikApi);

  ikApi.serialize = () => {
    ensureAll();
    return originalSerialize();
  };

  ikApi.restore = (data) => {
    const extensions = new Map((data?.chains || []).map((chain) => [chain.id, {
      stretchEnabled: Boolean(chain.stretchEnabled),
      maxStretch: Number(chain.maxStretch),
      restLengthA: Number(chain.restLengthA),
      restLengthB: Number(chain.restLengthB)
    }]));
    originalRestore(data);
    ikApi.state.chains.forEach((config) => {
      const extension = extensions.get(config.id);
      if (extension) {
        config.stretchEnabled = extension.stretchEnabled;
        if (Number.isFinite(extension.maxStretch)) config.maxStretch = Math.max(1, Math.min(3, extension.maxStretch));
        if (Number.isFinite(extension.restLengthA) && extension.restLengthA > 0) config.restLengthA = extension.restLengthA;
        if (Number.isFinite(extension.restLengthB) && extension.restLengthB > 0) config.restLengthB = extension.restLengthB;
      }
      ensureConfig(config);
      if (config.stretchEnabled) applyStretch(config);
    });
    originalSolve();
    updateUi();
  };

  ikApi.reset = () => {
    ikApi.state.chains.forEach((config) => {
      ensureConfig(config);
      restoreRestLengths(config);
    });
    originalReset();
    updateUi();
  };

  ensureAll();
  updateUi();
  globalThis.__SSSIKStretch = { ensureAll, applyStretch, restoreRestLengths };
  return true;
}

if (!initIkStretch()) {
  const timer = window.setInterval(() => {
    if (!initIkStretch()) return;
    window.clearInterval(timer);
  }, 100);
  window.setTimeout(() => window.clearInterval(timer), 15000);
}
