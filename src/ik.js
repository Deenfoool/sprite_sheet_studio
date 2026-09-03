(() => {
  const rigApi = globalThis.__SSSRig;
  if (!rigApi) return;

  const ik = {
    enabled: false,
    endBoneId: null,
    targetX: rigApi.state.width / 2 + 120,
    targetY: rigApi.state.height / 2,
    bend: 1,
    dragging: false,
    minA: -180,
    maxA: 180,
    minB: -180,
    maxB: 180,
    lockA: false,
    lockB: false
  };

  function radians(value) { return value * Math.PI / 180; }
  function degrees(value) { return value * 180 / Math.PI; }
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

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeDegrees(value) {
    let result = value % 360;
    if (result > 180) result -= 360;
    if (result < -180) result += 360;
    return result;
  }

  function chain() {
    const endBone = boneById(ik.endBoneId);
    if (!endBone?.parentId) return null;
    const startBone = boneById(endBone.parentId);
    if (!startBone) return null;
    return { startBone, endBone };
  }

  function initializeTargetFromChain() {
    const selected = chain();
    if (!selected) return;
    const world = worldBone(selected.endBone);
    if (!world) return;
    ik.targetX = world.endX;
    ik.targetY = world.endY;
    updateUi();
  }

  function solveIk() {
    const selected = chain();
    if (!selected) return;
    const { startBone, endBone } = selected;
    if (ik.lockA && ik.lockB) {
      rigApi.draw();
      updateUi(false);
      return;
    }

    const cache = new Map();
    const startWorld = worldBone(startBone, cache);
    if (!startWorld) return;

    const parentWorldRotation = startBone.parentId ? (worldBone(boneById(startBone.parentId), cache)?.rotation || 0) : 0;
    const sx = startWorld.startX;
    const sy = startWorld.startY;
    const dx = ik.targetX - sx;
    const dy = ik.targetY - sy;
    const l1 = Math.max(1, startBone.length);
    const l2 = Math.max(1, endBone.length);
    const rawDistance = Math.hypot(dx, dy);
    const minDistance = Math.abs(l1 - l2) + 0.0001;
    const maxDistance = l1 + l2 - 0.0001;
    const distance = clamp(rawDistance || 0.0001, minDistance, maxDistance);
    const targetAngle = Math.atan2(dy, dx);

    const cos2 = clamp((distance * distance - l1 * l1 - l2 * l2) / (2 * l1 * l2), -1, 1);
    const angle2 = Math.acos(cos2) * ik.bend;
    const angle1 = targetAngle - Math.atan2(l2 * Math.sin(angle2), l1 + l2 * Math.cos(angle2));

    const startLocal = normalizeDegrees(degrees(angle1 - parentWorldRotation));
    const endLocal = normalizeDegrees(degrees(angle2));

    if (!ik.lockA) startBone.rotation = clamp(startLocal, ik.minA, ik.maxA);
    if (!ik.lockB) endBone.rotation = clamp(endLocal, ik.minB, ik.maxB);

    rigApi.draw();
    updateUi(false);
  }

  function setChainFromSelection() {
    const selected = boneById(rigApi.state.selectedBoneId);
    if (!selected?.parentId) {
      status.textContent = 'Select a child bone such as forearm or shin. It must have a parent bone.';
      status.classList.remove('active');
      return;
    }
    ik.endBoneId = selected.id;
    endBoneSelect.value = selected.id;
    initializeTargetFromChain();
    status.textContent = `IK chain: ${boneById(selected.parentId)?.name || 'parent'} → ${selected.name}`;
    status.classList.toggle('active', ik.enabled);
  }

  function populateChains() {
    endBoneSelect.innerHTML = '';
    const eligible = rigApi.state.bones.filter((bone) => bone.parentId);
    if (!eligible.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No 2-bone chain yet';
      endBoneSelect.append(option);
      ik.endBoneId = null;
      return;
    }
    eligible.forEach((bone) => {
      const option = document.createElement('option');
      option.value = bone.id;
      option.textContent = `${boneById(bone.parentId)?.name || '?'} → ${bone.name}`;
      endBoneSelect.append(option);
    });
    if (!eligible.some((bone) => bone.id === ik.endBoneId)) ik.endBoneId = eligible[0].id;
    endBoneSelect.value = ik.endBoneId;
  }

  function updateUi(updateInputs = true) {
    if (updateInputs) {
      targetX.value = String(Math.round(ik.targetX * 10) / 10);
      targetY.value = String(Math.round(ik.targetY * 10) / 10);
      minA.value = String(ik.minA);
      maxA.value = String(ik.maxA);
      minB.value = String(ik.minB);
      maxB.value = String(ik.maxB);
    }
    enableInput.checked = ik.enabled;
    lockA.checked = ik.lockA;
    lockB.checked = ik.lockB;
    minA.disabled = ik.lockA;
    maxA.disabled = ik.lockA;
    minB.disabled = ik.lockB;
    maxB.disabled = ik.lockB;
    bendLeft.classList.toggle('active', ik.bend < 0);
    bendRight.classList.toggle('active', ik.bend > 0);
    status.classList.toggle('active', ik.enabled);
    if (ik.enabled && chain()) {
      const c = chain();
      const locks = [ik.lockA ? `${c.startBone.name} locked` : '', ik.lockB ? `${c.endBone.name} locked` : ''].filter(Boolean);
      status.textContent = `IK active: ${c.startBone.name} → ${c.endBone.name}. Drag on the rig canvas to move the target.${locks.length ? ` ${locks.join(' · ')}.` : ''}`;
    }
  }

  function pointerToCanvas(event) {
    const canvas = document.querySelector('#rigCanvas');
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  const inspector = document.querySelector('.rig-inspector');
  const panel = document.createElement('section');
  panel.className = 'rig-section ik-panel';
  panel.innerHTML = `
    <div class="rig-section-head"><span class="rig-section-title">Inverse Kinematics</span><span class="rig-mode-badge">2-BONE IK</span></div>
    <label class="rig-check"><span>Enable IK target</span><input id="ikEnable" type="checkbox" /></label>
    <div class="rig-field"><label>End bone / chain</label><select id="ikEndBone"></select></div>
    <button class="btn" id="ikUseSelection" style="width:100%">Use selected bone as chain end</button>
    <div class="ik-status" id="ikStatus">Create a parent + child bone chain, then choose the child bone.</div>
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
    if (ik.enabled && !chain()) populateChains();
    if (ik.enabled) initializeTargetFromChain();
    updateUi();
    if (ik.enabled) solveIk();
  });
  endBoneSelect.addEventListener('change', () => {
    ik.endBoneId = endBoneSelect.value || null;
    initializeTargetFromChain();
    solveIk();
  });
  useSelection.addEventListener('click', () => {
    populateChains();
    setChainFromSelection();
    if (ik.enabled) solveIk();
  });
  targetX.addEventListener('change', () => { ik.targetX = Number(targetX.value) || 0; solveIk(); });
  targetY.addEventListener('change', () => { ik.targetY = Number(targetY.value) || 0; solveIk(); });
  bendLeft.addEventListener('click', () => { ik.bend = -1; updateUi(); solveIk(); });
  bendRight.addEventListener('click', () => { ik.bend = 1; updateUi(); solveIk(); });
  lockA.addEventListener('change', () => { ik.lockA = lockA.checked; updateUi(); solveIk(); });
  lockB.addEventListener('change', () => { ik.lockB = lockB.checked; updateUi(); solveIk(); });

  function updateConstraints() {
    ik.minA = Number(minA.value);
    ik.maxA = Number(maxA.value);
    ik.minB = Number(minB.value);
    ik.maxB = Number(maxB.value);
    if (ik.minA > ik.maxA) [ik.minA, ik.maxA] = [ik.maxA, ik.minA];
    if (ik.minB > ik.maxB) [ik.minB, ik.maxB] = [ik.maxB, ik.minB];
    solveIk();
  }
  [minA, maxA, minB, maxB].forEach((input) => input.addEventListener('change', updateConstraints));

  canvas.addEventListener('pointerdown', (event) => {
    if (!ik.enabled || !chain()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    ik.dragging = true;
    const point = pointerToCanvas(event);
    ik.targetX = point.x;
    ik.targetY = point.y;
    canvas.setPointerCapture(event.pointerId);
    solveIk();
  }, true);
  canvas.addEventListener('pointermove', (event) => {
    if (!ik.enabled || !ik.dragging) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const point = pointerToCanvas(event);
    ik.targetX = point.x;
    ik.targetY = point.y;
    solveIk();
  }, true);
  const finishDrag = (event) => {
    if (!ik.dragging) return;
    ik.dragging = false;
    try { canvas.releasePointerCapture(event.pointerId); } catch {}
    rigApi.render();
  };
  canvas.addEventListener('pointerup', finishDrag, true);
  canvas.addEventListener('pointercancel', finishDrag, true);

  const baseDraw = rigApi.draw;
  rigApi.draw = () => {
    baseDraw();
    if (!ik.enabled || !chain()) return;
    const ctx = get2d(canvas);
    ctx.save();
    ctx.strokeStyle = '#ffcf5b';
    ctx.fillStyle = '#ffcf5b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ik.targetX, ik.targetY, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ik.targetX - 13, ik.targetY);
    ctx.lineTo(ik.targetX + 13, ik.targetY);
    ctx.moveTo(ik.targetX, ik.targetY - 13);
    ctx.lineTo(ik.targetX, ik.targetY + 13);
    ctx.stroke();
    ctx.restore();
  };

  const originalRender = rigApi.render;
  rigApi.render = () => {
    originalRender();
    populateChains();
    updateUi(false);
  };

  populateChains();
  initializeTargetFromChain();
  updateUi();
  globalThis.__SSSIK = { state: ik, solve: solveIk };
})();