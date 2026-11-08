import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMonotonicLut } from '../src/utils/curveSpline.ts';
import JSZip from 'jszip';
import {
  parseProcreateBrush,
  parseProcreateBrushSet,
  parseAbrFile,
  extractBrushNameFromArchive,
} from '../src/utils/brushImporter.ts';
import { renderFastAdjustmentLayer } from '../src/utils/adjustments.ts';

test('Curves Tool - Monotonic Cubic Hermite Spline LUT', () => {
  // Identity line (0,0) -> (255,255)
  const identityLut = generateMonotonicLut([
    { x: 0, y: 0 },
    { x: 255, y: 255 },
  ]);
  assert.equal(identityLut.length, 256);
  assert.equal(identityLut[0], 0);
  assert.equal(identityLut[128], 128);
  assert.equal(identityLut[255], 255);

  // S-Curve High Contrast
  const sCurveLut = generateMonotonicLut([
    { x: 0, y: 0 },
    { x: 64, y: 30 },
    { x: 192, y: 225 },
    { x: 255, y: 255 },
  ]);
  assert.equal(sCurveLut[0], 0);
  assert.equal(sCurveLut[255], 255);
  // S-Curve mid should be around 128
  assert.ok(Math.abs(sCurveLut[128] - 128) < 10);
  // Check monotonicity: each point >= previous point
  for (let i = 1; i < 256; i++) {
    assert.ok(sCurveLut[i] >= sCurveLut[i - 1], `LUT must be monotonic at index ${i}`);
  }
});

test('Procreate Brush Parser - Synthetic .brush Zip Package Extraction', async () => {
  const zip = new JSZip();
  // Add Shape.png dummy data and metadata
  zip.file('Shape.png', 'fake_shape_data');
  zip.file('Grain.png', 'fake_grain_data');

  const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });
  const parsed = await parseProcreateBrush(zipBuffer, 'Custom Procreate Ink');

  assert.ok(parsed !== null, 'Brush parser should return parsed Brush object');
  assert.equal(parsed.name, 'Custom Procreate Ink');
  assert.equal(parsed.category, 'Imported Brushes');
  assert.equal(parsed.sourceFormat, 'procreate');
  assert.equal(parsed.isCustom, true);
  assert.ok(typeof parsed.customStampUrl === 'string');
});

test('Procreate Brushset Parser - Multi-Folder Standard Collection Extraction', async () => {
  const zip = new JSZip();

  // Brush 1 in subfolder
  zip.file('brush_01/Shape.png', 'shape_data_1');
  zip.file('brush_01/Grain.png', 'grain_data_1');
  zip.file('brush_01/brush.archive', '<key>name</key><string>Studio Liner</string>');

  // Brush 2 in subfolder
  zip.file('brush_02/Shape.png', 'shape_data_2');
  zip.file('brush_02/brush.archive', '<key>name</key><string>Soft Watercolor</string>');

  const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });
  const brushes = await parseProcreateBrushSet(zipBuffer, 'Anime Inks');

  assert.equal(brushes.length, 2, 'Should extract both brushes from subfolders');
  assert.equal(brushes[0].name, 'Studio Liner');
  assert.equal(brushes[1].name, 'Soft Watercolor');
  assert.equal(brushes[0].category, 'Imported Brushes');
  assert.equal(brushes[1].category, 'Imported Brushes');
  assert.ok(brushes[0].customStampUrl);
  assert.ok(brushes[1].customStampUrl);
});

test('Archive Name Extractor - XML and Binary Plist', () => {
  const xmlSample = Buffer.from('<plist><dict><key>name</key><string>Dry Ink Shader</string></dict></plist>');
  const name = extractBrushNameFromArchive(xmlSample);
  assert.equal(name, 'Dry Ink Shader');
});

test('Photoshop ABR Parser - Corrupt/Empty Binary Guard', async () => {
  const emptyBuffer = new ArrayBuffer(0);
  const fakeFile = {
    name: 'test.abr',
    arrayBuffer: async () => emptyBuffer,
  } as unknown as File;

  const result = await parseAbrFile(fakeFile);
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});

test('Fast Adjustment Layer - Curves and Color Adjustments Guard', () => {
  // In Node environment without DOM canvas, guard ensures safe return without throwing
  const fakeCanvas = { width: 100, height: 100, getContext: () => null } as unknown as HTMLCanvasElement;
  const result = renderFastAdjustmentLayer(fakeCanvas, {
    type: 'hue_saturation',
    settings: { hue: 45, saturation: 20, lightness: -10 },
  });
  assert.equal(result, fakeCanvas);
});
