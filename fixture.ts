import { deflateSync } from "node:zlib";
function crc(b: Buffer) {
  let c = 0xffffffff;
  for (const v of b) {
    c ^= v;
    for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const b = Buffer.concat([Buffer.from(type), data]),
    length = Buffer.alloc(4),
    sum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  sum.writeUInt32BE(crc(b));
  return Buffer.concat([length, b, sum]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(24, 0);
ihdr.writeUInt32BE(32, 4);
ihdr[8] = 8;
ihdr[9] = 2;
const pixels = Buffer.alloc((24 * 3 + 1) * 32);
for (let y = 0; y < 32; y++)
  for (let x = 0; x < 24; x++) {
    const o = y * 73 + 1 + x * 3;
    pixels[o] = 30 + x * 6;
    pixels[o + 1] = 90 + y * 4;
    pixels[o + 2] = 95;
  }
export const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(pixels)),
  chunk("IEND", Buffer.alloc(0)),
]);
