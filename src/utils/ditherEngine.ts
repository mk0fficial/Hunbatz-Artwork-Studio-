/**
 * Comprehensive Dither Suite Engine
 * Combines workflows of effect.app, Dither Boy, ditherista, and Doodad Dither-Me-This.
 * Tab 1: Indexed & Error Diffusion Dither (17 algorithms + 9 palettes + swatch grid)
 * Tab 2: MacPaint 1-Bit Pattern Dither (38 classic 8x8 bit-patterns)
 * Tab 3: Multi-Ink CMYK Halftone Screen Press (Separation, Press, 4 Inks with 2D Shift Pad)
 * Tab 4: FM / CRT Signal Modulation
 */

import { hexToRgb, rgbToHex } from './canvasAdjustments';

// ----------------- TAB 1: INDEXED & ERROR-DIFFUSION DITHER -----------------

export type DitherAlgorithm =
  | 'floyd_steinberg'
  | 'atkinson'
  | 'jarvis'
  | 'stucki'
  | 'burkes'
  | 'sierra3'
  | 'sierra2'
  | 'sierra_lite'
  | 'bayer_2x2'
  | 'bayer_4x4'
  | 'bayer_8x8'
  | 'bayer_16x16'
  | 'clustered_dot'
  | 'blue_noise'
  | 'white_noise'
  | 'horizontal_lines'
  | 'diagonal_hatch';

export const DITHER_ALGORITHM_LABELS: Record<DitherAlgorithm, string> = {
  floyd_steinberg: 'Floyd-Steinberg',
  atkinson: 'Atkinson',
  jarvis: 'Jarvis-Judice-Ninke',
  stucki: 'Stucki',
  burkes: 'Burkes',
  sierra3: 'Sierra-3',
  sierra2: 'Sierra-2',
  sierra_lite: 'Sierra-Lite',
  bayer_2x2: 'Bayer 2×2',
  bayer_4x4: 'Bayer 4×4',
  bayer_8x8: 'Bayer 8×8',
  bayer_16x16: 'Bayer 16×16',
  clustered_dot: 'Clustered Dot 4×4',
  blue_noise: 'Blue Noise',
  white_noise: 'White Noise',
  horizontal_lines: 'Horizontal Lines',
  diagonal_hatch: 'Diagonal Hatch',
};

export const BUILTIN_PALETTES: Record<string, { name: string; colors: string[] }> = {
  adaptive: { name: 'Adaptive (Auto)', colors: [] },
  custom: { name: 'Custom Swatches', colors: ['#000000', '#ffffff', '#5fd3ad', '#b89058'] },
  mono: { name: '1-Bit Mono', colors: ['#000000', '#ffffff'] },
  gameboy: { name: 'GameBoy 4-Color', colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'] },
  cga: { name: 'CGA Cyan/Magenta', colors: ['#000000', '#55ffff', '#ff55ff', '#ffffff'] },
  macintosh_ii: {
    name: 'Macintosh II (16c)',
    colors: [
      '#ffffff', '#fcf305', '#ff6403', '#dd0907', '#f20884', '#4700a5', '#0000d4', '#02abea',
      '#1fb714', '#006412', '#562c05', '#90713a', '#c0c0c0', '#808080', '#404040', '#000000',
    ],
  },
  pico8: {
    name: 'Pico-8 (16c)',
    colors: [
      '#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
      '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa',
    ],
  },
  cyberpunk: {
    name: 'Cyberpunk',
    colors: ['#0d0221', '#0f084b', '#26408b', '#a6cfd5', '#c2e7d9', '#ff007f', '#ffe600'],
  },
  newspaper: {
    name: 'Newspaper Ink',
    colors: ['#121110', '#4c4945', '#9a948c', '#eae5dc'],
  },
};

// Bayer Matrices
const BAYER_2 = [
  [0, 2],
  [3, 1],
];

const BAYER_4 = [
  [ 0,  8,  2, 10],
  [12,  4, 14,  6],
  [ 3, 11,  1,  9],
  [15,  7, 13,  5],
];

const BAYER_8 = [
  [ 0, 32,  8, 40,  2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44,  4, 36, 14, 46,  6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [ 3, 35, 11, 43,  1, 33,  9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47,  7, 39, 13, 45,  5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

function colorDistance(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
  mode: 1 | 2 | 3
): number {
  if (mode === 1) {
    // Euclidean RGB
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return dr * dr + dg * dg + db * db;
  } else if (mode === 2) {
    // Weighted Perceptual Redmean
    const rbar = (r1 + r2) / 2;
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return (2 + rbar / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rbar) / 256) * db * db;
  } else {
    // Luma-Priority
    const lum1 = 0.299 * r1 + 0.587 * g1 + 0.114 * b1;
    const lum2 = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;
    const dlum = lum1 - lum2;
    return dlum * dlum * 3 + (r1 - r2) ** 2 * 0.3 + (b1 - b2) ** 2 * 0.3;
  }
}

export function findClosestPaletteColor(
  r: number, g: number, b: number,
  paletteRgb: [number, number, number][],
  mode: 1 | 2 | 3 = 1
): [number, number, number] {
  if (paletteRgb.length === 0) return [r, g, b];
  let best = paletteRgb[0];
  let minD = colorDistance(r, g, b, best[0], best[1], best[2], mode);

  for (let i = 1; i < paletteRgb.length; i++) {
    const p = paletteRgb[i];
    const d = colorDistance(r, g, b, p[0], p[1], p[2], mode);
    if (d < minD) {
      minD = d;
      best = p;
    }
  }
  return best;
}

export function extractAdaptivePalette(
  data: Uint8ClampedArray,
  count: number = 18
): [number, number, number][] {
  const step = Math.max(1, Math.floor(data.length / (4 * 1500)));
  const samples: [number, number, number][] = [];
  for (let i = 0; i < data.length; i += step * 4) {
    if (data[i + 3] > 64) {
      samples.push([data[i], data[i + 1], data[i + 2]]);
    }
  }

  if (samples.length <= count) {
    return samples.length > 0 ? samples : [[0, 0, 0], [255, 255, 255]];
  }

  // Median-cut algorithm
  let buckets: [number, number, number][][] = [samples];
  while (buckets.length < count) {
    // Find bucket with largest range
    let bestIdx = -1;
    let maxRange = -1;
    let splitChannel = 0;

    for (let b = 0; b < buckets.length; b++) {
      const bucket = buckets[b];
      if (bucket.length < 2) continue;
      let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
      for (const [r, g, bVal] of bucket) {
        if (r < minR) minR = r; if (r > maxR) maxR = r;
        if (g < minG) minG = g; if (g > maxG) maxG = g;
        if (bVal < minB) minB = bVal; if (bVal > maxB) maxB = bVal;
      }
      const rangeR = maxR - minR;
      const rangeG = maxG - minG;
      const rangeB = maxB - minB;
      const range = Math.max(rangeR, rangeG, rangeB);
      if (range > maxRange) {
        maxRange = range;
        bestIdx = b;
        splitChannel = range === rangeR ? 0 : range === rangeG ? 1 : 2;
      }
    }

    if (bestIdx === -1 || maxRange === 0) break;

    const targetBucket = buckets[bestIdx];
    targetBucket.sort((a, b) => a[splitChannel] - b[splitChannel]);
    const mid = Math.floor(targetBucket.length / 2);
    buckets.splice(bestIdx, 1, targetBucket.slice(0, mid), targetBucket.slice(mid));
  }

  return buckets.map((bucket) => {
    let sumR = 0, sumG = 0, sumB = 0;
    for (const [r, g, b] of bucket) {
      sumR += r; sumG += g; sumB += b;
    }
    const len = bucket.length || 1;
    return [Math.round(sumR / len), Math.round(sumG / len), Math.round(sumB / len)];
  });
}

export function applyIndexedDither(
  srcCanvas: HTMLCanvasElement,
  options: {
    algorithm?: DitherAlgorithm;
    paletteColors?: string[];
    paletteMode?: string;
    colorCount?: number;
    distanceMode?: 1 | 2 | 3;
    ditherStrength?: number;
    gamma?: number;
    pixelStep?: number;
  } = {}
): HTMLCanvasElement {
  const {
    algorithm = 'floyd_steinberg',
    paletteColors,
    paletteMode = 'adaptive',
    colorCount = 18,
    distanceMode = 1,
    ditherStrength = 1.0,
    gamma = 1.0,
    pixelStep = 2,
  } = options;

  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;

  const srcCtx = srcCanvas.getContext('2d')!;
  const srcImg = srcCtx.getImageData(0, 0, w, h);
  const sd = srcImg.data;

  // Resolve palette
  let paletteRgb: [number, number, number][] = [];
  if (paletteColors && paletteColors.length > 0) {
    paletteRgb = paletteColors.map(hexToRgb);
  } else if (paletteMode === 'adaptive') {
    paletteRgb = extractAdaptivePalette(sd, colorCount);
  } else if (BUILTIN_PALETTES[paletteMode]?.colors.length > 0) {
    paletteRgb = BUILTIN_PALETTES[paletteMode].colors.map(hexToRgb);
  } else {
    paletteRgb = [[0, 0, 0], [255, 255, 255]];
  }

  // Pixel step downsample grid
  const step = Math.max(1, Math.min(16, pixelStep));
  const gw = Math.ceil(w / step);
  const gh = Math.ceil(h / step);

  // Floating point color buffers
  const bufR = new Float32Array(gw * gh);
  const bufG = new Float32Array(gw * gh);
  const bufB = new Float32Array(gw * gh);
  const bufA = new Float32Array(gw * gh);

  const invGamma = 1 / Math.max(0.1, gamma);

  // Initialize grid
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const sx = Math.min(w - 1, gx * step);
      const sy = Math.min(h - 1, gy * step);
      const sIdx = (sy * w + sx) * 4;
      const gIdx = gy * gw + gx;

      let r = sd[sIdx] / 255;
      let g = sd[sIdx + 1] / 255;
      let b = sd[sIdx + 2] / 255;

      if (gamma !== 1.0) {
        r = Math.pow(r, invGamma);
        g = Math.pow(g, invGamma);
        b = Math.pow(b, invGamma);
      }

      bufR[gIdx] = r * 255;
      bufG[gIdx] = g * 255;
      bufB[gIdx] = b * 255;
      bufA[gIdx] = sd[sIdx + 3];
    }
  }

  const outData = ctx.createImageData(w, h);
  const od = outData.data;

  // Ordered dithering matrices threshold check
  const isOrdered = algorithm.startsWith('bayer_') || algorithm === 'clustered_dot' || algorithm === 'blue_noise' || algorithm === 'white_noise' || algorithm === 'horizontal_lines' || algorithm === 'diagonal_hatch';

  if (isOrdered) {
    let matrix: number[][] = BAYER_4;
    let mSize = 4;
    let mMax = 16;

    if (algorithm === 'bayer_2x2') { matrix = BAYER_2; mSize = 2; mMax = 4; }
    else if (algorithm === 'bayer_4x4') { matrix = BAYER_4; mSize = 4; mMax = 16; }
    else if (algorithm === 'bayer_8x8' || algorithm === 'bayer_16x16') { matrix = BAYER_8; mSize = 8; mMax = 64; }

    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        const gIdx = gy * gw + gx;
        if (bufA[gIdx] === 0) continue;

        let r = bufR[gIdx];
        let g = bufG[gIdx];
        let b = bufB[gIdx];

        let thresh = 0;
        if (algorithm === 'white_noise') {
          thresh = (Math.random() - 0.5) * ditherStrength * 50;
        } else if (algorithm === 'blue_noise') {
          thresh = (((gx * 67 + gy * 79) % 255) / 255 - 0.5) * ditherStrength * 50;
        } else if (algorithm === 'horizontal_lines') {
          thresh = ((gy % 2 === 0 ? 1 : -1) * 20) * ditherStrength;
        } else if (algorithm === 'diagonal_hatch') {
          thresh = (((gx + gy) % 3 === 0 ? 1 : -1) * 25) * ditherStrength;
        } else {
          const mVal = matrix[gy % mSize][gx % mSize];
          thresh = (mVal / mMax - 0.5) * ditherStrength * 64;
        }

        r = Math.max(0, Math.min(255, r + thresh));
        g = Math.max(0, Math.min(255, g + thresh));
        b = Math.max(0, Math.min(255, b + thresh));

        const [cr, cg, cb] = findClosestPaletteColor(r, g, b, paletteRgb, distanceMode);

        // Fill target pixel block
        for (let py = 0; py < step && gy * step + py < h; py++) {
          for (let px = 0; px < step && gx * step + px < w; px++) {
            const outIdx = ((gy * step + py) * w + (gx * step + px)) * 4;
            od[outIdx] = cr;
            od[outIdx + 1] = cg;
            od[outIdx + 2] = cb;
            od[outIdx + 3] = bufA[gIdx];
          }
        }
      }
    }
  } else {
    // Error Diffusion Kernels
    // Distribute quantization error to neighboring pixels
    const str = ditherStrength;

    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        const gIdx = gy * gw + gx;
        if (bufA[gIdx] === 0) continue;

        const curR = Math.max(0, Math.min(255, bufR[gIdx]));
        const curG = Math.max(0, Math.min(255, bufG[gIdx]));
        const curB = Math.max(0, Math.min(255, bufB[gIdx]));

        const [cr, cg, cb] = findClosestPaletteColor(curR, curG, curB, paletteRgb, distanceMode);

        const errR = (curR - cr) * str;
        const errG = (curG - cg) * str;
        const errB = (curB - cb) * str;

        const spread = (dx: number, dy: number, factor: number) => {
          const nx = gx + dx;
          const ny = gy + dy;
          if (nx >= 0 && nx < gw && ny >= 0 && ny < gh) {
            const nIdx = ny * gw + nx;
            bufR[nIdx] += errR * factor;
            bufG[nIdx] += errG * factor;
            bufB[nIdx] += errB * factor;
          }
        };

        if (algorithm === 'atkinson') {
          const f = 1 / 8;
          spread(1, 0, f); spread(2, 0, f);
          spread(-1, 1, f); spread(0, 1, f); spread(1, 1, f);
          spread(0, 2, f);
        } else if (algorithm === 'jarvis') {
          const f = 1 / 48;
          spread(1, 0, 7 * f); spread(2, 0, 5 * f);
          spread(-2, 1, 3 * f); spread(-1, 1, 5 * f); spread(0, 1, 7 * f); spread(1, 1, 5 * f); spread(2, 1, 3 * f);
          spread(-2, 2, 1 * f); spread(-1, 2, 3 * f); spread(0, 2, 5 * f); spread(1, 2, 3 * f); spread(2, 2, 1 * f);
        } else if (algorithm === 'stucki') {
          const f = 1 / 42;
          spread(1, 0, 8 * f); spread(2, 0, 4 * f);
          spread(-2, 1, 2 * f); spread(-1, 1, 4 * f); spread(0, 1, 8 * f); spread(1, 1, 4 * f); spread(2, 1, 2 * f);
          spread(-2, 2, 1 * f); spread(-1, 2, 2 * f); spread(0, 2, 4 * f); spread(1, 2, 2 * f); spread(2, 2, 1 * f);
        } else if (algorithm === 'burkes') {
          const f = 1 / 32;
          spread(1, 0, 8 * f); spread(2, 0, 4 * f);
          spread(-2, 1, 2 * f); spread(-1, 1, 4 * f); spread(0, 1, 8 * f); spread(1, 1, 4 * f); spread(2, 1, 2 * f);
        } else if (algorithm === 'sierra3') {
          const f = 1 / 32;
          spread(1, 0, 5 * f); spread(2, 0, 3 * f);
          spread(-2, 1, 2 * f); spread(-1, 1, 4 * f); spread(0, 1, 5 * f); spread(1, 1, 4 * f); spread(2, 1, 2 * f);
          spread(-1, 2, 2 * f); spread(0, 2, 3 * f); spread(1, 2, 2 * f);
        } else if (algorithm === 'sierra2') {
          const f = 1 / 16;
          spread(1, 0, 4 * f); spread(2, 0, 3 * f);
          spread(-2, 1, 1 * f); spread(-1, 1, 2 * f); spread(0, 1, 3 * f); spread(1, 1, 2 * f); spread(2, 1, 1 * f);
        } else if (algorithm === 'sierra_lite') {
          const f = 1 / 4;
          spread(1, 0, 2 * f);
          spread(-1, 1, 1 * f); spread(0, 1, 1 * f);
        } else {
          // Floyd-Steinberg (standard)
          const f = 1 / 16;
          spread(1, 0, 7 * f);
          spread(-1, 1, 3 * f);
          spread(0, 1, 5 * f);
          spread(1, 1, 1 * f);
        }

        // Fill target pixel block
        for (let py = 0; py < step && gy * step + py < h; py++) {
          for (let px = 0; px < step && gx * step + px < w; px++) {
            const outIdx = ((gy * step + py) * w + (gx * step + px)) * 4;
            od[outIdx] = cr;
            od[outIdx + 1] = cg;
            od[outIdx + 2] = cb;
            od[outIdx + 3] = bufA[gIdx];
          }
        }
      }
    }
  }

  ctx.putImageData(outData, 0, 0);
  return out;
}

// ----------------- TAB 2: MACPAINT 1-BIT PATTERN DITHER -----------------

// 38 classic 8x8 Susan Kare / MacPaint bitmasks represented as 8 hex bytes
export const MACPAINT_38_PATTERNS: number[][] = [
  [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], // 0: White
  [0x80, 0x00, 0x08, 0x00, 0x80, 0x00, 0x08, 0x00], // 1: Sparsest dots
  [0x88, 0x00, 0x22, 0x00, 0x88, 0x00, 0x22, 0x00], // 2: Light stipple
  [0xaa, 0x00, 0x55, 0x00, 0xaa, 0x00, 0x55, 0x00], // 3: Checker sparse
  [0x88, 0x55, 0x22, 0x55, 0x88, 0x55, 0x22, 0x55], // 4: Mid stipple
  [0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55], // 5: Standard 50% checkerboard
  [0xbb, 0x55, 0xee, 0x55, 0xbb, 0x55, 0xee, 0x55], // 6: Dense stipple
  [0x77, 0xff, 0xdd, 0xff, 0x77, 0xff, 0xdd, 0xff], // 7: Near solid
  [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff], // 8: 100% Solid Black
  [0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa], // 9: Vertical pinstripes
  [0xff, 0x00, 0xff, 0x00, 0xff, 0x00, 0xff, 0x00], // 10: Horizontal stripes
  [0x80, 0x40, 0x20, 0x10, 0x08, 0x04, 0x02, 0x01], // 11: 45° diagonal right
  [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80], // 12: 45° diagonal left
  [0x81, 0x42, 0x24, 0x18, 0x18, 0x24, 0x42, 0x81], // 13: Diagonal cross
  [0xcc, 0xcc, 0x33, 0x33, 0xcc, 0xcc, 0x33, 0x33], // 14: 2x2 Checker
  [0xf0, 0xf0, 0xf0, 0xf0, 0x0f, 0x0f, 0x0f, 0x0f], // 15: 4x4 Checker
  [0x88, 0x88, 0x88, 0xff, 0x88, 0x88, 0x88, 0xff], // 16: Grid lines
  [0xee, 0xee, 0xee, 0x00, 0xee, 0xee, 0xee, 0x00], // 17: Brick pattern
  [0x18, 0x24, 0x42, 0x81, 0x81, 0x42, 0x24, 0x18], // 18: Diamond weave
  [0x36, 0x5c, 0x38, 0x74, 0x2c, 0x58, 0xb0, 0x60], // 19: Basketweave
  [0x0f, 0x1e, 0x3c, 0x78, 0xf0, 0xe1, 0xc3, 0x87], // 20: Thick diagonal
  [0x33, 0x33, 0xcc, 0xcc, 0x33, 0x33, 0xcc, 0xcc], // 21: Houndstooth
  [0x7f, 0xbf, 0xdf, 0xef, 0xf7, 0xfb, 0xfd, 0xfe], // 22: Thin diagonal white line
  [0x11, 0x22, 0x44, 0x88, 0x11, 0x22, 0x44, 0x88], // 23: Diagonal dots
  [0x99, 0x66, 0x99, 0x66, 0x99, 0x66, 0x99, 0x66], // 24: Honeycomb
  [0x00, 0x7e, 0x42, 0x42, 0x42, 0x42, 0x7e, 0x00], // 25: Square frame
  [0x24, 0x00, 0x81, 0x00, 0x24, 0x00, 0x81, 0x00], // 26: Starfield
  [0x08, 0x14, 0x22, 0x41, 0x80, 0x41, 0x22, 0x14], // 27: Chevron
  [0xc3, 0x81, 0x00, 0x00, 0x00, 0x00, 0x81, 0xc3], // 28: Scales
  [0x55, 0x22, 0x55, 0x88, 0x55, 0x22, 0x55, 0x88], // 29: Dotted weave
  [0x38, 0x44, 0x92, 0xaa, 0xaa, 0x49, 0x22, 0x1c], // 30: Fish scale
  [0x6b, 0x2f, 0xb6, 0xf2, 0x6b, 0x2f, 0xb6, 0xf2], // 31: Cobblestone
  [0x1c, 0x22, 0x41, 0x80, 0x41, 0x22, 0x1c, 0x00], // 32: Oval circle
  [0x48, 0xa5, 0x48, 0xa5, 0x48, 0xa5, 0x48, 0xa5], // 33: Woven cloth
  [0x20, 0x50, 0x88, 0x05, 0x02, 0x50, 0x88, 0x05], // 34: Random texture
  [0x00, 0x3c, 0x42, 0x42, 0x42, 0x42, 0x3c, 0x00], // 35: Rounded rect
  [0xa0, 0x50, 0xa8, 0x54, 0xa2, 0x51, 0xa0, 0x50], // 36: Shaded wood
  [0xff, 0x81, 0xbd, 0xa5, 0xa5, 0xbd, 0x81, 0xff], // 37: Concentric box
];

export function applyMacPaintDither(
  srcCanvas: HTMLCanvasElement,
  options: {
    bitmapWidth?: number;  // 128 to 3000, default 1024
    threshold?: number;    // 0.000 to 1.000, default 0.354
    contrast?: number;     // 0.10 to 5.00, default 2.50
    grain?: number;        // 0.00 to 1.00, default 0.00
    smooth?: number;       // 0 to 10, default 1
    sharpen?: number;      // -2.00 to 2.00, default -0.83
    radius?: number;       // 0.1 to 10.0, default 1.2
    inkColor?: string;     // default #000000
    paperColor?: string;   // default #ffffff
    transparentPaper?: boolean;
    activePatterns?: number[]; // indices of active patterns in ramp
  } = {}
): HTMLCanvasElement {
  const {
    bitmapWidth = 1024,
    threshold = 0.354,
    contrast = 2.50,
    grain = 0.00,
    smooth = 1,
    sharpen = -0.83,
    radius = 1.2,
    inkColor = '#000000',
    paperColor = '#ffffff',
    transparentPaper = false,
    activePatterns,
  } = options;

  const w = srcCanvas.width;
  const h = srcCanvas.height;

  // Scale to target bitmap width
  const scale = Math.max(0.1, bitmapWidth / w);
  const bw = Math.max(64, Math.round(w * scale));
  const bh = Math.max(64, Math.round(h * scale));

  const scaled = document.createElement('canvas');
  scaled.width = bw;
  scaled.height = bh;
  const sCtx = scaled.getContext('2d')!;

  if (smooth > 0) {
    sCtx.filter = `blur(${smooth * 0.5}px)`;
  }
  sCtx.drawImage(srcCanvas, 0, 0, bw, bh);
  sCtx.filter = 'none';

  const srcImg = sCtx.getImageData(0, 0, bw, bh);
  const sd = srcImg.data;

  const out = document.createElement('canvas');
  out.width = bw;
  out.height = bh;
  const outCtx = out.getContext('2d')!;
  const outImg = outCtx.createImageData(bw, bh);
  const od = outImg.data;

  const [ir, ig, ib] = hexToRgb(inkColor);
  const [pr, pg, pb] = hexToRgb(paperColor);

  const patternIndices = activePatterns && activePatterns.length > 0
    ? activePatterns
    : [0, 1, 2, 3, 5, 6, 7, 8];

  const patterns = patternIndices.map((idx) => MACPAINT_38_PATTERNS[idx % MACPAINT_38_PATTERNS.length]);

  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const idx = (y * bw + x) * 4;
      if (sd[idx + 3] === 0) continue;

      let luma = (0.299 * sd[idx] + 0.587 * sd[idx + 1] + 0.114 * sd[idx + 2]) / 255;

      // Apply contrast & threshold center
      luma = (luma - threshold) * contrast + 0.5;

      // Apply grain noise
      if (grain > 0) {
        luma += (Math.random() - 0.5) * grain;
      }

      // Sharpen high-frequency contrast
      if (sharpen !== 0) {
        luma += (luma - 0.5) * sharpen * 0.5;
      }

      if (Number.isNaN(luma)) luma = 0.5;
      luma = Math.max(0, Math.min(1, luma));

      // Map luma into available patterns
      const pIdx = Math.max(0, Math.min(patterns.length - 1, Math.floor(luma * patterns.length)));
      const pat = patterns[pIdx] || MACPAINT_38_PATTERNS[0];

      // 8x8 bitmask check
      const byte = pat[y % 8] ?? 0;
      const bit = (byte >> (7 - (x % 8))) & 1;

      if (bit === 1) {
        // Ink pixel
        od[idx] = ir;
        od[idx + 1] = ig;
        od[idx + 2] = ib;
        od[idx + 3] = 255;
      } else {
        // Paper pixel
        if (transparentPaper) {
          od[idx + 3] = 0;
        } else {
          od[idx] = pr;
          od[idx + 1] = pg;
          od[idx + 2] = pb;
          od[idx + 3] = 255;
        }
      }
    }
  }

  outCtx.putImageData(outImg, 0, 0);

  // Scale back to original dimensions for final output
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = w;
  finalCanvas.height = h;
  const fCtx = finalCanvas.getContext('2d')!;
  fCtx.imageSmoothingEnabled = false;
  fCtx.drawImage(out, 0, 0, w, h);
  return finalCanvas;
}

// ----------------- TAB 3: MULTI-INK CMYK HALFTONE SCREEN PRESS -----------------

export interface HalftoneInkChannel {
  enabled: boolean;
  color: string;
  angle: number; // degrees, e.g. 15, 75, 0, 45
  shiftX: number; // -2.00 to 2.00
  shiftY: number; // -2.00 to 2.00
}

export function applyCmykHalftoneScreen(
  srcCanvas: HTMLCanvasElement,
  options: {
    screenShape?: 'round' | 'square' | 'diamond' | 'cross_hatch' | 'line';
    frequency?: number; // 10 to 300, default 161
    paperColor?: string; // default #ffffff
    blackGeneration?: number; // 0.00 to 1.00, default 0.50
    totalInk?: number; // 100 to 400, default 300
    dotGain?: number; // 0.00 to 0.50, default 0.05
    inkDensity?: number; // 0.00 to 2.00, default 1.00
    edgeRoughness?: number; // 0.00 to 1.00, default 0.30
    seed?: number; // 0 to 100
    inks?: HalftoneInkChannel[];
  } = {}
): HTMLCanvasElement {
  const {
    screenShape = 'round',
    frequency = 161,
    paperColor = '#ffffff',
    blackGeneration = 0.50,
    totalInk = 300,
    dotGain = 0.05,
    inkDensity = 1.00,
    edgeRoughness = 0.30,
    seed = 0,
    inks = [
      { enabled: true, color: '#00ffff', angle: 15, shiftX: 0, shiftY: 0 },
      { enabled: true, color: '#ff00ff', angle: 75, shiftX: 0, shiftY: 0 },
      { enabled: true, color: '#ffff00', angle: 0, shiftX: 0, shiftY: 0 },
      { enabled: true, color: '#000000', angle: 45, shiftX: 0, shiftY: 0 },
    ],
  } = options;

  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;

  // Fill paper
  ctx.fillStyle = paperColor;
  ctx.fillRect(0, 0, w, h);

  const srcCtx = srcCanvas.getContext('2d')!;
  const srcImg = srcCtx.getImageData(0, 0, w, h);
  const sd = srcImg.data;

  // Dot cell grid size based on frequency
  const cellSize = Math.max(3, Math.round(w / Math.max(10, frequency)));

  inks.forEach((ink) => {
    if (!ink.enabled) return;

    const rad = (ink.angle * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = Math.max(0, Math.min(1, inkDensity));
    ctx.fillStyle = ink.color;

    // Shift offset in pixels
    const offX = ink.shiftX * cellSize * 0.5;
    const offY = ink.shiftY * cellSize * 0.5;

    const maxRadius = (cellSize / 2) * (1 + dotGain * 2);

    for (let cy = -cellSize; cy < h + cellSize; cy += cellSize) {
      for (let cx = -cellSize; cx < w + cellSize; cx += cellSize) {
        // Rotate grid cell
        const rx = cx * cosA - cy * sinA + offX;
        const ry = cx * sinA + cy * cosA + offY;

        const sx = Math.max(0, Math.min(w - 1, Math.round(rx)));
        const sy = Math.max(0, Math.min(h - 1, Math.round(ry)));
        const sIdx = (sy * w + sx) * 4;

        if (sd[sIdx + 3] === 0) continue;

        // Sample CMYK intensity
        const r = sd[sIdx] / 255;
        const g = sd[sIdx + 1] / 255;
        const b = sd[sIdx + 2] / 255;

        const k = (1 - Math.max(r, g, b)) * blackGeneration;
        const c = k < 1 ? (1 - r - k) / (1 - k) : 0;
        const m = k < 1 ? (1 - g - k) / (1 - k) : 0;
        const y = k < 1 ? (1 - b - k) / (1 - k) : 0;

        let dotVal = 0;
        if (ink.color.toLowerCase() === '#00ffff' || ink.color.toLowerCase().includes('cyan')) dotVal = c;
        else if (ink.color.toLowerCase() === '#ff00ff' || ink.color.toLowerCase().includes('magenta') || ink.color.toLowerCase().includes('pink')) dotVal = m;
        else if (ink.color.toLowerCase() === '#ffff00' || ink.color.toLowerCase().includes('yellow')) dotVal = y;
        else if (ink.color.toLowerCase() === '#000000' || ink.color.toLowerCase().includes('black')) dotVal = k;
        else dotVal = 1 - (0.299 * r + 0.587 * g + 0.114 * b);

        dotVal = Math.min(1, dotVal * (totalInk / 300));
        if (dotVal <= 0.02) continue;

        const dotRadius = dotVal * maxRadius;

        ctx.beginPath();
        if (screenShape === 'square') {
          ctx.rect(rx - dotRadius, ry - dotRadius, dotRadius * 2, dotRadius * 2);
        } else if (screenShape === 'diamond') {
          ctx.moveTo(rx, ry - dotRadius);
          ctx.lineTo(rx + dotRadius, ry);
          ctx.lineTo(rx, ry + dotRadius);
          ctx.lineTo(rx - dotRadius, ry);
          ctx.closePath();
        } else if (screenShape === 'line') {
          ctx.rect(rx - cellSize / 2, ry - dotRadius / 2, cellSize, dotRadius);
        } else {
          // Round
          ctx.arc(rx, ry, dotRadius, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }
    ctx.restore();
  });

  return out;
}

// ----------------- TAB 4: FM / CRT SIGNAL MODULATION -----------------

export function applySignalModulation(
  srcCanvas: HTMLCanvasElement,
  options: {
    resolution?: number;      // 128 to 2048, default 2048
    waveScale?: number;       // 10 to 400, default 60
    fmSensitivity?: number;   // 0.00 to 2.00, default 1.00
    signalStrength?: number;  // 0.1 to 10.0, default 0.1
    waveDirection?: number;   // 0 = Vertical, 1 = Horizontal, 2 = Diagonal
    phase?: number;           // 0.00 to 10.00, default 0.00
    lineWidth?: number;       // 0.50 to 10.00, default 1.89
    redChannel?: boolean;
    greenChannel?: boolean;
    blueChannel?: boolean;
  } = {}
): HTMLCanvasElement {
  const {
    resolution = 2048,
    waveScale = 60,
    fmSensitivity = 1.00,
    signalStrength = 0.1,
    waveDirection = 0,
    phase = 0.00,
    lineWidth = 1.89,
    redChannel = true,
    greenChannel = true,
    blueChannel = true,
  } = options;

  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;

  const srcCtx = srcCanvas.getContext('2d')!;
  const srcImg = srcCtx.getImageData(0, 0, w, h);
  const sd = srcImg.data;

  const outImg = ctx.createImageData(w, h);
  const od = outImg.data;

  const freq = 1 / Math.max(1, waveScale);
  const linePeriod = Math.max(2, lineWidth * 3);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (sd[idx + 3] === 0) continue;

      const r = sd[idx];
      const g = sd[idx + 1];
      const b = sd[idx + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;

      // FM Frequency Modulation: coordinate modulated by luminance signal
      let coord = 0;
      if (waveDirection === 0) coord = x;
      else if (waveDirection === 1) coord = y;
      else coord = (x + y) * 0.707;

      const modOffset = Math.sin(coord * freq + (luma / 255) * fmSensitivity * 10 + phase) * signalStrength * 25;
      const scanVal = Math.sin((coord + modOffset) * (Math.PI * 2 / linePeriod));

      const amp = Math.max(0, (scanVal + 1) / 2);

      od[idx] = redChannel ? Math.min(255, Math.round(r * amp)) : 0;
      od[idx + 1] = greenChannel ? Math.min(255, Math.round(g * amp)) : 0;
      od[idx + 2] = blueChannel ? Math.min(255, Math.round(b * amp)) : 0;
      od[idx + 3] = sd[idx + 3];
    }
  }

  ctx.putImageData(outImg, 0, 0);
  return out;
}
