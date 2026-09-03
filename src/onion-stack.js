let onionStackInitialized = false;

function initOnionStack() {
  if (onionStackInitialized) return true;
  const projectApi = globalThis.__SSSProject;
  const previewCanvas = document.querySelector('#previewCanvas');
  const previewSurface = document.querySelector('#previewSurface');
  const framesRoot = document.querySelector('#frames');
  const onionInput = document.querySelector('#onionInput');
  const onionOpacityInput = document.querySelector('#onionOpacityInput');
  const onionField = document.querySelector('#onionOpacityField');

  if (
    !projectApi ||
    !(previewCanvas instanceof HTMLCanvasElement) ||
    !(previewSurface instanceof HTMLElement) ||
    !(framesRoot instanceof HTMLElement) ||
    !(onionInput instanceof HTMLInputElement) ||
    !(onionOpacityInput instanceof HTMLInputElement) ||
    !(onionField instanceof HTMLElement)
  ) return false;

  onionStackInitialized = true;

  const controls = document.createElement('div');
  controls.className = 'onion-stack-controls';
  controls.innerHTML = `
    <label>Stack
      <select class="select" data-onion-depth>
        <option value="1">±1 frame</option>
        <option value="2">±2 frames</option>
        <option value="3">±3 frames</option>
        <option value="4">±4 frames</option>
      </select>
    </label>
    <label>Falloff
      <input data-onion-falloff type="range" min="30" max="90" value="62" />
      <span data-onion-falloff-value>62%</span>
    </label>
  `;
  onionField.insertAdjacentElement('afterend', controls);

  const depthSelect = controls.querySelector('[data-onion-depth]');
  const falloffInput = controls.querySelector('[data-onion-falloff]');
  const falloffValue = controls.querySelector('[data-onion-falloff-value]');

  const overlay = document.createElement('canvas');
  overlay.className = 'onion-stack-overlay';
  previewCanvas.insertAdjacentElement('beforebegin', overlay);
  previewCanvas.classList.add('onion-stack-foreground');

  let scheduled = false;

  function activeIndex() {
    const cards = Array.from(framesRoot.querySelectorAll('.frame-card'));
    const index = cards.findIndex((card) => card.classList.contains('active'));
    return Math.max(0, index);
  }

  function activeAnimation(runtime) {
    const entry = runtime.animations.find(([name]) => name === runtime.activeAnimation);
    return entry?.[1] || null;
  }

  function normalizedSize(frames) {
    return frames.reduce((acc, frame) => ({
      width: Math.max(acc.width, frame.canvas.width),
      height: Math.max(acc.height, frame.canvas.height)
    }), { width: 1, height: 1 });
  }

  function syncOverlayBox() {
    if (previewCanvas.classList.contains('hidden')) {
      overlay.hidden = true;
      return;
    }
    overlay.hidden = false;
    overlay.width = previewCanvas.width;
    overlay.height = previewCanvas.height;
    overlay.style.width = `${previewCanvas.clientWidth}px`;
    overlay.style.height = `${previewCanvas.clientHeight}px`;
    overlay.style.left = `${previewCanvas.offsetLeft}px`;
    overlay.style.top = `${previewCanvas.offsetTop}px`;
  }

  function drawFrame(ctx, frame, size, alpha) {
    const x = Math.floor((size.width - frame.canvas.width) / 2);
    const y = size.height - frame.canvas.height;
    ctx.globalAlpha = alpha;
    ctx.drawImage(frame.canvas, x, y);
  }

  function render() {
    scheduled = false;
    syncOverlayBox();
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const depth = Math.max(1, Number(depthSelect?.value || 1));
    controls.hidden = !onionInput.checked;
    if (!onionInput.checked || depth <= 1 || previewCanvas.classList.contains('hidden')) return;

    const runtime = projectApi.runtime();
    const animation = activeAnimation(runtime);
    if (!animation?.frames?.length) return;
    const index = Math.min(activeIndex(), animation.frames.length - 1);
    const size = normalizedSize(animation.frames);
    const baseOpacity = Math.max(0.01, Number(onionOpacityInput.value) / 100);
    const falloff = Math.max(0.1, Number(falloffInput?.value || 62) / 100);
    ctx.imageSmoothingEnabled = false;

    for (let distance = depth; distance >= 2; distance -= 1) {
      const alpha = baseOpacity * Math.pow(falloff, distance - 1);
      const previous = index - distance;
      const next = index + distance;
      if (previous >= 0) drawFrame(ctx, animation.frames[previous], size, alpha);
      if (next < animation.frames.length) drawFrame(ctx, animation.frames[next], size, alpha);
    }
    ctx.globalAlpha = 1;
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(render);
  }

  const observer = new MutationObserver(schedule);
  observer.observe(framesRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  const previewObserver = new MutationObserver(schedule);
  previewObserver.observe(previewCanvas, { attributes: true, attributeFilter: ['class', 'width', 'height', 'style'] });

  onionInput.addEventListener('change', schedule);
  onionOpacityInput.addEventListener('input', schedule);
  depthSelect?.addEventListener('change', schedule);
  falloffInput?.addEventListener('input', () => {
    if (falloffValue) falloffValue.textContent = `${falloffInput.value}%`;
    schedule();
  });
  window.addEventListener('resize', schedule);

  controls.hidden = !onionInput.checked;
  schedule();
  return true;
}

if (!initOnionStack()) {
  const timer = window.setInterval(() => {
    if (!initOnionStack()) return;
    window.clearInterval(timer);
  }, 100);
  window.setTimeout(() => window.clearInterval(timer), 15000);
}
