let smartTrimInitialized = false;

function initSmartTrimCurrent() {
  if (smartTrimInitialized) return true;
  const smartButtons = document.querySelector('.smart-buttons');
  const cropButton = document.querySelector('#extCropCurrent');
  const framesRoot = document.querySelector('#frames');
  if (!(smartButtons instanceof HTMLElement) || !(cropButton instanceof HTMLButtonElement) || !(framesRoot instanceof HTMLElement)) return false;
  smartTrimInitialized = true;

  const button = document.createElement('button');
  button.className = 'btn grow';
  button.id = 'smartTrimCurrentBtn';
  button.textContent = 'Trim current';
  button.title = 'Crop transparent edges only on the selected frame';
  smartButtons.prepend(button);

  function update() {
    button.disabled = cropButton.disabled || !framesRoot.querySelector('.frame-card');
  }

  button.addEventListener('click', () => {
    if (cropButton.disabled) return;
    cropButton.click();
  });

  const observer = new MutationObserver(update);
  observer.observe(framesRoot, { childList: true, subtree: true });
  const cropObserver = new MutationObserver(update);
  cropObserver.observe(cropButton, { attributes: true, attributeFilter: ['disabled'] });
  update();
  return true;
}

if (!initSmartTrimCurrent()) {
  const timer = window.setInterval(() => {
    if (!initSmartTrimCurrent()) return;
    window.clearInterval(timer);
  }, 100);
  window.setTimeout(() => window.clearInterval(timer), 15000);
}
