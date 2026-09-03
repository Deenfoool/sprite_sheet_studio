let skeletalTracksInitialized = false;

function initSkeletalTracks() {
  if (skeletalTracksInitialized) return true;
  const api = globalThis.__SSSSkeletal;
  const rigApi = globalThis.__SSSRig;
  const timeline = document.querySelector('.skeletal-timeline');
  const range = document.querySelector('#skRange');
  const animationSelect = document.querySelector('#skAnimSelect');
  const markers = document.querySelector('#skMarkers');
  if (!api?.serialize || !rigApi?.state || !(timeline instanceof HTMLElement) || !(range instanceof HTMLInputElement) || !(animationSelect instanceof HTMLSelectElement) || !(markers instanceof HTMLElement)) return false;
  skeletalTracksInitialized = true;

  const host = document.createElement('div');
  host.className = 'skeletal-tracks-shell';
  host.innerHTML = `
    <div class="skeletal-tracks-toolbar">
      <button class="btn" id="skTracksToggle" aria-expanded="true">Tracks</button>
      <select id="skTracksFilter" aria-label="Track filter">
        <option value="all">Bones + parts</option>
        <option value="bones">Bones only</option>
        <option value="parts">Parts only</option>
        <option value="selected">Selected only</option>
      </select>
      <label class="skeletal-track-density">Zoom <input id="skTracksZoom" type="range" min="6" max="24" value="12" /></label>
      <span class="skeletal-track-summary" data-sk-track-summary>—</span>
    </div>
    <div class="skeletal-tracks-body" data-sk-tracks-body>
      <div class="skeletal-tracks-labels" data-sk-track-labels></div>
      <div class="skeletal-tracks-scroll" data-sk-track-scroll>
        <div class="skeletal-tracks-ruler" data-sk-track-ruler></div>
        <div class="skeletal-tracks-grid" data-sk-track-grid></div>
        <div class="skeletal-tracks-playhead" data-sk-track-playhead></div>
      </div>
    </div>`;
  timeline.insertAdjacentElement('beforeend', host);

  const toggle = host.querySelector('#skTracksToggle');
  const filter = host.querySelector('#skTracksFilter');
  const zoomInput = host.querySelector('#skTracksZoom');
  const summary = host.querySelector('[data-sk-track-summary]');
  const body = host.querySelector('[data-sk-tracks-body]');
  const labels = host.querySelector('[data-sk-track-labels]');
  const scroll = host.querySelector('[data-sk-track-scroll]');
  const ruler = host.querySelector('[data-sk-track-ruler]');
  const grid = host.querySelector('[data-sk-track-grid]');
  const playhead = host.querySelector('[data-sk-track-playhead]');

  let collapsed = false;
  let lastSignature = '';

  const boneProperties = [
    ['position', ['x', 'y']],
    ['rotation', ['rotation']],
    ['length', ['length']],
    ['visibility', ['visible']]
  ];
  const partProperties = [
    ['position', ['x', 'y']],
    ['rotation', ['rotation']],
    ['scale', ['scaleX', 'scaleY']],
    ['opacity', ['opacity']],
    ['visibility', ['visible']],
    ['z-order', ['z']]
  ];

  function serialized() {
    try { return api.serialize(); } catch { return null; }
  }

  function activeAnimation(data) {
    if (!data?.animations) return null;
    const name = animationSelect.value || data.activeName || Object.keys(data.animations)[0];
    return { name, animation: data.animations[name] || null };
  }

  function keyframesOf(animation) {
    if (!animation) return [];
    const raw = animation.keyframes || {};
    return Object.entries(raw)
      .map(([frame, pose]) => [Number(frame), pose])
      .filter(([frame]) => Number.isFinite(frame))
      .sort((a, b) => a[0] - b[0]);
  }

  function valueChanged(previous, current, keys) {
    if (!previous) return true;
    return keys.some((key) => {
      const a = previous?.[key];
      const b = current?.[key];
      if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) > 0.0001;
      return a !== b;
    });
  }

  function laneMarkers(keyframes, kind, id, keys) {
    const output = [];
    let previous = null;
    keyframes.forEach(([frame, pose]) => {
      const value = pose?.[kind]?.[id];
      if (!value) return;
      if (valueChanged(previous, value, keys)) output.push(frame);
      previous = value;
    });
    return output;
  }

  function entityRows(keyframes) {
    const selectedBone = rigApi.state.selectedBoneId;
    const selectedPart = rigApi.state.selectedPartId;
    const filterMode = filter.value;
    const rows = [];

    const allowBones = filterMode === 'all' || filterMode === 'bones' || filterMode === 'selected';
    const allowParts = filterMode === 'all' || filterMode === 'parts' || filterMode === 'selected';

    if (allowBones) {
      rigApi.state.bones.forEach((bone) => {
        if (filterMode === 'selected' && bone.id !== selectedBone) return;
        rows.push({ type: 'group', kind: 'bones', id: bone.id, label: bone.name || bone.id, icon: 'bone' });
        boneProperties.forEach(([label, keys]) => rows.push({
          type: 'lane', kind: 'bones', id: bone.id, label, keys, markers: laneMarkers(keyframes, 'bones', bone.id, keys)
        }));
      });
    }

    if (allowParts) {
      rigApi.state.parts.forEach((part) => {
        if (filterMode === 'selected' && part.id !== selectedPart) return;
        rows.push({ type: 'group', kind: 'parts', id: part.id, label: part.name || part.id, icon: 'image' });
        partProperties.forEach(([label, keys]) => rows.push({
          type: 'lane', kind: 'parts', id: part.id, label, keys, markers: laneMarkers(keyframes, 'parts', part.id, keys)
        }));
      });
    }
    return rows;
  }

  function frameWidth() {
    return Math.max(6, Number(zoomInput.value) || 12);
  }

  function setFrame(frame) {
    const value = Math.max(Number(range.min) || 0, Math.min(Number(range.max) || 0, Math.round(frame)));
    range.value = String(value);
    range.dispatchEvent(new Event('input', { bubbles: true }));
    updatePlayhead();
  }

  function updatePlayhead() {
    const width = frameWidth();
    const frame = Number(range.value) || 0;
    playhead.style.left = `${frame * width}px`;
    playhead.dataset.frame = String(frame);
  }

  function renderRuler(length) {
    const width = frameWidth();
    ruler.style.width = `${Math.max(1, length + 1) * width}px`;
    ruler.innerHTML = '';
    const step = width >= 18 ? 5 : width >= 10 ? 10 : 20;
    for (let frame = 0; frame <= length; frame += step) {
      const tick = document.createElement('button');
      tick.type = 'button';
      tick.className = 'skeletal-ruler-tick';
      tick.style.left = `${frame * width}px`;
      tick.textContent = String(frame);
      tick.title = `Go to frame ${frame}`;
      tick.addEventListener('click', () => setFrame(frame));
      ruler.append(tick);
    }
  }

  function render() {
    const data = serialized();
    const active = activeAnimation(data);
    const animation = active?.animation;
    if (!animation) return;
    const keyframes = keyframesOf(animation);
    const length = Math.max(1, Number(animation.length) || Number(range.max) || 24);
    const width = frameWidth();
    const rows = entityRows(keyframes);

    const signature = JSON.stringify({
      active: active.name,
      length,
      frames: keyframes.map(([frame]) => frame),
      bones: rigApi.state.bones.map((bone) => [bone.id, bone.name]),
      parts: rigApi.state.parts.map((part) => [part.id, part.name]),
      filter: filter.value,
      zoom: width,
      selectedBone: rigApi.state.selectedBoneId,
      selectedPart: rigApi.state.selectedPartId,
      keySignature: rows.filter((row) => row.type === 'lane').map((row) => [row.kind, row.id, row.label, row.markers])
    });
    if (signature === lastSignature) {
      updatePlayhead();
      return;
    }
    lastSignature = signature;

    labels.innerHTML = '';
    grid.innerHTML = '';
    grid.style.width = `${(length + 1) * width}px`;
    renderRuler(length);

    let markerCount = 0;
    rows.forEach((row) => {
      const labelRow = document.createElement('div');
      const gridRow = document.createElement('div');
      labelRow.className = row.type === 'group' ? 'skeletal-track-label group' : 'skeletal-track-label lane';
      gridRow.className = row.type === 'group' ? 'skeletal-track-row group' : 'skeletal-track-row lane';
      gridRow.style.width = `${(length + 1) * width}px`;

      if (row.type === 'group') {
        labelRow.innerHTML = `<span class="skeletal-track-entity-icon" data-lucide="${row.icon}" aria-hidden="true"></span><strong>${escapeHtml(row.label)}</strong>`;
        gridRow.dataset.entity = row.id;
      } else {
        labelRow.innerHTML = `<span>${escapeHtml(row.label)}</span>`;
        for (let frame = 0; frame <= length; frame += 1) {
          if (frame % 5 !== 0) continue;
          const guide = document.createElement('span');
          guide.className = 'skeletal-track-guide';
          guide.style.left = `${frame * width}px`;
          gridRow.append(guide);
        }
        row.markers.forEach((frame) => {
          markerCount += 1;
          const marker = document.createElement('button');
          marker.type = 'button';
          marker.className = 'skeletal-track-key';
          marker.style.left = `${frame * width}px`;
          marker.title = `${row.label} · frame ${frame}`;
          marker.setAttribute('aria-label', `${row.label} keyframe at frame ${frame}`);
          marker.addEventListener('click', () => setFrame(frame));
          gridRow.append(marker);
        });
      }
      labels.append(labelRow);
      grid.append(gridRow);
    });

    summary.textContent = `${rows.filter((row) => row.type === 'lane').length} lanes · ${markerCount} keys`;
    globalThis.lucide?.createIcons?.({ attrs: { 'stroke-width': 2, 'aria-hidden': 'true' } });
    updatePlayhead();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  toggle.addEventListener('click', () => {
    collapsed = !collapsed;
    body.hidden = collapsed;
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.classList.toggle('active', !collapsed);
  });
  filter.addEventListener('change', () => { lastSignature = ''; render(); });
  zoomInput.addEventListener('input', () => { lastSignature = ''; render(); });
  range.addEventListener('input', updatePlayhead);
  animationSelect.addEventListener('change', () => { lastSignature = ''; setTimeout(render, 0); });

  const markerObserver = new MutationObserver(() => { lastSignature = ''; render(); });
  markerObserver.observe(markers, { childList: true, subtree: true });

  const rigObserverTarget = document.querySelector('.rig-inspector');
  const rigObserver = new MutationObserver(() => { lastSignature = ''; render(); });
  if (rigObserverTarget) rigObserver.observe(rigObserverTarget, { childList: true, subtree: true, characterData: true });

  // Keep the playhead responsive during skeletal playback without rebuilding lanes every frame.
  function tick() {
    updatePlayhead();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  globalThis.__SSSSkeletalTracks = { render, setFrame };
  render();
  return true;
}

if (!initSkeletalTracks()) {
  const timer = window.setInterval(() => {
    if (!initSkeletalTracks()) return;
    window.clearInterval(timer);
  }, 100);
  window.setTimeout(() => window.clearInterval(timer), 15000);
}
