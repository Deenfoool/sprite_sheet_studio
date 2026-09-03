let ikPriorityInitialized = false;

function initIkPriority() {
  if (ikPriorityInitialized) return true;
  const ikApi = globalThis.__SSSIK;
  const rigApi = globalThis.__SSSRig;
  const inspector = document.querySelector('.rig-inspector');
  const chainSelect = document.querySelector('#ikChainSelect');
  if (!ikApi?.state || !rigApi?.state || !(inspector instanceof HTMLElement) || !(chainSelect instanceof HTMLSelectElement)) return false;
  ikPriorityInitialized = true;

  function boneById(id) {
    return rigApi.state.bones.find((bone) => bone.id === id) || null;
  }

  function activeChain() {
    return ikApi.state.chains.find((chain) => chain.id === ikApi.state.activeChainId) || null;
  }

  function ensureConfig(config) {
    if (!config) return;
    if (!Number.isFinite(Number(config.priority))) config.priority = 0;
    config.priority = Math.max(-1000, Math.min(1000, Math.trunc(Number(config.priority) || 0)));
  }

  function ensureAll() {
    ikApi.state.chains.forEach(ensureConfig);
  }

  function chainBoneIds(config) {
    const end = boneById(config?.endBoneId);
    const start = end?.parentId ? boneById(end.parentId) : null;
    return new Set([start?.id, end?.id].filter(Boolean));
  }

  function conflictsFor(config) {
    if (!config) return [];
    const ids = chainBoneIds(config);
    return ikApi.state.chains.filter((other) => {
      if (other.id === config.id || other.enabled === false) return false;
      const otherIds = chainBoneIds(other);
      return [...ids].some((id) => otherIds.has(id));
    });
  }

  function solveOrder() {
    ensureAll();
    return ikApi.state.chains
      .map((chain, index) => ({ chain, index }))
      .sort((a, b) => a.chain.priority - b.chain.priority || a.index - b.index)
      .map((entry) => entry.chain);
  }

  const panel = document.createElement('section');
  panel.className = 'rig-section ik-priority-panel';
  panel.innerHTML = `
    <div class="rig-section-head">
      <span class="rig-section-title">IK Solver Order</span>
      <span class="rig-mode-badge">PRIORITY</span>
    </div>
    <div class="rig-field">
      <label>Active chain priority</label>
      <div class="ik-priority-controls">
        <button class="btn" id="ikPriorityDown" title="Lower solve priority">−10</button>
        <input id="ikPriorityValue" type="number" min="-1000" max="1000" step="1" value="0" />
        <button class="btn" id="ikPriorityUp" title="Raise solve priority">+10</button>
      </div>
    </div>
    <div class="ik-priority-help">Lower values solve first. Higher values solve last and win when enabled chains modify the same bones.</div>
    <div class="ik-priority-conflicts" data-ik-priority-conflicts>No shared-bone conflicts.</div>
    <div class="ik-priority-order" data-ik-priority-order></div>`;

  const stretchPanel = document.querySelector('.ik-stretch-panel');
  if (stretchPanel) stretchPanel.insertAdjacentElement('afterend', panel);
  else inspector.append(panel);

  const valueInput = panel.querySelector('#ikPriorityValue');
  const downBtn = panel.querySelector('#ikPriorityDown');
  const upBtn = panel.querySelector('#ikPriorityUp');
  const conflicts = panel.querySelector('[data-ik-priority-conflicts]');
  const order = panel.querySelector('[data-ik-priority-order]');

  function chainLabel(config) {
    const end = boneById(config?.endBoneId);
    const start = end?.parentId ? boneById(end.parentId) : null;
    return start && end ? `${start.name} → ${end.name}` : 'Invalid chain';
  }

  function updateUi() {
    ensureAll();
    const config = activeChain();
    valueInput.disabled = !config;
    downBtn.disabled = !config;
    upBtn.disabled = !config;
    if (config) valueInput.value = String(config.priority);

    const shared = conflictsFor(config);
    conflicts.classList.toggle('has-conflict', shared.length > 0);
    conflicts.textContent = config
      ? (shared.length ? `Shares bones with ${shared.map((item) => chainLabel(item)).join(' · ')}` : 'No shared-bone conflicts for the active chain.')
      : 'Select an IK chain to edit solver priority.';

    const sorted = solveOrder();
    order.innerHTML = '';
    if (!sorted.length) {
      order.textContent = 'No IK chains.';
      return;
    }
    sorted.forEach((item, index) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `ik-priority-order-row${item.id === ikApi.state.activeChainId ? ' active' : ''}`;
      row.innerHTML = `<span>${index + 1}</span><strong></strong><em></em>`;
      row.querySelector('strong').textContent = chainLabel(item);
      row.querySelector('em').textContent = `P${item.priority}`;
      row.addEventListener('click', () => {
        ikApi.state.activeChainId = item.id;
        chainSelect.value = item.id;
        chainSelect.dispatchEvent(new Event('change', { bubbles: true }));
        updateUi();
      });
      order.append(row);
    });
  }

  function setPriority(value) {
    const config = activeChain();
    if (!config) return;
    config.priority = Math.max(-1000, Math.min(1000, Math.trunc(Number(value) || 0)));
    valueInput.value = String(config.priority);
    ikApi.solve();
    updateUi();
  }

  valueInput.addEventListener('change', () => setPriority(valueInput.value));
  downBtn.addEventListener('click', () => setPriority((activeChain()?.priority || 0) - 10));
  upBtn.addEventListener('click', () => setPriority((activeChain()?.priority || 0) + 10));
  chainSelect.addEventListener('change', () => setTimeout(updateUi, 0));
  document.querySelector('#ikAddChain')?.addEventListener('click', () => setTimeout(() => { ensureAll(); updateUi(); }, 0));
  document.querySelector('#ikDeleteChain')?.addEventListener('click', () => setTimeout(updateUi, 0));
  document.querySelector('#ikEndBone')?.addEventListener('change', () => setTimeout(updateUi, 0));

  const originalSolve = ikApi.solve.bind(ikApi);
  ikApi.solve = () => {
    ensureAll();
    const originalOrder = [...ikApi.state.chains];
    const sorted = solveOrder();
    ikApi.state.chains.splice(0, ikApi.state.chains.length, ...sorted);
    try {
      originalSolve();
    } finally {
      ikApi.state.chains.splice(0, ikApi.state.chains.length, ...originalOrder);
    }
    updateUi();
  };

  const originalRestore = ikApi.restore.bind(ikApi);
  ikApi.restore = (data) => {
    const priorities = new Map((data?.chains || []).map((chain) => [chain.id, Number(chain.priority)]));
    originalRestore(data);
    ikApi.state.chains.forEach((config) => {
      const priority = priorities.get(config.id);
      config.priority = Number.isFinite(priority) ? Math.trunc(priority) : 0;
      ensureConfig(config);
    });
    ikApi.solve();
    updateUi();
  };

  const originalReset = ikApi.reset.bind(ikApi);
  ikApi.reset = () => {
    originalReset();
    updateUi();
  };

  ensureAll();
  updateUi();
  globalThis.__SSSIKPriority = { ensureAll, order: solveOrder, conflictsFor, setPriority };
  return true;
}

if (!initIkPriority()) {
  const timer = window.setInterval(() => {
    if (!initIkPriority()) return;
    window.clearInterval(timer);
  }, 100);
  window.setTimeout(() => window.clearInterval(timer), 15000);
}
