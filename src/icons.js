let initialized = false;

const byId = {
  demoBtn: 'sparkles',
  clearBtn: 'trash-2',
  trimBtn: 'crop',
  alignBtn: 'align-center',
  resliceBtn: 'grid-3x3',
  duplicateBtn: 'copy',
  deleteBtn: 'trash-2',
  reverseBtn: 'arrow-left-right',
  fitBtn: 'maximize-2',
  flipXBtn: 'flip-horizontal-2',
  flipYBtn: 'flip-vertical-2',
  rotateBtn: 'rotate-cw',
  gifBtn: 'film',
  sheetBtn: 'images',
  sequenceBtn: 'folder-archive',
  objectSliceBtn: 'scan-search',
  aiAnalyze: 'activity',
  aiAutoFix: 'wand-sparkles',
  aiPingPong: 'repeat-2',
  meshGenerate: 'grid-3x3',
  meshAutoWeight: 'sliders-horizontal',
  meshRestore: 'rotate-ccw',
  ikAddChain: 'plus',
  ikRemoveChain: 'trash-2',
  ikUseSelection: 'mouse-pointer-2',
  skAddAnim: 'plus',
  skKey: 'diamond',
  skDeleteKey: 'trash-2',
  skCopyKey: 'copy',
  skPasteKey: 'clipboard-paste',
  skDuplicate: 'copy-plus',
  skMirror: 'flip-horizontal-2',
  skExport: 'download'
};

const textRules = [
  [/^Rigging$/i, 'bone'],
  [/Diagnostics/i, 'activity'],
  [/Save \.sss/i, 'save'],
  [/^New$/i, 'file-plus-2'],
  [/Undo/i, 'undo-2'],
  [/Redo/i, 'redo-2'],
  [/Multi-atlas/i, 'layers'],
  [/Aseprite/i, 'grid-2x2'],
  [/Animated PNG/i, 'images'],
  [/Animated WebP/i, 'film'],
  [/Unity package/i, 'package'],
  [/Godot/i, 'gamepad-2'],
  [/Phaser/i, 'boxes'],
  [/Metadata/i, 'file-json'],
  [/Atlas/i, 'layout-grid'],
  [/Trim current/i, 'crop'],
  [/Back to animator/i, 'arrow-left'],
  [/Load parts/i, 'image-plus'],
  [/Add bone/i, 'plus'],
  [/Delete bone/i, 'trash-2'],
  [/Export JSON/i, 'download'],
  [/Apply ping-pong/i, 'repeat-2'],
  [/Select all/i, 'list-checks'],
  [/Invert/i, 'refresh-cw']
];

function normalizePlayButton(button) {
  if (button.id === 'playBtn') {
    const paused = /pause|❚❚/i.test(`${button.textContent || ''} ${button.getAttribute('aria-label') || ''}`);
    const label = paused ? 'Pause' : 'Play';
    button.setAttribute('aria-label', label);
  } else if (button.id === 'skPlay') {
    const paused = /❚❚|pause/i.test(`${button.textContent || ''} ${button.getAttribute('aria-label') || ''}`);
    const label = paused ? 'Pause skeletal animation' : 'Play skeletal animation';
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  if ((button.id === 'playBtn' || button.id === 'skPlay') && !button.dataset.sssIconRefreshBound) {
    button.dataset.sssIconRefreshBound = '1';
    button.addEventListener('click', () => window.setTimeout(renderIcons, 0));
  }
}

function iconForButton(button) {
  if (button.id === 'playBtn' || button.id === 'skPlay') {
    return /pause|❚❚/i.test(`${button.textContent || ''} ${button.getAttribute('aria-label') || ''}`) ? 'pause' : 'play';
  }
  if (byId[button.id]) return byId[button.id];
  const text = (button.textContent || '').trim();
  return textRules.find(([pattern]) => pattern.test(text))?.[1] || null;
}

function addButtonIcon(button) {
  normalizePlayButton(button);
  const icon = iconForButton(button);
  const current = button.querySelector('.sss-btn-icon');

  if (!icon) {
    current?.remove();
    delete button.dataset.sssIconApplied;
    button.classList.remove('has-lucide-icon');
    return;
  }

  if (button.dataset.sssIconApplied === icon && current) return;
  current?.remove();

  const node = document.createElement('i');
  node.className = 'sss-btn-icon';
  node.dataset.lucide = icon;
  node.setAttribute('aria-hidden', 'true');
  button.prepend(node);
  button.dataset.sssIconApplied = icon;
  button.classList.add('has-lucide-icon');
}

function decorateStaticIcons() {
  const upload = document.querySelector('.upload-icon');
  if (upload && !upload.querySelector('.lucide, [data-lucide]')) {
    upload.textContent = '';
    const icon = document.createElement('i');
    icon.dataset.lucide = 'image-plus';
    icon.setAttribute('aria-hidden', 'true');
    upload.append(icon);
  }

  const privacy = document.querySelector('.privacy-line');
  const privacyMarker = privacy?.querySelector('b');
  if (privacyMarker && !privacy.querySelector('.lucide, [data-lucide]')) {
    const icon = document.createElement('i');
    icon.dataset.lucide = 'shield-check';
    icon.setAttribute('aria-hidden', 'true');
    privacyMarker.replaceWith(icon);
  }

  const autoAction = document.querySelector('#autoSliceBtn');
  const trailing = autoAction?.querySelector(':scope > i');
  if (trailing && !trailing.querySelector('.lucide, [data-lucide]')) {
    trailing.textContent = '';
    const icon = document.createElement('i');
    icon.dataset.lucide = 'scan-line';
    icon.setAttribute('aria-hidden', 'true');
    trailing.append(icon);
  }
}

function renderIcons() {
  const lucide = globalThis.lucide;
  if (!lucide?.createIcons) return false;

  decorateStaticIcons();
  document.querySelectorAll('button').forEach(addButtonIcon);
  lucide.createIcons({
    attrs: {
      'stroke-width': 2,
      'aria-hidden': 'true'
    }
  });
  document.documentElement.dataset.icons = 'lucide';
  return true;
}

function init() {
  if (initialized) return;
  initialized = true;

  // IMPORTANT: do not observe the whole DOM and call createIcons() from that
  // observer. Lucide replaces nodes while rendering, which can create a
  // self-sustaining mutation loop in a dynamic editor and pin the main thread.
  // All persistent workspaces mount during startup, so a short bounded refresh
  // window is enough. Dynamic views (for example Command Palette) render their
  // own Lucide icons explicitly.
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    const ready = renderIcons();
    if ((ready && attempts >= 12) || attempts >= 50) window.clearInterval(timer);
  }, 100);

  document.addEventListener('sss:refresh-icons', () => renderIcons());
  window.setTimeout(renderIcons, 0);
}

init();
