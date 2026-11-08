const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, "ascii");
  data.copy(buf, 8);
  const crc = crc32(buf.slice(4, 8 + len));
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

function encodePng(width, height, rgbaBuffer) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;
  const ihdr = createChunk("IHDR", ihdrData);

  const scanlineLen = width * 4;
  const rawData = Buffer.alloc(height * (1 + scanlineLen));
  for (let y = 0; y < height; y++) {
    const rawPos = y * (1 + scanlineLen);
    rawData[rawPos] = 0;
    rgbaBuffer.copy(rawData, rawPos + 1, y * scanlineLen, (y + 1) * scanlineLen);
  }
  const idatData = zlib.deflateSync(rawData);
  const idat = createChunk("IDAT", idatData);
  const iend = createChunk("IEND", Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

function unfilterPng(buf, width, height) {
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const out = Buffer.alloc(width * height * bytesPerPixel);
  let srcPos = 0, dstPos = 0;
  for (let y = 0; y < height; y++) {
    const filterType = buf[srcPos++];
    for (let x = 0; x < stride; x++) {
      const raw = buf[srcPos++];
      const a = x >= bytesPerPixel ? out[dstPos - bytesPerPixel] : 0;
      const b = y > 0 ? out[dstPos - stride] : 0;
      const c = (x >= bytesPerPixel && y > 0) ? out[dstPos - stride - bytesPerPixel] : 0;
      let val = raw;
      if (filterType === 1) val = (raw + a) & 0xff;
      else if (filterType === 2) val = (raw + b) & 0xff;
      else if (filterType === 3) val = (raw + Math.floor((a + b) / 2)) & 0xff;
      else if (filterType === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        val = (raw + (pa <= pb && pa <= pc ? a : (pb <= pc ? b : c))) & 0xff;
      }
      out[dstPos++] = val;
    }
  }
  return out;
}

function decodePng(filePath) {
  const buf = fs.readFileSync(filePath);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  let pos = 33;
  const idatChunks = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.slice(pos + 4, pos + 8).toString("ascii");
    if (type === "IDAT") idatChunks.push(buf.slice(pos + 8, pos + 8 + len));
    pos += 8 + len + 4;
  }
  const decompressed = zlib.inflateSync(Buffer.concat(idatChunks));
  return { width, height, pixels: unfilterPng(decompressed, width, height) };
}

const sheets = [
  {
    file: "public/assets/aistudio/image_ff3b6f52.png",
    xBorders: [0, 99, 199, 299, 399],
    yBorders: [0, 101, 201, 301, 401, 501, 599],
    rows: 6,
    cols: 4
  },
  {
    file: "public/assets/aistudio/image_9591a4fb.png",
    xBorders: [0, 99, 198, 299, 396],
    yBorders: [0, 99, 199, 298, 398, 499, 596],
    rows: 6,
    cols: 4
  },
  {
    file: "public/assets/aistudio/image_3eb02996.png",
    xBorders: [0, 99, 198, 298, 398],
    yBorders: [0, 95, 195, 296, 395, 495, 594],
    rows: 6,
    cols: 4
  },
  {
    file: "public/assets/aistudio/image_3c7c3303.png",
    xBorders: [0, 100, 200, 300, 401],
    yBorders: [0, 94, 194, 295, 395, 495, 593],
    rows: 6,
    cols: 4
  },
  {
    file: "public/assets/aistudio/image_b850424c.png",
    xBorders: [0, 101, 201, 301, 400],
    yBorders: [0, 96, 196, 295, 396, 496, 596],
    rows: 6,
    cols: 4
  },
  {
    file: "public/assets/aistudio/image_732c5ae2.png",
    xBorders: [0, 103, 202, 302, 411],
    yBorders: [0, 99, 200],
    rows: 2,
    cols: 4,
    skip: [[1, 3]] // Row 1 col 3 is empty dialog space
  }
];

const outDir = "public/assets/brush_tips";
let tipIndex = 1;
const manifest = [];

for (let sIdx = 0; sIdx < sheets.length; sIdx++) {
  const sheet = sheets[sIdx];
  const { width, height, pixels } = decodePng(sheet.file);

  for (let r = 0; r < sheet.rows; r++) {
    for (let c = 0; c < sheet.cols; c++) {
      if (sheet.skip && sheet.skip.some(([sr, sc]) => sr === r && sc === c)) {
        continue;
      }

      let x1 = sheet.xBorders[c] + 2;
      let x2 = sheet.xBorders[c + 1] - 2;
      let y1 = sheet.yBorders[r] + 2;
      let y2 = sheet.yBorders[r + 1] - 2;

      // Special handling for blue selection border on Sheet 3 row 2 col 0
      if (sIdx === 2 && r === 2 && c === 0) {
        x1 += 3; x2 -= 3;
        y1 += 3; y2 -= 3;
      }

      const cellW = x2 - x1 + 1;
      const cellH = y2 - y1 + 1;
      const cellRgba = Buffer.alloc(cellW * cellH * 4);

      let checkerboardSamples = 0;
      const corners = [
        [x1 + 3, y1 + 3],
        [x2 - 3, y1 + 3],
        [x1 + 3, y2 - 3],
        [x2 - 3, y2 - 3],
        [x1 + 3, Math.round((y1 + y2) / 2)],
        [x2 - 3, Math.round((y1 + y2) / 2)]
      ];

      for (const [cx, cy] of corners) {
        const idx = (cy * width + cx) * 4;
        const cr = pixels[idx], cg = pixels[idx + 1], cb = pixels[idx + 2];
        const lum = 0.299 * cr + 0.587 * cg + 0.114 * cb;
        const isNeutral = Math.abs(cr - cg) < 8 && Math.abs(cg - cb) < 8;
        if (isNeutral && lum >= 180 && lum <= 218) {
          checkerboardSamples++;
        }
      }

      const hasCheckerboard = checkerboardSamples >= 2;

      let chromaticPixels = 0;
      for (let y = y1; y <= y2; y++) {
        for (let x = x1; x <= x2; x++) {
          const idx = (y * width + x) * 4;
          const pr = pixels[idx], pg = pixels[idx + 1], pb = pixels[idx + 2];
          const maxDiff = Math.max(Math.abs(pr - pg), Math.abs(pg - pb), Math.abs(pb - pr));
          if (maxDiff > 35) chromaticPixels++;
        }
      }
      const isChromatic = chromaticPixels > 40;

      let dstIdx = 0;
      for (let y = y1; y <= y2; y++) {
        for (let x = x1; x <= x2; x++) {
          const idx = (y * width + x) * 4;
          const pr = pixels[idx];
          const pg = pixels[idx + 1];
          const pb = pixels[idx + 2];
          const lum = 0.299 * pr + 0.587 * pg + 0.114 * pb;
          const maxDiff = Math.max(Math.abs(pr - pg), Math.abs(pg - pb), Math.abs(pb - pr));

          let outR = 255;
          let outG = 255;
          let outB = 255;
          let outA = 0;

          if (hasCheckerboard) {
            const isBgColor = maxDiff < 10 && ((lum >= 242) || (lum >= 185 && lum <= 212));
            if (isBgColor) {
              outA = 0;
            } else if (isChromatic) {
              outR = pr;
              outG = pg;
              outB = pb;
              outA = maxDiff > 18 ? 255 : Math.max(0, Math.min(255, Math.round((210 - lum) * 2.5)));
            } else {
              outR = 255;
              outG = 255;
              outB = 255;
              if (lum < 185) {
                outA = Math.max(0, Math.min(255, Math.round((195 - lum) * 255 / 195)));
              } else {
                outA = 0;
              }
            }
          } else {
            if (isChromatic) {
              outR = pr;
              outG = pg;
              outB = pb;
              if (lum >= 246) outA = 0;
              else outA = maxDiff > 20 ? 255 : Math.max(0, Math.min(255, Math.round(255 - lum)));
            } else {
              outR = 255;
              outG = 255;
              outB = 255;
              if (lum >= 248) {
                outA = 0;
              } else {
                outA = Math.max(0, Math.min(255, Math.round((255 - lum) * 255 / 248)));
              }
            }
          }

          cellRgba[dstIdx] = outR;
          cellRgba[dstIdx + 1] = outG;
          cellRgba[dstIdx + 2] = outB;
          cellRgba[dstIdx + 3] = outA;
          dstIdx += 4;
        }
      }

      const tipId = `krita_tip_${String(tipIndex).padStart(3, "0")}`;
      const fileName = `${tipId}.png`;
      const outPath = path.join(outDir, fileName);
      const pngBuffer = encodePng(cellW, cellH, cellRgba);
      fs.writeFileSync(outPath, pngBuffer);

      manifest.push({
        id: tipId,
        fileName,
        url: `/assets/brush_tips/${fileName}`,
        sheet: sIdx + 1,
        row: r,
        col: c,
        width: cellW,
        height: cellH,
        isChromatic
      });

      tipIndex++;
    }
  }
}

console.log(`Successfully extracted ${manifest.length} brush tips to ${outDir}`);
fs.writeFileSync("public/assets/brush_tips/manifest.json", JSON.stringify(manifest, null, 2));
