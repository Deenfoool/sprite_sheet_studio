let skeletalEasingPersistenceInitialized = false;

function initSkeletalEasingPersistence() {
  if (skeletalEasingPersistenceInitialized) return true;
  const api = globalThis.__SSSSkeletal;
  const animationSelect = document.querySelector('#skAnimSelect');
  const interpolationSelect = document.querySelector('#skInterp');
  const curveX1 = document.querySelector('#skCurveX1');
  const curveY1 = document.querySelector('#skCurveY1');
  const curveX2 = document.querySelector('#skCurveX2');
  const curveY2 = document.querySelector('#skCurveY2');
  if (
    !api ||
    !(animationSelect instanceof HTMLSelectElement) ||
    !(interpolationSelect instanceof HTMLSelectElement) ||
    !(curveX1 instanceof HTMLInputElement) ||
    !(curveY1 instanceof HTMLInputElement) ||
    !(curveX2 instanceof HTMLInputElement) ||
    !(curveY2 instanceof HTMLInputElement)
  ) return false;
  skeletalEasingPersistenceInitialized = true;

  const settings = new Map();
  let restoring = false;

  function activeName() {
    return animationSelect.value || 'idle';
  }

  function currentCurve() {
    return [curveX1, curveY1, curveX2, curveY2].map((input, index) => {
      const value = Number(input.value);
      return Number.isFinite(value) ? value : [0.42, 0, 0.58, 1][index];
    });
  }

  function capture(name = activeName()) {
    if (!name || restoring) return;
    settings.set(name, {
      interpolation: interpolationSelect.value || 'linear',
      curve: currentCurve()
    });
  }

  function apply(name, value) {
    if (!name || !value) return;
    if (animationSelect.value !== name) {
      animationSelect.value = name;
      animationSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const mode = ['step', 'linear', 'ease', 'ease-in', 'ease-out', 'bezier'].includes(value.interpolation)
      ? value.interpolation
      : 'linear';
    interpolationSelect.value = mode;
    interpolationSelect.dispatchEvent(new Event('change', { bubbles: true }));

    const curve = Array.isArray(value.curve) && value.curve.length === 4 ? value.curve : [0.42, 0, 0.58, 1];
    [curveX1, curveY1, curveX2, curveY2].forEach((input, index) => {
      input.value = String(curve[index]);
    });
    curveX1.dispatchEvent(new Event('change', { bubbles: true }));
    settings.set(name, { interpolation: mode, curve: [...curve] });
  }

  const originalSerialize = api.serialize.bind(api);
  const originalRestore = api.restore.bind(api);
  const originalReset = api.reset.bind(api);

  api.serialize = () => {
    capture();
    const base = originalSerialize();
    return {
      ...base,
      easingExtensionVersion: 1,
      easingExtensions: Object.fromEntries([...settings.entries()].map(([name, value]) => [name, {
        interpolation: value.interpolation,
        curve: [...value.curve]
      }]))
    };
  };

  api.restore = (data) => {
    const extensions = data?.easingExtensions && typeof data.easingExtensions === 'object'
      ? data.easingExtensions
      : Object.fromEntries(Object.entries(data?.animations || {}).map(([name, animation]) => [name, {
          interpolation: animation?.interpolation || 'linear',
          curve: animation?.curve || [0.42, 0, 0.58, 1]
        }]));
    const desiredActive = data?.activeName;
    restoring = true;
    settings.clear();
    originalRestore(data);
    restoring = false;

    Object.entries(extensions).forEach(([name, value]) => {
      if (!Array.from(animationSelect.options).some((option) => option.value === name)) return;
      apply(name, value);
    });

    if (desiredActive && Array.from(animationSelect.options).some((option) => option.value === desiredActive)) {
      animationSelect.value = desiredActive;
      animationSelect.dispatchEvent(new Event('change', { bubbles: true }));
      const activeSettings = settings.get(desiredActive);
      if (activeSettings) apply(desiredActive, activeSettings);
    }
  };

  api.reset = () => {
    restoring = true;
    settings.clear();
    originalReset();
    restoring = false;
    capture();
  };

  animationSelect.addEventListener('change', () => setTimeout(() => capture(), 0));
  interpolationSelect.addEventListener('change', () => setTimeout(() => capture(), 0));
  [curveX1, curveY1, curveX2, curveY2].forEach((input) => input.addEventListener('change', () => setTimeout(() => capture(), 0)));

  const toolbar = document.querySelector('.skeletal-key-actions');
  toolbar?.addEventListener('click', () => setTimeout(() => capture(), 0));

  capture();
  globalThis.__SSSSkeletalEasing = { settings, capture };
  return true;
}

if (!initSkeletalEasingPersistence()) {
  const timer = window.setInterval(() => {
    if (!initSkeletalEasingPersistence()) return;
    window.clearInterval(timer);
  }, 100);
  window.setTimeout(() => window.clearInterval(timer), 15000);
}
