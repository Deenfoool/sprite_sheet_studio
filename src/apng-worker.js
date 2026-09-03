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
  return concat([be32(data.length), typeBytes, data, be32(crc32(concat([typeBytes, data]))) ]);
}

async function deflate(bytes) {
  if (typeof CompressionStream !== 'function') throw new Error('CompressionStream(deflate) is unavailable in this browser worker.');
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function scanlines(frame) {
  const data = new Uint8ClampedArray(frame.data);
  const rowBytes = frame.width * 4;
  const raw = new Uint8Array((rowBytes + 1) * frame.height);
  for (let y = 0; y < frame.height; y += 1) {
    const target = y * (rowBytes + 1);
    raw[target] = 0;
    raw.set(data.subarray(y * rowBytes, (y + 1) * rowBytes), target + 1);
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

self.addEventListener('message', async (event) => {
  const { frames, loop } = event.data || {};
  if (!Array.isArray(frames) || !frames.length) {
    self.postMessage({ type: 'error', message: 'No APNG frames were supplied.' });
    return;
  }

  try {
    const width = frames[0].width;
    const height = frames[0].height;
    const parts = [signature];
    const ihdr = concat([be32(width), be32(height), new Uint8Array([8, 6, 0, 0, 0])]);
    parts.push(chunk('IHDR', ihdr));
    parts.push(chunk('acTL', concat([be32(frames.length), be32(loop ? 0 : 1)])));

    let sequence = 0;
    for (let index = 0; index < frames.length; index += 1) {
      const frame = frames[index];
      if (frame.width !== width || frame.height !== height) throw new Error('APNG worker requires normalized frame dimensions.');
      parts.push(chunk('fcTL', frameControl(sequence++, width, height, frame.delay)));
      const compressed = await deflate(scanlines(frame));
      if (index === 0) parts.push(chunk('IDAT', compressed));
      else parts.push(chunk('fdAT', concat([be32(sequence++), compressed])));
      self.postMessage({ type: 'progress', value: (index + 1) / frames.length });
    }

    parts.push(chunk('IEND'));
    const result = concat(parts);
    self.postMessage({ type: 'done', buffer: result.buffer }, [result.buffer]);
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
});
