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

  function easedT(t, mode) {
    if (mode === 'step') return 0;
    if (mode === 'ease') return t * t * (3 - 2 * t);
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

  function interpolatePose(a, b, rawT, mode) {
    if (!a) return clonePose(b);
    if (!b) return clonePose(a);
    const t = easedT(rawT, mode);
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
    return interpolatePose(anim.keyframes.get(previous), anim.keyframes.get(next), t, anim.interpolation);
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
        <select id="skInterp"><option value="step">Step</option><option value="linear" selected>Linear</option><option value="ease">Ease in/out</option></select>
      </div>
      <div class="skeletal-interp">Length <input class="control" id="skLength" type="number" min="1" max="600" value="24" style="width:62px;height:25px" /> frames</div>
      <label class="skeletal-interp">Loop <input id="skLoop" type="checkbox" checked /></label>
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
  interpSelect.addEventListener('change', () => { animation().interpolation = interpSelect.value; setCurrentFrame(currentFrame, true); });
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

  renderAnimationSelect();
})();