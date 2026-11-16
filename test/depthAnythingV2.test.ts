import test from 'node:test';
import assert from 'node:assert/strict';
import {
  processDepthLightenDarken,
  processDepthContrast,
  processDepthAutoLevels,
  processDepthInvert,
  processDepthSeed,
  processDepthNoise,
  synthesizeDepthAnythingV2Buffer,
} from '../src/utils/depthAnythingV2';

test('processDepthLightenDarken increases and decreases pixel luminance with clamping', () => {
  const buf = new Uint8ClampedArray([100, 100, 100, 255, 240, 240, 240, 255]);
  processDepthLightenDarken(buf, 30);
  assert.equal(buf[0], 130);
  assert.equal(buf[1], 130);
  assert.equal(buf[2], 130);
  assert.equal(buf[4], 255); // clamped at 255

  // Darken by 50
  processDepthLightenDarken(buf, -50);
  assert.equal(buf[0], 80);
  assert.equal(buf[4], 205);
});

test('processDepthContrast expands dynamic range around midtones with an S-curve', () => {
  // A dark tone (64) and a light tone (192)
  const buf = new Uint8ClampedArray([64, 64, 64, 255, 192, 192, 192, 255]);
  processDepthContrast(buf, 1.4); // increase contrast
  assert.ok(buf[0] < 64, `Dark tone should be darker, got ${buf[0]}`);
  assert.ok(buf[4] > 192, `Light tone should be lighter, got ${buf[4]}`);
});

test('processDepthAutoLevels stretches low-contrast depth maps to full 0..255 dynamic range', () => {
  // Low dynamic range map between 80 and 120
  const buf = new Uint8ClampedArray([
    80, 80, 80, 255,
    100, 100, 100, 255,
    120, 120, 120, 255,
  ]);
  processDepthAutoLevels(buf);
  assert.equal(buf[0], 0, 'Min value should map to 0');
  assert.equal(buf[8], 255, 'Max value should map to 255');
  assert.ok(buf[4] >= 120 && buf[4] <= 135, 'Mid value should map close to 127');
});

test('processDepthInvert accurately flips depth planes', () => {
  const buf = new Uint8ClampedArray([0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255]);
  processDepthInvert(buf);
  assert.equal(buf[0], 255);
  assert.equal(buf[4], 127);
  assert.equal(buf[8], 0);
});

test('processDepthSeed generates deterministic procedural relief variations', () => {
  const w = 32;
  const h = 32;
  const buf1 = new Uint8ClampedArray(w * h * 4);
  const buf2 = new Uint8ClampedArray(w * h * 4);
  const buf3 = new Uint8ClampedArray(w * h * 4);

  processDepthSeed(buf1, w, h, 42);
  processDepthSeed(buf2, w, h, 42);
  processDepthSeed(buf3, w, h, 999);

  // Same seed must produce identical output
  let identical = true;
  for (let i = 0; i < buf1.length; i++) {
    if (buf1[i] !== buf2[i]) {
      identical = false;
      break;
    }
  }
  assert.equal(identical, true, 'Same seed must produce identical depth map');

  // Different seed must produce different output
  let different = false;
  for (let i = 0; i < buf1.length; i += 4) {
    if (buf1[i] !== buf3[i]) {
      different = true;
      break;
    }
  }
  assert.equal(different, true, 'Different seed must produce different depth map');
});

test('processDepthNoise adds micro-relief texture within valid bounds', () => {
  const w = 16;
  const h = 16;
  const buf = new Uint8ClampedArray(w * h * 4);
  buf.fill(128); // start with flat mid-gray

  processDepthNoise(buf, w, h, { intensity: 0.25, type: 'micro_grit', seed: 1234 });

  let hasVariation = false;
  let allInRange = true;
  for (let i = 0; i < buf.length; i += 4) {
    if (buf[i] !== 128) hasVariation = true;
    if (buf[i] < 0 || buf[i] > 255) allInRange = false;
    assert.equal(buf[i], buf[i + 1], 'R and G must match in grayscale depth map');
    assert.equal(buf[i], buf[i + 2], 'R and B must match in grayscale depth map');
  }
  assert.equal(hasVariation, true, 'Noise must produce pixel variations');
  assert.equal(allInRange, true, 'All pixel values must be in [0, 255]');
});

test('synthesizeDepthAnythingV2Buffer processes image data with lineart protection and silhouette volume', () => {
  const w = 24;
  const h = 24;
  const src = new Uint8ClampedArray(w * h * 4);

  // Create a synthetic image with a circle subject and black comic outlines
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const dx = x - w / 2;
      const dy = y - h / 2;
      const dist = Math.hypot(dx, dy);

      if (dist < 8) {
        // Inside subject
        src[idx] = 220; // skin/tone
        src[idx + 1] = 180;
        src[idx + 2] = 150;
        src[idx + 3] = 255;
      } else if (dist < 9) {
        // Black comic outline
        src[idx] = 10;
        src[idx + 1] = 10;
        src[idx + 2] = 10;
        src[idx + 3] = 255;
      } else {
        // Transparent background
        src[idx] = 0;
        src[idx + 1] = 0;
        src[idx + 2] = 0;
        src[idx + 3] = 0;
      }
    }
  }

  const out = new Uint8ClampedArray(w * h * 4);
  synthesizeDepthAnythingV2Buffer(src, out, w, h, {
    autoPuff: 0.7,
    ignoreInkLines: true,
    detailPreservation: 0.8,
  });

  // Center of subject should have higher depth than outside
  const centerIdx = (Math.floor(h / 2) * w + Math.floor(w / 2)) * 4;
  const outsideIdx = 0;

  assert.ok(out[centerIdx] > 100, `Center depth should be elevated, got ${out[centerIdx]}`);
  assert.equal(out[outsideIdx], 0, 'Background should be 0');
});
