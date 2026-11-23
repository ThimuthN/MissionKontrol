const maxArchive = 30 * 1024 * 1024;
const maxExtracted = 60 * 1024 * 1024;
const decoder = new TextDecoder();

function zipError() {
  return new Error('This ZIP is invalid or uses an unsupported archive format.');
}

async function inflate(bytes, expected) {
  const input = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = input.getReader();
  const target = new Uint8Array(expected);
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (length + value.length > expected) { await reader.cancel(); throw zipError(); }
    target.set(value, length);
    length += value.length;
  }
  if (length !== expected) throw zipError();
  return target;
}

export async function* extractExport(bytes) {
  if (bytes.byteLength > maxArchive) throw new Error('ZIP exceeds the 30 MB limit.');
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u32 = position => data.getUint32(position, true);
  const u16 = position => data.getUint16(position, true);
  let end = bytes.length - 22;
  for (; end >= Math.max(0, bytes.length - 65557); end--) {
    if (u32(end) === 0x06054b50 && end + 22 + u16(end + 20) === bytes.length) break;
  }
  if (end < Math.max(0, bytes.length - 65557) || u16(end + 4) || u16(end + 6)) throw zipError();
  const count = u16(end + 10);
  let directory = u32(end + 16);
  if (count > 2000 || directory > end) throw zipError();
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (directory + 46 > end || u32(directory) !== 0x02014b50) throw zipError();
    const nameLength = u16(directory + 28);
    const nameEnd = directory + 46 + nameLength;
    if (nameEnd > end) throw zipError();
    const name = decoder.decode(bytes.subarray(directory + 46, nameEnd));
    const flags = u16(directory + 8);
    const method = u16(directory + 10);
    const compressed = u32(directory + 20);
    const size = u32(directory + 24);
    const local = u32(directory + 42);
    directory = nameEnd + u16(directory + 30) + u16(directory + 32);
    if (!name.endsWith('.jsonl') || name.includes('__MACOSX/') || name.split('/').includes('..')) continue;
    total += size;
    if (total > maxExtracted) throw new Error('Extracted data exceeds the 60 MB limit.');
    if (flags & 1 || ![0, 8].includes(method) || local + 30 > end || u32(local) !== 0x04034b50) throw zipError();
    const start = local + 30 + u16(local + 26) + u16(local + 28);
    if (start + compressed > end || (method === 0 && compressed !== size)) throw zipError();
    const payload = bytes.subarray(start, start + compressed);
    yield [name, decoder.decode(method === 8 ? await inflate(payload, size) : payload)];
  }
}
