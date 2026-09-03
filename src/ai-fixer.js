(() => {
  let tolerance = 28;
  let diagnostics = null;

  function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function metricForFrame(frame, maskSize = 24) {
    const canvas = frame.canvas;
    const ctx = get2d(canvas);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const bounds = opaqueBounds(canvas);
    const mask = new Uint8Array(maskSize * maskSize);
    let opaque = 0;
    let sx = 0;
    let sy = 0;

    if (bounds) {
      for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
        for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) {
          const alpha = data[(y * canvas.width + x) * 4 + 3];
          if (alpha < 8) continue;
          opaque += 1;
          sx += x + .5;
          sy += y + .5;
          const nx = Math.min(maskSize - 1, Math.floor(((x - bounds.x) / Math.max(1, bounds.width)) * maskSize));
          const ny = Math.min(maskSize - 1, Math.floor(((y - bounds.y) / Math.max(1, bounds.height)) * maskSize));
          mask[ny * maskSize + nx] = 1;
        }
      }
    }

    return {
      bounds,
      width: bounds?.width || 0,
      height: bounds?.height || 0,
      area: (bounds?.width || 0) * (bounds?.height || 0),
      opaque,
      centroidX: opaque ? sx / opaque : canvas.width / 2,
      centroidY: opaque ? sy / opaque : canvas.height / 2,
      mask
    };
  }

  function maskIoU(a, b) {
    let intersection = 0;
    let union = 0;
    const length = Math.min(a.length, b.length);
    for (let i = 0; i < length; i += 1) {
      if (a[i] || b[i]) union += 1;
      if (a[i] && b[i]) intersection += 1;
    }
    return union ? intersection / union : 1;
  }

  function analyzeFrames() {
    if (!state.frames.length) {
      diagnostics = null;
      renderReport();
      return toast('Load frames before running diagnostics.', true);
    }

    const metrics = state.frames.map(metricForFrame);
    const widths = metrics.filter((m) => m.width).map((m) => m.width);
    const heights = metrics.filter((m) => m.height).map((m) => m.height);
    const medianWidth = median(widths) || 1;
    const medianHeight = median(heights) || 1;
    const sizeOutliers = [];
    const silhouetteOutliers = [];
    const emptyFrames = [];
    const adjacentScores = [];

    metrics.forEach((metric, index) => {
      if (!metric.bounds) emptyFrames.push(index);
      const widthDiff = Math.abs(metric.width - medianWidth) / medianWidth;
      const heightDiff = Math.abs(metric.height - medianHeight) / medianHeight;
      if (widthDiff > .25 || heightDiff > .25) sizeOutliers.push(index);
      if (index > 0) {
        const score = maskIoU(metrics[index - 1].mask, metric.mask);
        adjacentScores.push(score);
        if (score < .38) silhouetteOutliers.push(index);
      }
    });

    const loopIoU = state.frames.length > 1 ? maskIoU(metrics[0].mask, metrics[metrics.length - 1].mask) : 1;
    const centroidDistance = state.frames.length > 1
      ? Math.hypot(metrics[0].centroidX - metrics[metrics.length - 1].centroidX, metrics[0].centroidY - metrics[metrics.length - 1].centroidY)
      : 0;
    const normalizedCentroid = centroidDistance / Math.max(1, medianWidth, medianHeight);
    const avgAdjacent = adjacentScores.length ? adjacentScores.reduce((a, b) => a + b, 0) / adjacentScores.length : 1;
    const loopScore = Math.max(0, Math.min(1, loopIoU * .75 + Math.max(0, 1 - normalizedCentroid) * .25));
    const recommendPingPong = state.frames.length >= 3 && loopScore < .58 && avgAdjacent >= .45;

    diagnostics = {
      metrics,
      medianWidth,
      medianHeight,
      sizeOutliers,
      silhouetteOutliers,
      emptyFrames,
      loopIoU,
      loopScore,
      avgAdjacent,
      recommendPingPong
    };

    applyDiagnosticMarks();
    renderReport();
    toast('Sprite diagnostics complete');
  }

  function applyDiagnosticMarks() {
    const cards = [...el.frames.querySelectorAll('.frame-card')];
    cards.forEach((card) => {
      card.classList.remove('diagnostic-warning', 'diagnostic-error');
      card.removeAttribute('data-diagnostic');
    });
    if (!diagnostics) return;

    diagnostics.emptyFrames.forEach((index) => {
      const card = cards[index];
      if (!card) return;
      card.classList.add('diagnostic-error');
      card.title = 'Diagnostic: empty / fully transparent frame';
    });
    diagnostics.silhouetteOutliers.forEach((index) => {
      const card = cards[index];
      if (!card) return;
      card.classList.add('diagnostic-error');
      card.title = 'Diagnostic: silhouette changes sharply from the previous frame';
    });
    diagnostics.sizeOutliers.forEach((index) => {
      const card = cards[index];
      if (!card || card.classList.contains('diagnostic-error')) return;
      card.classList.add('diagnostic-warning');
      card.title = 'Diagnostic: character size differs significantly from the animation median';
    });
  }

  function reportClass(good, warn) {
    if (good) return 'good';
    if (warn) return 'warn';
    return 'bad';
  }

  function renderReport() {
    if (!diagnostics) {
      report.innerHTML = '<div class="ai-report-row"><span>Status</span><b>Not analyzed</b></div>';
      pingPongBtn.disabled = true;
      return;
    }
    const loopPercent = Math.round(diagnostics.loopScore * 100);
    const silhouettePercent = Math.round(diagnostics.avgAdjacent * 100);
    report.innerHTML = `
      <div class="ai-report-row ${reportClass(!diagnostics.sizeOutliers.length, diagnostics.sizeOutliers.length <= 1)}"><span>Size consistency</span><b>${diagnostics.sizeOutliers.length ? `${diagnostics.sizeOutliers.length} outlier frame(s)` : 'stable'}</b></div>
      <div class="ai-report-row ${reportClass(!diagnostics.silhouetteOutliers.length, diagnostics.silhouetteOutliers.length <= 1)}"><span>Silhouette continuity</span><b>${silhouettePercent}% · ${diagnostics.silhouetteOutliers.length} suspect</b></div>
      <div class="ai-report-row ${reportClass(diagnostics.loopScore >= .72, diagnostics.loopScore >= .55)}"><span>Loop quality</span><b>${loopPercent}%</b></div>
      <div class="ai-report-row ${diagnostics.recommendPingPong ? 'warn' : 'good'}"><span>Sequence suggestion</span><b>${diagnostics.recommendPingPong ? 'try ping-pong' : 'normal loop is plausible'}</b></div>`;
    pingPongBtn.disabled = !diagnostics.recommendPingPong;
  }

  function cornerColor(canvas) {
    const ctx = get2d(canvas);
    const points = [
      [0, 0],
      [Math.max(0, canvas.width - 1), 0],
      [0, Math.max(0, canvas.height - 1)],
      [Math.max(0, canvas.width - 1), Math.max(0, canvas.height - 1)]
    ];
    const colors = points.map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data]);
    if (colors.filter((color) => color[3] >= 220).length < 3) return null;
    const avg = [0, 1, 2].map((channel) => Math.round(colors.reduce((sum, color) => sum + color[channel], 0) / colors.length));
    const maxDistance = Math.max(...colors.map((color) => Math.hypot(color[0] - avg[0], color[1] - avg[1], color[2] - avg[2])));
    if (maxDistance > Math.max(24, tolerance * 1.6)) return null;
    return avg;
  }

  function removeColor(canvas, target) {
    const ctx = get2d(canvas);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;
    const threshold = tolerance * Math.sqrt(3);
    for (let i = 0; i < data.length; i += 4) {
      const distance = Math.hypot(data[i] - target[0], data[i + 1] - target[1], data[i + 2] - target[2]);
      if (distance <= threshold) data[i + 3] = 0;
    }
    ctx.putImageData(image, 0, 0);
  }

  async function removeSolidBackground() {
    let changed = 0;
    if (state.source) {
      const canvas = document.createElement('canvas');
      canvas.width = state.source.width;
      canvas.height = state.source.height;
      get2d(canvas).drawImage(state.source, 0, 0);
      const target = cornerColor(canvas);
      if (target) {
        removeColor(canvas, target);
        state.source.close?.();
        state.source = await createImageBitmap(canvas);
        changed += 1;
        drawSourceWithGrid();
      }
    } else {
      state.frames.forEach((frame) => {
        const target = cornerColor(frame.canvas);
        if (!target) return;
        removeColor(frame.canvas, target);
        changed += 1;
      });
      if (changed) renderAll();
    }
    if (!changed) {
      setFixerNote('No safe uniform corner background detected. Nothing was removed.', false);
      return false;
    }
    setFixerNote(`Removed a uniform corner background using tolerance ${tolerance}.`, true);
    toast('Solid background removed');
    return true;
  }

  async function autoFix() {
    if (!state.source && !state.frames.length) return toast('Load a sprite sheet first.', true);
    autoFixBtn.disabled = true;
    analyzeBtn.disabled = true;
    setFixerNote('Running local cleanup…', true);
    try {
      const removed = await removeSolidBackground();
      if (state.source && removed) autoSliceSource();
      if (state.frames.length) {
        trimAllFrames();
        alignAllFrames();
      }
      analyzeFrames();
      setFixerNote('Cleanup complete: background → slice → trim → align → diagnostics.', true);
    } catch (error) {
      console.error(error);
      setFixerNote('Auto Fix failed. The original project remains available through Undo.', false);
      toast('AI sprite cleanup failed.', true);
    } finally {
      autoFixBtn.disabled = false;
      analyzeBtn.disabled = false;
    }
  }

  function setFixerNote(text, positive) {
    note.textContent = text;
    note.style.color = positive ? '#6fae9d' : '#7d7183';
  }

  const smartPanel = document.querySelector('.smart-panel');
  const box = document.createElement('div');
  box.className = 'ai-fixer-box';
  box.innerHTML = `
    <div class="section-head"><h2 class="section-title">AI Sprite Fixer</h2><span class="section-note">local diagnostics</span></div>
    <div class="ai-fixer-actions"><button class="btn" id="aiAnalyze">Analyze frames</button><button class="btn green" id="aiAutoFix">Auto Fix</button></div>
    <div class="ai-tolerance-line"><input id="aiTolerance" type="range" min="4" max="80" value="28" /><input class="control" id="aiToleranceNumber" type="number" min="4" max="80" value="28" /></div>
    <div class="ai-fixer-note" id="aiFixerNote">Tolerance controls solid-corner background removal. Lower values are safer.</div>
    <div class="ai-report" id="aiReport"><div class="ai-report-row"><span>Status</span><b>Not analyzed</b></div></div>
    <button class="btn" id="aiPingPong" style="width:100%;margin-top:7px" disabled>Apply ping-pong suggestion</button>`;
  smartPanel.append(box);

  const analyzeBtn = box.querySelector('#aiAnalyze');
  const autoFixBtn = box.querySelector('#aiAutoFix');
  const toleranceInput = box.querySelector('#aiTolerance');
  const toleranceNumber = box.querySelector('#aiToleranceNumber');
  const note = box.querySelector('#aiFixerNote');
  const report = box.querySelector('#aiReport');
  const pingPongBtn = box.querySelector('#aiPingPong');

  analyzeBtn.addEventListener('click', analyzeFrames);
  autoFixBtn.addEventListener('click', () => void autoFix());
  toleranceInput.addEventListener('input', () => {
    tolerance = Number(toleranceInput.value) || 28;
    toleranceNumber.value = String(tolerance);
  });
  toleranceNumber.addEventListener('change', () => {
    tolerance = Math.max(4, Math.min(80, Number(toleranceNumber.value) || 28));
    toleranceNumber.value = String(tolerance);
    toleranceInput.value = String(tolerance);
  });
  pingPongBtn.addEventListener('click', () => {
    state.pingPong = true;
    state.loop = true;
    el.pingPong.checked = true;
    el.loop.checked = true;
    renderStats();
    toast('Ping-pong playback enabled');
  });

  const observer = new MutationObserver(() => {
    if (diagnostics) window.setTimeout(applyDiagnosticMarks, 0);
  });
  observer.observe(el.frames, { childList: true });
})();