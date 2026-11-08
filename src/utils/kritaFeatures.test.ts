import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blendPixel,
  isStandardCanvasMode,
  getCanvasCompositeOperation,
  resolveKritaBlendMode,
  CATEGORY_ORDER,
  KRITA_BLEND_MODE_GROUPS,
  DEFAULT_FAVORITE_BLEND_MODES,
  BLEND_MODE_LABELS,
  type KritaBlendMode,
} from './blendModes';
import { evaluateKritaSensorCurve, resolveKritaBrushParams } from './brushEngine';
import type { Brush } from '../types/canvas';

test('Krita Blending Modes: 13 categories and group completeness', () => {
  const expectedCategories = [
    'favorites',
    'arithmetic',
    'binary',
    'darken',
    'hsi',
    'hsl',
    'hsv',
    'hsy',
    'lighten',
    'misc',
    'mix',
    'negative',
    'quadratic',
  ];

  assert.deepEqual(CATEGORY_ORDER, expectedCategories);

  for (const cat of expectedCategories) {
    const group = KRITA_BLEND_MODE_GROUPS[cat as keyof typeof KRITA_BLEND_MODE_GROUPS];
    assert.ok(group, `Category group missing: ${cat}`);
    assert.ok(group.length > 0, `Category group empty: ${cat}`);
  }

  // Verify Default Favorites has exactly the 15 modes from Krita
  assert.equal(DEFAULT_FAVORITE_BLEND_MODES.length, 15);
  assert.ok(DEFAULT_FAVORITE_BLEND_MODES.includes('source-over'));
  assert.ok(DEFAULT_FAVORITE_BLEND_MODES.includes('multiply'));
  assert.ok(DEFAULT_FAVORITE_BLEND_MODES.includes('screen'));
  assert.ok(DEFAULT_FAITA_BLEND_MODES_has('overlay', DEFAULT_FAVORITE_BLEND_MODES));
  assert.ok(DEFAULT_FAVORITE_BLEND_MODES.includes('erase'));
});

function DEFAULT_FAITA_BLEND_MODES_has(item: KritaBlendMode, arr: KritaBlendMode[]) {
  return arr.includes(item);
}

test('Krita Blending Modes: Arithmetic algorithms', () => {
  // Addition: 100 + 100 = 200
  const addRes = blendPixel('add', 100, 100, 100, 100, 100, 100);
  assert.equal(addRes.r, 200);

  // Subtract: 150 - 50 = 100
  const subRes = blendPixel('subtract', 150, 150, 150, 50, 50, 50);
  assert.equal(subRes.r, 100);

  // Divide: (128 / 128) * 255 = 255
  const divRes = blendPixel('divide', 128, 128, 128, 128, 128, 128);
  assert.equal(divRes.r, 255);

  // Inverse Subtract: 50 - 150 clamped to 0
  const invSubRes = blendPixel('inverse-subtract', 150, 150, 150, 50, 50, 50);
  assert.equal(invSubRes.r, 0);
});

test('Krita Blending Modes: Binary bitwise operations', () => {
  // AND: 0b11001100 (204) & 0b10101010 (170) = 0b10001000 (136)
  const andRes = blendPixel('and', 204, 204, 204, 170, 170, 170);
  assert.equal(andRes.r, 136);

  // OR: 204 | 170 = 238
  const orRes = blendPixel('or', 204, 204, 204, 170, 170, 170);
  assert.equal(orRes.r, 238);

  // XOR: 204 ^ 170 = 102
  const xorRes = blendPixel('xor', 204, 204, 204, 170, 170, 170);
  assert.equal(xorRes.r, 102);
});

test('Krita Blending Modes: Darken, Lighten, Negative, Modulo, Quadratic', () => {
  // Burn
  const burnRes = blendPixel('burn', 200, 200, 200, 100, 100, 100);
  assert.ok(burnRes.r <= 200);

  // Linear Light
  const linLight = blendPixel('linear-light', 128, 128, 128, 192, 192, 192);
  assert.ok(linLight.r > 128);

  // Heat & Freeze
  const heatRes = blendPixel('heat', 100, 100, 100, 150, 150, 150);
  assert.ok(heatRes.r >= 0 && heatRes.r <= 255);

  const freezeRes = blendPixel('freeze', 100, 100, 100, 150, 150, 150);
  assert.ok(freezeRes.r >= 0 && freezeRes.r <= 255);

  // Modulo
  const modRes = blendPixel('modulo', 200, 200, 200, 150, 150, 150);
  assert.ok(modRes.r >= 0 && modRes.r <= 255);

  // Quadratic Intersection
  const quadRes = blendPixel('quadratic-intersection', 128, 128, 128, 128, 128, 128);
  assert.ok(quadRes.r >= 0 && quadRes.r <= 255);
});

test('Krita CompositeOp XML tag parsing', () => {
  assert.equal(resolveKritaBlendMode('COMPOSITE_OVER'), 'source-over');
  assert.equal(resolveKritaBlendMode('COMPOSITE_MULT'), 'multiply');
  assert.equal(resolveKritaBlendMode('COMPOSITE_SCREEN'), 'screen');
  assert.equal(resolveKritaBlendMode('COMPOSITE_ADD'), 'add');
  assert.equal(resolveKritaBlendMode('COMPOSITE_ERASE'), 'erase');
  assert.equal(resolveKritaBlendMode('COMPOSITE_HARD_LIGHT'), 'hard-light');
  assert.equal(resolveKritaBlendMode('COMPOSITE_DIVIDE'), 'divide');
});

test('Krita Sensor Curves: Multi-node Hermite Spline Evaluation', () => {
  // Linear curve: (0,0) -> (1,1)
  const linearNodes = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ];
  assert.equal(evaluateKritaSensorCurve(linearNodes, 0), 0);
  assert.equal(evaluateKritaSensorCurve(linearNodes, 1), 1);
  assert.ok(Math.abs(evaluateKritaSensorCurve(linearNodes, 0.5) - 0.5) < 0.01);

  // 3-node S-curve: (0,0) -> (0.5, 0.2) -> (1,1)
  const sCurveNodes = [
    { x: 0, y: 0 },
    { x: 0.5, y: 0.2 },
    { x: 1, y: 1 },
  ];
  assert.equal(evaluateKritaSensorCurve(sCurveNodes, 0), 0);
  assert.equal(evaluateKritaSensorCurve(sCurveNodes, 1), 1);
  const midVal = evaluateKritaSensorCurve(sCurveNodes, 0.5);
  assert.ok(Math.abs(midVal - 0.2) < 0.05);

  // Multi-node curve (5 custom nodes)
  const fiveNodes = [
    { x: 0, y: 0.1 },
    { x: 0.25, y: 0.8 },
    { x: 0.5, y: 0.3 },
    { x: 0.75, y: 0.9 },
    { x: 1, y: 0.4 },
  ];
  const v0 = evaluateKritaSensorCurve(fiveNodes, 0);
  assert.ok(Math.abs(v0 - 0.1) < 0.01);
  const v1 = evaluateKritaSensorCurve(fiveNodes, 1);
  assert.ok(Math.abs(v1 - 0.4) < 0.01);

  // Clamping check
  assert.ok(evaluateKritaSensorCurve(fiveNodes, -0.5) >= 0);
  assert.ok(evaluateKritaSensorCurve(fiveNodes, 1.5) <= 1);
});

test('Krita Brush Engine: resolveKritaBrushParams preserves isolated sensors and blendMode', () => {
  const customBrush = {
    id: 'krita_test_brush',
    name: 'Krita Test',
    category: 'Krita Test',
    size: 40,
    opacity: 0.8,
    spacing: 0.1,
    blendMode: 'color-dodge',
    sensors: {
      size: {
        Pressure: {
          enabled: true,
          curve: [{ x: 0, y: 0.2 }, { x: 0.6, y: 0.9 }, { x: 1, y: 1 }],
        },
        Speed: {
          enabled: false,
          curve: [{ x: 0, y: 1 }, { x: 1, y: 0 }],
        },
      },
      opacity: {
        Pressure: {
          enabled: true,
          curve: [{ x: 0, y: 0 }, { x: 0.3, y: 0.7 }, { x: 1, y: 0.9 }],
        },
      },
    },
    shareCurveAcrossSettings: {
      size: false,
      opacity: true,
    },
  } as unknown as Brush;

  const params = resolveKritaBrushParams(customBrush);
  assert.equal(params.blendMode, 'color-dodge');
  assert.equal(params.shareCurveAcrossSettings?.opacity, true);
  assert.equal(params.shareCurveAcrossSettings?.size, false);
  assert.equal(params.sensors?.size?.Pressure?.enabled, true);
  assert.equal(params.sensors?.size?.Speed?.enabled, false);
  assert.equal(params.sensors?.size?.Pressure?.curve.length, 3);
  assert.equal(params.sensors?.opacity?.Pressure?.curve.length, 3);
});
