(() => {
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function be16(value) {
    const out = new Uint8Array(2);
    new DataView(out.buffer).setUint16(0, value >>> 0, false);
    return out;
  }

  function be32(value) {
    const out = new Uint8Array(4);
    new DataView(out.buffer).setUint32(0, value >>> 0, false);
    return out;
  }

  function concat(parts) {
    const length = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.length;
    }
    return out;
  }

  function chunk(type, data = new Uint8Array()) {
    const typeBytes = new TextEncoder().encode(type);
    const crcInput = concat([typeBytes, data]);
    return concat([be32(data.length), typeBytes, data, be32(crc32(crcInput))]);
  }

  async function deflate(bytes) {
    if (typeof CompressionStream !== 'function') throw new Error('This browser does not provide CompressionStream(deflate), required for APNG export.');
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function scanlines(canvas) {
    const image = get2d(canvas).getImageData(0, 0, canvas.width, canvas.height);
    const rowBytes = canvas.width * 4;
    const raw = new Uint8Array((rowBytes + 1) * canvas.height);
    for (let y = 0; y < canvas.height; y += 1) {
      const target = y * (rowBytes + 1);
      raw[target] = 0;
      raw.set(image.data.subarray(y * rowBytes, (y + 1) * rowBytes), target + 1);
    }
    return raw;
  }

  function frameControl(sequence, width, height, delayMs) {
    const delayNum = Math.max(1, Math.min(65535, Math.round(delayMs)));
    return concat([
      be32(sequence),
      be32(width),
      be32(height),
      be32(0),
      be32(0),
      be16(delayNum),
      be16(1000),
      new Uint8Array([0, 0])
    ]);
  }

  async function exportApng() {
    if (!state.frames.length) return;
    const sequence = playbackSequence();
    if (!sequence.length) return;

    const { width, height } = normalizedSize();
    const rawEstimate = width * height * 4 * sequence.length;
    if (rawEstimate > 512 * 1024 * 1024) {
      toast(`APNG export would need about ${Math.round(rawEstimate / 1024 / 1024)} MB of raw frame memory. Reduce the animation first.`, true);
      return;
    }

    const original = apngBtn.innerHTML;
    apngBtn.disabled = true;
    const parts = [signature];
    try {
      const ihdr = concat([
        be32(width), be32(height),
        new Uint8Array([8, 6, 0, 0, 0])
      ]);
      parts.push(chunk('IHDR', ihdr));
      parts.push(chunk('acTL', concat([be32(sequence.length), be32(state.loop ? 0 : 1)])));

      let apngSequence = 0;
      for (let index = 0; index < sequence.length; index += 1) {
        const frameIndex = sequence[index];
        const frame = state.frames[frameIndex];
        const canvas = drawNormalizedFrame(frame);
        const delayMs = Math.max(1, Math.round((1000 / state.fps) * (frame.hold || 1)));
        parts.push(chunk('fcTL', frameControl(apngSequence++, width, height, delayMs)));
        apngBtn.innerHTML = `<span>APNG ${Math.round((index / sequence.length) * 100)}%</span><small>compressing</small>`;
        const compressed = await deflate(scanlines(canvas));
        if (index === 0) parts.push(chunk('IDAT', compressed));
        else parts.push(chunk('fdAT', concat([be32(apngSequence++), compressed])));
        if (index % 2 === 0) await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      parts.push(chunk('IEND'));
      downloadBlob(new Blob([concat(parts)], { type: 'image/apng' }), 'sprite-animation.png');
      toast('APNG exported');
    } catch (error) {
      console.error(error);
      toast(error instanceof Error ? error.message : 'APNG export failed.', true);
    } finally {
      apngBtn.innerHTML = original;
      apngBtn.disabled = !state.frames.length;
    }
  }

  const exportGrid = el.gif.closest('.panel-section')?.querySelector('.export-grid');
  if (!exportGrid) return;
  const apngBtn = document.createElement('button');
  apngBtn.className = 'btn export-btn';
  apngBtn.innerHTML = '<span>Animated PNG</span><small>APNG · alpha</small>';
  apngBtn.disabled = !state.frames.length;
  apngBtn.addEventListener('click', () => void exportApng());

  const gifButton = el.gif;
  gifButton.insertAdjacentElement('afterend', apngBtn);

  const observer = new MutationObserver(() => { apngBtn.disabled = !state.frames.length; });
  observer.observe(el.frames, { childList: true });
})();