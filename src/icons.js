let initialized = false;
let renderQueued = false;

const byId = {
  demoBtn: 'sparkles',
  clearBtn: 'trash-2',
  autoSliceBtn: 'scan-line',
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
  meshAutoWeight: 'scale-3d',
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
  [/Invert/i, 'replace-all']
];

function iconForButton(button) {
  if (button.id === 'playBtn' || button.id === 'skPlay') {
    return /pause|❚❚/i.test(button.textContent || '') ? 'pause' : 'play';
  }
  if (byId[button.id]) return byId[button.id];
  const text = (button.textContent || '').trim();
  return textRules.find(([pattern]) => pattern.test(text))?.[1] || null;
}

function addButtonIcon(button) {
  const icon = iconForButton(button);
  const current = button.querySelector('.sss-btn-icon');
  if (!icon) {
    current?.remove();
    button.classList.remove('has-lucide-icon');
    return;
  }

  if (current?.getAttribute('data-sss-icon') === icon) return;
  current?.remove();

  const node = document.createElement('i');
  node.className = 'sss-btn-icon';
  node.dataset.lucide = icon;
  node.dataset.sssIcon = icon;
  node.setAttribute('aria-hidden', 'true');
  button.prepend(node);
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
  renderQueued = false;
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

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(renderIcons);
}

function init() {
  if (initialized) return;
  initialized = true;

  const observer = new MutationObserver(queueRender);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  if (!renderIcons()) {
    const timer = window.setInterval(() => {
      if (!renderIcons()) return;
      window.clearInterval(timer);
    }, 200);
    window.setTimeout(() => window.clearInterval(timer), 15000);
  }
}

init();
