(() => {
  const DB_NAME = 'sprite-sheet-studio';
  const DB_VERSION = 1;
  const STORE_NAME = 'projects';
  const AUTOSAVE_KEY = 'last-project';
  const HISTORY_LIMIT = 30;

  let projectName = 'sprite-project';
  let activeAnimation = 'idle';
  const animations = new Map();
  let restoring = false;
  let skipNextHistory = false;
  let autosaveReady = false;
  let autosaveTimer = 0;
  let historyTimer = 0;
  let history = [];
  let historyIndex = -1;

  function cloneFrame(frame) {
    return {
      id: uid(),
      name: frame.name,
      canvas: cloneCanvas(frame.canvas),
      hold: frame.hold ?? 1
    };
  }

  function cloneAnimation(animation) {
    return {
      frames: animation.frames.map(cloneFrame),
      fps: animation.fps,
      loop: animation.loop,
      pingPong: animation.pingPong
    };
  }

  function captureAnimation() {
    return {
      frames: state.frames.map(cloneFrame),
      fps: state.fps,
      loop: state.loop,
      pingPong: state.pingPong
    };
  }

  function syncActiveAnimation() {
    if (restoring || !activeAnimation) return;
    animations.set(activeAnimation, captureAnimation());
  }

  function applyAnimation(animation) {
    restoring = true;
    stopPlayback();
    state.frames = animation.frames.map(cloneFrame);
    state.currentIndex = 0;
    state.fps = animation.fps ?? 8;
    state.loop = animation.loop ?? true;
    state.pingPong = animation.pingPong ?? false;
    state.playbackCursor = 0;
    el.fps.value = String(state.fps);
    el.fpsValue.textContent = String(state.fps);
    el.loop.checked = state.loop;
    el.pingPong.checked = state.pingPong;
    skipNextHistory = true;
    renderAll();
    restoring = false;
  }

  function captureRuntimeProject() {
    syncActiveAnimation();
    return {
      name: projectName,
      activeAnimation,
      animations: Array.from(animations.entries()).map(([name, animation]) => [name, cloneAnimation(animation)])
    };
  }

  function restoreRuntimeProject(snapshot) {
    restoring = true;
    projectName = snapshot.name;
    activeAnimation = snapshot.activeAnimation;
    animations.clear();
    snapshot.animations.forEach(([name, animation]) => animations.set(name, cloneAnimation(animation)));
    projectNameInput.value = projectName;
    renderAnimationSelect();
    const animation = animations.get(activeAnimation) || { frames: [], fps: 8, loop: true, pingPong: false };
    state.frames = animation.frames.map(cloneFrame);
    state.currentIndex = 0;
    state.fps = animation.fps;
    state.loop = animation.loop;
    state.pingPong = animation.pingPong;
    state.playbackCursor = 0;
    el.fps.value = String(state.fps);
    el.fpsValue.textContent = String(state.fps);
    el.loop.checked = state.loop;
    el.pingPong.checked = state.pingPong;
    skipNextHistory = true;
    renderAll();
    restoring = false;
    updateHistoryButtons();
    scheduleAutosave();
  }

  function resetHistory() {
    history = [captureRuntimeProject()];
    historyIndex = 0;
    updateHistoryButtons();
  }

  function recordHistory() {
    if (restoring) return;
    if (skipNextHistory) {
      skipNextHistory = false;
      return;
    }
    const snapshot = captureRuntimeProject();
    history = history.slice(0, historyIndex + 1);
    history.push(snapshot);
    if (history.length > HISTORY_LIMIT) history.shift();
    historyIndex = history.length - 1;
    updateHistoryButtons();
  }

  function queueHistory() {
    window.clearTimeout(historyTimer);
    historyTimer = window.setTimeout(recordHistory, 90);
  }

  function undo() {
    if (historyIndex <= 0) return;
    historyIndex -= 1;
    restoreRuntimeProject(history[historyIndex]);
    toast('Undo');
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex += 1;
    restoreRuntimeProject(history[historyIndex]);
    toast('Redo');
  }

  function updateHistoryButtons() {
    undoBtn.disabled = historyIndex <= 0;
    redoBtn.disabled = historyIndex < 0 || historyIndex >= history.length - 1;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB failed to open'));
    });
  }

  async function putAutosave(value) {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, AUTOSAVE_KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Autosave failed'));
    });
    db.close();
  }

  async function getAutosave() {
    const db = await openDb();
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(AUTOSAVE_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Autosave read failed'));
    });
    db.close();
    return result;
  }

  function serializeProject() {
    syncActiveAnimation();
    const serializedAnimations = {};
    for (const [name, animation] of animations.entries()) {
      serializedAnimations[name] = {
        fps: animation.fps,
        loop: animation.loop,
        pingPong: animation.pingPong,
        frames: animation.frames.map((frame) => ({
          name: frame.name,
          hold: frame.hold ?? 1,
          png: frame.canvas.toDataURL('image/png')
        }))
      };
    }
    return {
      version: 1,
      app: 'Sprite Sheet Studio',
      name: projectName,
      activeAnimation,
      savedAt: new Date().toISOString(),
      animations: serializedAnimations
    };
  }

  async function canvasFromDataUrl(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    get2d(canvas).drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas;
  }

  async function deserializeProject(data) {
    if (!data || data.version !== 1 || !data.animations || typeof data.animations !== 'object') {
      throw new Error('Unsupported or damaged Sprite Sheet Studio project file.');
    }

    const nextAnimations = new Map();
    for (const [name, animation] of Object.entries(data.animations)) {
      const frames = [];
      for (const frame of animation.frames || []) {
        frames.push({
          id: uid(),
          name: frame.name || 'frame.png',
          hold: Math.max(1, Number(frame.hold) || 1),
          canvas: await canvasFromDataUrl(frame.png)
        });
      }
      nextAnimations.set(name, {
        frames,
        fps: Math.max(1, Number(animation.fps) || 8),
        loop: animation.loop !== false,
        pingPong: Boolean(animation.pingPong)
      });
    }

    if (!nextAnimations.size) nextAnimations.set('idle', { frames: [], fps: 8, loop: true, pingPong: false });

    restoring = true;
    animations.clear();
    nextAnimations.forEach((value, key) => animations.set(key, value));
    projectName = String(data.name || 'sprite-project');
    activeAnimation = animations.has(data.activeAnimation) ? data.activeAnimation : animations.keys().next().value;
    projectNameInput.value = projectName;
    renderAnimationSelect();
    restoring = false;
    applyAnimation(animations.get(activeAnimation));
    resetHistory();
    scheduleAutosave();
  }

  function setSaveStatus(text, kind = '') {
    projectStatus.textContent = text;
    projectStatus.className = `project-status ${kind}`.trim();
  }

  function scheduleAutosave() {
    if (!autosaveReady || restoring) return;
    window.clearTimeout(autosaveTimer);
    setSaveStatus('saving…', 'saving');
    autosaveTimer = window.setTimeout(async () => {
      try {
        await putAutosave(serializeProject());
        setSaveStatus('autosaved', 'saved');
      } catch (error) {
        console.error(error);
        setSaveStatus('save failed', 'error');
      }
    }, 450);
  }

  async function restoreAutosave() {
    try {
      const saved = await getAutosave();
      autosaveReady = true;
      if (saved && Object.keys(saved.animations || {}).length) {
        await deserializeProject(saved);
        setSaveStatus('restored', 'saved');
        toast('Autosaved project restored');
      } else {
        animations.set('idle', captureAnimation());
        renderAnimationSelect();
        resetHistory();
        setSaveStatus('autosave on', 'saved');
      }
    } catch (error) {
      console.error(error);
      autosaveReady = true;
      animations.set('idle', captureAnimation());
      renderAnimationSelect();
      resetHistory();
      setSaveStatus('autosave unavailable', 'error');
    }
  }

  function renderAnimationSelect() {
    animationSelect.innerHTML = '';
    animations.forEach((_, name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      animationSelect.append(option);
    });
    animationSelect.value = activeAnimation;
    animationCount.textContent = `${animations.size} anim`;
  }

  function switchAnimation(name) {
    if (!animations.has(name) || name === activeAnimation) return;
    syncActiveAnimation();
    activeAnimation = name;
    applyAnimation(animations.get(name));
    renderAnimationSelect();
    scheduleAutosave();
  }

  function uniqueAnimationName(base) {
    const clean = String(base || 'animation').trim().replace(/\s+/g, '-').toLowerCase() || 'animation';
    if (!animations.has(clean)) return clean;
    let index = 2;
    while (animations.has(`${clean}-${index}`)) index += 1;
    return `${clean}-${index}`;
  }

  function addAnimation() {
    syncActiveAnimation();
    const suggested = ['idle', 'walk', 'run', 'attack', 'death'].find((name) => !animations.has(name)) || 'animation';
    const raw = window.prompt('Animation name', suggested);
    if (raw === null) return;
    const name = uniqueAnimationName(raw);
    animations.set(name, { frames: [], fps: state.fps, loop: true, pingPong: false });
    activeAnimation = name;
    applyAnimation(animations.get(name));
    renderAnimationSelect();
    recordHistory();
    scheduleAutosave();
    toast(`Animation “${name}” created`);
  }

  function renameAnimation() {
    const raw = window.prompt('Rename animation', activeAnimation);
    if (raw === null) return;
    const requested = String(raw).trim().replace(/\s+/g, '-').toLowerCase();
    if (!requested || requested === activeAnimation) return;
    if (animations.has(requested)) return toast('Animation with that name already exists.', true);
    syncActiveAnimation();
    const animation = animations.get(activeAnimation);
    animations.delete(activeAnimation);
    animations.set(requested, animation);
    activeAnimation = requested;
    renderAnimationSelect();
    recordHistory();
    scheduleAutosave();
    toast(`Animation renamed to “${requested}”`);
  }

  function deleteAnimation() {
    if (animations.size <= 1) return toast('A project must contain at least one animation.', true);
    if (!window.confirm(`Delete animation “${activeAnimation}”?`)) return;
    animations.delete(activeAnimation);
    activeAnimation = animations.keys().next().value;
    applyAnimation(animations.get(activeAnimation));
    renderAnimationSelect();
    recordHistory();
    scheduleAutosave();
    toast('Animation deleted');
  }

  function newProject() {
    if ((state.frames.length || animations.size > 1) && !window.confirm('Create a new project? The current project is already autosaved.')) return;
    restoring = true;
    stopPlayback();
    state.source?.close();
    state.source = null;
    state.sourceName = 'No source loaded';
    state.frames = [];
    state.currentIndex = 0;
    animations.clear();
    animations.set('idle', { frames: [], fps: 8, loop: true, pingPong: false });
    activeAnimation = 'idle';
    projectName = 'sprite-project';
    projectNameInput.value = projectName;
    restoring = false;
    applyAnimation(animations.get('idle'));
    renderAnimationSelect();
    resetHistory();
    scheduleAutosave();
    toast('New project created');
  }

  function exportProject() {
    try {
      const data = serializeProject();
      const safeName = (projectName || 'sprite-project').replace(/[^a-z0-9_-]+/gi, '-');
      downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `${safeName}.sss`);
      setSaveStatus('exported', 'saved');
      toast('Project exported');
    } catch (error) {
      console.error(error);
      toast('Project export failed.', true);
    }
  }

  async function importProjectFile(file) {
    try {
      setSaveStatus('loading…', 'saving');
      const data = JSON.parse(await file.text());
      await deserializeProject(data);
      setSaveStatus('imported', 'saved');
      toast('Project imported');
    } catch (error) {
      console.error(error);
      setSaveStatus('import failed', 'error');
      toast(error instanceof Error ? error.message : 'Project import failed.', true);
    }
  }

  function mutateCurrentFrame(mutator, label) {
    const frame = state.frames[state.currentIndex];
    if (!frame) return;
    stopPlayback();
    mutator(frame);
    renderAll();
    toast(label);
  }

  function nudgeCurrent(dx, dy) {
    mutateCurrentFrame((frame) => {
      const out = document.createElement('canvas');
      out.width = frame.canvas.width;
      out.height = frame.canvas.height;
      get2d(out).drawImage(frame.canvas, dx, dy);
      frame.canvas = out;
    }, `Moved ${dx || ''}${dx ? 'px X' : ''}${dx && dy ? ', ' : ''}${dy || ''}${dy ? 'px Y' : ''}`);
  }

  function cropCurrent() {
    mutateCurrentFrame((frame) => { frame.canvas = trimTransparent(frame.canvas); }, 'Current frame cropped');
  }

  function resizeCurrentCanvas() {
    const frame = state.frames[state.currentIndex];
    if (!frame) return;
    const input = window.prompt('Canvas size (width × height)', `${frame.canvas.width}x${frame.canvas.height}`);
    if (!input) return;
    const match = input.match(/^\s*(\d+)\s*[x×, ]\s*(\d+)\s*$/i);
    if (!match) return toast('Use format 64x64.', true);
    const width = Math.max(1, Math.min(8192, Number(match[1])));
    const height = Math.max(1, Math.min(8192, Number(match[2])));
    mutateCurrentFrame((current) => {
      const out = document.createElement('canvas');
      out.width = width;
      out.height = height;
      const x = Math.floor((width - current.canvas.width) / 2);
      const y = height - current.canvas.height;
      get2d(out).drawImage(current.canvas, x, y);
      current.canvas = out;
    }, `Canvas resized to ${width}×${height}`);
  }

  function scaleCurrent() {
    const factor = Number(scaleSelect.value) || 2;
    mutateCurrentFrame((frame) => {
      const out = document.createElement('canvas');
      out.width = Math.max(1, Math.round(frame.canvas.width * factor));
      out.height = Math.max(1, Math.round(frame.canvas.height * factor));
      const ctx = get2d(out);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(frame.canvas, 0, 0, out.width, out.height);
      frame.canvas = out;
    }, `Nearest-neighbour scale ×${factor}`);
  }

  function applyHoldToAll() {
    const frame = state.frames[state.currentIndex];
    if (!frame) return;
    state.frames.forEach((item) => { item.hold = frame.hold; });
    renderAll();
    toast(`Hold ×${frame.hold} applied to all frames`);
  }

  function setOncePreset() {
    state.loop = false;
    state.pingPong = false;
    el.loop.checked = false;
    el.pingPong.checked = false;
    renderStats();
    syncActiveAnimation();
    scheduleAutosave();
    toast('Playback preset: once');
  }

  const topActions = document.querySelector('.top-actions');
  const projectFragment = document.createDocumentFragment();
  const projectNameInput = document.createElement('input');
  projectNameInput.className = 'project-name-input';
  projectNameInput.value = projectName;
  projectNameInput.setAttribute('aria-label', 'Project name');
  projectNameInput.title = 'Project name';

  const projectStatus = document.createElement('span');
  projectStatus.className = 'project-status';
  projectStatus.textContent = 'starting…';

  const undoBtn = document.createElement('button');
  undoBtn.className = 'btn history-btn';
  undoBtn.textContent = '↶';
  undoBtn.title = 'Undo · Ctrl+Z';

  const redoBtn = document.createElement('button');
  redoBtn.className = 'btn history-btn';
  redoBtn.textContent = '↷';
  redoBtn.title = 'Redo · Ctrl+Shift+Z';

  const newBtn = document.createElement('button');
  newBtn.className = 'btn';
  newBtn.textContent = 'New';
  newBtn.title = 'New project';

  const exportProjectBtn = document.createElement('button');
  exportProjectBtn.className = 'btn';
  exportProjectBtn.textContent = 'Save .sss';

  const importProjectBtn = document.createElement('button');
  importProjectBtn.className = 'btn';
  importProjectBtn.textContent = 'Load .sss';

  const projectFileInput = document.createElement('input');
  projectFileInput.type = 'file';
  projectFileInput.accept = '.sss,.json,application/json';
  projectFileInput.className = 'project-file-input';

  projectFragment.append(projectNameInput, projectStatus, undoBtn, redoBtn, newBtn, exportProjectBtn, importProjectBtn, projectFileInput);
  topActions.prepend(projectFragment);

  const timelineActions = document.querySelector('.timeline-actions');
  const animationManager = document.createElement('div');
  animationManager.className = 'animation-manager';
  const animationCount = document.createElement('span');
  animationCount.className = 'animation-pill';
  animationCount.textContent = '1 anim';
  const animationSelect = document.createElement('select');
  animationSelect.className = 'select';
  animationSelect.setAttribute('aria-label', 'Current animation');
  const addAnimationBtn = document.createElement('button');
  addAnimationBtn.className = 'btn';
  addAnimationBtn.textContent = '+ Anim';
  const renameAnimationBtn = document.createElement('button');
  renameAnimationBtn.className = 'btn';
  renameAnimationBtn.textContent = 'Rename';
  const deleteAnimationBtn = document.createElement('button');
  deleteAnimationBtn.className = 'btn danger';
  deleteAnimationBtn.textContent = 'Delete';
  animationManager.append(animationCount, animationSelect, addAnimationBtn, renameAnimationBtn, deleteAnimationBtn);
  timelineActions.prepend(animationManager);

  const advancedPanel = document.createElement('div');
  advancedPanel.className = 'panel-section advanced-tools-panel';
  advancedPanel.innerHTML = `
    <div class="section-head"><h2 class="section-title">Advanced frame tools</h2><span class="section-note">pixel-perfect</span></div>
    <div class="advanced-tool-grid">
      <button class="btn" id="extCropCurrent">Crop current</button>
      <button class="btn" id="extResizeCanvas">Resize canvas</button>
      <button class="btn" id="extHoldAll">Hold → all</button>
      <button class="btn" id="extOncePreset">Play once</button>
    </div>
    <div class="nudge-grid" aria-label="Move current frame by one pixel">
      <span class="blank"></span><button class="btn" id="extMoveUp">↑</button><span class="blank"></span>
      <button class="btn" id="extMoveLeft">←</button><span class="blank"></span><button class="btn" id="extMoveRight">→</button>
      <span class="blank"></span><button class="btn" id="extMoveDown">↓</button><span class="blank"></span>
    </div>
    <div class="scale-line">
      <select class="select" id="extScaleSelect"><option value="2">Scale ×2</option><option value="3">Scale ×3</option><option value="4">Scale ×4</option></select>
      <button class="btn" id="extScaleApply">Apply</button>
    </div>`;
  const exportPanel = el.gif.closest('.panel-section');
  exportPanel.parentElement.insertBefore(advancedPanel, exportPanel);

  const cropCurrentBtn = document.querySelector('#extCropCurrent');
  const resizeCanvasBtn = document.querySelector('#extResizeCanvas');
  const holdAllBtn = document.querySelector('#extHoldAll');
  const oncePresetBtn = document.querySelector('#extOncePreset');
  const moveUpBtn = document.querySelector('#extMoveUp');
  const moveDownBtn = document.querySelector('#extMoveDown');
  const moveLeftBtn = document.querySelector('#extMoveLeft');
  const moveRightBtn = document.querySelector('#extMoveRight');
  const scaleSelect = document.querySelector('#extScaleSelect');
  const scaleApplyBtn = document.querySelector('#extScaleApply');

  projectNameInput.addEventListener('change', () => {
    projectName = projectNameInput.value.trim() || 'sprite-project';
    projectNameInput.value = projectName;
    scheduleAutosave();
  });
  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);
  newBtn.addEventListener('click', newProject);
  exportProjectBtn.addEventListener('click', exportProject);
  importProjectBtn.addEventListener('click', () => projectFileInput.click());
  projectFileInput.addEventListener('change', () => {
    const file = projectFileInput.files?.[0];
    if (file) void importProjectFile(file);
    projectFileInput.value = '';
  });

  animationSelect.addEventListener('change', () => switchAnimation(animationSelect.value));
  addAnimationBtn.addEventListener('click', addAnimation);
  renameAnimationBtn.addEventListener('click', renameAnimation);
  deleteAnimationBtn.addEventListener('click', deleteAnimation);

  cropCurrentBtn.addEventListener('click', cropCurrent);
  resizeCanvasBtn.addEventListener('click', resizeCurrentCanvas);
  holdAllBtn.addEventListener('click', applyHoldToAll);
  oncePresetBtn.addEventListener('click', setOncePreset);
  moveUpBtn.addEventListener('click', () => nudgeCurrent(0, -1));
  moveDownBtn.addEventListener('click', () => nudgeCurrent(0, 1));
  moveLeftBtn.addEventListener('click', () => nudgeCurrent(-1, 0));
  moveRightBtn.addEventListener('click', () => nudgeCurrent(1, 0));
  scaleApplyBtn.addEventListener('click', scaleCurrent);

  const framesObserver = new MutationObserver(() => {
    if (restoring) return;
    syncActiveAnimation();
    queueHistory();
    scheduleAutosave();
  });
  framesObserver.observe(el.frames, { childList: true, subtree: true });

  [el.fps, el.loop, el.pingPong].forEach((control) => {
    control.addEventListener('change', () => {
      syncActiveAnimation();
      scheduleAutosave();
    });
  });

  window.addEventListener('keydown', (event) => {
    const mod = event.ctrlKey || event.metaKey;
    if (!mod || event.altKey) return;
    if (event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    } else if (event.key.toLowerCase() === 'y') {
      event.preventDefault();
      redo();
    } else if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      exportProject();
    }
  }, true);

  void restoreAutosave();
})();