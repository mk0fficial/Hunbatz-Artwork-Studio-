import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inferKritaCategory,
  parseMybFile,
  buildKritaBrushFromXml,
  parseAbrFile,
} from './brushImporter';
import { hydrateBrush, DEFAULT_KRITA_FOLDERS, FACTORY_BRUSH_DEFAULTS } from '../constants/brushes';
import { Brush } from '../types/canvas';

test('inferKritaCategory correctly classifies brush names', () => {
  assert.equal(inferKritaCategory('Airbrush Soft'), 'Krita Basic');
  assert.equal(inferKritaCategory('Basic-5 Size default'), 'Krita Basic');
  assert.equal(inferKritaCategory('Pencil-2'), 'Krita Pencils');
  assert.equal(inferKritaCategory('Pencil-3 Large 4B'), 'Krita Pencils');
  assert.equal(inferKritaCategory('Ink-3 Gpen'), 'Krita Inks');
  assert.equal(inferKritaCategory('Ink-2 Fineliner'), 'Krita Inks');
  assert.equal(inferKritaCategory('Marker Chisel Smooth'), 'Krita Markers');
  assert.equal(inferKritaCategory('Bristles-2 Flat Rough'), 'Krita Bristles & Dry');
  assert.equal(inferKritaCategory('Dry Bristles Eroded'), 'Krita Bristles & Dry');
  assert.equal(inferKritaCategory('Chalk Grainy'), 'Krita Chalk & Charcoal');
  assert.equal(inferKritaCategory('Charcoal Pencil Large'), 'Krita Chalk & Charcoal');
  assert.equal(inferKritaCategory('Wet Paint'), 'Krita Wet & Paint');
  assert.equal(inferKritaCategory('Wet Knife'), 'Krita Wet & Paint');
  assert.equal(inferKritaCategory('Watercolor Fringe'), 'Krita Watercolor');
  assert.equal(inferKritaCategory('Texture Splatter'), 'Krita Textures');
});

test('parseMybFile correctly parses JSON format MyPaint presets', async () => {
  const jsonMyb = JSON.stringify({
    format_version: 2,
    settings: {
      radius_logarithmic: { base_value: 2.5 },
      opaque: { base_value: 0.85 },
      hardness: { base_value: 0.9 },
      dabs_per_actual_radius: { base_value: 3.0 },
      smudge: { base_value: 0.4 },
    },
  });

  const brush = await parseMybFile(jsonMyb, 'test_mypaint_brush.myb');

  assert.equal(brush.name, 'Test Mypaint Brush');
  assert.equal(brush.sourceFormat, 'mypaint');
  assert.equal(brush.opacity, 0.85);
  assert.equal(brush.hardness, 0.9);
  assert.ok(brush.size > 0);
  assert.ok(brush.spacing > 0);
  assert.equal(brush.category, 'Krita Wet & Paint');
  assert.equal(brush.wetMix?.pull, 0.4);
});

test('parseMybFile correctly parses key-value text format MyPaint presets', async () => {
  const textMyb = `
version 2
radius_logarithmic 1.8
opaque 0.95
hardness 0.75
dabs_per_actual_radius 2.5
smudge 0.0
`;

  const brush = await parseMybFile(textMyb, 'sketch_pencil.myb');

  assert.equal(brush.name, 'Sketch Pencil');
  assert.equal(brush.sourceFormat, 'mypaint');
  assert.equal(brush.opacity, 0.95);
  assert.equal(brush.hardness, 0.75);
  assert.equal(brush.category, 'Krita Pencils');
});

test('buildKritaBrushFromXml correctly parses Krita PaintOp XML', () => {
  const xml = `
<PaintOpPreset paintopid="pixelbrush" name="Basic-4 Flow Opacity" version="2">
  <param name="paintop">pixelbrush</param>
  <param name="General/size">32</param>
  <param name="General/opacity">0.85</param>
  <param name="General/flow">0.55</param>
  <param name="Spacing/spacing">0.05</param>
</PaintOpPreset>
`;

  const brush = buildKritaBrushFromXml(xml, 'data:image/png;base64,mock', 'Fallback Name');

  assert.equal(brush.name, 'Basic-4 Flow Opacity');
  assert.equal(brush.sourceFormat, 'krita');
  assert.equal(brush.size, 32);
  assert.equal(brush.opacity, 0.85);
  assert.equal(brush.spacing, 0.05);
  assert.equal(brush.rendering?.flow, 0.55);
  assert.equal(brush.category, 'Krita Basic');
  assert.equal(brush.customStampUrl, 'data:image/png;base64,mock');
});

test('hydrateBrush fills all 1:1 properties without undefined errors', () => {
  const minimalBrush: Brush = {
    id: 'test_brush',
    name: 'Minimal Test',
    category: 'Testing Base',
    description: 'Test brush',
    size: 20,
    opacity: 1.0,
    streamline: 0.3,
    spacing: 0.04,
    jitter: 0,
    texture: 'hard_round',
    pressureSizeFactor: 0.5,
    pressureOpacityFactor: 0.0,
    minSize: 1,
    maxSize: 200,
  };

  const hydrated = hydrateBrush(minimalBrush);

  assert.ok(hydrated.strokePath);
  assert.ok(hydrated.stabilization);
  assert.ok(hydrated.taper);
  assert.ok(hydrated.shape);
  assert.ok(hydrated.grain);
  assert.ok(hydrated.rendering);
  assert.ok(hydrated.wetMix);
  assert.ok(hydrated.colorDynamics);
  assert.ok(hydrated.dynamics);
  assert.ok(hydrated.applePencil);
  assert.ok(hydrated.properties);
  assert.ok(hydrated.materials);
  assert.ok(hydrated.smudge);
});

test('DEFAULT_BRUSH_CATEGORIES contains the 5 requested categories', () => {
  const expected = ['Pencils', 'Air Brushes', 'Inking', 'Caligraphy', 'Textures & Elements'];
  for (const cat of expected) {
    assert.ok(DEFAULT_KRITA_FOLDERS.includes(cat), `Missing category: ${cat}`);
  }
});

test('FACTORY_BRUSH_DEFAULTS initializes with 10 brushes for each of the 5 categories', () => {
  assert.equal(FACTORY_BRUSH_DEFAULTS.length, 50);
  const categories = ['Pencils', 'Air Brushes', 'Inking', 'Caligraphy', 'Textures & Elements'];
  for (const cat of categories) {
    const brushesInCat = FACTORY_BRUSH_DEFAULTS.filter((b) => b.category === cat);
    assert.equal(brushesInCat.length, 10, `Expected 10 brushes in category ${cat}, found ${brushesInCat.length}`);
  }
});

test('parseAbrFile gracefully handles small or empty binary buffers without crashing', async () => {
  const emptyBuffer = new ArrayBuffer(0);
  const res1 = await parseAbrFile(emptyBuffer);
  assert.deepStrictEqual(res1, []);

  // Buffer with valid header version 1
  const validHeader = new ArrayBuffer(4);
  const view = new DataView(validHeader);
  view.setInt16(0, 1);
  view.setInt16(2, 0);
  const res2 = await parseAbrFile(validHeader);
  assert.ok(Array.isArray(res2));
  assert.ok(res2.length > 0);
  assert.strictEqual(res2[0].sourceFormat, 'photoshop');
});

