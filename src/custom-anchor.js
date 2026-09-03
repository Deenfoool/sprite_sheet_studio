(() => {
  const option = document.createElement('option');
  option.value = 'custom';
  option.textContent = 'Custom per-frame point';
  el.anchor.append(option);

  const field = el.anchor.closest('.field');
  if (!field) return;

  const controls = document.createElement('div');
  controls.className = 'custom-anchor-controls';
  controls.innerHTML = `
    <button class="btn" id="customAnchorPickBtn" type="button">Pick anchor on preview</button>
    <button class="btn" id="customAnchorCopyBtn" type="button">Copy to all</button>
    <small id="customAnchorHint">Choose Custom, then click the sprite preview.</small>
  `;
  field.insertAdjacentElement('afterend', controls);

  const pickButton = controls.querySelector('#customAnchorPickBtn');
  const copyButton = controls.querySelector('#customAnchorCopyBtn');
  const hint = controls.querySelector('#customAnchorHint');
  let picking = false;

  function currentFrame() {
    return state.frames[state.currentIndex] || null;
  }

  function anchorFor(frame) {
    const anchor = frame?.customAnchor;
    if (anchor && Number.isFinite(anchor.u) && Number.isFinite(anchor.v)) return anchor;
    return { u: 0.5, v: 1 };
  }

  function describe(frame) {
    if (!frame) return 'No frame selected.';
    const anchor = anchorFor(frame);
    const x = Math.round(anchor.u * frame.canvas.width);
    const y = Math.round(anchor.v * frame.canvas.height);
    return `Frame ${state.currentIndex + 1}: anchor ${x}, ${y}`;
  }

  function updateUi() {
    const isCustom = el.anchor.value === 'custom';
    controls.hidden = !isCustom;
    pickButton.classList.toggle('primary', picking && isCustom);
    pickButton.textContent = picking ? 'Click preview…' : 'Pick anchor on preview';
    hint.textContent = isCustom ? describe(currentFrame()) : 'Choose Custom to use per-frame anchors.';
    if (isCustom) el.anchorInfo.textContent = 'Custom';
  }

  function drawMarker() {
    if (el.anchor.value !== 'custom' || !state.frames.length || el.previewCanvas.classList.contains('hidden')) return;
    const frame = currentFrame();
    if (!frame) return;
    const anchor = anchorFor(frame);
    const normalized = normalizedSize();
    const offsetX = Math.floor((normalized.width - frame.canvas.width) / 2);
    const offsetY = normalized.height - frame.canvas.height;
    const x = offsetX + anchor.u * frame.canvas.width;
    const y = offsetY + anchor.v * frame.canvas.height;
    const ctx = get2d(el.previewCanvas);
    ctx.save();
    ctx.strokeStyle = '#ffcf4a';
    ctx.fillStyle = '#ffcf4a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 5, y);
    ctx.lineTo(x + 5, y);
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x, y + 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const originalRenderPreview = renderPreview;
  renderPreview = function customAnchorRenderPreview() {
    originalRenderPreview();
    drawMarker();
    updateUi();
  };

  const originalRenderStats = renderStats;
  renderStats = function customAnchorRenderStats() {
    originalRenderStats();
    if (el.anchor.value === 'custom') el.anchorInfo.textContent = 'Custom';
    updateUi();
  };

  pickButton.addEventListener('click', () => {
    if (!state.frames.length) return toast('Load frames first.', true);
    picking = !picking;
    updateUi();
  });

  copyButton.addEventListener('click', () => {
    const frame = currentFrame();
    if (!frame) return;
    const source = anchorFor(frame);
    state.frames.forEach((item) => {
      item.customAnchor = { u: source.u, v: source.v };
    });
    picking = false;
    renderAll();
    globalThis.__SSSProject?.autosave?.();
    toast('Custom anchor copied to all frames');
  });

  el.previewCanvas.addEventListener('click', (event) => {
    if (!picking || el.anchor.value !== 'custom') return;
    const frame = currentFrame();
    if (!frame) return;

    const rect = el.previewCanvas.getBoundingClientRect();
    const scaleX = el.previewCanvas.width / Math.max(1, rect.width);
    const scaleY = el.previewCanvas.height / Math.max(1, rect.height);
    const px = (event.clientX - rect.left) * scaleX;
    const py = (event.clientY - rect.top) * scaleY;
    const normalized = normalizedSize();
    const offsetX = Math.floor((normalized.width - frame.canvas.width) / 2);
    const offsetY = normalized.height - frame.canvas.height;
    const localX = Math.max(0, Math.min(frame.canvas.width, px - offsetX));
    const localY = Math.max(0, Math.min(frame.canvas.height, py - offsetY));
    frame.customAnchor = {
      u: localX / Math.max(1, frame.canvas.width),
      v: localY / Math.max(1, frame.canvas.height)
    };
    picking = false;
    renderAll();
    globalThis.__SSSProject?.autosave?.();
    toast(`Anchor set for frame ${state.currentIndex + 1}`);
  });

  function alignByCustomAnchors() {
    if (!state.frames.length) return;
    stopPlayback();

    const anchors = state.frames.map((frame) => {
      const anchor = anchorFor(frame);
      return {
        x: anchor.u * frame.canvas.width,
        y: anchor.v * frame.canvas.height
      };
    });
    const left = Math.ceil(Math.max(...anchors.map((anchor) => anchor.x)));
    const right = Math.ceil(Math.max(...state.frames.map((frame, index) => frame.canvas.width - anchors[index].x)));
    const top = Math.ceil(Math.max(...anchors.map((anchor) => anchor.y)));
    const bottom = Math.ceil(Math.max(...state.frames.map((frame, index) => frame.canvas.height - anchors[index].y)));
    const width = Math.max(1, left + right);
    const height = Math.max(1, top + bottom);

    state.frames = state.frames.map((frame, index) => {
      const out = createCanvas(width, height);
      const x = Math.round(left - anchors[index].x);
      const y = Math.round(top - anchors[index].y);
      get2d(out).drawImage(frame.canvas, x, y);
      const alignedAnchor = { u: left / width, v: top / height };
      return { ...frame, canvas: out, customAnchor: alignedAnchor };
    });

    picking = false;
    renderAll();
    el.smartStatus.innerHTML = `Aligned ${state.frames.length} frames by <b>custom anchors</b> · ${width}×${height}`;
    globalThis.__SSSProject?.autosave?.();
    toast('Frames aligned by custom anchors');
  }

  el.align.addEventListener('click', (event) => {
    if (el.anchor.value !== 'custom') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    alignByCustomAnchors();
  }, true);

  el.anchor.addEventListener('change', () => {
    picking = false;
    if (el.anchor.value === 'custom') {
      state.anchorMode = 'custom';
      el.anchorInfo.textContent = 'Custom';
      el.smartStatus.textContent = 'Set an anchor on each frame, then press Auto Align.';
    }
    renderPreview();
  });

  controls.hidden = true;
})();
