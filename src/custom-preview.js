(() => {
  const option = document.createElement('option');
  option.value = 'custom';
  option.textContent = 'Custom color';
  el.bg.append(option);

  const field = el.bg.closest('.field');
  if (!field) return;

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
  const STORAGE_KEY = 'sss-preview-color';

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (/^#[0-9a-f]{6}$/i.test(saved || '')) colorInput.value = saved;
  } catch {}

  function apply() {
    const custom = el.bg.value === 'custom';
    colorRow.hidden = !custom;
    if (custom) {
      const value = colorInput.value;
      el.previewSurface.style.background = value;
      el.previewSurface.style.backgroundImage = 'none';
      hex.textContent = value.toUpperCase();
    } else {
      el.previewSurface.style.removeProperty('background');
      el.previewSurface.style.removeProperty('background-image');
    }
  }

  el.bg.addEventListener('change', apply);
  colorInput.addEventListener('input', () => {
    try { localStorage.setItem(STORAGE_KEY, colorInput.value); } catch {}
    apply();
  });

  colorRow.hidden = true;
})();
