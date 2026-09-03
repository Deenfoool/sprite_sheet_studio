import { GIFEncoder, quantize, applyPalette } from './vendor/gifenc.esm.js';

self.addEventListener('message', (event) => {
  const { frames, loop } = event.data || {};
  if (!Array.isArray(frames) || !frames.length) {
    self.postMessage({ type: 'error', message: 'No GIF frames received.' });
    return;
  }

  try {
    const gif = GIFEncoder();
    frames.forEach((frame, index) => {
      const rgba = new Uint8ClampedArray(frame.data);
      const palette = quantize(rgba, 256, { format: 'rgba4444', oneBitAlpha: true });
      const indexed = applyPalette(rgba, palette, 'rgba4444');
      const transparentIndex = palette.findIndex((color) => color.length > 3 && color[3] === 0);
      gif.writeFrame(indexed, frame.width, frame.height, {
        palette,
        delay: frame.delay,
        repeat: index === 0 ? (loop ? 0 : -1) : undefined,
        transparent: transparentIndex >= 0,
        transparentIndex: transparentIndex >= 0 ? transparentIndex : 0,
        dispose: 2
      });
      self.postMessage({ type: 'progress', value: (index + 1) / frames.length });
    });
    gif.finish();
    const bytes = gif.bytes();
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    self.postMessage({ type: 'done', buffer }, [buffer]);
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
});