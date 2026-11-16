import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSafetensorsHeader,
  processDepthBlur,
  synthesizeDepthAnythingV3Buffer,
} from '../src/utils/depthAnythingV3';

test('parseSafetensorsHeader correctly extracts metadata and tensor shapes from binary buffer', () => {
  // Construct a minimal valid safetensors binary buffer
  const sampleHeader = {
    __metadata__: { format: 'pt', model_type: 'depth_anything_v3_small' },
    'backbone.patch_embed.proj.weight': {
      dtype: 'F32',
      shape: [384, 3, 14, 14],
      data_offsets: [0, 903168],
    },
    'head.depth_pred.weight': {
      dtype: 'F32',
      shape: [1, 256, 1, 1],
      data_offsets: [903168, 904192],
    },
  };

  const headerJson = JSON.stringify(sampleHeader);
  const encoder = new TextEncoder();
  const headerBytes = encoder.encode(headerJson);
  const headerLen = headerBytes.length;

  const totalBuffer = new ArrayBuffer(8 + headerLen + 1024);
  const view = new DataView(totalBuffer);
  view.setUint32(0, headerLen, true);
  view.setUint32(4, 0, true);

  const u8 = new Uint8Array(totalBuffer);
  u8.set(headerBytes, 8);

  const parsed = parseSafetensorsHeader(totalBuffer);
  assert.equal(parsed.headerSize, 8 + headerLen);
  assert.equal(parsed.metadata?.model_type, 'depth_anything_v3_small');
  assert.ok(parsed.tensors['backbone.patch_embed.proj.weight']);
  assert.deepEqual(parsed.tensors['backbone.patch_embed.proj.weight'].shape, [384, 3, 14, 14]);
});

test('processDepthBlur smooths high-frequency steps without darkening outer image borders', () => {
  const w = 10;
  const h = 10;
  const buf = new Uint8ClampedArray(w * h * 4);

  // Initialize with a sharp horizontal step: top half = 50, bottom half = 200
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const val = y < 5 ? 50 : 200;
      buf[idx] = val;
      buf[idx + 1] = val;
      buf[idx + 2] = val;
      buf[idx + 3] = 255;
    }
  }

  // Corner pixel before blur
  assert.equal(buf[0], 50);

  processDepthBlur(buf, w, h, 2);

  // Corner pixel (0,0) must not be darkened below 50 due to border clamping!
  assert.ok(buf[0] >= 50, `Border pixel should be clamped to edge value, got ${buf[0]}`);

  // The step boundary (row 4 and row 5) should be smoothed
  const row4Center = (4 * w + 5) * 4;
  const row5Center = (5 * w + 5) * 4;
  assert.ok(buf[row4Center] > 50, 'Row 4 should blend upward');
  assert.ok(buf[row5Center] < 200, 'Row 5 should blend downward');
});

test('synthesizeDepthAnythingV3Buffer generates high-fidelity relief with lineart shielding', () => {
  const w = 32;
  const h = 32;
  const src = new Uint8ClampedArray(w * h * 4);

  // Fill with a circular subject and black ink outline
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const distFromCenter = Math.hypot(x - 16, y - 16);

      if (distFromCenter <= 12) {
        if (Math.abs(distFromCenter - 10) < 1.0) {
          // Black ink lineart border
          src[idx] = 0;
          src[idx + 1] = 0;
          src[idx + 2] = 0;
          src[idx + 3] = 255;
        } else {
          // Subject body (light color)
          src[idx] = 200;
          src[idx + 1] = 180;
          src[idx + 2] = 160;
          src[idx + 3] = 255;
        }
      } else {
        // Transparent outside
        src[idx] = 0;
        src[idx + 1] = 0;
        src[idx + 2] = 0;
        src[idx + 3] = 0;
      }
    }
  }

  const depthResult = synthesizeDepthAnythingV3Buffer(
    { data: src, width: w, height: h },
    { autoPuff: 0.8, ignoreInkLines: true }
  );

  assert.equal(depthResult.length, w * h * 4);

  // Outside transparent pixel should be at minimum background depth (10)
  assert.equal(depthResult[0], 10);

  // Inside center pixel (16, 16) should have high elevated 3D depth
  const centerIdx = (16 * w + 16) * 4;
  assert.ok(depthResult[centerIdx] > 140, `Center depth should be elevated, got ${depthResult[centerIdx]}`);
});
