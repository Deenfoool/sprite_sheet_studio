let objectSlicerInitialized = false;

function initObjectSlicer() {
  if (objectSlicerInitialized) return true;
  const smartPanel = document.querySelector('.smart-panel');
  const autoSliceButton = document.querySelector('#autoSliceBtn');
  const fileInput = document.querySelector('#fileInput');
  const uploadZone = document.querySelector('#uploadZone');
  const smartStatus = document.querySelector('#smartStatus');
  if (
    !(smartPanel instanceof HTMLElement) ||
    !(autoSliceButton instanceof HTMLButtonElement) ||
    !(fileInput instanceof HTMLInputElement) ||
    !(uploadZone instanceof HTMLElement) ||
    !(smartStatus instanceof HTMLElement)
  ) return false;
  objectSlicerInitialized = true;

  let originalSourceFile = null;
  let syntheticImport = false;

  const objectButton = document.createElement('button');
  objectButton.className = 'btn smart-action object-slice-action';
  objectButton.id = 'objectSliceBtn';
  objectButton.disabled = true;
  objectButton.innerHTML = '<span><b>Object Slice</b><small>detect irregular sprite objects</small></span><i>◫</i>';
  autoSliceButton.insertAdjacentElement('afterend', objectButton);

  const options = document.createElement('div');
  options.className = 'object-slice-options';
  options.innerHTML = `
    <label>Background tolerance
      <input type="range" min="8" max="120" value="42" data-object-tolerance />
      <span data-object-tolerance-value>42</span>
    </label>
    <label>Merge gap
      <input type="range" min="0" max="32" value="4" data-object-gap />
      <span data-object-gap-value>4px</span>
    </label>
    <div class="object-slice-actions">
      <button class="btn" type="button" data-object-restore disabled>Restore source sheet</button>
    </div>
  `;
  objectButton.insertAdjacentElement('afterend', options);

  const toleranceInput = options.querySelector('[data-object-tolerance]');
  const toleranceValue = options.querySelector('[data-object-tolerance-value]');
  const gapInput = options.querySelector('[data-object-gap]');
  const gapValue = options.querySelector('[data-object-gap-value]');
  const restoreButton = options.querySelector('[data-object-restore]');

  function isImage(file) {
    return file instanceof File && /^image\/(png|webp)$/i.test(file.type);
  }

  function rememberFiles(files) {
    if (syntheticImport) return;
    const images = Array.from(files || []).filter(isImage);
    originalSourceFile = images.length === 1 ? images[0] : null;
    objectButton.disabled = !originalSourceFile;
    if (restoreButton instanceof HTMLButtonElement) restoreButton.disabled = !originalSourceFile;
  }

  fileInput.addEventListener('change', () => rememberFiles(fileInput.files), true);
  uploadZone.addEventListener('drop', (event) => rememberFiles(event.dataTransfer?.files), true);
  document.addEventListener('paste', (event) => {
    const files = Array.from(event.clipboardData?.files || []).filter(isImage);
    if (files.length) rememberFiles(files);
  }, true);

  toleranceInput?.addEventListener('input', () => {
    if (toleranceValue) toleranceValue.textContent = toleranceInput.value;
  });
  gapInput?.addEventListener('input', () => {
    if (gapValue) gapValue.textContent = `${gapInput.value}px`;
  });

  function colorDistance(a, b) {
    const dr = a[0] - b[0];
    const dg = a[1] - b[1];
    const db = a[2] - b[2];
    const da = (a[3] - b[3]) * 0.5;
    return Math.sqrt(dr * dr + dg * dg + db * db + da * da);
  }

  function sampleBackground(data, width, height) {
    const samples = [];
    const radius = Math.max(1, Math.min(4, Math.floor(Math.min(width, height) / 20)));
    const points = [
      [0, 0],
      [Math.max(0, width - radius), 0],
      [0, Math.max(0, height - radius)],
      [Math.max(0, width - radius), Math.max(0, height - radius)]
    ];
    points.forEach(([sx, sy]) => {
      for (let y = sy; y < Math.min(height, sy + radius); y += 1) {
        for (let x = sx; x < Math.min(width, sx + radius); x += 1) {
          const offset = (y * width + x) * 4;
          samples.push([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]]);
        }
      }
    });
    const average = [0, 0, 0, 0];
    samples.forEach((sample) => sample.forEach((value, index) => { average[index] += value; }));
    return average.map((value) => Math.round(value / Math.max(1, samples.length)));
  }

  function boxesOverlapOrNear(a, b, gap) {
    const aLeft = a.minX - gap;
    const aTop = a.minY - gap;
    const aRight = a.maxX + gap;
    const aBottom = a.maxY + gap;
    return !(aRight < b.minX || b.maxX < aLeft || aBottom < b.minY || b.maxY < aTop);
  }

  function mergeBoxes(boxes, gap) {
    const merged = boxes.map((box) => ({ ...box }));
    let changed = true;
    while (changed) {
      changed = false;
      outer: for (let a = 0; a < merged.length; a += 1) {
        for (let b = a + 1; b < merged.length; b += 1) {
          if (!boxesOverlapOrNear(merged[a], merged[b], gap)) continue;
          merged[a] = {
            minX: Math.min(merged[a].minX, merged[b].minX),
            minY: Math.min(merged[a].minY, merged[b].minY),
            maxX: Math.max(merged[a].maxX, merged[b].maxX),
            maxY: Math.max(merged[a].maxY, merged[b].maxY),
            area: merged[a].area + merged[b].area
          };
          merged.splice(b, 1);
          changed = true;
          break outer;
        }
      }
    }
    return merged;
  }

  function connectedComponents(imageData, tolerance, mergeGap, scaleBack) {
    const { data, width, height } = imageData;
    const background = sampleBackground(data, width, height);
    const transparentBackground = background[3] < 32;
    const visited = new Uint8Array(width * height);
    const minArea = Math.max(3, Math.round(width * height * 0.00008));
    const components = [];

    function foreground(index) {
      const offset = index * 4;
      const alpha = data[offset + 3];
      if (transparentBackground) return alpha > 24;
      if (alpha < 12) return false;
      return colorDistance([data[offset], data[offset + 1], data[offset + 2], alpha], background) > tolerance;
    }

    const stack = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const start = y * width + x;
        if (visited[start] || !foreground(start)) continue;
        visited[start] = 1;
        stack.length = 0;
        stack.push(start);
        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        let area = 0;

        while (stack.length) {
          const current = stack.pop();
          const cx = current % width;
          const cy = Math.floor(current / width);
          area += 1;
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          for (let ny = Math.max(0, cy - 1); ny <= Math.min(height - 1, cy + 1); ny += 1) {
            for (let nx = Math.max(0, cx - 1); nx <= Math.min(width - 1, cx + 1); nx += 1) {
              const next = ny * width + nx;
              if (visited[next]) continue;
              visited[next] = 1;
              if (foreground(next)) stack.push(next);
            }
          }
        }

        if (area >= minArea) components.push({ minX, minY, maxX, maxY, area });
      }
    }

    const merged = mergeBoxes(components, Math.max(0, Math.round(mergeGap / scaleBack)));
    return merged
      .map((box) => ({
        x: Math.max(0, Math.floor(box.minX * scaleBack) - 1),
        y: Math.max(0, Math.floor(box.minY * scaleBack) - 1),
        width: Math.ceil((box.maxX - box.minX + 1) * scaleBack) + 2,
        height: Math.ceil((box.maxY - box.minY + 1) * scaleBack) + 2,
        area: box.area * scaleBack * scaleBack
      }))
      .sort((a, b) => {
        const rowTolerance = Math.max(4, Math.min(a.height, b.height) * 0.35);
        if (Math.abs(a.y - b.y) > rowTolerance) return a.y - b.y;
        return a.x - b.x;
      });
  }

  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create cropped PNG.')), 'image/png');
    });
  }

  async function detectObjects(file) {
    const bitmap = await createImageBitmap(file);
    try {
      const maxAnalysisPixels = 6_000_000;
      const scale = Math.min(1, Math.sqrt(maxAnalysisPixels / Math.max(1, bitmap.width * bitmap.height)));
      const analysisWidth = Math.max(1, Math.round(bitmap.width * scale));
      const analysisHeight = Math.max(1, Math.round(bitmap.height * scale));
      const analysisCanvas = document.createElement('canvas');
      analysisCanvas.width = analysisWidth;
      analysisCanvas.height = analysisHeight;
      const analysisCtx = analysisCanvas.getContext('2d', { willReadFrequently: true });
      if (!analysisCtx) throw new Error('Canvas 2D is unavailable.');
      analysisCtx.imageSmoothingEnabled = false;
      analysisCtx.drawImage(bitmap, 0, 0, analysisWidth, analysisHeight);
      const imageData = analysisCtx.getImageData(0, 0, analysisWidth, analysisHeight);
      const tolerance = Number(toleranceInput?.value || 42);
      const mergeGap = Number(gapInput?.value || 4);
      const boxes = connectedComponents(imageData, tolerance, mergeGap, 1 / scale)
        .map((box) => ({
          ...box,
          width: Math.min(bitmap.width - box.x, box.width),
          height: Math.min(bitmap.height - box.y, box.height)
        }))
        .filter((box) => box.width > 1 && box.height > 1);
      return { bitmap, boxes };
    } catch (error) {
      bitmap.close();
      throw error;
    }
  }

  async function importBoxes(file, bitmap, boxes) {
    const transfer = new DataTransfer();
    for (let index = 0; index < boxes.length; index += 1) {
      const box = boxes[index];
      const canvas = document.createElement('canvas');
      canvas.width = box.width;
      canvas.height = box.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(bitmap, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
      const blob = await canvasBlob(canvas);
      transfer.items.add(new File([blob], `object_${String(index + 1).padStart(3, '0')}.png`, { type: 'image/png' }));
    }
    if (!transfer.files.length) throw new Error('No usable object frames were produced.');
    syntheticImport = true;
    try {
      fileInput.files = transfer.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    } finally {
      syntheticImport = false;
    }
    smartStatus.innerHTML = `Object Slice found <b>${boxes.length}</b> irregular frame${boxes.length === 1 ? '' : 's'} from ${file.name}.`;
  }

  async function runObjectSlice() {
    if (!originalSourceFile) throw new Error('Load one PNG/WebP sprite sheet first.');
    const previous = objectButton.innerHTML;
    objectButton.disabled = true;
    objectButton.innerHTML = '<span><b>Object Slice…</b><small>scanning pixels</small></span><i>◌</i>';
    smartStatus.textContent = 'Scanning connected sprite objects locally…';
    let bitmap = null;
    try {
      const result = await detectObjects(originalSourceFile);
      bitmap = result.bitmap;
      if (!result.boxes.length) throw new Error('No foreground objects found. Adjust background tolerance.');
      if (result.boxes.length > 256) throw new Error(`Detected ${result.boxes.length} objects. Increase merge gap or tolerance before importing.`);
      await importBoxes(originalSourceFile, bitmap, result.boxes);
    } finally {
      bitmap?.close?.();
      objectButton.innerHTML = previous;
      objectButton.disabled = !originalSourceFile;
    }
  }

  objectButton.addEventListener('click', () => {
    runObjectSlice().catch((error) => {
      console.error(error);
      smartStatus.textContent = error instanceof Error ? error.message : 'Object Slice failed.';
    });
  });

  restoreButton?.addEventListener('click', () => {
    if (!originalSourceFile) return;
    const transfer = new DataTransfer();
    transfer.items.add(originalSourceFile);
    syntheticImport = true;
    try {
      fileInput.files = transfer.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    } finally {
      syntheticImport = false;
    }
    smartStatus.textContent = 'Original source sheet restored.';
  });

  return true;
}

if (!initObjectSlicer()) {
  const timer = window.setInterval(() => {
    if (!initObjectSlicer()) return;
    window.clearInterval(timer);
  }, 100);
  window.setTimeout(() => window.clearInterval(timer), 15000);
}
