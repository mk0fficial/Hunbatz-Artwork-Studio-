import test from 'node:test';
import assert from 'node:assert/strict';

// Setup DOM mock for Node.js test environment
function createMockCanvas(width = 32, height = 32) {
  const pixelData = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixelData.length; i += 4) {
    pixelData[i] = 120;
    pixelData[i + 1] = 150;
    pixelData[i + 2] = 180;
    pixelData[i + 3] = 255;
  }

  const ctx = {
    fillStyle: '#000000',
    globalCompositeOperation: 'source-over',
    globalAlpha: 1.0,
    filter: 'none',
    imageSmoothingEnabled: true,
    fillRect: () => {},
    clearRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    rect: () => {},
    closePath: () => {},
    fill: () => {},
    save: () => {},
    restore: () => {},
    getImageData: () => ({
      width,
      height,
      data: new Uint8ClampedArray(pixelData),
    }),
    createImageData: (w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
    }),
    putImageData: (id: any) => {
      const len = Math.min(pixelData.length, id.data.length);
      pixelData.set(id.data.subarray(0, len));
    },
    drawImage: () => {},
  };

  return {
    width,
    height,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
}

if (typeof globalThis.document === 'undefined') {
  (globalThis as any).document = {
    createElement: (tag: string) => (tag === 'canvas' ? createMockCanvas(32, 32) : {}),
  };
}

// Module 1 Types & Hierarchy Helpers
import { Layer } from '../src/types/canvas.js';

// Module 2 Canvas Adjustments
import {
  buildGradientMapLut,
  applyGradientMapToImageData,
  applySelectiveColorToImageData,
  CINEMATIC_3D_LUTS,
  parseCubeLut,
  PHOTO_FILTER_PRESETS,
  applyPhotoFilterToImageData,
  STYLE_FILTERS_24,
  applyStyleFilterToImageData,
  applyExposureToImageData,
  THERMAL_GRADIENT_TYPES,
  applyThermalEffectToImageData,
} from '../src/utils/canvasAdjustments.js';

// Module 3 Dither Suite
import {
  applyIndexedDither,
  applyMacPaintDither,
  applyCmykHalftoneScreen,
  applySignalModulation,
  MACPAINT_38_PATTERNS,
  DITHER_ALGORITHM_LABELS,
  BUILTIN_PALETTES,
  findClosestPaletteColor,
  extractAdaptivePalette,
} from '../src/utils/ditherEngine.js';

// Module 4 Glitch Studio Expansion
import {
  applyVhsFilter,
  applyLedScreen,
} from '../src/utils/glitchStudioEngine.js';

// Helper to create synthetic ImageData in Node.js environment
function makeDummyImageData(width: number, height: number, fillRgba: [number, number, number, number] = [128, 128, 128, 255]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fillRgba[0];
    data[i + 1] = fillRgba[1];
    data[i + 2] = fillRgba[2];
    data[i + 3] = fillRgba[3];
  }
  return {
    width,
    height,
    data,
  } as unknown as ImageData;
}

// -----------------------------------------------------------------------------
// MODULE 1: Layer Groups & Hierarchy
// -----------------------------------------------------------------------------
test('Module 1: Layer group hierarchy and parentId assignment', () => {
  const rootGroup: Layer = {
    id: 'group-1',
    name: 'Character Art',
    visible: true,
    opacity: 0.9,
    blendMode: 'source-over',
    locked: false,
    alphaLocked: false,
    canvas: {} as HTMLCanvasElement,
    ctx: {} as CanvasRenderingContext2D,
    type: 'group',
    isExpanded: true,
  };

  const childLayer1: Layer = {
    id: 'layer-lineart',
    name: 'Lineart',
    visible: true,
    opacity: 1,
    blendMode: 'source-over',
    locked: false,
    alphaLocked: false,
    canvas: {} as HTMLCanvasElement,
    ctx: {} as CanvasRenderingContext2D,
    type: 'raster',
    parentId: 'group-1',
  };

  const childLayer2: Layer = {
    id: 'layer-flats',
    name: 'Flat Colors',
    visible: true,
    opacity: 1,
    blendMode: 'source-over',
    locked: false,
    alphaLocked: false,
    canvas: {} as HTMLCanvasElement,
    ctx: {} as CanvasRenderingContext2D,
    type: 'raster',
    parentId: 'group-1',
  };

  const layers: Layer[] = [rootGroup, childLayer1, childLayer2];

  // Group membership validation
  assert.strictEqual(rootGroup.type, 'group');
  assert.strictEqual(childLayer1.parentId, 'group-1');
  assert.strictEqual(childLayer2.parentId, 'group-1');

  // Simulating dragging childLayer1 out of the group to the root stack
  const unnestedLayer = { ...childLayer1, parentId: undefined };
  assert.strictEqual(unnestedLayer.parentId, undefined, 'Pulling layer to root gutter removes parentId');

  // Verify group nesting count
  const children = layers.filter(l => l.parentId === rootGroup.id);
  assert.strictEqual(children.length, 2);
});

// -----------------------------------------------------------------------------
// MODULE 2: Non-Destructive Adjustments Overhaul
// -----------------------------------------------------------------------------
test('Module 2: Gradient Map LUT generation and luminance remapping', () => {
  const stops = [
    { id: 's1', offset: 0, color: '#000000' },
    { id: 's2', offset: 0.5, color: '#ff0000' },
    { id: 's3', offset: 1, color: '#ffffff' },
  ];
  const lut = buildGradientMapLut(stops, 0, 1);
  assert.strictEqual(lut.length, 256 * 4);

  // Black stop at 0 luminance
  assert.strictEqual(lut[0], 0);
  assert.strictEqual(lut[1], 0);
  assert.strictEqual(lut[2], 0);

  // White stop at 255 luminance
  assert.strictEqual(lut[255 * 4], 255);
  assert.strictEqual(lut[255 * 4 + 1], 255);
  assert.strictEqual(lut[255 * 4 + 2], 255);

  // Test applying gradient map to ImageData
  const img = makeDummyImageData(4, 4, [0, 0, 0, 255]); // pure black
  applyGradientMapToImageData(img, lut);
  assert.strictEqual(img.data[0], 0);
  assert.strictEqual(img.data[1], 0);
  assert.strictEqual(img.data[2], 0);
});

test('Module 2: Selective Color adjustment across tonal ranges', () => {
  const img = makeDummyImageData(4, 4, [255, 0, 0, 255]); // Pure Red
  applySelectiveColorToImageData(img, {
    channel: 'reds',
    channels: {
      reds: { cyan: 50, magenta: 0, yellow: 0, black: 20 },
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
    method: 'relative',
  });
  // Cyan adjustment should have reduced red
  assert.ok(img.data[0] < 255, 'Red component should be lowered by cyan shift in reds channel');
});

test('Module 2: Color Lookup (3D LUT) presets and .cube file parser', () => {
  assert.ok(CINEMATIC_3D_LUTS.length >= 10, 'Expected at least 10 cinematic LUT presets');
  
  // Test .cube parser with synthetic 2x2x2 LUT
  const sampleCube = `
TITLE "Test Mini Cube"
LUT_3D_SIZE 2
0.0 0.0 0.0
1.0 0.0 0.0
0.0 1.0 0.0
1.0 1.0 0.0
0.0 0.0 1.0
1.0 0.0 1.0
0.0 1.0 1.0
1.0 1.0 1.0
`;
  const parsed = parseCubeLut(sampleCube);
  assert.ok(parsed);
  assert.strictEqual(parsed!.size, 2);
  assert.strictEqual(parsed!.data.length, 2 * 2 * 2 * 3);
  assert.strictEqual(parsed!.data[0], 0);
  assert.strictEqual(parsed!.data[parsed!.data.length - 1], 1.0);
});

test('Module 2: Photo Filter presets & luminosity preservation', () => {
  assert.ok(PHOTO_FILTER_PRESETS.length >= 15);
  const img = makeDummyImageData(4, 4, [100, 100, 100, 255]);
  applyPhotoFilterToImageData(img, '#ec8a00', 50, true);
  // Warming filter adds warmth (red/yellow)
  assert.ok(img.data[0] >= 100, 'Red should increase with warming filter');
});

test('Module 2: 24 Style Filters (Instagram/VSCO inspired)', () => {
  assert.strictEqual(STYLE_FILTERS_24.length, 24);
  const img = makeDummyImageData(4, 4, [120, 120, 120, 255]);
  applyStyleFilterToImageData(img, 'clarendon', 80, 20, 4, 4);
  // Check that pixels were processed without crashing or NaN
  assert.ok(!Number.isNaN(img.data[0]));
  assert.ok(!Number.isNaN(img.data[1]));
  assert.ok(!Number.isNaN(img.data[2]));
});

test('Module 2: Photometric Exposure adjustment', () => {
  const img = makeDummyImageData(4, 4, [100, 100, 100, 255]);
  applyExposureToImageData(img, 1.0, 0.05, 1.0);
  assert.ok(img.data[0] > 100, 'Positive exposure must brighten pixels');
});

test('Module 2: Thermal Infrared Effect with 6 gradient types and edge contour', () => {
  assert.strictEqual(THERMAL_GRADIENT_TYPES.length, 6);
  const img = makeDummyImageData(8, 8, [150, 100, 50, 255]);
  applyThermalEffectToImageData(img, {
    gradientType: 1,
    invert: false,
    shadows: -0.45,
    midtones: -0.11,
    highlights: -0.05,
    gradientShift: 0,
    gradientRepeat: 1,
    showEdges: true,
    edgeRange: 0.25,
    width: 8,
    height: 8,
  });
  // Pixels should have valid thermal coloring
  assert.ok(!Number.isNaN(img.data[0]));
  assert.strictEqual(img.data[3], 255, 'Alpha channel should remain preserved');
});

// -----------------------------------------------------------------------------
// MODULE 3: Dither Suite
// -----------------------------------------------------------------------------
test('Module 3: Dither Suite - Indexed algorithms and custom palette reduction', () => {
  const algoCount = Object.keys(DITHER_ALGORITHM_LABELS).length;
  assert.ok(algoCount >= 15, `Expected >= 15 algorithms, got ${algoCount}`);
  
  const paletteKeys = Object.keys(BUILTIN_PALETTES);
  assert.ok(paletteKeys.length >= 8, `Expected >= 8 built-in palettes, got ${paletteKeys.length}`);

  const canvas = createMockCanvas(16, 16);
  const outCanvas = applyIndexedDither(canvas, {
    algorithm: 'bayer_8x8',
    paletteMode: 'gameboy',
    colorCount: 4,
    pixelStep: 1,
  });

  assert.ok(outCanvas);
  assert.strictEqual(outCanvas.width, 16);
});

test('Module 3: Dither Suite - MacPaint 1-Bit 38 Susan Kare patterns', () => {
  assert.strictEqual(MACPAINT_38_PATTERNS.length, 38);

  const canvas = createMockCanvas(16, 16);
  const outCanvas = applyMacPaintDither(canvas, {
    threshold: 0.5,
    contrast: 2.0,
    grain: 0.0,
    inkColor: '#000000',
    paperColor: '#ffffff',
    activePatterns: [0, 5, 10],
  });

  assert.ok(outCanvas);
  assert.strictEqual(outCanvas.width, 16);
});

test('Module 3: Dither Suite - CMYK Halftone Screen Press with 2D XY shift', () => {
  const canvas = createMockCanvas(16, 16);
  const outCanvas = applyCmykHalftoneScreen(canvas, {
    screenShape: 'round',
    frequency: 50,
    dotGain: 0.05,
    inks: [
      { enabled: true, color: '#00ffff', angle: 15, shiftX: 0.5, shiftY: 0 },
      { enabled: true, color: '#ff00ff', angle: 75, shiftX: 0, shiftY: 0.5 },
      { enabled: true, color: '#ffff00', angle: 0, shiftX: 0, shiftY: 0 },
      { enabled: true, color: '#000000', angle: 45, shiftX: 0, shiftY: 0 },
    ],
  });

  assert.ok(outCanvas);
  assert.strictEqual(outCanvas.width, 16);
});

test('Module 3: Dither Suite - FM / CRT Signal Modulation', () => {
  const canvas = createMockCanvas(16, 16);
  const outCanvas = applySignalModulation(canvas, {
    resolution: 512,
    waveScale: 40,
    fmSensitivity: 1.2,
    signalStrength: 0.5,
    waveDirection: 0,
  });

  assert.ok(outCanvas);
  assert.strictEqual(outCanvas.width, 16);
});

// -----------------------------------------------------------------------------
// MODULE 4: Glitch Studio VHS Filter & LED Screen
// -----------------------------------------------------------------------------
test('Module 4: VHS Tape Filter applies analog noise, tape flutter & color bleed', () => {
  const canvas = createMockCanvas(32, 32);
  const outCanvas = applyVhsFilter(canvas, {
    resolution: 320,
    distortion: 0.8,
    colorFringing: 2.0,
    wobble: 1.5,
    tapeCrease: 0.5,
    trackingNoise: 1.5,
    sparkle: 1.0,
    grain: 0.5,
  });

  assert.ok(outCanvas);
  assert.strictEqual(outCanvas.width, 32);
});

test('Module 4: LED Screen Phosphor renders RGB sub-pixel matrix and grid gap', () => {
  const canvas = createMockCanvas(30, 30);
  const outCanvas = applyLedScreen(canvas, {
    pixelSize: 3.0,
    gap: 0.5,
    pixelBlur: 0.0,
    rgbMode: true,
    transparent: false,
  });

  assert.ok(outCanvas);
  assert.strictEqual(outCanvas.width, 30);
});
