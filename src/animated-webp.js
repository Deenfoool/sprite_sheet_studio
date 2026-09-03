let animatedWebpInitialized = false;

function initAnimatedWebp() {
  if (animatedWebpInitialized) return true;
  const projectApi = globalThis.__SSSProject;
  const exportGrid = document.querySelector('#gifBtn')?.closest('.panel-section')?.querySelector('.export-grid');
  if (!projectApi || !(exportGrid instanceof HTMLElement)) return false;
  animatedWebpInitialized = true;

  const textEncoder = new TextEncoder();

  function u24(value) {
    const v = Math.max(0, Math.min(0xffffff, Math.round(value)));
    return new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff]);
  }

  function u32(value) {
    const out = new Uint8Array(4);
    new DataView(out.buffer).setUint32(0, value >>> 0, true);
    return out;
  }

  function u16(value) {
    const out = new Uint8Array(2);
    new DataView(out.buffer).setUint16(0, value >>> 0, true);
    return out;
  }

  function concat(parts) {
    const size = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(size);
    let offset = 0;
    parts.forEach((part) => {
      out.set(part, offset);
      offset += part.length;
    });
    return out;
  }

  function chunk(type, payload) {
    const typeBytes = textEncoder.encode(type);
    const padding = payload.length % 2 ? new Uint8Array([0]) : new Uint8Array();
    return concat([typeBytes, u32(payload.length), payload, padding]);
  }

  function fourCC(bytes, offset) {
    return new TextDecoder('ascii').decode(bytes.subarray(offset, offset + 4));
  }

  function extractFrameChunks(webpBytes) {
    if (webpBytes.length < 12 || fourCC(webpBytes, 0) !== 'RIFF' || fourCC(webpBytes, 8) !== 'WEBP') {
      throw new Error('Browser returned an invalid WebP frame.');
    }

    const chunks = [];
    let offset = 12;
    while (offset + 8 <= webpBytes.length) {
      const type = fourCC(webpBytes, offset);
      const size = new DataView(webpBytes.buffer, webpBytes.byteOffset + offset + 4, 4).getUint32(0, true);
      const end = offset + 8 + size;
      if (end > webpBytes.length) break;
      if (type === 'ALPH' || type === 'VP8 ' || type === 'VP8L') {
        chunks.push(webpBytes.slice(offset, end + (size % 2)));
      }
      offset = end + (size % 2);
    }
    if (!chunks.some((bytes) => ['VP8 ', 'VP8L'].includes(fourCC(bytes, 0)))) {
      throw new Error('Could not find VP8/VP8L data in encoded frame.');
    }
    return concat(chunks);
  }

  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob || blob.type !== 'image/webp') reject(new Error('This browser cannot encode WebP from Canvas.'));
        else resolve(blob);
      }, 'image/webp', 1);
    });
  }

  function activeAnimation(runtime) {
    return runtime.animations.find(([name]) => name === runtime.activeAnimation)?.[1] || null;
  }

  function normalizedSize(frames) {
    return frames.reduce((acc, frame) => ({
      width: Math.max(acc.width, frame.canvas.width),
      height: Math.max(acc.height, frame.canvas.height)
    }), { width: 1, height: 1 });
  }

  function normalizedFrame(frame, size) {
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is unavailable.');
    ctx.imageSmoothingEnabled = false;
    const x = Math.floor((size.width - frame.canvas.width) / 2);
    const y = size.height - frame.canvas.height;
    ctx.drawImage(frame.canvas, x, y);
    return canvas;
  }

  function sequence(animation) {
    const base = animation.frames.map((_, index) => index);
    if (!animation.pingPong || base.length < 3) return base;
    return [...base, ...base.slice(1, -1).reverse()];
  }

  async function encodeAnimatedWebp(animation, onProgress) {
    const size = normalizedSize(animation.frames);
    if (size.width > 16384 || size.height > 16384) throw new Error('Animated WebP canvas exceeds 16384 px.');
    const order = sequence(animation);
    if (!order.length) throw new Error('Animation has no frames.');

    const vp8x = new Uint8Array(10);
    vp8x[0] = 0x12; // animation + alpha capability
    vp8x.set(u24(size.width - 1), 4);
    vp8x.set(u24(size.height - 1), 7);

    const loopCount = animation.loop === false ? 1 : 0;
    const animPayload = concat([new Uint8Array([0, 0, 0, 0]), u16(loopCount)]);
    const chunks = [chunk('VP8X', vp8x), chunk('ANIM', animPayload)];

    for (let outputIndex = 0; outputIndex < order.length; outputIndex += 1) {
      const frame = animation.frames[order[outputIndex]];
      const canvas = normalizedFrame(frame, size);
      const blob = await canvasBlob(canvas);
      const encoded = new Uint8Array(await blob.arrayBuffer());
      const frameChunks = extractFrameChunks(encoded);
      const duration = Math.max(1, Math.round((1000 / Math.max(1, animation.fps || 8)) * Math.max(1, frame.hold || 1)));
      const frameHeader = concat([
        u24(0),
        u24(0),
        u24(size.width - 1),
        u24(size.height - 1),
        u24(duration),
        new Uint8Array([0])
      ]);
      chunks.push(chunk('ANMF', concat([frameHeader, frameChunks])));
      onProgress?.((outputIndex + 1) / order.length);
      if (outputIndex % 2 === 0) await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    const webpPayload = concat([textEncoder.encode('WEBP'), ...chunks]);
    return concat([textEncoder.encode('RIFF'), u32(webpPayload.length), webpPayload]);
  }

  async function exportWebp(button) {
    const runtime = projectApi.runtime();
    const animation = activeAnimation(runtime);
    if (!animation?.frames?.length) throw new Error('The active animation has no frames.');

    const original = button.innerHTML;
    button.disabled = true;
    try {
      const bytes = await encodeAnimatedWebp(animation, (progress) => {
        button.innerHTML = `<span>WebP ${Math.round(progress * 100)}%</span><small>encoding</small>`;
      });
      const blob = new Blob([bytes], { type: 'image/webp' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${String(runtime.activeAnimation || 'animation').replace(/[^a-z0-9_-]+/gi, '-')}.webp`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } finally {
      button.innerHTML = original;
      button.disabled = false;
    }
  }

  const button = document.createElement('button');
  button.className = 'btn export-btn';
  button.innerHTML = '<span>Animated WebP</span><small>active animation · alpha</small>';
  button.addEventListener('click', () => {
    exportWebp(button).catch((error) => {
      console.error(error);
      window.alert(error instanceof Error ? error.message : 'Animated WebP export failed.');
    });
  });

  const apngButton = Array.from(exportGrid.querySelectorAll('button')).find((item) => item.textContent?.includes('Animated PNG'));
  if (apngButton) apngButton.insertAdjacentElement('afterend', button);
  else exportGrid.prepend(button);
  return true;
}

if (!initAnimatedWebp()) {
  const timer = window.setInterval(() => {
    if (!initAnimatedWebp()) return;
    window.clearInterval(timer);
  }, 100);
  window.setTimeout(() => window.clearInterval(timer), 15000);
}
