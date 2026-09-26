import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { Buffer } from "node:buffer";
function crc(b) {
  let c = 0xffffffff;
  for (const v of b) {
    c ^= v;
    for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const b = Buffer.concat([Buffer.from(type), data]),
    length = Buffer.alloc(4),
    sum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  sum.writeUInt32BE(crc(b));
  return Buffer.concat([length, b, sum]);
}
for (const size of [180, 192, 512]) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;
  const pixels = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = (x / size) * 192,
        v = (y / size) * 192;
      const foreground =
        (u >= 75 && u <= 117 && v >= 31 && v <= 73) ||
        (u >= 31 && u <= 73 && v >= 119 && v <= 161) ||
        (u >= 119 && u <= 161 && v >= 119 && v <= 161) ||
        (u >= 92 && u <= 100 && v >= 70 && v <= 104) ||
        (u >= 49 && u <= 143 && v >= 99 && v <= 107) ||
        (u >= 49 && u <= 57 && v >= 99 && v <= 125) ||
        (u >= 135 && u <= 143 && v >= 99 && v <= 125);
      const color = foreground ? [217, 234, 200] : [23, 60, 53],
        offset = y * (size * 3 + 1) + 1 + x * 3;
      pixels.set(color, offset);
    }
  writeFileSync(
    size === 180 ? "public/apple-touch-icon.png" : `public/icon-${size}.png`,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(pixels)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}
