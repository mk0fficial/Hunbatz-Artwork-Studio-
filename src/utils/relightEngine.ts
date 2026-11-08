export interface RelightLightSource {
  id: string;
  name: string;
  x: number; // Normalized 0.0 to 1.0 across canvas width
  y: number; // Normalized 0.0 to 1.0 across canvas height
  z: number; // Distance (-0.6 = behind/rim light, 0.05..1.0 = front Close/Far)
  color: string; // Hex color e.g. "#3b82f6"
  power: number; // Intensity 0.0 to 2.5
  radius: number; // Falloff radius normalized 0.05 to 1.5
  diffusion: number; // Softness / light wrap 0.0 to 1.0
  specular: number; // 3D highlight shine 0.0 to 1.0
}

export interface RelightSettings {
  ambientColor: string;
  ambientPower: number; // 0.0 (pitch black) to 1.0
  originalLighting: number; // 0.0 to 1.0
  surfaceRelief: number; // 0.1 to 3.0 (3D bump height strength)
  surfaceSmoothness: number; // 1 to 10 (Normal bevel smoothing)
  autoPuff: number; // 0.0 to 1.0 (Automatic silhouette pillow inflation)
  ignoreInkLines: boolean; // Prevents black comic ink lines from becoming trenches
  respectSubjectAlpha: boolean; // Clips lighting to foreground subject
  editSubMode: 'lighting' | 'depth_sculpt';
  viewMode: 'lit' | 'unlit' | 'depth' | 'normals';
  sculptTargetDepth: number; // 0.0 (Far) to 1.0 (Close)
  sculptSmoothMode: boolean; // True = Smooth/Blur existing depth
  sculptSoftness: number; // 0.0 (Hard edge) to 1.0 (Soft airbrush gradient)
  sculptStrength: number; // 0.05 to 1.0 (Flow / Opacity)
  activeLightId: string;
  lights: RelightLightSource[];
  depthDataUrl?: string;
}

export interface RelightPreset {
  id: string;
  name: string;
  ambientColor: string;
  ambientPower: number;
  originalLighting: number;
  lights: Omit<RelightLightSource, 'id'>[];
}

export const RELIGHT_STUDIO_PRESETS: RelightPreset[] = [
  {
    id: 'cyberpunk_dual',
    name: 'Cyberpunk Dual',
    ambientColor: '#0f172a',
    ambientPower: 0.12,
    originalLighting: 0.15,
    lights: [
      {
        name: 'Light 1',
        x: 0.22,
        y: 0.35,
        z: 0.25,
        color: '#00f2fe',
        power: 1.45,
        radius: 0.65,
        diffusion: 0.45,
        specular: 0.4,
      },
      {
        name: 'Light 2',
        x: 0.78,
        y: 0.42,
        z: 0.22,
        color: '#ff0844',
        power: 1.5,
        radius: 0.65,
        diffusion: 0.45,
        specular: 0.4,
      },
    ],
  },
  {
    id: 'comic_energy_orb',
    name: 'Energy Core',
    ambientColor: '#090d16',
    ambientPower: 0.08,
    originalLighting: 0.1,
    lights: [
      {
        name: 'Light 1',
        x: 0.48,
        y: 0.48,
        z: 0.14,
        color: '#60a5fa',
        power: 1.75,
        radius: 0.48,
        diffusion: 0.35,
        specular: 0.55,
      },
      {
        name: 'Light 2',
        x: 0.75,
        y: 0.25,
        z: -0.2,
        color: '#f59e0b',
        power: 1.1,
        radius: 0.6,
        diffusion: 0.5,
        specular: 0.3,
      },
    ],
  },
  {
    id: 'golden_hour_rim',
    name: 'Golden Rim',
    ambientColor: '#2e1a12',
    ambientPower: 0.2,
    originalLighting: 0.25,
    lights: [
      {
        name: 'Light 1',
        x: 0.82,
        y: 0.22,
        z: -0.25,
        color: '#fbbf24',
        power: 1.8,
        radius: 0.85,
        diffusion: 0.6,
        specular: 0.5,
      },
      {
        name: 'Light 2',
        x: 0.25,
        y: 0.6,
        z: 0.35,
        color: '#38bdf8',
        power: 0.65,
        radius: 0.7,
        diffusion: 0.7,
        specular: 0.15,
      },
    ],
  },
  {
    id: 'dramatic_noir',
    name: 'Noir Spotlight',
    ambientColor: '#000000',
    ambientPower: 0.02,
    originalLighting: 0.05,
    lights: [
      {
        name: 'Light 1',
        x: 0.35,
        y: 0.25,
        z: 0.18,
        color: '#f8fafc',
        power: 1.6,
        radius: 0.45,
        diffusion: 0.2,
        specular: 0.45,
      },
    ],
  },
  {
    id: 'emerald_temple',
    name: 'Mayan Jade',
    ambientColor: '#071712',
    ambientPower: 0.12,
    originalLighting: 0.15,
    lights: [
      {
        name: 'Light 1',
        x: 0.3,
        y: 0.35,
        z: 0.22,
        color: '#5fd3ad',
        power: 1.5,
        radius: 0.6,
        diffusion: 0.4,
        specular: 0.45,
      },
      {
        name: 'Light 2',
        x: 0.72,
        y: 0.65,
        z: 0.28,
        color: '#e6c699',
        power: 1.15,
        radius: 0.65,
        diffusion: 0.5,
        specular: 0.3,
      },
    ],
  },
  {
    id: 'campfire_under',
    name: 'Campfire Glow',
    ambientColor: '#0c0a1d',
    ambientPower: 0.1,
    originalLighting: 0.12,
    lights: [
      {
        name: 'Light 1',
        x: 0.5,
        y: 0.82,
        z: 0.18,
        color: '#ff5722',
        power: 1.7,
        radius: 0.65,
        diffusion: 0.45,
        specular: 0.35,
      },
      {
        name: 'Light 2',
        x: 0.5,
        y: 0.15,
        z: 0.45,
        color: '#3b82f6',
        power: 0.45,
        radius: 0.8,
        diffusion: 0.75,
        specular: 0.1,
      },
    ],
  },
];

export function createDefaultRelightSettings(): RelightSettings {
  return {
    ambientColor: '#ffffff',
    ambientPower: 0.15,
    originalLighting: 0.15,
    surfaceRelief: 1.15,
    surfaceSmoothness: 3,
    autoPuff: 0.65,
    ignoreInkLines: true,
    respectSubjectAlpha: true,
    editSubMode: 'lighting',
    viewMode: 'lit',
    sculptTargetDepth: 0.85,
    sculptSmoothMode: false,
    sculptSoftness: 0.75,
    sculptStrength: 0.35,
    activeLightId: 'light_1',
    lights: [
      {
        id: 'light_1',
        name: 'Light 1',
        x: 0.45,
        y: 0.42,
        z: 0.2,
        color: '#3b82f6',
        power: 1.4,
        radius: 0.55,
        diffusion: 0.4,
        specular: 0.35,
      },
      {
        id: 'light_2',
        name: 'Light 2',
        x: 0.72,
        y: 0.32,
        z: 0.28,
        color: '#f59e0b',
        power: 1.1,
        radius: 0.6,
        diffusion: 0.45,
        specular: 0.25,
      },
    ],
  };
}

// ─── Persistent Depth Canvases, Undo/Redo Stacks, and Smart Render Cache ─────────
const layerDepthCanvasCache = new Map<string, HTMLCanvasElement>();
const layerDepthRevisionMap = new Map<string, number>();
const layerDepthUndoStack = new Map<string, ImageData[]>();
const layerDepthRedoStack = new Map<string, ImageData[]>();

interface CachedRelightOutput {
  signature: string;
  canvas: HTMLCanvasElement;
}
const relightOutputCache = new Map<string, CachedRelightOutput>();
let relightInteractiveFastMode = false;

export function setRelightInteractiveFastMode(active: boolean) {
  relightInteractiveFastMode = active;
}

export function bumpRelightDepthRevision(layerId: string) {
  layerDepthRevisionMap.set(layerId, (layerDepthRevisionMap.get(layerId) || 0) + 1);
}

export function getRelightDepthRevision(layerId: string): number {
  return layerDepthRevisionMap.get(layerId) || 0;
}

export function pushRelightDepthHistory(layerId: string): void {
  const canvas = layerDepthCanvasCache.get(layerId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const undoList = layerDepthUndoStack.get(layerId) || [];
  undoList.push(snap);
  if (undoList.length > 20) undoList.shift();
  layerDepthUndoStack.set(layerId, undoList);
  layerDepthRedoStack.set(layerId, []);
}

export function canUndoRelightDepth(layerId: string): boolean {
  return (layerDepthUndoStack.get(layerId)?.length || 0) > 0;
}

export function canRedoRelightDepth(layerId: string): boolean {
  return (layerDepthRedoStack.get(layerId)?.length || 0) > 0;
}

export function undoRelightDepth(layerId: string): boolean {
  const canvas = layerDepthCanvasCache.get(layerId);
  const undoList = layerDepthUndoStack.get(layerId);
  if (!canvas || !undoList || undoList.length === 0) return false;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;

  const currentSnap = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const redoList = layerDepthRedoStack.get(layerId) || [];
  redoList.push(currentSnap);
  layerDepthRedoStack.set(layerId, redoList);

  const prevSnap = undoList.pop()!;
  ctx.putImageData(prevSnap, 0, 0);
  bumpRelightDepthRevision(layerId);
  return true;
}

export function redoRelightDepth(layerId: string): boolean {
  const canvas = layerDepthCanvasCache.get(layerId);
  const redoList = layerDepthRedoStack.get(layerId);
  if (!canvas || !redoList || redoList.length === 0) return false;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;

  const currentSnap = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const undoList = layerDepthUndoStack.get(layerId) || [];
  undoList.push(currentSnap);
  layerDepthUndoStack.set(layerId, undoList);

  const nextSnap = redoList.pop()!;
  ctx.putImageData(nextSnap, 0, 0);
  bumpRelightDepthRevision(layerId);
  return true;
}

/**
 * Resets the depth map canvas for a relight layer back to initial neutral / auto-generated state.
 * Clears undo/redo history and render cache.
 */
export function resetRelightDepthCanvas(
  layerId: string,
  width: number,
  height: number,
  sourceCanvas?: HTMLCanvasElement,
  autoPuff = 0.65,
  ignoreInkLines = true
): HTMLCanvasElement {
  let depthCanvas = layerDepthCanvasCache.get(layerId);
  if (!depthCanvas || depthCanvas.width !== width || depthCanvas.height !== height) {
    depthCanvas = document.createElement('canvas');
    depthCanvas.width = width;
    depthCanvas.height = height;
    layerDepthCanvasCache.set(layerId, depthCanvas);
  }

  const dCtx = depthCanvas.getContext('2d', { willReadFrequently: true })!;
  dCtx.fillStyle = '#808080';
  dCtx.fillRect(0, 0, width, height);

  if (sourceCanvas) {
    autoGenerateDepthMapFromSource(sourceCanvas, depthCanvas, autoPuff, ignoreInkLines);
  }

  layerDepthUndoStack.delete(layerId);
  layerDepthRedoStack.delete(layerId);
  relightOutputCache.delete(layerId);
  bumpRelightDepthRevision(layerId);
  return depthCanvas;
}

/**
 * Procedurally randomizes / perturbs the depth map surface with organic volume and relief variations.
 */
export function randomizeRelightDepth(
  layerId: string,
  width: number,
  height: number,
  sourceCanvas?: HTMLCanvasElement
): HTMLCanvasElement {
  pushRelightDepthHistory(layerId);
  const depthCanvas = getOrCreateRelightDepthCanvas(layerId, width, height, sourceCanvas);
  const ctx = depthCanvas.getContext('2d', { willReadFrequently: true })!;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const randPuff = 0.4 + Math.random() * 0.55;
  const randFreqX = 1 + Math.floor(Math.random() * 4);
  const randFreqY = 1 + Math.floor(Math.random() * 4);
  const randPhase = Math.random() * Math.PI * 2;
  const randNoiseAmp = 15 + Math.random() * 25;

  for (let y = 0; y < height; y++) {
    const ny = (y / height - 0.5) * 2;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const nx = (x / width - 0.5) * 2;
      const cur = data[idx];

      // Procedural surface harmonic ripple
      const ripple = Math.sin(nx * randFreqX * Math.PI + randPhase) * Math.cos(ny * randFreqY * Math.PI + randPhase);
      const pillow = Math.max(0, 1 - (nx * nx + ny * ny)) * randPuff * 35;
      const jitter = (Math.random() - 0.5) * randNoiseAmp;

      const perturbed = Math.max(0, Math.min(255, Math.round(cur * 0.75 + pillow + ripple * 20 + jitter)));
      data[idx] = perturbed;
      data[idx + 1] = perturbed;
      data[idx + 2] = perturbed;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  bumpRelightDepthRevision(layerId);
  return depthCanvas;
}

export function getOrCreateRelightDepthCanvas(
  layerId: string,
  width: number,
  height: number,
  sourceCanvas?: HTMLCanvasElement,
  settings?: Partial<RelightSettings>
): HTMLCanvasElement {
  let depthCanvas = layerDepthCanvasCache.get(layerId);
  if (!depthCanvas || depthCanvas.width !== width || depthCanvas.height !== height) {
    depthCanvas = document.createElement('canvas');
    depthCanvas.width = width;
    depthCanvas.height = height;
    const dCtx = depthCanvas.getContext('2d', { willReadFrequently: true })!;
    dCtx.fillStyle = '#808080';
    dCtx.fillRect(0, 0, width, height);
    layerDepthCanvasCache.set(layerId, depthCanvas);
    bumpRelightDepthRevision(layerId);

    if (settings?.depthDataUrl) {
      const img = new Image();
      img.onload = () => {
        dCtx.drawImage(img, 0, 0, width, height);
        bumpRelightDepthRevision(layerId);
      };
      img.src = settings.depthDataUrl;
    } else if (sourceCanvas) {
      autoGenerateDepthMapFromSource(
        sourceCanvas,
        depthCanvas,
        settings?.autoPuff ?? 0.65,
        settings?.ignoreInkLines ?? true
      );
      bumpRelightDepthRevision(layerId);
    }
  }
  return depthCanvas;
}

export function autoGenerateDepthMapFromSource(
  sourceCanvas: HTMLCanvasElement,
  targetDepthCanvas: HTMLCanvasElement,
  autoPuff = 0.65,
  ignoreInkLines = true
): void {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  if (w === 0 || h === 0) return;

  const scale = Math.min(1, 320 / Math.max(w, h));
  const sw = Math.max(16, Math.round(w * scale));
  const sh = Math.max(16, Math.round(h * scale));

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = sw;
  tempCanvas.height = sh;
  const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true })!;
  tCtx.drawImage(sourceCanvas, 0, 0, sw, sh);

  const srcData = tCtx.getImageData(0, 0, sw, sh).data;
  const lum = new Float32Array(sw * sh);
  const alphaMask = new Uint8Array(sw * sh);

  let transparentPixels = 0;
  for (let i = 0; i < sw * sh; i++) {
    const idx = i * 4;
    const r = srcData[idx];
    const g = srcData[idx + 1];
    const b = srcData[idx + 2];
    const a = srcData[idx + 3];
    if (a < 25) transparentPixels++;
    alphaMask[i] = a >= 25 ? 1 : 0;

    const baseL = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const warmth = Math.max(0, (r - b) / 255) * 0.12;
    lum[i] = Math.min(1, baseL + warmth);
  }

  const closedLum = new Float32Array(lum);
  if (ignoreInkLines) {
    const radius = 2;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const i = y * sw + x;
        if (lum[i] < 0.22 && alphaMask[i]) {
          let maxNeighbor = lum[i];
          for (let dy = -radius; dy <= radius; dy++) {
            const ny = Math.min(sh - 1, Math.max(0, y + dy));
            for (let dx = -radius; dx <= radius; dx++) {
              const nx = Math.min(sw - 1, Math.max(0, x + dx));
              const nVal = lum[ny * sw + nx];
              if (nVal > maxNeighbor) maxNeighbor = nVal;
            }
          }
          closedLum[i] = maxNeighbor;
        }
      }
    }
  }

  const distField = new Float32Array(sw * sh);
  const hasCutoutSilhouette = transparentPixels > sw * sh * 0.04;

  if (hasCutoutSilhouette) {
    const INF = sw + sh;
    for (let i = 0; i < sw * sh; i++) {
      distField[i] = alphaMask[i] ? INF : 0;
    }
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const i = y * sw + x;
        if (distField[i] === 0) continue;
        if (x > 0) distField[i] = Math.min(distField[i], distField[i - 1] + 1);
        if (y > 0) distField[i] = Math.min(distField[i], distField[(y - 1) * sw + x] + 1);
      }
    }
    let maxDist = 1;
    for (let y = sh - 1; y >= 0; y--) {
      for (let x = sw - 1; x >= 0; x--) {
        const i = y * sw + x;
        if (distField[i] === 0) continue;
        if (x < sw - 1) distField[i] = Math.min(distField[i], distField[i + 1] + 1);
        if (y < sh - 1) distField[i] = Math.min(distField[i], distField[(y + 1) * sw + x] + 1);
        if (distField[i] > maxDist && distField[i] < INF) maxDist = distField[i];
      }
    }
    for (let i = 0; i < sw * sh; i++) {
      const normD = Math.min(1, distField[i] / (maxDist * 0.75 + 1));
      distField[i] = Math.sqrt(Math.max(0, 1 - (1 - normD) * (1 - normD)));
    }
  } else {
    for (let y = 0; y < sh; y++) {
      const ny = (y / sh - 0.5) * 1.6;
      for (let x = 0; x < sw; x++) {
        const nx = (x / sw - 0.5) * 1.6;
        const r2 = Math.min(1, nx * nx + ny * ny);
        distField[y * sw + x] = Math.sqrt(Math.max(0, 1 - r2 * 0.75));
      }
    }
  }

  const smoothLum = boxBlurFloat(closedLum, sw, sh, 4);
  const fineLum = boxBlurFloat(closedLum, sw, sh, 1);

  const outImg = tCtx.createImageData(sw, sh);
  const outPixels = outImg.data;
  for (let i = 0; i < sw * sh; i++) {
    if (!alphaMask[i] && hasCutoutSilhouette) {
      outPixels[i * 4] = 0;
      outPixels[i * 4 + 1] = 0;
      outPixels[i * 4 + 2] = 0;
      outPixels[i * 4 + 3] = 255;
      continue;
    }
    const puffPart = distField[i] * autoPuff;
    const shadingPart = (smoothLum[i] * 0.7 + fineLum[i] * 0.3) * (1 - autoPuff * 0.45);
    const combined = Math.max(0, Math.min(1, puffPart * 0.55 + shadingPart * 0.65));
    const val = Math.round(combined * 255);
    outPixels[i * 4] = val;
    outPixels[i * 4 + 1] = val;
    outPixels[i * 4 + 2] = val;
    outPixels[i * 4 + 3] = 255;
  }
  tCtx.putImageData(outImg, 0, 0);

  const dCtx = targetDepthCanvas.getContext('2d', { willReadFrequently: true })!;
  dCtx.save();
  dCtx.imageSmoothingEnabled = true;
  dCtx.imageSmoothingQuality = 'high';
  dCtx.clearRect(0, 0, w, h);
  dCtx.drawImage(tempCanvas, 0, 0, w, h);
  dCtx.restore();
}

function boxBlurFloat(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  if (radius <= 0) return new Float32Array(src);
  const tmp = new Float32Array(w * h);
  const dst = new Float32Array(w * h);
  const diam = radius * 2 + 1;

  for (let y = 0; y < h; y++) {
    let sum = 0;
    const row = y * w;
    for (let rx = -radius; rx <= radius; rx++) {
      sum += src[row + Math.min(w - 1, Math.max(0, rx))];
    }
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / diam;
      const left = Math.max(0, x - radius);
      const right = Math.min(w - 1, x + radius + 1);
      sum += src[row + right] - src[row + left];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let ry = -radius; ry <= radius; ry++) {
      sum += tmp[Math.min(h - 1, Math.max(0, ry)) * w + x];
    }
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = sum / diam;
      const top = Math.max(0, y - radius);
      const bot = Math.min(h - 1, y + radius + 1);
      sum += tmp[bot * w + x] - tmp[top * w + x];
    }
  }
  return dst;
}

export function paintRelightDepthStrokeSegment(
  layerId: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  settings: RelightSettings,
  canvasWidth: number,
  canvasHeight: number,
  pressure = 0.8,
  brushOpacity = 1.0
): void {
  const depthCanvas = getOrCreateRelightDepthCanvas(
    layerId,
    canvasWidth,
    canvasHeight,
    undefined,
    settings
  );
  const ctx = depthCanvas.getContext('2d', { willReadFrequently: true })!;
  const r = Math.max(2, radius);
  const softness = Math.max(0, Math.min(1, settings.sculptSoftness ?? 0.75));
  const flow = Math.max(0.02, Math.min(1, (settings.sculptStrength ?? 0.35) * brushOpacity * (0.5 + pressure * 0.5)));

  const dist = Math.hypot(x1 - x0, y1 - y0);
  const stepDist = Math.max(1.5, r * 0.16);
  const steps = Math.max(1, Math.ceil(dist / stepDist));

  if (settings.sculptSmoothMode) {
    const pad = Math.ceil(r + 6);
    const minX = Math.max(0, Math.floor(Math.min(x0, x1) - pad));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1) - pad));
    const maxX = Math.min(canvasWidth, Math.ceil(Math.max(x0, x1) + pad));
    const maxY = Math.min(canvasHeight, Math.ceil(Math.max(y0, y1) + pad));
    const bw = maxX - minX;
    const bh = maxY - minY;
    if (bw <= 2 || bh <= 2) return;

    const patch = document.createElement('canvas');
    patch.width = bw;
    patch.height = bh;
    const pCtx = patch.getContext('2d')!;
    pCtx.filter = `blur(${Math.max(2, Math.round(r * 0.25))}px)`;
    pCtx.drawImage(depthCanvas, minX, minY, bw, bh, 0, 0, bw, bh);
    pCtx.filter = 'none';

    ctx.save();
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = r * 2;
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.clip();
    ctx.globalAlpha = Math.min(0.85, flow * 1.4);
    ctx.drawImage(patch, minX, minY);
    ctx.restore();
    bumpRelightDepthRevision(layerId);
    return;
  }

  const targetGray = Math.round(Math.max(0, Math.min(1, settings.sculptTargetDepth ?? 0.85)) * 255);
  const colorRgb = `${targetGray}, ${targetGray}, ${targetGray}`;
  const dabAlpha = Math.min(0.65, flow * 0.28);

  ctx.save();
  for (let s = 0; s <= steps; s++) {
    const t = steps === 1 ? 1 : s / steps;
    const cx = x0 + (x1 - x0) * t;
    const cy = y0 + (y1 - y0) * t;

    if (softness <= 0.05) {
      ctx.fillStyle = `rgba(${colorRgb}, ${dabAlpha})`;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const innerR = r * Math.max(0, 1 - softness);
      const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, r);
      grad.addColorStop(0, `rgba(${colorRgb}, ${dabAlpha})`);
      grad.addColorStop(0.55, `rgba(${colorRgb}, ${dabAlpha * 0.55})`);
      grad.addColorStop(1, `rgba(${colorRgb}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  bumpRelightDepthRevision(layerId);
}

export function paintRelightDepthDab(
  layerId: string,
  x: number,
  y: number,
  radius: number,
  settings: RelightSettings,
  canvasWidth: number,
  canvasHeight: number
): void {
  paintRelightDepthStrokeSegment(
    layerId,
    x,
    y,
    x + 0.1,
    y + 0.1,
    radius,
    settings,
    canvasWidth,
    canvasHeight
  );
}

function hexToRgbNormalized(hex: string): [number, number, number] {
  const clean = (hex || '#ffffff').replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16) || 0xffffff;
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

// ─── WebGL GPU Hardware Relight Shader Pipeline (4K 60FPS) ──────────────────────

interface WebGLRelightContext {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext | WebGL2RenderingContext;
  program: WebGLProgram;
  srcTex: WebGLTexture;
  depthTex: WebGLTexture;
  uniforms: Record<string, WebGLUniformLocation | null>;
  lastDepthLayerId: string;
  lastDepthRev: number;
  lastDepthW: number;
  lastDepthH: number;
}

let glRelightCtx: WebGLRelightContext | null = null;
let glRelightInitFailed = false;

const VERTEX_SHADER_SRC = `
  attribute vec2 a_pos;
  varying vec2 v_uv;
  void main() {
    v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER_SRC = `
  precision highp float;
  varying vec2 v_uv;

  uniform sampler2D u_srcTex;
  uniform sampler2D u_depthTex;
  uniform vec2 u_res;
  uniform float u_step;
  uniform float u_relief;
  uniform vec3 u_ambient;
  uniform float u_origMix;
  uniform int u_viewNormals;
  uniform int u_respectAlpha;
  uniform int u_numLights;

  uniform vec3 u_lightPos[5];
  uniform vec3 u_lightColor[5];
  uniform vec3 u_lightParams[5]; // x = radPx, y = wrap, z = spec

  void main() {
    vec4 src = texture2D(u_srcTex, v_uv);
    if (u_respectAlpha == 1 && src.a < 0.02) {
      gl_FragColor = vec4(0.0);
      return;
    }

    vec2 texel = u_step / u_res;
    float zC = texture2D(u_depthTex, v_uv).r;
    float zL = texture2D(u_depthTex, v_uv - vec2(texel.x, 0.0)).r;
    float zR = texture2D(u_depthTex, v_uv + vec2(texel.x, 0.0)).r;
    float zU = texture2D(u_depthTex, v_uv - vec2(0.0, texel.y)).r;
    float zD = texture2D(u_depthTex, v_uv + vec2(0.0, texel.y)).r;

    vec3 N = normalize(vec3(-(zR - zL) * u_relief, -(zD - zU) * u_relief, 1.0));

    if (u_viewNormals == 1) {
      gl_FragColor = vec4(N.x * 0.5 + 0.5, -N.y * 0.5 + 0.5, N.z, src.a);
      return;
    }

    float lum = dot(src.rgb, vec3(0.299, 0.587, 0.114));
    float delit = 1.0 / max(0.35, sqrt(max(0.001, lum)));
    float mixFactor = 1.0 - u_origMix + u_origMix * delit;
    vec3 albedo = min(vec3(1.15), src.rgb * mixFactor);

    vec3 totalLight = u_ambient + src.rgb * u_origMix;
    vec3 totalSpec = vec3(0.0);

    float diag = length(u_res);
    vec2 fragPx = v_uv * u_res;
    float surfaceZ = (zC - 0.5) * diag * 0.22;

    for (int i = 0; i < 5; i++) {
      if (i >= u_numLights) break;

      vec3 lPos = u_lightPos[i];
      vec3 lCol = u_lightColor[i];
      float radPx = u_lightParams[i].x;
      float wrap = u_lightParams[i].y;
      float specStrength = u_lightParams[i].z;

      vec2 d2 = lPos.xy - fragPx;
      float dist2D = length(d2);
      if (dist2D > radPx * 1.35) continue;

      float dz = lPos.z - surfaceZ;
      vec3 L = normalize(vec3(d2, dz));

      float normDist = min(1.0, dist2D / max(1.0, radPx));
      float atten = (1.0 - normDist) * (1.0 - normDist * 0.65);

      float diffuse = 0.0;
      if (lPos.z < 0.0) {
        float edgeTilt = 1.0 - max(0.0, N.z);
        float rimAlign = max(0.0, dot(N.xy, L.xy));
        diffuse = min(1.0, (edgeTilt * 1.6 + rimAlign * 0.65) * (1.0 + wrap * 0.5));
      } else {
        float nDotL = dot(N, L);
        diffuse = max(0.0, (nDotL + wrap) / (1.0 + wrap));
      }

      totalLight += lCol * (diffuse * atten);

      if (specStrength > 0.01 && diffuse > 0.0) {
        vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
        float nDotH = max(0.0, dot(N, H));
        float s2 = nDotH * nDotH;
        float s4 = s2 * s2;
        float s16 = s4 * s4;
        totalSpec += lCol * (s16 * specStrength * atten * 0.65);
      }
    }

    vec3 finalRgb = clamp(albedo * totalLight + totalSpec, 0.0, 1.0);
    gl_FragColor = vec4(finalRgb, src.a);
  }
`;

function getWebGLRelightContext(): WebGLRelightContext | null {
  if (glRelightInitFailed) return null;
  if (glRelightCtx) return glRelightCtx;

  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true }) ||
      canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true })) as
      | WebGLRenderingContext
      | WebGL2RenderingContext
      | null;

    if (!gl) {
      glRelightInitFailed = true;
      return null;
    }

    const compileShader = (type: number, src: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn('Relight shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const fs = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
    if (!vs || !fs) {
      glRelightInitFailed = true;
      return null;
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      glRelightInitFailed = true;
      return null;
    }

    gl.useProgram(program);

    // Fullscreen quad buffer
    const quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const createTex = () => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return tex;
    };

    const srcTex = createTex();
    const depthTex = createTex();

    const uniformNames = [
      'u_srcTex',
      'u_depthTex',
      'u_res',
      'u_step',
      'u_relief',
      'u_ambient',
      'u_origMix',
      'u_viewNormals',
      'u_respectAlpha',
      'u_numLights',
    ];
    for (let i = 0; i < 5; i++) {
      uniformNames.push(`u_lightPos[${i}]`, `u_lightColor[${i}]`, `u_lightParams[${i}]`);
    }

    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    for (const name of uniformNames) {
      uniforms[name] = gl.getUniformLocation(program, name);
    }

    glRelightCtx = {
      canvas,
      gl,
      program,
      srcTex,
      depthTex,
      uniforms,
      lastDepthLayerId: '',
      lastDepthRev: -1,
      lastDepthW: 0,
      lastDepthH: 0,
    };
    return glRelightCtx;
  } catch {
    glRelightInitFailed = true;
    return null;
  }
}

// Reusable CPU fallback buffers
let workSrcCanvas: HTMLCanvasElement | null = null;
let workDepthCanvas: HTMLCanvasElement | null = null;
let workOutCanvas: HTMLCanvasElement | null = null;

/**
 * WebGL2 GPU-Accelerated 2.5D Deferred Relighting Renderer
 * Renders 4K canvases on the GPU in <1ms with automatic smart caching.
 */
export function renderRelightAdjustmentLayer(
  sourceCanvas: HTMLCanvasElement,
  layerId: string,
  rawSettings: Record<string, any>
): HTMLCanvasElement {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  if (w === 0 || h === 0) return sourceCanvas;

  const settings: RelightSettings = {
    ...createDefaultRelightSettings(),
    ...rawSettings,
  };

  const depthCanvas = getOrCreateRelightDepthCanvas(layerId, w, h, sourceCanvas, settings);

  // Instant zero-copy return when viewing unlit or raw Depth Map
  if (settings.viewMode === 'unlit') {
    return sourceCanvas;
  }
  if (settings.viewMode === 'depth') {
    return depthCanvas;
  }

  const depthRev = getRelightDepthRevision(layerId);

  const sig = JSON.stringify({
    w,
    h,
    depthRev,
    fast: relightInteractiveFastMode ? 1 : 0,
    vm: settings.viewMode,
    ac: settings.ambientColor,
    ap: settings.ambientPower,
    ol: settings.originalLighting,
    sr: settings.surfaceRelief,
    ss: settings.surfaceSmoothness,
    ra: settings.respectSubjectAlpha,
    lights: settings.lights,
  });

  const cached = relightOutputCache.get(layerId);
  if (cached && cached.signature === sig && cached.canvas.width === w && cached.canvas.height === h) {
    return cached.canvas;
  }

  // 1. Try Hardware WebGL2 / WebGL1 GPU Fragment Shader Path
  const glCtx = getWebGLRelightContext();
  if (glCtx && !glCtx.gl.isContextLost()) {
    const { gl, canvas: glCanvas, program, srcTex, depthTex, uniforms } = glCtx;

    // During interactive drag on huge >2K canvases, use 0.75x internal viewport for 120Hz responsiveness
    const gpuScale = relightInteractiveFastMode && Math.max(w, h) > 1600 ? 0.75 : 1.0;
    const gw = Math.max(16, Math.round(w * gpuScale));
    const gh = Math.max(16, Math.round(h * gpuScale));

    if (glCanvas.width !== gw || glCanvas.height !== gh) {
      glCanvas.width = gw;
      glCanvas.height = gh;
    }

    gl.viewport(0, 0, gw, gh);
    gl.useProgram(program);

    // Upload Source Canvas to Texture Unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
    gl.uniform1i(uniforms['u_srcTex'], 0);

    // Upload Depth Canvas to Texture Unit 1 (only re-upload if depth map or layer changed!)
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, depthTex);
    if (
      glCtx.lastDepthLayerId !== layerId ||
      glCtx.lastDepthRev !== depthRev ||
      glCtx.lastDepthW !== depthCanvas.width ||
      glCtx.lastDepthH !== depthCanvas.height
    ) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, depthCanvas);
      glCtx.lastDepthLayerId = layerId;
      glCtx.lastDepthRev = depthRev;
      glCtx.lastDepthW = depthCanvas.width;
      glCtx.lastDepthH = depthCanvas.height;
    }
    gl.uniform1i(uniforms['u_depthTex'], 1);

    const [ambR, ambG, ambB] = hexToRgbNormalized(settings.ambientColor || '#ffffff');
    const ambPower = settings.ambientPower ?? 0.15;
    const diag = Math.hypot(gw, gh);

    gl.uniform2f(uniforms['u_res'], gw, gh);
    gl.uniform1f(uniforms['u_step'], Math.max(1, (settings.surfaceSmoothness || 3) * gpuScale));
    gl.uniform1f(uniforms['u_relief'], (settings.surfaceRelief ?? 1.15) * 4.5);
    gl.uniform3f(uniforms['u_ambient'], ambR * ambPower, ambG * ambPower, ambB * ambPower);
    gl.uniform1f(uniforms['u_origMix'], settings.originalLighting ?? 0.15);
    gl.uniform1i(uniforms['u_viewNormals'], settings.viewMode === 'normals' ? 1 : 0);
    gl.uniform1i(uniforms['u_respectAlpha'], settings.respectSubjectAlpha !== false ? 1 : 0);

    const lights = (settings.lights || []).slice(0, 5);
    gl.uniform1i(uniforms['u_numLights'], lights.length);

    for (let i = 0; i < lights.length; i++) {
      const l = lights[i];
      const [lr, lg, lb] = hexToRgbNormalized(l.color);
      gl.uniform3f(uniforms[`u_lightPos[${i}]`], l.x * gw, l.y * gh, l.z * diag * 0.35);
      gl.uniform3f(uniforms[`u_lightColor[${i}]`], lr * l.power, lg * l.power, lb * l.power);
      gl.uniform3f(
        uniforms[`u_lightParams[${i}]`],
        Math.max(12, l.radius * diag * 0.65),
        Math.max(0, Math.min(1, l.diffusion ?? 0.4)),
        l.specular ?? 0.3
      );
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    let finalCanvas = cached?.canvas;
    if (!finalCanvas || finalCanvas.width !== w || finalCanvas.height !== h) {
      finalCanvas = document.createElement('canvas');
      finalCanvas.width = w;
      finalCanvas.height = h;
    }
    const fCtx = finalCanvas.getContext('2d')!;
    fCtx.clearRect(0, 0, w, h);
    fCtx.drawImage(glCanvas, 0, 0, w, h);

    relightOutputCache.set(layerId, {
      signature: sig,
      canvas: finalCanvas,
    });

    return finalCanvas;
  }

  // 2. Fallback Proxy CPU Path (if WebGL is unavailable)
  const scaleFactor = relightInteractiveFastMode
    ? Math.min(1, 512 / Math.max(w, h))
    : Math.min(1, 960 / Math.max(w, h));
  const pw = Math.max(16, Math.round(w * scaleFactor));
  const ph = Math.max(16, Math.round(h * scaleFactor));

  if (!workSrcCanvas || workSrcCanvas.width !== pw || workSrcCanvas.height !== ph) {
    workSrcCanvas = document.createElement('canvas');
    workSrcCanvas.width = pw;
    workSrcCanvas.height = ph;
  }
  if (!workDepthCanvas || workDepthCanvas.width !== pw || workDepthCanvas.height !== ph) {
    workDepthCanvas = document.createElement('canvas');
    workDepthCanvas.width = pw;
    workDepthCanvas.height = ph;
  }
  if (!workOutCanvas || workOutCanvas.width !== pw || workOutCanvas.height !== ph) {
    workOutCanvas = document.createElement('canvas');
    workOutCanvas.width = pw;
    workOutCanvas.height = ph;
  }

  const sCtx = workSrcCanvas.getContext('2d', { willReadFrequently: true })!;
  const dCtx = workDepthCanvas.getContext('2d', { willReadFrequently: true })!;
  const pOutCtx = workOutCanvas.getContext('2d', { willReadFrequently: true })!;

  sCtx.clearRect(0, 0, pw, ph);
  sCtx.drawImage(sourceCanvas, 0, 0, pw, ph);

  dCtx.clearRect(0, 0, pw, ph);
  dCtx.drawImage(depthCanvas, 0, 0, pw, ph);

  const srcImg = sCtx.getImageData(0, 0, pw, ph);
  const depthImg = dCtx.getImageData(0, 0, pw, ph);
  const outImg = pOutCtx.createImageData(pw, ph);

  const src = srcImg.data;
  const dData = depthImg.data;
  const dst = outImg.data;

  const step = Math.max(1, Math.min(5, Math.round((settings.surfaceSmoothness || 3) * scaleFactor)));
  const relief = (settings.surfaceRelief ?? 1.15) * 4.5;

  const [ambR, ambG, ambB] = hexToRgbNormalized(settings.ambientColor || '#ffffff');
  const ambPower = settings.ambientPower ?? 0.15;
  const origMix = settings.originalLighting ?? 0.15;
  const diag = Math.sqrt(pw * pw + ph * ph);

  const parsedLights = (settings.lights || []).map((l) => {
    const [lr, lg, lb] = hexToRgbNormalized(l.color);
    const radPx = Math.max(12, l.radius * diag * 0.65);
    const maxDistPx = radPx * 1.35;
    return {
      lx: l.x * pw,
      ly: l.y * ph,
      lz: l.z * diag * 0.35,
      lr: lr * l.power,
      lg: lg * l.power,
      lb: lb * l.power,
      radPx,
      maxDistSq: maxDistPx * maxDistPx,
      wrap: Math.max(0, Math.min(1, l.diffusion ?? 0.4)),
      spec: l.specular ?? 0.3,
      isBacklight: l.z < 0,
    };
  });

  const viewNormals = settings.viewMode === 'normals';
  const respectAlpha = settings.respectSubjectAlpha !== false;
  const numLights = parsedLights.length;

  for (let y = 0; y < ph; y++) {
    const yUp = Math.max(0, y - step) * pw;
    const yDown = Math.min(ph - 1, y + step) * pw;
    const yRow = y * pw;

    for (let x = 0; x < pw; x++) {
      const pIdx = (yRow + x) * 4;
      const alpha = src[pIdx + 3];

      if (respectAlpha && alpha < 5) {
        dst[pIdx + 3] = 0;
        continue;
      }

      const xLeft = Math.max(0, x - step);
      const xRight = Math.min(pw - 1, x + step);

      const zCenter = dData[pIdx] * 0.0039215686;
      const zL = dData[(yRow + xLeft) * 4] * 0.0039215686;
      const zR = dData[(yRow + xRight) * 4] * 0.0039215686;
      const zU = dData[(yUp + x) * 4] * 0.0039215686;
      const zD = dData[(yDown + x) * 4] * 0.0039215686;

      let nx = -(zR - zL) * relief;
      let ny = -(zD - zU) * relief;
      let nz = 1.0;
      const invLen = 1.0 / Math.sqrt(nx * nx + ny * ny + 1.0);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      if (viewNormals) {
        dst[pIdx] = (nx * 0.5 + 0.5) * 255;
        dst[pIdx + 1] = (-ny * 0.5 + 0.5) * 255;
        dst[pIdx + 2] = nz * 255;
        dst[pIdx + 3] = alpha;
        continue;
      }

      const sr = src[pIdx] * 0.0039215686;
      const sg = src[pIdx + 1] * 0.0039215686;
      const sb = src[pIdx + 2] * 0.0039215686;

      const lum = 0.299 * sr + 0.587 * sg + 0.114 * sb;
      const delitFactor = 1.0 / Math.max(0.35, Math.sqrt(lum));
      const mixFactor = 1 - origMix + origMix * delitFactor;
      const albR = Math.min(1.15, sr * mixFactor);
      const albG = Math.min(1.15, sg * mixFactor);
      const albB = Math.min(1.15, sb * mixFactor);

      let totalLightR = ambR * ambPower + sr * origMix;
      let totalLightG = ambG * ambPower + sg * origMix;
      let totalLightB = ambB * ambPower + sb * origMix;

      let totalSpecR = 0;
      let totalSpecG = 0;
      let totalSpecB = 0;

      const surfaceZ = (zCenter - 0.5) * diag * 0.22;

      for (let li = 0; li < numLights; li++) {
        const L = parsedLights[li];
        const dx = L.lx - x;
        const dy = L.ly - y;
        const dist2DSq = dx * dx + dy * dy;
        if (dist2DSq > L.maxDistSq) continue;

        const dz = L.lz - surfaceZ;
        const dist2D = Math.sqrt(dist2DSq);
        const invDist3D = 1.0 / (Math.sqrt(dist2DSq + dz * dz) + 0.0001);
        const lvx = dx * invDist3D;
        const lvy = dy * invDist3D;
        const lvz = dz * invDist3D;

        const normDist = Math.min(1, dist2D / L.radPx);
        const atten = (1 - normDist) * (1 - normDist * 0.65);

        let diffuse = 0;
        if (L.isBacklight) {
          const edgeTilt = 1.0 - Math.max(0, nz);
          const rimAlign = Math.max(0, nx * lvx + ny * lvy);
          diffuse = Math.min(1, (edgeTilt * 1.6 + rimAlign * 0.65) * (1 + L.wrap * 0.5));
        } else {
          const nDotL = nx * lvx + ny * lvy + nz * lvz;
          diffuse = Math.max(0, (nDotL + L.wrap) / (1 + L.wrap));
        }

        const contrib = diffuse * atten;
        totalLightR += L.lr * contrib;
        totalLightG += L.lg * contrib;
        totalLightB += L.lb * contrib;

        if (L.spec > 0.01 && diffuse > 0) {
          const hz = lvz + 1.0;
          const invHLen = 1.0 / (Math.sqrt(lvx * lvx + lvy * lvy + hz * hz) + 0.0001);
          const nDotH = Math.max(0, (nx * lvx + ny * lvy + nz * hz) * invHLen);
          const s2 = nDotH * nDotH;
          const s4 = s2 * s2;
          const s16 = s4 * s4;
          const specTerm = s16 * L.spec * atten * 0.65;
          totalSpecR += L.lr * specTerm;
          totalSpecG += L.lg * specTerm;
          totalSpecB += L.lb * specTerm;
        }
      }

      dst[pIdx] = Math.min(255, (albR * totalLightR + totalSpecR) * 255);
      dst[pIdx + 1] = Math.min(255, (albG * totalLightG + totalSpecG) * 255);
      dst[pIdx + 2] = Math.min(255, (albB * totalLightB + totalSpecB) * 255);
      dst[pIdx + 3] = alpha;
    }
  }

  pOutCtx.putImageData(outImg, 0, 0);

  let finalCanvas = cached?.canvas;
  if (!finalCanvas || finalCanvas.width !== w || finalCanvas.height !== h) {
    finalCanvas = document.createElement('canvas');
    finalCanvas.width = w;
    finalCanvas.height = h;
  }
  const fCtx = finalCanvas.getContext('2d')!;
  fCtx.save();
  fCtx.clearRect(0, 0, w, h);
  fCtx.imageSmoothingEnabled = true;
  fCtx.imageSmoothingQuality = 'high';
  fCtx.drawImage(workOutCanvas, 0, 0, w, h);
  fCtx.restore();

  relightOutputCache.set(layerId, {
    signature: sig,
    canvas: finalCanvas,
  });

  return finalCanvas;
}