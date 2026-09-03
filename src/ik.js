(() => {
  const rigApi = globalThis.__SSSRig;
  if (!rigApi) return;

  const ik = {
    enabled: false,
    chains: [],
    activeChainId: null,
    draggingChainId: null
  };

  function uid() {
    return `ik-${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
  }

  function radians(value) { return value * Math.PI / 180; }
  function degrees(value) { return value * 180 / Math.PI; }
  function rotatePoint(x, y, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return { x: x * c - y * s, y: x * s + y * c };
  }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function normalizeDegrees(value) {
    let result = value % 360;
    if (result > 180) result -= 360;
    if (result < -180) result += 360;
    return result;
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

  function eligibleBones() {
    return rigApi.state.bones.filter((bone) => bone.parentId && boneById(bone.parentId));
  }

  function chainBones(config) {
    if (!config) return null;
    const endBone = boneById(config.endBoneId);
    if (!endBone?.parentId) return null;
    const startBone = boneById(endBone.parentId);
    if (!startBone) return null;
    return { startBone, endBone };
  }

  function activeChain() {
    return ik.chains.find((chain) => chain.id === ik.activeChainId) || null;
  }

  function targetForEndBone(endBoneId) {
    const endBone = boneById(endBoneId);
    const world = worldBone(endBone);
    return world ? { x: world.endX, y: world.endY } : { x: rigApi.state.width / 2 + 120, y: rigApi.state.height / 2 };
  }

  function createChain(endBoneId) {
    const target = targetForEndBone(endBoneId);
    return {
      id: uid(),
      enabled: true,
      endBoneId,
      targetX: target.x,
      targetY: target.y,
      bend: 1,
      minA: -180,
      maxA: 180,
      minB: -180,
      maxB: 180,
      lockA: false,
      lockB: false
    };
  }

  function ensureValidChains() {
    ik.chains = ik.chains.filter((config) => Boolean(chainBones(config)));
    if (!ik.chains.some((config) => config.id === ik.activeChainId)) {
      ik.activeChainId = ik.chains[0]?.id || null;
    }
  }

  function addChain(endBoneId = null) {
    const eligible = eligibleBones();
    if (!eligible.length) {
      status.textContent = 'Create a parent + child bone chain first.';
      status.classList.remove('active');
      return null;
    }
    const selected = endBoneId && eligible.some((bone) => bone.id === endBoneId)
      ? endBoneId
      : (rigApi.state.selectedBoneId && eligible.some((bone) => bone.id === rigApi.state.selectedBoneId)
        ? rigApi.state.selectedBoneId
        : eligible[0].id);
    const config = createChain(selected);
    ik.chains.push(config);
    ik.activeChainId = config.id;
    renderChainControls();
    if (ik.enabled) solveAll();
    return config;
  }

  function deleteActiveChain() {
    const current = activeChain();
    if (!current) return;
    const index = ik.chains.findIndex((config) => config.id === current.id);
    ik.chains.splice(index, 1);
    ik.activeChainId = ik.chains[Math.min(index, ik.chains.length - 1)]?.id || null;
    renderChainControls();
    rigApi.draw();
  }

  function solveChain(config) {
    if (!config?.enabled) return;
    const selected = chainBones(config);
    if (!selected || (config.lockA && config.lockB)) return;
    const { startBone, endBone } = selected;
    const cache = new Map();
    const startWorld = worldBone(startBone, cache);
    if (!startWorld) return;

    const parentWorldRotation = startBone.parentId
      ? (worldBone(boneById(startBone.parentId), cache)?.rotation || 0)
      : 0;
    const sx = startWorld.startX;
    const sy = startWorld.startY;
    const dx = config.targetX - sx;
    const dy = config.targetY - sy;
    const l1 = Math.max(1, startBone.length);
    const l2 = Math.max(1, endBone.length);
    const rawDistance = Math.hypot(dx, dy);
    const minDistance = Math.abs(l1 - l2) + 0.0001;
    const maxDistance = l1 + l2 - 0.0001;
    const distance = clamp(rawDistance || 0.0001, minDistance, maxDistance);
    const targetAngle = Math.atan2(dy, dx);
    const cos2 = clamp((distance * distance - l1 * l1 - l2 * l2) / (2 * l1 * l2), -1, 1);
    const angle2 = Math.acos(cos2) * config.bend;
    const angle1 = targetAngle - Math.atan2(l2 * Math.sin(angle2), l1 + l2 * Math.cos(angle2));
    const startLocal = normalizeDegrees(degrees(angle1 - parentWorldRotation));
    const endLocal = normalizeDegrees(degrees(angle2));

    if (!config.lockA) startBone.rotation = clamp(startLocal, config.minA, config.maxA);
    if (!config.lockB) endBone.rotation = clamp(endLocal, config.minB, config.maxB);
  }

  function solveAll() {
    ensureValidChains();
    if (!ik.enabled) {
      rigApi.draw();
      updateUi(false);
      return;
    }
    ik.chains.forEach(solveChain);
    rigApi.draw();
    updateUi(false);
  }

  function initializeTarget(config) {
    if (!config) return;
    const target = targetForEndBone(config.endBoneId);
    config.targetX = target.x;
    config.targetY = target.y;
  }

  function chainLabel(config) {
    const selected = chainBones(config);
    return selected ? `${selected.startBone.name} → ${selected.endBone.name}` : 'Invalid chain';
  }

  function populateEndBones() {
    endBoneSelect.innerHTML = '';
    const eligible = eligibleBones();
    if (!eligible.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No 2-bone chain yet';
      endBoneSelect.append(option);
      return;
    }
    eligible.forEach((bone) => {
      const option = document.createElement('option');
      option.value = bone.id;
      option.textContent = `${boneById(bone.parentId)?.name || '?'} → ${bone.name}`;
      endBoneSelect.append(option);
    });
  }

  function populateChainSelect() {
    chainSelect.innerHTML = '';
    if (!ik.chains.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No IK chains';
      chainSelect.append(option);
      return;
    }
    ik.chains.forEach((config, index) => {
      const option = document.createElement('option');
      option.value = config.id;
      option.textContent = `${index + 1}. ${chainLabel(config)}${config.enabled ? '' : ' · off'}`;
      chainSelect.append(option);
    });
    chainSelect.value = ik.activeChainId || '';
  }

  function renderChainControls() {
    ensureValidChains();
    populateEndBones();
    populateChainSelect();
    updateUi();
  }

  function updateUi(updateInputs = true) {
    const config = activeChain();
    enableInput.checked = ik.enabled;
    chainCount.textContent = `${ik.chains.length} chain${ik.chains.length === 1 ? '' : 's'}`;
    deleteChainButton.disabled = !config;
    chainEnabled.disabled = !config;
    endBoneSelect.disabled = !config;
    useSelection.disabled = !eligibleBones().length;

    const controls = [targetX, targetY, bendLeft, bendRight, minA, maxA, minB, maxB, lockA, lockB];
    controls.forEach((control) => { control.disabled = !config; });

    if (!config) {
      chainEnabled.checked = false;
      status.textContent = eligibleBones().length
        ? 'Add an IK chain from the selected child bone.'
        : 'Create a parent + child bone chain, then add an IK target.';
      status.classList.remove('active');
      return;
    }

    chainEnabled.checked = config.enabled;
    endBoneSelect.value = config.endBoneId;
    if (updateInputs) {
      targetX.value = String(Math.round(config.targetX * 10) / 10);
      targetY.value = String(Math.round(config.targetY * 10) / 10);
      minA.value = String(config.minA);
      maxA.value = String(config.maxA);
      minB.value = String(config.minB);
      maxB.value = String(config.maxB);
    }
    lockA.checked = config.lockA;
    lockB.checked = config.lockB;
    minA.disabled = !config || config.lockA;
    maxA.disabled = !config || config.lockA;
    minB.disabled = !config || config.lockB;
    maxB.disabled = !config || config.lockB;
    bendLeft.classList.toggle('active', config.bend < 0);
    bendRight.classList.toggle('active', config.bend > 0);

    const selected = chainBones(config);
    const locks = selected
      ? [config.lockA ? `${selected.startBone.name} locked` : '', config.lockB ? `${selected.endBone.name} locked` : ''].filter(Boolean)
      : [];
    status.classList.toggle('active', ik.enabled && config.enabled);
    status.textContent = selected
      ? `${ik.enabled && config.enabled ? 'IK active' : 'IK chain'}: ${selected.startBone.name} → ${selected.endBone.name}. ${ik.chains.length} total target${ik.chains.length === 1 ? '' : 's'}.${locks.length ? ` ${locks.join(' · ')}.` : ''}`
      : 'The active IK chain is no longer valid.';
  }

  function pointerToCanvas(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function nearestTarget(point, threshold = 22) {
    let best = null;
    let bestDistance = threshold;
    ik.chains.forEach((config) => {
      if (!config.enabled || !chainBones(config)) return;
      const distance = Math.hypot(point.x - config.targetX, point.y - config.targetY);
      if (distance <= bestDistance) {
        best = config;
        bestDistance = distance;
      }
    });
    return best;
  }

  const inspector = document.querySelector('.rig-inspector');
  const panel = document.createElement('section');
  panel.className = 'rig-section ik-panel';
  panel.innerHTML = `
    <div class="rig-section-head"><span class="rig-section-title">Inverse Kinematics</span><span class="rig-mode-badge">MULTI 2-BONE</span></div>
    <label class="rig-check"><span>Enable IK targets</span><input id="ikEnable" type="checkbox" /></label>
    <div class="ik-chain-manager">
      <div class="rig-field"><label>IK chain <small id="ikChainCount">0 chains</small></label><select id="ikChainSelect"></select></div>
      <div class="ik-chain-actions"><button class="btn" id="ikAddChain">+ Chain</button><button class="btn danger" id="ikDeleteChain">Delete</button></div>
    </div>
    <label class="rig-check compact"><span>Active chain enabled</span><input id="ikChainEnabled" type="checkbox" checked /></label>
    <div class="rig-field"><label>End bone / chain</label><select id="ikEndBone"></select></div>
    <button class="btn" id="ikUseSelection" style="width:100%">Use selected bone as chain end</button>
    <div class="ik-status" id="ikStatus">Create a parent + child bone chain, then add an IK target.</div>
    <div class="rig-field"><label>Target position</label><div class="ik-target-readout"><input id="ikTargetX" type="number" step="1" /><input id="ikTargetY" type="number" step="1" /></div></div>
    <div class="rig-field"><label>Bend direction / pole</label><div class="ik-direction"><button class="btn" id="ikBendLeft">Left</button><button class="btn active" id="ikBendRight">Right</button></div></div>
    <div class="rig-field"><label>Joint constraints</label>
      <div class="ik-constraints">
        <div class="ik-constraint-box">
          <b>Parent bone</b>
          <label class="rig-check compact"><span>Lock rotation</span><input id="ikLockA" type="checkbox" /></label>
          <div class="rig-two"><input id="ikMinA" type="number" value="-180" /><input id="ikMaxA" type="number" value="180" /></div>
        </div>
        <div class="ik-constraint-box">
          <b>End bone</b>
          <label class="rig-check compact"><span>Lock rotation</span><input id="ikLockB" type="checkbox" /></label>
          <div class="rig-two"><input id="ikMinB" type="number" value="-180" /><input id="ikMaxB" type="number" value="180" /></div>
        </div>
      </div>
    </div>`;
  inspector.append(panel);

  const enableInput = panel.querySelector('#ikEnable');
  const chainSelect = panel.querySelector('#ikChainSelect');
  const chainCount = panel.querySelector('#ikChainCount');
  const addChainButton = panel.querySelector('#ikAddChain');
  const deleteChainButton = panel.querySelector('#ikDeleteChain');
  const chainEnabled = panel.querySelector('#ikChainEnabled');
  const endBoneSelect = panel.querySelector('#ikEndBone');
  const useSelection = panel.querySelector('#ikUseSelection');
  const status = panel.querySelector('#ikStatus');
  const targetX = panel.querySelector('#ikTargetX');
  const targetY = panel.querySelector('#ikTargetY');
  const bendLeft = panel.querySelector('#ikBendLeft');
  const bendRight = panel.querySelector('#ikBendRight');
  const minA = panel.querySelector('#ikMinA');
  const maxA = panel.querySelector('#ikMaxA');
  const minB = panel.querySelector('#ikMinB');
  const maxB = panel.querySelector('#ikMaxB');
  const lockA = panel.querySelector('#ikLockA');
  const lockB = panel.querySelector('#ikLockB');
  const canvas = document.querySelector('#rigCanvas');

  enableInput.addEventListener('change', () => {
    ik.enabled = enableInput.checked;
    if (ik.enabled && !ik.chains.length && eligibleBones().length) addChain();
    solveAll();
  });

  chainSelect.addEventListener('change', () => {
    ik.activeChainId = chainSelect.value || null;
    updateUi();
    rigApi.draw();
  });

  addChainButton.addEventListener('click', () => addChain());
  deleteChainButton.addEventListener('click', deleteActiveChain);

  chainEnabled.addEventListener('change', () => {
    const config = activeChain();
    if (!config) return;
    config.enabled = chainEnabled.checked;
    populateChainSelect();
    solveAll();
  });

  endBoneSelect.addEventListener('change', () => {
    const config = activeChain();
    if (!config) return;
    config.endBoneId = endBoneSelect.value || null;
    initializeTarget(config);
    populateChainSelect();
    solveAll();
  });

  useSelection.addEventListener('click', () => {
    const selected = boneById(rigApi.state.selectedBoneId);
    if (!selected?.parentId) {
      status.textContent = 'Select a child bone such as forearm or shin.';
      status.classList.remove('active');
      return;
    }
    let config = activeChain();
    if (!config) config = addChain(selected.id);
    if (!config) return;
    config.endBoneId = selected.id;
    initializeTarget(config);
    renderChainControls();
    if (ik.enabled) solveAll();
  });

  targetX.addEventListener('change', () => {
    const config = activeChain();
    if (!config) return;
    config.targetX = Number(targetX.value) || 0;
    solveAll();
  });
  targetY.addEventListener('change', () => {
    const config = activeChain();
    if (!config) return;
    config.targetY = Number(targetY.value) || 0;
    solveAll();
  });
  bendLeft.addEventListener('click', () => {
    const config = activeChain();
    if (!config) return;
    config.bend = -1;
    updateUi();
    solveAll();
  });
  bendRight.addEventListener('click', () => {
    const config = activeChain();
    if (!config) return;
    config.bend = 1;
    updateUi();
    solveAll();
  });
  lockA.addEventListener('change', () => {
    const config = activeChain();
    if (!config) return;
    config.lockA = lockA.checked;
    updateUi();
    solveAll();
  });
  lockB.addEventListener('change', () => {
    const config = activeChain();
    if (!config) return;
    config.lockB = lockB.checked;
    updateUi();
    solveAll();
  });

  function updateConstraints() {
    const config = activeChain();
    if (!config) return;
    config.minA = Number(minA.value);
    config.maxA = Number(maxA.value);
    config.minB = Number(minB.value);
    config.maxB = Number(maxB.value);
    if (config.minA > config.maxA) [config.minA, config.maxA] = [config.maxA, config.minA];
    if (config.minB > config.maxB) [config.minB, config.maxB] = [config.maxB, config.minB];
    solveAll();
  }
  [minA, maxA, minB, maxB].forEach((input) => input.addEventListener('change', updateConstraints));

  canvas.addEventListener('pointerdown', (event) => {
    if (!ik.enabled || !ik.chains.length) return;
    const point = pointerToCanvas(event);
    const target = nearestTarget(point) || activeChain();
    if (!target?.enabled || !chainBones(target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    ik.activeChainId = target.id;
    ik.draggingChainId = target.id;
    target.targetX = point.x;
    target.targetY = point.y;
    canvas.setPointerCapture(event.pointerId);
    populateChainSelect();
    solveAll();
  }, true);

  canvas.addEventListener('pointermove', (event) => {
    if (!ik.enabled || !ik.draggingChainId) return;
    const config = ik.chains.find((item) => item.id === ik.draggingChainId);
    if (!config) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const point = pointerToCanvas(event);
    config.targetX = point.x;
    config.targetY = point.y;
    solveAll();
  }, true);

  const finishDrag = (event) => {
    if (!ik.draggingChainId) return;
    ik.draggingChainId = null;
    try { canvas.releasePointerCapture(event.pointerId); } catch {}
    rigApi.render();
  };
  canvas.addEventListener('pointerup', finishDrag, true);
  canvas.addEventListener('pointercancel', finishDrag, true);

  const baseDraw = rigApi.draw;
  rigApi.draw = () => {
    baseDraw();
    if (!ik.enabled) return;
    const ctx = get2d(canvas);
    ik.chains.forEach((config, index) => {
      if (!config.enabled || !chainBones(config)) return;
      const active = config.id === ik.activeChainId;
      ctx.save();
      ctx.strokeStyle = active ? '#ffcf5b' : '#62c4ff';
      ctx.fillStyle = active ? '#ffcf5b' : '#62c4ff';
      ctx.globalAlpha = active ? 1 : .72;
      ctx.lineWidth = active ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(config.targetX, config.targetY, active ? 9 : 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(config.targetX - 12, config.targetY);
      ctx.lineTo(config.targetX + 12, config.targetY);
      ctx.moveTo(config.targetX, config.targetY - 12);
      ctx.lineTo(config.targetX, config.targetY + 12);
      ctx.stroke();
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(index + 1), config.targetX + 12, config.targetY - 12);
      ctx.restore();
    });
  };

  const originalRender = rigApi.render;
  rigApi.render = () => {
    originalRender();
    renderChainControls();
  };

  function serialize() {
    return {
      version: 2,
      enabled: ik.enabled,
      activeChainId: ik.activeChainId,
      chains: ik.chains.map((config) => ({ ...config }))
    };
  }

  function restore(data) {
    if (!data || !Array.isArray(data.chains)) return;
    ik.enabled = data.enabled !== false;
    ik.chains = data.chains.map((raw) => ({
      id: raw.id || uid(),
      enabled: raw.enabled !== false,
      endBoneId: raw.endBoneId,
      targetX: Number(raw.targetX) || 0,
      targetY: Number(raw.targetY) || 0,
      bend: Number(raw.bend) < 0 ? -1 : 1,
      minA: Number.isFinite(Number(raw.minA)) ? Number(raw.minA) : -180,
      maxA: Number.isFinite(Number(raw.maxA)) ? Number(raw.maxA) : 180,
      minB: Number.isFinite(Number(raw.minB)) ? Number(raw.minB) : -180,
      maxB: Number.isFinite(Number(raw.maxB)) ? Number(raw.maxB) : 180,
      lockA: Boolean(raw.lockA),
      lockB: Boolean(raw.lockB)
    }));
    ensureValidChains();
    ik.activeChainId = ik.chains.some((config) => config.id === data.activeChainId)
      ? data.activeChainId
      : (ik.chains[0]?.id || null);
    renderChainControls();
    solveAll();
  }

  function reset() {
    ik.enabled = false;
    ik.chains = [];
    ik.activeChainId = null;
    ik.draggingChainId = null;
    renderChainControls();
    rigApi.draw();
  }

  renderChainControls();
  globalThis.__SSSIK = { state: ik, solve: solveAll, serialize, restore, reset, addChain };
})();
