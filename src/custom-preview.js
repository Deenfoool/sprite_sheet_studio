let customPreviewInitialized = false;

function initCustomPreview() {
  if (customPreviewInitialized) return true;
  const bgSelect = document.querySelector('#bgSelect');
  const previewSurface = document.querySelector('#previewSurface');
  if (!(bgSelect instanceof HTMLSelectElement) || !(previewSurface instanceof HTMLElement)) return false;
  customPreviewInitialized = true;

  if (!bgSelect.querySelector('option[value="custom"]')) {
    const option = document.createElement('option');
    option.value = 'custom';
    option.textContent = 'Custom color';
    bgSelect.append(option);
  }

  const field = bgSelect.closest('.field');
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
  const storageKey = 'sss-preview-color';
  if (!(colorInput instanceof HTMLInputElement) || !hex) return true;

  try {
    const saved = localStorage.getItem(storageKey);
    if (/^#[0-9a-f]{6}$/i.test(saved || '')) colorInput.value = saved;
  } catch {}

  function apply() {
    const custom = bgSelect.value === 'custom';
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

  bgSelect.addEventListener('change', apply);
  colorInput.addEventListener('input', () => {
    try { localStorage.setItem(storageKey, colorInput.value); } catch {}
    apply();
  });

  colorRow.hidden = true;
  return true;
}

if (!initCustomPreview()) {
  const timer = window.setInterval(() => {
    if (!initCustomPreview()) return;
    window.clearInterval(timer);
  }, 100);
  window.setTimeout(() => window.clearInterval(timer), 15000);
}
