(() => {
  const STORAGE_KEY = 'sss-preview-color';

  function init() {
    const bg = document.querySelector('#bgSelect');
    const previewSurface = document.querySelector('#previewSurface');
    if (!bg || !previewSurface) return false;
    if (bg.querySelector('option[value="custom"]')) return true;

    const option = document.createElement('option');
    option.value = 'custom';
    option.textContent = 'Custom color';
    bg.append(option);

    const field = bg.closest('.field');
    if (!field) return true;

    const colorRow = document.createElement('div');
    colorRow.className = 'custom-preview-color';
    colorRow.innerHTML = `
      <label for="customPreviewColor">Custom background</label>
      <input id="customPreviewColor" type="color" value="#596579" />
      <span id="customPreviewHex">#596579</span>
    `;
    field.insertAdjacentElement('afterend', colorRow);

    const colorInput = colorRow.querySelector('#customPreviewColor');
    const hex = colorRow.querySelector('#customPreviewHex');

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (/^#[0-9a-f]{6}$/i.test(saved || '')) colorInput.value = saved;
    } catch {}

    function apply() {
      const custom = bg.value === 'custom';
      colorRow.hidden = !custom;
      if (custom) {
        const value = colorInput.value;
        previewSurface.style.background = value;
        previewSurface.style.backgroundImage = 'none';
        hex.textContent = value.toUpperCase();
      } else {
        previewSurface.style.removeProperty('background');
        previewSurface.style.removeProperty('background-image');
      }
    }

    bg.addEventListener('change', apply);
    colorInput.addEventListener('input', () => {
      try { localStorage.setItem(STORAGE_KEY, colorInput.value); } catch {}
      apply();
    });

    colorRow.hidden = true;
    return true;
  }

  if (init()) return;

  const observer = new MutationObserver(() => {
    if (!init()) return;
    observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
