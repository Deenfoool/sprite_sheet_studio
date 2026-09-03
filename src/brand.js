let initialized = false;

function initBrandAssets() {
  if (initialized) return true;
  const brandLogo = document.querySelector('.brand-logo');
  const emptyPreview = document.querySelector('#emptyPreview');
  if (!(brandLogo instanceof HTMLImageElement) || !(emptyPreview instanceof HTMLElement)) return false;
  initialized = true;

  brandLogo.src = './assets/brand/logo-mark.svg';
  brandLogo.alt = 'Sprite Sheet Studio';
  brandLogo.removeAttribute('aria-hidden');

  if (!emptyPreview.querySelector('.empty-brand-lockup')) {
    const lockup = document.createElement('div');
    lockup.className = 'empty-brand-lockup';
    const image = document.createElement('img');
    image.src = './assets/brand/logo-full.png';
    image.alt = 'Sprite Sheet Studio';
    lockup.append(image);
    emptyPreview.prepend(lockup);
  }

  return true;
}

if (!initBrandAssets()) {
  const observer = new MutationObserver(() => {
    if (!initBrandAssets()) return;
    observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.setTimeout(() => observer.disconnect(), 15000);
}
