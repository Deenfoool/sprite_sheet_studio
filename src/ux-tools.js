(() => {
  const selected = new Set();
  let anchorIndex = 0;
  let guideX = 0;
  let guideY = 0;
  let showRulers = true;

  function validSelection() {
    [...selected].forEach((index) => { if (index < 0 || index >= state.frames.length) selected.delete(index); });
    if (!selected.size && state.frames.length) selected.add(Math.min(state.currentIndex, state.frames.length - 1));
    return [...selected].sort((a, b) => a - b);
  }

  function updateSelectionClasses() {
    const indices = new Set(validSelection());
    [...el.frames.querySelectorAll('.frame-card')].forEach((card, index) => card.classList.toggle('multi-selected', indices.has(index)));
    selectionCount.textContent = `${indices.size} selected`;
    deleteSelectedBtn.disabled = !indices.size;
    duplicateSelectedBtn.disabled = !indices.size;
  }

  function selectOnly(index) {
    selected.clear();
    selected.add(index);
    anchorIndex = index;
  }

  function selectRange(index) {
    selected.clear();
    const start = Math.min(anchorIndex, index);
    const end = Math.max(anchorIndex, index);
    for (let i = start; i <= end; i += 1) selected.add(i);
  }

  function duplicateSelected() {
    const indices = validSelection();
    if (!indices.length) return;
    const sourceSet = new Set(indices);
    const next = [];
    const duplicateIndices = [];
    state.frames.forEach((frame, index) => {
      next.push(frame);
      if (sourceSet.has(index)) {
        const duplicate = {
          id: uid(),
          name: `${frame.name.replace(/\.png$/i, '')}_copy.png`,
          canvas: cloneCanvas(frame.canvas),
          hold: frame.hold
        };
        next.push(duplicate);
        duplicateIndices.push(next.length - 1);
      }
    });
    state.frames = next;
    selected.clear();
    duplicateIndices.forEach((index) => selected.add(index));
    state.currentIndex = duplicateIndices[0] ?? 0;
    anchorIndex = state.currentIndex;
    renderAll();
    toast(`${duplicateIndices.length} frame(s) duplicated`);
  }

  function deleteSelected() {
    const indices = validSelection();
    if (!indices.length) return;
    const remove = new Set(indices);
    state.frames = state.frames.filter((_, index) => !remove.has(index));
    state.currentIndex = Math.max(0, Math.min(indices[0], state.frames.length - 1));
    selected.clear();
    if (state.frames.length) selected.add(state.currentIndex);
    anchorIndex = state.currentIndex;
    if (!state.frames.length) stopPlayback();
    renderAll();
    toast(`${indices.length} frame(s) deleted`);
  }

  function reverseSelected() {
    const indices = validSelection();
    if (indices.length < 2) return;
    const values = indices.map((index) => state.frames[index]).reverse();
    indices.forEach((index, position) => { state.frames[index] = values[position]; });
    renderAll();
    toast('Selected frames reversed');
  }

  async function exportSelected() {
    const indices = validSelection();
    if (!indices.length) return;
    const files = {};
    for (let i = 0; i < indices.length; i += 1) {
      const frame = state.frames[indices[i]];
      const blob = await canvasToBlob(drawNormalizedFrame(frame));
      files[`selected/frame_${String(i + 1).padStart(3, '0')}.png`] = new Uint8Array(await blob.arrayBuffer());
    }
    downloadBlob(new Blob([zipSync(files)], { type: 'application/zip' }), 'selected-frames.zip');
    toast('Selected frames exported');
  }

  const timelineActions = document.querySelector('.timeline-actions');
  const multiActions = document.createElement('div');
  multiActions.className = 'multi-actions';
  multiActions.innerHTML = `
    <span class="selection-count" id="multiSelectionCount">0 selected</span>
    <button class="btn" id="multiDuplicate">Duplicate</button>
    <button class="btn danger" id="multiDelete">Delete</button>`;
  timelineActions.prepend(multiActions);
  const selectionCount = multiActions.querySelector('#multiSelectionCount');
  const duplicateSelectedBtn = multiActions.querySelector('#multiDuplicate');
  const deleteSelectedBtn = multiActions.querySelector('#multiDelete');
  duplicateSelectedBtn.addEventListener('click', duplicateSelected);
  deleteSelectedBtn.addEventListener('click', deleteSelected);

  el.frames.addEventListener('click', (event) => {
    const card = event.target.closest('.frame-card');
    if (!card) return;
    const index = Number(card.dataset.index);
    if (!Number.isInteger(index)) return;
    if (event.shiftKey) {
      event.preventDefault();
      event.stopImmediatePropagation();
      selectRange(index);
      state.currentIndex = index;
      stopPlayback();
      renderPreview();
      renderTimelineActive();
      updateSelectionClasses();
    } else if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (selected.has(index) && selected.size > 1) selected.delete(index);
      else selected.add(index);
      anchorIndex = index;
      state.currentIndex = index;
      stopPlayback();
      renderPreview();
      renderTimelineActive();
      updateSelectionClasses();
    } else {
      selectOnly(index);
      window.setTimeout(updateSelectionClasses, 0);
    }
  }, true);

  const contextMenu = document.createElement('div');
  contextMenu.className = 'sss-context-menu hidden';
  contextMenu.innerHTML = `
    <button data-action="duplicate">Duplicate selection</button>
    <button data-action="reverse">Reverse selection</button>
    <button data-action="export">Export selected PNGs</button>
    <div class="sss-context-separator"></div>
    <button class="danger" data-action="delete">Delete selection</button>`;
  document.body.append(contextMenu);

  function hideContextMenu() { contextMenu.classList.add('hidden'); }
  el.frames.addEventListener('contextmenu', (event) => {
    const card = event.target.closest('.frame-card');
    if (!card) return;
    event.preventDefault();
    const index = Number(card.dataset.index);
    if (!selected.has(index)) selectOnly(index);
    updateSelectionClasses();
    const width = 190;
    const height = 150;
    contextMenu.style.left = `${Math.min(event.clientX, innerWidth - width - 8)}px`;
    contextMenu.style.top = `${Math.min(event.clientY, innerHeight - height - 8)}px`;
    contextMenu.classList.remove('hidden');
  });
  contextMenu.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    hideContextMenu();
    const action = button.dataset.action;
    if (action === 'duplicate') duplicateSelected();
    else if (action === 'reverse') reverseSelected();
    else if (action === 'delete') deleteSelected();
    else if (action === 'export') void exportSelected();
  });
  document.addEventListener('pointerdown', (event) => { if (!contextMenu.contains(event.target)) hideContextMenu(); });
  window.addEventListener('blur', hideContextMenu);

  window.addEventListener('keydown', (event) => {
    const target = event.target;
    if (target?.matches?.('input, select, textarea')) return;
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === 'a' && state.frames.length) {
      event.preventDefault();
      event.stopImmediatePropagation();
      selected.clear();
      state.frames.forEach((_, index) => selected.add(index));
      anchorIndex = state.currentIndex;
      updateSelectionClasses();
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && selected.size > 1) {
      event.preventDefault();
      event.stopImmediatePropagation();
      deleteSelected();
    }
  }, true);

  const guidePanel = document.createElement('div');
  guidePanel.className = 'panel-section guides-panel';
  guidePanel.innerHTML = `
    <div class="section-head"><h2 class="section-title">Rulers & Guides</h2><span class="section-note">pixel space</span></div>
    <div class="guide-grid">
      <div class="field"><label>Guide X</label><input class="control" id="guideX" type="number" min="0" value="0" /></div>
      <div class="field"><label>Guide Y</label><input class="control" id="guideY" type="number" min="0" value="0" /></div>
    </div>
    <div class="guide-actions"><button class="btn" id="guideCenter">Center guides</button><button class="btn green" id="guideSnap">Snap sprite center</button></div>
    <label class="control-line" style="margin-top:9px"><span>Show rulers</span><span class="switch"><input id="guideRulers" type="checkbox" checked /><span></span></span></label>
    <div class="guide-help">Guides use the normalized animation canvas. Snap moves opaque pixels without resampling them.</div>`;
  const exportPanel = el.gif.closest('.panel-section');
  exportPanel.parentElement.insertBefore(guidePanel, exportPanel);

  const guideXInput = guidePanel.querySelector('#guideX');
  const guideYInput = guidePanel.querySelector('#guideY');
  const centerGuidesBtn = guidePanel.querySelector('#guideCenter');
  const snapGuideBtn = guidePanel.querySelector('#guideSnap');
  const rulersInput = guidePanel.querySelector('#guideRulers');

  const guideCanvas = document.createElement('canvas');
  guideCanvas.className = 'guide-overlay';
  el.previewSurface.append(guideCanvas);

  function centerGuides() {
    if (!state.frames.length) return;
    const size = normalizedSize();
    guideX = Math.floor(size.width / 2);
    guideY = Math.floor(size.height / 2);
    guideXInput.value = String(guideX);
    guideYInput.value = String(guideY);
    updateGuideOverlay();
  }

  function updateGuideOverlay() {
    if (!state.frames.length || el.previewCanvas.classList.contains('hidden')) {
      guideCanvas.style.display = 'none';
      return;
    }
    guideCanvas.style.display = 'block';
    const surfaceRect = el.previewSurface.getBoundingClientRect();
    const canvasRect = el.previewCanvas.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.round(canvasRect.width));
    const cssHeight = Math.max(1, Math.round(canvasRect.height));
    guideCanvas.width = cssWidth;
    guideCanvas.height = cssHeight;
    guideCanvas.style.width = `${cssWidth}px`;
    guideCanvas.style.height = `${cssHeight}px`;
    guideCanvas.style.left = `${canvasRect.left - surfaceRect.left + el.previewSurface.scrollLeft}px`;
    guideCanvas.style.top = `${canvasRect.top - surfaceRect.top + el.previewSurface.scrollTop}px`;
    const ctx = guideCanvas.getContext('2d');
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    const scaleX = cssWidth / Math.max(1, el.previewCanvas.width);
    const scaleY = cssHeight / Math.max(1, el.previewCanvas.height);

    if (showRulers) {
      ctx.fillStyle = 'rgba(7,13,22,.78)';
      ctx.fillRect(0, 0, cssWidth, 16);
      ctx.fillRect(0, 0, 16, cssHeight);
      ctx.strokeStyle = 'rgba(150,174,202,.55)';
      ctx.fillStyle = 'rgba(174,196,220,.78)';
      ctx.font = '8px ui-monospace, monospace';
      const pixelScale = Math.max(scaleX, scaleY);
      const step = pixelScale >= 5 ? 4 : pixelScale >= 2 ? 8 : 16;
      for (let x = 0; x <= el.previewCanvas.width; x += step) {
        const px = x * scaleX;
        ctx.beginPath(); ctx.moveTo(px, 7); ctx.lineTo(px, 16); ctx.stroke();
        if (x % (step * 2) === 0) ctx.fillText(String(x), px + 2, 7);
      }
      for (let y = 0; y <= el.previewCanvas.height; y += step) {
        const py = y * scaleY;
        ctx.beginPath(); ctx.moveTo(7, py); ctx.lineTo(16, py); ctx.stroke();
        if (y % (step * 2) === 0) { ctx.save(); ctx.translate(7, py + 2); ctx.rotate(-Math.PI / 2); ctx.fillText(String(y), 0, 0); ctx.restore(); }
      }
    }

    ctx.strokeStyle = 'rgba(55,194,255,.92)';
    ctx.lineWidth = 1;
    const gx = guideX * scaleX;
    const gy = guideY * scaleY;
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, cssHeight); ctx.stroke();
    ctx.strokeStyle = 'rgba(52,214,163,.92)';
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(cssWidth, gy); ctx.stroke();
  }

  function snapCurrentToGuides() {
    const frame = state.frames[state.currentIndex];
    if (!frame) return;
    const bounds = opaqueBounds(frame.canvas);
    if (!bounds) return;
    const size = normalizedSize();
    const offsetX = Math.floor((size.width - frame.canvas.width) / 2);
    const offsetY = size.height - frame.canvas.height;
    const centerX = bounds.x + bounds.width / 2 + offsetX;
    const centerY = bounds.y + bounds.height / 2 + offsetY;
    const dx = Math.round(guideX - centerX);
    const dy = Math.round(guideY - centerY);
    const out = document.createElement('canvas');
    out.width = frame.canvas.width;
    out.height = frame.canvas.height;
    get2d(out).drawImage(frame.canvas, dx, dy);
    frame.canvas = out;
    renderAll();
    toast(`Snapped frame by ${dx}px, ${dy}px`);
  }

  guideXInput.addEventListener('input', () => { guideX = Math.max(0, Number(guideXInput.value) || 0); updateGuideOverlay(); });
  guideYInput.addEventListener('input', () => { guideY = Math.max(0, Number(guideYInput.value) || 0); updateGuideOverlay(); });
  centerGuidesBtn.addEventListener('click', centerGuides);
  snapGuideBtn.addEventListener('click', snapCurrentToGuides);
  rulersInput.addEventListener('change', () => { showRulers = rulersInput.checked; updateGuideOverlay(); });
  el.previewSurface.addEventListener('scroll', updateGuideOverlay);
  window.addEventListener('resize', updateGuideOverlay);

  const fullscreenBtn = document.createElement('button');
  fullscreenBtn.className = 'btn';
  fullscreenBtn.textContent = 'Fullscreen';
  fullscreenBtn.title = 'Toggle fullscreen workspace';
  document.querySelector('.top-actions').append(fullscreenBtn);
  fullscreenBtn.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (error) {
      console.error(error);
      toast('Fullscreen is not available in this browser.', true);
    }
  });
  document.addEventListener('fullscreenchange', () => {
    document.body.classList.toggle('fullscreen-active', Boolean(document.fullscreenElement));
    fullscreenBtn.textContent = document.fullscreenElement ? 'Exit full' : 'Fullscreen';
    window.setTimeout(updateGuideOverlay, 60);
  });

  const framesObserver = new MutationObserver(() => {
    window.setTimeout(() => {
      updateSelectionClasses();
      if (!guideX && !guideY && state.frames.length) centerGuides();
      else updateGuideOverlay();
    }, 0);
  });
  framesObserver.observe(el.frames, { childList: true });

  updateSelectionClasses();
})();