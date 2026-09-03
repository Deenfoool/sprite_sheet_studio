const sourceCanvas = document.querySelector('#sourceCanvas');
const sourceName = document.querySelector('#sourceName');
const sourceDimensions = document.querySelector('#sourceDimensions');
const resliceButton = document.querySelector('#resliceBtn');
const deleteButton = document.querySelector('#deleteBtn');
const rowsInput = document.querySelector('#rowsInput');
const colsInput = document.querySelector('#colsInput');
const paddingXInput = document.querySelector('#paddingXInput');
const paddingYInput = document.querySelector('#paddingYInput');
const spacingXInput = document.querySelector('#spacingXInput');
const spacingYInput = document.querySelector('#spacingYInput');
const autoSliceButton = document.querySelector('#autoSliceBtn');
const fileInput = document.querySelector('#fileInput');

if (
  sourceCanvas instanceof HTMLCanvasElement &&
  sourceName &&
  sourceDimensions &&
  resliceButton instanceof HTMLButtonElement &&
  deleteButton instanceof HTMLButtonElement &&
  rowsInput instanceof HTMLInputElement &&
  colsInput instanceof HTMLInputElement &&
  paddingXInput instanceof HTMLInputElement &&
  paddingYInput instanceof HTMLInputElement &&
  spacingXInput instanceof HTMLInputElement &&
  spacingYInput instanceof HTMLInputElement
) {
  const excluded = new Set();
  let applying = false;
  let signature = '';
  let overlayQueued = false;

  const controls = document.createElement('div');
  controls.className = 'source-cell-controls';
  controls.innerHTML = `
    <span class="source-cell-status" data-source-cell-status>All cells selected</span>
    <button class="source-cell-action" type="button" data-source-select-all>Select all</button>
    <button class="source-cell-action" type="button" data-source-invert>Invert</button>
  `;
  sourceDimensions.insertAdjacentElement('afterend', controls);

  const status = controls.querySelector('[data-source-cell-status]');
  const selectAllButton = controls.querySelector('[data-source-select-all]');
  const invertButton = controls.querySelector('[data-source-invert]');

  function number(input, fallback = 0) {
    const value = Number.parseInt(input.value, 10);
    return Number.isFinite(value) ? value : fallback;
  }

  function grid() {
    const rows = Math.max(1, number(rowsInput, 1));
    const cols = Math.max(1, number(colsInput, 1));
    const paddingX = Math.max(0, number(paddingXInput));
    const paddingY = Math.max(0, number(paddingYInput));
    const spacingX = Math.max(0, number(spacingXInput));
    const spacingY = Math.max(0, number(spacingYInput));
    const usableWidth = sourceCanvas.width - paddingX * 2 - spacingX * (cols - 1);
    const usableHeight = sourceCanvas.height - paddingY * 2 - spacingY * (rows - 1);
    const frameWidth = Math.floor(usableWidth / cols);
    const frameHeight = Math.floor(usableHeight / rows);
    return { rows, cols, paddingX, paddingY, spacingX, spacingY, frameWidth, frameHeight };
  }

  function currentSignature() {
    const value = grid();
    return [
      sourceName.textContent || '',
      sourceCanvas.width,
      sourceCanvas.height,
      value.rows,
      value.cols,
      value.paddingX,
      value.paddingY,
      value.spacingX,
      value.spacingY
    ].join(':');
  }

  function ensureSignature(reset = false) {
    const next = currentSignature();
    if (reset || (signature && signature !== next)) excluded.clear();
    signature = next;
  }

  function totalCells() {
    const value = grid();
    return value.rows * value.cols;
  }

  function updateStatus() {
    const total = totalCells();
    const selected = Math.max(0, total - excluded.size);
    status.textContent = excluded.size ? `${selected}/${total} cells selected` : `All ${total} cells selected`;
    controls.classList.toggle('has-exclusions', excluded.size > 0);
    controls.hidden = resliceButton.disabled || sourceCanvas.width <= 1 || sourceCanvas.height <= 1;
  }

  function queueOverlay() {
    if (overlayQueued) return;
    overlayQueued = true;
    requestAnimationFrame(() => {
      overlayQueued = false;
      drawOverlay();
    });
  }

  function drawOverlay() {
    updateStatus();
    if (controls.hidden || !excluded.size) return;
    const value = grid();
    if (value.frameWidth < 1 || value.frameHeight < 1) return;
    const ctx = sourceCanvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.font = `${Math.max(10, Math.round(Math.min(value.frameWidth, value.frameHeight) * 0.14))}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    excluded.forEach((index) => {
      if (index < 0 || index >= value.rows * value.cols) return;
      const row = Math.floor(index / value.cols);
      const col = index % value.cols;
      const x = value.paddingX + col * (value.frameWidth + value.spacingX);
      const y = value.paddingY + row * (value.frameHeight + value.spacingY);
      ctx.fillStyle = 'rgba(7, 11, 18, 0.68)';
      ctx.fillRect(x, y, value.frameWidth, value.frameHeight);
      ctx.strokeStyle = '#ff647c';
      ctx.lineWidth = Math.max(1, Math.min(value.frameWidth, value.frameHeight) / 40);
      ctx.setLineDash([]);
      ctx.strokeRect(x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, value.frameWidth - ctx.lineWidth, value.frameHeight - ctx.lineWidth);
      ctx.fillStyle = '#ff9bad';
      ctx.fillText('×', x + value.frameWidth / 2, y + value.frameHeight / 2);
    });
    ctx.restore();
  }

  function deleteTimelineIndex(index) {
    const cards = Array.from(document.querySelectorAll('#frames .frame-card'));
    const card = cards[index];
    if (!(card instanceof HTMLElement)) return;
    card.click();
    if (!deleteButton.disabled) deleteButton.click();
  }

  function applySelection() {
    if (applying || resliceButton.disabled) return;
    applying = true;
    try {
      resliceButton.click();
      const descending = [...excluded].sort((a, b) => b - a);
      descending.forEach(deleteTimelineIndex);
      queueOverlay();
    } finally {
      applying = false;
    }
  }

  function cellAtEvent(event) {
    const rect = sourceCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = (event.clientX - rect.left) * (sourceCanvas.width / rect.width);
    const y = (event.clientY - rect.top) * (sourceCanvas.height / rect.height);
    const value = grid();
    if (value.frameWidth < 1 || value.frameHeight < 1) return null;

    for (let row = 0; row < value.rows; row += 1) {
      for (let col = 0; col < value.cols; col += 1) {
        const sx = value.paddingX + col * (value.frameWidth + value.spacingX);
        const sy = value.paddingY + row * (value.frameHeight + value.spacingY);
        if (x >= sx && x < sx + value.frameWidth && y >= sy && y < sy + value.frameHeight) {
          return row * value.cols + col;
        }
      }
    }
    return null;
  }

  sourceCanvas.addEventListener('click', (event) => {
    if (resliceButton.disabled) return;
    ensureSignature();
    const index = cellAtEvent(event);
    if (index === null) return;
    if (excluded.has(index)) excluded.delete(index);
    else excluded.add(index);
    applySelection();
  });

  sourceCanvas.addEventListener('mousemove', () => {
    sourceCanvas.style.cursor = resliceButton.disabled ? '' : 'crosshair';
  });

  selectAllButton?.addEventListener('click', () => {
    ensureSignature();
    excluded.clear();
    applySelection();
  });

  invertButton?.addEventListener('click', () => {
    ensureSignature();
    const total = totalCells();
    const next = new Set();
    for (let index = 0; index < total; index += 1) {
      if (!excluded.has(index)) next.add(index);
    }
    excluded.clear();
    next.forEach((index) => excluded.add(index));
    applySelection();
  });

  [rowsInput, colsInput, paddingXInput, paddingYInput, spacingXInput, spacingYInput].forEach((input) => {
    input.addEventListener('change', () => {
      if (applying) return;
      ensureSignature(true);
      queueOverlay();
    });
  });

  autoSliceButton?.addEventListener('click', () => {
    setTimeout(() => {
      ensureSignature(true);
      queueOverlay();
    }, 0);
  });

  fileInput?.addEventListener('change', () => {
    excluded.clear();
    signature = '';
    setTimeout(queueOverlay, 0);
  });

  const sourceObserver = new MutationObserver(() => {
    if (applying) return;
    const next = currentSignature();
    if (signature && signature !== next) excluded.clear();
    signature = next;
    queueOverlay();
  });
  sourceObserver.observe(sourceName, { childList: true, characterData: true, subtree: true });

  const canvasObserver = new MutationObserver(queueOverlay);
  canvasObserver.observe(sourceCanvas, { attributes: true, attributeFilter: ['width', 'height'] });

  ensureSignature(true);
  queueOverlay();
}
