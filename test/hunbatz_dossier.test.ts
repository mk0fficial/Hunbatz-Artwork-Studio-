import test from 'node:test';
import assert from 'node:assert/strict';
import { brushToUniversal, universalToBrush, UniversalBrushPreset } from '../src/types/brush.js';
import { parseMybFile, parseKppFile, parseBrushArchiveOrBinary, createDefaultBrush } from '../src/utils/brushParsers.js';
import { evaluateCurve } from '../src/engine/TriModeBrushEngine.js';
import { Brush } from '../src/types/canvas.js';

test('Strict Visual Guardrail: Default brush grainDepth is 0', () => {
  const defaultBrush = createDefaultBrush({ name: 'Test Default' });
  assert.strictEqual(defaultBrush.grainDepth, 0, 'grainDepth must strictly be 0 by default to prevent unwanted grain overlays');

  const converted = universalToBrush(defaultBrush);
  assert.strictEqual(converted.grain?.contrast, 0.5);
  // grain texture is 'blank' when no grain texture is supplied
  assert.strictEqual(converted.grain?.texture, 'blank');
});

test('Universal Brush Bridge: Bi-directional conversion preserves key properties', () => {
  const dummyBrush: Brush = {
    id: 'brush-test-1',
    name: 'Ink Precision Pen',
    category: 'Inking',
    description: 'Crisp linework pen',
    size: 32,
    opacity: 0.9,
    hardness: 0.85,
    streamline: 0.4,
    spacing: 0.1,
    jitter: 0,
    texture: 'hard_round',
    minSize: 1,
    maxSize: 100,
    pressureSizeFactor: 0.7,
    pressureOpacityFactor: 0.5,
    shape: {
      texture: 'hard_round',
      scatter: 0.05,
      rotation: 45,
      followStroke: true,
      count: 1,
      countJitter: 0,
      roundness: 0.75,
    },
  };

  const universal = brushToUniversal(dummyBrush);
  assert.strictEqual(universal.id, 'brush-test-1');
  assert.strictEqual(universal.name, 'Ink Precision Pen');
  assert.strictEqual(universal.baseSize, 32);
  assert.strictEqual(universal.baseOpacity, 0.9);
  assert.strictEqual(universal.angle, 45);
  assert.strictEqual(universal.roundness, 0.75);
  assert.strictEqual(universal.followStroke, true);
  assert.strictEqual(universal.grainDepth, 0, 'Grain depth must default to 0');

  const backToBrush = universalToBrush(universal);
  assert.strictEqual(backToBrush.id, 'brush-test-1');
  assert.strictEqual(backToBrush.name, 'Ink Precision Pen');
  assert.strictEqual(backToBrush.shape?.rotation, 45);
  assert.strictEqual(backToBrush.shape?.roundness, 0.75);
  assert.strictEqual(backToBrush.shape?.followStroke, true);
});

test('MyPaint .myb Parser: Parses JSON/INI format settings accurately', () => {
  const sampleMyb = `
# MyPaint brush setting
version 2
settings.radius_logarithmic.base_value = 1.8
settings.opaque.base_value = 0.85
settings.hardness.base_value = 0.7
settings.dabs_per_basic_radius.base_value = 4.0
settings.speed1_gamma.base_value = 2.5
`;
  const parsed = parseMybFile(sampleMyb, 'Classic Ink.myb');
  assert.strictEqual(parsed.sourceFormat, 'myb');
  assert.strictEqual(parsed.name, 'Classic Ink');
  assert.ok(parsed.baseSize > 0);
  assert.strictEqual(parsed.grainDepth, 0);
  assert.strictEqual(parsed.hardness, 0.7);
});

test('Krita .kpp Parser: Extracts preset details and attributes', async () => {
  const sampleKpp = `
[Preset]
name=Krita Concept Sketch
engine=PixelBrush
paintOpId=pixelbrush
radius=16
opacity=0.75
spacing=0.2
`;
  const parsed = await parseKppFile(sampleKpp, 'concept_sketch.kpp');
  assert.strictEqual(parsed.sourceFormat, 'kpp');
  assert.strictEqual(parsed.name, 'Krita Concept Sketch');
  assert.strictEqual(parsed.baseOpacity, 0.75);
  assert.strictEqual(parsed.spacing, 0.2);
  assert.strictEqual(parsed.grainDepth, 0);
});

test('Multi-Format Binary Importer: Handles Clip Studio (.sut) and raw files gracefully', async () => {
  const fakeSutBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x54, 0x65, 0x73, 0x74]);
  const results = await parseBrushArchiveOrBinary(fakeSutBytes.buffer, 'G-Pen Pro.sut');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].sourceFormat, 'sut');
  assert.strictEqual(results[0].name, 'G-Pen Pro');
  assert.strictEqual(results[0].grainDepth, 0);
});

test('Pressure / Dynamics Curve Evaluator: Interpolates non-linear curves correctly', () => {
  const curve = [
    { x: 0, y: 0.1 },
    { x: 0.5, y: 0.8 },
    { x: 1, y: 1.0 },
  ];

  // At bounds
  assert.strictEqual(evaluateCurve(curve, 0), 0.1);
  assert.strictEqual(evaluateCurve(curve, 1), 1.0);
  // Inside first segment
  const mid1 = evaluateCurve(curve, 0.25);
  assert.ok(mid1 > 0.1 && mid1 < 0.8);
  // Inside second segment
  const mid2 = evaluateCurve(curve, 0.75);
  assert.ok(mid2 > 0.8 && mid2 < 1.0);

  // Engine curve evaluator
  assert.strictEqual(evaluateCurve(curve, 0.5), 0.8);
});
