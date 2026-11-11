import { Brush, StrokePoint, DualBrushConfig } from '../types/canvas';
import { PREDEFINED_BRUSH_TIPS } from '../constants/predefinedBrushTips';
import { getCanvasCompositeOperation } from './blendModes';

const kritaTipImageCache = new Map<string, HTMLImageElement>();
const kritaPatternCanvasCache = new Map<string, HTMLCanvasElement>();
const tipLoadListeners = new Set<() => void>();

export function onKritaTipTextureLoaded(cb: () => void): () => void {
  tipLoadListeners.add(cb);
  return () => {
    tipLoadListeners.delete(cb);
  };
}

export function preloadKritaTexture(url?: string): HTMLImageElement | null {
  if (!url) return null;
  const existing = kritaTipImageCache.get(url);
  if (existing) {
    return existing.complete && existing.naturalWidth > 0 ? existing : null;
  }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    kritaTipImageCache.set(url, img);
    tipLoadListeners.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
  };
  img.src = url;
  kritaTipImageCache.set(url, img);
  return img.complete && img.naturalWidth > 0 ? img : null;
}

export interface KritaPatternDef {
  id: string;
  name: string;
  url?: string;
  customUrl?: string;
  tag?: string;
  dim?: string;
  isCustom?: boolean;
}

export const KRITA_BUILTIN_PATTERNS: KritaPatternDef[] = [
  { id: 'none', name: '00_No_Pattern (Solid)', tag: 'All' },
  { id: '01_canvas', name: '01 Canvas', url: '/assets/aistudio/01_canvas_57b8ade6.png', tag: 'Paper & Canvas', dim: '200x200' },
  { id: '02_rough_canvas', name: '02 Rough Canvas', url: '/assets/aistudio/02_rough-canvas_3953f1fa.png', tag: 'Paper & Canvas', dim: '256x256' },
  { id: '02b_woof_tissue', name: '02b Woof Tissue', url: '/assets/aistudio/02b_WoofTissue_636cf938.png', tag: 'Paper & Canvas', dim: '256x256' },
  { id: '03_default_paper', name: '03 Default Paper', url: '/assets/aistudio/03_default-paper_55ada35d.png', tag: 'Paper & Canvas', dim: '256x256' },
  { id: '04_paper_c_grain', name: '04 Paper C Grain', url: '/assets/aistudio/04_paper-C-grain_f76947e3.png', tag: 'Paper & Canvas', dim: '256x256' },
  { id: '05_paper_torchon', name: '05 Paper Torchon', url: '/assets/aistudio/05_paper-torchon_645f29d2.png', tag: 'Paper & Canvas', dim: '256x256' },
  { id: '06_hard_grain', name: '06 Hard Grain', url: '/assets/aistudio/06_hard-grain_535a2c1b.png', tag: 'Paper & Canvas', dim: '256x256' },
  { id: 'rough_paper', name: 'Rough Paper', url: '/assets/aistudio/Rough_Paper_0d371b93.png', tag: 'Paper & Canvas', dim: '512x512' },
  { id: 'sand_fine', name: 'Sand Fine', url: '/assets/aistudio/Sand_fine_a775f82b.png', tag: 'Paper & Canvas', dim: '512x512' },

  { id: '08_bump_relief', name: '08 Bump Relief', url: '/assets/aistudio/08_bump-relief_70b0ae52.png', tag: 'Surface & Relief', dim: '256x256' },
  { id: '14_texture_rock', name: '14 Texture Rock', url: '/assets/aistudio/14_texture-rock_113b7bf5.png', tag: 'Surface & Relief', dim: '256x256' },
  { id: '15_texture_rock_b', name: '15 Texture Rock B', url: '/assets/aistudio/15_texture-rockB_c4b9c038.png', tag: 'Surface & Relief', dim: '256x256' },
  { id: '17_texture_melt', name: '17 Texture Melt', url: '/assets/aistudio/17_texture-melt_0f90b6e2.png', tag: 'Surface & Relief', dim: '256x256' },
  { id: '19_texture_crackle', name: '19 Texture Crackle', url: '/assets/aistudio/19_texture-crackle_27df36d9.png', tag: 'Surface & Relief', dim: '256x256' },
  { id: '26_brush_marks', name: '26 Brush Marks', url: '/assets/aistudio/26_brush-marks_048274ee.png', tag: 'Surface & Relief', dim: '256x256' },
  { id: 'rough_wall_impasto', name: 'Rough Wall Impasto', url: '/assets/aistudio/Rough_Wall_With_Impasto_0ce1010c.png', tag: 'Surface & Relief', dim: '512x512' },

  { id: '09_crosshatched', name: '09 Crosshatched', url: '/assets/aistudio/09_drawed_crosshatched_4999de88.png', tag: 'Lines & Screentones', dim: '256x256' },
  { id: '09b_crossed_lines', name: '09b Crossed Lines', url: '/assets/aistudio/09b_drawed-CrossedLines_8548ba38.png', tag: 'Lines & Screentones', dim: '256x256' },
  { id: '10_dotted', name: '10 Dotted', url: '/assets/aistudio/10_drawed_dotted_a3deb0af.png', tag: 'Lines & Screentones', dim: '256x256' },
  { id: '12_vertical', name: '12 Vertical Lines', url: '/assets/aistudio/12_drawed_vertical_b86b9d48.png', tag: 'Lines & Screentones', dim: '256x256' },
  { id: '18b_wave_flex', name: '18b Wave Flex', url: '/assets/aistudio/18b_WaveFlex_ca30c338.png', tag: 'Lines & Screentones', dim: '256x256' },
  { id: '21_texture_chainmail', name: '21 Chainmail', url: '/assets/aistudio/21_texture-chainmail_87377c78.png', tag: 'Lines & Screentones', dim: '256x256' },
  { id: '23_screentone_a', name: '23 Screentone A', url: '/assets/aistudio/23-dynamic-screentone-A_cdc9be2f.png', tag: 'Lines & Screentones', dim: '256x256' },
  { id: '24_screentone_b', name: '24 Screentone B', url: '/assets/aistudio/24-dynamic-screentone-B_3ca80eda.png', tag: 'Lines & Screentones', dim: '256x256' },
  { id: '25_screentone_c', name: '25 Screentone C', url: '/assets/aistudio/25-dynamic-screentone-C_1ac0427a.png', tag: 'Lines & Screentones', dim: '256x256' },
  { id: 'abstract_lines', name: 'Abstract Lines', url: '/assets/aistudio/Abstract_lines_2922335f.png', tag: 'Lines & Screentones', dim: '512x512' },
  { id: 'maze_lines', name: 'Maze Lines', url: '/assets/aistudio/Maze_lines_e18291b4.png', tag: 'Lines & Screentones', dim: '512x512' },
  { id: 'stars_sized', name: 'Stars Sized', url: '/assets/aistudio/Stars_Sized_e1d3b97c.png', tag: 'Lines & Screentones', dim: '512x512' },

  { id: '11_furry', name: '11 Furry', url: '/assets/aistudio/11_drawed_furry_19ff2920.png', tag: 'Organic', dim: '256x256' },
  { id: '13_swirl', name: '13 Swirl', url: '/assets/aistudio/13_drawed_swirl_60078339.png', tag: 'Organic', dim: '256x256' },
  { id: '16_texture_woody', name: '16 Woody', url: '/assets/aistudio/16_texture-woody_bcb02aa9.png', tag: 'Organic', dim: '256x256' },
  { id: '18_texture_bark', name: '18 Tree Bark', url: '/assets/aistudio/18_texture-bark_b2c6d7b2.png', tag: 'Organic', dim: '256x256' },
  { id: '20_texture_vegetal', name: '20 Vegetal', url: '/assets/aistudio/20_texture-vegetal_798ab098.png', tag: 'Organic', dim: '256x256' },
  { id: '22_texture_reptile', name: '22 Reptile Scales', url: '/assets/aistudio/22_texture-reptile_0f1b1fa6.png', tag: 'Organic', dim: '256x256' },
];

const CUSTOM_PATTERNS_STORAGE_KEY = 'hunbatz_custom_patterns_v1';

function loadStoredCustomPatterns(): KritaPatternDef[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PATTERNS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((p) => ({ ...p, isCustom: true }));
      }
    }
  } catch {}
  return [];
}

function saveStoredCustomPatterns(patterns: KritaPatternDef[]) {
  try {
    localStorage.setItem(CUSTOM_PATTERNS_STORAGE_KEY, JSON.stringify(patterns));
  } catch {}
}

// Global user-uploaded patterns shared across Brush Studio & Pattern Fill
const customUserPatterns: KritaPatternDef[] = loadStoredCustomPatterns();

export function getAllKritaPatterns(): KritaPatternDef[] {
  return [...KRITA_BUILTIN_PATTERNS, ...customUserPatterns];
}

// Auto-preload textures and predefined brush tips in background
if (typeof window !== 'undefined') {
  setTimeout(() => {
    KRITA_BUILTIN_PATTERNS.forEach((p) => {
      if (p.url) preloadKritaTexture(p.url);
    });
    PREDEFINED_BRUSH_TIPS.forEach((t) => {
      if (t.url) preloadKritaTexture(t.url);
    });
  }, 100);
}

export function registerCustomKritaPattern(
  name: string,
  dataUrl: string,
  explicitId?: string
): KritaPatternDef {
  const id = explicitId || `custom_pat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const existing = customUserPatterns.find(
    (p) => p.id === id || p.url === dataUrl || p.customUrl === dataUrl
  );
  if (existing) {
    existing.name = name;
    existing.customUrl = dataUrl;
    preloadKritaTexture(dataUrl);
    return existing;
  }
  const def: KritaPatternDef = { id, name, url: dataUrl, customUrl: dataUrl, tag: 'Textures', isCustom: true };
  customUserPatterns.push(def);
  saveStoredCustomPatterns(customUserPatterns);
  preloadKritaTexture(dataUrl);
  return def;
}

export function deleteCustomKritaPattern(patternId: string): void {
  const idx = customUserPatterns.findIndex((p) => p.id === patternId);
  if (idx !== -1) {
    customUserPatterns.splice(idx, 1);
    saveStoredCustomPatterns(customUserPatterns);
    kritaPatternCanvasCache.delete(patternId);
  }
}

const patternImageDataCache = new Map<HTMLCanvasElement | HTMLImageElement, ImageData>();

export function getPatternImageData(
  source: HTMLCanvasElement | HTMLImageElement
): ImageData | null {
  if (!source) return null;
  const cached = patternImageDataCache.get(source);
  if (cached) return cached;
  try {
    if (source instanceof HTMLImageElement) {
      if (!source.complete || source.naturalWidth <= 0 || source.naturalHeight <= 0) return null;
      const c = document.createElement('canvas');
      c.width = source.naturalWidth;
      c.height = source.naturalHeight;
      const ctx = c.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(source, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height);
      patternImageDataCache.set(source, data);
      return data;
    } else {
      if (source.width <= 0 || source.height <= 0) return null;
      const ctx = source.getContext('2d');
      if (!ctx) return null;
      const data = ctx.getImageData(0, 0, source.width, source.height);
      patternImageDataCache.set(source, data);
      return data;
    }
  } catch {
    return null;
  }
}

export function getKritaPatternCanvas(patternId: string): HTMLCanvasElement | null {
  if (!patternId || patternId === 'none') return null;
  if (kritaPatternCanvasCache.has(patternId)) {
    return kritaPatternCanvasCache.get(patternId)!;
  }

  // Check built-in and custom uploaded patterns
  const allPatterns = getAllKritaPatterns();
  const matched = allPatterns.find(
    (p) =>
      p.id === patternId ||
      p.name === patternId ||
      p.url === patternId ||
      p.customUrl === patternId ||
      (p.url && patternId.includes(p.id)) ||
      (p.id !== 'none' && patternId.toLowerCase().includes(p.id.toLowerCase()))
  );

  const targetUrl =
    matched?.customUrl ||
    matched?.url ||
    (patternId.startsWith('data:') || patternId.startsWith('blob:') || patternId.startsWith('/assets/') || patternId.startsWith('/hunbatz-content/')
      ? patternId
      : undefined);

  if (targetUrl) {
    const img = preloadKritaTexture(targetUrl);
    if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || 64;
      c.height = img.naturalHeight || 64;
      const cCtx = c.getContext('2d')!;
      cCtx.drawImage(img, 0, 0);
      const imgData = cCtx.getImageData(0, 0, c.width, c.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const lum = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
        d[i] = lum;
        d[i + 1] = lum;
        d[i + 2] = lum;
        d[i + 3] = 255;
      }
      cCtx.putImageData(imgData, 0, 0);
      kritaPatternCanvasCache.set(patternId, c);
      patternImageDataCache.set(c, imgData);
      return c;
    }
  }

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const d = imgData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 255;
      const nx = x / size;
      const ny = y / size;

      switch (patternId) {
        case '01_canvas': {
          const warp = 0.5 + 0.5 * Math.sin(nx * Math.PI * 16);
          const weft = 0.5 + 0.5 * Math.cos(ny * Math.PI * 16);
          v = Math.pow(warp * weft, 0.6) * 255;
          break;
        }
        case '02_rough_canvas': {
          // Rough, fibrous paper with deep tooth depressions
          const warp = Math.abs(Math.sin(nx * Math.PI * 12));
          const weft = Math.abs(Math.cos(ny * Math.PI * 12));
          const grain = (Math.abs(Math.sin(x * 37.1 + y * 53.3) * 23421)) % 1;
          v = Math.pow(warp * weft, 0.7) * 205 + grain * 50;
          break;
        }
        case '03_default_paper': {
          // Multi-frequency organic paper fibers and micro-tooth
          const f1 = Math.sin(x * 0.28 + Math.cos(y * 0.28) * 1.6);
          const f2 = Math.cos(y * 0.22 + Math.sin(x * 0.22) * 1.4);
          const fine = (Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453)) % 1;
          const combined = (f1 * 0.35 + f2 * 0.35 + fine * 0.3); // -0.4 to 1.0
          v = Math.max(0, Math.min(255, (combined + 0.5) * 190));
          break;
        }
        case '04_cold_press': {
          // Undulating cotton watercolor paper dimples
          const dimple1 = Math.sin(nx * Math.PI * 8) * Math.cos(ny * Math.PI * 8);
          const dimple2 = Math.sin(nx * Math.PI * 16 + 1.2) * Math.cos(ny * Math.PI * 16 + 0.8);
          const fine = (Math.abs(Math.sin(x * 19.3 + y * 67.1) * 28471)) % 1;
          v = Math.max(0, Math.min(255, ((dimple1 * 0.4 + dimple2 * 0.3 + 0.5) * 0.75 + fine * 0.25) * 255));
          break;
        }
        case '05_charcoal_grain': {
          // Laid wire lines with porous cross-pulp
          const laidLine = 0.5 + 0.5 * Math.sin(ny * Math.PI * 24);
          const crossFiber = 0.5 + 0.5 * Math.sin(nx * Math.PI * 8);
          const fine = (Math.abs(Math.sin(x * 41.13 + y * 91.7) * 19543)) % 1;
          v = Math.max(0, Math.min(255, (laidLine * 0.5 + crossFiber * 0.2 + fine * 0.3) * 255));
          break;
        }
        case '06_pastel_tooth': {
          // Abrasive pastel paper / sandpaper tooth with sharp peaks
          const h = (Math.abs(Math.sin(x * 91.3 + y * 47.7) * 31415)) % 1;
          const cluster = 0.5 + 0.5 * Math.sin(x * 0.3) * Math.cos(y * 0.3);
          v = Math.pow(h * 0.75 + cluster * 0.25, 1.5) * 255;
          break;
        }
        case '07_halftone_dots': {
          const cx = (x % 8) - 3.5;
          const cy = (y % 8) - 3.5;
          v = Math.hypot(cx, cy) < 2.6 ? 255 : 35;
          break;
        }
        case '08_crosshatch_fine': {
          // Fine woven crosshatch threads
          const hThread = Math.abs(Math.sin(ny * Math.PI * 32));
          const vThread = Math.abs(Math.sin(nx * Math.PI * 32));
          const fine = (Math.abs(Math.sin(x * 51.1 + y * 73.3) * 17482)) % 1;
          v = Math.max(0, Math.min(255, (Math.max(hThread, vThread) * 0.7 + fine * 0.3) * 255));
          break;
        }
        case '09_diagonal_lines':
          v = (x + y) % 6 < 3 ? 255 : 65;
          break;
        case '10_hex_comb': {
          const hx = x % 12;
          const hy = y % 12;
          const distEdge = Math.min(hx, 12 - hx, hy, 12 - hy);
          v = distEdge <= 1.5 ? 60 : 255;
          break;
        }
        case '11_checker_tartan':
        case '11_checker_ tartan':
          v = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? 255 : 110;
          break;
        case '12_noise_rock': {
          // Pebble / cobblestone mounds for Cobble Skate stippling
          const px = (x % 16) - 8;
          const py = (y % 16) - 8;
          const pDist = Math.hypot(px, py) / 8;
          const mound = Math.max(0, 1 - pDist * pDist);
          const fine = (Math.abs(Math.sin(x * 17.3 + y * 29.7) * 43127)) % 1;
          v = Math.max(0, Math.min(255, (Math.pow(mound, 1.3) * 0.8 + fine * 0.2) * 255));
          break;
        }
        case '13_bark_wood':
          v = 130 + 125 * Math.sin(x * 0.9 + Math.sin(y * 0.2) * 3.0);
          break;
        case '14_scales': {
          const sx = (x + (Math.floor(y / 8) % 2) * 4) % 8 - 4;
          const sy = (y % 8) - 4;
          v = Math.hypot(sx, sy) > 3.1 ? 75 : 245;
          break;
        }
        case '15_stucco': {
          const h4 = Math.sin(x * 7.13 + y * 15.7) * 9812.3;
          v = 140 + Math.sin((h4 - Math.floor(h4)) * 6.28) * 110;
          break;
        }
        default:
          v = 255;
      }

      const idx = (y * size + x) * 4;
      const clamped = Math.max(0, Math.min(255, Math.round(v)));
      d[idx] = clamped;
      d[idx + 1] = clamped;
      d[idx + 2] = clamped;
      d[idx + 3] = clamped;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  kritaPatternCanvasCache.set(patternId, canvas);
  return canvas;
}

let dabBufferCanvas: HTMLCanvasElement | null = null;
let dabBufferCtx: CanvasRenderingContext2D | null = null;
let smudgeCarryCanvas: HTMLCanvasElement | null = null;
let smudgeCarryCtx: CanvasRenderingContext2D | null = null;
let lastSmudgeStrokeTime = 0;
let gihPipeIndex = 0;
let shapeSpikeHistory: { x: number; y: number }[] = [];
let lastShapeSpikeTime = 0;

function getDabBuffer(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const dim = Math.max(8, Math.ceil(size));
  if (!dabBufferCanvas) {
    dabBufferCanvas = document.createElement('canvas');
    dabBufferCtx = dabBufferCanvas.getContext('2d')!;
  }
  if (dabBufferCanvas.width < dim || dabBufferCanvas.height < dim) {
    dabBufferCanvas.width = Math.max(dim, 256);
    dabBufferCanvas.height = Math.max(dim, 256);
  }
  return { canvas: dabBufferCanvas, ctx: dabBufferCtx! };
}

function getSmudgeCarryBuffer(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const dim = Math.max(8, Math.ceil(size));
  if (!smudgeCarryCanvas) {
    smudgeCarryCanvas = document.createElement('canvas');
    smudgeCarryCtx = smudgeCarryCanvas.getContext('2d', { willReadFrequently: true })!;
  }
  if (smudgeCarryCanvas.width !== dim || smudgeCarryCanvas.height !== dim) {
    const temp = document.createElement('canvas');
    temp.width = smudgeCarryCanvas.width || dim;
    temp.height = smudgeCarryCanvas.height || dim;
    if (smudgeCarryCanvas.width > 0 && smudgeCarryCanvas.height > 0) {
      temp.getContext('2d')?.drawImage(smudgeCarryCanvas, 0, 0);
    }
    smudgeCarryCanvas.width = dim;
    smudgeCarryCanvas.height = dim;
    smudgeCarryCtx!.clearRect(0, 0, dim, dim);
    smudgeCarryCtx!.drawImage(temp, 0, 0, dim, dim);
  }
  return { canvas: smudgeCarryCanvas, ctx: smudgeCarryCtx! };
}

let secondaryDabBufferCanvas: HTMLCanvasElement | null = null;
let secondaryDabBufferCtx: CanvasRenderingContext2D | null = null;

function getSecondaryDabBuffer(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const dim = Math.max(8, Math.ceil(size));
  if (!secondaryDabBufferCanvas) {
    secondaryDabBufferCanvas = document.createElement('canvas');
    secondaryDabBufferCtx = secondaryDabBufferCanvas.getContext('2d')!;
  }
  if (secondaryDabBufferCanvas.width < dim || secondaryDabBufferCanvas.height < dim) {
    secondaryDabBufferCanvas.width = Math.max(dim, 256);
    secondaryDabBufferCanvas.height = Math.max(dim, 256);
  }
  return { canvas: secondaryDabBufferCanvas, ctx: secondaryDabBufferCtx! };
}

function applyDualBrushToDab(
  dCtx: CanvasRenderingContext2D,
  pad: number,
  halfPad: number,
  primaryRadius: number,
  dualBrush: DualBrushConfig,
  pressure: number
): void {
  if (!dualBrush?.enabled) return;
  const baseSize = dualBrush.size && dualBrush.size > 0 ? dualBrush.size / 2 : primaryRadius;
  const ratio = Math.max(0.1, Math.min(4.0, dualBrush.sizeRatio || 1.0));
  const secRadius = baseSize * ratio;
  const intensity = Math.max(0.05, Math.min(1.0, dualBrush.intensity ?? 0.8));
  const opacity = Math.max(0.05, Math.min(1.0, dualBrush.opacity ?? 1.0));
  const flow = Math.max(0.05, Math.min(1.0, dualBrush.flow ?? 1.0));
  const blendMode = dualBrush.blendMode || 'multiply';
  const rotationDeg = dualBrush.rotation || 0;
  const scatter = (dualBrush.scatter || 0) * 0.01;
  const stampShape = dualBrush.stampShape;
  const textureScale = (dualBrush.textureScale ?? 100) / 100;
  const textureDepth = Math.max(0.1, Math.min(1.0, dualBrush.textureDepth ?? 1.0));

  const { canvas: secCanvas, ctx: sCtx } = getSecondaryDabBuffer(pad);
  sCtx.clearRect(0, 0, pad, pad);
  sCtx.save();

  let offsetX = 0;
  let offsetY = 0;
  if (scatter > 0.01) {
    const sDist = (Math.random() - 0.5) * scatter * primaryRadius * 2;
    const sAng = Math.random() * Math.PI * 2;
    offsetX = Math.cos(sAng) * sDist;
    offsetY = Math.sin(sAng) * sDist;
  }

  sCtx.translate(halfPad + offsetX, halfPad + offsetY);
  sCtx.rotate((rotationDeg * Math.PI) / 180);
  if (textureScale !== 1.0) {
    sCtx.scale(textureScale, textureScale);
  }

  sCtx.fillStyle = '#ffffff';

  // 1. Predefined Stamp Option Engine
  if (stampShape === 'circle') {
    const grad = sCtx.createRadialGradient(0, 0, 0, 0, 0, secRadius);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    sCtx.fillStyle = grad;
    sCtx.beginPath();
    sCtx.arc(0, 0, secRadius, 0, Math.PI * 2);
    sCtx.fill();
  } else if (stampShape === 'square') {
    sCtx.fillRect(-secRadius, -secRadius, secRadius * 2, secRadius * 2);
  } else if (stampShape === 'grunge_splatter') {
    const drops = Math.max(16, Math.round(secRadius * 3.5));
    for (let d = 0; d < drops; d++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.pow(Math.random(), 0.55) * secRadius;
      const dropR = Math.max(0.6, Math.random() * secRadius * 0.22);
      sCtx.globalAlpha = (Math.random() * 0.8 + 0.2) * textureDepth;
      sCtx.beginPath();
      sCtx.arc(Math.cos(ang) * dist, Math.sin(ang) * dist, dropR, 0, Math.PI * 2);
      sCtx.fill();
    }
  } else if (stampShape === 'raked_bristles') {
    const bristles = Math.max(10, Math.round(secRadius * 1.6));
    sCtx.lineWidth = Math.max(1, secRadius * 0.1);
    sCtx.strokeStyle = '#ffffff';
    for (let b = 0; b < bristles; b++) {
      const bx = (b / bristles - 0.5) * secRadius * 1.9;
      sCtx.globalAlpha = (0.3 + Math.random() * 0.7) * textureDepth;
      sCtx.beginPath();
      sCtx.moveTo(bx, -secRadius);
      sCtx.lineTo(bx + (Math.random() - 0.5) * 3, secRadius);
      sCtx.stroke();
    }
  } else if (stampShape === 'noise_grain') {
    const count = Math.max(30, Math.round(secRadius * secRadius * 0.4));
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * secRadius;
      sCtx.globalAlpha = (Math.random() * 0.9 + 0.1) * textureDepth;
      sCtx.fillRect(Math.cos(ang) * dist, Math.sin(ang) * dist, 1.2, 1.2);
    }
  } else if (stampShape === 'charcoal_grit') {
    const flecks = Math.max(14, Math.round(secRadius * 2.8));
    for (let i = 0; i < flecks; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * secRadius;
      const rFleck = Math.max(0.7, (Math.random() * 0.3 + 0.1) * secRadius);
      sCtx.globalAlpha = (Math.random() * 0.85 + 0.15) * textureDepth;
      sCtx.beginPath();
      sCtx.arc(Math.cos(ang) * dist, Math.sin(ang) * dist, rFleck, 0, Math.PI * 2);
      sCtx.fill();
    }
  } else if (stampShape === 'stipple') {
    const rings = Math.max(3, Math.round(secRadius / 3));
    for (let ring = 1; ring <= rings; ring++) {
      const ringR = (ring / rings) * secRadius;
      const dotsOnRing = Math.round(ring * 5);
      for (let d = 0; d < dotsOnRing; d++) {
        const ang = (d / dotsOnRing) * Math.PI * 2 + Math.random() * 0.2;
        sCtx.globalAlpha = (Math.random() * 0.6 + 0.4) * textureDepth;
        sCtx.beginPath();
        sCtx.arc(Math.cos(ang) * ringR, Math.sin(ang) * ringR, 1.2, 0, Math.PI * 2);
        sCtx.fill();
      }
    }
  } else if (stampShape === 'canvas_weave') {
    const spacing = Math.max(3, secRadius * 0.28);
    sCtx.lineWidth = spacing * 0.45;
    sCtx.strokeStyle = '#ffffff';
    sCtx.globalAlpha = 0.75 * textureDepth;
    for (let gx = -secRadius; gx <= secRadius; gx += spacing) {
      sCtx.beginPath();
      sCtx.moveTo(gx, -secRadius);
      sCtx.lineTo(gx, secRadius);
      sCtx.stroke();
    }
    for (let gy = -secRadius; gy <= secRadius; gy += spacing) {
      sCtx.beginPath();
      sCtx.moveTo(-secRadius, gy);
      sCtx.lineTo(secRadius, gy);
      sCtx.stroke();
    }
  } else {
    // 2. Fallback Texture library
    const secTexture: string = String(dualBrush.texture || 'soft_round');
    if (secTexture === 'hard_round') {
      sCtx.beginPath();
      sCtx.arc(0, 0, secRadius, 0, Math.PI * 2);
      sCtx.fill();
    } else if (secTexture === 'soft_round') {
      const grad = sCtx.createRadialGradient(0, 0, 0, 0, 0, secRadius);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.7)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      sCtx.fillStyle = grad;
      sCtx.beginPath();
      sCtx.arc(0, 0, secRadius, 0, Math.PI * 2);
      sCtx.fill();
    } else if (secTexture === 'charcoal' || secTexture === 'chalk') {
      const count = Math.max(12, Math.round(secRadius * 2.5));
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = Math.sqrt(Math.random()) * secRadius;
        const dotR = Math.max(0.8, (Math.random() * 0.25 + 0.1) * secRadius);
        sCtx.globalAlpha = Math.random() * 0.8 + 0.2;
        sCtx.beginPath();
        sCtx.arc(Math.cos(ang) * dist, Math.sin(ang) * dist, dotR, 0, Math.PI * 2);
        sCtx.fill();
      }
    } else if (
      secTexture === 'oil_bristles' ||
      secTexture === 'dry_bristle' ||
      secTexture === 'flat_bristle'
    ) {
      const bristles = Math.max(8, Math.round(secRadius * 1.4));
      sCtx.lineWidth = Math.max(1, secRadius * 0.12);
      sCtx.strokeStyle = '#ffffff';
      for (let b = 0; b < bristles; b++) {
        const bx = (b / bristles - 0.5) * secRadius * 1.8;
        sCtx.globalAlpha = 0.35 + Math.random() * 0.65;
        sCtx.beginPath();
        sCtx.moveTo(bx, -secRadius * 0.9);
        sCtx.lineTo(bx + (Math.random() - 0.5) * 4, secRadius * 0.9);
        sCtx.stroke();
      }
    } else if (secTexture === 'spatter') {
      const drops = Math.max(15, Math.round(secRadius * 3));
      for (let d = 0; d < drops; d++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = Math.pow(Math.random(), 0.6) * secRadius;
        const dropR = Math.max(0.6, Math.random() * secRadius * 0.18);
        sCtx.globalAlpha = Math.random() * 0.9 + 0.1;
        sCtx.beginPath();
        sCtx.arc(Math.cos(ang) * dist, Math.sin(ang) * dist, dropR, 0, Math.PI * 2);
        sCtx.fill();
      }
    } else if (secTexture === 'halftone_dots') {
      const gridStep = Math.max(4, secRadius * 0.35);
      const dotR = gridStep * 0.35;
      for (let gx = -secRadius; gx <= secRadius; gx += gridStep) {
        for (let gy = -secRadius; gy <= secRadius; gy += gridStep) {
          if (gx * gx + gy * gy <= secRadius * secRadius) {
            sCtx.beginPath();
            sCtx.arc(gx, gy, dotR, 0, Math.PI * 2);
            sCtx.fill();
          }
        }
      }
    } else {
      const grad = sCtx.createRadialGradient(0, 0, 0, 0, 0, secRadius);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      sCtx.fillStyle = grad;
      sCtx.beginPath();
      sCtx.arc(0, 0, secRadius, 0, Math.PI * 2);
      sCtx.fill();
    }
  }
  sCtx.restore();

  // Composite secondary tip into dCtx with calibrated opacity and flow
  dCtx.save();
  const compositeAlpha = Math.max(0.01, Math.min(1.0, intensity * opacity * flow));
  dCtx.globalAlpha = compositeAlpha;
  if (blendMode === 'mask') {
    dCtx.globalCompositeOperation = 'destination-in';
  } else if (blendMode === 'subtract') {
    dCtx.globalCompositeOperation = 'destination-out';
  } else if (blendMode === 'multiply') {
    dCtx.globalCompositeOperation = 'multiply';
  } else if (blendMode === 'darken') {
    dCtx.globalCompositeOperation = 'darken';
  } else if (blendMode === 'overlay') {
    dCtx.globalCompositeOperation = 'overlay';
  } else {
    dCtx.globalCompositeOperation = 'destination-in';
  }
  dCtx.drawImage(secCanvas, 0, 0);
  dCtx.restore();
}

export const kritaHardwareTiltState = {
  hasDetectedPenTilt: false,
  lastTiltX: 0,
  lastTiltY: 0,
  lastAzimuthDeg: 0,
  lastAltitudeRatio: 1.0,
};

export function updateHardwareTiltTelemetry(e: {
  pointerType?: string;
  tiltX?: number;
  tiltY?: number;
}): boolean {
  const tx = e.tiltX ?? 0;
  const ty = e.tiltY ?? 0;
  if (e.pointerType === 'pen' && (Math.abs(tx) > 0.5 || Math.abs(ty) > 0.5)) {
    kritaHardwareTiltState.hasDetectedPenTilt = true;
    kritaHardwareTiltState.lastTiltX = tx;
    kritaHardwareTiltState.lastTiltY = ty;
    const rad = Math.atan2(ty, tx);
    kritaHardwareTiltState.lastAzimuthDeg = Math.round(((rad * 180) / Math.PI + 360) % 360);
    const mag = Math.min(90, Math.hypot(tx, ty));
    kritaHardwareTiltState.lastAltitudeRatio = Math.max(0.08, 1 - mag / 90);
    return true;
  }
  return kritaHardwareTiltState.hasDetectedPenTilt;
}

/**
 * Fixed StreamlineStabilizer
 * Prevents the (0,0) top-left corner ray bug when CanvasWorkspace calls reset() or process().
 */
export class StreamlineStabilizer {
  private factor: number = 0.2;
  private lastPoint: StrokePoint | null = null;

  constructor(factor: number = 0.2) {
    this.setFactor(factor);
  }

  public setFactor(factor: number) {
    const num = Number(factor);
    this.factor = Number.isFinite(num) ? Math.max(0, Math.min(0.95, num)) : 0.2;
  }

  public reset(initialPtOrX?: StrokePoint | number, y?: number): StrokePoint | null {
    if (typeof initialPtOrX === 'number') {
      const safe: StrokePoint = {
        x: initialPtOrX,
        y: y ?? 0,
        pressure: 0.65,
        tiltX: 0,
        tiltY: 0,
        time: Date.now(),
      };
      this.lastPoint = safe;
      return safe;
    }
    if (
      initialPtOrX &&
      Number.isFinite(initialPtOrX.x) &&
      Number.isFinite(initialPtOrX.y)
    ) {
      const safe: StrokePoint = {
        x: initialPtOrX.x,
        y: initialPtOrX.y,
        pressure:
          Number.isFinite(initialPtOrX.pressure) && initialPtOrX.pressure > 0
            ? initialPtOrX.pressure
            : 0.65,
        tiltX: Number.isFinite(initialPtOrX.tiltX) ? initialPtOrX.tiltX : 0,
        tiltY: Number.isFinite(initialPtOrX.tiltY) ? initialPtOrX.tiltY : 0,
        time: Number.isFinite(initialPtOrX.time) ? initialPtOrX.time : Date.now(),
      };
      this.lastPoint = safe;
      return safe;
    }
    this.lastPoint = null;
    return null;
  }

  public process(ptOrX: StrokePoint | number, y?: number, pressure?: number): StrokePoint {
    let safePt: StrokePoint;
    if (typeof ptOrX === 'number') {
      safePt = {
        x: ptOrX,
        y: y ?? 0,
        pressure: Number.isFinite(pressure) && (pressure ?? 0) > 0 ? (pressure as number) : 0.65,
        tiltX: 0,
        tiltY: 0,
        time: Date.now(),
      };
    } else if (ptOrX && Number.isFinite(ptOrX.x) && Number.isFinite(ptOrX.y)) {
      safePt = {
        x: ptOrX.x,
        y: ptOrX.y,
        pressure: Number.isFinite(ptOrX.pressure) && ptOrX.pressure > 0 ? ptOrX.pressure : 0.65,
        tiltX: Number.isFinite(ptOrX.tiltX) ? ptOrX.tiltX : 0,
        tiltY: Number.isFinite(ptOrX.tiltY) ? ptOrX.tiltY : 0,
        time: Number.isFinite(ptOrX.time) ? ptOrX.time : Date.now(),
      };
    } else {
      return this.lastPoint || { x: 0, y: 0, pressure: 0.65, time: Date.now() };
    }

    // If lastPoint was null or accidentally at (0,0) from an uninitialized state, snap immediately to safePt!
    if (
      !this.lastPoint ||
      this.factor <= 0.01 ||
      (this.lastPoint.x === 0 && this.lastPoint.y === 0 && Math.hypot(safePt.x, safePt.y) > 25)
    ) {
      this.lastPoint = { ...safePt };
      return safePt;
    }

    const alpha = Math.max(0.2, Math.min(1.0, 1 - this.factor * 0.75));
    const smoothed: StrokePoint = {
      x: this.lastPoint.x + (safePt.x - this.lastPoint.x) * alpha,
      y: this.lastPoint.y + (safePt.y - this.lastPoint.y) * alpha,
      pressure:
        this.lastPoint.pressure +
        (safePt.pressure - this.lastPoint.pressure) * Math.max(0.35, alpha),
      tiltX:
        (this.lastPoint.tiltX ?? 0) +
        ((safePt.tiltX ?? 0) - (this.lastPoint.tiltX ?? 0)) * alpha,
      tiltY:
        (this.lastPoint.tiltY ?? 0) +
        ((safePt.tiltY ?? 0) - (this.lastPoint.tiltY ?? 0)) * alpha,
      time: safePt.time,
    };
    this.lastPoint = smoothed;
    return smoothed;
  }

  public addPoint(ptOrX: StrokePoint | number, y?: number, pressure?: number): StrokePoint {
    return this.process(ptOrX, y, pressure);
  }

  public update(ptOrX: StrokePoint | number, y?: number, pressure?: number): StrokePoint {
    return this.process(ptOrX, y, pressure);
  }

  public filter(ptOrX: StrokePoint | number, y?: number, pressure?: number): StrokePoint {
    return this.process(ptOrX, y, pressure);
  }

  public getLastPoint(): StrokePoint | null {
    return this.lastPoint;
  }
}

export function evaluateKritaSensorCurve(
  curve: { x: number; y: number }[] | undefined,
  input: number
): number {
  if (!curve || curve.length === 0) return input;
  if (curve.length === 1) return curve[0].y;

  const sorted = [...curve].sort((a, b) => a.x - b.x);
  const x = Math.max(0, Math.min(1, input));
  if (x <= sorted[0].x) return sorted[0].y;
  if (x >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].y;

  for (let i = 0; i < sorted.length - 1; i++) {
    const p0 = sorted[i];
    const p1 = sorted[i + 1];
    if (x >= p0.x && x <= p1.x) {
      const span = Math.max(0.00001, p1.x - p0.x);
      const t = (x - p0.x) / span;
      const smoothT = t * t * (3 - 2 * t);
      return p0.y + (p1.y - p0.y) * smoothT;
    }
  }
  return sorted[sorted.length - 1].y;
}

export function resolveKritaBrushParams(brush: any) {
  const rawAngle =
    brush?.shape?.rotation ?? brush?.shape?.angle ?? brush?.angle ?? 0;
  const angleDeg = ((Number(rawAngle) || 0) % 360 + 360) % 360;

  const rawRoundness =
    brush?.shape?.roundness ?? brush?.roundness ?? 1.0;
  const roundnessRatio =
    rawRoundness > 1.05
      ? Math.max(0.05, Math.min(1.0, rawRoundness / 100))
      : Math.max(0.05, Math.min(1.0, Number(rawRoundness) || 1.0));

  const hardness = Math.max(
    0.02,
    Math.min(1.0, Number(brush?.taper?.tipSharpness ?? brush?.hardness ?? 0.9))
  );

  const rawSpacing =
    brush?.strokePath?.spacing ?? brush?.spacing ?? 0.06;
  const spacing = Math.max(0.015, Math.min(1.2, Number(rawSpacing) || 0.06));

  const shapeTexture: string =
    brush?.shape?.texture ?? brush?.texture ?? 'hard_round';
  const shapeTextureUrl: string | undefined =
    brush?.shapeTextureUrl ?? brush?.shape?.shapeTextureUrl;
  const shapeTextureUrls: string[] | undefined =
    brush?.shapeTextureUrls ?? brush?.shape?.shapeTextureUrls;

  if (shapeTextureUrl) preloadKritaTexture(shapeTextureUrl);
  if (shapeTextureUrls && Array.isArray(shapeTextureUrls)) {
    shapeTextureUrls.forEach((u) => preloadKritaTexture(u));
  }

  const followStroke = Boolean(
    brush?.shape?.followStroke ?? brush?.followStroke ?? false
  );
  const penTiltEnabled = Boolean(
    brush?.shape?.penTiltControl ??
      brush?.penControls?.tiltToAngle ??
      (brush?.tiltAngleInfluence && brush.tiltAngleInfluence > 0)
  );

  const scatterAngle = Number(brush?.shape?.scatter ?? brush?.scatter ?? 0);
  const jitterLateral = Number(
    brush?.strokePath?.jitter ?? brush?.jitterLateral ?? brush?.jitter ?? 0
  );
  const jitterLinear = Number(brush?.jitterLinear ?? 0);

  const pressureSizeFactor =
    brush?.pressureSize === false
      ? 0
      : Number(
          brush?.penControls?.pressureToSize ??
            brush?.pressureSizeFactor ??
            0.75
        );
  const pressureOpacityFactor =
    brush?.pressureOpacity === true
      ? Number(
          brush?.penControls?.pressureToOpacity ??
            brush?.pressureOpacityFactor ??
            0.8
        )
      : Number(brush?.pressureOpacityFactor ?? 0);

  const dilution = Number(
    brush?.wetMix?.dilution ?? brush?.wetMixDilution ?? 0
  );
  const smudgePull = Number(
    brush?.wetMix?.pull ??
      brush?.smudgePull ??
      brush?.properties?.smudgePull ??
      0
  );
  const smudgeLength = Number(
    brush?.smudgeLength ??
      (brush?.wetMix ? 1 - (brush.wetMix.dilution || 0) * 0.6 : 0.75)
  );

  const hueJitter = Number(
    brush?.colorDynamics?.stampHueJitter ?? brush?.hueJitter ?? 0
  );
  const satJitter = Number(
    brush?.colorDynamics?.stampSatJitter ?? brush?.saturationJitter ?? 0
  );
  const lightJitter = Number(
    brush?.colorDynamics?.stampLightJitter ?? brush?.brightnessJitter ?? 0
  );
  const darkenAmount = Number(brush?.darkenAmount ?? 0);

  const renderingMode = brush?.rendering?.mode ?? 'heavy_glaze';
  const baseFlow = Number(brush?.rendering?.flow ?? brush?.baseOpacity ?? 1.0);

  const grainDepth = Number(brush?.grain?.depth ?? brush?.grainDepth ?? 0);
  const grainTextureUrl: string | undefined = brush?.grainTextureUrl || (brush as any)?.patternUrl;
  const kritaPatternId: string =
    brush?.kritaPatternId ?? brush?.grain?.texture ?? 'none';

  const patternEnabled = Boolean(
    (brush as any)?.patternEnabled ??
      (brush as any)?.pattern?.enabled ??
      (grainDepth > 0.02 && (kritaPatternId !== 'none' || grainTextureUrl))
  );
  const patternStrength = Number(
    (brush as any)?.patternStrength ??
      (brush as any)?.pattern?.strength ??
      grainDepth ??
      1.0
  );
  const patternScale = Number(
    (brush as any)?.patternScale ??
      (brush as any)?.pattern?.scale ??
      brush?.grain?.scale ??
      1.0
  );
  const patternTexturingMode: 'multiply' | 'subtract' =
    (brush as any)?.patternTexturingMode === 'subtract' ||
    brush?.grain?.blendMode === 'subtract'
      ? 'subtract'
      : 'multiply';

  const patternCutoff = Number(
    (brush as any)?.patternCutoff ?? brush?.grain?.cutoff ?? 0
  );
  const patternInvert = Boolean(
    (brush as any)?.patternInvert ?? brush?.grain?.invert ?? false
  );
  const patternContrast = Number(
    (brush as any)?.patternContrast ?? brush?.grain?.contrast ?? 1.0
  );
  const patternBrightness = Number(
    (brush as any)?.patternBrightness ?? brush?.grain?.brightness ?? 0
  );
  const patternOffsetX = Number(
    (brush as any)?.patternOffsetX ?? brush?.grain?.offsetX ?? 0
  );
  const patternOffsetY = Number(
    (brush as any)?.patternOffsetY ?? brush?.grain?.offsetY ?? 0
  );
  const patternStrengthPressure = Boolean(
    (brush as any)?.patternStrengthPressure ?? brush?.grain?.strengthPressure ?? false
  );

  const angleOffset = Number(
    (brush?.shape as any)?.angleOffset ?? (brush as any)?.angleOffset ?? 0
  );

  if (grainTextureUrl) preloadKritaTexture(grainTextureUrl);

  const kritaEngine: string =
    brush?.kritaEngine ?? brush?.engine ?? 'pixel';
  const spikesCount = Number(brush?.spikes ?? 2);
  const density = Number(brush?.density ?? 1.0);
  const randomness = Number(brush?.randomness ?? 0);

  const isKritaPreset =
    (brush as any)?.sourceFormat === 'kpp' ||
    kritaEngine !== 'pixel' ||
    (brush?.name || '').toLowerCase().startsWith('rk') ||
    (brush?.name || '').toLowerCase().includes('krita') ||
    Boolean(shapeTextureUrl) ||
    Boolean(shapeTextureUrls && shapeTextureUrls.length > 0);

  return {
    name: (brush?.name || '').toLowerCase(),
    kritaEngine,
    isKritaPreset,
    angleDeg,
    angleOffset,
    roundnessRatio,
    hardness,
    spacing,
    shapeTexture,
    shapeTextureUrl,
    shapeTextureUrls,
    followStroke,
    penTiltEnabled,
    scatterAngle,
    jitterLateral,
    jitterLinear,
    pressureSizeFactor,
    pressureOpacityFactor,
    sizeByPressureCurve: brush?.sizeByPressure as { x: number; y: number }[] | undefined,
    opacityByPressureCurve: brush?.opacityByPressure as { x: number; y: number }[] | undefined,
    scatterByPressureCurve: brush?.scatterByPressure as { x: number; y: number }[] | undefined,
    dilution,
    smudgePull,
    smudgeLength,
    hueJitter,
    satJitter,
    lightJitter,
    darkenAmount,
    renderingMode,
    baseFlow,
    grainDepth,
    grainTextureUrl,
    kritaPatternId,
    patternEnabled,
    patternStrength,
    patternScale,
    patternTexturingMode,
    patternCutoff,
    patternInvert,
    patternContrast,
    patternBrightness,
    patternOffsetX,
    patternOffsetY,
    patternStrengthPressure,
    spikesCount,
    density,
    randomness,
    sensors: brush?.sensors,
    shareCurveAcrossSettings: brush?.shareCurveAcrossSettings,
    blendMode: (brush?.rendering?.blendMode || (brush as any)?.blendMode || 'source-over') as string,
    dualBrush: brush?.dualBrush,
  };
}

function applyKritaColorDynamics(
  hexColor: string,
  hueJitter: number,
  satJitter: number,
  lightJitter: number,
  darkenAmount: number = 0,
  pressure: number = 1.0
): string {
  if (
    Math.abs(hueJitter) < 0.005 &&
    Math.abs(satJitter) < 0.005 &&
    Math.abs(lightJitter) < 0.005 &&
    Math.abs(darkenAmount) < 0.005
  ) {
    return hexColor;
  }
  const clean = (hexColor || '#000000').replace('#', '');
  const num =
    parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16) || 0;
  let r = ((num >> 16) & 255) / 255;
  let g = ((num >> 8) & 255) / 255;
  let b = (num & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  h = (h + (Math.random() - 0.5) * hueJitter * 0.5 + 1) % 1;
  s = Math.max(0, Math.min(1, s + (Math.random() - 0.5) * satJitter));
  l = Math.max(
    0,
    Math.min(
      1,
      l + (Math.random() - 0.5) * lightJitter - darkenAmount * pressure * 0.45
    )
  );

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function stampKritaDab(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  roundnessRatio: number,
  angleRad: number,
  color: string,
  alpha: number,
  hardness: number,
  shapeTexture: string,
  brushNameLower: string,
  shapeTextureUrl?: string,
  shapeTextureUrls?: string[],
  grainTextureUrl?: string,
  kritaPatternId: string = 'none',
  grainDepth: number = 0,
  spikesCount: number = 2,
  density: number = 1.0,
  isEraser: boolean = false,
  blendMode: string = 'source-over',
  patternEnabled: boolean = false,
  patternStrength: number = 1.0,
  patternScale: number = 1.0,
  patternTexturingMode: 'multiply' | 'subtract' = 'multiply',
  isKritaPreset: boolean = false,
  patternCutoff: number = 0,
  patternInvert: boolean = false,
  patternContrast: number = 1.0,
  patternBrightness: number = 0,
  patternOffsetX: number = 0,
  patternOffsetY: number = 0,
  pressure: number = 1.0,
  patternStrengthPressure: boolean = false,
  dualBrush?: DualBrushConfig
) {
  if (radius < 0.25 || alpha <= 0.001 || !Number.isFinite(x) || !Number.isFinite(y)) return;

  let activeTipUrl = shapeTextureUrl;
  if (shapeTextureUrls && shapeTextureUrls.length > 0) {
    activeTipUrl = shapeTextureUrls[gihPipeIndex % shapeTextureUrls.length];
    gihPipeIndex = (gihPipeIndex + 1) % shapeTextureUrls.length;
  }

  const customTipImg = activeTipUrl ? preloadKritaTexture(activeTipUrl) : null;
  const hasPredefinedTip = Boolean(
    customTipImg || activeTipUrl || (shapeTextureUrls && shapeTextureUrls.length > 0)
  );
  const effectiveIsKrita = isKritaPreset || hasPredefinedTip;

  const effectivePatternEnabled =
    patternEnabled || (grainDepth > 0.01 && (kritaPatternId !== 'none' || Boolean(grainTextureUrl)));
  const customGrainImg =
    effectivePatternEnabled && grainTextureUrl
      ? preloadKritaTexture(grainTextureUrl)
      : null;
  const builtinPatternCanvas =
    effectivePatternEnabled && kritaPatternId && kritaPatternId !== 'none'
      ? getKritaPatternCanvas(kritaPatternId)
      : null;

  const diameter = Math.max(4, Math.ceil(radius * 2));
  const pad = Math.ceil(diameter * 1.55) + 6;
  const halfPad = pad / 2;

  const { canvas: dabCanvas, ctx: dCtx } = getDabBuffer(pad);
  dCtx.clearRect(0, 0, pad, pad);
  dCtx.save();
  dCtx.translate(halfPad, halfPad);
  dCtx.rotate(angleRad);
  dCtx.scale(1.0, Math.max(0.05, roundnessRatio));

  const isPencil =
    brushNameLower.includes('pencil') ||
    brushNameLower.startsWith('pencil_') ||
    shapeTexture === 'pencil_grain' ||
    brushNameLower.includes('awe sips') ||
    brushNameLower.includes('borrowed') ||
    brushNameLower.includes('cheap receipt') ||
    brushNameLower.includes('cobble skate') ||
    brushNameLower.includes('coin sedge') ||
    brushNameLower.includes('cuff starch') ||
    brushNameLower.includes('daily fate') ||
    brushNameLower.includes('fax pancake') ||
    brushNameLower.includes('go cart') ||
    brushNameLower.includes('humble bug') ||
    brushNameLower.includes('lead steady') ||
    brushNameLower.includes('maybe sews') ||
    brushNameLower.includes('mech midi') ||
    brushNameLower.includes('mech mini') ||
    brushNameLower.includes('sleepy keen');

  if (customTipImg) {
    const imgW = customTipImg.naturalWidth || diameter;
    const imgH = customTipImg.naturalHeight || diameter;
    const maxDim = Math.max(1, imgW, imgH);
    const drawW = (imgW / maxDim) * diameter;
    const drawH = (imgH / maxDim) * diameter;
    dCtx.drawImage(customTipImg, -drawW / 2, -drawH / 2, drawW, drawH);
  } else if (isPencil) {
    if (brushNameLower.includes('fax pancake') || shapeTexture === 'chisel_marker') {
      // Broad Carpenter Chisel Tip
      dCtx.fillStyle = '#ffffff';
      const wedgeW = radius * 2;
      const wedgeH = Math.max(2, radius * 2 * Math.max(0.12, roundnessRatio));
      dCtx.beginPath();
      if (typeof dCtx.roundRect === 'function') {
        dCtx.roundRect(-wedgeW / 2, -wedgeH / 2, wedgeW, wedgeH, Math.min(2, wedgeH / 2));
      } else {
        dCtx.rect(-wedgeW / 2, -wedgeH / 2, wedgeW, wedgeH);
      }
      dCtx.fill();
    } else if (brushNameLower.includes('cuff starch')) {
      // Chalky Flat Dry Wedge with striated tooth skips
      dCtx.fillStyle = '#ffffff';
      const wedgeW = radius * 2;
      const wedgeH = Math.max(2.5, radius * 2 * Math.max(0.2, roundnessRatio));
      for (let st = -1; st <= 1; st++) {
        dCtx.beginPath();
        dCtx.ellipse(0, st * (wedgeH * 0.28), wedgeW / 2, wedgeH * 0.2, 0, 0, Math.PI * 2);
        dCtx.fill();
      }
    } else if (brushNameLower.includes('cobble skate')) {
      // Pebble Stipple Dot Cluster
      dCtx.fillStyle = '#ffffff';
      const dots = Math.max(16, Math.min(40, Math.round(radius * 1.8)));
      for (let dt = 0; dt < dots; dt++) {
        const a = dt * 2.39996 + (x + y) * 0.08;
        const rDist = Math.sqrt((dt + 0.5) / dots) * radius;
        const dotX = Math.cos(a) * rDist;
        const dotY = Math.sin(a) * rDist;
        const dotR = Math.max(0.65, radius * 0.18 * (1 - (rDist / radius) * 0.35));
        dCtx.beginPath();
        dCtx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
        dCtx.fill();
      }
    } else if (brushNameLower.includes('cheap receipt') || brushNameLower.includes('go cart')) {
      // Gritty Jagged Carbon Edge Tip
      dCtx.fillStyle = '#ffffff';
      dCtx.beginPath();
      const ptsCount = 14;
      for (let ptIdx = 0; ptIdx < ptsCount; ptIdx++) {
        const a = (ptIdx / ptsCount) * Math.PI * 2;
        const jitterR = radius * (0.8 + (Math.sin(ptIdx * 7.1 + (x + y) * 0.05) * 0.5 + 0.5) * 0.28);
        const px = Math.cos(a) * jitterR;
        const py = Math.sin(a) * jitterR;
        if (ptIdx === 0) dCtx.moveTo(px, py);
        else dCtx.lineTo(px, py);
      }
      dCtx.closePath();
      dCtx.fill();
    } else {
      // Realistic Dense Graphite Core with Feathered Powder Boundary
      const innerR = radius * Math.max(0.18, hardness * 0.55);
      const grad = dCtx.createRadialGradient(0, 0, innerR, 0, 0, radius);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.72, 'rgba(255,255,255,0.92)');
      grad.addColorStop(0.9, 'rgba(255,255,255,0.45)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      dCtx.fillStyle = grad;
      dCtx.beginPath();
      dCtx.arc(0, 0, radius, 0, Math.PI * 2);
      dCtx.fill();
    }
  } else if (!effectiveIsKrita && spikesCount > 2) {
    dCtx.fillStyle = '#ffffff';
    dCtx.beginPath();
    const innerR = radius * Math.max(0.18, hardness * 0.45);
    for (let s = 0; s < spikesCount * 2; s++) {
      const r = s % 2 === 0 ? radius : innerR;
      const a = (s * Math.PI) / spikesCount;
      const sx = Math.cos(a) * r;
      const sy = Math.sin(a) * r;
      if (s === 0) dCtx.moveTo(sx, sy);
      else dCtx.lineTo(sx, sy);
    }
    dCtx.closePath();
    dCtx.fill();
  } else if (
    !effectiveIsKrita &&
    !hasPredefinedTip &&
    !effectivePatternEnabled &&
    (shapeTexture === 'flat_bristle' ||
      shapeTexture === 'dry_bristle' ||
      brushNameLower.includes('rake') ||
      brushNameLower.includes('bristle') ||
      brushNameLower.includes('fur') ||
      brushNameLower.includes('herbals'))
  ) {
    dCtx.fillStyle = '#ffffff';
    const bristleCount = Math.max(6, Math.min(22, Math.round(radius * 1.25)));
    for (let b = 0; b < bristleCount; b++) {
      const norm = (b / (bristleCount - 1)) * 2 - 1;
      const bx = norm * radius * 0.92;
      const by = Math.sin(b * 3.1) * radius * 0.22;
      const br = Math.max(0.7, (radius / bristleCount) * 1.2 * (1 - Math.abs(norm) * 0.2));
      dCtx.beginPath();
      dCtx.arc(bx, by, br, 0, Math.PI * 2);
      dCtx.fill();
    }
  } else if (
    !effectiveIsKrita &&
    !hasPredefinedTip &&
    !effectivePatternEnabled &&
    (brushNameLower.includes('spott') ||
      brushNameLower.includes('spatter') ||
      brushNameLower.includes('spray') ||
      brushNameLower.includes('dirty') ||
      brushNameLower.includes('frost') ||
      density < 0.92)
  ) {
    dCtx.fillStyle = '#ffffff';
    const dots = Math.max(8, Math.min(32, Math.round(radius * 1.4 * density)));
    for (let d = 0; d < dots; d++) {
      const a = d * 2.39996 + (x + y) * 0.13;
      const rDist = Math.sqrt((d + 0.5) / dots) * radius;
      const dx = Math.cos(a) * rDist;
      const dy = Math.sin(a) * rDist;
      const dr = Math.max(0.7, radius * 0.18 * (1 - (rDist / radius) * 0.45));
      dCtx.beginPath();
      dCtx.arc(dx, dy, dr, 0, Math.PI * 2);
      dCtx.fill();
    }
  } else if (
    !effectiveIsKrita &&
    !hasPredefinedTip &&
    !effectivePatternEnabled &&
    (brushNameLower.includes('grass') ||
      brushNameLower.includes('branch') ||
      brushNameLower.includes('foliage') ||
      brushNameLower.includes('leaf'))
  ) {
    dCtx.fillStyle = '#ffffff';
    for (let blade = -1; blade <= 1; blade++) {
      dCtx.save();
      dCtx.rotate(blade * 0.22);
      dCtx.beginPath();
      dCtx.moveTo(0, -radius * 1.35);
      dCtx.quadraticCurveTo(radius * 0.22, 0, radius * 0.12, radius * 0.9);
      dCtx.lineTo(-radius * 0.12, radius * 0.9);
      dCtx.quadraticCurveTo(-radius * 0.22, 0, 0, -radius * 1.35);
      dCtx.closePath();
      dCtx.fill();
      dCtx.restore();
    }
  } else if (
    !effectiveIsKrita &&
    !hasPredefinedTip &&
    (shapeTexture === 'hard_square' ||
      shapeTexture === 'chisel_marker' ||
      shapeTexture === 'calligraphy_nib' ||
      brushNameLower.includes('square') ||
      brushNameLower.includes('chisel') ||
      brushNameLower.includes('concept'))
  ) {
    dCtx.fillStyle = '#ffffff';
    const rCorner = Math.max(0.5, radius * (1 - hardness) * 0.5);
    dCtx.beginPath();
    if (typeof dCtx.roundRect === 'function') {
      dCtx.roundRect(-radius, -radius, radius * 2, radius * 2, rCorner);
    } else {
      dCtx.rect(-radius, -radius, radius * 2, radius * 2);
    }
    dCtx.fill();
  } else if (
    !effectiveIsKrita &&
    !hasPredefinedTip &&
    (shapeTexture === 'hard_triangle' ||
      brushNameLower.includes('pointy') ||
      brushNameLower.includes('triangle'))
  ) {
    dCtx.fillStyle = '#ffffff';
    dCtx.beginPath();
    dCtx.moveTo(0, -radius);
    dCtx.lineTo(radius * 0.9, radius * 0.85);
    dCtx.lineTo(-radius * 0.9, radius * 0.85);
    dCtx.closePath();
    dCtx.fill();
  } else {
    const isAirbrush =
      shapeTexture === 'soft_airbrush' ||
      brushNameLower.includes('airbrush') ||
      brushNameLower.includes('supersoft') ||
      brushNameLower.includes('soft') ||
      brushNameLower.includes('blur');

    if (hardness >= 0.94 && !isAirbrush) {
      dCtx.fillStyle = '#ffffff';
      dCtx.beginPath();
      dCtx.arc(0, 0, radius, 0, Math.PI * 2);
      dCtx.fill();
    } else {
      const effectiveHardness = isAirbrush ? Math.min(hardness, 0.1) : hardness;
      const innerR = radius * Math.max(0, effectiveHardness * 0.72);
      const grad = dCtx.createRadialGradient(0, 0, innerR, 0, 0, radius);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(
        Math.min(0.92, 0.25 + effectiveHardness * 0.55),
        'rgba(255,255,255,0.85)'
      );
      grad.addColorStop(1, 'rgba(255,255,255,0)');

      dCtx.fillStyle = grad;
      dCtx.beginPath();
      dCtx.arc(0, 0, radius, 0, Math.PI * 2);
      dCtx.fill();
    }
  }
  dCtx.restore();

  // Krita / Procreate pattern texturing & paper tooth application
  const patternSource = customGrainImg || builtinPatternCanvas;
  if (patternSource && effectivePatternEnabled) {
    const patData = getPatternImageData(patternSource);
    if (patData && patData.width > 0 && patData.height > 0) {
      const dabImgData = dCtx.getImageData(0, 0, pad, pad);
      const d = dabImgData.data;
      const pw = patData.width;
      const ph = patData.height;
      const pData = patData.data;
      let effectiveStrength = Math.max(0, Math.min(1.0, patternStrength));
      if (patternStrengthPressure) {
        effectiveStrength *= Math.max(0.2, Math.min(1.0, 0.3 + 0.7 * pressure));
      }
      const scale = Math.max(0.05, patternScale || 1.0);
      const mode = patternTexturingMode || 'multiply';

      const dabOriginX = x - halfPad + (patternOffsetX || 0) * pw * scale;
      const dabOriginY = y - halfPad + (patternOffsetY || 0) * ph * scale;

      for (let py = 0; py < pad; py++) {
        const cy = dabOriginY + py;
        const patY = Math.floor(((cy / scale) % ph + ph) % ph);
        const patRowOffset = patY * pw;

        for (let px = 0; px < pad; px++) {
          const dIdx = (py * pad + px) * 4 + 3;
          const origA = d[dIdx];
          if (origA === 0) continue;

          const cx = dabOriginX + px;
          const patX = Math.floor(((cx / scale) % pw + pw) % pw);
          const pIdx = (patRowOffset + patX) * 4;
          let patVal =
            (pData[pIdx] * 0.299 + pData[pIdx + 1] * 0.587 + pData[pIdx + 2] * 0.114) / 255;

          if (patternInvert) patVal = 1 - patVal;
          if (patternBrightness !== 0) patVal = Math.max(0, Math.min(1, patVal + patternBrightness));
          if (patternContrast !== 1.0) {
            patVal = Math.max(0, Math.min(1, (patVal - 0.5) * patternContrast + 0.5));
          }

          if (patternCutoff > 0 && patVal < patternCutoff) {
            d[dIdx] = 0;
          } else {
            const adjustedVal = patternCutoff > 0 ? (patVal - patternCutoff) / Math.max(0.01, 1 - patternCutoff) : patVal;
            if (mode === 'subtract') {
              const sub = (1 - adjustedVal) * effectiveStrength * 255;
              d[dIdx] = Math.max(0, Math.round(origA - sub));
            } else {
              // Multiply mode
              const factor = adjustedVal * effectiveStrength + (1 - effectiveStrength);
              d[dIdx] = Math.max(0, Math.min(255, Math.round(origA * factor)));
            }
          }
        }
      }
      dCtx.putImageData(dabImgData, 0, 0);
    }
  }

  // Dual Brush Secondary Tip Engine (Mask / Subtract / Multiply / Overlay / Darken)
  if (dualBrush?.enabled) {
    applyDualBrushToDab(dCtx, pad, halfPad, radius, dualBrush, pressure);
  }

  if (!isEraser) {
    dCtx.save();
    dCtx.globalCompositeOperation = 'source-in';
    dCtx.fillStyle = color;
    dCtx.fillRect(0, 0, pad, pad);
    dCtx.restore();
  }

  const isErase = isEraser || blendMode === 'erase' || blendMode === 'destination-out';
  ctx.save();
  ctx.globalCompositeOperation = isErase ? 'destination-out' : getCanvasCompositeOperation(blendMode);
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.drawImage(dabCanvas, 0, 0, pad, pad, x - halfPad, y - halfPad, pad, pad);
  ctx.restore();
}

export function renderStrokeSegment(
  ctx: CanvasRenderingContext2D,
  p1: StrokePoint,
  p2: StrokePoint,
  brush: Brush,
  color: string,
  size: number,
  opacity: number,
  isEraser: boolean = false
): void {
  if (!ctx || !p1 || !p2) return;

  // Guard against (0,0) uninitialized start point causing rays from top-left corner!
  if (
    p1.x === 0 &&
    p1.y === 0 &&
    Math.hypot(p2.x - p1.x, p2.y - p1.y) > 45
  ) {
    p1 = { ...p2 };
  }

  const k = resolveKritaBrushParams(brush);

  if (
    !isEraser &&
    (k.kritaEngine === 'shape' ||
      k.name.includes('shapes spikes') ||
      k.name.includes('shape fill'))
  ) {
    const now = p2.time || Date.now();
    if (now - lastShapeSpikeTime > 150) {
      shapeSpikeHistory = [{ x: p1.x, y: p1.y }];
    }
    lastShapeSpikeTime = now;
    shapeSpikeHistory.push({ x: p2.x, y: p2.y });
    if (shapeSpikeHistory.length > 14) {
      shapeSpikeHistory.shift();
    }

    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.globalAlpha = Math.max(0.15, opacity * 0.9);
    ctx.lineWidth = Math.max(1.5, size * 0.25);

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    if (shapeSpikeHistory.length >= 3) {
      const anchor = shapeSpikeHistory[0];
      const mid = shapeSpikeHistory[Math.floor(shapeSpikeHistory.length / 2)];
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(
        mid.x + (Math.random() - 0.5) * size * 1.4,
        mid.y + (Math.random() - 0.5) * size * 1.4
      );
      ctx.lineTo(p2.x, p2.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  const isWetColorSmudgeBrush =
    !isEraser &&
    (k.kritaEngine === 'colorsmudge' ||
      (brush as any).engine === 'krita_colorsmudge' ||
      k.dilution > 0.25) &&
    k.smudgePull > 0.25;

  if (isWetColorSmudgeBrush) {
    renderKritaColorSmudgeSegment(
      ctx,
      p1,
      p2,
      brush,
      size,
      opacity,
      color,
      1 - k.dilution * 0.85
    );
    return;
  }

  const baseRadius = Math.max(0.75, (Number(size) || 20) / 2);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.hypot(dx, dy);
  const strokeAngleRad = dist > 0.001 ? Math.atan2(dy, dx) : 0;

  const stepDist = Math.max(
    0.5,
    Math.min(
      baseRadius * 0.6,
      baseRadius * 2 * k.spacing * Math.max(0.25, k.roundnessRatio)
    )
  );
  const steps = Math.max(1, Math.ceil(dist / stepDist));

  const modeFlowMap: Record<string, number> = {
    light_glaze: 0.25,
    uniform_glaze: 0.5,
    intense_glaze: 0.75,
    heavy_glaze: 1.0,
    uniform_blending: 0.65,
    intense_blending: 0.9,
  };
  const modeFactor = modeFlowMap[k.renderingMode] ?? 1.0;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = p1.x + dx * t;
    const y = p1.y + dy * t;
    const p1Press = Number.isFinite(p1.pressure) && p1.pressure > 0 ? p1.pressure : 0.65;
    const p2Press = Number.isFinite(p2.pressure) && p2.pressure > 0 ? p2.pressure : 0.65;
    const pressure = Math.max(0.05, Math.min(1.0, p1Press + (p2Press - p1Press) * t));

    const tiltX = (p1.tiltX ?? 0) + ((p2.tiltX ?? 0) - (p1.tiltX ?? 0)) * t;
    const tiltY = (p1.tiltY ?? 0) + ((p2.tiltY ?? 0) - (p1.tiltY ?? 0)) * t;

    // Evaluate per-parameter, per-sensor curves if configured
    let sizeCurve = k.sizeByPressureCurve;
    if (k.sensors?.size?.Pressure?.enabled && k.sensors.size.Pressure.curve?.length) {
      sizeCurve = k.sensors.size.Pressure.curve;
    }
    let sizeScale = sizeCurve?.length
      ? evaluateKritaSensorCurve(sizeCurve, pressure)
      : 1 - k.pressureSizeFactor + k.pressureSizeFactor * Math.pow(pressure, 1.1);

    if (k.sensors?.size?.Speed?.enabled && k.sensors.size.Speed.curve?.length) {
      const speedNorm = Math.min(1.0, dist / 30);
      sizeScale *= evaluateKritaSensorCurve(k.sensors.size.Speed.curve, speedNorm);
    }
    const dabRadius = Math.max(0.5, baseRadius * Math.max(0.05, sizeScale));

    let opacityCurve = k.opacityByPressureCurve;
    if (k.sensors?.opacity?.Pressure?.enabled && k.sensors.opacity.Pressure.curve?.length) {
      opacityCurve = k.sensors.opacity.Pressure.curve;
    } else if (k.sensors?.flow?.Pressure?.enabled && k.sensors.flow.Pressure.curve?.length) {
      opacityCurve = k.sensors.flow.Pressure.curve;
    }
    const pressureAlpha = opacityCurve?.length
      ? evaluateKritaSensorCurve(opacityCurve, pressure)
      : 1 - k.pressureOpacityFactor + k.pressureOpacityFactor * pressure;

    const dabAlpha = Math.max(
      0.02,
      Math.min(
        1.0,
        opacity * k.baseFlow * modeFactor * pressureAlpha * (1 - k.dilution * 0.7)
      )
    );

    let activeAngleDeg = k.angleDeg;
    let activeRoundness = k.roundnessRatio;

    if (k.penTiltEnabled && (Math.abs(tiltX) > 0.5 || Math.abs(tiltY) > 0.5)) {
      const tiltRad = Math.atan2(tiltY, tiltX);
      activeAngleDeg = ((tiltRad * 180) / Math.PI + 360) % 360;
      const tiltMag = Math.min(90, Math.hypot(tiltX, tiltY));
      const tiltFlatten = (tiltMag / 90) * 0.65;
      activeRoundness = Math.max(0.05, activeRoundness * (1 - tiltFlatten));
    }

    let finalAngleRad = (activeAngleDeg * Math.PI) / 180;
    if (k.followStroke && dist > 0.05) {
      finalAngleRad =
        strokeAngleRad +
        ((k.angleOffset || 0) * Math.PI) / 180 +
        ((activeAngleDeg || 0) * Math.PI) / 180;
    }
    if (k.scatterAngle > 0 && !k.followStroke) {
      finalAngleRad += ((Math.random() - 0.5) * k.scatterAngle * Math.PI) / 180;
    }

    let jx = 0;
    let jy = 0;
    if (k.jitterLateral > 0 || k.jitterLinear > 0) {
      let scatterCurve = k.scatterByPressureCurve;
      if (k.sensors?.scatter?.Pressure?.enabled && k.sensors.scatter.Pressure.curve?.length) {
        scatterCurve = k.sensors.scatter.Pressure.curve;
      }
      const scatterScale = scatterCurve?.length
        ? evaluateKritaSensorCurve(scatterCurve, pressure)
        : 1.0;
      const perpAngle = strokeAngleRad + Math.PI / 2;
      const latOffset =
        (Math.random() - 0.5) * 2 * k.jitterLateral * scatterScale * dabRadius * 1.5;
      const linOffset =
        (Math.random() - 0.5) * 2 * k.jitterLinear * scatterScale * dabRadius * 1.5;
      jx = Math.cos(perpAngle) * latOffset + Math.cos(strokeAngleRad) * linOffset;
      jy = Math.sin(perpAngle) * latOffset + Math.sin(strokeAngleRad) * linOffset;
    }

    const dabColor = applyKritaColorDynamics(
      color,
      k.hueJitter,
      k.satJitter,
      k.lightJitter,
      k.darkenAmount,
      pressure
    );

    stampKritaDab(
      ctx,
      x + jx,
      y + jy,
      dabRadius,
      activeRoundness,
      finalAngleRad,
      dabColor,
      dabAlpha,
      k.hardness,
      k.shapeTexture,
      k.name,
      k.shapeTextureUrl,
      k.shapeTextureUrls,
      k.grainTextureUrl,
      k.kritaPatternId,
      k.grainDepth,
      k.spikesCount,
      k.density,
      isEraser,
      k.blendMode,
      k.patternEnabled,
      k.patternStrength,
      k.patternScale,
      k.patternTexturingMode,
      k.isKritaPreset,
      k.patternCutoff,
      k.patternInvert,
      k.patternContrast,
      k.patternBrightness,
      k.patternOffsetX,
      k.patternOffsetY,
      pressure,
      k.patternStrengthPressure,
      k.dualBrush
    );
  }
}

export function renderKritaColorSmudgeSegment(
  ctx: CanvasRenderingContext2D,
  p1: StrokePoint,
  p2: StrokePoint,
  brush: Brush,
  size: number,
  opacity: number,
  paintColorHex?: string,
  colorRate: number = 0
): void {
  if (!ctx || !p1 || !p2) return;
  if (
    p1.x === 0 &&
    p1.y === 0 &&
    Math.hypot(p2.x - p1.x, p2.y - p1.y) > 45
  ) {
    p1 = { ...p2 };
  }

  const k = resolveKritaBrushParams(brush);
  const baseRadius = Math.max(2, (Number(size) || 24) / 2);
  const diameter = Math.max(4, Math.ceil(baseRadius * 2));

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.2) return;

  const strokeAngleRad = Math.atan2(dy, dx);
  const stepDist = Math.max(1.0, baseRadius * 0.2);
  const steps = Math.max(1, Math.ceil(dist / stepDist));

  const { canvas: carryCanvas, ctx: carryCtx } = getSmudgeCarryBuffer(diameter);
  const { canvas: maskedCanvas, ctx: maskedCtx } = getDabBuffer(diameter);

  const now = p1.time || Date.now();
  if (now - lastSmudgeStrokeTime > 120) {
    carryCtx.clearRect(0, 0, diameter, diameter);
    carryCtx.drawImage(
      ctx.canvas,
      p1.x - baseRadius,
      p1.y - baseRadius,
      diameter,
      diameter,
      0,
      0,
      diameter,
      diameter
    );
  }
  lastSmudgeStrokeTime = p2.time || Date.now();

  let activeAngleDeg = k.angleDeg;
  const activeRoundness = k.roundnessRatio;
  if (
    k.penTiltEnabled &&
    (Math.abs(p2.tiltX ?? 0) > 0.5 || Math.abs(p2.tiltY ?? 0) > 0.5)
  ) {
    activeAngleDeg =
      ((Math.atan2(p2.tiltY ?? 0, p2.tiltX ?? 0) * 180) / Math.PI + 360) % 360;
  }
  let angleRad = (activeAngleDeg * Math.PI) / 180;
  if (k.followStroke) {
    angleRad =
      strokeAngleRad +
      ((k.angleOffset || 0) * Math.PI) / 180 +
      ((activeAngleDeg || 0) * Math.PI) / 180;
  }

  const smudgeRate = Math.max(
    0.15,
    Math.min(0.95, (k.smudgePull || 0.75) * opacity)
  );
  const pickupRefreshRate = Math.max(
    0.05,
    Math.min(0.65, 1 - k.smudgeLength * 0.85)
  );

  const customTipImg = k.shapeTextureUrl
    ? preloadKritaTexture(k.shapeTextureUrl)
    : null;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const tx = p1.x + dx * t;
    const ty = p1.y + dy * t;
    const p1Press = Number.isFinite(p1.pressure) && p1.pressure > 0 ? p1.pressure : 0.65;
    const p2Press = Number.isFinite(p2.pressure) && p2.pressure > 0 ? p2.pressure : 0.65;
    const pressure = Math.max(
      0.1,
      Math.min(1.0, p1Press + (p2Press - p1Press) * t)
    );

    maskedCtx.clearRect(0, 0, diameter, diameter);
    maskedCtx.save();
    maskedCtx.translate(baseRadius, baseRadius);
    maskedCtx.rotate(angleRad);
    maskedCtx.scale(1.0, activeRoundness);

    if (customTipImg) {
      maskedCtx.drawImage(
        customTipImg,
        -baseRadius,
        -baseRadius,
        diameter,
        diameter
      );
    } else {
      const grad = maskedCtx.createRadialGradient(
        0,
        0,
        baseRadius * k.hardness * 0.65,
        0,
        0,
        baseRadius
      );
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      maskedCtx.fillStyle = grad;
      maskedCtx.beginPath();
      maskedCtx.arc(0, 0, baseRadius, 0, Math.PI * 2);
      maskedCtx.fill();
    }
    maskedCtx.restore();

    maskedCtx.save();
    maskedCtx.globalCompositeOperation = 'source-in';
    maskedCtx.drawImage(carryCanvas, 0, 0, diameter, diameter);

    if (paintColorHex && colorRate > 0.01) {
      maskedCtx.globalCompositeOperation = 'source-atop';
      maskedCtx.globalAlpha = colorRate * pressure * 0.35;
      maskedCtx.fillStyle = paintColorHex;
      maskedCtx.fillRect(0, 0, diameter, diameter);
    }
    maskedCtx.restore();

    ctx.save();
    ctx.globalAlpha = smudgeRate * (0.4 + 0.6 * pressure);
    ctx.drawImage(
      maskedCanvas,
      0,
      0,
      diameter,
      diameter,
      tx - baseRadius,
      ty - baseRadius,
      diameter,
      diameter
    );
    ctx.restore();

    carryCtx.save();
    carryCtx.globalAlpha = pickupRefreshRate;
    carryCtx.drawImage(
      ctx.canvas,
      tx - baseRadius,
      ty - baseRadius,
      diameter,
      diameter,
      0,
      0,
      diameter,
      diameter
    );
    carryCtx.restore();
  }
}

export function renderSmudgeSegment(
  ctx: CanvasRenderingContext2D,
  p1: StrokePoint,
  p2: StrokePoint,
  brush: Brush,
  size: number,
  opacity: number
): void {
  renderKritaColorSmudgeSegment(ctx, p1, p2, brush, size, opacity, undefined, 0);
}

const swatchCache = new Map<string, string>();

/**
 * Generates an in-memory anti-aliased dynamic stroke swatch dataURL for a brush.
 * Accurately conveys tip shape, texture, opacity, and pressure taper.
 */
export function generateBrushSwatch(
  brush: Brush,
  width: number = 96,
  height: number = 32,
  color: string = '#5fd3ad'
): string {
  if (!brush) return '';
  const cacheKey = `${brush.id || 'b'}_${brush.name || 'unnamed'}_${brush.size || 24}_${brush.opacity ?? 1}_${brush.shape?.texture || brush.texture || 'default'}_${(brush as any).shapeTextureUrl || ''}_${width}x${height}_${color}`;
  if (swatchCache.has(cacheKey)) {
    return swatchCache.get(cacheKey)!;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, width, height);

  // Generate undulating S-curve points with natural pressure taper
  const pointsCount = 22;
  const pts: { x: number; y: number; pressure: number; time: number }[] = [];
  const padX = Math.max(6, width * 0.08);

  for (let i = 0; i <= pointsCount; i++) {
    const t = i / pointsCount;
    const x = padX + t * (width - padX * 2);
    const y = height * 0.5 + Math.sin(t * Math.PI * 2) * (height * 0.22);
    const pressure = Math.sin(t * Math.PI) * 0.85 + 0.15;
    pts.push({ x, y, pressure, time: Date.now() });
  }

  const rawBrushSize = Number(brush.size) || Number((brush as any).baseSize) || 24;
  const effectiveSize = Math.max(3, Math.min(height * 0.65, rawBrushSize * 0.45));

  for (let i = 0; i < pts.length - 1; i++) {
    renderStrokeSegment(
      ctx,
      pts[i],
      pts[i + 1],
      brush,
      color,
      effectiveSize,
      brush.opacity ?? 1.0,
      false
    );
  }

  const dataUrl = canvas.toDataURL('image/png');
  swatchCache.set(cacheKey, dataUrl);
  return dataUrl;
}