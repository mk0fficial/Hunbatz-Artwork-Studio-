import { AdjustmentLayerConfig } from '../types/canvas';
import {
  buildGradientMapLut,
  applyGradientMapToImageData,
  applySelectiveColorToImageData,
  CINEMATIC_3D_LUTS,
  applyPhotoFilterToImageData,
  applyStyleFilterToImageData,
  applyExposureToImageData,
  applyThermalEffectToImageData,
} from './canvasAdjustments';
import { renderRelightAdjustmentLayer } from './relightEngine';

/**
 * GPU-accelerated live adjustment filter engine inspired by Krita & Procreate
 * Renders from an untouched source backup canvas to the target layer context in real-time
 */

// Noise texture canvas cache
let noiseCanvasCache: HTMLCanvasElement | null = null;

function getNoisePattern(width: number, height: number): HTMLCanvasElement {
  if (
    noiseCanvasCache &&
    noiseCanvasCache.width === Math.min(512, width) &&
    noiseCanvasCache.height === Math.min(512, height)
  ) {
    return noiseCanvasCache;
  }

  const w = Math.min(512, width);
  const h = Math.min(512, height);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const val = Math.floor(Math.random() * 255);
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
    data[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  noiseCanvasCache = canvas;
  return canvas;
}

/**
 * Live Gaussian Blur Preview & Apply
 */
export function applyGaussianBlur(
  sourceCanvas: HTMLCanvasElement,
  targetCtx: CanvasRenderingContext2D,
  radius: number
) {
  const w = targetCtx.canvas.width;
  const h = targetCtx.canvas.height;
  targetCtx.clearRect(0, 0, w, h);

  if (radius <= 0) {
    targetCtx.drawImage(sourceCanvas, 0, 0);
    return;
  }

  targetCtx.save();
  targetCtx.filter = `blur(${Math.max(0, radius)}px)`;
  targetCtx.drawImage(sourceCanvas, 0, 0);
  targetCtx.restore();
}

/**
 * Live Hue, Saturation, Brightness Preview & Apply
 */
export function applyHueSaturation(
  sourceCanvas: HTMLCanvasElement,
  targetCtx: CanvasRenderingContext2D,
  hueDelta: number,
  satDelta: number,
  valDelta: number
) {
  const w = targetCtx.canvas.width;
  const h = targetCtx.canvas.height;
  targetCtx.clearRect(0, 0, w, h);

  const hueDeg = hueDelta;
  const satPercent = Math.max(0, 100 + satDelta);
  const brightPercent = Math.max(0, 100 + valDelta);

  targetCtx.save();
  targetCtx.filter = `hue-rotate(${hueDeg}deg) saturate(${satPercent}%) brightness(${brightPercent}%)`;
  targetCtx.drawImage(sourceCanvas, 0, 0);
  targetCtx.restore();
}

/**
 * Live Film Grain / Noise Preview & Apply
 */
export function applyNoise(
  sourceCanvas: HTMLCanvasElement,
  targetCtx: CanvasRenderingContext2D,
  amount: number
) {
  const w = targetCtx.canvas.width;
  const h = targetCtx.canvas.height;
  targetCtx.clearRect(0, 0, w, h);
  targetCtx.drawImage(sourceCanvas, 0, 0);

  if (amount <= 0) return;

  targetCtx.save();
  targetCtx.globalCompositeOperation = 'overlay';
  targetCtx.globalAlpha = Math.min(1, Math.max(0, amount / 100));

  const noisePattern = getNoisePattern(w, h);
  const pattern = targetCtx.createPattern(noisePattern, 'repeat');
  if (pattern) {
    targetCtx.fillStyle = pattern;
    targetCtx.fillRect(0, 0, w, h);
  }
  targetCtx.restore();
}

/**
 * Live Invert Colors Preview & Apply
 */
export function applyInvert(
  sourceCanvas: HTMLCanvasElement,
  targetCtx: CanvasRenderingContext2D,
  percent: number = 100
) {
  const w = targetCtx.canvas.width;
  const h = targetCtx.canvas.height;
  targetCtx.clearRect(0, 0, w, h);

  targetCtx.save();
  targetCtx.filter = `invert(${Math.max(0, Math.min(100, percent))}%)`;
  targetCtx.drawImage(sourceCanvas, 0, 0);
  targetCtx.restore();
}

/**
 * Live Grayscale (B&W) Preview & Apply
 */
export function applyGrayscale(
  sourceCanvas: HTMLCanvasElement,
  targetCtx: CanvasRenderingContext2D,
  percent: number = 100
) {
  const w = targetCtx.canvas.width;
  const h = targetCtx.canvas.height;
  targetCtx.clearRect(0, 0, w, h);

  targetCtx.save();
  targetCtx.filter = `grayscale(${Math.max(0, Math.min(100, percent))}%)`;
  targetCtx.drawImage(sourceCanvas, 0, 0);
  targetCtx.restore();
}

// Reusable offscreen buffer to avoid memory thrashing during real-time slider drags
let cachedAdjustmentResult: HTMLCanvasElement | null = null;

/**
 * Ultra-fast GPU-accelerated & typed-LUT live compositor for non-destructive adjustment layers
 * Runs at 60+ FPS without main thread stutter
 */
export function renderFastAdjustmentLayer(
  sourceCanvas: HTMLCanvasElement,
  adj: AdjustmentLayerConfig,
  layerId?: string
): HTMLCanvasElement {
  if (typeof document === 'undefined') {
    return sourceCanvas;
  }
  const { type, settings = {} } = adj;
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;

  if (type === 'relight') {
    const targetId = layerId || settings.layerId || 'relight_layer_default';
    return renderRelightAdjustmentLayer(sourceCanvas, targetId, settings);
  }

  if (!cachedAdjustmentResult || cachedAdjustmentResult.width !== w || cachedAdjustmentResult.height !== h) {
    cachedAdjustmentResult = document.createElement('canvas');
    cachedAdjustmentResult.width = w;
    cachedAdjustmentResult.height = h;
  }

  const out = cachedAdjustmentResult;
  const ctx = out.getContext('2d');
  if (!ctx) return sourceCanvas;
  ctx.clearRect(0, 0, w, h);

  switch (type) {
    case 'hue_saturation': {
      const hue = settings.hue ?? 0;
      const sat = Math.max(0, 100 + (settings.saturation ?? 0));
      const bright = Math.max(0, 100 + (settings.lightness ?? 0));
      ctx.save();
      ctx.filter = `hue-rotate(${hue}deg) saturate(${sat}%) brightness(${bright}%)`;
      ctx.drawImage(sourceCanvas, 0, 0);
      ctx.restore();
      return out;
    }

    case 'brightness_contrast': {
      const bright = Math.max(0, 100 + (settings.brightness ?? 0));
      const contrast = Math.max(0, 100 + (settings.contrast ?? 0));
      ctx.save();
      ctx.filter = `brightness(${bright}%) contrast(${contrast}%)`;
      ctx.drawImage(sourceCanvas, 0, 0);
      ctx.restore();
      return out;
    }

    case 'black_and_white': {
      ctx.save();
      ctx.filter = 'grayscale(100%)';
      ctx.drawImage(sourceCanvas, 0, 0);
      ctx.restore();
      return out;
    }

    case 'invert': {
      ctx.save();
      ctx.filter = 'invert(100%)';
      ctx.drawImage(sourceCanvas, 0, 0);
      ctx.restore();
      return out;
    }

    case 'threshold': {
      const thresh = settings.threshold ?? 128;
      ctx.drawImage(sourceCanvas, 0, 0);
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        const lum = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
        const v = lum >= thresh ? 255 : 0;
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
      }
      ctx.putImageData(imgData, 0, 0);
      return out;
    }

    case 'posterize': {
      const levels = Math.max(2, Math.min(32, settings.posterizeLevels || settings.levels || 4));
      const step = 255 / (levels - 1);
      ctx.drawImage(sourceCanvas, 0, 0);
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        d[i] = Math.round(Math.round(d[i] / step) * step);
        d[i + 1] = Math.round(Math.round(d[i + 1] / step) * step);
        d[i + 2] = Math.round(Math.round(d[i + 2] / step) * step);
      }
      ctx.putImageData(imgData, 0, 0);
      return out;
    }

    case 'curves': {
      const buildChannelLut = (shadows: number = 0, midtones: number = 0, highlights: number = 0) => {
        const lut = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
          const norm = i / 255;
          const shadowFactor = Math.pow(1 - norm, 2) * (shadows / 50) * 45;
          const midFactor = 4 * norm * (1 - norm) * (midtones / 50) * 55;
          const highFactor = Math.pow(norm, 2) * (highlights / 50) * 45;
          const adjusted = i + shadowFactor + midFactor + highFactor;
          lut[i] = Math.max(0, Math.min(255, Math.round(adjusted)));
        }
        return lut;
      };

      const rgbLut = buildChannelLut(settings.rgb_shadows, settings.rgb_midtones, settings.rgb_highlights);
      const rLut = buildChannelLut(settings.r_shadows, settings.r_midtones, settings.r_highlights);
      const gLut = buildChannelLut(settings.g_shadows, settings.g_midtones, settings.g_highlights);
      const bLut = buildChannelLut(settings.b_shadows, settings.b_midtones, settings.b_highlights);

      ctx.drawImage(sourceCanvas, 0, 0);
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        d[i] = rLut[rgbLut[d[i]]];
        d[i + 1] = gLut[rgbLut[d[i + 1]]];
        d[i + 2] = bLut[rgbLut[d[i + 2]]];
      }
      ctx.putImageData(imgData, 0, 0);
      return out;
    }

    case 'gradient_fill': {
      ctx.drawImage(sourceCanvas, 0, 0);
      const style = settings.style || 'linear'; // 'linear' | 'radial'
      const angle = ((settings.angle ?? 90) * Math.PI) / 180;
      const color1 = settings.color1 || '#164435';
      const color2 = settings.color2 || '#5fd3ad';
      const reverse = !!settings.reverse;
      const opacity = settings.opacity !== undefined ? Number(settings.opacity) : 1;
      const blendMode = settings.blendMode || 'source-over';

      const c1 = reverse ? color2 : color1;
      const c2 = reverse ? color1 : color2;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
      ctx.globalCompositeOperation = blendMode as GlobalCompositeOperation;

      let grad: CanvasGradient;
      if (style === 'radial') {
        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.max(w, h) / 2;
        grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      } else {
        const cx = w / 2;
        const cy = h / 2;
        const dist = Math.hypot(w, h) / 2;
        const x1 = cx - Math.cos(angle) * dist;
        const y1 = cy - Math.sin(angle) * dist;
        const x2 = cx + Math.cos(angle) * dist;
        const y2 = cy + Math.sin(angle) * dist;
        grad = ctx.createLinearGradient(x1, y1, x2, y2);
      }
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      return out;
    }

    case 'gradient_map': {
      ctx.drawImage(sourceCanvas, 0, 0);
      const stops = settings.stops || [
        { id: '1', offset: 0, color: '#ff0055' },
        { id: '2', offset: 0.5, color: '#160033' },
        { id: '3', offset: 1, color: '#00ffff' },
      ];
      const shift = settings.shift !== undefined ? Number(settings.shift) : 0;
      const repeat = settings.repeat !== undefined ? Number(settings.repeat) : 1;
      const reverse = !!settings.reverse;
      const opacity = settings.opacity !== undefined ? Number(settings.opacity) : 1;

      const lut = buildGradientMapLut(
        stops,
        shift,
        repeat,
        reverse,
        settings.midpoints,
        settings.opacityStops
      );
      const imgData = ctx.getImageData(0, 0, w, h);
      applyGradientMapToImageData(imgData, lut, opacity);
      ctx.putImageData(imgData, 0, 0);
      return out;
    }

    case 'selective_color': {
      ctx.drawImage(sourceCanvas, 0, 0);
      const imgData = ctx.getImageData(0, 0, w, h);
      applySelectiveColorToImageData(imgData, {
        channel: settings.channel || 'reds',
        channels: settings.channels || {
          reds: { cyan: 0, magenta: 0, yellow: 0, black: 0 },
          yellows: { cyan: 0, magenta: 0, yellow: 0, black: 0 },
          greens: { cyan: 0, magenta: 0, yellow: 0, black: 0 },
          cyans: { cyan: 0, magenta: 0, yellow: 0, black: 0 },
          blues: { cyan: 0, magenta: 0, yellow: 0, black: 0 },
          magentas: { cyan: 0, magenta: 0, yellow: 0, black: 0 },
          whites: { cyan: 0, magenta: 0, yellow: 0, black: 0 },
          neutrals: { cyan: 0, magenta: 0, yellow: 0, black: 0 },
          blacks: { cyan: 0, magenta: 0, yellow: 0, black: 0 },
          custom: { cyan: 0, magenta: 0, yellow: 0, black: 0 },
        },
        method: settings.method || 'relative',
        targetHex: settings.targetHex,
        tolerance: settings.tolerance ?? 25,
      });
      ctx.putImageData(imgData, 0, 0);
      return out;
    }

    case 'color_lookup': {
      ctx.drawImage(sourceCanvas, 0, 0);
      const presetId = settings.presetId || 'teal_orange';
      const strength = (settings.strength ?? 100) / 100;
      const preset = CINEMATIC_3D_LUTS.find((p) => p.id === presetId) || CINEMATIC_3D_LUTS[0];

      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      const invStr = 1 - strength;

      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        const [nr, ng, nb] = preset.lutTransform(d[i], d[i + 1], d[i + 2]);
        d[i] = Math.round(d[i] * invStr + nr * strength);
        d[i + 1] = Math.round(d[i + 1] * invStr + ng * strength);
        d[i + 2] = Math.round(d[i + 2] * invStr + nb * strength);
      }
      ctx.putImageData(imgData, 0, 0);
      return out;
    }

    case 'photo_filter': {
      ctx.drawImage(sourceCanvas, 0, 0);
      const filterHex = settings.color || '#ec8a00';
      const density = settings.density ?? 25;
      const preserveLuminosity = settings.preserveLuminosity !== false;

      const imgData = ctx.getImageData(0, 0, w, h);
      applyPhotoFilterToImageData(imgData, filterHex, density, preserveLuminosity);
      ctx.putImageData(imgData, 0, 0);
      return out;
    }

    case 'style_filters': {
      ctx.drawImage(sourceCanvas, 0, 0);
      const filterId = settings.filterId || 'clarendon';
      const intensity = settings.intensity ?? 100;
      const vignette = settings.vignette ?? 0;

      const imgData = ctx.getImageData(0, 0, w, h);
      applyStyleFilterToImageData(imgData, filterId, intensity, vignette, w, h);
      ctx.putImageData(imgData, 0, 0);
      return out;
    }

    case 'exposure': {
      ctx.drawImage(sourceCanvas, 0, 0);
      const exposure = settings.exposure ?? 0;
      const offset = settings.offset ?? 0;
      const gamma = settings.gamma ?? 1.0;

      const imgData = ctx.getImageData(0, 0, w, h);
      applyExposureToImageData(imgData, exposure, offset, gamma);
      ctx.putImageData(imgData, 0, 0);
      return out;
    }

    case 'thermal': {
      ctx.drawImage(sourceCanvas, 0, 0);
      const imgData = ctx.getImageData(0, 0, w, h);
      applyThermalEffectToImageData(imgData, {
        invert: !!settings.invert,
        shadows: settings.shadows ?? -0.45,
        midtones: settings.midtones ?? -0.11,
        highlights: settings.highlights ?? -0.05,
        gradientType: settings.gradientType ?? 3,
        gradientShift: settings.gradientShift ?? 0.0,
        gradientRepeat: settings.gradientRepeat ?? 0.7,
        showEdges: !!settings.showEdges,
        edgeRange: settings.edgeRange ?? 0.50,
        width: w,
        height: h,
      });
      ctx.putImageData(imgData, 0, 0);
      return out;
    }

    default:
      return sourceCanvas;
  }
}