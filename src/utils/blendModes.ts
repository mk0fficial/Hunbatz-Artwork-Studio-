/**
 * Hunbatz Artwork Studio — Krita-Parity Blend Mode Engine
 * 
 * Implements ~80+ blending modes categorized exactly as they appear in Krita:
 * Arithmetic, Binary, Darken, Lighten, HSI, HSL, HSV, HSY, Misc, Mix, Negative, Quadratic.
 * 
 * Standard Canvas globalCompositeOperation modes (source-over, multiply, screen, overlay,
 * darken, lighten, color-dodge, color-burn, hard-light, soft-light, difference, exclusion)
 * are handled natively by the canvas API for performance. All other modes use pixel-level math.
 */

// ─── Color Space Conversion Utilities ────────────────────────────────────────

/** Clamp a value to [0, 255] */
function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/** Clamp a value to [0, 1] */
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Convert RGB (0-255) → HSL. Returns [h: 0-360, s: 0-1, l: 0-1] */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) {
    return [0, 0, l];
  }

  let h: number, s: number;
  const d = max - min;
  s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  switch (max) {
    case rn:
      h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
      break;
    case gn:
      h = ((bn - rn) / d + 2) / 6;
      break;
    default: // bn
      h = ((rn - gn) / d + 4) / 6;
      break;
  }

  return [h * 360, s, l];
}

/** Convert RGB (0-255) → HSV. Returns [h: 0-360, s: 0-1, v: 0-1] */
export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const v = max;

  if (min === max) {
    return [0, 0, v];
  }

  const s = (max - min) / max;
  let h: number;

  switch (max) {
    case rn:
      h = ((gn - bn) / (max - min) + (gn < bn ? 6 : 0)) / 6;
      break;
    case gn:
      h = ((bn - rn) / (max - min) + 2) / 6;
      break;
    default: // bn
      h = ((rn - gn) / (max - min) + 4) / 6;
      break;
  }

  return [h * 360, s, v];
}

/** Convert RGB (0-255) → HSI. Returns [h: 0-360, s: 0-1, i: 0-1] */
export function rgbToHsi(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const i = (rn + gn + bn) / 3;

  if (i === 0 || Math.abs(rn - gn) + Math.abs(gn - bn) + Math.abs(bn - rn) < 1e-8) {
    return [0, 0, i];
  }

  const num = 0.5 * ((rn - gn) + (rn - bn));
  const den = Math.sqrt((rn - gn) ** 2 + (rn - bn) * (gn - bn));
  let h = Math.acos(Math.min(1, Math.max(-1, num / (den || 1e-8))));

  if (bn > gn) {
    h = 2 * Math.PI - h;
  }

  const s = 1 - (3 / (i || 1e-8)) * Math.min(rn, gn, bn);
  return [(h / (2 * Math.PI)) * 360, clamp01(s), i];
}

/** Convert RGB (0-255) → HSY (Y = ITU-R BT.601 luminance). Returns [h: 0-360, s: 0-1, y: 0-1] */
export function rgbToHsy(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  // ITU-R BT.601 luminance
  const y = 0.299 * rn + 0.587 * gn + 0.114 * bn;

  if (y === 0) {
    return [0, 0, y];
  }

  const max = Math.max(rn, gn, bn);
  const s = max > 0 ? 1 - (Math.min(rn, gn, bn) / max) : 0;

  let h: number;
  if (max === rn) {
    h = ((gn - bn) / (max - Math.min(rn, gn, bn)) + (gn < bn ? 6 : 0)) * 60;
  } else if (max === gn) {
    h = ((bn - rn) / (max - Math.min(rn, gn, bn)) + 2) * 60;
  } else {
    h = ((rn - gn) / (max - Math.min(rn, gn, bn)) + 4) * 60;
  }

  return [h < 0 ? h + 360 : h, clamp01(s), y];
}

/** Convert HSL → RGB. Returns [r: 0-255, g: 0-255, b: 0-255] */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hr = h / 360;

  return [
    Math.round(hue2rgb(p, q, hr + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, hr) * 255),
    Math.round(hue2rgb(p, q, hr - 1 / 3) * 255),
  ];
}

/** Convert HSV → RGB. Returns [r: 0-255, g: 0-255, b: 0-255] */
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  if (s === 0) {
    const val = Math.round(v * 255);
    return [val, val, val];
  }

  const hi = Math.floor((h / 60) % 6);
  const f = h / 60 - Math.floor(h / 60);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (hi) {
    case 0: return [Math.round(v * 255), Math.round(t * 255), Math.round(p * 255)];
    case 1: return [Math.round(q * 255), Math.round(v * 255), Math.round(p * 255)];
    case 2: return [Math.round(p * 255), Math.round(v * 255), Math.round(t * 255)];
    case 3: return [Math.round(p * 255), Math.round(q * 255), Math.round(v * 255)];
    case 4: return [Math.round(t * 255), Math.round(p * 255), Math.round(v * 255)];
    default: return [Math.round(v * 255), Math.round(p * 255), Math.round(q * 255)];
  }
}

/** Convert HSI → RGB. Returns [r: 0-255, g: 0-255, b: 0-255] */
function hsiToRgb(h: number, s: number, i: number): [number, number, number] {
  const hr = (h / 360) * 2 * Math.PI;

  let r: number, g: number, b: number;

  if (hr < 2 * Math.PI / 3) {
    b = i * (1 - s);
    r = i * (1 + (s * Math.cos(hr)) / Math.cos(Math.PI / 3 - hr));
    g = 3 * i - (r + b);
  } else if (hr < 4 * Math.PI / 3) {
    const h2 = hr - 2 * Math.PI / 3;
    r = i * (1 - s);
    g = i * (1 + (s * Math.cos(h2)) / Math.cos(Math.PI - h2));
    b = 3 * i - (r + g);
  } else {
    const h3 = hr - 4 * Math.PI / 3;
    g = i * (1 - s);
    b = i * (1 + (s * Math.cos(h3)) / Math.cos(5 * Math.PI / 3 - h3));
    r = 3 * i - (g + b);
  }

  return [clamp(r), clamp(g), clamp(b)];
}

/** Convert HSY → RGB. Returns [r: 0-255, g: 0-255, b: 0-255] */
function hsyToRgb(h: number, s: number, y: number): [number, number, number] {
  // Invert HSY: given Y = 0.299R + 0.587G + 0.114B and saturation
  // We approximate by converting to HSV first (close enough for blending)
  const v = y / (s > 0 ? 1 : 0.5); // rough approximation
  return hsvToRgb(h, s, clamp01(v));
}

// ─── Standard Canvas Blend Modes (fast path) ────────────────────────────────

const STANDARD_CANVAS_MODES = new Set([
  'source-over',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
  'destination-out',
]);

// ─── Arithmetic Blend Modes ────────────────────────────────────────────────

function blendArithmetic(
  bottom: number, top: number, a: number, b: number, c: number, d: number
): number {
  // result = a*bottom + b*top + c*bottom*top + d
  const r = a * bottom + b * top + c * bottom * top + d;
  return clamp(Math.round(r));
}

function blendAdd(bottom: number, _top: number): number {
  return clamp(bottom + _top);
}

function blendSubtract(bottom: number, top: number): number {
  return clamp(bottom - top);
}

function blendMultiply(bottom: number, top: number): number {
  return Math.round((bottom * top) / 255);
}

function blendDivide(bottom: number, top: number): number {
  if (top === 0) return bottom;
  const r = bottom * 255 / top;
  return clamp(Math.round(r));
}

function blendInverseSubtract(bottom: number, top: number): number {
  return clamp(top - bottom);
}

// ─── Binary Blend Modes (bitwise on 8-bit integers) ────────────────────────

function blendBinaryBitwise(bottom: number, top: number, op: (a: number, b: number) => number): number {
  return op(bottom, top);
}

const bitwiseAnd = (a: number, b: number) => a & b;
const bitwiseOr = (a: number, b: number) => a | b;
const bitwiseXor = (a: number, b: number) => a ^ b;
const bitwiseNand = (a: number, b: number) => ~(a & b) & 0xFF;
const bitwiseNor = (a: number, b: number) => ~(a | b) & 0xFF;
const bitwiseXnor = (a: number, b: number) => ~(a ^ b) & 0xFF;
const bitwiseImplication = (a: number, b: number) => (~a | b) & 0xFF;
const bitwiseNotImplication = (a: number, b: number) => (~a & b) & 0xFF;
const bitwiseConverse = (a: number, b: number) => (a | ~b) & 0xFF;
const bitwiseNotConverse = (a: number, b: number) => (a & ~b) & 0xFF;

// ─── Darken Blend Modes ────────────────────────────────────────────────────

function blendDarken(bottom: number, top: number): number {
  return Math.min(bottom, top);
}

function blendDarkerColor(bottomR: number, bottomG: number, bottomB: number, topR: number, topG: number, topB: number): [number, number, number] {
  const bottomLum = 0.299 * bottomR + 0.587 * bottomG + 0.114 * bottomB;
  const topLum = 0.299 * topR + 0.587 * topG + 0.114 * topB;
  if (bottomLum <= topLum) return [bottomR, bottomG, bottomB];
  return [topR, topG, topB];
}

function blendLinearBurn(bottom: number, top: number): number {
  return clamp(bottom + top - 255);
}

function blendBurn(bottom: number, top: number): number {
  if (bottom === 255) return top;
  return Math.min(255, 255 - ((255 - bottom) / (top + 1e-8)) * 255);
}

function blendEasyBurn(bottom: number, top: number): number {
  if (bottom === 0 || top === 255) return bottom;
  const result = bottom - (255 - bottom) * top / 255;
  return clamp(Math.round(result));
}

function blendGammaDark(bottom: number, top: number, gamma: number = 1.2): number {
  if (top === 0) return bottom;
  const bNorm = bottom / 255;
  const tNorm = top / 255;
  const result = bNorm - Math.pow(tNorm, gamma);
  return clamp(Math.round(result * 255));
}

function blendFogDarken(bottom: number, top: number, density: number = 0.5): number {
  // IFS Illusions Fog Darken
  const bottomNorm = bottom / 255;
  const topNorm = top / 255;
  const result = bottomNorm - topNorm * density;
  return clamp(Math.round(result * 255));
}

function blendShade(bottom: number, top: number): number {
  // IFS Illusions Shade (same as Burn)
  if (bottom === 255) return top;
  return Math.min(255, 255 - ((255 - bottom) / (top + 1e-8)) * 255);
}

// ─── Lighten Blend Modes ───────────────────────────────────────────────────

function blendLighten(bottom: number, top: number): number {
  return Math.max(bottom, top);
}

function blendColorDodge(bottom: number, top: number): number {
  if (top === 255) return 255;
  const r = bottom * 255 / (255 - top + 1e-8);
  return clamp(Math.min(255, Math.round(r)));
}

function blendLinearDodge(bottom: number, top: number): number {
  // Alias for Add
  return blendAdd(bottom, top);
}

function blendLinearDodgeMinusTwoTimes(bottom: number, top: number): number {
  const r = bottom + top - 255 * 2;
  return clamp(Math.round(r));
}

function blendAddition(bottom: number, top: number): number {
  // Alias for Add
  return blendAdd(bottom, top);
}

function blendNormalLighten(bottom: number, top: number): number {
  if (top <= bottom) return bottom;
  return top;
}

function blendLighterColor(
  bottomR: number, bottomG: number, bottomB: number,
  topR: number, topG: number, topB: number
): [number, number, number] {
  const bLum = 0.299 * bottomR + 0.587 * bottomG + 0.114 * bottomB;
  const tLum = 0.299 * topR + 0.587 * topG + 0.114 * topB;
  return tLum >= bLum ? [topR, topG, topB] : [bottomR, bottomG, bottomB];
}

function blendEasyDodge(bottom: number, top: number): number {
  if (top === 0) return bottom;
  return clamp(Math.round(bottom + (255 - bottom) * (top / 255)));
}

function blendFogLighten(bottom: number, top: number, density: number = 0.5): number {
  return clamp(Math.round(bottom + top * density));
}

function blendGammaLight(bottom: number, top: number, gamma: number = 1.2): number {
  const bNorm = bottom / 255;
  const tNorm = top / 255;
  return clamp(Math.round((bNorm + Math.pow(tNorm, gamma)) * 255));
}

function blendLinearLight(bottom: number, top: number): number {
  return clamp(bottom + 2 * top - 255);
}

function blendPinLight(bottom: number, top: number): number {
  return top > 128 ? Math.max(bottom, 2 * (top - 128)) : Math.min(bottom, 2 * top);
}

function blendVividLight(bottom: number, top: number): number {
  if (top <= 128) {
    if (top === 0) return 0;
    const b2 = 2 * top;
    return clamp(255 - Math.round(((255 - bottom) * 255) / b2));
  } else {
    const d = 2 * (top - 128);
    if (d >= 255) return 255;
    return clamp(Math.round((bottom * 255) / (255 - d)));
  }
}

function blendFlatLight(bottom: number, top: number): number {
  return clamp(Math.round(bottom * 0.5 + top * 0.5 + (bottom * top) / 510));
}

function blendHardMix(bottom: number, top: number): number {
  return (bottom + top) >= 255 ? 255 : 0;
}

function blendSoftLightSvg(bottom: number, top: number): number {
  const b = bottom / 255;
  const t = top / 255;
  let r: number;
  if (t <= 0.5) {
    r = b - (1 - 2 * t) * b * (1 - b);
  } else {
    const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
    r = b + (2 * t - 1) * (d - b);
  }
  return clamp(Math.round(r * 255));
}

function blendSoftLightPs(bottom: number, top: number): number {
  const b = bottom / 255;
  const t = top / 255;
  const r = (1 - 2 * t) * b * b + 2 * t * b;
  return clamp(Math.round(r * 255));
}

// ─── Quadratic Blend Modes ────────────────────────────────────────────────

function blendQuadraticIntersection(bottom: number, top: number): number {
  // min(b, t) * max(b, t) / 255
  const mn = Math.min(bottom, top);
  const mx = Math.max(bottom, top);
  return Math.round((mn * mx) / 255);
}

function blendQuadraticUnion(bottom: number, top: number): number {
  // b + t - (b*t/255) — same as Multiply formula but named differently in some engines
  const result = bottom + top - (bottom * top) / 255;
  return clamp(Math.round(result));
}

function blendQuadraticMultiply(bottom: number, top: number): number {
  // b * t / 255 — same as Multiply
  return Math.round((bottom * top) / 255);
}

function blendQuadraticDivide(bottom: number, top: number): number {
  if (top === 0) return bottom;
  const r = (bottom * 255) / top;
  return clamp(Math.round(r));
}

function blendQuadraticSubtract(bottom: number, top: number): number {
  return clamp(bottom - top);
}

// ─── Mix Blend Modes ──────────────────────────────────────────────────────

function blendModulo(bottom: number, top: number): number {
  if (top === 0) return bottom;
  const r = bottom % top;
  return clamp(Math.round(r));
}

function blendModuloContinuous(bottom: number, top: number): number {
  if (top === 0) return bottom;
  let r = bottom - Math.floor(bottom / top) * top;
  if (r < 0) r += top;
  return clamp(Math.round(r));
}

function blendDivisiveModulo(bottom: number, top: number): number {
  if (top === 0 || top === 255) return bottom;
  const t = top / 255;
  const b = bottom / 255;
  const r = (b % t) / t * 255;
  return clamp(Math.round(r));
}

function blendDivisiveModuloContinuous(bottom: number, top: number): number {
  if (top === 0 || top === 255) return bottom;
  const t = top / 255;
  const b = bottom / 255;
  let r = ((b % t) + t) % t / t * 255;
  if (r < 0) r += 255;
  return clamp(Math.round(r));
}

function blendModuloShift(bottom: number, top: number): number {
  const r = ((bottom >> 1) ^ (top << 1)) & 0xFF;
  return r;
}

function blendModuloShiftContinuous(bottom: number, top: number): number {
  const bNorm = bottom / 255;
  const tNorm = top / 255;
  let shifted = ((bNorm * 128) ^ (tNorm * 128)) & 0x7F;
  if (shifted < 0) shifted += 128;
  return clamp(Math.round((shifted / 127) * 255));
}

// ─── Negative Blend Modes ──────────────────────────────────────────────────

function blendHeat(bottom: number, top: number): number {
  // Simulates heat glow — darker bottom + lighter top = brighter result
  const bNorm = bottom / 255;
  const tNorm = top / 255;
  const result = Math.pow(bNorm, 1 - tNorm) * 255;
  return clamp(Math.round(result));
}

function blendFreeze(bottom: number, top: number): number {
  // Opposite of heat — cooler result
  const bNorm = bottom / 255;
  const tNorm = top / 255;
  const result = Math.pow(bNorm, 1 + tNorm) * 255;
  return clamp(Math.round(result));
}

function blendGlow(bottom: number, top: number): number {
  // Additive glow effect
  const bNorm = bottom / 255;
  const tNorm = top / 255;
  const result = (bNorm + tNorm * (1 - bNorm)) * 255;
  return clamp(Math.round(result));
}

function blendReflect(bottom: number, top: number): number {
  // Reflects bottom through top
  if (top === 0) return 0;
  const result = (bottom * bottom) / top;
  return clamp(Math.min(255, Math.round(result)));
}

function blendHeatGlow(bottom: number, top: number): number {
  // Heat + Glow hybrid
  const bNorm = bottom / 255;
  const tNorm = top / 255;
  const heatResult = Math.pow(bNorm, 1 - tNorm);
  const glowResult = bNorm + tNorm * (1 - bNorm);
  return clamp(Math.round((heatResult * 0.6 + glowResult * 0.4) * 255));
}

function blendFreezeReflect(bottom: number, top: number): number {
  // Freeze + Reflect hybrid
  const bNorm = bottom / 255;
  const tNorm = top / 255;
  if (top === 0) return clamp(Math.round(bNorm * bNorm * 255));
  const freezeResult = Math.pow(bNorm, 1 + tNorm);
  const reflectResult = (bNorm * bNorm) / tNorm;
  return clamp(Math.min(255, Math.round((freezeResult * 0.6 + reflectResult * 0.4) * 255)));
}

function blendHeatGlowFreezeHybrid(bottom: number, top: number): number {
  // Heat-Glow & Freeze-Reflect Hybrid
  const bNorm = bottom / 255;
  const tNorm = top / 255;
  const heatGlow = Math.pow(bNorm, 1 - tNorm) * 0.6 + (bNorm + tNorm * (1 - bNorm)) * 0.4;
  let freezeReflect: number;
  if (top === 0) {
    freezeReflect = bNorm * bNorm;
  } else {
    const fr = Math.pow(bNorm, 1 + tNorm) * 0.6 + ((bNorm * bNorm) / tNorm) * 0.4;
    freezeReflect = Math.min(1, fr);
  }
  return clamp(Math.round((heatGlow * 0.5 + freezeReflect * 0.5) * 255));
}

function blendGlowHeat(bottom: number, top: number): number {
  // Glow-Heat variant
  const bNorm = bottom / 255;
  const tNorm = top / 255;
  return clamp(Math.round((bNorm + tNorm * (1 - bNorm) + Math.pow(bNorm, 1 - tNorm)) * 0.5 * 255));
}

function blendReflectFreeze(bottom: number, top: number): number {
  // Reflect-Freeze variant
  const bNorm = bottom / 255;
  const tNorm = top / 255;
  if (top === 0) return clamp(Math.round(bNorm * bNorm * 255));
  const reflectPart = Math.min(1, (bNorm * bNorm) / tNorm);
  const freezePart = Math.pow(bNorm, 1 + tNorm);
  return clamp(Math.round((reflectPart * 0.6 + freezePart * 0.4) * 255));
}

// ─── HSI Blend Modes (Hue/Saturation/Intensity) ────────────────────────────

function blendHueHSI(_bottomR: number, _bottomG: number, _bottomB: number, topR: number, topG: number, topB: number): [number, number, number] {
  const [bh, bs, bi] = rgbToHsi(_bottomR, _bottomG, _bottomB);
  const [th] = rgbToHsi(topR, topG, topB);
  return hsiToRgb(th, bs, bi);
}

function blendSaturationHSI(bottomR: number, bottomG: number, bottomB: number, topR: number, topG: number, topB: number): [number, number, number] {
  const [bh, , bi] = rgbToHsi(bottomR, bottomG, bottomB);
  const [, ts] = rgbToHsi(topR, topG, topB);
  return hsiToRgb(bh, ts, bi);
}

function blendIncreaseIntensity(bottomR: number, bottomG: number, bottomB: number, topR: number, topG: number, topB: number): [number, number, number] {
  const [, , bi] = rgbToHsi(bottomR, bottomG, bottomB);
  const [, , ti] = rgbToHsi(topR, topG, topB);
  return hsiToRgb(0, 0, clamp01(bi + ti)); // Neutral color with increased intensity
}

function blendDecreaseIntensity(bottomR: number, bottomG: number, bottomB: number, _topR: number, _topG: number, _topB: number): [number, number, number] {
  const [, , bi] = rgbToHsi(bottomR, bottomG, bottomB);
  return hsiToRgb(0, 0, clamp01(bi * 0.5)); // Reduce intensity
}

// ─── HSL Blend Modes ──────────────────────────────────────────────────────

function blendHueHSL(bottomR: number, bottomG: number, bottomB: number, topR: number, topG: number, topB: number): [number, number, number] {
  const [bh, bs, bl] = rgbToHsl(bottomR, bottomG, bottomB);
  const [th] = rgbToHsl(topR, topG, topB);
  return hslToRgb(th, bs, bl);
}

function blendSaturationHSL(bottomR: number, bottomG: number, bottomB: number, topR: number, topG: number, topB: number): [number, number, number] {
  const [bh, , bl] = rgbToHsl(bottomR, bottomG, bottomB);
  const [, ts] = rgbToHsl(topR, topG, topB);
  return hslToRgb(bh, ts, bl);
}

function blendIncreaseLightness(bottomR: number, bottomG: number, bottomB: number, topR: number, topG: number, topB: number): [number, number, number] {
  const [, , bl] = rgbToHsl(bottomR, bottomG, bottomB);
  const [, , tl] = rgbToHsl(topR, topG, topB);
  return hslToRgb(0, 0, clamp01(bl + tl));
}

function blendDecreaseLightness(bottomR: number, bottomG: number, bottomB: number, _topR: number, _topG: number, _topB: number): [number, number, number] {
  const [, , bl] = rgbToHsl(bottomR, bottomG, bottomB);
  return hslToRgb(0, 0, clamp01(bl * 0.5));
}

function blendIncreaseSaturationHSL(bottomR: number, bottomG: number, bottomB: number, topR: number, topG: number, topB: number): [number, number, number] {
  const [bh, , bl] = rgbToHsl(bottomR, bottomG, bottomB);
  const [, ts] = rgbToHsl(topR, topG, topB);
  return hslToRgb(bh, clamp01(ts), bl);
}

function blendDecreaseSaturationHSL(bottomR: number, bottomG: number, bottomB: number, _topR: number, _topG: number, _topB: number): [number, number, number] {
  const [bh, , bl] = rgbToHsl(bottomR, bottomG, bottomB);
  return hslToRgb(bh, 0, bl); // Desaturate to grayscale
}

// ─── HSV Blend Modes ──────────────────────────────────────────────────────

function blendHueHSV(bottomR: number, bottomG: number, bottomB: number, topR: number, topG: number, topB: number): [number, number, number] {
  const [bh, bs, bv] = rgbToHsv(bottomR, bottomG, bottomB);
  const [th] = rgbToHsv(topR, topG, topB);
  return hsvToRgb(th, bs, bv);
}

function blendSaturationHSV(bottomR: number, bottomG: number, bottomB: number, topR: number, topG: number, topB: number): [number, number, number] {
  const [bh, , bv] = rgbToHsv(bottomR, bottomG, bottomB);
  const [, ts] = rgbToHsv(topR, topG, topB);
  return hsvToRgb(bh, ts, bv);
}

function blendIncreaseValue(bottomR: number, bottomG: number, bottomB: number, topR: number, topG: number, topB: number): [number, number, number] {
  const [, , bv] = rgbToHsv(bottomR, bottomG, bottomB);
  const [, , tv] = rgbToHsv(topR, topG, topB);
  return hsvToRgb(0, 0, clamp01(bv + tv));
}

function blendDecreaseValue(bottomR: number, bottomG: number, bottomB: number, _topR: number, _topG: number, _topB: number): [number, number, number] {
  const [, , bv] = rgbToHsv(bottomR, bottomG, bottomB);
  return hsvToRgb(0, 0, clamp01(bv * 0.5));
}

function blendIncreaseSaturationHSV(bottomR: number, bottomG: number, bottomB: number, topR: number, topG: number, topB: number): [number, number, number] {
  const [bh, , bv] = rgbToHsv(bottomR, bottomG, bottomB);
  const [, ts] = rgbToHsv(topR, topG, topB);
  return hsvToRgb(bh, clamp01(ts), bv);
}

function blendDecreaseSaturationHSV(bottomR: number, bottomG: number, bottomB: number, _topR: number, _topG: number, _topB: number): [number, number, number] {
  const [bh, , bv] = rgbToHsv(bottomR, bottomG, bottomB);
  return hsvToRgb(bh, 0, bv); // Desaturate to grayscale
}

// ─── HSY Blend Modes ──────────────────────────────────────────────────────

function blendHueHSY(bottomR: number, bottomG: number, bottomB: number, topR: number, topG: number, topB: number): [number, number, number] {
  const [bh, bs, by] = rgbToHsy(bottomR, bottomG, bottomB);
  const [th] = rgbToHsy(topR, topG, topB);
  return hsyToRgb(th, bs, by);
}

function blendSaturationHSY(bottomR: number, bottomG: number, bottomB: number, topR: number, topG: number, topB: number): [number, number, number] {
  const [bh, , by] = rgbToHsy(bottomR, bottomG, bottomB);
  const [, ts] = rgbToHsy(topR, topG, topB);
  return hsyToRgb(bh, ts, by);
}

function blendIncreaseLuminosityHSY(bottomR: number, bottomG: number, bottomB: number, topR: number, topG: number, topB: number): [number, number, number] {
  const [, , by] = rgbToHsy(bottomR, bottomG, bottomB);
  const [, , ty] = rgbToHsy(topR, topG, topB);
  return hsyToRgb(0, 0, clamp01(by + ty));
}

function blendDecreaseLuminosityHSY(bottomR: number, bottomG: number, bottomB: number, _topR: number, _topG: number, _topB: number): [number, number, number] {
  const [, , by] = rgbToHsy(bottomR, bottomG, bottomB);
  return hsyToRgb(0, 0, clamp01(by * 0.5));
}

function blendIntensityHSI(bottomR: number, bottomG: number, bottomB: number, topR: number, topG: number, topB: number): [number, number, number] {
  const [bh, bs] = rgbToHsi(bottomR, bottomG, bottomB).slice(0, 2) as [number, number];
  const [, , ti] = rgbToHsi(topR, topG, topB);
  return hsiToRgb(bh, bs, ti);
}

function blendIncreaseSaturationHSI(bottomR: number, bottomG: number, bottomB: number, topR: number, topG: number, topB: number): [number, number, number] {
  const [bh, bs, bi] = rgbToHsi(bottomR, bottomG, bottomB);
  const [, ts] = rgbToHsi(topR, topG, topB);
  return hsiToRgb(bh, clamp01(bs + ts), bi);
}

function blendDecreaseSaturationHSI(bottomR: number, bottomG: number, bottomB: number, topR: number, topG: number, topB: number): [number, number, number] {
  const [bh, bs, bi] = rgbToHsi(bottomR, bottomG, bottomB);
  const [, ts] = rgbToHsi(topR, topG, topB);
  return hsiToRgb(bh, clamp01(bs - ts * bs), bi);
}

function blendIncreaseSaturationHSY(bottomR: number, bottomG: number, bottomB: number, topR: number, topG: number, topB: number): [number, number, number] {
  const [bh, bs, by] = rgbToHsy(bottomR, bottomG, bottomB);
  const [, ts] = rgbToHsy(topR, topG, topB);
  return hsyToRgb(bh, clamp01(bs + ts), by);
}

function blendDecreaseSaturationHSY(bottomR: number, bottomG: number, bottomB: number, topR: number, topG: number, topB: number): [number, number, number] {
  const [bh, bs, by] = rgbToHsy(bottomR, bottomG, bottomB);
  const [, ts] = rgbToHsy(topR, topG, topB);
  return hsyToRgb(bh, clamp01(bs - ts * bs), by);
}


// ─── Misc Blend Modes ──────────────────────────────────────────────────────

function blendCopy(bottom: number, top: number): number {
  return top;
}

function blendCopyRed(_bottomR: number, _bottomG: number, _bottomB: number, topR: number, _topG: number, _topB: number): [number, number, number] {
  return [topR, 0, 0];
}

function blendCopyGreen(_bottomR: number, _bottomG: number, _bottomB: number, _topR: number, topG: number, _topB: number): [number, number, number] {
  return [0, topG, 0];
}

function blendCopyBlue(_bottomR: number, _bottomG: number, _bottomB: number, _topR: number, _topG: number, topB: number): [number, number, number] {
  return [0, 0, topB];
}

/** Dissolve: randomly replace pixels based on opacity (simulated by threshold) */
function blendDissolve(bottom: number, top: number, alpha: number = 1.0): number {
  // Deterministic approximation using threshold
  const threshold = alpha * 255;
  return top > threshold ? top : bottom;
}

/** Bumpmap: uses top as height map to offset bottom */
function blendBumpmap(
  bottomR: number, bottomG: number, bottomB: number,
  topR: number, topG: number, topB: number,
  strength: number = 5
): [number, number, number] {
  // Simple bump mapping using luminance of top channel as height
  const height = (topR + topG + topB) / (3 * 255);
  const offset = Math.round((height - 0.5) * strength);

  return [
    clamp(bottomR + offset),
    bottomG,
    bottomB,
  ];
}

/** Combine Normal Map: merges RGB channels as normal vector */
function blendCombineNormalMap(
  bottomR: number, bottomG: number, _bottomB: number,
  topR: number, topG: number, topB: number
): [number, number, number] {
  // Combine R from bottom (X), G from bottom (Y), and create Z from top
  const bx = (bottomR / 127.5) - 1;
  const by = (bottomG / 127.5) - 1;
  const tz = Math.abs(topB / 255);
  const len = Math.sqrt(bx * bx + by * by + tz * tz) || 1;

  return [
    clamp(Math.round((bx / len * 127.5) + 128)),
    clamp(Math.round((by / len * 127.5) + 128)),
    topB,
  ];
}

/** Tangent Normal Map: converts RGB to tangent space normal */
function blendTangentNormalMap(
  bottomR: number, _bottomG: number, _bottomB: number,
  topR: number, topG: number, topB: number
): [number, number, number] {
  // Encode top as tangent X/Y, use bottom for base normal
  const tx = (topR / 127.5) - 1;
  const ty = (topG / 127.5) - 1;
  const tz = Math.sqrt(Math.max(0, 1 - tx * tx - ty * ty));

  return [
    clamp(bottomR),
    clamp(Math.round((tz * 127.5) + 128)),
    topB,
  ];
}

// ─── Public API: Blend Mode Registry & Router ──────────────────────────────

/** All supported blend mode identifiers matching 1-to-1 Krita parity */
export type KritaBlendMode =
  // Standard Canvas modes (fast path)
  | 'source-over' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten'
  | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion'
  | 'destination-out' | 'erase'
  // Arithmetic
  | 'add' | 'subtract' | 'divide' | 'inverse-subtract' | 'multiply-arith'
  // Binary (bitwise per channel)
  | 'and' | 'or' | 'xor' | 'nand' | 'nor' | 'xnor'
  | 'implication' | 'not-implication' | 'converse' | 'not-converse'
  // Darken
  | 'burn' | 'easy-burn' | 'gamma-dark' | 'fog-darken' | 'shade' | 'linear-burn' | 'darker-color'
  // Lighten
  | 'color-dodge-lighten' | 'linear-dodge' | 'linear-dodge-minus-two-times' | 'normal-lighten' | 'addition'
  | 'lighter-color' | 'easy-dodge' | 'fog-lighten' | 'gamma-light' | 'linear-light' | 'pin-light'
  | 'soft-light-svg' | 'soft-light-ps' | 'vivid-light' | 'flat-light' | 'hard-mix'
  // HSI
  | 'hue-hsi' | 'saturation-hsi' | 'increase-intensity-hsi' | 'decrease-intensity-hsi' | 'color-hsi'
  | 'intensity-hsi' | 'increase-saturation-hsi' | 'decrease-saturation-hsi'
  // HSL
  | 'hue-hsl' | 'saturation-hsl' | 'increase-lightness' | 'decrease-lightness' | 'increase-saturation-hsl' | 'decrease-saturation-hsl' | 'color-hsl' | 'lightness'
  // HSV
  | 'hue-hsv' | 'saturation-hsv' | 'increase-value' | 'decrease-value' | 'increase-saturation-hsv' | 'decrease-saturation-hsv' | 'color-hsv' | 'value'
  // HSY
  | 'hue-hsy' | 'saturation-hsy' | 'increase-luminosity' | 'decrease-luminosity' | 'tint' | 'color-hsy' | 'luminosity'
  | 'increase-saturation-hsy' | 'decrease-saturation-hsy'
  // Misc
  | 'copy' | 'copy-red' | 'copy-green' | 'copy-blue' | 'dissolve' | 'bumpmap' | 'combine-normal-map' | 'tangent-normal-map'
  // Mix / Modulo
  | 'modulo' | 'modulo-continuous' | 'divisive-modulo' | 'divisive-modulo-continuous' | 'modulo-shift' | 'modulo-shift-continuous'
  // Negative
  | 'heat' | 'freeze' | 'glow' | 'reflect' | 'heat-glow' | 'freeze-reflect' | 'heat-glow-freeze-hybrid' | 'glow-heat' | 'reflect-freeze'
  // Quadratic
  | 'quadratic-intersection' | 'quadratic-union' | 'quadratic-multiply' | 'quadratic-divide' | 'quadratic-subtract';

/** Check if a blend mode uses the canvas fast path */
export function isStandardCanvasMode(mode: string): boolean {
  return STANDARD_CANVAS_MODES.has(mode);
}

export function getCanvasCompositeOperation(mode: KritaBlendMode | string): GlobalCompositeOperation {
  if (mode === 'erase' || mode === 'destination-out') return 'destination-out';
  if (isStandardCanvasMode(mode)) return mode as GlobalCompositeOperation;
  return 'source-over';
}

/** Krita blend mode name → internal identifier mapping */
export const KRITA_BLEND_MODE_MAP: Record<string, KritaBlendMode> = {
  // Standard & Krita root names
  'normal': 'source-over',
  'erase': 'erase',
  'destination-out': 'erase',
  'linear dodge (add)': 'add',
  'linear burn': 'linear-burn',
  'multiply': 'multiply',
  'color burn': 'color-burn',
  'color dodge': 'color-dodge',
  'lighten': 'lighten',
  'darken': 'darken',
  'difference': 'difference',
  'exclusion': 'exclusion',
  'overlay': 'overlay',
  'soft light': 'soft-light',
  'soft light (svg)': 'soft-light-svg',
  'soft light (photoshop)': 'soft-light-ps',
  'hard light': 'hard-light',
  'vivid light': 'vivid-light',
  'flat light': 'flat-light',
  'hard mix': 'hard-mix',
  'linear light': 'linear-light',
  'pin light': 'pin-light',
  'lighter color': 'lighter-color',
  'easy dodge': 'easy-dodge',
  'fog lighten': 'fog-lighten',
  'fog lighten (ifs illusions)': 'fog-lighten',
  'gamma light': 'gamma-light',

  // Krita CompositeOp XML identifiers
  'composite_over': 'source-over',
  'composite_erase': 'erase',
  'composite_mult': 'multiply',
  'composite_screen': 'screen',
  'composite_overlay': 'overlay',
  'composite_dodge': 'color-dodge',
  'composite_burn': 'color-burn',
  'composite_add': 'add',
  'composite_subtract': 'subtract',
  'composite_divide': 'divide',
  'composite_darken': 'darken',
  'composite_lighten': 'lighten',
  'composite_hard_light': 'hard-light',
  'composite_soft_light_svg': 'soft-light-svg',
  'composite_soft_light_photoshop': 'soft-light-ps',
  'composite_color': 'color-hsy',
  'composite_hue': 'hue-hsy',
  'composite_saturation': 'saturation-hsy',
  'composite_luminous': 'luminosity',
  'composite_luminosity': 'luminosity',
  'composite_and': 'and',
  'composite_or': 'or',
  'composite_xor': 'xor',
  'composite_nand': 'nand',
  'composite_nor': 'nor',
  'composite_xnor': 'xnor',
  'composite_modulo': 'modulo',
  'composite_heat': 'heat',
  'composite_freeze': 'freeze',
  'composite_glow': 'glow',
  'composite_reflect': 'reflect',
  'composite_bumpmap': 'bumpmap',
  'composite_copy': 'copy',
  'composite_dissolve': 'dissolve',

  // Arithmetic
  'add': 'add',
  'addition': 'add',
  'subtract': 'subtract',
  'divide': 'divide',
  'inverse subtract': 'inverse-subtract',
  'inverse-subtract': 'inverse-subtract',

  // Binary
  'and': 'and',
  'or': 'or',
  'xor': 'xor',
  'nand': 'nand',
  'nor': 'nor',
  'xnor': 'xnor',
  'implication': 'implication',
  'not implication': 'not-implication',
  'not-implication': 'not-implication',
  'converse': 'converse',
  'not converse': 'not-converse',
  'not-converse': 'not-converse',

  // Darken
  'burn': 'burn',
  'easy burn': 'easy-burn',
  'easy-burn': 'easy-burn',
  'gamma dark': 'gamma-dark',
  'gamma-dark': 'gamma-dark',
  'fog darken': 'fog-darken',
  'fog darken (ifs illusions)': 'fog-darken',
  'shade': 'shade',
  'shade (ifs illusions)': 'shade',
  'darker color': 'darker-color',
  'darker-color': 'darker-color',

  // Lighten
  'color dodge (lighten)': 'color-dodge',
  'linear dodge': 'linear-dodge',
  'normal lighten': 'normal-lighten',

  // HSI
  'hue hsi': 'hue-hsi',
  'saturation hsi': 'saturation-hsi',
  'increase intensity': 'increase-intensity-hsi',
  'decrease intensity': 'decrease-intensity-hsi',
  'color hsi': 'color-hsi',
  'intensity': 'intensity-hsi',
  'intensity hsi': 'intensity-hsi',
  'increase saturation hsi': 'increase-saturation-hsi',
  'decrease saturation hsi': 'decrease-saturation-hsi',

  // HSL
  'hue hsl': 'hue-hsl',
  'saturation hsl': 'saturation-hsl',
  'increase lightness': 'increase-lightness',
  'decrease lightness': 'decrease-lightness',
  'increase saturation hsl': 'increase-saturation-hsl',
  'decrease saturation hsl': 'decrease-saturation-hsl',
  'color hsl': 'color-hsl',
  'lightness': 'lightness',

  // HSV
  'hue hsv': 'hue-hsv',
  'saturation hsv': 'saturation-hsv',
  'increase value': 'increase-value',
  'decrease value': 'decrease-value',
  'increase saturation hsv': 'increase-saturation-hsv',
  'decrease saturation hsv': 'decrease-saturation-hsv',
  'color hsv': 'color-hsv',
  'value': 'value',

  // HSY
  'hue hsy': 'hue-hsy',
  'hue': 'hue-hsy',
  'saturation hsy': 'saturation-hsy',
  'saturation': 'saturation-hsy',
  'increase luminosity': 'increase-luminosity',
  'decrease luminosity': 'decrease-luminosity',
  'increase saturation': 'increase-saturation-hsy',
  'decrease saturation': 'decrease-saturation-hsy',
  'tint': 'tint',
  'color hsy': 'color-hsy',
  'color': 'color-hsy',
  'luminosity': 'luminosity',

  // Misc
  'copy': 'copy',
  'copy red': 'copy-red',
  'copy-red': 'copy-red',
  'copy green': 'copy-green',
  'copy-green': 'copy-green',
  'copy blue': 'copy-blue',
  'copy-blue': 'copy-blue',
  'dissolve': 'dissolve',
  'bumpmap': 'bumpmap',
  'combine normal map': 'combine-normal-map',
  'combine-normal-map': 'combine-normal-map',
  'tangent normal map': 'tangent-normal-map',
  'tangent normalmap': 'tangent-normal-map',
  'tangent-normal-map': 'tangent-normal-map',

  // Mix
  'modulo': 'modulo',
  'modulo - continuous': 'modulo-continuous',
  'modulo-continuous': 'modulo-continuous',
  'divisive modulo': 'divisive-modulo',
  'divisive-modulo': 'divisive-modulo',
  'divisive modulo - continuous': 'divisive-modulo-continuous',
  'divisive-modulo-continuous': 'divisive-modulo-continuous',
  'modulo shift': 'modulo-shift',
  'modulo-shift': 'modulo-shift',
  'modulo shift - continuous': 'modulo-shift-continuous',
  'modulo-shift-continuous': 'modulo-shift-continuous',

  // Negative
  'heat': 'heat',
  'freeze': 'freeze',
  'glow': 'glow',
  'reflect': 'reflect',
  'heat-glow': 'heat-glow',
  'freeze-reflect': 'freeze-reflect',
  'heat-glow & freeze-reflect hybrid': 'heat-glow-freeze-hybrid',
  'glow-heat': 'glow-heat',
  'reflect-freeze': 'reflect-freeze',

  // Quadratic
  'quadratic intersection': 'quadratic-intersection',
  'quadratic-intersection': 'quadratic-intersection',
  'quadratic union': 'quadratic-union',
  'quadratic-union': 'quadratic-union',
  'quadratic multiply': 'quadratic-multiply',
  'quadratic-multiply': 'quadratic-multiply',
  'quadratic divide': 'quadratic-divide',
  'quadratic-divide': 'quadratic-divide',
  'quadratic subtract': 'quadratic-subtract',
  'quadratic-subtract': 'quadratic-subtract',
};

/** Resolve a Krita blend mode name to our internal identifier */
export function resolveKritaBlendMode(name: string): KritaBlendMode {
  if (!name) return 'source-over';
  const lower = name.toLowerCase().replace(/[\-_]/g, ' ').replace(/\s+/g, ' ').trim();
  const rawLower = name.toLowerCase().trim();
  return (
    KRITA_BLEND_MODE_MAP[rawLower] ??
    KRITA_BLEND_MODE_MAP[lower] ??
    ('source-over' as KritaBlendMode)
  );
}

/** Blend mode category for UI grouping matching Krita */
export type BlendModeCategory =
  | 'favorites'
  | 'arithmetic'
  | 'binary'
  | 'darken'
  | 'hsi'
  | 'hsl'
  | 'hsv'
  | 'hsy'
  | 'lighten'
  | 'misc'
  | 'mix'
  | 'negative'
  | 'quadratic';

export interface KritaBlendModeItem {
  id: KritaBlendMode;
  name: string;
  category: BlendModeCategory;
}

/** 1-to-1 Krita Blend Modes by Category matching Krita interface */
export const KRITA_BLEND_MODE_GROUPS: Record<BlendModeCategory, KritaBlendModeItem[]> = {
  favorites: [
    { id: 'add', name: 'Addition', category: 'favorites' },
    { id: 'burn', name: 'Burn', category: 'favorites' },
    { id: 'color-hsy', name: 'Color', category: 'favorites' },
    { id: 'color-dodge', name: 'Color Dodge', category: 'favorites' },
    { id: 'darken', name: 'Darken', category: 'favorites' },
    { id: 'divide', name: 'Divide', category: 'favorites' },
    { id: 'erase', name: 'Erase', category: 'favorites' },
    { id: 'lighten', name: 'Lighten', category: 'favorites' },
    { id: 'luminosity', name: 'Luminosity', category: 'favorites' },
    { id: 'multiply', name: 'Multiply', category: 'favorites' },
    { id: 'source-over', name: 'Normal', category: 'favorites' },
    { id: 'overlay', name: 'Overlay', category: 'favorites' },
    { id: 'saturation-hsy', name: 'Saturation', category: 'favorites' },
    { id: 'screen', name: 'Screen', category: 'favorites' },
    { id: 'soft-light-svg', name: 'Soft Light (SVG)', category: 'favorites' },
  ],
  arithmetic: [
    { id: 'add', name: 'Addition', category: 'arithmetic' },
    { id: 'divide', name: 'Divide', category: 'arithmetic' },
    { id: 'inverse-subtract', name: 'Inverse Subtract', category: 'arithmetic' },
    { id: 'multiply', name: 'Multiply', category: 'arithmetic' },
    { id: 'subtract', name: 'Subtract', category: 'arithmetic' },
  ],
  binary: [
    { id: 'and', name: 'AND', category: 'binary' },
    { id: 'converse', name: 'CONVERSE', category: 'binary' },
    { id: 'implication', name: 'IMPLICATION', category: 'binary' },
    { id: 'nand', name: 'NAND', category: 'binary' },
    { id: 'nor', name: 'NOR', category: 'binary' },
    { id: 'not-converse', name: 'NOT CONVERSE', category: 'binary' },
    { id: 'not-implication', name: 'NOT IMPLICATION', category: 'binary' },
    { id: 'or', name: 'OR', category: 'binary' },
    { id: 'xnor', name: 'XNOR', category: 'binary' },
    { id: 'xor', name: 'XOR', category: 'binary' },
  ],
  darken: [
    { id: 'burn', name: 'Burn', category: 'darken' },
    { id: 'darken', name: 'Darken', category: 'darken' },
    { id: 'darker-color', name: 'Darker Color', category: 'darken' },
    { id: 'easy-burn', name: 'Easy Burn', category: 'darken' },
    { id: 'fog-darken', name: 'Fog Darken (IFS Illusions)', category: 'darken' },
    { id: 'gamma-dark', name: 'Gamma Dark', category: 'darken' },
    { id: 'linear-burn', name: 'Linear Burn', category: 'darken' },
    { id: 'shade', name: 'Shade (IFS Illusions)', category: 'darken' },
  ],
  hsi: [
    { id: 'color-hsi', name: 'Color HSI', category: 'hsi' },
    { id: 'decrease-intensity-hsi', name: 'Decrease Intensity', category: 'hsi' },
    { id: 'decrease-saturation-hsi', name: 'Decrease Saturation HSI', category: 'hsi' },
    { id: 'hue-hsi', name: 'Hue HSI', category: 'hsi' },
    { id: 'increase-intensity-hsi', name: 'Increase Intensity', category: 'hsi' },
    { id: 'increase-saturation-hsi', name: 'Increase Saturation HSI', category: 'hsi' },
    { id: 'intensity-hsi', name: 'Intensity', category: 'hsi' },
    { id: 'saturation-hsi', name: 'Saturation HSI', category: 'hsi' },
  ],
  hsl: [
    { id: 'color-hsl', name: 'Color HSL', category: 'hsl' },
    { id: 'decrease-lightness', name: 'Decrease Lightness', category: 'hsl' },
    { id: 'decrease-saturation-hsl', name: 'Decrease Saturation HSL', category: 'hsl' },
    { id: 'hue-hsl', name: 'Hue HSL', category: 'hsl' },
    { id: 'increase-lightness', name: 'Increase Lightness', category: 'hsl' },
    { id: 'increase-saturation-hsl', name: 'Increase Saturation HSL', category: 'hsl' },
    { id: 'lightness', name: 'Lightness', category: 'hsl' },
    { id: 'saturation-hsl', name: 'Saturation HSL', category: 'hsl' },
  ],
  hsv: [
    { id: 'color-hsv', name: 'Color HSV', category: 'hsv' },
    { id: 'decrease-saturation-hsv', name: 'Decrease Saturation HSV', category: 'hsv' },
    { id: 'decrease-value', name: 'Decrease Value', category: 'hsv' },
    { id: 'hue-hsv', name: 'Hue HSV', category: 'hsv' },
    { id: 'increase-saturation-hsv', name: 'Increase Saturation HSV', category: 'hsv' },
    { id: 'increase-value', name: 'Increase Value', category: 'hsv' },
    { id: 'saturation-hsv', name: 'Saturation HSV', category: 'hsv' },
    { id: 'value', name: 'Value', category: 'hsv' },
  ],
  hsy: [
    { id: 'color-hsy', name: 'Color', category: 'hsy' },
    { id: 'decrease-luminosity', name: 'Decrease Luminosity', category: 'hsy' },
    { id: 'decrease-saturation-hsy', name: 'Decrease Saturation', category: 'hsy' },
    { id: 'hue-hsy', name: 'Hue', category: 'hsy' },
    { id: 'increase-luminosity', name: 'Increase Luminosity', category: 'hsy' },
    { id: 'increase-saturation-hsy', name: 'Increase Saturation', category: 'hsy' },
    { id: 'luminosity', name: 'Luminosity', category: 'hsy' },
    { id: 'saturation-hsy', name: 'Saturation', category: 'hsy' },
    { id: 'tint', name: 'Tint', category: 'hsy' },
  ],
  lighten: [
    { id: 'color-dodge', name: 'Color Dodge', category: 'lighten' },
    { id: 'lighten', name: 'Lighten', category: 'lighten' },
    { id: 'lighter-color', name: 'Lighter Color', category: 'lighten' },
    { id: 'easy-dodge', name: 'Easy Dodge', category: 'lighten' },
    { id: 'fog-lighten', name: 'Fog Lighten (IFS Illusions)', category: 'lighten' },
    { id: 'gamma-light', name: 'Gamma Light', category: 'lighten' },
    { id: 'linear-dodge', name: 'Linear Dodge', category: 'lighten' },
    { id: 'linear-light', name: 'Linear Light', category: 'lighten' },
    { id: 'pin-light', name: 'Pin Light', category: 'lighten' },
    { id: 'screen', name: 'Screen', category: 'lighten' },
    { id: 'soft-light-svg', name: 'Soft Light (SVG)', category: 'lighten' },
    { id: 'soft-light-ps', name: 'Soft Light (Photoshop)', category: 'lighten' },
    { id: 'vivid-light', name: 'Vivid Light', category: 'lighten' },
    { id: 'flat-light', name: 'Flat Light', category: 'lighten' },
    { id: 'hard-light', name: 'Hard Light', category: 'lighten' },
    { id: 'hard-mix', name: 'Hard Mix', category: 'lighten' },
  ],
  misc: [
    { id: 'bumpmap', name: 'Bumpmap', category: 'misc' },
    { id: 'combine-normal-map', name: 'Combine Normal Map', category: 'misc' },
    { id: 'copy', name: 'Copy', category: 'misc' },
    { id: 'copy-blue', name: 'Copy Blue', category: 'misc' },
    { id: 'copy-green', name: 'Copy Green', category: 'misc' },
    { id: 'copy-red', name: 'Copy Red', category: 'misc' },
    { id: 'dissolve', name: 'Dissolve', category: 'misc' },
    { id: 'tangent-normal-map', name: 'Tangent Normalmap', category: 'misc' },
  ],
  mix: [
    { id: 'divisive-modulo', name: 'Divisive Modulo', category: 'mix' },
    { id: 'divisive-modulo-continuous', name: 'Divisive Modulo - Continuous', category: 'mix' },
    { id: 'modulo', name: 'Modulo', category: 'mix' },
    { id: 'modulo-continuous', name: 'Modulo - Continuous', category: 'mix' },
    { id: 'modulo-shift', name: 'Modulo Shift', category: 'mix' },
    { id: 'modulo-shift-continuous', name: 'Modulo Shift - Continuous', category: 'mix' },
  ],
  negative: [
    { id: 'freeze', name: 'Freeze', category: 'negative' },
    { id: 'freeze-reflect', name: 'Freeze-Reflect', category: 'negative' },
    { id: 'glow', name: 'Glow', category: 'negative' },
    { id: 'glow-heat', name: 'Glow-Heat', category: 'negative' },
    { id: 'heat', name: 'Heat', category: 'negative' },
    { id: 'heat-glow', name: 'Heat-Glow', category: 'negative' },
    { id: 'heat-glow-freeze-hybrid', name: 'Heat-Glow & Freeze-Reflect Hybrid', category: 'negative' },
    { id: 'reflect', name: 'Reflect', category: 'negative' },
    { id: 'reflect-freeze', name: 'Reflect-Freeze', category: 'negative' },
  ],
  quadratic: [
    { id: 'quadratic-intersection', name: 'Quadratic Intersection', category: 'quadratic' },
    { id: 'quadratic-union', name: 'Quadratic Union', category: 'quadratic' },
    { id: 'quadratic-multiply', name: 'Quadratic Multiply', category: 'quadratic' },
    { id: 'quadratic-divide', name: 'Quadratic Divide', category: 'quadratic' },
    { id: 'quadratic-subtract', name: 'Quadratic Subtract', category: 'quadratic' },
  ],
};

/** Default 15 Krita Favorites matching Krita interface */
export const DEFAULT_FAVORITE_BLEND_MODES: KritaBlendMode[] = [
  'add',
  'burn',
  'color-hsy',
  'color-dodge',
  'darken',
  'divide',
  'erase',
  'lighten',
  'luminosity',
  'multiply',
  'source-over',
  'overlay',
  'saturation-hsy',
  'screen',
  'soft-light-svg',
];

export function getStoredFavoriteBlendModes(): KritaBlendMode[] {
  try {
    const raw = localStorage.getItem('hunbatz_krita_favorite_blend_modes');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [...DEFAULT_FAVORITE_BLEND_MODES];
}

export function saveStoredFavoriteBlendModes(favs: KritaBlendMode[]): void {
  try {
    localStorage.setItem('hunbatz_krita_favorite_blend_modes', JSON.stringify(favs));
  } catch {}
}

/** Category assignment for each blend mode */
export const BLEND_MODE_CATEGORIES: Record<KritaBlendMode, BlendModeCategory> = {
  // Favorites / Root
  'source-over': 'favorites',
  'multiply': 'favorites',
  'screen': 'favorites',
  'overlay': 'favorites',
  'darken': 'favorites',
  'lighten': 'favorites',
  'color-dodge': 'favorites',
  'color-burn': 'favorites',
  'hard-light': 'favorites',
  'soft-light': 'favorites',
  'difference': 'favorites',
  'exclusion': 'favorites',
  'destination-out': 'favorites',
  'erase': 'favorites',

  // Arithmetic
  'add': 'arithmetic',
  'subtract': 'arithmetic',
  'divide': 'arithmetic',
  'inverse-subtract': 'arithmetic',
  'multiply-arith': 'arithmetic',

  // Binary
  'and': 'binary',
  'or': 'binary',
  'xor': 'binary',
  'nand': 'binary',
  'nor': 'binary',
  'xnor': 'binary',
  'implication': 'binary',
  'not-implication': 'binary',
  'converse': 'binary',
  'not-converse': 'binary',

  // Darken
  'burn': 'darken',
  'easy-burn': 'darken',
  'gamma-dark': 'darken',
  'fog-darken': 'darken',
  'shade': 'darken',
  'linear-burn': 'darken',
  'darker-color': 'darken',

  // Lighten
  'color-dodge-lighten': 'lighten',
  'linear-dodge': 'lighten',
  'linear-dodge-minus-two-times': 'lighten',
  'normal-lighten': 'lighten',
  'addition': 'lighten',
  'lighter-color': 'lighten',
  'easy-dodge': 'lighten',
  'fog-lighten': 'lighten',
  'gamma-light': 'lighten',
  'linear-light': 'lighten',
  'pin-light': 'lighten',
  'soft-light-svg': 'lighten',
  'soft-light-ps': 'lighten',
  'vivid-light': 'lighten',
  'flat-light': 'lighten',
  'hard-mix': 'lighten',

  // HSI
  'hue-hsi': 'hsi',
  'saturation-hsi': 'hsi',
  'increase-intensity-hsi': 'hsi',
  'decrease-intensity-hsi': 'hsi',
  'color-hsi': 'hsi',
  'intensity-hsi': 'hsi',
  'increase-saturation-hsi': 'hsi',
  'decrease-saturation-hsi': 'hsi',

  // HSL
  'hue-hsl': 'hsl',
  'saturation-hsl': 'hsl',
  'increase-lightness': 'hsl',
  'decrease-lightness': 'hsl',
  'increase-saturation-hsl': 'hsl',
  'decrease-saturation-hsl': 'hsl',
  'color-hsl': 'hsl',
  'lightness': 'hsl',

  // HSV
  'hue-hsv': 'hsv',
  'saturation-hsv': 'hsv',
  'increase-value': 'hsv',
  'decrease-value': 'hsv',
  'increase-saturation-hsv': 'hsv',
  'decrease-saturation-hsv': 'hsv',
  'color-hsv': 'hsv',
  'value': 'hsv',

  // HSY
  'hue-hsy': 'hsy',
  'saturation-hsy': 'hsy',
  'increase-luminosity': 'hsy',
  'decrease-luminosity': 'hsy',
  'tint': 'hsy',
  'color-hsy': 'hsy',
  'luminosity': 'hsy',
  'increase-saturation-hsy': 'hsy',
  'decrease-saturation-hsy': 'hsy',

  // Misc
  'copy': 'misc',
  'copy-red': 'misc',
  'copy-green': 'misc',
  'copy-blue': 'misc',
  'dissolve': 'misc',
  'bumpmap': 'misc',
  'combine-normal-map': 'misc',
  'tangent-normal-map': 'misc',

  // Mix
  'modulo': 'mix',
  'modulo-continuous': 'mix',
  'divisive-modulo': 'mix',
  'divisive-modulo-continuous': 'mix',
  'modulo-shift': 'mix',
  'modulo-shift-continuous': 'mix',

  // Negative
  'heat': 'negative',
  'freeze': 'negative',
  'glow': 'negative',
  'reflect': 'negative',
  'heat-glow': 'negative',
  'freeze-reflect': 'negative',
  'heat-glow-freeze-hybrid': 'negative',
  'glow-heat': 'negative',
  'reflect-freeze': 'negative',

  // Quadratic
  'quadratic-intersection': 'quadratic',
  'quadratic-union': 'quadratic',
  'quadratic-multiply': 'quadratic',
  'quadratic-divide': 'quadratic',
  'quadratic-subtract': 'quadratic',
};

/** Human-readable label for each blend mode */
export const BLEND_MODE_LABELS: Record<KritaBlendMode, string> = {
  // Favorites / Root
  'source-over': 'Normal',
  'multiply': 'Multiply',
  'screen': 'Screen',
  'overlay': 'Overlay',
  'darken': 'Darken',
  'lighten': 'Lighten',
  'color-dodge': 'Color Dodge',
  'color-burn': 'Color Burn',
  'hard-light': 'Hard Light',
  'soft-light': 'Soft Light',
  'difference': 'Difference',
  'exclusion': 'Exclusion',
  'destination-out': 'Erase',
  'erase': 'Erase',

  // Arithmetic
  'add': 'Addition',
  'subtract': 'Subtract',
  'divide': 'Divide',
  'inverse-subtract': 'Inverse Subtract',
  'multiply-arith': 'Multiply',

  // Binary
  'and': 'AND',
  'or': 'OR',
  'xor': 'XOR',
  'nand': 'NAND',
  'nor': 'NOR',
  'xnor': 'XNOR',
  'implication': 'IMPLICATION',
  'not-implication': 'NOT IMPLICATION',
  'converse': 'CONVERSE',
  'not-converse': 'NOT CONVERSE',

  // Darken
  'burn': 'Burn',
  'easy-burn': 'Easy Burn',
  'gamma-dark': 'Gamma Dark',
  'fog-darken': 'Fog Darken (IFS Illusions)',
  'shade': 'Shade (IFS Illusions)',
  'linear-burn': 'Linear Burn',
  'darker-color': 'Darker Color',

  // Lighten
  'color-dodge-lighten': 'Color Dodge',
  'linear-dodge': 'Linear Dodge',
  'linear-dodge-minus-two-times': 'Linear Dodge (-2×)',
  'normal-lighten': 'Normal Lighten',
  'addition': 'Addition',
  'lighter-color': 'Lighter Color',
  'easy-dodge': 'Easy Dodge',
  'fog-lighten': 'Fog Lighten (IFS Illusions)',
  'gamma-light': 'Gamma Light',
  'linear-light': 'Linear Light',
  'pin-light': 'Pin Light',
  'soft-light-svg': 'Soft Light (SVG)',
  'soft-light-ps': 'Soft Light (Photoshop)',
  'vivid-light': 'Vivid Light',
  'flat-light': 'Flat Light',
  'hard-mix': 'Hard Mix',

  // HSI
  'hue-hsi': 'Hue HSI',
  'saturation-hsi': 'Saturation HSI',
  'increase-intensity-hsi': 'Increase Intensity',
  'decrease-intensity-hsi': 'Decrease Intensity',
  'color-hsi': 'Color HSI',
  'intensity-hsi': 'Intensity',
  'increase-saturation-hsi': 'Increase Saturation HSI',
  'decrease-saturation-hsi': 'Decrease Saturation HSI',

  // HSL
  'hue-hsl': 'Hue HSL',
  'saturation-hsl': 'Saturation HSL',
  'increase-lightness': 'Increase Lightness',
  'decrease-lightness': 'Decrease Lightness',
  'increase-saturation-hsl': 'Increase Saturation HSL',
  'decrease-saturation-hsl': 'Decrease Saturation HSL',
  'color-hsl': 'Color HSL',
  'lightness': 'Lightness',

  // HSV
  'hue-hsv': 'Hue HSV',
  'saturation-hsv': 'Saturation HSV',
  'increase-value': 'Increase Value',
  'decrease-value': 'Decrease Value',
  'increase-saturation-hsv': 'Increase Saturation HSV',
  'decrease-saturation-hsv': 'Decrease Saturation HSV',
  'color-hsv': 'Color HSV',
  'value': 'Value',

  // HSY
  'hue-hsy': 'Hue',
  'saturation-hsy': 'Saturation',
  'increase-luminosity': 'Increase Luminosity',
  'decrease-luminosity': 'Decrease Luminosity',
  'tint': 'Tint',
  'color-hsy': 'Color',
  'luminosity': 'Luminosity',
  'increase-saturation-hsy': 'Increase Saturation',
  'decrease-saturation-hsy': 'Decrease Saturation',

  // Misc
  'copy': 'Copy',
  'copy-red': 'Copy Red',
  'copy-green': 'Copy Green',
  'copy-blue': 'Copy Blue',
  'dissolve': 'Dissolve',
  'bumpmap': 'Bumpmap',
  'combine-normal-map': 'Combine Normal Map',
  'tangent-normal-map': 'Tangent Normalmap',

  // Mix
  'modulo': 'Modulo',
  'modulo-continuous': 'Modulo - Continuous',
  'divisive-modulo': 'Divisive Modulo',
  'divisive-modulo-continuous': 'Divisive Modulo - Continuous',
  'modulo-shift': 'Modulo Shift',
  'modulo-shift-continuous': 'Modulo Shift - Continuous',

  // Negative
  'heat': 'Heat',
  'freeze': 'Freeze',
  'glow': 'Glow',
  'reflect': 'Reflect',
  'heat-glow': 'Heat-Glow',
  'freeze-reflect': 'Freeze-Reflect',
  'heat-glow-freeze-hybrid': 'Heat-Glow & Freeze-Reflect Hybrid',
  'glow-heat': 'Glow-Heat',
  'reflect-freeze': 'Reflect-Freeze',

  // Quadratic
  'quadratic-intersection': 'Quadratic Intersection',
  'quadratic-union': 'Quadratic Union',
  'quadratic-multiply': 'Quadratic Multiply',
  'quadratic-divide': 'Quadratic Divide',
  'quadratic-subtract': 'Quadratic Subtract',
};

/** Category display names for UI */
export const CATEGORY_LABELS: Record<BlendModeCategory, string> = {
  'favorites': 'Favorites',
  'arithmetic': 'Arithmetic',
  'binary': 'Binary',
  'darken': 'Darken',
  'hsi': 'HSI',
  'hsl': 'HSL',
  'hsv': 'HSV',
  'hsy': 'HSY',
  'lighten': 'Lighten',
  'misc': 'Misc',
  'mix': 'Mix / Modulo',
  'negative': 'Negative',
  'quadratic': 'Quadratic',
};

/** Category sort order matching Krita hierarchy */
export const CATEGORY_ORDER: BlendModeCategory[] = [
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

// ─── Pixel-Level Compositing Engine ────────────────────────────────────────

interface BlendResult {
  r: number;
  g: number;
  b: number;
}

function tupleToResult([r, g, b]: [number, number, number]): BlendResult {
  return { r: clamp(Math.round(r)), g: clamp(Math.round(g)), b: clamp(Math.round(b)) };
}

/**
 * Core pixel blending function. Takes bottom and top RGB values (0-255)
 * and returns the blended result. Uses canvas fast path for standard modes,
 * custom math for everything else.
 */
export function blendPixel(
  mode: KritaBlendMode | string,
  bottomR: number,
  bottomG: number,
  bottomB: number,
  topR: number,
  topG: number,
  topB: number,
  alpha: number = 1.0
): BlendResult {
  // Standard canvas modes use native compositing (handled externally)
  if (isStandardCanvasMode(mode)) {
    return { r: topR, g: topG, b: topB };
  }

  const m = mode as KritaBlendMode;

  switch (m) {
    // ─── Arithmetic ──────────────────────────────────────────────
    case 'add':
      return { r: blendAdd(bottomR, topR), g: blendAdd(bottomG, topG), b: blendAdd(bottomB, topB) };
    case 'subtract':
      return { r: blendSubtract(bottomR, topR), g: blendSubtract(bottomG, topG), b: blendSubtract(bottomB, topB) };
    case 'divide':
      return { r: blendDivide(bottomR, topR), g: blendDivide(bottomG, topG), b: blendDivide(bottomB, topB) };
    case 'inverse-subtract':
      return { r: blendInverseSubtract(bottomR, topR), g: blendInverseSubtract(bottomG, topG), b: blendInverseSubtract(bottomB, topB) };
    case 'multiply-arith':
      return { r: Math.round(bottomR * topR / 255), g: Math.round(bottomG * topG / 255), b: Math.round(bottomB * topB / 255) };

    // ─── Binary (bitwise per channel) ────────────────────────────
    case 'and':
      return { r: blendBinaryBitwise(bottomR, topR, bitwiseAnd), g: blendBinaryBitwise(bottomG, topG, bitwiseAnd), b: blendBinaryBitwise(bottomB, topB, bitwiseAnd) };
    case 'or':
      return { r: blendBinaryBitwise(bottomR, topR, bitwiseOr), g: blendBinaryBitwise(bottomG, topG, bitwiseOr), b: blendBinaryBitwise(bottomB, topB, bitwiseOr) };
    case 'xor':
      return { r: blendBinaryBitwise(bottomR, topR, bitwiseXor), g: blendBinaryBitwise(bottomG, topG, bitwiseXor), b: blendBinaryBitwise(bottomB, topB, bitwiseXor) };
    case 'nand':
      return { r: blendBinaryBitwise(bottomR, topR, bitwiseNand), g: blendBinaryBitwise(bottomG, topG, bitwiseNand), b: blendBinaryBitwise(bottomB, topB, bitwiseNand) };
    case 'nor':
      return { r: blendBinaryBitwise(bottomR, topR, bitwiseNor), g: blendBinaryBitwise(bottomG, topG, bitwiseNor), b: blendBinaryBitwise(bottomB, topB, bitwiseNor) };
    case 'xnor':
      return { r: blendBinaryBitwise(bottomR, topR, bitwiseXnor), g: blendBinaryBitwise(bottomG, topG, bitwiseXnor), b: blendBinaryBitwise(bottomB, topB, bitwiseXnor) };
    case 'implication':
      return { r: blendBinaryBitwise(bottomR, topR, bitwiseImplication), g: blendBinaryBitwise(bottomG, topG, bitwiseImplication), b: blendBinaryBitwise(bottomB, topB, bitwiseImplication) };
    case 'not-implication':
      return { r: blendBinaryBitwise(bottomR, topR, bitwiseNotImplication), g: blendBinaryBitwise(bottomG, topG, bitwiseNotImplication), b: blendBinaryBitwise(bottomB, topB, bitwiseNotImplication) };
    case 'converse':
      return { r: blendBinaryBitwise(bottomR, topR, bitwiseConverse), g: blendBinaryBitwise(bottomG, topG, bitwiseConverse), b: blendBinaryBitwise(bottomB, topB, bitwiseConverse) };
    case 'not-converse':
      return { r: blendBinaryBitwise(bottomR, topR, bitwiseNotConverse), g: blendBinaryBitwise(bottomG, topG, bitwiseNotConverse), b: blendBinaryBitwise(bottomB, topB, bitwiseNotConverse) };

    // ─── Darken ──────────────────────────────────────────────────
    case 'burn':
      return { r: blendBurn(bottomR, topR), g: blendBurn(bottomG, topG), b: blendBurn(bottomB, topB) };
    case 'easy-burn':
      return { r: blendEasyBurn(bottomR, topR), g: blendEasyBurn(bottomG, topG), b: blendEasyBurn(bottomB, topB) };
    case 'gamma-dark':
      return { r: blendGammaDark(bottomR, topR), g: blendGammaDark(bottomG, topG), b: blendGammaDark(bottomB, topB) };
    case 'fog-darken':
      return { r: blendFogDarken(bottomR, topR), g: blendFogDarken(bottomG, topG), b: blendFogDarken(bottomB, topB) };
    case 'shade':
      return { r: blendShade(bottomR, topR), g: blendShade(bottomG, topG), b: blendShade(bottomB, topB) };
    case 'linear-burn':
      return { r: blendLinearBurn(bottomR, topR), g: blendLinearBurn(bottomG, topG), b: blendLinearBurn(bottomB, topB) };
    case 'darker-color': {
      const [r, g, b] = blendDarkerColor(bottomR, bottomG, bottomB, topR, topG, topB);
      return { r, g, b };
    }

    // ─── Lighten ─────────────────────────────────────────────────
    case 'color-dodge-lighten':
      return { r: blendColorDodge(bottomR, topR), g: blendColorDodge(bottomG, topG), b: blendColorDodge(bottomB, topB) };
    case 'linear-dodge':
      return { r: blendLinearDodge(bottomR, topR), g: blendLinearDodge(bottomG, topG), b: blendLinearDodge(bottomB, topB) };
    case 'linear-dodge-minus-two-times':
      return { r: blendLinearDodgeMinusTwoTimes(bottomR, topR), g: blendLinearDodgeMinusTwoTimes(bottomG, topG), b: blendLinearDodgeMinusTwoTimes(bottomB, topB) };
    case 'normal-lighten':
      return { r: blendNormalLighten(bottomR, topR), g: blendNormalLighten(bottomG, topG), b: blendNormalLighten(bottomB, topB) };
    case 'addition':
      return { r: blendAddition(bottomR, topR), g: blendAddition(bottomG, topG), b: blendAddition(bottomB, topB) };
    case 'lighter-color': {
      const [r, g, b] = blendLighterColor(bottomR, bottomG, bottomB, topR, topG, topB);
      return { r, g, b };
    }
    case 'easy-dodge':
      return { r: blendEasyDodge(bottomR, topR), g: blendEasyDodge(bottomG, topG), b: blendEasyDodge(bottomB, topB) };
    case 'fog-lighten':
      return { r: blendFogLighten(bottomR, topR), g: blendFogLighten(bottomG, topG), b: blendFogLighten(bottomB, topB) };
    case 'gamma-light':
      return { r: blendGammaLight(bottomR, topR), g: blendGammaLight(bottomG, topG), b: blendGammaLight(bottomB, topB) };
    case 'linear-light':
      return { r: blendLinearLight(bottomR, topR), g: blendLinearLight(bottomG, topG), b: blendLinearLight(bottomB, topB) };
    case 'pin-light':
      return { r: blendPinLight(bottomR, topR), g: blendPinLight(bottomG, topG), b: blendPinLight(bottomB, topB) };
    case 'soft-light-svg':
      return { r: blendSoftLightSvg(bottomR, topR), g: blendSoftLightSvg(bottomG, topG), b: blendSoftLightSvg(bottomB, topB) };
    case 'soft-light-ps':
      return { r: blendSoftLightPs(bottomR, topR), g: blendSoftLightPs(bottomG, topG), b: blendSoftLightPs(bottomB, topB) };
    case 'vivid-light':
      return { r: blendVividLight(bottomR, topR), g: blendVividLight(bottomG, topG), b: blendVividLight(bottomB, topB) };
    case 'flat-light':
      return { r: blendFlatLight(bottomR, topR), g: blendFlatLight(bottomG, topG), b: blendFlatLight(bottomB, topB) };
    case 'hard-mix':
      return { r: blendHardMix(bottomR, topR), g: blendHardMix(bottomG, topG), b: blendHardMix(bottomB, topB) };

    // ─── HSI ─────────────────────────────────────────────────────
    case 'hue-hsi':
      return tupleToResult(blendHueHSI(bottomR, bottomG, bottomB, topR, topG, topB));
    case 'saturation-hsi':
      return tupleToResult(blendSaturationHSI(bottomR, bottomG, bottomB, topR, topG, topB));
    case 'increase-intensity-hsi':
      return tupleToResult(blendIncreaseIntensity(bottomR, bottomG, bottomB, topR, topG, topB));
    case 'decrease-intensity-hsi':
      return tupleToResult(blendDecreaseIntensity(bottomR, bottomG, bottomB, topR, topG, topB));
    case 'intensity-hsi': {
      const [r, g, b] = blendIntensityHSI(bottomR, bottomG, bottomB, topR, topG, topB);
      return { r, g, b };
    }
    case 'increase-saturation-hsi': {
      const [r, g, b] = blendIncreaseSaturationHSI(bottomR, bottomG, bottomB, topR, topG, topB);
      return { r, g, b };
    }
    case 'decrease-saturation-hsi': {
      const [r, g, b] = blendDecreaseSaturationHSI(bottomR, bottomG, bottomB, topR, topG, topB);
      return { r, g, b };
    }
    case 'color-hsi': {
      // Color mode: hue + saturation from top, intensity from bottom
      const [bh, bs] = rgbToHsi(bottomR, bottomG, bottomB).slice(0, 2) as [number, number];
      const [, , bi] = rgbToHsi(bottomR, bottomG, bottomB);
      const [th, ts] = rgbToHsi(topR, topG, topB).slice(0, 2) as [number, number];
      return tupleToResult(hsiToRgb(th, ts, bi));
    }

    // ─── HSL ─────────────────────────────────────────────────────
    case 'hue-hsl': {
      const [, bs, bl] = rgbToHsl(bottomR, bottomG, bottomB);
      const [th] = rgbToHsl(topR, topG, topB);
      return tupleToResult(hslToRgb(th, bs, bl));
    }
    case 'saturation-hsl': {
      const [bh, , bl] = rgbToHsl(bottomR, bottomG, bottomB);
      const [, ts] = rgbToHsl(topR, topG, topB);
      return tupleToResult(hslToRgb(bh, ts, bl));
    }
    case 'increase-lightness': {
      const [, , bl] = rgbToHsl(bottomR, bottomG, bottomB);
      const [, , tl] = rgbToHsl(topR, topG, topB);
      return tupleToResult(hslToRgb(0, 0, clamp01(bl + tl)));
    }
    case 'decrease-lightness': {
      const [, , bl] = rgbToHsl(bottomR, bottomG, bottomB);
      return tupleToResult(hslToRgb(0, 0, clamp01(bl * 0.5)));
    }
    case 'increase-saturation-hsl': {
      const [bh, , bl] = rgbToHsl(bottomR, bottomG, bottomB);
      const [, ts] = rgbToHsl(topR, topG, topB);
      return tupleToResult(hslToRgb(bh, clamp01(ts), bl));
    }
    case 'decrease-saturation-hsl': {
      const [bh, , bl] = rgbToHsl(bottomR, bottomG, bottomB);
      return tupleToResult(hslToRgb(bh, 0, bl));
    }
    case 'color-hsl': {
      // Color mode: hue + saturation from top, lightness from bottom
      const [, , bl] = rgbToHsl(bottomR, bottomG, bottomB);
      const [th, ts] = rgbToHsl(topR, topG, topB).slice(0, 2) as [number, number];
      return tupleToResult(hslToRgb(th, ts, bl));
    }
    case 'lightness': {
      // Lightness mode: lightness from top, hue + saturation from bottom
      const [bh, bs] = rgbToHsl(bottomR, bottomG, bottomB).slice(0, 2) as [number, number];
      const [, , tl] = rgbToHsl(topR, topG, topB);
      return tupleToResult(hslToRgb(bh, bs, tl));
    }

    // ─── HSV ─────────────────────────────────────────────────────
    case 'hue-hsv': {
      const [, bs, bv] = rgbToHsv(bottomR, bottomG, bottomB);
      const [th] = rgbToHsv(topR, topG, topB);
      return tupleToResult(hsvToRgb(th, bs, bv));
    }
    case 'saturation-hsv': {
      const [bh, , bv] = rgbToHsv(bottomR, bottomG, bottomB);
      const [, ts] = rgbToHsv(topR, topG, topB);
      return tupleToResult(hsvToRgb(bh, ts, bv));
    }
    case 'increase-value': {
      const [, , bv] = rgbToHsv(bottomR, bottomG, bottomB);
      const [, , tv] = rgbToHsv(topR, topG, topB);
      return tupleToResult(hsvToRgb(0, 0, clamp01(bv + tv)));
    }
    case 'decrease-value': {
      const [, , bv] = rgbToHsv(bottomR, bottomG, bottomB);
      return tupleToResult(hsvToRgb(0, 0, clamp01(bv * 0.5)));
    }
    case 'increase-saturation-hsv': {
      const [bh, , bv] = rgbToHsv(bottomR, bottomG, bottomB);
      const [, ts] = rgbToHsv(topR, topG, topB);
      return tupleToResult(hsvToRgb(bh, clamp01(ts), bv));
    }
    case 'decrease-saturation-hsv': {
      const [bh, , bv] = rgbToHsv(bottomR, bottomG, bottomB);
      return tupleToResult(hsvToRgb(bh, 0, bv));
    }
    case 'color-hsv': {
      // Color mode: hue + saturation from top, value from bottom
      const [, , bv] = rgbToHsv(bottomR, bottomG, bottomB);
      const [th, ts] = rgbToHsv(topR, topG, topB).slice(0, 2) as [number, number];
      return tupleToResult(hsvToRgb(th, ts, bv));
    }
    case 'value': {
      // Value mode: value from top, hue + saturation from bottom
      const [bh, bs] = rgbToHsv(bottomR, bottomG, bottomB).slice(0, 2) as [number, number];
      const [, , tv] = rgbToHsv(topR, topG, topB);
      return tupleToResult(hsvToRgb(bh, bs, tv));
    }

    // ─── HSY ─────────────────────────────────────────────────────
    case 'hue-hsy': {
      const [, bs, by] = rgbToHsy(bottomR, bottomG, bottomB);
      const [th] = rgbToHsy(topR, topG, topB);
      return tupleToResult(hsyToRgb(th, bs, by));
    }
    case 'saturation-hsy': {
      const [bh, , by] = rgbToHsy(bottomR, bottomG, bottomB);
      const [, ts] = rgbToHsy(topR, topG, topB);
      return tupleToResult(hsyToRgb(bh, ts, by));
    }
    case 'increase-luminosity': {
      const [, , by] = rgbToHsy(bottomR, bottomG, bottomB);
      const [, , ty] = rgbToHsy(topR, topG, topB);
      return tupleToResult(hsyToRgb(0, 0, clamp01(by + ty)));
    }
    case 'decrease-luminosity': {
      const [, , by] = rgbToHsy(bottomR, bottomG, bottomB);
      return tupleToResult(hsyToRgb(0, 0, clamp01(by * 0.5)));
    }
    case 'tint': {
      // Tint: hue from top + saturation/value of bottom
      const [, ts, tv] = rgbToHsy(topR, topG, topB);
      return tupleToResult(hsyToRgb(0, ts, tv));
    }
    case 'color-hsy': {
      // Color mode: hue + saturation from top, luminosity from bottom
      const [, , by] = rgbToHsy(bottomR, bottomG, bottomB);
      const [th, ts] = rgbToHsy(topR, topG, topB).slice(0, 2) as [number, number];
      return tupleToResult(hsyToRgb(th, ts, by));
    }
    case 'luminosity': {
      // Luminosity mode: luminosity from top, hue + saturation from bottom
      const [bh, bs] = rgbToHsy(bottomR, bottomG, bottomB).slice(0, 2) as [number, number];
      const [, , ty] = rgbToHsy(topR, topG, topB);
      return tupleToResult(hsyToRgb(bh, bs, ty));
    }
    case 'increase-saturation-hsy': {
      const [r, g, b] = blendIncreaseSaturationHSY(bottomR, bottomG, bottomB, topR, topG, topB);
      return { r, g, b };
    }
    case 'decrease-saturation-hsy': {
      const [r, g, b] = blendDecreaseSaturationHSY(bottomR, bottomG, bottomB, topR, topG, topB);
      return { r, g, b };
    }
    case 'erase':
    case 'destination-out':
      return { r: 0, g: 0, b: 0 };

    // ─── Misc ────────────────────────────────────────────────────
    case 'copy':
      return { r: topR, g: topG, b: topB };
    case 'copy-red':
      return { r: topR, g: 0, b: 0 };
    case 'copy-green':
      return { r: 0, g: topG, b: 0 };
    case 'copy-blue':
      return { r: 0, g: 0, b: topB };
    case 'dissolve':
      return { r: blendDissolve(bottomR, topR, alpha), g: blendDissolve(bottomG, topG, alpha), b: blendDissolve(bottomB, topB, alpha) };
    case 'bumpmap': {
      const [r, g, b] = blendBumpmap(bottomR, bottomG, bottomB, topR, topG, topB);
      return { r, g, b };
    }
    case 'combine-normal-map': {
      const [r, g, b] = blendCombineNormalMap(bottomR, bottomG, bottomB, topR, topG, topB);
      return { r, g, b };
    }
    case 'tangent-normal-map': {
      const [r, g, b] = blendTangentNormalMap(bottomR, bottomG, bottomB, topR, topG, topB);
      return { r, g, b };
    }

    // ─── Mix ─────────────────────────────────────────────────────
    case 'modulo':
      return { r: blendModulo(bottomR, topR), g: blendModulo(bottomG, topG), b: blendModulo(bottomB, topB) };
    case 'modulo-continuous':
      return { r: blendModuloContinuous(bottomR, topR), g: blendModuloContinuous(bottomG, topG), b: blendModuloContinuous(bottomB, topB) };
    case 'divisive-modulo':
      return { r: blendDivisiveModulo(bottomR, topR), g: blendDivisiveModulo(bottomG, topG), b: blendDivisiveModulo(bottomB, topB) };
    case 'divisive-modulo-continuous':
      return { r: blendDivisiveModuloContinuous(bottomR, topR), g: blendDivisiveModuloContinuous(bottomG, topG), b: blendDivisiveModuloContinuous(bottomB, topB) };
    case 'modulo-shift':
      return { r: blendModuloShift(bottomR, topR), g: blendModuloShift(bottomG, topG), b: blendModuloShift(bottomB, topB) };
    case 'modulo-shift-continuous':
      return { r: blendModuloShiftContinuous(bottomR, topR), g: blendModuloShiftContinuous(bottomG, topG), b: blendModuloShiftContinuous(bottomB, topB) };

    // ─── Negative ────────────────────────────────────────────────
    case 'heat':
      return { r: blendHeat(bottomR, topR), g: blendHeat(bottomG, topG), b: blendHeat(bottomB, topB) };
    case 'freeze':
      return { r: blendFreeze(bottomR, topR), g: blendFreeze(bottomG, topG), b: blendFreeze(bottomB, topB) };
    case 'glow':
      return { r: blendGlow(bottomR, topR), g: blendGlow(bottomG, topG), b: blendGlow(bottomB, topB) };
    case 'reflect':
      return { r: blendReflect(bottomR, topR), g: blendReflect(bottomG, topG), b: blendReflect(bottomB, topB) };
    case 'heat-glow':
      return { r: blendHeatGlow(bottomR, topR), g: blendHeatGlow(bottomG, topG), b: blendHeatGlow(bottomB, topB) };
    case 'freeze-reflect':
      return { r: blendFreezeReflect(bottomR, topR), g: blendFreezeReflect(bottomG, topG), b: blendFreezeReflect(bottomB, topB) };
    case 'heat-glow-freeze-hybrid':
      return { r: blendHeatGlowFreezeHybrid(bottomR, topR), g: blendHeatGlowFreezeHybrid(bottomG, topG), b: blendHeatGlowFreezeHybrid(bottomB, topB) };
    case 'glow-heat':
      return { r: blendGlowHeat(bottomR, topR), g: blendGlowHeat(bottomG, topG), b: blendGlowHeat(bottomB, topB) };
    case 'reflect-freeze':
      return { r: blendReflectFreeze(bottomR, topR), g: blendReflectFreeze(bottomG, topG), b: blendReflectFreeze(bottomB, topB) };

    // ─── Quadratic ───────────────────────────────────────────────
    case 'quadratic-intersection':
      return { r: blendQuadraticIntersection(bottomR, topR), g: blendQuadraticIntersection(bottomG, topG), b: blendQuadraticIntersection(bottomB, topB) };
    case 'quadratic-union':
      return { r: blendQuadraticUnion(bottomR, topR), g: blendQuadraticUnion(bottomG, topG), b: blendQuadraticUnion(bottomB, topB) };
    case 'quadratic-multiply':
      return { r: blendQuadraticMultiply(bottomR, topR), g: blendQuadraticMultiply(bottomG, topG), b: blendQuadraticMultiply(bottomB, topB) };
    case 'quadratic-divide':
      return { r: blendQuadraticDivide(bottomR, topR), g: blendQuadraticDivide(bottomG, topG), b: blendQuadraticDivide(bottomB, topB) };
    case 'quadratic-subtract':
      return { r: blendQuadraticSubtract(bottomR, topR), g: blendQuadraticSubtract(bottomG, topG), b: blendQuadraticSubtract(bottomB, topB) };

    // ─── Fallback ────────────────────────────────────────────────
    default:
      return { r: topR, g: topG, b: topB };
  }
}

/**
 * Apply a blend mode to an entire ImageData buffer.
 * Processes pixel-by-pixel with the selected blending algorithm.
 */
export function applyBlendModeToImageData(
  mode: KritaBlendMode | string,
  bottomData: Uint8ClampedArray,
  topData: Uint8ClampedArray,
  output: Uint8ClampedArray,
  width: number,
  height: number,
  alpha: number = 1.0
): void {
  const isStandard = isStandardCanvasMode(mode);

  for (let i = 0; i < width * height * 4; i += 4) {
    if (isStandard) {
      // For standard modes, copy top over bottom (canvas handles the math)
      output[i] = topData[i];
      output[i + 1] = topData[i + 1];
      output[i + 2] = topData[i + 2];
      output[i + 3] = topData[i + 3];
    } else {
      const result = blendPixel(
        mode,
        bottomData[i], bottomData[i + 1], bottomData[i + 2],
        topData[i], topData[i + 1], topData[i + 2],
        alpha
      );

      // Alpha compositing: blend result with bottom using top's alpha
      const topAlpha = (topData[i + 3] / 255) * alpha;
      output[i] = Math.round(bottomData[i] * (1 - topAlpha) + result.r * topAlpha);
      output[i + 1] = Math.round(bottomData[i + 1] * (1 - topAlpha) + result.g * topAlpha);
      output[i + 2] = Math.round(bottomData[i + 2] * (1 - topAlpha) + result.b * topAlpha);
      output[i + 3] = bottomData[i + 3]; // Preserve bottom alpha
    }
  }
}
