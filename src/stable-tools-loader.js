const MODULES = {
  project: { label: 'Project & Undo', description: 'Undo/redo, multiple animations and .sss save/load.', icon: 'save', file: './stable-project-tools.js?v=20260904-lazy3' },
  cleanup: { label: 'Cleanup+', description: 'Trim all and auto-align all frames on demand.', icon: 'wand-sparkles', file: './stable-cleanup-tools.js?v=20260904-lazy3' },
  object: { label: 'Object Slice', description: 'Detect irregular sprite objects only when requested.', icon: 'scan-search', file: './stable-object-tools.js?v=20260904-lazy3' },
  ai: { label: 'AI Fixer Lite', description: 'Local duplicate, broken-frame and loop diagnostics.', icon: 'activity', file: './stable-ai-tools.js?v=20260904-lazy3' },
  export: { label: 'Export+', description: 'PNG sequence ZIP, atlas JSON and engine-friendly metadata.', icon: 'package-open', file: './stable-export-tools.js?v=20260904-lazy3' },
  rig: { label: 'Rigging workspace', description: 'Bones and sprite attachments, loaded only when opened.', icon: 'bone', file: './stable-rig-lazy.js?v=20260904-lazy3' },
  skeletal: { label: 'Skeletal Animation', description: 'Key poses, interpolation and playback on the lazy rig.', icon: 'diamond', file: './stable-skeletal-lazy.js?v=20260904-lazy3' },
  ik: { label: 'Inverse Kinematics', description: 'Multi-chain two-bone IK with priority, locks and stretch.', icon: 'move-3d', file: './stable-ik-lazy.js?v=20260904-lazy3' }
};

const loaded = new Map();
let mounted = false;
let lucideRequested = false;

function loadLucideOnce() {
  if (lucideRequested || globalThis.lucide?.createIcons) return;
  lucideRequested = true;
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/lucide@1.33.0/dist/umd/lucide.min.js';
  script.defer = true;
  script.onload = () => globalThis.lucide?.createIcons?.({ attrs: { 'stroke-width': 2, 'aria-hidden': 'true' } });
  script.onerror = () => console.warn('[Sprite Sheet Studio] Lucide CDN unavailable; text controls remain usable.');
  document.head.append(script);
}

function iconize() {
  if (globalThis.lucide?.createIcons) globalThis.lucide.createIcons({ attrs: { 'stroke-width': 2, 'aria-hidden': 'true' } });
}

async function openModule(key, button, errorBox) {
  const descriptor = MODULES[key];
  if (!descriptor) return;
  button.disabled = true;
  errorBox.classList.remove('show');
  errorBox.textContent = '';
  const status = button.querySelector('.sss-tool-status');
  if (status) status.textContent = loaded.has(key) ? 'OPENING' : 'LOADING';
  try {
    let module = loaded.get(key);
    if (!module) {
      module = await import(descriptor.file);
      loaded.set(key, module);
    }
    if (typeof module.open === 'function') await module.open();
    else if (typeof module.init === 'function') await module.init();
    if (status) status.textContent = 'READY';
    document.querySelector('.sss-tools-drawer')?.classList.remove('open');
    document.querySelector('.sss-tools-backdrop')?.classList.remove('open');
  } catch (error) {
    console.error(`[Sprite Sheet Studio] lazy module ${key} failed`, error);
    if (status) status.textContent = 'ERROR';
    errorBox.textContent = error instanceof Error ? error.message : String(error);
    errorBox.classList.add('show');
  } finally {
    button.disabled = false;
  }
}

function mount() {
  if (mounted) return true;
  const topActions = document.querySelector('.top-actions');
  if (!(topActions instanceof HTMLElement)) return false;
  mounted = true;

  const toolsButton = document.createElement('button');
  toolsButton.type = 'button';
  toolsButton.className = 'btn';
  toolsButton.id = 'stableToolsButton';
  toolsButton.textContent = 'Tools';
  toolsButton.title = 'Open advanced tools (loaded only on demand)';
  topActions.insertBefore(toolsButton, topActions.querySelector('.danger'));

  const backdrop = document.createElement('div');
  backdrop.className = 'sss-tools-backdrop';
  const drawer = document.createElement('aside');
  drawer.className = 'sss-tools-drawer';
  drawer.setAttribute('aria-label', 'Advanced tools');
  drawer.innerHTML = `
    <div class="sss-tools-head">
      <div><h2>Advanced tools</h2><p>Nothing here runs until you click it. Heavy workspaces stay out of startup.</p></div>
      <button type="button" class="btn sss-tools-close" aria-label="Close tools">×</button>
    </div>
    <div class="sss-tools-body">
      ${Object.entries(MODULES).map(([key, item]) => `
        <button type="button" class="sss-tool-card" data-lazy-tool="${key}">
          <span class="sss-tool-icon"><i data-lucide="${item.icon}" aria-hidden="true"></i></span>
          <span class="sss-tool-copy"><strong>${item.label}</strong><small>${item.description}</small></span>
          <span class="sss-tool-status">LAZY</span>
        </button>`).join('')}
      <pre class="sss-tools-error" aria-live="polite"></pre>
    </div>`;
  document.body.append(backdrop, drawer);

  const close = () => { drawer.classList.remove('open'); backdrop.classList.remove('open'); };
  const open = () => { drawer.classList.add('open'); backdrop.classList.add('open'); loadLucideOnce(); iconize(); };
  toolsButton.addEventListener('click', open);
  backdrop.addEventListener('click', close);
  drawer.querySelector('.sss-tools-close')?.addEventListener('click', close);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && drawer.classList.contains('open')) close(); });

  const errorBox = drawer.querySelector('.sss-tools-error');
  drawer.querySelectorAll('[data-lazy-tool]').forEach((button) => {
    button.addEventListener('click', () => openModule(button.dataset.lazyTool, button, errorBox));
  });
  return true;
}

if (!mount()) {
  window.addEventListener('load', mount, { once: true });
  queueMicrotask(mount);
}
