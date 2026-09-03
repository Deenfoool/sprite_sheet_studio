let touchToolsInitialized = false;

function initTouchTools() {
  if (touchToolsInitialized) return true;
  const previewSurface = document.querySelector('#previewSurface');
  const zoomSelect = document.querySelector('#zoomSelect');
  const fitButton = document.querySelector('#fitBtn');
  const frames = document.querySelector('#frames');
  if (!(previewSurface instanceof HTMLElement) || !(zoomSelect instanceof HTMLSelectElement) || !(fitButton instanceof HTMLButtonElement) || !(frames instanceof HTMLElement)) return false;
  touchToolsInitialized = true;

  const coarseMedia = matchMedia('(pointer: coarse)');
  const touchCapable = navigator.maxTouchPoints > 0;
  const allowedZooms = [...zoomSelect.options].map((option) => Number(option.value)).filter(Number.isFinite).sort((a, b) => a - b);
  const pointers = new Map();
  let pinchStartDistance = 0;
  let pinchStartZoom = Number(zoomSelect.value) || 4;
  let lastTapAt = 0;
  let lastTapX = 0;
  let lastTapY = 0;

  function applyTouchClass() {
    const enabled = coarseMedia.matches || touchCapable;
    document.documentElement.classList.toggle('touch-capable', enabled);
    document.documentElement.dataset.pointerMode = coarseMedia.matches ? 'coarse' : 'fine';
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function nearestAllowedZoom(value) {
    return allowedZooms.reduce((best, candidate) => Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best, allowedZooms[0] || 1);
  }

  function setZoom(value) {
    const next = nearestAllowedZoom(Math.max(allowedZooms[0] || 1, Math.min(allowedZooms.at(-1) || 8, value)));
    if (zoomSelect.value === String(next)) return;
    zoomSelect.value = String(next);
    zoomSelect.dispatchEvent(new Event('change', { bubbles: true }));
    announce(`Preview zoom ${next} times`);
  }

  function announce(text) {
    const live = document.querySelector('#sss-live-region');
    if (live instanceof HTMLElement) live.textContent = text;
  }

  previewSurface.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStartDistance = Math.max(1, distance(a, b));
      pinchStartZoom = Number(zoomSelect.value) || 4;
      previewSurface.classList.add('touch-pinching');
    }
  }, { passive: true });

  previewSurface.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'touch' || !pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size !== 2 || !pinchStartDistance) return;
    const [a, b] = [...pointers.values()];
    const ratio = distance(a, b) / pinchStartDistance;
    const raw = pinchStartZoom * ratio;
    const next = nearestAllowedZoom(raw);
    if (zoomSelect.value !== String(next)) setZoom(next);
  }, { passive: true });

  function finishPointer(event) {
    if (event.pointerType !== 'touch') return;
    pointers.delete(event.pointerId);
    if (pointers.size < 2) {
      pinchStartDistance = 0;
      previewSurface.classList.remove('touch-pinching');
    }
  }
  previewSurface.addEventListener('pointerup', finishPointer, { passive: true });
  previewSurface.addEventListener('pointercancel', finishPointer, { passive: true });

  previewSurface.addEventListener('pointerup', (event) => {
    if (event.pointerType !== 'touch' || pointers.size) return;
    const now = performance.now();
    const close = Math.hypot(event.clientX - lastTapX, event.clientY - lastTapY) < 36;
    if (now - lastTapAt < 340 && close) {
      if (!fitButton.disabled) fitButton.click();
      announce('Preview fit to workspace');
      lastTapAt = 0;
      return;
    }
    lastTapAt = now;
    lastTapX = event.clientX;
    lastTapY = event.clientY;
  }, { passive: true });

  // Make timeline touch scrolling feel native and prevent an accidental frame drag
  // from hijacking a clear horizontal swipe gesture.
  let timelineTouch = null;
  frames.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return;
    timelineTouch = { id: event.pointerId, x: event.clientX, y: event.clientY, scrollLeft: frames.scrollLeft, scrolling: false };
  }, { passive: true });
  frames.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'touch' || timelineTouch?.id !== event.pointerId) return;
    const dx = event.clientX - timelineTouch.x;
    const dy = event.clientY - timelineTouch.y;
    if (!timelineTouch.scrolling && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.25) timelineTouch.scrolling = true;
    if (timelineTouch.scrolling) frames.scrollLeft = timelineTouch.scrollLeft - dx;
  }, { passive: true });
  const finishTimeline = (event) => { if (timelineTouch?.id === event.pointerId) timelineTouch = null; };
  frames.addEventListener('pointerup', finishTimeline, { passive: true });
  frames.addEventListener('pointercancel', finishTimeline, { passive: true });

  coarseMedia.addEventListener?.('change', applyTouchClass);
  applyTouchClass();

  globalThis.__SSSTouchTools = {
    setZoom,
    isTouchCapable: () => touchCapable || coarseMedia.matches,
    refresh: applyTouchClass
  };
  return true;
}

if (!initTouchTools()) {
  const timer = window.setInterval(() => {
    if (!initTouchTools()) return;
    window.clearInterval(timer);
  }, 100);
  window.setTimeout(() => window.clearInterval(timer), 15000);
}
