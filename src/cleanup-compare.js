let cleanupCompareInitialized = false;

function initCleanupCompare() {
  if (cleanupCompareInitialized) return true;
  const previewSurface = document.querySelector('#previewSurface');
  const previewCanvas = document.querySelector('#previewCanvas');
  const trimButton = document.querySelector('#trimBtn');
  const alignButton = document.querySelector('#alignBtn');

  if (
    !(previewSurface instanceof HTMLElement) ||
    !(previewCanvas instanceof HTMLCanvasElement) ||
    !(trimButton instanceof HTMLButtonElement) ||
    !(alignButton instanceof HTMLButtonElement)
  ) return false;

  cleanupCompareInitialized = true;

  const overlay = document.createElement('div');
  overlay.className = 'cleanup-compare hidden';
  overlay.innerHTML = `
    <div class="cleanup-compare-head">
      <span><b>Before / After</b><small data-compare-label>cleanup comparison</small></span>
      <button class="cleanup-compare-close" type="button" aria-label="Close comparison">×</button>
    </div>
    <div class="cleanup-compare-stage">
      <canvas class="cleanup-compare-canvas"></canvas>
      <div class="cleanup-compare-divider" aria-hidden="true"></div>
      <span class="cleanup-compare-tag before">Before</span>
      <span class="cleanup-compare-tag after">After</span>
    </div>
    <input class="cleanup-compare-range" type="range" min="0" max="100" value="50" aria-label="Before after split" />
  `;
  previewSurface.append(overlay);

  const compareCanvas = overlay.querySelector('.cleanup-compare-canvas');
  const divider = overlay.querySelector('.cleanup-compare-divider');
  const range = overlay.querySelector('.cleanup-compare-range');
  const close = overlay.querySelector('.cleanup-compare-close');
  const label = overlay.querySelector('[data-compare-label]');

  let before = null;
  let after = null;
  let operationLabel = 'cleanup comparison';

  function cloneCanvas(source) {
    if (!(source instanceof HTMLCanvasElement) || source.width < 1 || source.height < 1) return null;
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0);
    return canvas;
  }

  function render() {
    if (!(compareCanvas instanceof HTMLCanvasElement) || !before || !after) return;
    const width = Math.max(before.width, after.width, 1);
    const height = Math.max(before.height, after.height, 1);
    compareCanvas.width = width;
    compareCanvas.height = height;
    const ctx = compareCanvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, height);

    const split = (Number(range?.value || 50) / 100) * width;
    const beforeX = Math.floor((width - before.width) / 2);
    const beforeY = height - before.height;
    const afterX = Math.floor((width - after.width) / 2);
    const afterY = height - after.height;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, split, height);
    ctx.clip();
    ctx.drawImage(before, beforeX, beforeY);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(split, 0, width - split, height);
    ctx.clip();
    ctx.drawImage(after, afterX, afterY);
    ctx.restore();

    if (divider instanceof HTMLElement) divider.style.left = `${Number(range?.value || 50)}%`;
  }

  function captureBefore(name) {
    if (previewCanvas.classList.contains('hidden')) return;
    before = cloneCanvas(previewCanvas);
    operationLabel = name;
  }

  function captureAfter() {
    if (!before || previewCanvas.classList.contains('hidden')) return;
    after = cloneCanvas(previewCanvas);
    if (!after) return;
    if (label) label.textContent = operationLabel;
    overlay.classList.remove('hidden');
    render();
  }

  function hook(button, name) {
    button.addEventListener('click', () => captureBefore(name), true);
    button.addEventListener('click', () => setTimeout(captureAfter, 0));
  }

  hook(trimButton, 'Trim transparent');
  hook(alignButton, 'Auto Align');

  range?.addEventListener('input', render);
  close?.addEventListener('click', () => overlay.classList.add('hidden'));

  const observer = new MutationObserver(() => {
    if (previewCanvas.classList.contains('hidden')) overlay.classList.add('hidden');
  });
  observer.observe(previewCanvas, { attributes: true, attributeFilter: ['class'] });
  return true;
}

if (!initCleanupCompare()) {
  const timer = window.setInterval(() => {
    if (!initCleanupCompare()) return;
    window.clearInterval(timer);
  }, 100);
  window.setTimeout(() => window.clearInterval(timer), 15000);
}
