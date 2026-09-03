(() => {
  const rigApi = globalThis.__SSSRig;
  if (!rigApi) return;

  const library = new Map();
  let activeName = 'idle';
  let currentFrame = 0;
  let playing = false;
  let playhead = 0;
  let lastTick = performance.now();
  let clipboardPose = null;

  function newAnimation(name = 'idle') {
    return {
      name,
      fps: 12,
      length: 24,
      loop: true,
      interpolation: 'linear',
      curve: [0.42, 0, 0.58, 1],
      keyframes: new Map()
    };
  }

  library.set('idle', newAnimation('idle'));

  function animation() {
    return library.get(activeName);
  }

  function capturePose() {
    return {
      bones: Object.fromEntries(rigApi.state.bones.map((bone) => [bone.id, {
        x: bone.x,
        y: bone.y,
        rotation: bone.rotation,
        length: bone.length,
        visible: bone.visible
      }])),
      parts: Object.fromEntries(rigApi.state.parts.map((part) => [part.id, {
        x: part.x,
        y: part.y,
        rotation: part.rotation,
        z: part.z,
        opacity: part.opacity,
        visible: part.visible
      }]))
    };
  }

  function clonePose(pose) {
    return JSON.parse(JSON.stringify(pose));
  }

  function applyPose(pose, refreshInspector = false) {
    if (!pose) return;
    rigApi.state.bones.forEach((bone) => {
      const value = pose.bones?.[bone.id];
      if (!value) return;
      bone.x = value.x;
      bone.y = value.y;
      bone.rotation = value.rotation;
      bone.length = value.length;
      bone.visible = value.visible;
    });
    rigApi.state.parts.forEach((part) => {
      const value = pose.parts?.[part.id];
      if (!value) return;
      part.x = value.x;
      part.y = value.y;
      part.rotation = value.rotation;
      part.z = value.z;
      part.opacity = value.opacity;
      part.visible = value.visible;
    });
    if (refreshInspector) rigApi.render();
    rigApi.draw();
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpAngle(a, b, t) {
    const delta = ((b - a + 540) % 360) - 180;
    return a + delta * t;
  }

  function bezierCoordinate(t, p1, p2) {
    const oneMinusT = 1 - t;
    return 3 * oneMinusT * oneMinusT * t * p1 + 3 * oneMinusT * t * t * p2 + t * t * t;
  }

  function bezierDerivative(t, p1, p2) {
    const oneMinusT = 1 - t;
    return 3 * oneMinusT * oneMinusT * p1 + 6 * oneMinusT * t * (p2 - p1) + 3 * t * t * (1 - p2);
  }

  function cubicBezierAt(x, curve) {
    const [x1, y1, x2, y2] = Array.isArray(curve) && curve.length === 4 ? curve : [0.42, 0, 0.58, 1];
    const target = Math.max(0, Math.min(1, x));
    let t = target;
    for (let iteration = 0; iteration < 6; iteration += 1) {
      const currentX = bezierCoordinate(t, x1, x2) - target;
      const derivative = bezierDerivative(t, x1, x2);
      if (Math.abs(currentX) < 0.0001 || Math.abs(derivative) < 0.00001) break;
      t = Math.max(0, Math.min(1, t - currentX / derivative));
    }
    let low = 0;
    let high = 1;
    for (let iteration = 0; iteration < 8; iteration += 1) {
      const currentX = bezierCoordinate(t, x1, x2);
      if (Math.abs(currentX - target) < 0.0001) break;
      if (currentX < target) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return Math.max(0, Math.min(1, bezierCoordinate(t, y1, y2)));
  }

  function easedT(t, mode, curve) {
    if (mode === 'step') return 0;
    if (mode === 'ease') return t * t * (3 - 2 * t);
    if (mode === 'ease-in') return t * t;
    if (mode === 'ease-out') return 1 - (1 - t) * (1 - t);
    if (mode === 'bezier') return cubicBezierAt(t, curve);
    return t;
  }

  function interpolateObjects(a = {}, b = {}, t, angleKeys = []) {
    const out = {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    keys.forEach((key) => {
      const av = a[key];
      const bv = b[key];
      if (typeof av === 'number' && typeof bv === 'number') out[key] = angleKeys.includes(key) ? lerpAngle(av, bv, t) : lerp(av, bv, t);
      else if (typeof av === 'boolean' && typeof bv === 'boolean') out[key] = t < 1 ? av : bv;
      else out[key] = t < 1 ? av : bv;
    });
    return out;
  }

  function interpolatePose(a, b, rawT, mode, curve) {
    if (!a) return clonePose(b);
    if (!b) return clonePose(a);
    const t = easedT(rawT, mode, curve);
    if (mode === 'step') return clonePose(a);
    const pose = { bones: {}, parts: {} };
    const boneIds = new Set([...Object.keys(a.bones || {}), ...Object.keys(b.bones || {})]);
    boneIds.forEach((id) => {
      pose.bones[id] = interpolateObjects(a.bones?.[id], b.bones?.[id], t, ['rotation']);
    });
    const partIds = new Set([...Object.keys(a.parts || {}), ...Object.keys(b.parts || {})]);
    partIds.forEach((id) => {
      pose.parts[id] = interpolateObjects(a.parts?.[id], b.parts?.[id], t, ['rotation']);
    });
    return pose;
  }

  function poseAt(frame) {
    const anim = animation();
    if (!anim || !anim.keyframes.size) return null;
    const keys = [...anim.keyframes.keys()].sort((a, b) => a - b);
    let previous = keys[0];
    let next = keys[keys.length - 1];
    for (const key of keys) {
      if (key <= frame) previous = key;
      if (key >= frame) { next = key; break; }
    }
    if (previous === next) return clonePose(anim.keyframes.get(previous));
    const t = (frame - previous) / Math.max(1, next - previous);
    return interpolatePose(anim.keyframes.get(previous), anim.keyframes.get(next), t, anim.interpolation, anim.curve);
  }

  function setCurrentFrame(frame, refreshInspector = false) {
    const anim = animation();
    if (!anim) return;
    currentFrame = Math.max(0, Math.min(anim.length, Math.round(frame)));
    playhead = currentFrame;
    timelineRange.value = String(currentFrame);
    timeLabel.textContent = `Frame ${currentFrame} / ${anim.length}`;
    const pose = poseAt(currentFrame);
    if (pose) applyPose(pose, refreshInspector);
    renderMarkers();
  }

  function setKeyframe() {
    const anim = animation();
    if (!anim) return;
    anim.keyframes.set(currentFrame, capturePose());
    renderMarkers();
    toast(`Rig keyframe set at frame ${currentFrame}`);
  }

  function deleteKeyframe() {
    const anim = animation();
    if (!anim?.keyframes.has(currentFrame)) return;
    anim.keyframes.delete(currentFrame);
    renderMarkers();
    toast('Rig keyframe deleted');
  }

  function renderMarkers() {
    const anim = animation();
    markers.innerHTML = '';
    if (!anim) return;
    [...anim.keyframes.keys()].sort((a, b) => a - b).forEach((frame) => {
      const marker = document.createElement('span');
      marker.className = `skeletal-marker${frame === currentFrame ? ' current' : ''}`;
      marker.style.left = `${(frame / Math.max(1, anim.length)) * 100}%`;
      marker.title = `Frame ${frame}`;
      markers.append(marker);
    });
  }

  function syncCurveUi() {
    const anim = animation();
    if (!anim || !curvePanel) return;
    const curve = Array.isArray(anim.curve) && anim.curve.length === 4 ? anim.curve : [0.42, 0, 0.58, 1];
    curvePanel.hidden = anim.interpolation !== 'bezier';
    [curveX1, curveY1, curveX2, curveY2].forEach((input, index) => {
      input.value = String(Math.round(curve[index] * 100) / 100);
    });
    curveCode.textContent = `cubic-bezier(${curve.map((value) => Math.round(value * 100) / 100).join(', ')})`;
    drawCurvePreview();
  }

  function drawCurvePreview() {
    const anim = animation();
    if (!anim || !(curveCanvas instanceof HTMLCanvasElement)) return;
    const ctx = curveCanvas.getContext('2d');
    if (!ctx) return;
    const width = curveCanvas.width;
    const height = curveCanvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = '#263750';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo((width * i) / 4, 0);
      ctx.lineTo((width * i) / 4, height);
      ctx.moveTo(0, (height * i) / 4);
      ctx.lineTo(width, (height * i) / 4);
      ctx.stroke();
    }
    ctx.strokeStyle = '#67c8ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let step = 0; step <= 64; step += 1) {
      const x = step / 64;
      const y = cubicBezierAt(x, anim.curve);
      const px = x * width;
      const py = height - y * height;
      if (!step) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  function renderAnimationSelect() {
    animSelect.innerHTML = '';
    library.forEach((anim, name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      animSelect.append(option);
    });
    animSelect.value = activeName;
    const anim = animation();
    fpsInput.value = String(anim.fps);
    lengthInput.value = String(anim.length);
    loopInput.checked = anim.loop;
    interpSelect.value = anim.interpolation;
    timelineRange.max = String(anim.length);
    syncCurveUi();
    setCurrentFrame(Math.min(currentFrame, anim.length), true);
  }

  function uniqueName(base) {
    const clean = String(base || 'animation').trim().replace(/\s+/g, '-').toLowerCase() || 'animation';
    if (!library.has(clean)) return clean;
    let index = 2;
    while (library.has(`${clean}-${index}`)) index += 1;
    return `${clean}-${index}`;
  }

  function addAnimation() {
    const raw = window.prompt('Skeletal animation name', 'walk');
    if (raw === null) return;
    const name = uniqueName(raw);
    library.set(name, newAnimation(name));
    activeName = name;
    currentFrame = 0;
    renderAnimationSelect();
    toast(`Skeletal animation “${name}” created`);
  }

  function duplicateAnimation() {
    const source = animation();
    if (!source) return;
    const name = uniqueName(`${activeName}-copy`);
    const copy = {
      name,
      fps: source.fps,
      length: source.length,
      loop: source.loop,
      interpolation: source.interpolation,
      curve: [...(source.curve || [0.42, 0, 0.58, 1])],
      keyframes: new Map([...source.keyframes.entries()].map(([frame, pose]) => [frame, clonePose(pose)]))
    };
    library.set(name, copy);
    activeName = name;
    renderAnimationSelect();
    toast('Skeletal animation duplicated');
  }

  function mirrorPose(pose) {
    const mirrored = clonePose(pose);
    for (const [id, bone] of Object.entries(mirrored.bones || {})) {
      if (id === 'root') {
        bone.x = rigApi.state.width - bone.x;
        bone.rotation = 180 - bone.rotation;
      } else {
        bone.x = -bone.x;
        bone.rotation = -bone.rotation;
      }
    }
    Object.values(mirrored.parts || {}).forEach((part) => {
      part.x = -part.x;
      part.rotation = -part.rotation;
    });
    return mirrored;
  }

  function mirrorAnimation() {
    const source = animation();
    if (!source) return;
    const name = uniqueName(`${activeName}-mirror`);
    library.set(name, {
      name,
      fps: source.fps,
      length: source.length,
      loop: source.loop,
      interpolation: source.interpolation,
      curve: [...(source.curve || [0.42, 0, 0.58, 1])],
      keyframes: new Map([...source.keyframes.entries()].map(([frame, pose]) => [frame, mirrorPose(pose)]))
    });
    activeName = name;
    renderAnimationSelect();
    toast('Mirrored skeletal animation created');
  }

  function copyKeyframe() {
    const pose = animation()?.keyframes.get(currentFrame) || poseAt(currentFrame) || capturePose();
    clipboardPose = clonePose(pose);
    toast('Rig pose copied');
  }

  function pasteKeyframe() {
    if (!clipboardPose) return toast('Copy a rig pose first.', true);
    animation().keyframes.set(currentFrame, clonePose(clipboardPose));
    applyPose(clipboardPose, true);
    renderMarkers();
    toast('Rig pose pasted as keyframe');
  }

  function exportAnimations() {
    const payload = {
      version: 1,
      app: 'Sprite Sheet Studio',
      type: 'skeletal-animation-library',
      animations: Object.fromEntries([...library.entries()].map(([name, anim]) => [name, {
        fps: anim.fps,
        length: anim.length,
        loop: anim.loop,
        interpolation: anim.interpolation,
        curve: anim.curve,
        keyframes: Object.fromEntries([...anim.keyframes.entries()].map(([frame, pose]) => [frame, pose]))
      }]))
    };
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), 'skeletal-animations.json');
    toast('Skeletal animations exported');
  }

  function togglePlayback() {
    playing = !playing;
    playBtn.textContent = playing ? '❚❚' : '▶';
    lastTick = performance.now();
  }

  function tick(now) {
    if (playing && rigApi.state.open) {
      const anim = animation();
      const deltaSeconds = Math.min(.1, (now - lastTick) / 1000);
      playhead += deltaSeconds * anim.fps;
      if (playhead > anim.length) {
        if (anim.loop) playhead %= Math.max(1, anim.length);
        else {
          playhead = anim.length;
          playing = false;
          playBtn.textContent = '▶';
        }
      }
      currentFrame = Math.round(playhead);
      timelineRange.value = String(currentFrame);
      timeLabel.textContent = `Frame ${currentFrame} / ${anim.length}`;
      const pose = poseAt(playhead);
      if (pose) applyPose(pose, false);
      renderMarkers();
    }
    lastTick = now;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  const rigTopActions = document.querySelector('.rig-top-actions');
  const toolbar = document.createElement('div');
  toolbar.className = 'skeletal-toolbar';
  toolbar.innerHTML = `
    <select class="select" id="skAnimSelect" aria-label="Skeletal animation"></select>
    <button class="btn" id="skAddAnim" title="Add animation">+ Anim</button>
    <input class="control skeletal-fps" id="skFps" type="number" min="1" max="60" value="12" title="Animation FPS" />
    <button class="btn green" id="skKey" title="Set keyframe">◆ Key</button>
    <button class="btn primary" id="skPlay" title="Play skeletal animation">▶</button>`;
  rigTopActions.prepend(toolbar);

  const stage = document.querySelector('.rig-stage');
  const timeline = document.createElement('div');
  timeline.className = 'skeletal-timeline';
  timeline.innerHTML = `
    <div class="skeletal-timeline-top">
      <span class="skeletal-time-label" id="skTimeLabel">Frame 0 / 24</span>
      <div class="skeletal-key-actions">
        <button class="btn" id="skDeleteKey">Delete key</button>
        <button class="btn" id="skCopyKey">Copy pose</button>
        <button class="btn" id="skPasteKey">Paste pose</button>
        <button class="btn" id="skDuplicate">Duplicate anim</button>
        <button class="btn" id="skMirror">Mirror anim</button>
        <button class="btn" id="skExport">Export JSON</button>
      </div>
    </div>
    <div class="skeletal-track-wrap">
      <div class="skeletal-markers" id="skMarkers"></div>
      <input class="skeletal-range" id="skRange" type="range" min="0" max="24" value="0" step="1" />
    </div>
    <div class="skeletal-footer">
      <div class="skeletal-interp">Interpolation
        <select id="skInterp">
          <option value="step">Step</option>
          <option value="linear" selected>Linear</option>
          <option value="ease">Smooth ease</option>
          <option value="ease-in">Ease in</option>
          <option value="ease-out">Ease out</option>
          <option value="bezier">Cubic Bezier…</option>
        </select>
      </div>
      <div class="skeletal-interp">Length <input class="control" id="skLength" type="number" min="1" max="600" value="24" style="width:62px;height:25px" /> frames</div>
      <label class="skeletal-interp">Loop <input id="skLoop" type="checkbox" checked /></label>
    </div>
    <div class="skeletal-curve-panel" id="skCurvePanel" hidden>
      <canvas id="skCurveCanvas" width="180" height="72"></canvas>
      <div class="skeletal-curve-fields">
        <label>x1 <input id="skCurveX1" type="number" min="0" max="1" step="0.01" value="0.42" /></label>
        <label>y1 <input id="skCurveY1" type="number" min="-2" max="3" step="0.01" value="0" /></label>
        <label>x2 <input id="skCurveX2" type="number" min="0" max="1" step="0.01" value="0.58" /></label>
        <label>y2 <input id="skCurveY2" type="number" min="-2" max="3" step="0.01" value="1" /></label>
        <code id="skCurveCode">cubic-bezier(0.42, 0, 0.58, 1)</code>
      </div>
    </div>`;
  stage.append(timeline);

  const animSelect = document.querySelector('#skAnimSelect');
  const addAnimBtn = document.querySelector('#skAddAnim');
  const fpsInput = document.querySelector('#skFps');
  const keyBtn = document.querySelector('#skKey');
  const playBtn = document.querySelector('#skPlay');
  const timeLabel = document.querySelector('#skTimeLabel');
  const markers = document.querySelector('#skMarkers');
  const timelineRange = document.querySelector('#skRange');
  const interpSelect = document.querySelector('#skInterp');
  const lengthInput = document.querySelector('#skLength');
  const loopInput = document.querySelector('#skLoop');
  const deleteKeyBtn = document.querySelector('#skDeleteKey');
  const copyKeyBtn = document.querySelector('#skCopyKey');
  const pasteKeyBtn = document.querySelector('#skPasteKey');
  const duplicateBtn = document.querySelector('#skDuplicate');
  const mirrorBtn = document.querySelector('#skMirror');
  const exportBtn = document.querySelector('#skExport');
  const curvePanel = document.querySelector('#skCurvePanel');
  const curveCanvas = document.querySelector('#skCurveCanvas');
  const curveX1 = document.querySelector('#skCurveX1');
  const curveY1 = document.querySelector('#skCurveY1');
  const curveX2 = document.querySelector('#skCurveX2');
  const curveY2 = document.querySelector('#skCurveY2');
  const curveCode = document.querySelector('#skCurveCode');

  animSelect.addEventListener('change', () => {
    activeName = animSelect.value;
    currentFrame = 0;
    playhead = 0;
    renderAnimationSelect();
  });
  addAnimBtn.addEventListener('click', addAnimation);
  fpsInput.addEventListener('change', () => { animation().fps = Math.max(1, Math.min(60, Number(fpsInput.value) || 12)); fpsInput.value = String(animation().fps); });
  keyBtn.addEventListener('click', setKeyframe);
  playBtn.addEventListener('click', togglePlayback);
  timelineRange.addEventListener('input', () => { playing = false; playBtn.textContent = '▶'; setCurrentFrame(Number(timelineRange.value), true); });
  interpSelect.addEventListener('change', () => {
    animation().interpolation = interpSelect.value;
    syncCurveUi();
    setCurrentFrame(currentFrame, true);
  });
  lengthInput.addEventListener('change', () => {
    animation().length = Math.max(1, Math.min(600, Number(lengthInput.value) || 24));
    lengthInput.value = String(animation().length);
    timelineRange.max = String(animation().length);
    setCurrentFrame(Math.min(currentFrame, animation().length), true);
  });
  loopInput.addEventListener('change', () => { animation().loop = loopInput.checked; });
  deleteKeyBtn.addEventListener('click', deleteKeyframe);
  copyKeyBtn.addEventListener('click', copyKeyframe);
  pasteKeyBtn.addEventListener('click', pasteKeyframe);
  duplicateBtn.addEventListener('click', duplicateAnimation);
  mirrorBtn.addEventListener('click', mirrorAnimation);
  exportBtn.addEventListener('click', exportAnimations);

  function updateCurve() {
    const anim = animation();
    if (!anim) return;
    const values = [curveX1, curveY1, curveX2, curveY2].map((input, index) => {
      const value = Number(input.value);
      if (!Number.isFinite(value)) return [0.42, 0, 0.58, 1][index];
      return index === 0 || index === 2 ? Math.max(0, Math.min(1, value)) : Math.max(-2, Math.min(3, value));
    });
    anim.curve = values;
    syncCurveUi();
    setCurrentFrame(currentFrame, true);
  }
  [curveX1, curveY1, curveX2, curveY2].forEach((input) => input.addEventListener('change', updateCurve));

  renderAnimationSelect();
})();