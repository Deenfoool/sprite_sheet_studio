(() => {
  const projectApi = globalThis.__SSSProject;
  const MAX_ATLAS_DIMENSION = 16384;
  const MAX_ATLAS_PIXELS = 64 * 1024 * 1024;

  function compactTimelineCanvases() {
    const cards = Array.from(el.frames.querySelectorAll('.frame-card'));
    cards.forEach((card, index) => {
      const frame = state.frames[index];
      const canvas = card.querySelector('.frame-thumb canvas');
      if (!frame || !canvas) return;

      const maxWidth = 78;
      const maxHeight = 72;
      const scale = Math.min(maxWidth / frame.canvas.width, maxHeight / frame.canvas.height, 1);
      const width = Math.max(1, Math.round(frame.canvas.width * scale));
      const height = Math.max(1, Math.round(frame.canvas.height * scale));
      if (canvas.width === width && canvas.height === height) return;

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(frame.canvas, 0, 0, frame.canvas.width, frame.canvas.height, 0, 0, width, height);
    });
  }

  const timelineObserver = new MutationObserver(() => compactTimelineCanvases());
  timelineObserver.observe(el.frames, { childList: true, subtree: false });
  queueMicrotask(compactTimelineCanvases);

  function atlasEstimate() {
    if (!projectApi) return null;
    const runtime = projectApi.runtime();
    let count = 0;
    let cellWidth = 1;
    let cellHeight = 1;
    runtime.animations.forEach(([, animation]) => {
      animation.frames.forEach((frame) => {
        count += 1;
        cellWidth = Math.max(cellWidth, frame.canvas.width);
        cellHeight = Math.max(cellHeight, frame.canvas.height);
      });
    });
    if (!count) return { count: 0, width: 1, height: 1, pixels: 1 };
    const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
    const rows = Math.ceil(count / cols);
    const width = cellWidth * cols;
    const height = cellHeight * rows;
    return { count, width, height, pixels: width * height };
  }

  function guardAtlasClick(event) {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!button) return;
    const label = (button.textContent || '').toLowerCase();
    if (!label.includes('atlas') && !label.includes('phaser')) return;

    const estimate = atlasEstimate();
    if (!estimate) return;
    if (estimate.width <= MAX_ATLAS_DIMENSION && estimate.height <= MAX_ATLAS_DIMENSION && estimate.pixels <= MAX_ATLAS_PIXELS) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    const megaPixels = (estimate.pixels / 1_000_000).toFixed(1);
    toast(`Atlas ${estimate.width}×${estimate.height} (${megaPixels} MP) is too large for a safe browser export. Split the project or reduce frame size.`, true);
  }

  document.addEventListener('click', guardAtlasClick, true);

  function updateMemoryHint() {
    const estimate = atlasEstimate();
    if (!estimate) return;
    const rawMb = Math.round((estimate.pixels * 4) / 1024 / 1024);
    document.querySelectorAll('.export-grid button').forEach((button) => {
      const label = (button.textContent || '').toLowerCase();
      if (!label.includes('atlas') && !label.includes('phaser')) return;
      if (rawMb >= 128) button.title = `Estimated uncompressed atlas memory: ~${rawMb} MB`;
      else if (button.title.startsWith('Estimated uncompressed atlas memory:')) button.removeAttribute('title');
    });
  }

  const exportObserver = new MutationObserver(updateMemoryHint);
  const exportGrid = el.gif.closest('.panel-section')?.querySelector('.export-grid');
  if (exportGrid) exportObserver.observe(exportGrid, { childList: true });
  const frameObserver = new MutationObserver(updateMemoryHint);
  frameObserver.observe(el.frames, { childList: true });
  queueMicrotask(updateMemoryHint);
})();
