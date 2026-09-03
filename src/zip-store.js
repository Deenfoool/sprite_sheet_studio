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

function u16(value) {
  return [value & 0xff, (value >>> 8) & 0xff];
}

function u32(value) {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

function concat(parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function zipSync(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  let count = 0;

  for (const [name, raw] of Object.entries(files)) {
    const data = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
    const nameBytes = encoder.encode(name.replace(/\\/g, '/'));
    const crc = crc32(data);
    const size = data.length >>> 0;
    const flags = 0x0800;

    const local = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(flags), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(size), ...u32(size), ...u16(nameBytes.length), ...u16(0)
    ]);
    localParts.push(local, nameBytes, data);

    const central = new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(flags), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(size), ...u32(size), ...u16(nameBytes.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(offset)
    ]);
    centralParts.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
    count += 1;
  }

  const locals = concat(localParts);
  const central = concat(centralParts);
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(count), ...u16(count),
    ...u32(central.length), ...u32(locals.length), ...u16(0)
  ]);
  return concat([locals, central, end]);
}
