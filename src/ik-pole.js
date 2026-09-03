let ikPoleInitialized = false;

function initIkPoleTargets() {
  if (ikPoleInitialized) return true;

  const ikApi = globalThis.__SSSIK;
  const rigApi = globalThis.__SSSRig;
  const canvas = document.querySelector('#rigCanvas');
  const canvasWrap = canvas?.closest('.rig-canvas-wrap');
  const bendContainer = document.querySelector('.ik-direction')?.closest('.rig-field');
  const chainSelect = document.querySelector('#ikChainSelect');
  const addChainButton = document.querySelector('#ikAddChain');

  if (
    !ikApi ||
    !rigApi ||
    !(canvas instanceof HTMLCanvasElement) ||
    !(canvasWrap instanceof HTMLElement) ||
    !(bendContainer instanceof HTMLElement) ||
    !(chainSelect instanceof HTMLSelectElement)
  ) return false;

  ikPoleInitialized = true;

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
  function defaultPole(config) {
    const selected = chainBones(config);
    if (!selected) return { x: config.targetX || rigApi.state.width / 2, y: config.targetY || rigApi.state.height / 2 };
    const startWorld = worldBone(selected.startBone);
    if (!startWorld) return { x: config.targetX, y: config.targetY };
    const dx = config.targetX - startWorld.startX;
    const dy = config.targetY - startWorld.startY;
    const length = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / length;
    const ny = dx / length;
    const distance = Math.max(48, (selected.startBone.length + selected.endBone.length) * 0.55);
    const side = config.bend < 0 ? -1 : 1;
    return {
      x: startWorld.startX + nx * distance * side,
      y: startWorld.startY + ny * distance * side
    };
  }
  function ensureConfig(config) {
    if (!config) return;
    if (typeof config.poleEnabled !== 'boolean') config.poleEnabled = false;
    if (!Number.isFinite(config.poleX) || !Number.isFinite(config.poleY)) {
      const pole = defaultPole(config);
      config.poleX = pole.x;
      config.poleY = pole.y;
    }
  }
  function applyPole(config, targetX = config.targetX, targetY = config.targetY) {
    if (!config?.poleEnabled) return;
    ensureConfig(config);
    const selected = chainBones(config);
    if (!selected) return;
    const startWorld = worldBone(selected.startBone);
    if (!startWorld) return;
    const tx = targetX - startWorld.startX;
    const ty = targetY - startWorld.startY;
    const px = config.poleX - startWorld.startX;
    const py = config.poleY - startWorld.startY;
    const cross = tx * py - ty * px;
    config.bend = cross < 0 ? -1 : 1;
  }
  function ensureAll() {
    ikApi.state.chains.forEach(ensureConfig);
  }

  const panel = document.createElement('div');
  panel.className = 'ik-pole-panel';
  panel.innerHTML = `
    <label class="rig-check compact"><span>Use dedicated pole target</span><input id="ikPoleEnabled" type="checkbox" /></label>
    <div class="ik-pole-row">
      <div class="rig-field"><label for="ikPoleX">Pole X</label><input id="ikPoleX" type="number" step="1" /></div>
      <div class="rig-field"><label for="ikPoleY">Pole Y</label><input id="ikPoleY" type="number" step="1" /></div>
    </div>
    <div class="ik-pole-actions"><button class="btn" id="ikResetPole" type="button">Reset pole</button></div>
    <small class="ik-pole-hint">Drag the diamond pole on the rig canvas. Its side relative to the target controls the bend direction.</small>
  `;
  bendContainer.insertAdjacentElement('afterend', panel);

  const enabledInput = panel.querySelector('#ikPoleEnabled');
  const poleXInput = panel.querySelector('#ikPoleX');
  const poleYInput = panel.querySelector('#ikPoleY');
  const resetButton = panel.querySelector('#ikResetPole');

  function updateUi() {
    const config = activeChain();
    [enabledInput, poleXInput, poleYInput, resetButton].forEach((control) => { control.disabled = !config; });
    if (!config) {
      enabledInput.checked = false;
      poleXInput.value = '';
      poleYInput.value = '';
      return;
    }
    ensureConfig(config);
    enabledInput.checked = config.poleEnabled;
    poleXInput.disabled = !config.poleEnabled;
    poleYInput.disabled = !config.poleEnabled;
    resetButton.disabled = false;
    poleXInput.value = String(Math.round(config.poleX * 10) / 10);
    poleYInput.value = String(Math.round(config.poleY * 10) / 10);
  }

  enabledInput.addEventListener('change', () => {
    const config = activeChain();
    if (!config) return;
    ensureConfig(config);
    config.poleEnabled = enabledInput.checked;
    if (config.poleEnabled) applyPole(config);
    ikApi.solve();
    updateUi();
  });
  function updatePoleInputs() {
    const config = activeChain();
    if (!config) return;
    config.poleX = Number(poleXInput.value) || 0;
    config.poleY = Number(poleYInput.value) || 0;
    config.poleEnabled = true;
    applyPole(config);
    ikApi.solve();
    updateUi();
  }
  poleXInput.addEventListener('change', updatePoleInputs);
  poleYInput.addEventListener('change', updatePoleInputs);
  resetButton.addEventListener('click', () => {
    const config = activeChain();
    if (!config) return;
    const pole = defaultPole(config);
    config.poleX = pole.x;
    config.poleY = pole.y;
    config.poleEnabled = true;
    applyPole(config);
    ikApi.solve();
    updateUi();
  });

  chainSelect.addEventListener('change', () => setTimeout(updateUi, 0));
  addChainButton?.addEventListener('click', () => setTimeout(() => { ensureAll(); updateUi(); }, 0));
  document.querySelector('#ikDeleteChain')?.addEventListener('click', () => setTimeout(updateUi, 0));
  document.querySelector('#ikEndBone')?.addEventListener('change', () => setTimeout(() => {
    const config = activeChain();
    if (config) {
      const pole = defaultPole(config);
      config.poleX = pole.x;
      config.poleY = pole.y;
      applyPole(config);
    }
    updateUi();
  }, 0));

  let poleDrag = null;
  let targetPointerId = null;

  function nearestPole(point, threshold = 16) {
    let best = null;
    let bestDistance = threshold;
    ikApi.state.chains.forEach((config) => {
      ensureConfig(config);
      if (!config.enabled || !config.poleEnabled) return;
      const distance = Math.hypot(point.x - config.poleX, point.y - config.poleY);
      if (distance <= bestDistance) {
        best = config;
        bestDistance = distance;
      }
    });
    return best;
  }
  function nearestTarget(point, threshold = 22) {
    let best = null;
    let bestDistance = threshold;
    ikApi.state.chains.forEach((config) => {
      if (!config.enabled) return;
      const distance = Math.hypot(point.x - config.targetX, point.y - config.targetY);
      if (distance <= bestDistance) {
        best = config;
        bestDistance = distance;
      }
    });
    return best;
  }

  canvasWrap.addEventListener('pointerdown', (event) => {
    if (!ikApi.state.enabled) return;
    ensureAll();
    const point = pointFromEvent(event);
    const pole = nearestPole(point);
    if (pole) {
      event.preventDefault();
      event.stopPropagation();
      poleDrag = { pointerId: event.pointerId, chainId: pole.id };
      ikApi.state.activeChainId = pole.id;
      pole.poleX = point.x;
      pole.poleY = point.y;
      applyPole(pole);
      try { canvasWrap.setPointerCapture(event.pointerId); } catch {}
      ikApi.solve();
      updateUi();
      return;
    }

    const target = nearestTarget(point) || activeChain();
    if (target?.poleEnabled) applyPole(target, point.x, point.y);
    targetPointerId = event.pointerId;
  }, true);

  canvasWrap.addEventListener('pointermove', (event) => {
    if (poleDrag?.pointerId === event.pointerId) {
      event.preventDefault();
      event.stopPropagation();
      const config = ikApi.state.chains.find((item) => item.id === poleDrag.chainId);
      if (!config) return;
      const point = pointFromEvent(event);
      config.poleX = point.x;
      config.poleY = point.y;
      applyPole(config);
      ikApi.solve();
      updateUi();
      return;
    }
    if (targetPointerId === event.pointerId) {
      const config = activeChain();
      if (config?.poleEnabled) {
        const point = pointFromEvent(event);
        applyPole(config, point.x, point.y);
      }
    }
  }, true);

  function finishPointer(event) {
    if (poleDrag?.pointerId === event.pointerId) {
      try { canvasWrap.releasePointerCapture(event.pointerId); } catch {}
      poleDrag = null;
    }
    if (targetPointerId === event.pointerId) targetPointerId = null;
  }
  canvasWrap.addEventListener('pointerup', finishPointer, true);
  canvasWrap.addEventListener('pointercancel', finishPointer, true);

  const baseDraw = rigApi.draw;
  rigApi.draw = () => {
    baseDraw();
    if (!ikApi.state.enabled) return;
    ensureAll();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ikApi.state.chains.forEach((config, index) => {
      if (!config.enabled || !config.poleEnabled || !chainBones(config)) return;
      const active = config.id === ikApi.state.activeChainId;
      const selected = chainBones(config);
      const startWorld = worldBone(selected.startBone);
      ctx.save();
      ctx.strokeStyle = active ? '#f690ff' : '#aa75d6';
      ctx.fillStyle = active ? '#f6b5ff' : '#c49add';
      ctx.globalAlpha = active ? .95 : .62;
      ctx.lineWidth = 1.25;
      ctx.setLineDash([4, 4]);
      if (startWorld) {
        ctx.beginPath();
        ctx.moveTo(startWorld.startX, startWorld.startY);
        ctx.lineTo(config.poleX, config.poleY);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.translate(config.poleX, config.poleY);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-5, -5, 10, 10);
      ctx.rotate(-Math.PI / 4);
      ctx.font = '8px ui-monospace, monospace';
      ctx.fillText(`P${index + 1}`, 9, -8);
      ctx.restore();
    });
  };

  const originalSerialize = ikApi.serialize.bind(ikApi);
  const originalRestore = ikApi.restore.bind(ikApi);
  ikApi.serialize = () => {
    ensureAll();
    return originalSerialize();
  };
  ikApi.restore = (data) => {
    const extensions = new Map((data?.chains || []).map((chain) => [chain.id, {
      poleEnabled: Boolean(chain.poleEnabled),
      poleX: Number(chain.poleX),
      poleY: Number(chain.poleY)
    }]));
    originalRestore(data);
    ikApi.state.chains.forEach((config) => {
      const extension = extensions.get(config.id);
      if (extension) {
        config.poleEnabled = extension.poleEnabled;
        if (Number.isFinite(extension.poleX)) config.poleX = extension.poleX;
        if (Number.isFinite(extension.poleY)) config.poleY = extension.poleY;
      }
      ensureConfig(config);
      applyPole(config);
    });
    ikApi.solve();
    updateUi();
  };

  ensureAll();
  updateUi();
  globalThis.__SSSIKPole = { ensureAll, applyPole };
  return true;
}

if (!initIkPoleTargets()) {
  const timer = window.setInterval(() => {
    if (!initIkPoleTargets()) return;
    window.clearInterval(timer);
  }, 100);
  window.setTimeout(() => window.clearInterval(timer), 15000);
}
