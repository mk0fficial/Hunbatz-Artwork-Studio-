/**
 * Comprehensive Filter Effects Engine for Procreate & Photoshop Studio
 * Includes Glitches, Blurs, Halftone, Bloom, Chromatic Aberration, Curves, Gradient Map, Pixel Sort
 */

import { applyVhsFilter, applyLedScreen } from './glitchStudioEngine';
import { applyThermalEffectToImageData } from './canvasAdjustments';

export interface FilterParams {
  amount: number; // 0 to 100
  secondaryAmount?: number; // 0 to 100
  palette?: string;
  angle?: number;
}

/**
 * Creates a duplicate canvas with dimensions matching source
 */
function cloneCanvas(src: HTMLCanvasElement): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  return { canvas, ctx };
}

/**
 * 1. RGB Offset Glitch (Uniform & Individual Channel Mode)
 */
export function applyRgbOffset(
  src: HTMLCanvasElement,
  shiftAmount: number,
  modeOrGreenShift: number = 0,
  blueShiftParam: number = 0
): HTMLCanvasElement {
  const { canvas, ctx } = cloneCanvas(src);
  const w = canvas.width;
  const h = canvas.height;
  const maxShift = w * 0.08;

  // If modeOrGreenShift != 0 or blueShiftParam != 0, treat as individual channel shifts
  const isIndividual = modeOrGreenShift !== 0 || blueShiftParam !== 0;
  const redShift = Math.round((shiftAmount / 100) * maxShift);
  const greenShift = isIndividual ? Math.round(((modeOrGreenShift - 50) / 50) * maxShift) : 0;
  const blueShift = isIndividual ? Math.round(((blueShiftParam - 50) / 50) * maxShift) : -redShift;

  if (redShift === 0 && greenShift === 0 && blueShift === 0) return canvas;

  const srcImg = src.getContext('2d')!.getImageData(0, 0, w, h);
  const outImg = ctx.createImageData(w, h);
  const s = srcImg.data;
  const o = outImg.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const redX = Math.max(0, Math.min(w - 1, x + redShift));
      const greenX = Math.max(0, Math.min(w - 1, x + greenShift));
      const blueX = Math.max(0, Math.min(w - 1, x + blueShift));

      const redIdx = (y * w + redX) * 4;
      const greenIdx = (y * w + greenX) * 4;
      const blueIdx = (y * w + blueX) * 4;

      o[idx] = s[redIdx]; // Red
      o[idx + 1] = s[greenIdx + 1]; // Green
      o[idx + 2] = s[blueIdx + 2]; // Blue
      o[idx + 3] = Math.max(s[idx + 3], s[redIdx + 3], s[greenIdx + 3], s[blueIdx + 3]);
    }
  }

  ctx.putImageData(outImg, 0, 0);
  return canvas;
}

/**
 * 2. Channel Swap Glitch - 12+ Creative Modes
 */
export function applyChannelSwap(src: HTMLCanvasElement, mode: number = 0): HTMLCanvasElement {
  const { canvas, ctx } = cloneCanvas(src);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    switch (mode % 12) {
      case 0: // GBR
        d[i] = g; d[i + 1] = b; d[i + 2] = r; break;
      case 1: // BRG
        d[i] = b; d[i + 1] = r; d[i + 2] = g; break;
      case 2: // BGR
        d[i] = b; d[i + 1] = g; d[i + 2] = r; break;
      case 3: // RBG
        d[i] = r; d[i + 1] = b; d[i + 2] = g; break;
      case 4: // Invert Red Only
        d[i] = 255 - r; d[i + 1] = g; d[i + 2] = b; break;
      case 5: // Chroma Swap (extreme saturation)
        d[i] = Math.max(r, g); d[i + 1] = Math.min(g, b); d[i + 2] = Math.max(r, b); break;
      case 6: { // Heatmap Gradient
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        d[i] = Math.min(255, Math.round(lum * 2 * 255));
        d[i + 1] = Math.min(255, Math.round((1 - Math.abs(lum - 0.5) * 2) * 255));
        d[i + 2] = Math.min(255, Math.round((1 - lum) * 255));
        break;
      }
      case 7: // Glitch Art bitwise
        d[i] = (r ^ g) & 0xff; d[i + 1] = (g ^ b) & 0xff; d[i + 2] = (b ^ r) & 0xff; break;
      case 8: // Cyan / Orange Split
        d[i] = Math.min(255, Math.round(r * 1.3));
        d[i + 1] = Math.min(255, Math.round(g * 0.9));
        d[i + 2] = Math.min(255, Math.round(b * 1.4));
        break;
      case 9: // Infrared False Color
        d[i] = b; d[i + 1] = r; d[i + 2] = g; break;
      case 10: { // Luma Inverse
        const luma = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        d[i] = 255 - luma; d[i + 1] = 255 - luma; d[i + 2] = 255 - luma;
        break;
      }
      case 11: // Neon Night
        d[i] = Math.min(255, Math.round(r * 0.3 + g * 0.7));
        d[i + 1] = Math.min(255, Math.round(b * 1.2));
        d[i + 2] = Math.min(255, Math.round((255 - r) * 0.8));
        break;
      case 12: { // Grayscale High-Contrast Luma
        const lum = Math.min(255, Math.max(0, Math.round((0.299 * r + 0.587 * g + 0.114 * b) * 1.2 - 20)));
        d[i] = lum; d[i + 1] = lum; d[i + 2] = lum; break;
      }
      case 13: { // Sepia Amber Vintage
        d[i] = Math.min(255, Math.round(r * 0.393 + g * 0.769 + b * 0.189));
        d[i + 1] = Math.min(255, Math.round(r * 0.349 + g * 0.686 + b * 0.168));
        d[i + 2] = Math.min(255, Math.round(r * 0.272 + g * 0.534 + b * 0.131));
        break;
      }
      case 14: // Invert Green Channel
        d[i] = r; d[i + 1] = 255 - g; d[i + 2] = b; break;
      case 15: // Invert Blue Channel
        d[i] = r; d[i + 1] = g; d[i + 2] = 255 - b; break;
      case 16: { // Monochrome Cyanotype
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        d[i] = Math.min(255, Math.round(luma * 0.2));
        d[i + 1] = Math.min(255, Math.round(luma * 0.65));
        d[i + 2] = Math.min(255, Math.round(luma * 1.1));
        break;
      }
      case 17: { // Solarized Magenta
        d[i] = Math.min(255, Math.round(Math.abs(128 - g) * 2 + r * 0.5));
        d[i + 1] = Math.min(255, Math.round(g * 0.3));
        d[i + 2] = Math.min(255, Math.round(b * 1.3));
        break;
      }
      case 18: // Thermal Vision
        d[i] = b; d[i + 1] = Math.round(0.299 * r + 0.587 * g + 0.114 * b); d[i + 2] = r; break;
      case 19: // Emerald Forest
        d[i] = Math.round(r * 0.4); d[i + 1] = Math.min(255, Math.round(g * 1.35)); d[i + 2] = Math.round(b * 0.5); break;
      case 20: // Golden Hour Sunset
        d[i] = Math.min(255, Math.round(r * 1.4)); d[i + 1] = Math.min(255, Math.round(g * 1.1)); d[i + 2] = Math.round(b * 0.6); break;
      case 21: // Cyberpunk Ultraviolet
        d[i] = Math.min(255, Math.round(b * 1.25)); d[i + 1] = Math.round(r * 0.35); d[i + 2] = Math.min(255, Math.round(255 - g * 0.8)); break;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * 3. Channel Reflector Glitch
 */
export function applyChannelReflector(src: HTMLCanvasElement, amount: number): HTMLCanvasElement {
  const { canvas, ctx } = cloneCanvas(src);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  const factor = amount / 100;

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    d[i] = Math.min(255, Math.abs(255 - d[i] * 2) * factor + d[i] * (1 - factor));
    d[i + 2] = Math.min(255, Math.abs(255 - d[i + 2] * 2) * factor + d[i + 2] * (1 - factor));
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * 4. Scanlines Glitch
 */
export function applyScanlines(src: HTMLCanvasElement, density: number, opacity: number): HTMLCanvasElement {
  const { canvas, ctx } = cloneCanvas(src);
  const lineSpacing = Math.max(2, Math.round(12 - (density / 100) * 8));
  ctx.fillStyle = `rgba(0, 0, 0, ${(opacity / 100) * 0.6})`;
  for (let y = 0; y < canvas.height; y += lineSpacing) {
    ctx.fillRect(0, y, canvas.width, 1);
  }
  return canvas;
}

export interface PixelSortConfig {
  threshold?: number;
  upperThreshold?: number;
  startXOffset?: number;
  startYOffset?: number;
  direction?: 'horizontal' | 'vertical';
  sortMode?: 'luminance' | 'brightness' | 'hue' | 'saturation' | 'intensity';
  seed?: number;
  invert?: boolean;
}

/**
 * 5. Pixel Sort Glitch - Expanded Range & Multi-Channel Sorting
 */
export function applyPixelSort(
  src: HTMLCanvasElement,
  thresholdOrConfig: number | PixelSortConfig,
  seed: number = 0,
  extraConfig?: any
): HTMLCanvasElement {
  const { canvas, ctx } = cloneCanvas(src);
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  // Resolve config object or numeric args
  const cfg: PixelSortConfig =
    typeof thresholdOrConfig === 'object' && thresholdOrConfig !== null
      ? thresholdOrConfig
      : {
          threshold: thresholdOrConfig,
          upperThreshold: extraConfig?.upperThreshold ?? 100,
          startXOffset: extraConfig?.startXOffset ?? extraConfig?.offsetX ?? 0,
          startYOffset: extraConfig?.startYOffset ?? extraConfig?.offsetY ?? 0,
          direction: extraConfig?.direction || 'horizontal',
          sortMode: extraConfig?.sortMode || 'luminance',
          seed: seed || extraConfig?.seed || 0,
          invert: Boolean(extraConfig?.invert),
        };

  const threshold = cfg.threshold ?? 35;
  const upperThreshold = cfg.upperThreshold ?? 100;
  const threshMin = (Math.min(threshold, upperThreshold) / 100) * 255;
  const threshMax = (Math.max(threshold, upperThreshold) / 100) * 255;
  const sVal = cfg.seed ?? seed ?? 0;
  const direction = cfg.direction || 'horizontal';
  const sortMode = cfg.sortMode || 'luminance';
  const invert = Boolean(cfg.invert);

  // Safe modulo helper to strictly prevent negative array indices
  const safeMod = (n: number, m: number) => ((n % m) + m) % m;

  // Coordinate start offsets for infinite variation and origin randomization
  const xOriginOffset = Math.floor((((cfg.startXOffset ?? 0) % 100) / 100) * w);
  const yOriginOffset = Math.floor((((cfg.startYOffset ?? 0) % 100) / 100) * h);

  const getMetric = (r: number, g: number, b: number): number => {
    switch (sortMode) {
      case 'brightness':
        return (r + g + b) / 3;
      case 'hue': {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const diff = max - min;
        if (diff === 0) return 0;
        let hueAngle = 0;
        if (max === r) hueAngle = ((g - b) / diff) % 6;
        else if (max === g) hueAngle = (b - r) / diff + 2;
        else hueAngle = (r - g) / diff + 4;
        return (hueAngle * 60 + 360) % 360;
      }
      case 'saturation': {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        return max === 0 ? 0 : ((max - min) / max) * 255;
      }
      case 'intensity':
        return Math.max(r, g, b);
      case 'luminance':
      default:
        return 0.299 * r + 0.587 * g + 0.114 * b;
    }
  };

  if (direction === 'horizontal') {
    const stepY = 2;
    for (let rawY = 0; rawY < h; rawY += stepY) {
      const y = safeMod(rawY + yOriginOffset, h);
      let startX = -1;
      const seedJitter = Math.floor((Math.sin(y * 12.9898 + (sVal + 1) * 78.233) * 43758.5453) % 14);

      for (let rawX = 0; rawX < w; rawX++) {
        const x = safeMod(rawX + xOriginOffset + seedJitter, w);
        const idx = (y * w + x) * 4;
        const metric = getMetric(d[idx], d[idx + 1], d[idx + 2]);

        if (metric >= threshMin && metric <= threshMax && d[idx + 3] > 20) {
          if (startX === -1) startX = rawX;
        } else {
          if (startX !== -1 && rawX - startX > 3) {
            sortHorizontalSpan(d, y, w, startX, rawX, xOriginOffset + seedJitter, getMetric, invert);
            startX = -1;
          }
        }
      }
      if (startX !== -1 && w - startX > 3) {
        sortHorizontalSpan(d, y, w, startX, w, xOriginOffset + seedJitter, getMetric, invert);
      }
    }
  } else {
    // Vertical direction sorting
    const stepX = 2;
    for (let rawX = 0; rawX < w; rawX += stepX) {
      const x = safeMod(rawX + xOriginOffset, w);
      let startY = -1;
      const seedJitter = Math.floor((Math.sin(x * 12.9898 + (sVal + 1) * 78.233) * 43758.5453) % 14);

      for (let rawY = 0; rawY < h; rawY++) {
        const y = safeMod(rawY + yOriginOffset + seedJitter, h);
        const idx = (y * w + x) * 4;
        const metric = getMetric(d[idx], d[idx + 1], d[idx + 2]);

        if (metric >= threshMin && metric <= threshMax && d[idx + 3] > 20) {
          if (startY === -1) startY = rawY;
        } else {
          if (startY !== -1 && rawY - startY > 3) {
            sortVerticalSpan(d, x, w, h, startY, rawY, yOriginOffset + seedJitter, getMetric, invert);
            startY = -1;
          }
        }
      }
      if (startY !== -1 && h - startY > 3) {
        sortVerticalSpan(d, x, w, h, startY, h, yOriginOffset + seedJitter, getMetric, invert);
      }
    }
  }

  function sortHorizontalSpan(
    data: Uint8ClampedArray,
    row: number,
    width: number,
    x1: number,
    x2: number,
    shift: number,
    metricFn: (r: number, g: number, b: number) => number,
    isInv: boolean
  ) {
    const pixels: { r: number; g: number; b: number; a: number; m: number }[] = [];
    for (let rx = x1; rx < x2; rx++) {
      const actualX = safeMod(rx + shift, width);
      const i = (row * width + actualX) * 4;
      pixels.push({
        r: data[i],
        g: data[i + 1],
        b: data[i + 2],
        a: data[i + 3],
        m: metricFn(data[i], data[i + 1], data[i + 2]),
      });
    }
    pixels.sort((a, b) => (isInv ? b.m - a.m : a.m - b.m));
    for (let rx = x1; rx < x2; rx++) {
      const actualX = safeMod(rx + shift, width);
      const i = (row * width + actualX) * 4;
      const p = pixels[rx - x1];
      data[i] = p.r;
      data[i + 1] = p.g;
      data[i + 2] = p.b;
      data[i + 3] = p.a;
    }
  }

  function sortVerticalSpan(
    data: Uint8ClampedArray,
    col: number,
    width: number,
    height: number,
    y1: number,
    y2: number,
    shift: number,
    metricFn: (r: number, g: number, b: number) => number,
    isInv: boolean
  ) {
    const pixels: { r: number; g: number; b: number; a: number; m: number }[] = [];
    for (let ry = y1; ry < y2; ry++) {
      const actualY = safeMod(ry + shift, height);
      const i = (actualY * width + col) * 4;
      pixels.push({
        r: data[i],
        g: data[i + 1],
        b: data[i + 2],
        a: data[i + 3],
        m: metricFn(data[i], data[i + 1], data[i + 2]),
      });
    }
    pixels.sort((a, b) => (isInv ? b.m - a.m : a.m - b.m));
    for (let ry = y1; ry < y2; ry++) {
      const actualY = safeMod(ry + shift, height);
      const i = (actualY * width + col) * 4;
      const p = pixels[ry - y1];
      data[i] = p.r;
      data[i + 1] = p.g;
      data[i + 2] = p.b;
      data[i + 3] = p.a;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * 6. Chromatic Aberration
 */
export function applyChromaticAberration(src: HTMLCanvasElement, amount: number): HTMLCanvasElement {
  const { canvas, ctx } = cloneCanvas(src);
  if (amount <= 0) return canvas;
  const w = canvas.width;
  const h = canvas.height;
  // Maximum displacement: smooth subtle optical dispersion (max 5px for delicate, distortion-free chromatic fringing)
  const maxShift = 5;
  const shift = Math.max(0, Math.min(maxShift, Math.round((amount / 100) * maxShift)));
  if (shift === 0) return canvas;

  const srcCtx = src.getContext('2d')!;
  const srcImg = srcCtx.getImageData(0, 0, w, h);
  const outImg = ctx.createImageData(w, h);
  const s = srcImg.data;
  const o = outImg.data;

  for (let y = 0; y < h; y++) {
    const rowOffset = y * w;
    for (let x = 0; x < w; x++) {
      const idx = (rowOffset + x) * 4;
      const rx = Math.max(0, Math.min(w - 1, x - shift));
      const bx = Math.max(0, Math.min(w - 1, x + shift));
      const rIdx = (rowOffset + rx) * 4;
      const bIdx = (rowOffset + bx) * 4;

      const currentAlpha = s[idx + 3];
      const rAlpha = s[rIdx + 3];
      const bAlpha = s[bIdx + 3];

      if (currentAlpha === 0 && rAlpha === 0 && bAlpha === 0) continue;

      // Sample red from left-shifted pixel, green from center, blue from right-shifted pixel
      o[idx] = s[rIdx];
      o[idx + 1] = s[idx + 1];
      o[idx + 2] = s[bIdx + 2];

      // Alpha smoothly bounds the fringe without harsh black borders
      o[idx + 3] = Math.max(currentAlpha, Math.round(rAlpha * 0.9), Math.round(bAlpha * 0.9));
    }
  }

  ctx.putImageData(outImg, 0, 0);
  return canvas;
}

/**
 * 7. Bloom Effect
 */
export function applyBloom(src: HTMLCanvasElement, intensity: number, threshold: number = 50): HTMLCanvasElement {
  const { canvas, ctx } = cloneCanvas(src);
  const w = canvas.width;
  const h = canvas.height;

  // Extract highlights
  const hlCanvas = document.createElement('canvas');
  hlCanvas.width = w;
  hlCanvas.height = h;
  const hlCtx = hlCanvas.getContext('2d')!;
  hlCtx.drawImage(src, 0, 0);

  const imgData = hlCtx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const thresh = (threshold / 100) * 255;

  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (lum < thresh) {
      d[i + 3] = 0;
    }
  }
  hlCtx.putImageData(imgData, 0, 0);

  // Blur highlights and blend with screen mode
  const blurRadius = Math.max(4, Math.round((intensity / 100) * 30));
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.filter = `blur(${blurRadius}px)`;
  ctx.globalAlpha = Math.min(1, (intensity / 100) * 1.5);
  ctx.drawImage(hlCanvas, 0, 0);
  ctx.restore();

  return canvas;
}

/**
 * 8. Multi-Channel Color Halftone (Photoshop & Procreate CMYK / Multi-Angle Style)
 */
export type HalftoneDotShape = 'circle' | 'square' | 'diamond' | 'line' | 'cross' | 'ellipse' | 'hexagon';

function drawHalftoneShape(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  shape: HalftoneDotShape = 'circle',
  angleRad: number = 0
) {
  if (r <= 0.2) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angleRad);
  ctx.beginPath();

  switch (shape) {
    case 'square':
      ctx.rect(-r, -r, r * 2, r * 2);
      ctx.fill();
      break;

    case 'diamond':
      ctx.moveTo(0, -r * 1.25);
      ctx.lineTo(r * 1.25, 0);
      ctx.lineTo(0, r * 1.25);
      ctx.lineTo(-r * 1.25, 0);
      ctx.closePath();
      ctx.fill();
      break;

    case 'line': {
      const lineThickness = Math.max(1, r * 0.7);
      ctx.rect(-r * 1.5, -lineThickness / 2, r * 3, lineThickness);
      ctx.fill();
      break;
    }

    case 'cross': {
      const arm = r * 1.2;
      const thick = Math.max(1.2, r * 0.42);
      ctx.rotate(Math.PI / 4);
      ctx.rect(-thick / 2, -arm, thick, arm * 2);
      ctx.rect(-arm, -thick / 2, arm * 2, thick);
      ctx.fill();
      break;
    }

    case 'ellipse':
      ctx.ellipse(0, 0, r * 1.35, Math.max(0.5, r * 0.65), 0, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'hexagon': {
      const hexR = r * 1.15;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const hx = Math.cos(a) * hexR;
        const hy = Math.sin(a) * hexR;
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'circle':
    default:
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
  ctx.restore();
}

export interface HalftoneConfig {
  maxRadius?: number;
  cyanAngle?: number;
  magentaAngle?: number;
  yellowAngle?: number;
  blackAngle?: number;
  dotShape?: HalftoneDotShape;
}

/**
 * 8. Color Halftone Overhaul: Authentic 4-Screen Rotated Rasterization (Photopea / CMYK Style)
 * - Independent Rotated Screen Angle per channel:
 *   Cyan (108°), Magenta (162°), Yellow (90°), Black (45°)
 * - Max Radius (4–100px)
 * - Dot Shape Library: Circle, Square, Diamond, Line, Cross (X), Ellipse, Hexagon
 * - Alpha Transparency: White values completely keyed out (100% transparent)
 */
export function applyHalftone(
  src: HTMLCanvasElement,
  radiusOrPercent: number = 25,
  cyanAngle: number = 108,
  magentaAngle: number = 162,
  yellowAngle: number = 90,
  blackAngle: number = 45,
  dotShape: HalftoneDotShape = 'circle',
  config?: HalftoneConfig
): HTMLCanvasElement {
  const { canvas, ctx } = cloneCanvas(src);
  const w = canvas.width;
  const h = canvas.height;
  const srcCtx = src.getContext('2d')!;
  const imgData = srcCtx.getImageData(0, 0, w, h);
  const d = imgData.data;

  // Resolve parameters from config object or arguments
  const maxRadius = Math.max(
    4,
    Math.min(
      100,
      config?.maxRadius ??
        (radiusOrPercent <= 100 ? Math.round((radiusOrPercent / 100) * 46) + 4 : radiusOrPercent)
    )
  );
  const cAngle = config?.cyanAngle ?? cyanAngle ?? 108;
  const mAngle = config?.magentaAngle ?? magentaAngle ?? 162;
  const yAngle = config?.yellowAngle ?? yellowAngle ?? 90;
  const kAngle = config?.blackAngle ?? blackAngle ?? 45;
  const shape = config?.dotShape ?? dotShape ?? 'circle';

  // Grid step based on max radius
  const step = Math.max(4, Math.round(maxRadius * 1.6));

  // Clear canvas completely so white areas remain 100% transparent
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const diag = Math.sqrt(w * w + h * h);
  const halfDiag = Math.ceil(diag / 2) + step;

  // Screen plates definition: Cyan, Magenta, Yellow, Black (Key)
  const screens = [
    {
      name: 'cyan',
      angle: cAngle,
      color: 'rgba(0, 180, 240, 0.9)',
      getDensity: (r: number, g: number, b: number, k: number) => {
        const cPure = 1 - r / 255;
        return k < 0.999 ? Math.max(0, (cPure - k) / (1 - k)) : 0;
      },
    },
    {
      name: 'magenta',
      angle: mAngle,
      color: 'rgba(235, 20, 120, 0.9)',
      getDensity: (r: number, g: number, b: number, k: number) => {
        const mPure = 1 - g / 255;
        return k < 0.999 ? Math.max(0, (mPure - k) / (1 - k)) : 0;
      },
    },
    {
      name: 'yellow',
      angle: yAngle,
      color: 'rgba(250, 220, 20, 0.9)',
      getDensity: (r: number, g: number, b: number, k: number) => {
        const yPure = 1 - b / 255;
        return k < 0.999 ? Math.max(0, (yPure - k) / (1 - k)) : 0;
      },
    },
    {
      name: 'black',
      angle: kAngle,
      color: 'rgba(20, 20, 25, 0.95)',
      getDensity: (_r: number, _g: number, _b: number, k: number) => k,
    },
  ];

  // Render each rotated screen plate using authentic subtractive ink composite
  screens.forEach((screen, screenIdx) => {
    const rad = (screen.angle * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);

    ctx.save();
    // Subtractive ink blend: multiply plates together, first plate is normal source-over
    ctx.globalCompositeOperation = screenIdx === 0 ? 'source-over' : 'multiply';
    ctx.fillStyle = screen.color;

    // Loop over the rotated screen coordinate plane (u, v)
    for (let v = -halfDiag; v <= halfDiag; v += step) {
      for (let u = -halfDiag; u <= halfDiag; u += step) {
        // Rotate (u, v) back to canvas coordinates (x, y)
        const x = cx + u * cosA - v * sinA;
        const y = cy + u * sinA + v * cosA;

        const px = Math.round(x);
        const py = Math.round(y);

        if (px < 0 || px >= w || py < 0 || py >= h) continue;

        const idx = (py * w + px) * 4;
        const alpha = d[idx + 3];
        if (alpha <= 10) continue;

        const r = d[idx];
        const g = d[idx + 1];
        const b = d[idx + 2];

        // 100% Transparency Keying: pure / near white pixels generate zero dots
        if (r > 248 && g > 248 && b > 248) continue;

        // Calculate CMYK density
        const cPure = 1 - r / 255;
        const mPure = 1 - g / 255;
        const yPure = 1 - b / 255;
        const k = Math.min(cPure, mPure, yPure);

        const density = screen.getDensity(r, g, b, k);
        if (density <= 0.015) continue;

        // Dot radius scales smoothly with density
        const dotRadius = Math.min(maxRadius, (step * 0.72) * Math.sqrt(density));
        if (dotRadius < 0.35) continue;

        drawHalftoneShape(ctx, x, y, dotRadius, shape, rad);
      }
    }
    ctx.restore();
  });

  return canvas;
}

export interface ChannelExtractorConfig {
  colorSpace: 'rgb' | 'cmyk';
  channels: string[]; // e.g. ['r'], ['r', 'b'], ['c', 'm']
  outputMode: 'color' | 'grayscale';
}

/**
 * Channel Extractor Utility: Multi-channel RGB / CMYK isolation and flattened composite output
 */
export function applyChannelExtractor(
  src: HTMLCanvasElement,
  config?: ChannelExtractorConfig
): HTMLCanvasElement {
  const { canvas, ctx } = cloneCanvas(src);
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const colorSpace = config?.colorSpace || 'rgb';
  const channels = config?.channels && config.channels.length > 0 ? config.channels : (colorSpace === 'rgb' ? ['r'] : ['c']);
  const outputMode = config?.outputMode || 'color';

  const hasR = channels.includes('r');
  const hasG = channels.includes('g');
  const hasB = channels.includes('b');
  const hasC = channels.includes('c');
  const hasM = channels.includes('m');
  const hasY = channels.includes('y');
  const hasK = channels.includes('k');

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (colorSpace === 'rgb') {
      if (outputMode === 'grayscale') {
        let sum = 0;
        let count = 0;
        if (hasR) { sum += r; count++; }
        if (hasG) { sum += g; count++; }
        if (hasB) { sum += b; count++; }
        const gray = count > 0 ? Math.round(sum / count) : 0;
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      } else {
        data[i] = hasR ? r : 0;
        data[i + 1] = hasG ? g : 0;
        data[i + 2] = hasB ? b : 0;
      }
    } else {
      // CMYK Mode: Convert RGB to CMYK
      const cPure = 1 - r / 255;
      const mPure = 1 - g / 255;
      const yPure = 1 - b / 255;
      const kVal = Math.min(cPure, mPure, yPure);

      let cVal = 0, mVal = 0, yVal = 0;
      if (kVal < 1) {
        cVal = (cPure - kVal) / (1 - kVal);
        mVal = (mPure - kVal) / (1 - kVal);
        yVal = (yPure - kVal) / (1 - kVal);
      }

      const activeC = hasC ? cVal : 0;
      const activeM = hasM ? mVal : 0;
      const activeY = hasY ? yVal : 0;
      const activeK = hasK ? kVal : 0;

      if (outputMode === 'grayscale') {
        let sum = 0;
        let count = 0;
        if (hasC) { sum += activeC * 255; count++; }
        if (hasM) { sum += activeM * 255; count++; }
        if (hasY) { sum += activeY * 255; count++; }
        if (hasK) { sum += activeK * 255; count++; }
        const gray = count > 0 ? Math.round(sum / count) : 0;
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      } else {
        // Recompose back to RGB plates
        const outR = Math.round(255 * (1 - activeC) * (1 - activeK));
        const outG = Math.round(255 * (1 - activeM) * (1 - activeK));
        const outB = Math.round(255 * (1 - activeY) * (1 - activeK));
        data[i] = outR;
        data[i + 1] = outG;
        data[i + 2] = outB;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * 9. Motion Blur
 */
export function applyMotionBlur(src: HTMLCanvasElement, distance: number, angleDeg: number = 0): HTMLCanvasElement {
  const { canvas, ctx } = cloneCanvas(src);
  const w = canvas.width;
  const h = canvas.height;
  const steps = Math.max(2, Math.round((distance / 100) * 25));
  const rad = (angleDeg * Math.PI) / 180;
  const stepX = Math.cos(rad);
  const stepY = Math.sin(rad);

  ctx.clearRect(0, 0, w, h);
  ctx.globalAlpha = 1 / steps;

  for (let i = -steps / 2; i <= steps / 2; i++) {
    ctx.drawImage(src, i * stepX, i * stepY);
  }
  ctx.globalAlpha = 1.0;
  return canvas;
}

/**
 * 10. Kaleidoscope Glitch (Segments, Angle, Scale)
 */
export function applyKaleidoscope(
  src: HTMLCanvasElement,
  segments: number = 6,
  rotationAngle: number = 0,
  scale: number = 1
): HTMLCanvasElement {
  const { canvas, ctx } = cloneCanvas(src);
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const segs = Math.max(3, Math.min(32, Math.round(segments)));
  const angleStep = (2 * Math.PI) / segs;
  const baseRad = (rotationAngle * Math.PI) / 180;
  const sc = Math.max(0.5, Math.min(3, scale));

  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < segs; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(baseRad + i * angleStep);
    ctx.scale(sc, sc);
    if (i % 2 === 1) ctx.scale(1, -1);
    ctx.drawImage(src, -cx, -cy);
    ctx.restore();
  }
  return canvas;
}

/**
 * 11. Gradient Map
 */
export interface GradientColorStop {
  id: string;
  position: number; // 0 to 1
  color: string;
  type?: 'custom' | 'foreground' | 'background';
}

export interface GradientOpacityStop {
  id: string;
  position: number; // 0 to 1
  opacity: number; // 0 to 1
}

/**
 * 11. Gradient Map with Interactive Color and Opacity Stops LUT
 */
export function applyGradientMap(
  src: HTMLCanvasElement,
  colorStops: GradientColorStop[] | [string, string] = ['#1e1b4b', '#f43f5e'],
  opacityStops?: GradientOpacityStop[],
  intensity: number = 100,
  smoothness: number = 100,
  isNoise: boolean = false
): HTMLCanvasElement {
  const { canvas, ctx } = cloneCanvas(src);
  if (intensity <= 0) return canvas;
  const w = canvas.width;
  const h = canvas.height;

  // Build 256-entry gradient LUT
  const ramp = document.createElement('canvas');
  ramp.width = 256;
  ramp.height = 1;
  const rCtx = ramp.getContext('2d')!;
  const grad = rCtx.createLinearGradient(0, 0, 256, 0);

  if (Array.isArray(colorStops) && colorStops.length > 0 && typeof colorStops[0] === 'object') {
    const stops = [...(colorStops as GradientColorStop[])].sort((a, b) => a.position - b.position);
    if (stops[0].position > 0) {
      grad.addColorStop(0, stops[0].color);
    }
    stops.forEach((s) => {
      grad.addColorStop(Math.max(0, Math.min(1, s.position)), s.color);
    });
    if (stops[stops.length - 1].position < 1) {
      grad.addColorStop(1, stops[stops.length - 1].color);
    }
  } else {
    const simple = colorStops as [string, string];
    grad.addColorStop(0, simple[0] || '#1e1b4b');
    grad.addColorStop(1, simple[1] || '#f43f5e');
  }

  rCtx.fillStyle = grad;
  rCtx.fillRect(0, 0, 256, 1);
  const rampData = rCtx.getImageData(0, 0, 256, 1).data;

  // Compute opacity LUT (256 entries)
  const opLut = new Float32Array(256);
  if (opacityStops && opacityStops.length > 0) {
    const sortedOp = [...opacityStops].sort((a, b) => a.position - b.position);
    for (let i = 0; i < 256; i++) {
      const p = i / 255;
      if (p <= sortedOp[0].position) {
        opLut[i] = sortedOp[0].opacity;
      } else if (p >= sortedOp[sortedOp.length - 1].position) {
        opLut[i] = sortedOp[sortedOp.length - 1].opacity;
      } else {
        let left = sortedOp[0];
        let right = sortedOp[sortedOp.length - 1];
        for (let j = 0; j < sortedOp.length - 1; j++) {
          if (p >= sortedOp[j].position && p <= sortedOp[j + 1].position) {
            left = sortedOp[j];
            right = sortedOp[j + 1];
            break;
          }
        }
        const span = right.position - left.position;
        const t = span > 0 ? (p - left.position) / span : 0;
        opLut[i] = left.opacity + (right.opacity - left.opacity) * t;
      }
    }
  } else {
    opLut.fill(1.0);
  }

  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const blendFactor = Math.max(0, Math.min(1, intensity / 100));

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    let lum = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    if (isNoise) {
      lum = Math.max(0, Math.min(255, lum + Math.round((Math.random() - 0.5) * 40 * (1 - smoothness / 100))));
    }
    const rampIdx = lum * 4;
    const targetR = rampData[rampIdx];
    const targetG = rampData[rampIdx + 1];
    const targetB = rampData[rampIdx + 2];
    const alphaFactor = opLut[lum] * blendFactor;

    d[i] = Math.round(d[i] * (1 - alphaFactor) + targetR * alphaFactor);
    d[i + 1] = Math.round(d[i + 1] * (1 - alphaFactor) + targetG * alphaFactor);
    d[i + 2] = Math.round(d[i + 2] * (1 - alphaFactor) + targetB * alphaFactor);
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * 12. Color Offset Glitch: Shifts color channels with directional angle
 */
export function applyColorOffset(src: HTMLCanvasElement, amount: number, angleDeg: number = 45): HTMLCanvasElement {
  const { canvas, ctx } = cloneCanvas(src);
  const w = canvas.width;
  const h = canvas.height;
  const rad = (angleDeg * Math.PI) / 180;
  const dist = Math.round((amount / 100) * (w * 0.06));
  if (dist === 0) return canvas;

  const dx = Math.round(Math.cos(rad) * dist);
  const dy = Math.round(Math.sin(rad) * dist);

  const srcImg = src.getContext('2d')!.getImageData(0, 0, w, h);
  const outImg = ctx.createImageData(w, h);
  const s = srcImg.data;
  const o = outImg.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const rx = Math.max(0, Math.min(w - 1, x + dx));
      const ry = Math.max(0, Math.min(h - 1, y + dy));
      const bx = Math.max(0, Math.min(w - 1, x - dx));
      const by = Math.max(0, Math.min(h - 1, y - dy));

      const rIdx = (ry * w + rx) * 4;
      const bIdx = (by * w + bx) * 4;

      o[idx] = s[rIdx];
      o[idx + 1] = s[idx + 1];
      o[idx + 2] = s[bIdx + 2];
      o[idx + 3] = Math.max(s[idx + 3], s[rIdx + 3], s[bIdx + 3]);
    }
  }

  ctx.putImageData(outImg, 0, 0);
  return canvas;
}

/**
 * 13. Random Dispersion Glitch: Displaces horizontal and vertical pixel slices randomly
 */
export function applyRandomDispersion(src: HTMLCanvasElement, amount: number): HTMLCanvasElement {
  const { canvas, ctx } = cloneCanvas(src);
  const w = canvas.width;
  const h = canvas.height;
  const numSlices = Math.round(5 + (amount / 100) * 35);
  const maxShift = Math.round((amount / 100) * (w * 0.08));

  for (let i = 0; i < numSlices; i++) {
    const sliceY = Math.floor(Math.random() * h);
    const sliceH = Math.max(4, Math.floor(Math.random() * (h * 0.08)));
    const shiftX = Math.round((Math.random() - 0.5) * 2 * maxShift);

    ctx.drawImage(src, 0, sliceY, w, sliceH, shiftX, sliceY, w, sliceH);
  }
  return canvas;
}

/**
 * 14. Hue Distortion Glitch: Sinusoidal wave phase distortion across hue channels
 */
export function applyHueDistortion(src: HTMLCanvasElement, amount: number): HTMLCanvasElement {
  const { canvas, ctx } = cloneCanvas(src);
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const factor = amount / 100;

  for (let y = 0; y < h; y++) {
    const wave = Math.sin((y / h) * Math.PI * 8) * factor * 128;
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (d[idx + 3] === 0) continue;
      d[idx] = Math.max(0, Math.min(255, d[idx] + wave));
      d[idx + 2] = Math.max(0, Math.min(255, d[idx + 2] - wave));
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * 15. Surface Blur: Edge-preserving smoothing filter
 */
export function applySurfaceBlur(src: HTMLCanvasElement, radius: number, threshold: number = 30): HTMLCanvasElement {
  const { canvas, ctx } = cloneCanvas(src);
  const w = canvas.width;
  const h = canvas.height;
  const r = Math.max(1, Math.round((radius / 100) * 6));
  const threshSq = threshold * threshold;

  const srcImg = src.getContext('2d')!.getImageData(0, 0, w, h);
  const outImg = ctx.createImageData(w, h);
  const s = srcImg.data;
  const o = outImg.data;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const idx = (y * w + x) * 4;
      if (s[idx + 3] === 0) continue;

      const cR = s[idx];
      const cG = s[idx + 1];
      const cB = s[idx + 2];

      let sumR = 0, sumG = 0, sumB = 0, count = 0;

      for (let dy = -r; dy <= r; dy += 2) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -r; dx <= r; dx += 2) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const nIdx = (ny * w + nx) * 4;
          const diffR = s[nIdx] - cR;
          const diffG = s[nIdx + 1] - cG;
          const diffB = s[nIdx + 2] - cB;
          const diffSq = (diffR * diffR + diffG * diffG + diffB * diffB) / 3;

          if (diffSq < threshSq) {
            sumR += s[nIdx];
            sumG += s[nIdx + 1];
            sumB += s[nIdx + 2];
            count++;
          }
        }
      }

      if (count > 0) {
        o[idx] = sumR / count;
        o[idx + 1] = sumG / count;
        o[idx + 2] = sumB / count;
        o[idx + 3] = s[idx + 3];
      } else {
        o[idx] = cR;
        o[idx + 1] = cG;
        o[idx + 2] = cB;
        o[idx + 3] = s[idx + 3];
      }
    }
  }

  ctx.putImageData(outImg, 0, 0);
  return canvas;
}

/**
 * 16. Perspective Blur: Radial zoom blur towards center point
 */
export function applyPerspectiveBlur(
  src: HTMLCanvasElement,
  amount: number,
  centerX: number = 0.5,
  centerY: number = 0.5
): HTMLCanvasElement {
  const { canvas, ctx } = cloneCanvas(src);
  const w = canvas.width;
  const h = canvas.height;
  const steps = 10;
  const maxScale = 1 + (amount / 100) * 0.35;
  const cx = w * centerX;
  const cy = h * centerY;

  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < steps; i++) {
    const scale = 1 + ((maxScale - 1) * i) / steps;
    const nw = w * scale;
    const nh = h * scale;
    const ox = cx - (cx * scale);
    const oy = cy - (cy * scale);

    ctx.save();
    ctx.globalAlpha = 1 / steps;
    ctx.drawImage(src, ox, oy, nw, nh);
    ctx.restore();
  }
  return canvas;
}

/**
 * 17. Curves Adjustment: Custom LUT, Presets & Channel Splines
 */
export function applyCurvesAdjustment(
  src: HTMLCanvasElement,
  amount: number,
  channel: 'rgb' | 'red' | 'green' | 'blue' = 'rgb',
  preset: number = 0,
  customLut?: Uint8Array
): HTMLCanvasElement {
  const { canvas, ctx } = cloneCanvas(src);
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  let lut = customLut;
  if (!lut) {
    lut = new Uint8Array(256);
    if (preset === 1) {
      // High Contrast S-Curve
      for (let i = 0; i < 256; i++) {
        const x = i / 255;
        const y = 1 / (1 + Math.exp(-10 * (x - 0.5)));
        lut[i] = Math.max(0, Math.min(255, Math.round(y * 255)));
      }
    } else if (preset === 2) {
      // Invert
      for (let i = 0; i < 256; i++) {
        lut[i] = 255 - i;
      }
    } else if (preset === 3) {
      // Cross Process
      for (let i = 0; i < 256; i++) {
        const x = i / 255;
        // Boost shadows in blue, boost highlights in green/red
        const y = Math.pow(x, 0.8) * 1.1 - 0.05;
        lut[i] = Math.max(0, Math.min(255, Math.round(y * 255)));
      }
    } else if (preset === 4) {
      // Solarize
      for (let i = 0; i < 256; i++) {
        lut[i] = i < 128 ? i * 2 : (255 - i) * 2;
      }
    } else {
      // Standard / Parametric S-Curve via amount (-100..100)
      const factor = (amount - 50) / 50;
      for (let i = 0; i < 256; i++) {
        const norm = i / 255;
        let curved: number;
        if (factor >= 0) {
          curved = 1 / (1 + Math.exp(-6 * (norm - 0.5) * (1 + factor)));
        } else {
          curved = norm * (1 + factor) + 0.5 * (-factor);
        }
        lut[i] = Math.max(0, Math.min(255, Math.round(curved * 255)));
      }
    }
  }

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    if (channel === 'rgb' || channel === 'red') d[i] = lut[d[i]];
    if (channel === 'rgb' || channel === 'green') d[i + 1] = lut[d[i + 1]];
    if (channel === 'rgb' || channel === 'blue') d[i + 2] = lut[d[i + 2]];
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * 18. Optical Fisheye Lens Distortion (Barrel & Pincushion)
 */
export function applyFisheyeLens(
  src: HTMLCanvasElement,
  distortion: number = 50,
  centerX: number = 0.5,
  centerY: number = 0.5
): HTMLCanvasElement {
  const { canvas, ctx } = cloneCanvas(src);
  const w = canvas.width;
  const h = canvas.height;
  const k = ((distortion - 50) / 50) * 1.5; // -1.5 (pincushion) to +1.5 (barrel)
  if (Math.abs(k) < 0.01) return canvas;

  const srcImg = src.getContext('2d')!.getImageData(0, 0, w, h);
  const outImg = ctx.createImageData(w, h);
  const s = srcImg.data;
  const o = outImg.data;

  const cx = w * centerX;
  const cy = h * centerY;
  const maxR = Math.hypot(w / 2, h / 2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const dx = (x - cx) / maxR;
      const dy = (y - cy) / maxR;
      const r = Math.hypot(dx, dy);

      if (r === 0) {
        o[idx] = s[idx]; o[idx + 1] = s[idx + 1]; o[idx + 2] = s[idx + 2]; o[idx + 3] = s[idx + 3];
        continue;
      }

      const theta = Math.atan2(dy, dx);
      // Fisheye optical polynomial
      const rDist = r + k * r * r * r;
      const srcX = Math.round(cx + Math.cos(theta) * rDist * maxR);
      const srcY = Math.round(cy + Math.sin(theta) * rDist * maxR);

      if (srcX >= 0 && srcX < w && srcY >= 0 && srcY < h) {
        const sIdx = (srcY * w + srcX) * 4;
        o[idx] = s[sIdx];
        o[idx + 1] = s[sIdx + 1];
        o[idx + 2] = s[sIdx + 2];
        o[idx + 3] = s[sIdx + 3];
      }
    }
  }

  ctx.putImageData(outImg, 0, 0);
  return canvas;
}

/**
 * 19. Poster Edges (Photoshop / Photopea style)
 */
export function applyPosterEdges(
  src: HTMLCanvasElement,
  thickness: number = 2,
  intensity: number = 50,
  levels: number = 4
): HTMLCanvasElement {
  const { canvas, ctx } = cloneCanvas(src);
  const w = canvas.width;
  const h = canvas.height;
  const srcImg = src.getContext('2d')!.getImageData(0, 0, w, h);
  const outImg = ctx.createImageData(w, h);
  const s = srcImg.data;
  const o = outImg.data;
  const step = 255 / Math.max(2, levels);
  const edgeWeight = (intensity / 100) * 2;
  const t = Math.max(1, Math.round(thickness));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (s[idx + 3] === 0) continue;

      // Posterize color
      let r = Math.round(Math.round(s[idx] / step) * step);
      let g = Math.round(Math.round(s[idx + 1] / step) * step);
      let b = Math.round(Math.round(s[idx + 2] / step) * step);

      // Edge detection (Sobel-like difference)
      const rightIdx = (y * w + Math.min(w - 1, x + t)) * 4;
      const downIdx = (Math.min(h - 1, y + t) * w + x) * 4;

      const lum = 0.299 * s[idx] + 0.587 * s[idx + 1] + 0.114 * s[idx + 2];
      const lumR = 0.299 * s[rightIdx] + 0.587 * s[rightIdx + 1] + 0.114 * s[rightIdx + 2];
      const lumD = 0.299 * s[downIdx] + 0.587 * s[downIdx + 1] + 0.114 * s[downIdx + 2];

      const diff = Math.hypot(lum - lumR, lum - lumD);
      if (diff > 25) {
        const darken = Math.min(1, (diff / 100) * edgeWeight);
        r = Math.max(0, Math.round(r * (1 - darken)));
        g = Math.max(0, Math.round(g * (1 - darken)));
        b = Math.max(0, Math.round(b * (1 - darken)));
      }

      o[idx] = r;
      o[idx + 1] = g;
      o[idx + 2] = b;
      o[idx + 3] = s[idx + 3];
    }
  }

  ctx.putImageData(outImg, 0, 0);
  return canvas;
}

/**
 * 20. Pixelate / Mosaic
 */
export function applyPixelate(src: HTMLCanvasElement, cellSize: number = 12): HTMLCanvasElement {
  const { canvas, ctx } = cloneCanvas(src);
  const w = canvas.width;
  const h = canvas.height;
  const size = Math.max(2, Math.round(cellSize));

  ctx.imageSmoothingEnabled = false;
  // Scaled down
  const smallW = Math.max(1, Math.floor(w / size));
  const smallH = Math.max(1, Math.floor(h / size));

  const off = document.createElement('canvas');
  off.width = smallW;
  off.height = smallH;
  const offCtx = off.getContext('2d')!;
  offCtx.drawImage(src, 0, 0, smallW, smallH);

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(off, 0, 0, smallW, smallH, 0, 0, w, h);
  return canvas;
}

/**
 * 21. Threshold (Binarization)
 */
export function applyThreshold(src: HTMLCanvasElement, threshold: number = 128): HTMLCanvasElement {
  const { canvas, ctx } = cloneCanvas(src);
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const val = lum >= threshold ? 255 : 0;
    d[i] = val;
    d[i + 1] = val;
    d[i + 2] = val;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

export interface CutoutConfig {
  levels?: number; // 2 to 8 (Number of Levels)
  simplicity?: number; // 0 to 10 (Edge Simplicity)
  fidelity?: number; // 1 to 3 (Edge Fidelity)
}

/**
 * 22. Cutout Effect Overhaul: Authentic Paper-Cut / Vector-like Polygon Collage (Photopea Filter Gallery Style)
 * - Number of Levels: 2 to 8 (color quantization steps)
 * - Edge Simplicity: 0 to 10 (controls Kuwahara edge-preserving smoothing radius)
 * - Edge Fidelity: 1 to 3 (controls edge contour sharpness and boundary retention)
 * - 3x3 Modal Smoothing: Eliminates single-pixel noise, yielding continuous polygonal patches
 */
export function applyCutout(
  src: HTMLCanvasElement,
  levelsOrConfig: number | CutoutConfig = 4,
  simplicity: number = 4,
  fidelity: number = 2
): HTMLCanvasElement {
  let numLevels = 4;
  let edgeSimplicity = 4;
  let edgeFidelity = 2;

  if (typeof levelsOrConfig === 'object' && levelsOrConfig !== null) {
    numLevels = levelsOrConfig.levels ?? 4;
    edgeSimplicity = levelsOrConfig.simplicity ?? 4;
    edgeFidelity = levelsOrConfig.fidelity ?? 2;
  } else {
    numLevels = levelsOrConfig ?? 4;
    edgeSimplicity = simplicity ?? 4;
    edgeFidelity = fidelity ?? 2;
  }

  numLevels = Math.max(2, Math.min(8, Math.round(numLevels)));
  edgeSimplicity = Math.max(0, Math.min(10, Math.round(edgeSimplicity)));
  edgeFidelity = Math.max(1, Math.min(3, Math.round(edgeFidelity)));

  const { canvas, ctx } = cloneCanvas(src);
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const srcData = imgData.data;

  // 1. Edge-Preserving Kuwahara Filter
  // Radius R scales with simplicity and inversely with fidelity
  const radius =
    edgeSimplicity === 0
      ? 0
      : Math.max(1, Math.min(7, Math.round((edgeSimplicity * 1.1) / edgeFidelity)));

  const smoothed = new Uint8ClampedArray(srcData.length);

  if (radius === 0) {
    smoothed.set(srcData);
  } else {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const a = srcData[i + 3];
        if (a <= 5) {
          smoothed[i + 3] = 0;
          continue;
        }

        // 4 overlapping quadrants around (x, y)
        const qBounds = [
          [Math.max(0, x - radius), x, Math.max(0, y - radius), y],
          [x, Math.min(w - 1, x + radius), Math.max(0, y - radius), y],
          [Math.max(0, x - radius), x, y, Math.min(h - 1, y + radius)],
          [x, Math.min(w - 1, x + radius), y, Math.min(h - 1, y + radius)],
        ];

        let minVariance = Infinity;
        let bestMeanR = srcData[i];
        let bestMeanG = srcData[i + 1];
        let bestMeanB = srcData[i + 2];

        for (let q = 0; q < 4; q++) {
          const [x0, x1, y0, y1] = qBounds[q];
          let sumR = 0, sumG = 0, sumB = 0, sumLum = 0, sumLumSq = 0;
          let count = 0;

          for (let qy = y0; qy <= y1; qy++) {
            const rowOff = qy * w * 4;
            for (let qx = x0; qx <= x1; qx++) {
              const p = rowOff + qx * 4;
              if (srcData[p + 3] <= 5) continue;
              const r = srcData[p];
              const g = srcData[p + 1];
              const b = srcData[p + 2];
              const lum = 0.299 * r + 0.587 * g + 0.114 * b;
              sumR += r;
              sumG += g;
              sumB += b;
              sumLum += lum;
              sumLumSq += lum * lum;
              count++;
            }
          }

          if (count > 0) {
            const meanLum = sumLum / count;
            const variance = sumLumSq / count - meanLum * meanLum;
            if (variance < minVariance) {
              minVariance = variance;
              bestMeanR = Math.round(sumR / count);
              bestMeanG = Math.round(sumG / count);
              bestMeanB = Math.round(sumB / count);
            }
          }
        }

        smoothed[i] = bestMeanR;
        smoothed[i + 1] = bestMeanG;
        smoothed[i + 2] = bestMeanB;
        smoothed[i + 3] = a;
      }
    }
  }

  // 2. Color Quantization into 'numLevels' distinct intervals (2 to 8)
  const step = 255 / (numLevels - 1);
  const quant = new Uint8ClampedArray(smoothed.length);
  for (let i = 0; i < smoothed.length; i += 4) {
    if (smoothed[i + 3] <= 5) {
      quant[i + 3] = 0;
      continue;
    }
    quant[i] = Math.min(255, Math.max(0, Math.round(Math.round(smoothed[i] / step) * step)));
    quant[i + 1] = Math.min(255, Math.max(0, Math.round(Math.round(smoothed[i + 1] / step) * step)));
    quant[i + 2] = Math.min(255, Math.max(0, Math.round(Math.round(smoothed[i + 2] / step) * step)));
    quant[i + 3] = smoothed[i + 3];
  }

  // 3. 3x3 Modal / Majority Filter Pass for Vector-Like Polygon Cohesion (Paper Cut Collage)
  const passes = edgeSimplicity >= 6 ? 2 : 1;
  let currentPass = quant;
  for (let p = 0; p < passes; p++) {
    const nextPass = new Uint8ClampedArray(currentPass.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (currentPass[i + 3] <= 5) {
          nextPass[i + 3] = 0;
          continue;
        }

        // Count frequency of neighboring 3x3 quantized colors
        const colorCounts: Record<number, number> = {};
        let maxCount = 0;
        let modeColor = (currentPass[i] << 16) | (currentPass[i + 1] << 8) | currentPass[i + 2];

        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= w) continue;
            const ni = (ny * w + nx) * 4;
            if (currentPass[ni + 3] <= 5) continue;

            const code = (currentPass[ni] << 16) | (currentPass[ni + 1] << 8) | currentPass[ni + 2];
            const cnt = (colorCounts[code] || 0) + 1;
            colorCounts[code] = cnt;
            if (cnt > maxCount) {
              maxCount = cnt;
              modeColor = code;
            }
          }
        }

        nextPass[i] = (modeColor >> 16) & 0xff;
        nextPass[i + 1] = (modeColor >> 8) & 0xff;
        nextPass[i + 2] = modeColor & 0xff;
        nextPass[i + 3] = currentPass[i + 3];
      }
    }
    currentPass = nextPass;
  }

  // Put result back to canvas
  const outImgData = ctx.createImageData(w, h);
  outImgData.data.set(currentPass);
  ctx.putImageData(outImgData, 0, 0);
  return canvas;
}

/**
 * 23. Unsharp Mask: Amount (0 to 500%), Radius (0.1 to 20px), Threshold (0 to 255)
 */
export function applyUnsharpMask(
  src: HTMLCanvasElement,
  amount: number = 100,
  radius: number = 2.0,
  threshold: number = 0
): HTMLCanvasElement {
  const { canvas, ctx } = cloneCanvas(src);
  if (amount <= 0) return canvas;
  const w = canvas.width;
  const h = canvas.height;

  // Create blurred copy
  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = w;
  blurCanvas.height = h;
  const bCtx = blurCanvas.getContext('2d')!;
  bCtx.filter = `blur(${Math.max(0.5, radius)}px)`;
  bCtx.drawImage(src, 0, 0);

  const origData = src.getContext('2d')!.getImageData(0, 0, w, h).data;
  const blurData = bCtx.getImageData(0, 0, w, h).data;
  const outImg = ctx.createImageData(w, h);
  const outData = outImg.data;
  const scale = amount / 100;

  for (let i = 0; i < origData.length; i += 4) {
    const alpha = origData[i + 3];
    if (alpha <= 5) {
      outData[i + 3] = 0;
      continue;
    }

    const diffR = origData[i] - blurData[i];
    const diffG = origData[i + 1] - blurData[i + 1];
    const diffB = origData[i + 2] - blurData[i + 2];

    const r = Math.abs(diffR) >= threshold ? origData[i] + diffR * scale : origData[i];
    const g = Math.abs(diffG) >= threshold ? origData[i + 1] + diffG * scale : origData[i + 1];
    const b = Math.abs(diffB) >= threshold ? origData[i + 2] + diffB * scale : origData[i + 2];

    outData[i] = Math.max(0, Math.min(255, Math.round(r)));
    outData[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    outData[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
    outData[i + 3] = alpha;
  }

  ctx.putImageData(outImg, 0, 0);
  return canvas;
}

/**
 * 24. Alpha-Aware Monochromatic & Gaussian Noise
 */
export function applyNoise(
  src: HTMLCanvasElement,
  amount: number,
  monochromatic: boolean = false,
  gaussian: boolean = true
): HTMLCanvasElement {
  const { canvas, ctx } = cloneCanvas(src);
  if (amount <= 0) return canvas;
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const stdDev = (amount / 100) * 80;

  const getGaussianNoise = () => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * stdDev;
  };

  const getUniformNoise = () => (Math.random() - 0.5) * 2 * stdDev;
  const sampleNoise = gaussian ? getGaussianNoise : getUniformNoise;

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] <= 5) continue; // STRICTLY preserve transparent pixels

    if (monochromatic) {
      const n = sampleNoise();
      d[i] = Math.max(0, Math.min(255, Math.round(d[i] + n)));
      d[i + 1] = Math.max(0, Math.min(255, Math.round(d[i + 1] + n)));
      d[i + 2] = Math.max(0, Math.min(255, Math.round(d[i + 2] + n)));
    } else {
      d[i] = Math.max(0, Math.min(255, Math.round(d[i] + sampleNoise())));
      d[i + 1] = Math.max(0, Math.min(255, Math.round(d[i + 1] + sampleNoise())));
      d[i + 2] = Math.max(0, Math.min(255, Math.round(d[i + 2] + sampleNoise())));
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Master dispatcher for filter effects
 */
export function processFilterEffect(
  srcCanvas: HTMLCanvasElement,
  effectType: string,
  amount: number,
  secondary: number = 50,
  tertiary: number = 0,
  customLut?: Uint8Array,
  extraConfig?: any
): HTMLCanvasElement {
  switch (effectType) {
    case 'glitch_rgb_offset':
      return applyRgbOffset(srcCanvas, amount, secondary, tertiary);
    case 'glitch_color_offset':
      return applyColorOffset(srcCanvas, amount, secondary * 3.6);
    case 'glitch_channel_swap':
      return applyChannelSwap(srcCanvas, Math.max(0, Math.min(21, Math.round((amount / 100) * 21))));
    case 'glitch_channel_reflector':
      return applyChannelReflector(srcCanvas, amount);
    case 'glitch_random_dispersion':
      return applyRandomDispersion(srcCanvas, amount);
    case 'glitch_hue_distortion':
      return applyHueDistortion(srcCanvas, amount);
    case 'glitch_scanlines':
      return applyScanlines(srcCanvas, amount, secondary);
    case 'glitch_pixel_sort':
      return applyPixelSort(srcCanvas, amount, secondary || 0, extraConfig);
    case 'chromatic_aberration':
      return applyChromaticAberration(srcCanvas, amount);
    case 'bloom':
      return applyBloom(srcCanvas, amount, secondary);
    case 'halftone':
      return applyHalftone(
        srcCanvas,
        extraConfig?.maxRadius ?? amount,
        extraConfig?.cyanAngle ?? secondary ?? 108,
        extraConfig?.magentaAngle ?? tertiary ?? 162,
        extraConfig?.yellowAngle ?? 90,
        extraConfig?.blackAngle ?? 45,
        extraConfig?.dotShape || 'circle',
        extraConfig
      );
    case 'channel_extractor':
      return applyChannelExtractor(srcCanvas, extraConfig);
    case 'motion_blur':
      return applyMotionBlur(srcCanvas, amount, secondary * 3.6);
    case 'surface_blur':
      return applySurfaceBlur(srcCanvas, amount, secondary);
    case 'perspective_blur':
      return applyPerspectiveBlur(srcCanvas, amount, (secondary || 50) / 100, (tertiary || 50) / 100);
    case 'curves': {
      const channels: ('rgb' | 'red' | 'green' | 'blue')[] = ['rgb', 'red', 'green', 'blue'];
      const ch = channels[Math.min(3, Math.max(0, Math.round(secondary)))] || 'rgb';
      const presetIdx = Math.round(tertiary || 0);
      return applyCurvesAdjustment(srcCanvas, amount, ch, presetIdx, customLut);
    }
    case 'fisheye':
      return applyFisheyeLens(srcCanvas, amount, (secondary || 50) / 100, (tertiary || 50) / 100);
    case 'poster_edges':
      return applyPosterEdges(srcCanvas, Math.max(1, Math.round((amount / 100) * 6)), secondary, Math.max(2, Math.round((tertiary || 50) / 20)));
    case 'pixelate':
      return applyPixelate(srcCanvas, Math.max(2, Math.round((amount / 100) * 48)));
    case 'threshold':
      return applyThreshold(srcCanvas, Math.round((amount / 100) * 255));
    case 'cutout': {
      const levels =
        extraConfig?.levels ?? Math.max(2, Math.min(8, Math.round((amount / 100) * 6) + 2));
      const simplicity =
        extraConfig?.simplicity ?? Math.max(0, Math.min(10, Math.round((secondary / 100) * 10)));
      const fidelity =
        extraConfig?.fidelity ?? Math.max(1, Math.min(3, Math.round(((tertiary ?? 50) / 100) * 2) + 1));
      return applyCutout(srcCanvas, { levels, simplicity, fidelity });
    }
    case 'glitch_kaleidoscope':
      return applyKaleidoscope(srcCanvas, Math.max(3, Math.round((amount / 100) * 24)), secondary * 3.6, tertiary ? tertiary / 50 : 1);
    case 'gradient_map':
      return applyGradientMap(srcCanvas);
    case 'noise':
      return applyNoise(srcCanvas, amount, Boolean(secondary), Boolean(tertiary ?? 1));
    case 'sharpen':
      return applyUnsharpMask(srcCanvas, amount * 1.5, 1.5, 0);
    case 'unsharp_mask':
      return applyUnsharpMask(srcCanvas, amount * 2.5, (secondary / 100) * 10, tertiary || 0);
    case 'glitch_vhs':
      return applyVhsFilter(srcCanvas, {
        distortion: (amount / 100) * 2,
        colorFringing: (secondary / 50) * 2,
        wobble: (tertiary ? tertiary / 50 : 1) * 2,
        sparkle: 1.0,
        grain: 0.75,
      });
    case 'glitch_led_screen':
      return applyLedScreen(srcCanvas, {
        pixelSize: Math.max(1, (amount / 100) * 8),
        gap: (secondary / 100) * 0.8,
        rgbMode: tertiary !== 1,
      });
    case 'thermal': {
      const { canvas, ctx } = cloneCanvas(srcCanvas);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      applyThermalEffectToImageData(imgData, {
        gradientType: Math.max(1, Math.min(6, Math.round(secondary || 3))),
        shadows: (amount / 100) * 2 - 1,
        width: canvas.width,
        height: canvas.height,
      });
      ctx.putImageData(imgData, 0, 0);
      return canvas;
    }
    default:
      return srcCanvas;
  }
}

