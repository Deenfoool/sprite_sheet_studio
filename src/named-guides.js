let namedGuidesInitialized = false;

function initNamedGuides() {
  if (namedGuidesInitialized) return true;
  const panel = document.querySelector('.guides-panel');
  const previewSurface = document.querySelector('#previewSurface');
  const previewCanvas = document.querySelector('#previewCanvas');
  const guideXInput = document.querySelector('#guideX');
  const guideYInput = document.querySelector('#guideY');
  if (!(panel instanceof HTMLElement) || !(previewSurface instanceof HTMLElement) || !(previewCanvas instanceof HTMLCanvasElement) || !(guideXInput instanceof HTMLInputElement) || !(guideYInput instanceof HTMLInputElement)) return false;
  namedGuidesInitialized = true;

  const STORAGE_KEY = 'sss-named-guides-v1';
  let guides = [];

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(parsed)) guides = parsed.filter((guide) => guide && ['x', 'y'].includes(guide.axis) && Number.isFinite(Number(guide.value))).map((guide) => ({
        id: String(guide.id || crypto.randomUUID?.() || Math.random()),
        name: String(guide.name || 'Guide'),
        axis: guide.axis,
        value: Math.max(0, Number(guide.value) || 0),
        enabled: guide.enabled !== false
      }));
    } catch { guides = []; }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(guides)); } catch {}
  }

  const section = document.createElement('div');
  section.className = 'named-guides-manager';
  section.innerHTML = `
    <div class="named-guides-head"><strong>Named guides</strong><span data-guide-count>0</span></div>
    <div class="named-guide-create">
      <input id="namedGuideName" type="text" maxlength="36" placeholder="e.g. Feet baseline" />
      <select id="namedGuideAxis" aria-label="Guide axis"><option value="x">Vertical X</option><option value="y">Horizontal Y</option></select>
      <input id="namedGuideValue" type="number" min="0" value="0" aria-label="Guide position" />
      <button class="btn" id="namedGuideAdd">Add</button>
    </div>
    <div class="named-guides-list" data-named-guides-list></div>`;
  panel.append(section);

  const nameInput = section.querySelector('#namedGuideName');
  const axisSelect = section.querySelector('#namedGuideAxis');
  const valueInput = section.querySelector('#namedGuideValue');
  const addBtn = section.querySelector('#namedGuideAdd');
  const list = section.querySelector('[data-named-guides-list]');
  const count = section.querySelector('[data-guide-count]');

  const overlay = document.createElement('canvas');
  overlay.className = 'named-guide-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  previewSurface.append(overlay);

  function currentValueForAxis(axis) {
    return Math.max(0, Number(axis === 'x' ? guideXInput.value : guideYInput.value) || 0);
  }

  function syncCreateValue() {
    valueInput.value = String(currentValueForAxis(axisSelect.value));
  }

  function setCoreGuide(guide) {
    const input = guide.axis === 'x' ? guideXInput : guideYInput;
    input.value = String(guide.value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    render();
  }

  function renderList() {
    list.innerHTML = '';
    count.textContent = `${guides.filter((guide) => guide.enabled).length}/${guides.length}`;
    if (!guides.length) {
      const empty = document.createElement('div');
      empty.className = 'named-guides-empty';
      empty.textContent = 'No saved guides yet.';
      list.append(empty);
      return;
    }

    guides.forEach((guide) => {
      const row = document.createElement('div');
      row.className = `named-guide-row${guide.enabled ? '' : ' disabled'}`;
      row.innerHTML = `
        <label class="named-guide-toggle"><input type="checkbox" ${guide.enabled ? 'checked' : ''} aria-label="Toggle ${escapeHtml(guide.name)}" /><span></span></label>
        <button class="named-guide-main" type="button" title="Use this guide for Snap">
          <strong></strong><small></small>
        </button>
        <button class="btn icon named-guide-delete" type="button" title="Delete guide"><i data-lucide="trash-2" aria-hidden="true"></i></button>`;
      row.querySelector('strong').textContent = guide.name;
      row.querySelector('small').textContent = `${guide.axis.toUpperCase()} ${Math.round(guide.value * 100) / 100}px`;
      row.querySelector('input').addEventListener('change', (event) => {
        guide.enabled = event.target.checked;
        save();
        render();
      });
      row.querySelector('.named-guide-main').addEventListener('click', () => setCoreGuide(guide));
      row.querySelector('.named-guide-delete').addEventListener('click', () => {
        guides = guides.filter((item) => item.id !== guide.id);
        save();
        render();
      });
      list.append(row);
    });
    globalThis.lucide?.createIcons?.({ attrs: { 'stroke-width': 2, 'aria-hidden': 'true' } });
  }

  function escapeHtml(value) {
    return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function updateOverlay() {
    const active = guides.filter((guide) => guide.enabled);
    if (!active.length || previewCanvas.classList.contains('hidden')) {
      overlay.style.display = 'none';
      return;
    }
    overlay.style.display = 'block';
    const surfaceRect = previewSurface.getBoundingClientRect();
    const canvasRect = previewCanvas.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.round(canvasRect.width));
    const cssHeight = Math.max(1, Math.round(canvasRect.height));
    overlay.width = cssWidth;
    overlay.height = cssHeight;
    overlay.style.width = `${cssWidth}px`;
    overlay.style.height = `${cssHeight}px`;
    overlay.style.left = `${canvasRect.left - surfaceRect.left + previewSurface.scrollLeft}px`;
    overlay.style.top = `${canvasRect.top - surfaceRect.top + previewSurface.scrollTop}px`;

    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    const scaleX = cssWidth / Math.max(1, previewCanvas.width);
    const scaleY = cssHeight / Math.max(1, previewCanvas.height);
    ctx.font = '8px ui-monospace, monospace';
    ctx.lineWidth = 1;

    active.forEach((guide, index) => {
      const isX = guide.axis === 'x';
      const position = guide.value * (isX ? scaleX : scaleY);
      ctx.strokeStyle = isX ? 'rgba(87,185,255,.72)' : 'rgba(72,220,174,.72)';
      ctx.setLineDash(index % 2 ? [3, 3] : [6, 3]);
      ctx.beginPath();
      if (isX) { ctx.moveTo(position, 0); ctx.lineTo(position, cssHeight); }
      else { ctx.moveTo(0, position); ctx.lineTo(cssWidth, position); }
      ctx.stroke();
      ctx.setLineDash([]);

      const text = guide.name.length > 18 ? `${guide.name.slice(0, 17)}…` : guide.name;
      const x = isX ? Math.min(cssWidth - 92, position + 3) : 19;
      const y = isX ? 28 + (index % 5) * 12 : Math.max(24, Math.min(cssHeight - 5, position - 3));
      ctx.fillStyle = 'rgba(6,14,24,.84)';
      ctx.fillRect(x - 2, y - 9, Math.max(40, ctx.measureText(text).width + 6), 11);
      ctx.fillStyle = isX ? '#8fd1ff' : '#8be8cc';
      ctx.fillText(text, x, y);
    });
  }

  function render() {
    renderList();
    updateOverlay();
  }

  addBtn.addEventListener('click', () => {
    const axis = axisSelect.value === 'y' ? 'y' : 'x';
    const value = Math.max(0, Number(valueInput.value) || 0);
    const name = nameInput.value.trim() || `${axis.toUpperCase()} ${value}px`;
    guides.push({ id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, name, axis, value, enabled: true });
    nameInput.value = '';
    save();
    render();
  });

  axisSelect.addEventListener('change', syncCreateValue);
  guideXInput.addEventListener('input', () => { if (axisSelect.value === 'x' && document.activeElement !== valueInput) syncCreateValue(); });
  guideYInput.addEventListener('input', () => { if (axisSelect.value === 'y' && document.activeElement !== valueInput) syncCreateValue(); });
  previewSurface.addEventListener('scroll', updateOverlay);
  window.addEventListener('resize', updateOverlay);

  const previewObserver = new MutationObserver(updateOverlay);
  previewObserver.observe(previewCanvas, { attributes: true, attributeFilter: ['class', 'width', 'height'] });

  load();
  syncCreateValue();
  render();
  globalThis.__SSSNamedGuides = {
    get: () => guides.map((guide) => ({ ...guide })),
    add(name, axis, value) {
      guides.push({ id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, name: String(name || 'Guide'), axis: axis === 'y' ? 'y' : 'x', value: Math.max(0, Number(value) || 0), enabled: true });
      save();
      render();
    },
    clear() { guides = []; save(); render(); }
  };
  return true;
}

if (!initNamedGuides()) {
  const timer = window.setInterval(() => {
    if (!initNamedGuides()) return;
    window.clearInterval(timer);
  }, 100);
  window.setTimeout(() => window.clearInterval(timer), 15000);
}
