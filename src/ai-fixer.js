(() => {
  let tolerance = 28;
  let diagnostics = null;
  const MASK_SIZE = 24;
  const SIGNATURE_SIZE = 12;
  const MAX_HEATMAP_FRAMES = 64;

  function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function visualSignature(canvas, bounds, size = SIGNATURE_SIZE) {
    const out = document.createElement('canvas');
    out.width = size;
    out.height = size;
    const ctx = get2d(out);
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = true;
    if (bounds) {
      ctx.drawImage(
        canvas,
        bounds.x,
        bounds.y,
        Math.max(1, bounds.width),
        Math.max(1, bounds.height),
        0,
        0,
        size,
        size
      );
    }
    return new Uint8Array(ctx.getImageData(0, 0, size, size).data);
  }

  function metricForFrame(frame, maskSize = MASK_SIZE) {
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

    const area = (bounds?.width || 0) * (bounds?.height || 0);
    return {
      bounds,
      width: bounds?.width || 0,
      height: bounds?.height || 0,
      area,
      opaque,
      occupancy: area ? opaque / area : 0,
      centroidX: opaque ? sx / opaque : canvas.width / 2,
      centroidY: opaque ? sy / opaque : canvas.height / 2,
      mask,
      signature: visualSignature(canvas, bounds)
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

  function signatureSimilarity(a, b) {
    const length = Math.min(a.length, b.length);
    if (!length) return 1;
    let difference = 0;
    let weight = 0;
    for (let i = 0; i + 3 < length; i += 4) {
      const alphaA = a[i + 3] / 255;
      const alphaB = b[i + 3] / 255;
      const alphaWeight = Math.max(.18, alphaA, alphaB);
      difference += Math.abs(a[i] - b[i]) * alphaWeight;
      difference += Math.abs(a[i + 1] - b[i + 1]) * alphaWeight;
      difference += Math.abs(a[i + 2] - b[i + 2]) * alphaWeight;
      difference += Math.abs(a[i + 3] - b[i + 3]) * .8;
      weight += 255 * (3 * alphaWeight + .8);
    }
    return weight ? Math.max(0, Math.min(1, 1 - difference / weight)) : 1;
  }

  function ratioSimilarity(a, b) {
    if (!a && !b) return 1;
    if (!a || !b) return 0;
    return Math.min(a, b) / Math.max(a, b);
  }

  function frameSimilarity(a, b) {
    if (!a.bounds && !b.bounds) return 1;
    if (!a.bounds || !b.bounds) return 0;
    const shape = maskIoU(a.mask, b.mask);
    const visual = signatureSimilarity(a.signature, b.signature);
    const width = ratioSimilarity(a.width, b.width);
    const height = ratioSimilarity(a.height, b.height);
    const occupancy = 1 - Math.min(1, Math.abs(a.occupancy - b.occupancy));
    return Math.max(0, Math.min(1,
      visual * .48 +
      shape * .32 +
      ((width + height) / 2) * .12 +
      occupancy * .08
    ));
  }

  function buildSimilarityMatrix(metrics) {
    const count = metrics.length;
    const matrix = Array.from({ length: count }, () => new Float32Array(count));
    for (let row = 0; row < count; row += 1) {
      matrix[row][row] = 1;
      for (let col = row + 1; col < count; col += 1) {
        const score = frameSimilarity(metrics[row], metrics[col]);
        matrix[row][col] = score;
        matrix[col][row] = score;
      }
    }
    return matrix;
  }

  function detectDuplicatePairs(matrix) {
    const pairs = [];
    for (let first = 0; first < matrix.length; first += 1) {
      for (let second = first + 1; second < matrix.length; second += 1) {
        const score = matrix[first][second];
        if (score >= .985) pairs.push({ first, second, score });
      }
    }
    return pairs.sort((a, b) => b.score - a.score).slice(0, 48);
  }

  function analyzeFrames() {
    if (!state.frames.length) {
      diagnostics = null;
      renderReport();
      renderHeatmap();
      return toast('Load frames before running diagnostics.', true);
    }

    const metrics = state.frames.map(metricForFrame);
    const widths = metrics.filter((m) => m.width).map((m) => m.width);
    const heights = metrics.filter((m) => m.height).map((m) => m.height);
    const occupancies = metrics.filter((m) => m.bounds).map((m) => m.occupancy);
    const medianWidth = median(widths) || 1;
    const medianHeight = median(heights) || 1;
    const medianOccupancy = median(occupancies) || 0;
    const sizeOutliers = [];
    const severeSizeOutliers = [];
    const silhouetteOutliers = [];
    const emptyFrames = [];
    const adjacentScores = [];
    const matrix = buildSimilarityMatrix(metrics);

    metrics.forEach((metric, index) => {
      if (!metric.bounds) emptyFrames.push(index);
      const widthDiff = Math.abs(metric.width - medianWidth) / medianWidth;
      const heightDiff = Math.abs(metric.height - medianHeight) / medianHeight;
      if (widthDiff > .25 || heightDiff > .25) sizeOutliers.push(index);
      if (widthDiff > .48 || heightDiff > .48) severeSizeOutliers.push(index);
      if (index > 0) {
        const score = matrix[index - 1][index];
        adjacentScores.push(score);
        if (score < .38) silhouetteOutliers.push(index);
      }
    });

    const duplicatePairs = detectDuplicatePairs(matrix);
    const duplicateFrames = [...new Set(duplicatePairs.flatMap((pair) => [pair.first, pair.second]))].sort((a, b) => a - b);
    const brokenSet = new Set([...emptyFrames, ...severeSizeOutliers]);

    metrics.forEach((metric, index) => {
      if (!metric.bounds || state.frames.length < 3) return;
      const previous = index > 0 ? matrix[index][index - 1] : null;
      const next = index < metrics.length - 1 ? matrix[index][index + 1] : null;
      const isolated = previous !== null && next !== null && previous < .34 && next < .34;
      const occupancyJump = medianOccupancy > .05 && Math.abs(metric.occupancy - medianOccupancy) / medianOccupancy > .7;
      if (isolated || occupancyJump) brokenSet.add(index);
    });

    const brokenFrames = [...brokenSet].sort((a, b) => a - b);
    const loopSimilarity = state.frames.length > 1 ? matrix[0][metrics.length - 1] : 1;
    const centroidDistance = state.frames.length > 1
      ? Math.hypot(metrics[0].centroidX - metrics[metrics.length - 1].centroidX, metrics[0].centroidY - metrics[metrics.length - 1].centroidY)
      : 0;
    const normalizedCentroid = centroidDistance / Math.max(1, medianWidth, medianHeight);
    const avgAdjacent = adjacentScores.length ? adjacentScores.reduce((a, b) => a + b, 0) / adjacentScores.length : 1;
    const loopScore = Math.max(0, Math.min(1, loopSimilarity * .78 + Math.max(0, 1 - normalizedCentroid) * .22));
    const recommendPingPong = state.frames.length >= 3 && loopScore < .58 && avgAdjacent >= .45;

    diagnostics = {
      metrics,
      matrix,
      medianWidth,
      medianHeight,
      sizeOutliers,
      severeSizeOutliers,
      silhouetteOutliers,
      emptyFrames,
      duplicatePairs,
      duplicateFrames,
      brokenFrames,
      loopSimilarity,
      loopScore,
      avgAdjacent,
      recommendPingPong
    };

    applyDiagnosticMarks();
    renderReport();
    renderHeatmap();
    toast('Sprite diagnostics complete');
  }

  function applyDiagnosticMarks() {
    const cards = [...el.frames.querySelectorAll('.frame-card')];
    const issues = cards.map(() => []);
    cards.forEach((card) => {
      card.classList.remove('diagnostic-warning', 'diagnostic-error', 'diagnostic-duplicate');
      card.removeAttribute('data-diagnostic');
      card.removeAttribute('title');
    });
    if (!diagnostics) return;

    diagnostics.emptyFrames.forEach((index) => issues[index]?.push('empty / fully transparent'));
    diagnostics.brokenFrames.forEach((index) => issues[index]?.push('broken / isolated frame suspect'));
    diagnostics.silhouetteOutliers.forEach((index) => issues[index]?.push('sharp silhouette jump'));
    diagnostics.sizeOutliers.forEach((index) => issues[index]?.push('size differs from median'));
    diagnostics.duplicateFrames.forEach((index) => issues[index]?.push('probable duplicate'));

    cards.forEach((card, index) => {
      const frameIssues = [...new Set(issues[index])];
      if (!frameIssues.length) return;
      const isError = diagnostics.emptyFrames.includes(index) || diagnostics.brokenFrames.includes(index) || diagnostics.silhouetteOutliers.includes(index);
      if (isError) card.classList.add('diagnostic-error');
      else if (diagnostics.duplicateFrames.includes(index)) card.classList.add('diagnostic-duplicate');
      else card.classList.add('diagnostic-warning');
      card.dataset.diagnostic = frameIssues.join(' · ');
      card.title = `Diagnostic: ${frameIssues.join(' · ')}`;
    });
  }

  function reportClass(good, warn) {
    if (good) return 'good';
    if (warn) return 'warn';
    return 'bad';
  }

  function duplicateSummary() {
    if (!diagnostics?.duplicatePairs.length) return 'none detected';
    const strongest = diagnostics.duplicatePairs[0];
    return `${diagnostics.duplicatePairs.length} pair(s) · best ${Math.round(strongest.score * 100)}%`;
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
      <div class="ai-report-row ${diagnostics.duplicatePairs.length ? 'warn' : 'good'}" data-ai-duplicates><span>Duplicate frames</span><b>${duplicateSummary()}</b></div>
      <div class="ai-report-row ${diagnostics.brokenFrames.length ? 'bad' : 'good'}" data-ai-broken><span>Broken-frame suspects</span><b>${diagnostics.brokenFrames.length ? `${diagnostics.brokenFrames.length} frame(s)` : 'none detected'}</b></div>
      <div class="ai-report-row ${reportClass(diagnostics.loopScore >= .72, diagnostics.loopScore >= .55)}"><span>Loop quality</span><b>${loopPercent}%</b></div>
      <div class="ai-report-row ${diagnostics.recommendPingPong ? 'warn' : 'good'}"><span>Sequence suggestion</span><b>${diagnostics.recommendPingPong ? 'try ping-pong' : 'normal loop is plausible'}</b></div>`;
    pingPongBtn.disabled = !diagnostics.recommendPingPong;
  }

  function heatColor(score) {
    const value = Math.max(0, Math.min(1, score));
    const hue = 5 + value * 145;
    const light = 20 + value * 34;
    return `hsl(${hue} 68% ${light}%)`;
  }

  function heatmapDisplayIndices() {
    const count = diagnostics?.matrix?.length || 0;
    if (count <= MAX_HEATMAP_FRAMES) return Array.from({ length: count }, (_, index) => index);
    return Array.from({ length: MAX_HEATMAP_FRAMES }, (_, index) => Math.min(count - 1, Math.floor(index * count / MAX_HEATMAP_FRAMES)));
  }

  function renderHeatmap() {
    if (!heatmapWrap || !(heatmapCanvas instanceof HTMLCanvasElement)) return;
    if (!diagnostics?.matrix?.length) {
      heatmapWrap.hidden = true;
      return;
    }
    heatmapWrap.hidden = false;
    const indices = heatmapDisplayIndices();
    const cells = indices.length;
    const cell = cells <= 16 ? 12 : cells <= 32 ? 7 : 4;
    heatmapCanvas.width = Math.max(1, cells * cell);
    heatmapCanvas.height = Math.max(1, cells * cell);
    heatmapCanvas.dataset.cells = String(cells);
    heatmapCanvas.dataset.indices = indices.join(',');
    const ctx = get2d(heatmapCanvas);
    ctx.clearRect(0, 0, heatmapCanvas.width, heatmapCanvas.height);
    for (let row = 0; row < cells; row += 1) {
      for (let col = 0; col < cells; col += 1) {
        const score = diagnostics.matrix[indices[row]][indices[col]];
        ctx.fillStyle = heatColor(score);
        ctx.fillRect(col * cell, row * cell, cell, cell);
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(.5, .5, heatmapCanvas.width - 1, heatmapCanvas.height - 1);
    heatmapStatus.textContent = `${diagnostics.matrix.length} frames · green = similar · red = different`;
  }

  function heatmapCell(event) {
    if (!diagnostics || !(heatmapCanvas instanceof HTMLCanvasElement)) return null;
    const indices = (heatmapCanvas.dataset.indices || '').split(',').map(Number).filter(Number.isFinite);
    if (!indices.length) return null;
    const rect = heatmapCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const col = Math.max(0, Math.min(indices.length - 1, Math.floor(((event.clientX - rect.left) / rect.width) * indices.length)));
    const row = Math.max(0, Math.min(indices.length - 1, Math.floor(((event.clientY - rect.top) / rect.height) * indices.length)));
    const first = indices[row];
    const second = indices[col];
    return { first, second, score: diagnostics.matrix[first][second] };
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
    <div class="ai-heatmap" id="aiHeatmap" hidden>
      <div class="ai-heatmap-head"><span>Similarity heatmap</span><small id="aiHeatmapStatus">Analyze frames to compare them.</small></div>
      <canvas id="aiSimilarityHeatmap" aria-label="Frame similarity heatmap"></canvas>
    </div>
    <button class="btn" id="aiPingPong" style="width:100%;margin-top:7px" disabled>Apply ping-pong suggestion</button>`;
  smartPanel.append(box);

  const analyzeBtn = box.querySelector('#aiAnalyze');
  const autoFixBtn = box.querySelector('#aiAutoFix');
  const toleranceInput = box.querySelector('#aiTolerance');
  const toleranceNumber = box.querySelector('#aiToleranceNumber');
  const note = box.querySelector('#aiFixerNote');
  const report = box.querySelector('#aiReport');
  const pingPongBtn = box.querySelector('#aiPingPong');
  const heatmapWrap = box.querySelector('#aiHeatmap');
  const heatmapCanvas = box.querySelector('#aiSimilarityHeatmap');
  const heatmapStatus = box.querySelector('#aiHeatmapStatus');

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

  heatmapCanvas?.addEventListener('mousemove', (event) => {
    const cell = heatmapCell(event);
    if (!cell) return;
    heatmapStatus.textContent = `Frame ${cell.first + 1} ↔ ${cell.second + 1}: ${Math.round(cell.score * 100)}% similar`;
  });
  heatmapCanvas?.addEventListener('mouseleave', () => {
    if (diagnostics) heatmapStatus.textContent = `${diagnostics.matrix.length} frames · green = similar · red = different`;
  });
  heatmapCanvas?.addEventListener('click', (event) => {
    const cell = heatmapCell(event);
    if (!cell) return;
    const cards = [...el.frames.querySelectorAll('.frame-card')];
    const card = cards[cell.first];
    if (card instanceof HTMLElement) card.click();
  });

  const observer = new MutationObserver(() => {
    if (diagnostics) window.setTimeout(() => {
      applyDiagnosticMarks();
      renderHeatmap();
    }, 0);
  });
  observer.observe(el.frames, { childList: true });

  globalThis.__SSSAIFixer = {
    analyze: analyzeFrames,
    diagnostics: () => diagnostics,
    similarity: (first, second) => diagnostics?.matrix?.[first]?.[second] ?? null
  };
})();