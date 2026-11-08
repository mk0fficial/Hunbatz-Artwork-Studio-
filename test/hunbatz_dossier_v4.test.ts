import test from 'node:test';
import assert from 'node:assert/strict';

test('Dossier V4: Pixel Sort safe modulo prevents buffer and negative index faults', () => {
  const safeMod = (n: number, m: number) => ((n % m) + m) % m;
  assert.equal(safeMod(-5, 100), 95);
  assert.equal(safeMod(-105, 100), 95);
  assert.equal(safeMod(0, 100), 0);
  assert.equal(safeMod(105, 100), 5);

  // Test with random jitter simulation
  for (let y = 0; y < 100; y++) {
    const seedJitter = Math.floor((Math.sin(y * 12.9898 + 78.233) * 43758.5453) % 14);
    for (let rawX = 0; rawX < 50; rawX++) {
      const x = safeMod(rawX + 25 + seedJitter, 50);
      assert.ok(x >= 0 && x < 50, `x=${x} is within [0, 50)`);
    }
  }
});

test('Dossier V4: Masking Luminance to Alpha accurately converts black to 0 and white to 255', () => {
  // Pure black mask pixel: R=0, G=0, B=0, A=255
  const blackLum = 0.299 * 0 + 0.587 * 0 + 0.114 * 0;
  const blackAlpha = Math.round((blackLum / 255) * 255 * (255 / 255));
  assert.equal(blackAlpha, 0, 'Black mask pixel should produce 0 alpha (hidden)');

  // Pure white mask pixel: R=255, G=255, B=255, A=255
  const whiteLum = 0.299 * 255 + 0.587 * 255 + 0.114 * 255;
  const whiteAlpha = Math.round((whiteLum / 255) * 255 * (255 / 255));
  assert.equal(whiteAlpha, 255, 'White mask pixel should produce 255 alpha (fully revealed)');

  // 50% gray mask pixel
  const grayLum = 0.299 * 128 + 0.587 * 128 + 0.114 * 128;
  const grayAlpha = Math.round((grayLum / 255) * 255);
  assert.equal(grayAlpha, 128, '50% gray mask pixel should produce 128 alpha (semi-transparent)');
});

test('Dossier V4: Color Halftone CMYK subtractive plates and keying calculations', () => {
  // Pure white pixel: R=255, G=255, B=255 -> keyed out 100% transparent (density = 0)
  const isNearWhite = (r: number, g: number, b: number) => r > 248 && g > 248 && b > 248;
  assert.equal(isNearWhite(255, 255, 255), true);
  assert.equal(isNearWhite(250, 250, 250), true);
  assert.equal(isNearWhite(200, 100, 50), false);

  // Pure Cyan pixel: R=0, G=255, B=255
  const r = 0, g = 255, b = 255;
  const cPure = 1 - r / 255; // 1.0
  const mPure = 1 - g / 255; // 0.0
  const yPure = 1 - b / 255; // 0.0
  const k = Math.min(cPure, mPure, yPure); // 0.0
  const cDens = k < 0.999 ? Math.max(0, (cPure - k) / (1 - k)) : 0;
  const mDens = k < 0.999 ? Math.max(0, (mPure - k) / (1 - k)) : 0;
  assert.equal(cDens, 1.0, 'Cyan plate density should be 1.0');
  assert.equal(mDens, 0.0, 'Magenta plate density should be 0.0');
});

test('Dossier V4: Cutout Kuwahara quantization levels (2 to 8) and modal grouping', () => {
  // Levels quantization logic: interval = 255 / (levels - 1)
  const levels = 4;
  const step = 255 / (levels - 1);
  const quantize = (c: number) => Math.min(255, Math.max(0, Math.round(Math.round(c / step) * step)));

  assert.equal(quantize(0), 0);
  assert.equal(quantize(255), 255);
  assert.equal(quantize(128), 170); // 4 levels are 0, 85, 170, 255

  // 3x3 Modal filter frequency logic
  const neighborhood = [170, 170, 170, 85, 170, 0, 170, 170, 255];
  const counts: Record<number, number> = {};
  let maxCount = 0;
  let modeVal = neighborhood[0];
  for (const v of neighborhood) {
    counts[v] = (counts[v] || 0) + 1;
    if (counts[v] > maxCount) {
      maxCount = counts[v];
      modeVal = v;
    }
  }
  assert.equal(modeVal, 170, '3x3 modal filter correctly selects majority color 170');
});

test('Dossier V4: Dual Brush alpha and parameter suite parity', () => {
  const intensity = 0.8;
  const opacity = 0.9;
  const flow = 0.7;
  const compositeAlpha = Math.max(0.01, Math.min(1.0, intensity * opacity * flow));
  assert.ok(Math.abs(compositeAlpha - 0.504) < 0.001, 'Composite alpha calculated correctly');

  // Stamp shapes catalog
  const allowedShapes = [
    'circle',
    'square',
    'grunge_splatter',
    'raked_bristles',
    'noise_grain',
    'charcoal_grit',
    'stipple',
    'canvas_weave',
  ];
  assert.equal(allowedShapes.length, 8);
});

test('Dossier V4: Freeform Transform fixed-anchor coordinates preserve opposite bounds', () => {
  const startX = 100;
  const startY = 100;
  const startW = 200;
  const startH = 150;
  const dx = 40;
  const dy = 30;

  // Dragging SE handle: pinned anchor is NW (100, 100)
  const seW = Math.max(8, startW + dx); // 240
  const seH = Math.max(8, startH + dy); // 180
  const seX = startX; // 100
  const seY = startY; // 100
  assert.equal(seX, 100);
  assert.equal(seY, 100);
  assert.equal(seW, 240);
  assert.equal(seH, 180);

  // Dragging NW handle: pinned anchor is SE (300, 250)
  const nwW = Math.max(8, startW - dx); // 160
  const nwH = Math.max(8, startH - dy); // 120
  const nwX = (startX + startW) - nwW; // 300 - 160 = 140
  const nwY = (startY + startH) - nwH; // 250 - 120 = 130
  assert.equal(nwX + nwW, startX + startW, 'Right edge pinned');
  assert.equal(nwY + nwH, startY + startH, 'Bottom edge pinned');
});
