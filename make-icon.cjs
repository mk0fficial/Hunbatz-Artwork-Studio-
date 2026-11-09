// Makes a placeholder 512x512 app-icon.png. Replace app-icon.png with your real logo
// (square, 1024x1024 PNG is best) and run:  npm run tauri icon app-icon.png
const fs = require('fs');
const zlib = require('zlib');
if (fs.existsSync('app-icon.png')) {
  console.log('app-icon.png already exists, keeping it.');
  process.exit(0);
}
const w = 512, h = 512;
const raw = Buffer.alloc(h * (1 + w * 4));
for (let y = 0; y < h; y++) {
  const r0 = y * (1 + w * 4);
  raw[r0] = 0;
  for (let x = 0; x < w; x++) {
    const p = r0 + 1 + x * 4;
    raw[p] = 22; raw[p + 1] = 68; raw[p + 2] = 53; raw[p + 3] = 255;
  }
}
const table = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  table[n] = c;
}
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const b = Buffer.alloc(12 + data.length);
  b.writeUInt32BE(data.length, 0);
  b.write(type, 4, 4, 'ascii');
  data.copy(b, 8);
  b.writeUInt32BE(crc32(b.subarray(4, 8 + data.length)), 8 + data.length);
  return b;
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync('app-icon.png', Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]));
console.log('Wrote app-icon.png');
