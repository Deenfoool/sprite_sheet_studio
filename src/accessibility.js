let sssAccessibilityInitialized = false;

function initAccessibility() {
  if (sssAccessibilityInitialized) return true;

  const shell = document.querySelector('.app-shell');
  const topActions = document.querySelector('.top-actions');
  const previewCanvas = document.querySelector('#previewCanvas');
  const sourceCanvas = document.querySelector('#sourceCanvas');
  const toast = document.querySelector('#toast');

  if (
    !(shell instanceof HTMLElement) ||
    !(topActions instanceof HTMLElement) ||
    !(previewCanvas instanceof HTMLCanvasElement) ||
    !(sourceCanvas instanceof HTMLCanvasElement) ||
    !(toast instanceof HTMLElement)
  ) return false;

  sssAccessibilityInitialized = true;
  shell.id = shell.id || 'sss-main-workspace';
  shell.tabIndex = -1;

  const skip = document.createElement('a');
  skip.className = 'sss-skip-link';
  skip.href = '#sss-main-workspace';
  skip.textContent = 'Skip to Sprite Sheet Studio workspace';
  document.body.prepend(skip);

  const live = document.createElement('div');
  live.className = 'sss-sr-only';
  live.id = 'sss-live-region';
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');
  document.body.append(live);

  previewCanvas.tabIndex = 0;
  previewCanvas.setAttribute('role', 'img');
  previewCanvas.setAttribute('aria-label', 'Current animation frame preview');

  sourceCanvas.tabIndex = 0;
  sourceCanvas.setAttribute('role', 'img');
  sourceCanvas.setAttribute('aria-label', 'Imported sprite sheet. Grid cells can be toggled with pointer controls when slicing is active.');

  const uploadZone = document.querySelector('#uploadZone');
  if (uploadZone instanceof HTMLElement) {
    uploadZone.setAttribute('aria-describedby', 'sss-upload-help');
    const help = document.createElement('span');
    help.id = 'sss-upload-help';
    help.className = 'sss-sr-only';
    help.textContent = 'Choose PNG or WebP images. Multiple files are loaded as an animation sequence.';
    uploadZone.append(help);
  }

  const sourceHelp = document.createElement('div');
  sourceHelp.className = 'sss-a11y-help';
  sourceHelp.textContent = 'Source sheet: use the grid controls for exact slicing; selected cells are reflected in the timeline.';
  document.querySelector('.source-meta')?.append(sourceHelp);

  function labelButton(selector, label) {
    const button = document.querySelector(selector);
    if (button instanceof HTMLButtonElement) button.setAttribute('aria-label', label);
  }

  labelButton('#playBtn', 'Play or pause animation preview');
  labelButton('#fitBtn', 'Fit animation preview to workspace');
  labelButton('#autoSliceBtn', 'Automatically detect sprite sheet grid');
  labelButton('#trimBtn', 'Trim transparent pixels from all frames');
  labelButton('#alignBtn', 'Automatically align animation frames');
  labelButton('#gifBtn', 'Export animated GIF');

  document.querySelectorAll('input[type="range"]').forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    if (!input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby')) {
      const label = input.closest('.field, .rig-field, .skeletal-interp')?.querySelector('label');
      if (label?.textContent) input.setAttribute('aria-label', label.textContent.trim());
    }
  });

  document.querySelectorAll('.sss-diagnostics, .rig-overlay').forEach((dialog) => {
    if (!(dialog instanceof HTMLElement)) return;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const heading = dialog.querySelector('strong, .rig-title');
    if (heading instanceof HTMLElement) {
      if (!heading.id) heading.id = `sss-dialog-title-${Math.random().toString(36).slice(2)}`;
      dialog.setAttribute('aria-labelledby', heading.id);
    }
  });

  const cleanupCompare = document.querySelector('.cleanup-compare');
  if (cleanupCompare instanceof HTMLElement) {
    cleanupCompare.setAttribute('role', 'region');
    cleanupCompare.setAttribute('aria-label', 'Before and after cleanup comparison');
  }

  const toastObserver = new MutationObserver(() => {
    const message = toast.textContent?.trim();
    if (!message) return;
    live.textContent = '';
    window.setTimeout(() => { live.textContent = message; }, 20);
  });
  toastObserver.observe(toast, { childList: true, characterData: true, subtree: true });

  const dialogObserver = new MutationObserver(() => {
    document.querySelectorAll('.sss-diagnostics:not(.hidden), .rig-overlay:not(.hidden)').forEach((dialog) => {
      if (!(dialog instanceof HTMLElement)) return;
      const active = document.activeElement;
      if (active && dialog.contains(active)) return;
      const target = dialog.querySelector('button, input, select, [tabindex="0"]');
      if (target instanceof HTMLElement) target.focus({ preventScroll: true });
    });
  });
  dialogObserver.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function applyReducedMotion() {
    document.documentElement.dataset.reducedMotion = reducedMotion.matches ? 'true' : 'false';
  }
  applyReducedMotion();
  reducedMotion.addEventListener?.('change', applyReducedMotion);

  globalThis.__SSSAccessibility = {
    liveRegion: live,
    reducedMotion: () => reducedMotion.matches
  };

  return true;
}

if (!initAccessibility()) {
  const observer = new MutationObserver(() => {
    if (!initAccessibility()) return;
    observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.setTimeout(() => observer.disconnect(), 15000);
}
