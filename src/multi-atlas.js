(() => {
  const projectApi = globalThis.__SSSProject;
  if (!projectApi) return;

  const MAX_DIMENSION = 8192;
  const MAX_PIXELS = 32 * 1024 * 1024;

  function safeName(value) {
    return String(value || 'sprite-project').trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'sprite-project';
  }

  function collect(runtime) {
    const entries = [];
    let cellWidth = 1;
    let cellHeight = 1;
    runtime.animations.forEach(([animationName, animation]) => {
      animation.frames.forEach((frame, index) => {
        entries.push({ animationName, animation, frame, index });
        cellWidth = Math.max(cellWidth, frame.canvas.width);
        cellHeight = Math.max(cellHeight, frame.canvas.height);
      });
    });
    return { entries, cellWidth, cellHeight };
  }

  function pageLayout(cellWidth, cellHeight) {
    if (cellWidth > MAX_DIMENSION || cellHeight > MAX_DIMENSION) return null;
    const maxCols = Math.max(1, Math.floor(MAX_DIMENSION / cellWidth));
    const maxRows = Math.max(1, Math.floor(MAX_DIMENSION / cellHeight));
    const cellPixels = cellWidth * cellHeight;
    if (cellPixels > MAX_PIXELS) return null;

    let best = { cols: 1, rows: 1, capacity: 1 };
    for (let cols = 1; cols <= maxCols; cols += 1) {
      const rowsByPixels = Math.max(1, Math.floor(MAX_PIXELS / (cellPixels * cols)));
      const rows = Math.min(maxRows, rowsByPixels);
      const capacity = cols * rows;
      if (capacity > best.capacity) best = { cols, rows, capacity };
    }
    return best;
  }

  async function exportMultiAtlas() {
    const runtime = projectApi.runtime();
    const { entries, cellWidth, cellHeight } = collect(runtime);
    if (!entries.length) return toast('The project has no frames to export.', true);

    const layout = pageLayout(cellWidth, cellHeight);
    if (!layout) {
      return toast(`Frame cell ${cellWidth}×${cellHeight} is too large for the safe multi-atlas budget.`, true);
    }

    const pageCount = Math.ceil(entries.length / layout.capacity);
    const files = {};
    const manifest = {
      app: 'Sprite Sheet Studio',
      version: 1,
      project: runtime.name,
      cell: { width: cellWidth, height: cellHeight },
      limits: { maxDimension: MAX_DIMENSION, maxPixelsPerPage: MAX_PIXELS },
      pages: [],
      frames: {},
      animations: {}
    };

    runtime.animations.forEach(([name, animation]) => {
      manifest.animations[name] = {
        fps: animation.fps,
        loop: animation.loop,
        pingPong: animation.pingPong,
        frames: []
      };
    });

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const start = pageIndex * layout.capacity;
      const pageEntries = entries.slice(start, start + layout.capacity);
      const usedCols = Math.min(layout.cols, Math.max(1, pageEntries.length));
      const usedRows = Math.ceil(pageEntries.length / usedCols);
      const width = usedCols * cellWidth;
      const height = usedRows * cellHeight;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = get2d(canvas);
      const pageName = `atlas-${String(pageIndex + 1).padStart(3, '0')}.png`;
      const pageMeta = {
        index: pageIndex,
        image: pageName,
        width,
        height,
        columns: usedCols,
        rows: usedRows,
        frameCount: pageEntries.length
      };
      manifest.pages.push(pageMeta);

      pageEntries.forEach((entry, localIndex) => {
        const col = localIndex % usedCols;
        const row = Math.floor(localIndex / usedCols);
        const x = col * cellWidth;
        const y = row * cellHeight;
        const ox = x + Math.floor((cellWidth - entry.frame.canvas.width) / 2);
        const oy = y + cellHeight - entry.frame.canvas.height;
        ctx.drawImage(entry.frame.canvas, ox, oy);

        const frameName = `${safeName(entry.animationName)}/${String(entry.index + 1).padStart(3, '0')}`;
        const durationMs = Math.round((1000 / Math.max(1, entry.animation.fps || 8)) * Math.max(1, entry.frame.hold || 1));
        manifest.frames[frameName] = {
          page: pageIndex,
          image: pageName,
          frame: { x, y, w: cellWidth, h: cellHeight },
          sourceSize: { w: entry.frame.canvas.width, h: entry.frame.canvas.height },
          spriteOffset: { x: ox - x, y: oy - y },
          durationMs,
          hold: Math.max(1, entry.frame.hold || 1),
          customAnchor: entry.frame.customAnchor ? { ...entry.frame.customAnchor } : null
        };
        manifest.animations[entry.animationName].frames.push(frameName);
      });

      const png = await canvasToBlob(canvas);
      files[pageName] = new Uint8Array(await png.arrayBuffer());
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    files['atlas.json'] = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
    files['README.txt'] = new TextEncoder().encode(
      `Sprite Sheet Studio paged atlas\nPages: ${pageCount}\nCell: ${cellWidth}x${cellHeight}\nSee atlas.json for frame-to-page mapping and animation metadata.\n`
    );

    downloadBlob(new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' }), `${safeName(runtime.name)}-multi-atlas.zip`);
    toast(`Multi-atlas exported: ${pageCount} page${pageCount === 1 ? '' : 's'}`);
  }

  const exportGrid = el.gif.closest('.panel-section')?.querySelector('.export-grid');
  if (!exportGrid) return;

  const button = document.createElement('button');
  button.className = 'btn export-btn green';
  button.innerHTML = '<span>Multi-atlas</span><small>paged PNG + JSON</small>';
  button.title = `Splits large projects into pages up to ${MAX_DIMENSION}px and ${Math.round(MAX_PIXELS / 1_000_000)} MP each`;
  button.addEventListener('click', () => void exportMultiAtlas().catch((error) => {
    console.error(error);
    toast('Multi-atlas export failed.', true);
  }));
  exportGrid.append(button);
})();
