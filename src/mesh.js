(() => {
  const rigApi = globalThis.__SSSRig;
  if (!rigApi) return;

  const mesh = {
    enabled: false,
    partId: null,
    cols: 5,
    rows: 7,
    vertices: [],
    triangles: [],
    bindWorld: {},
    bindLocals: {},
    bindPart: null,
    mode: 'paint',
    selectedBoneId: 'root',
    brushWeight: 1,
    brushRadius: 42,
    showWire: true,
    draggingVertex: -1,
    lastPointer: null
  };

  function radians(value) { return value * Math.PI / 180; }
  function rotatePoint(x, y, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return { x: x * c - y * s, y: x * s + y * c };
  }
  function boneById(id) { return rigApi.state.bones.find((bone) => bone.id === id) || null; }
  function partById(id) { return rigApi.state.parts.find((part) => part.id === id) || null; }

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
      const parentWorld = worldBone(boneById(bone.parentId), cache);
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

  function captureBindPose() {
    mesh.bindWorld = {};
    mesh.bindLocals = {};
    const cache = new Map();
    rigApi.state.bones.forEach((bone) => {
      const world = worldBone(bone, cache);
      if (world) mesh.bindWorld[bone.id] = { ...world };
      mesh.bindLocals[bone.id] = {
        x: bone.x,
        y: bone.y,
        rotation: bone.rotation,
        length: bone.length,
        visible: bone.visible
      };
    });
    const part = partById(mesh.partId);
    if (part) {
      mesh.bindPart = {
        boneId: part.boneId,
        x: part.x,
        y: part.y,
        pivotX: part.pivotX,
        pivotY: part.pivotY,
        rotation: part.rotation
      };
    }
    setStatus('Bind pose captured.', true);
  }

  function restoreBindPose() {
    Object.entries(mesh.bindLocals).forEach(([id, value]) => {
      const bone = boneById(id);
      if (!bone) return;
      bone.x = value.x;
      bone.y = value.y;
      bone.rotation = value.rotation;
      bone.length = value.length;
      bone.visible = value.visible;
    });
    rigApi.render();
    rigApi.draw();
    setStatus('Skeleton restored to bind pose.', true);
  }

  function bindPartPoint(vertex) {
    const part = mesh.bindPart;
    if (!part) return { x: vertex.u, y: vertex.v };
    const bone = mesh.bindWorld[part.boneId] || mesh.bindWorld.root;
    if (!bone) return { x: vertex.u, y: vertex.v };
    const partOffset = rotatePoint(part.x, part.y, bone.rotation);
    const baseX = bone.startX + partOffset.x;
    const baseY = bone.startY + partOffset.y;
    const local = {
      x: vertex.u - part.pivotX + vertex.offsetX,
      y: vertex.v - part.pivotY + vertex.offsetY
    };
    const rotated = rotatePoint(local.x, local.y, bone.rotation + radians(part.rotation));
    return { x: baseX + rotated.x, y: baseY + rotated.y };
  }

  function normalizeWeights(weights) {
    const entries = Object.entries(weights).filter(([, value]) => value > 0.0001);
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    const result = {};
    if (total <= 0) return result;
    entries.forEach(([id, value]) => { result[id] = value / total; });
    return result;
  }

  function deformVertex(vertex, currentCache = new Map()) {
    const bindPoint = bindPartPoint(vertex);
    let weights = normalizeWeights(vertex.weights);
    if (!Object.keys(weights).length) {
      const fallback = mesh.bindPart?.boneId || 'root';
      weights = { [fallback]: 1 };
    }
    let x = 0;
    let y = 0;
    let total = 0;
    Object.entries(weights).forEach(([boneId, weight]) => {
      const bindBone = mesh.bindWorld[boneId];
      const currentBone = worldBone(boneById(boneId), currentCache);
      if (!bindBone || !currentBone) return;
      const relative = rotatePoint(bindPoint.x - bindBone.startX, bindPoint.y - bindBone.startY, -bindBone.rotation);
      const moved = rotatePoint(relative.x, relative.y, currentBone.rotation);
      x += (currentBone.startX + moved.x) * weight;
      y += (currentBone.startY + moved.y) * weight;
      total += weight;
    });
    return total > 0 ? { x: x / total, y: y / total } : bindPoint;
  }

  function distanceToSegment(point, a, b) {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const wx = point.x - a.x;
    const wy = point.y - a.y;
    const length2 = vx * vx + vy * vy;
    if (length2 <= 0.0001) return Math.hypot(wx, wy);
    const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / length2));
    const px = a.x + vx * t;
    const py = a.y + vy * t;
    return Math.hypot(point.x - px, point.y - py);
  }

  function autoWeights() {
    if (!mesh.vertices.length || !Object.keys(mesh.bindWorld).length) return;
    const bones = rigApi.state.bones.filter((bone) => mesh.bindWorld[bone.id]);
    mesh.vertices.forEach((vertex) => {
      const point = bindPartPoint(vertex);
      const ranked = bones.map((bone) => {
        const world = mesh.bindWorld[bone.id];
        return {
          id: bone.id,
          distance: distanceToSegment(point, { x: world.startX, y: world.startY }, { x: world.endX, y: world.endY })
        };
      }).sort((a, b) => a.distance - b.distance).slice(0, 2);
      if (!ranked.length) return;
      if (ranked.length === 1) {
        vertex.weights = { [ranked[0].id]: 1 };
      } else {
        const wa = 1 / (ranked[0].distance + 1);
        const wb = 1 / (ranked[1].distance + 1);
        const sum = wa + wb;
        vertex.weights = { [ranked[0].id]: wa / sum, [ranked[1].id]: wb / sum };
      }
    });
    setStatus('Auto weights generated from distance to the nearest bones.', true);
    rigApi.draw();
  }

  function generateMesh() {
    const part = partById(mesh.partId) || partById(rigApi.state.selectedPartId) || rigApi.state.parts[0];
    if (!part) return toast('Load and select a rig sprite part first.', true);
    mesh.partId = part.id;
    mesh.cols = Math.max(1, Math.min(32, Number(colsInput.value) || 5));
    mesh.rows = Math.max(1, Math.min(32, Number(rowsInput.value) || 7));
    mesh.vertices = [];
    mesh.triangles = [];

    for (let row = 0; row <= mesh.rows; row += 1) {
      for (let col = 0; col <= mesh.cols; col += 1) {
        mesh.vertices.push({
          u: (col / mesh.cols) * part.bitmap.width,
          v: (row / mesh.rows) * part.bitmap.height,
          offsetX: 0,
          offsetY: 0,
          weights: {}
        });
      }
    }
    const stride = mesh.cols + 1;
    for (let row = 0; row < mesh.rows; row += 1) {
      for (let col = 0; col < mesh.cols; col += 1) {
        const a = row * stride + col;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        mesh.triangles.push([a, b, d], [a, d, c]);
      }
    }
    mesh.enabled = true;
    enableInput.checked = true;
    captureBindPose();
    autoWeights();
    populateSelectors();
    setStatus(`Mesh generated: ${mesh.vertices.length} vertices · ${mesh.triangles.length} triangles.`, true);
    rigApi.draw();
  }

  function drawTexturedTriangle(ctx, image, s0, s1, s2, d0, d1, d2) {
    const denom = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
    if (Math.abs(denom) < 0.00001) return;
    const a = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / denom;
    const c = (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / denom;
    const e = (d0.x * (s1.x * s2.y - s2.x * s1.y) + d1.x * (s2.x * s0.y - s0.x * s2.y) + d2.x * (s0.x * s1.y - s1.x * s0.y)) / denom;
    const b = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / denom;
    const d = (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / denom;
    const f = (d0.y * (s1.x * s2.y - s2.x * s1.y) + d1.y * (s2.x * s0.y - s0.x * s2.y) + d2.y * (s0.x * s1.y - s1.x * s0.y)) / denom;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(d0.x, d0.y);
    ctx.lineTo(d1.x, d1.y);
    ctx.lineTo(d2.x, d2.y);
    ctx.closePath();
    ctx.clip();
    ctx.transform(a, b, c, d, e, f);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0);
    ctx.restore();
  }

  function drawMesh(ctx, part) {
    if (!mesh.enabled || part.id !== mesh.partId || !mesh.vertices.length) return;
    const cache = new Map();
    const deformed = mesh.vertices.map((vertex) => deformVertex(vertex, cache));
    mesh.triangles.forEach(([ia, ib, ic]) => {
      const va = mesh.vertices[ia];
      const vb = mesh.vertices[ib];
      const vc = mesh.vertices[ic];
      drawTexturedTriangle(
        ctx,
        part.bitmap,
        { x: va.u, y: va.v }, { x: vb.u, y: vb.v }, { x: vc.u, y: vc.v },
        deformed[ia], deformed[ib], deformed[ic]
      );
    });

    if (mesh.showWire) {
      ctx.save();
      ctx.strokeStyle = 'rgba(82,190,255,.5)';
      ctx.lineWidth = 1;
      mesh.triangles.forEach(([ia, ib, ic]) => {
        ctx.beginPath();
        ctx.moveTo(deformed[ia].x, deformed[ia].y);
        ctx.lineTo(deformed[ib].x, deformed[ib].y);
        ctx.lineTo(deformed[ic].x, deformed[ic].y);
        ctx.closePath();
        ctx.stroke();
      });
      deformed.forEach((point, index) => {
        const selectedWeight = mesh.vertices[index].weights[mesh.selectedBoneId] || 0;
        ctx.fillStyle = selectedWeight > .5 ? '#66baff' : '#64d8b8';
        ctx.beginPath();
        ctx.arc(point.x, point.y, index === mesh.draggingVertex ? 5 : 3, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function nearestVertex(point, maxDistance = 18) {
    if (!mesh.vertices.length) return -1;
    const cache = new Map();
    let best = -1;
    let bestDistance = maxDistance;
    mesh.vertices.forEach((vertex, index) => {
      const deformed = deformVertex(vertex, cache);
      const distance = Math.hypot(point.x - deformed.x, point.y - deformed.y);
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    return best;
  }

  function paintWeights(point) {
    if (!mesh.selectedBoneId) return;
    const cache = new Map();
    mesh.vertices.forEach((vertex) => {
      const deformed = deformVertex(vertex, cache);
      const distance = Math.hypot(point.x - deformed.x, point.y - deformed.y);
      if (distance > mesh.brushRadius) return;
      const falloff = 1 - distance / mesh.brushRadius;
      const current = vertex.weights[mesh.selectedBoneId] || 0;
      const target = mesh.brushWeight;
      vertex.weights[mesh.selectedBoneId] = current + (target - current) * falloff;
      vertex.weights = normalizeWeights(vertex.weights);
    });
    rigApi.draw();
  }

  function moveVertex(point) {
    if (mesh.draggingVertex < 0 || !mesh.lastPointer) return;
    const vertex = mesh.vertices[mesh.draggingVertex];
    const dx = point.x - mesh.lastPointer.x;
    const dy = point.y - mesh.lastPointer.y;
    const part = mesh.bindPart;
    const bone = mesh.bindWorld[part?.boneId] || mesh.bindWorld.root;
    const angle = bone ? bone.rotation + radians(part?.rotation || 0) : 0;
    const local = rotatePoint(dx, dy, -angle);
    vertex.offsetX += local.x;
    vertex.offsetY += local.y;
    mesh.lastPointer = point;
    rigApi.draw();
  }

  function populateSelectors() {
    partSelect.innerHTML = '';
    rigApi.state.parts.forEach((part) => {
      const option = document.createElement('option');
      option.value = part.id;
      option.textContent = part.name;
      partSelect.append(option);
    });
    if (!mesh.partId && rigApi.state.parts[0]) mesh.partId = rigApi.state.parts[0].id;
    partSelect.value = mesh.partId || '';

    boneSelect.innerHTML = '';
    rigApi.state.bones.forEach((bone) => {
      const option = document.createElement('option');
      option.value = bone.id;
      option.textContent = bone.name;
      boneSelect.append(option);
    });
    if (!boneById(mesh.selectedBoneId)) mesh.selectedBoneId = rigApi.state.bones[0]?.id || null;
    boneSelect.value = mesh.selectedBoneId || '';
  }

  function setStatus(text, active = false) {
    status.textContent = text;
    status.classList.toggle('active', active);
  }

  const inspector = document.querySelector('.rig-inspector');
  const panel = document.createElement('section');
  panel.className = 'rig-section mesh-panel';
  panel.innerHTML = `
    <div class="rig-section-head"><span class="rig-section-title">Mesh deformation</span><span class="rig-mode-badge">SKINNING</span></div>
    <label class="rig-check"><span>Enable mesh preview</span><input id="meshEnable" type="checkbox" /></label>
    <div class="rig-field"><label>Sprite part</label><select id="meshPart"></select></div>
    <div class="rig-field"><label>Grid resolution</label><div class="mesh-grid-fields"><input id="meshCols" type="number" min="1" max="32" value="5" /><input id="meshRows" type="number" min="1" max="32" value="7" /></div></div>
    <div class="mesh-actions"><button class="btn green" id="meshGenerate">Generate mesh</button><button class="btn" id="meshBind">Set bind pose</button><button class="btn" id="meshAutoWeight">Auto weights</button><button class="btn" id="meshRestore">Restore bind</button></div>
    <div class="mesh-status" id="meshStatus">Select a sprite part and generate a grid mesh.</div>
    <div class="rig-field"><label>Edit mode</label><div class="mesh-mode-row"><button class="btn" id="meshMoveMode">Move vertices</button><button class="btn active" id="meshPaintMode">Paint weights</button></div></div>
    <div class="rig-field"><label>Paint bone</label><select id="meshBone"></select></div>
    <div class="rig-field"><label>Brush weight (0 = erase, 1 = full)</label><div class="mesh-brush"><input id="meshWeight" type="range" min="0" max="1" step="0.05" value="1" /><input id="meshWeightNumber" type="number" min="0" max="1" step="0.05" value="1" /></div></div>
    <div class="rig-field"><label>Brush radius</label><input id="meshRadius" type="range" min="8" max="120" value="42" /></div>
    <label class="rig-check"><span>Show wireframe</span><input id="meshWire" type="checkbox" checked /></label>
    <div class="mesh-legend"><span class="vertex">vertex</span><span class="weighted">strong selected-bone weight</span><span class="selected">editing</span></div>`;
  inspector.append(panel);

  const enableInput = panel.querySelector('#meshEnable');
  const partSelect = panel.querySelector('#meshPart');
  const colsInput = panel.querySelector('#meshCols');
  const rowsInput = panel.querySelector('#meshRows');
  const generateBtn = panel.querySelector('#meshGenerate');
  const bindBtn = panel.querySelector('#meshBind');
  const autoWeightBtn = panel.querySelector('#meshAutoWeight');
  const restoreBtn = panel.querySelector('#meshRestore');
  const status = panel.querySelector('#meshStatus');
  const moveModeBtn = panel.querySelector('#meshMoveMode');
  const paintModeBtn = panel.querySelector('#meshPaintMode');
  const boneSelect = panel.querySelector('#meshBone');
  const weightInput = panel.querySelector('#meshWeight');
  const weightNumber = panel.querySelector('#meshWeightNumber');
  const radiusInput = panel.querySelector('#meshRadius');
  const wireInput = panel.querySelector('#meshWire');
  const canvas = document.querySelector('#rigCanvas');

  enableInput.addEventListener('change', () => { mesh.enabled = enableInput.checked; rigApi.draw(); });
  partSelect.addEventListener('change', () => {
    mesh.partId = partSelect.value || null;
    mesh.vertices = [];
    mesh.triangles = [];
    setStatus('Part changed. Generate a new mesh.');
    rigApi.draw();
  });
  generateBtn.addEventListener('click', generateMesh);
  bindBtn.addEventListener('click', () => { if (mesh.vertices.length) { captureBindPose(); autoWeights(); rigApi.draw(); } });
  autoWeightBtn.addEventListener('click', autoWeights);
  restoreBtn.addEventListener('click', restoreBindPose);
  moveModeBtn.addEventListener('click', () => {
    mesh.mode = 'move';
    moveModeBtn.classList.add('active');
    paintModeBtn.classList.remove('active');
    setStatus('Move mode: drag a mesh vertex.', true);
  });
  paintModeBtn.addEventListener('click', () => {
    mesh.mode = 'paint';
    paintModeBtn.classList.add('active');
    moveModeBtn.classList.remove('active');
    setStatus('Paint mode: drag across vertices to adjust selected-bone weights.', true);
  });
  boneSelect.addEventListener('change', () => { mesh.selectedBoneId = boneSelect.value || null; rigApi.draw(); });
  weightInput.addEventListener('input', () => { mesh.brushWeight = Number(weightInput.value); weightNumber.value = weightInput.value; });
  weightNumber.addEventListener('change', () => {
    mesh.brushWeight = Math.max(0, Math.min(1, Number(weightNumber.value) || 0));
    weightNumber.value = String(mesh.brushWeight);
    weightInput.value = String(mesh.brushWeight);
  });
  radiusInput.addEventListener('input', () => { mesh.brushRadius = Number(radiusInput.value) || 42; });
  wireInput.addEventListener('change', () => { mesh.showWire = wireInput.checked; rigApi.draw(); });

  canvas.addEventListener('pointerdown', (event) => {
    if (!mesh.enabled || !mesh.vertices.length || globalThis.__SSSIK?.state?.enabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const point = canvasPoint(event);
    canvas.setPointerCapture(event.pointerId);
    if (mesh.mode === 'move') {
      mesh.draggingVertex = nearestVertex(point);
      mesh.lastPointer = point;
      if (mesh.draggingVertex < 0) setStatus('No vertex under pointer. Zoom visually and click closer to a mesh point.');
    } else {
      mesh.draggingVertex = -1;
      paintWeights(point);
    }
  }, true);
  canvas.addEventListener('pointermove', (event) => {
    if (!mesh.enabled || globalThis.__SSSIK?.state?.enabled) return;
    if (!(event.buttons & 1)) return;
    const point = canvasPoint(event);
    if (mesh.mode === 'move') moveVertex(point);
    else paintWeights(point);
  }, true);
  const finishPointer = (event) => {
    if (!mesh.enabled) return;
    mesh.draggingVertex = -1;
    mesh.lastPointer = null;
    try { canvas.releasePointerCapture(event.pointerId); } catch {}
    rigApi.draw();
  };
  canvas.addEventListener('pointerup', finishPointer, true);
  canvas.addEventListener('pointercancel', finishPointer, true);

  const baseDraw = rigApi.draw;
  rigApi.draw = () => {
    const part = partById(mesh.partId);
    const shouldMesh = mesh.enabled && part && mesh.vertices.length;
    const wasVisible = part?.visible;
    if (shouldMesh) part.visible = false;
    baseDraw();
    if (shouldMesh) {
      part.visible = wasVisible;
      if (wasVisible) drawMesh(get2d(canvas), part);
    }
  };

  const baseRender = rigApi.render;
  rigApi.render = () => {
    baseRender();
    populateSelectors();
  };

  const partsObserver = new MutationObserver(() => populateSelectors());
  const partsList = document.querySelector('.rig-parts');
  if (partsList) partsObserver.observe(partsList, { childList: true, subtree: false });

  function tick() {
    if (mesh.enabled && rigApi.state.open && mesh.vertices.length) rigApi.draw();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  populateSelectors();
  globalThis.__SSSMesh = { state: mesh, generate: generateMesh, autoWeights, restoreBindPose };
})();