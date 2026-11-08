/**
 * Hunbatz Artwork Studio — Layer Compositing Engine
 * 
 * Routes blend modes between Canvas native composite operations (fast path)
 * and pixel-level math engine for the full Krita parity suite.
 */

import { BlendMode, LayerMask } from '../types/canvas';
import {
  isStandardCanvasMode,
  applyBlendModeToImageData,
  type KritaBlendMode,
} from './blendModes';

/**
 * Composite a single layer onto a target canvas using the appropriate method:
 * - Standard modes use ctx.globalCompositeOperation (fast)
 * - Custom modes use pixel-level math via blendModes.ts
 */
export function compositeLayer(
  ctx: CanvasRenderingContext2D,
  sourceCanvas: HTMLCanvasElement,
  mode: BlendMode | string,
  opacity: number = 1.0
): void {
  const standard = isStandardCanvasMode(mode);

  if (standard) {
    // Fast path: native canvas compositing
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = mode as GlobalCompositeOperation;
    ctx.drawImage(sourceCanvas, 0, 0);
    ctx.restore();
  } else {
    // Custom pixel math path
    const srcCtx = sourceCanvas.getContext('2d');
    if (!srcCtx) return;

    const width = sourceCanvas.width;
    const height = sourceCanvas.height;

    // Get current canvas pixels (bottom) and source layer pixels (top)
    const bottomData = ctx.getImageData(0, 0, width, height);
    const topImageData = srcCtx.getImageData(0, 0, width, height);

    // Apply blend mode pixel-by-pixel
    const output = new Uint8ClampedArray(bottomData.data.length);
    applyBlendModeToImageData(mode as KritaBlendMode, bottomData.data, topImageData.data, output, width, height, opacity);

    // Write result back to target canvas
    ctx.putImageData(new ImageData(output, width, height), 0, 0);
  }
}

/**
 * Composite multiple visible layers onto a target canvas in stack order.
 * Layers are processed bottom-to-top (first layer = bottom of stack).
 */
export function compositeLayers(
  ctx: CanvasRenderingContext2D,
  layers: Array<{
    canvas: HTMLCanvasElement;
    blendMode: BlendMode | string;
    opacity: number;
    visible: boolean;
  }>,
  width: number,
  height: number
): void {
  for (const layer of layers) {
    if (!layer.visible) continue;

    compositeLayer(ctx, layer.canvas, layer.blendMode, layer.opacity);
  }
}

/**
 * Render a layer buffer with blend mode applied.
 * Returns a new canvas with the composited result.
 */
export function renderLayerBuffer(
  sourceCanvas: HTMLCanvasElement,
  blendMode: BlendMode | string,
  opacity: number = 1.0
): HTMLCanvasElement {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  // Create a temporary canvas to get the raw pixels
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.drawImage(sourceCanvas, 0, 0);

  // Create output canvas
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outCtx = outputCanvas.getContext('2d')!;

  if (isStandardCanvasMode(blendMode)) {
    // Fast path: native compositing onto transparent canvas
    outCtx.save();
    outCtx.globalAlpha = opacity;
    outCtx.globalCompositeOperation = blendMode as GlobalCompositeOperation;
    outCtx.drawImage(sourceCanvas, 0, 0);
    outCtx.restore();
  } else {
    // Custom pixel math: copy source to output first (acts as "bottom")
    const srcData = tempCtx.getImageData(0, 0, width, height);
    outCtx.putImageData(srcData, 0, 0);

    // Apply blend mode (top = same as bottom for single-layer render)
    const output = new Uint8ClampedArray(srcData.data.length);
    applyBlendModeToImageData(
      blendMode as KritaBlendMode,
      srcData.data,
      srcData.data,
      output,
      width,
      height,
      opacity
    );

    outCtx.putImageData(new ImageData(output, width, height), 0, 0);
  }

  return outputCanvas;
}

/**
 * Apply processed mask (with grayscale luminance conversion, feather and density) using destination-in clipping.
 */
export function applyProcessedMask(
  targetCtx: CanvasRenderingContext2D,
  mask: LayerMask,
  width: number,
  height: number
): void {
  const density = Math.max(0, Math.min(100, mask.density !== undefined ? mask.density : 100)) / 100;
  const feather = Math.max(0, mask.feather || 0);

  const mBuf = document.createElement('canvas');
  mBuf.width = width;
  mBuf.height = height;
  const mbCtx = mBuf.getContext('2d', { willReadFrequently: true })!;

  if (feather > 0) {
    mbCtx.filter = `blur(${feather}px)`;
  }
  mbCtx.drawImage(mask.canvas, 0, 0);

  const imgData = mbCtx.getImageData(0, 0, width, height);
  const d = imgData.data;
  const len = d.length;

  for (let i = 0; i < len; i += 4) {
    const a = d[i + 3];
    if (a === 0) {
      d[i + 3] = Math.round((1 - density) * 255);
      continue;
    }
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const lum = (r * 77 + g * 150 + b * 29) >> 8;
    const reveal = (lum * a) / 65025;
    const effectiveAlpha = 1 - density * (1 - reveal);
    d[i + 3] = Math.round(effectiveAlpha * 255);
  }

  mbCtx.filter = 'none';
  mbCtx.putImageData(imgData, 0, 0);

  targetCtx.save();
  targetCtx.globalCompositeOperation = 'destination-in';
  targetCtx.drawImage(mBuf, 0, 0);
  targetCtx.restore();
}
