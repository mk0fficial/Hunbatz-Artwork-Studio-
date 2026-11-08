import JSZip from 'jszip';
import pako from 'pako';
const { inflate, inflateRaw } = pako;
import { UniversalBrushPreset, CurvePoint, brushToUniversal } from '../types/brush';
import { preloadKritaTexture, registerCustomKritaPattern } from './brushEngine';
import { hydrateBrush } from '../constants/brushes';
import { resolveKritaBlendMode } from './blendModes';

export function parsePatBuffer(buffer: ArrayBuffer, fileName: string): string | null {
  try {
    const bytes = new Uint8Array(buffer);
    // Check if it's actually an embedded PNG or JPEG
    if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      const blob = new Blob([buffer], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      registerCustomKritaPattern(fileName.replace(/\.(pat|png|jpg|jpeg)$/i, ''), url);
      return url;
    }
    if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      const blob = new Blob([buffer], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      registerCustomKritaPattern(fileName.replace(/\.(pat|png|jpg|jpeg)$/i, ''), url);
      return url;
    }

    if (buffer.byteLength < 28) return null;
    const view = new DataView(buffer);
    const headerSize = view.getUint32(0, false);
    const version = view.getUint32(4, false);
    const width = view.getUint32(8, false);
    const height = view.getUint32(12, false);
    const bytesPerPixel = view.getUint32(16, false);
    const magic = view.getUint32(20, false); // 0x47504154 "GPAT"

    if (
      width === 0 ||
      height === 0 ||
      width > 4096 ||
      height > 4096 ||
      headerSize > buffer.byteLength ||
      (magic !== 0x47504154 && version > 10)
    ) {
      return null;
    }

    // Name is null-terminated UTF-8 string between offset 24 and headerSize
    let patName = fileName.replace(/\.pat$/i, '');
    try {
      if (headerSize > 24) {
        const nameBytes = bytes.subarray(24, headerSize);
        let nullIdx = nameBytes.indexOf(0);
        if (nullIdx === -1) nullIdx = nameBytes.length;
        const decodedName = new TextDecoder('utf-8').decode(nameBytes.subarray(0, nullIdx)).trim();
        if (decodedName) patName = decodedName;
      }
    } catch {}

    const pixelBytes = new Uint8Array(buffer, headerSize);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(width, height);
    const dst = imgData.data;
    const totalPixels = width * height;

    if (bytesPerPixel === 1) {
      for (let i = 0; i < totalPixels && i < pixelBytes.length; i++) {
        const val = pixelBytes[i];
        const p = i * 4;
        dst[p] = val;
        dst[p + 1] = val;
        dst[p + 2] = val;
        dst[p + 3] = 255;
      }
    } else if (bytesPerPixel === 3) {
      for (let i = 0; i < totalPixels && i * 3 + 2 < pixelBytes.length; i++) {
        const s = i * 3;
        const p = i * 4;
        dst[p] = pixelBytes[s];
        dst[p + 1] = pixelBytes[s + 1];
        dst[p + 2] = pixelBytes[s + 2];
        dst[p + 3] = 255;
      }
    } else if (bytesPerPixel === 4) {
      for (let i = 0; i < totalPixels && i * 4 + 3 < pixelBytes.length; i++) {
        const s = i * 4;
        dst[s] = pixelBytes[s];
        dst[s + 1] = pixelBytes[s + 1];
        dst[s + 2] = pixelBytes[s + 2];
        dst[s + 3] = pixelBytes[s + 3];
      }
    } else {
      return null;
    }

    ctx.putImageData(imgData, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    preloadKritaTexture(dataUrl);
    registerCustomKritaPattern(patName, dataUrl);
    return dataUrl;
  } catch {
    return null;
  }
}

export function extractEmbeddedPattern(xmlText: string, cleanBrushName: string): string | null {
  try {
    const patMatch = xmlText.match(/<param\s+name="Texture\/Pattern\/Pattern"[^>]*>([\s\S]*?)<\/param>/i);
    if (!patMatch || !patMatch[1]) return null;
    const rawVal = patMatch[1].trim();
    if (!rawVal || rawVal.length < 32) return null;

    const cleanB64 = rawVal.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/[\r\n\s]/g, '');
    let binaryStr: string;
    try {
      binaryStr = atob(cleanB64);
    } catch {
      return null;
    }

    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    if (len >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      const blob = new Blob([bytes], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      registerCustomKritaPattern(`${cleanBrushName} Pattern`, url);
      return url;
    }
    if (len >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      const blob = new Blob([bytes], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      registerCustomKritaPattern(`${cleanBrushName} Pattern`, url);
      return url;
    }

    const patUrl = parsePatBuffer(bytes.buffer, `${cleanBrushName}_Pattern.pat`);
    if (patUrl) return patUrl;

    for (let offset = 4; offset <= 16; offset += 4) {
      if (len > offset + 8 && bytes[offset] === 0x89 && bytes[offset + 1] === 0x50) {
        const slice = bytes.subarray(offset);
        const blob = new Blob([slice], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        registerCustomKritaPattern(`${cleanBrushName} Pattern`, url);
        return url;
      }
    }
  } catch {}
  return null;
}

export const createDefaultBrush = (
  overrides?: Partial<UniversalBrushPreset>
): UniversalBrushPreset => ({
  id: `krita_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  name: 'Custom Krita Brush',
  category: 'Default Brushes',
  sourceFormat: 'native',
  spacing: 0.06,
  jitterLateral: 0,
  jitterLinear: 0,
  falloff: 0,
  streamline: 0.2,
  stabilization: 0.2,
  taperStart: 0,
  taperEnd: 0,
  taperSize: 0,
  taperOpacity: 0,
  hardness: 0.85,
  roundness: 1.0,
  angle: 0,
  followStroke: false,
  scatter: 0,
  flipX: false,
  flipY: false,
  grainMode: 'moving',
  grainScale: 1.0,
  grainDepth: 0,
  grainBlendMode: 'multiply',
  blendMode: 'source-over',
  wetMixDilution: 0,
  smudgePull: 0,
  smudgeLength: 0.5,
  hueJitter: 0,
  saturationJitter: 0,
  brightnessJitter: 0,
  baseSize: 28,
  baseOpacity: 1.0,
  sizeByPressure: [
    { x: 0, y: 0.15 },
    { x: 1, y: 1 },
  ],
  opacityByPressure: [
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ],
  sizeBySpeed: 0,
  opacityBySpeed: 0,
  tiltAngleInfluence: 0,
  minSize: 1,
  maxSize: 400,
  orientToScreen: true,
  ...overrides,
});

function normalizeKey(str: string): string {
  return decodeURIComponent(str)
    .toLowerCase()
    .split('/')
    .pop()!
    .replace(/\.(png|gbr|gih|pgm|svg|kpp|myb)$/i, '')
    .replace(/[^a-z0-9]/g, '');
}

async function convertKritaTipBlobToAlphaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.width || 64;
      const h = img.height || 64;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;

      let minAlpha = 255;
      let cornerLumSum = 0;
      let cornerAlphaSum = 0;
      const corners = [
        0,
        (w - 1) * 4,
        (h - 1) * w * 4,
        ((h - 1) * w + (w - 1)) * 4,
      ];
      for (const idx of corners) {
        if (idx >= 0 && idx + 3 < d.length) {
          const lum = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
          cornerLumSum += lum;
          cornerAlphaSum += d[idx + 3];
        }
      }
      for (let i = 3; i < d.length; i += 4) {
        if (d[i] < minAlpha) minAlpha = d[i];
      }

      const avgCornerLum = cornerLumSum / 4;
      const avgCornerAlpha = cornerAlphaSum / 4;
      const isOpaqueWhiteBgLuminanceMask = minAlpha > 240 && avgCornerLum > 190;
      const isOpaqueBlackBgMask = minAlpha > 240 && avgCornerLum <= 65;

      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const a = d[i + 3];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        let outAlpha = a;
        if (isOpaqueWhiteBgLuminanceMask) {
          outAlpha = Math.round(255 - lum);
        } else if (isOpaqueBlackBgMask) {
          outAlpha = Math.round(lum);
        } else if (avgCornerAlpha > 240 && avgCornerLum > 175) {
          outAlpha = Math.round((a / 255) * (255 - lum));
        } else if (lum < 245 && a > 0) {
          const darkness = 255 - lum;
          outAlpha = Math.round((a / 255) * Math.max(a, darkness));
        }

        d[i] = 255;
        d[i + 1] = 255;
        d[i + 2] = 255;
        d[i + 3] = Math.max(0, Math.min(255, outAlpha));
      }

      ctx.putImageData(imgData, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      preloadKritaTexture(dataUrl);
      resolve(dataUrl);
    };
    img.onerror = () => {
      resolve(url);
    };
    img.src = url;
  });
}

function parseGbrBufferToDataUrls(buffer: ArrayBuffer): string[] {
  try {
    const view = new DataView(buffer);
    if (buffer.byteLength < 28) return [];
    const headerSize = view.getUint32(0, false);
    const width = view.getUint32(8, false);
    const height = view.getUint32(12, false);
    const bytesPerPixel = view.getUint32(16, false);

    if (
      width === 0 ||
      height === 0 ||
      width > 4096 ||
      height > 4096 ||
      headerSize > buffer.byteLength
    ) {
      return [];
    }

    const bytes = new Uint8Array(buffer, headerSize);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(width, height);
    const dst = imgData.data;

    const totalPixels = width * height;
    if (bytesPerPixel === 1) {
      let cornerSum = 0;
      const cIndices = [0, width - 1, (height - 1) * width, totalPixels - 1];
      for (const ci of cIndices) {
        if (ci < bytes.length) cornerSum += bytes[ci];
      }
      const invert = cornerSum / 4 > 190;

      for (let i = 0; i < totalPixels && i < bytes.length; i++) {
        const val = bytes[i];
        const alpha = invert ? 255 - val : val;
        const p = i * 4;
        dst[p] = 255;
        dst[p + 1] = 255;
        dst[p + 2] = 255;
        dst[p + 3] = alpha;
      }
    } else if (bytesPerPixel === 4) {
      for (let i = 0; i < totalPixels && i * 4 + 3 < bytes.length; i++) {
        const s = i * 4;
        const r = bytes[s];
        const g = bytes[s + 1];
        const b = bytes[s + 2];
        const a = bytes[s + 3];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        dst[s] = 255;
        dst[s + 1] = 255;
        dst[s + 2] = 255;
        dst[s + 3] = a < 250 ? a : Math.round(255 - lum);
      }
    } else {
      return [];
    }

    ctx.putImageData(imgData, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    preloadKritaTexture(dataUrl);
    return [dataUrl];
  } catch {
    return [];
  }
}

function parseGihBufferToDataUrls(buffer: ArrayBuffer): string[] {
  const urls: string[] = [];
  try {
    const bytes = new Uint8Array(buffer);
    let firstNewline = -1;
    let secondNewline = -1;
    for (let i = 0; i < Math.min(2048, bytes.length); i++) {
      if (bytes[i] === 0x0a) {
        if (firstNewline === -1) {
          firstNewline = i;
        } else {
          secondNewline = i;
          break;
        }
      }
    }
    if (secondNewline === -1) return [];

    let offset = secondNewline + 1;
    const view = new DataView(buffer);

    let safetyCount = 0;
    while (offset + 28 < buffer.byteLength && safetyCount < 16) {
      safetyCount++;
      const headerSize = view.getUint32(offset, false);
      const width = view.getUint32(offset + 8, false);
      const height = view.getUint32(offset + 12, false);
      const bpp = view.getUint32(offset + 16, false);

      if (
        headerSize < 20 ||
        headerSize > 1024 ||
        width === 0 ||
        height === 0 ||
        width > 2048 ||
        height > 2048 ||
        (bpp !== 1 && bpp !== 4)
      ) {
        break;
      }

      const cellByteLen = headerSize + width * height * bpp;
      if (offset + cellByteLen > buffer.byteLength) break;

      const subBuffer = buffer.slice(offset, offset + cellByteLen);
      const parsed = parseGbrBufferToDataUrls(subBuffer);
      if (parsed.length > 0) {
        urls.push(...parsed);
      }
      offset += cellByteLen;
    }
  } catch {}
  return urls;
}

export function serializeBrushToMyb(brush: any): string {
  const radiusLog = Math.log(Math.max(1, (brush.size || 24) / 2));
  const dabsPerRadius = Math.round(1 / Math.max(0.01, brush.spacing || 0.05));
  const roundness = brush.shape?.roundness ?? 1.0;
  const angle = brush.shape?.rotation ?? 0;
  const smudge = brush.wetMix?.pull ?? brush.smudgePull ?? 0;

  const mybObj = {
    myb_version: 2,
    name: brush.name,
    category: brush.category || 'Pencils',
    settings: {
      radius_logarithmic: { base_value: radiusLog },
      opaque: { base_value: brush.opacity ?? 1.0 },
      hardness: { base_value: brush.hardness ?? 0.8 },
      dabs_per_actual_radius: { base_value: dabsPerRadius },
      elliptical_dab_ratio: { base_value: roundness },
      elliptical_dab_angle: { base_value: angle },
      smudge: { base_value: smudge },
      speed1_slowness: { base_value: brush.streamline ?? 0.2 },
    },
    hunbatz_preset: brush,
  };
  return JSON.stringify(mybObj, null, 2);
}

export function parseMybFile(text: string, fileName: string): UniversalBrushPreset {
  if (text.trim().startsWith('{')) {
    try {
      const json = JSON.parse(text);
      if (json.hunbatz_preset) {
        const hyd = hydrateBrush(json.hunbatz_preset);
        const u = brushToUniversal(hyd);
        if (json.name) u.name = json.name;
        if (json.category) u.category = json.category;
        return u;
      }
      const s = json.settings || {};
      const baseVal = (k: string, def: number) =>
        typeof s[k]?.base_value === 'number' ? s[k].base_value : def;
      const radiusLog = baseVal('radius_logarithmic', 2.2);
      const dabsPerRadius = Math.max(1, baseVal('dabs_per_actual_radius', 10));
      const ratio = Math.max(0.05, Math.min(1, baseVal('elliptical_dab_ratio', 1.0)));

      return createDefaultBrush({
        name: fileName.replace(/\.myb$/i, '').replace(/_/g, ' '),
        category: json.category || 'Pencils',
        sourceFormat: 'myb',
        baseSize: Math.max(2, Math.round(Math.exp(radiusLog) * 2)),
        baseOpacity: Math.max(0.05, Math.min(1, baseVal('opaque', 1.0))),
        hardness: Math.max(0.05, Math.min(1, baseVal('hardness', 0.8))),
        spacing: Math.max(0.02, 1 / dabsPerRadius),
        roundness: ratio,
        angle: baseVal('elliptical_dab_angle', 0),
        followStroke: baseVal('direction_filter', 0) > 0,
        jitterLateral: baseVal('offset_by_random', 0),
        smudgePull: baseVal('smudge', 0),
        hueJitter: baseVal('change_color_h', 0),
        saturationJitter: baseVal('change_color_hsl_s', 0),
        brightnessJitter: baseVal('change_color_l', 0),
      });
    } catch {}
  }

  const lines = text.split('\n');
  const params: Record<string, { base: number; curves: Record<string, CurvePoint[]> }> = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (
      !line ||
      line.startsWith('#') ||
      line.startsWith('version') ||
      line.startsWith('parent_brush_name')
    )
      continue;

    const parts = line.split('|');
    let key = '';
    let valStr = '';
    if (parts[0].includes('=')) {
      const eqIdx = parts[0].indexOf('=');
      key = parts[0].slice(0, eqIdx).trim();
      valStr = parts[0].slice(eqIdx + 1).trim();
    } else {
      const tokens = parts[0].trim().split(/\s+/);
      key = tokens[0] || '';
      valStr = tokens[1] || '';
    }
    key = key.replace(/^settings\./, '').replace(/\.base_value$/, '');
    const baseVal = parseFloat(valStr);
    if (isNaN(baseVal)) continue;

    params[key] = { base: baseVal, curves: {} };
    for (let i = 1; i < parts.length; i++) {
      const curvePart = parts[i].trim();
      const firstParen = curvePart.indexOf('(');
      if (firstParen === -1) continue;
      const sensorName = curvePart.slice(0, firstParen).trim();
      const pointMatches = [...curvePart.matchAll(/\(([-\d.]+)\s+([-\d.]+)\)/g)];
      params[key].curves[sensorName] = pointMatches.map((m) => ({
        x: parseFloat(m[1]),
        y: parseFloat(m[2]),
      }));
    }
  }

  const radiusLog = params['radius_logarithmic']?.base ?? 2.0;
  const baseSize = Math.max(2, Math.round(Math.exp(radiusLog) * 2));
  const dabsPerRadius =
    params['dabs_per_actual_radius']?.base ||
    params['dabs_per_basic_radius']?.base ||
    4.0;
  const dabRatio = params['elliptical_dab_ratio']?.base ?? 1.0;

  return createDefaultBrush({
    name: fileName.replace('.myb', '').replace(/_/g, ' '),
    category: 'Hunbatz Base Brushes',
    sourceFormat: 'myb',
    baseSize,
    baseOpacity: Math.min(1, params['opaque']?.base ?? 1.0),
    hardness: params['hardness']?.base ?? 0.8,
    spacing: Math.max(0.02, 1 / dabsPerRadius),
    roundness: dabRatio > 1 ? 1 / dabRatio : dabRatio,
    angle: params['elliptical_dab_angle']?.base ?? 0,
    followStroke: Boolean(params['elliptical_dab_angle']?.curves['direction']),
    jitterLateral: params['offset_by_random']?.base ?? 0,
    streamline: Math.min(1, (params['slow_tracking']?.base ?? 0) / 5),
    smudgePull: params['smudge']?.base ?? 0,
    smudgeLength: params['smudge_length']?.base ?? 0.5,
    hueJitter: params['change_color_h']?.base ?? 0,
    saturationJitter: params['change_color_hsv_s']?.base ?? 0,
    brightnessJitter: params['change_color_v']?.base ?? 0,
  });
}

export async function parseKppFile(
  bufferOrText: ArrayBuffer | string,
  fileName: string,
  tipMap?: Map<string, string[]>,
  patternMap?: Map<string, string>
): Promise<UniversalBrushPreset> {
  let xmlText = '';
  let iconUrl: string | undefined;

  if (typeof bufferOrText === 'string') {
    xmlText = bufferOrText;
  } else {
    const bytes = new Uint8Array(bufferOrText);
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      try {
        const blob = new Blob([bytes], { type: 'image/png' });
        iconUrl = URL.createObjectURL(blob);
      } catch {}
    }

    let offset = 8;
    const latin1Decoder = new TextDecoder('latin1');
    const utf8Decoder = new TextDecoder('utf-8');

    while (offset + 12 <= bytes.length) {
      const view = new DataView(bufferOrText, offset, 8);
      const length = view.getUint32(0, false);
      const type = latin1Decoder.decode(bytes.subarray(offset + 4, offset + 8));

      if (offset + 8 + length > bytes.length) break;
      const chunkData = bytes.subarray(offset + 8, offset + 8 + length);

      if (type === 'zTXt' || type === 'tEXt' || type === 'iTXt') {
        const nullIdx = chunkData.indexOf(0);
        if (nullIdx !== -1) {
          const keyword = latin1Decoder.decode(chunkData.subarray(0, nullIdx)).toLowerCase();
          if (keyword === 'preset' || keyword === 'comment' || keyword === 'XML:com.adobe.xmp') {
            if (type === 'zTXt') {
              const compressed = chunkData.subarray(nullIdx + 2);
              try {
                xmlText = utf8Decoder.decode(inflate(compressed));
              } catch {
                try {
                  xmlText = utf8Decoder.decode(inflateRaw(compressed));
                } catch {}
              }
            } else if (type === 'iTXt') {
              const compFlag = chunkData[nullIdx + 1];
              let p = nullIdx + 3;
              while (p < chunkData.length && chunkData[p] !== 0) p++;
              p++;
              while (p < chunkData.length && chunkData[p] !== 0) p++;
              p++;
              const payload = chunkData.subarray(p);
              if (compFlag === 1) {
                try {
                  xmlText = utf8Decoder.decode(inflate(payload));
                } catch {}
              } else {
                xmlText = utf8Decoder.decode(payload);
              }
            } else {
              xmlText = utf8Decoder.decode(chunkData.subarray(nullIdx + 1));
            }
          }
        }
      }
      offset += 12 + length;
    }
  }

  let cleanBrushName = fileName.replace(/\.kpp$/i, '').replace(/_/g, ' ');
  const nameIniMatch = xmlText.match(/^name=(.+)$/im);
  if (nameIniMatch) {
    cleanBrushName = nameIniMatch[1].trim();
  }

  const lowerName = cleanBrushName.toLowerCase();

  let shapeTextureUrl: string | undefined;
  let shapeTextureUrls: string[] | undefined;
  let grainTextureUrl: string | undefined;
  let spacing = 0.06;
  let baseSize = 32;
  let baseOpacity = 1.0;

  const iniOpacityMatch = xmlText.match(/^opacity=([0-9.]+)/im);
  if (iniOpacityMatch) {
    const o = parseFloat(iniOpacityMatch[1]);
    if (!isNaN(o)) baseOpacity = o;
  }
  const iniSpacingMatch = xmlText.match(/^spacing=([0-9.]+)/im);
  if (iniSpacingMatch) {
    const s = parseFloat(iniSpacingMatch[1]);
    if (!isNaN(s)) spacing = s;
  }
  const iniRadiusMatch = xmlText.match(/^radius=([0-9.]+)/im);
  if (iniRadiusMatch) {
    const r = parseFloat(iniRadiusMatch[1]);
    if (!isNaN(r)) baseSize = r * 2;
  }
  let hardness = 0.85;
  let roundness = 1.0;
  let angle = 0;
  let followStroke = false;
  let scatter = 0;
  let jitterLateral = 0;
  let jitterLinear = 0;
  let smudgePull = 0;
  let smudgeLength = 0.5;
  let wetMixDilution = 0;
  let hueJitter = 0;
  let saturationJitter = 0;
  let brightnessJitter = 0;
  let grainDepth = 0;
  let grainScale = 1.0;
  let tiltAngleInfluence = 0;
  let minPressureSize = 0.15;
  let minPressureOpacity = 1.0;
  let paintopId = 'paintbrush';
  let shapeTexture: any = 'hard_round';
  let angleOffset = 0;
  let patEnabled = false;
  let patStrength = 1.0;
  let patScale = 1.0;
  let patTexturingMode: 'multiply' | 'subtract' = 'multiply';
  let patUrl: string | undefined = undefined;
  let kppBlendMode: string = 'source-over';

  if (xmlText) {
    const paintopMatch = xmlText.match(/paintopid="([^"]+)"/i);
    if (paintopMatch) {
      paintopId = paintopMatch[1].toLowerCase();
    }

    const paramsMap = new Map<string, string>();
    if (typeof DOMParser !== 'undefined') {
      try {
        const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
        doc.querySelectorAll('param').forEach((p) => {
          const k = p.getAttribute('name');
          if (k) paramsMap.set(k, (p.textContent || '').trim());
        });
      } catch {}
    } else {
      const paramRegex = /<param\s+name="([^"]+)">([\s\S]*?)<\/param>/gi;
      let m;
      while ((m = paramRegex.exec(xmlText)) !== null) {
        paramsMap.set(m[1], m[2].trim());
      }
    }

    const brushDefRaw =
      paramsMap.get('brush_definition') ||
      xmlText;

    if (brushDefRaw) {
      const spMatch = brushDefRaw.match(/spacing="([0-9.]+)"/i);
      if (spMatch) {
        const sp = parseFloat(spMatch[1]);
        if (!isNaN(sp) && sp > 0) spacing = Math.max(0.015, Math.min(1.2, sp));
      }

      const angMatch = brushDefRaw.match(/angle="([0-9.-]+)"/i);
      if (angMatch) {
        const bAngle = parseFloat(angMatch[1]);
        if (!isNaN(bAngle)) angle = ((Math.round(bAngle) % 360) + 360) % 360;
      }

      const diamMatch = brushDefRaw.match(/diameter="([0-9.]+)"/i);
      if (diamMatch) {
        const diam = parseFloat(diamMatch[1]);
        if (!isNaN(diam) && diam > 0) baseSize = Math.max(2, Math.min(400, Math.round(diam)));
      }

      const ratioMatch = brushDefRaw.match(/ratio="([0-9.]+)"/i);
      if (ratioMatch) {
        const ratio = parseFloat(ratioMatch[1]);
        if (!isNaN(ratio) && ratio > 0) roundness = Math.max(0.05, Math.min(1.0, ratio));
      }

      const hfadeMatch = brushDefRaw.match(/hfade="([0-9.]+)"/i);
      const vfadeMatch = brushDefRaw.match(/vfade="([0-9.]+)"/i);
      if (hfadeMatch || vfadeMatch) {
        const hf = hfadeMatch ? parseFloat(hfadeMatch[1]) : 0.8;
        const vf = vfadeMatch ? parseFloat(vfadeMatch[1]) : 0.8;
        const avgFade = (hf + vf) * 0.5;
        const isGauss = /type="gaussian"/i.test(brushDefRaw);
        hardness = isGauss ? Math.max(0.04, avgFade * 0.65) : Math.max(0.04, avgFade);
      }

      // Match filename=".." inside brush_definition against tipMap using normalized fuzzy keys
      const fileMatch = brushDefRaw.match(/filename="([^"]+)"/i);
      const isPredefined = /mask_type="predefined"/i.test(brushDefRaw) || Boolean(fileMatch);

      if (fileMatch && tipMap && tipMap.size > 0) {
        const rawTipName = fileMatch[1];
        const normTarget = normalizeKey(rawTipName);

        let matched =
          tipMap.get(rawTipName) ||
          tipMap.get(normTarget);

        if (!matched) {
          for (const [k, urls] of tipMap.entries()) {
            const nk = normalizeKey(k);
            if (nk === normTarget || nk.includes(normTarget) || normTarget.includes(nk)) {
              matched = urls;
              break;
            }
          }
        }

        if (matched && matched.length > 0) {
          shapeTextureUrl = matched[0];
          preloadKritaTexture(shapeTextureUrl);
          if (matched.length > 1) {
            shapeTextureUrls = matched;
            matched.forEach((u) => preloadKritaTexture(u));
          }
        }
      }

      // If brush_definition is predefined and no tip matched from tipMap, fallback to embedded PNG iconUrl
      if (!shapeTextureUrl && isPredefined && iconUrl) {
        shapeTextureUrl = iconUrl;
        preloadKritaTexture(shapeTextureUrl);
      }
    }

    const opVal = parseFloat(paramsMap.get('OpacityValue') || '');
    if (!isNaN(opVal)) baseOpacity = Math.max(0.05, Math.min(1, opVal));
    const flowVal = parseFloat(paramsMap.get('FlowValue') || '');
    if (!isNaN(flowVal)) baseOpacity = Math.max(0.05, Math.min(1, baseOpacity * flowVal));

    if (paramsMap.get('PressureOpacity') === 'true') {
      minPressureOpacity = 0.05;
    }
    if (paramsMap.get('PressureSize') === 'false') {
      minPressureSize = 1.0;
    }

    // Parse Drawing angle / Rotation Sensor
    angleOffset = 0;
    const rotSensor =
      paramsMap.get('RotationSensor') ||
      paramsMap.get('CurveRotation') ||
      '';
    const isDrawingAngle =
      rotSensor.includes('DrawingAngle') ||
      rotSensor.toLowerCase().includes('drawing angle') ||
      paramsMap.get('DrawingAngle') === 'true';

    if (isDrawingAngle) {
      followStroke = true;
      scatter = 0; // Drawing angle should strictly follow stroke without random scatter jitter
      const angVal = parseFloat(
        paramsMap.get('AngleValue') || paramsMap.get('DrawingAngleOffset') || '0'
      );
      if (!isNaN(angVal)) {
        angleOffset = angVal;
      }
    } else if (
      paramsMap.get('PressureRotation') === 'true' ||
      rotSensor.includes('TiltDirection') ||
      rotSensor.includes('Ascension')
    ) {
      if (rotSensor.includes('Tilt') || rotSensor.includes('Ascension')) {
        tiltAngleInfluence = 0.85;
      }
      if (!followStroke && !tiltAngleInfluence) {
        scatter = 180;
      }
    }

    if (paramsMap.get('PressureScatter') === 'true') {
      const scatterVal = parseFloat(
        paramsMap.get('ScatterValue') || paramsMap.get('ScatterAmount') || '0.45'
      );
      const axisX = paramsMap.get('ScatterAxisX') !== 'false';
      const axisY = paramsMap.get('ScatterAxisY') !== 'false';
      if (axisX) jitterLinear = Math.max(0.05, Math.min(2.0, scatterVal));
      if (axisY) jitterLateral = Math.max(0.05, Math.min(2.0, scatterVal));
    }

    // Pattern texturing parameters
    const patEnabledRaw = paramsMap.get('Texture/Pattern/Enabled');
    patEnabled = patEnabledRaw === 'true' || patEnabledRaw === '1';

    patStrength = 1.0;
    const strRaw = paramsMap.get('Texture/Pattern/Strength');
    if (strRaw) {
      const parsedStr = parseFloat(strRaw);
      if (!isNaN(parsedStr)) patStrength = Math.max(0, Math.min(1.0, parsedStr));
    }

    patScale = 1.0;
    const scaleRaw = paramsMap.get('Texture/Pattern/Scale');
    if (scaleRaw) {
      const parsedScale = parseFloat(scaleRaw);
      if (!isNaN(parsedScale) && parsedScale > 0) patScale = parsedScale;
    }

    patTexturingMode = 'multiply';
    const modeRaw =
      paramsMap.get('Texture/Pattern/TexturingMode') ||
      paramsMap.get('Texture/Pattern/Mode');
    if (modeRaw === '1' || modeRaw?.toLowerCase() === 'subtract') {
      patTexturingMode = 'subtract';
    }

    // Check embedded base64 pattern or registered pattern in patternMap
    patUrl = undefined;
    const embeddedPatUrl = extractEmbeddedPattern(xmlText, cleanBrushName);
    if (embeddedPatUrl) {
      patUrl = embeddedPatUrl;
    } else if (patternMap && patternMap.size > 0) {
      const patParam =
        paramsMap.get('Texture/Pattern/Pattern') ||
        paramsMap.get('Texture/Pattern/PatternFileName');
      if (patParam) {
        const normPat = normalizeKey(patParam);
        patUrl = patternMap.get(patParam) || patternMap.get(normPat);
        if (!patUrl) {
          for (const [pk, pUrl] of patternMap.entries()) {
            if (normalizeKey(pk).includes(normPat) || normPat.includes(normalizeKey(pk))) {
              patUrl = pUrl;
              break;
            }
          }
        }
      }
    }

    if (
      paintopId.includes('colorsmudge') ||
      paramsMap.has('SmudgeRateValue') ||
      lowerName.includes('blend') ||
      lowerName.includes('smudge') ||
      lowerName.includes('blur') ||
      lowerName.includes('wet')
    ) {
      const sRate = parseFloat(paramsMap.get('SmudgeRateValue') || '0.75');
      const cRate = parseFloat(paramsMap.get('ColorRateValue') || '0.25');
      smudgePull = Math.max(0.3, Math.min(1.0, isNaN(sRate) ? 0.75 : sRate));
      smudgeLength = smudgePull;
      wetMixDilution = Math.max(0.2, Math.min(1.0, 1 - (isNaN(cRate) ? 0.25 : cRate)));
    }

    const compositeOp = paramsMap.get('CompositeOp') || '';
    if (compositeOp) {
      kppBlendMode = resolveKritaBlendMode(compositeOp);
    }
  }

  // Disable procedural scratch/bristle overrides whenever a brush is imported from Krita or has a shapeTextureUrl / predefined tip
  const hasPredefinedTip = Boolean(shapeTextureUrl || (shapeTextureUrls && shapeTextureUrls.length > 0));

  if (!hasPredefinedTip) {
    if (lowerName.includes('rake') || lowerName.includes('bristle')) {
      shapeTexture = 'flat_bristle';
      followStroke = true;
      spacing = Math.min(spacing, 0.035);
      if (!shapeTextureUrl) roundness = Math.min(roundness, 0.45);
    } else if (
      lowerName.includes('spott') ||
      lowerName.includes('spatter') ||
      lowerName.includes('spray') ||
      lowerName.includes('dirty')
    ) {
      scatter = Math.max(scatter, 180);
      jitterLateral = Math.max(jitterLateral, 0.35);
      spacing = Math.max(spacing, 0.14);
    } else if (
      lowerName.includes('grass') ||
      lowerName.includes('fur') ||
      lowerName.includes('branch') ||
      lowerName.includes('foliage')
    ) {
      tiltAngleInfluence = Math.max(tiltAngleInfluence, 0.85);
      jitterLateral = Math.max(jitterLateral, 0.25);
      spacing = Math.min(spacing, 0.08);
    } else if (
      lowerName.includes('airbrush') ||
      lowerName.includes('supersoft') ||
      lowerName.includes('soft') ||
      lowerName.includes('glow')
    ) {
      shapeTexture = 'soft_airbrush';
      hardness = Math.min(hardness, 0.08);
      minPressureOpacity = 0.05;
    } else if (
      lowerName.includes('square') ||
      lowerName.includes('chisel') ||
      lowerName.includes('flat') ||
      lowerName.includes('concept')
    ) {
      shapeTexture = 'chisel_marker';
      roundness = Math.min(roundness, 0.38);
      followStroke = true;
    } else if (lowerName.includes('pointy') || lowerName.includes('triangle')) {
      shapeTexture = 'hard_triangle';
      followStroke = true;
    }
  }

  const preset = createDefaultBrush({
    name: cleanBrushName,
    category: 'Default Brushes',
    sourceFormat: 'kpp',
    iconUrl,
    shapeTexture,
    shapeTextureUrl,
    blendMode: kppBlendMode,
    grainTextureUrl: patUrl || grainTextureUrl,
    grainDepth: patEnabled ? patStrength : grainDepth,
    grainScale: patScale,
    patternEnabled: patEnabled,
    patternStrength: patStrength,
    patternScale: patScale,
    patternTexturingMode: patTexturingMode,
    angleOffset,
    spacing,
    baseSize,
    baseOpacity,
    hardness,
    roundness,
    angle,
    followStroke,
    scatter,
    jitterLateral,
    jitterLinear,
    smudgePull,
    smudgeLength,
    wetMixDilution,
    hueJitter,
    saturationJitter,
    brightnessJitter,
    tiltAngleInfluence,
    sizeByPressure: [
      { x: 0, y: minPressureSize },
      { x: 1, y: 1 },
    ],
    opacityByPressure: [
      { x: 0, y: minPressureOpacity },
      { x: 1, y: 1 },
    ],
  });

  if (shapeTextureUrls && shapeTextureUrls.length > 1) {
    preset.shapeTextureUrls = shapeTextureUrls;
  }

  return preset;
}

export async function parseBrushArchiveOrBinary(
  fileOrBuffer: File | ArrayBuffer,
  fileName?: string
): Promise<UniversalBrushPreset[]> {
  const isFile = typeof (fileOrBuffer as any).arrayBuffer === 'function';
  const name = isFile ? (fileOrBuffer as File).name : fileName || 'imported_brush';
  const buffer = isFile ? await (fileOrBuffer as File).arrayBuffer() : (fileOrBuffer as ArrayBuffer);
  const ext = name.split('.').pop()?.toLowerCase();
  const file = { name };

  if (ext === 'myb') {
    const text = new TextDecoder('utf-8').decode(buffer);
    return [parseMybFile(text, file.name)];
  }

  if (ext === 'kpp') {
    return [await parseKppFile(buffer, file.name)];
  }

  if (ext === 'gbr') {
    const urls = parseGbrBufferToDataUrls(buffer);
    return [
      createDefaultBrush({
        name: file.name.replace(/\.gbr$/i, '').replace(/_/g, ' '),
        category: 'Hunbatz Base Brushes',
        shapeTextureUrl: urls[0],
        iconUrl: urls[0],
      }),
    ];
  }

  if (ext === 'gih') {
    const urls = parseGihBufferToDataUrls(buffer);
    const preset = createDefaultBrush({
      name: file.name.replace(/\.gih$/i, '').replace(/_/g, ' '),
      category: 'Hunbatz Base Brushes',
      shapeTextureUrl: urls[0],
      iconUrl: urls[0],
    });
    if (urls.length > 1) preset.shapeTextureUrls = urls;
    return [preset];
  }

  if (ext === 'png') {
    const blob = new Blob([buffer], { type: 'image/png' });
    const alphaUrl = await convertKritaTipBlobToAlphaDataUrl(blob);
    return [
      createDefaultBrush({
        name: file.name.replace(/\.png$/i, ''),
        category: 'Hunbatz Base Brushes',
        shapeTextureUrl: alphaUrl,
        iconUrl: alphaUrl,
      }),
    ];
  }

  if (ext === 'sut') {
    const bytes = new Uint8Array(buffer);
    const pngUrls: string[] = [];
    for (let i = 0; i < bytes.length - 8; i++) {
      if (
        bytes[i] === 0x89 &&
        bytes[i + 1] === 0x50 &&
        bytes[i + 2] === 0x4e &&
        bytes[i + 3] === 0x47
      ) {
        for (let j = i + 8; j < bytes.length - 8; j++) {
          if (
            bytes[j] === 0x49 &&
            bytes[j + 1] === 0x45 &&
            bytes[j + 2] === 0x4e &&
            bytes[j + 3] === 0x44
          ) {
            const pngSlice = bytes.slice(i, j + 8);
            const blob = new Blob([pngSlice], { type: 'image/png' });
            const alphaUrl = await convertKritaTipBlobToAlphaDataUrl(blob);
            pngUrls.push(alphaUrl);
            i = j + 8;
            break;
          }
        }
      }
    }

    const isRake =
      file.name.toLowerCase().includes('rake') ||
      file.name.toLowerCase().includes('feather') ||
      file.name.toLowerCase().includes('fur');
    const preset = createDefaultBrush({
      name: file.name.replace(/\.sut$/i, ''),
      category: 'Hunbatz Base Brushes',
      sourceFormat: 'sut',
      shapeTextureUrl: pngUrls[1] || pngUrls[0],
      iconUrl: pngUrls[0],
      followStroke: isRake,
      spacing: isRake ? 0.04 : 0.06,
    });
    if (pngUrls.length > 2) preset.shapeTextureUrls = pngUrls.slice(1);
    return [preset];
  }

  if (ext === 'bundle' || ext === 'brush' || ext === 'brushset' || ext === 'zip') {
    const zip = await JSZip.loadAsync(buffer);
    const brushesFile = zip.file('brushes.json') || zip.file(/\bbrushes\.json$/i)[0];
    if (brushesFile) {
      try {
        const jsonText = await brushesFile.async('string');
        const parsed = JSON.parse(jsonText);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((b) => brushToUniversal(hydrateBrush(b)));
        }
      } catch (err) {
        console.warn('Failed parsing brushes.json inside bundle zip:', err);
      }
    }

    const presets: UniversalBrushPreset[] = [];
    const tipMap = new Map<string, string[]>();
    const patternMap = new Map<string, string>();

    const registerTipUrls = (relativePath: string, urls: string[]) => {
      if (!urls || urls.length === 0) return;
      const fileNameOnly = relativePath.split('/').pop()!;
      const normKey = normalizeKey(fileNameOnly);
      tipMap.set(relativePath, urls);
      tipMap.set(fileNameOnly, urls);
      tipMap.set(normKey, urls);
    };

    // PASS 1: Extract all patterns and brush tips BEFORE parsing .kpp files
    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;
      const lowerPath = relativePath.toLowerCase();

      // 1. Patterns in patterns/ folder (supports .pat binary headers, .png, .jpg, .jpeg)
      if (lowerPath.includes('patterns/') || lowerPath.endsWith('.pat')) {
        const fileNameOnly = relativePath.split('/').pop()!;
        const normKey = normalizeKey(fileNameOnly);

        if (lowerPath.endsWith('.pat')) {
          const patBuf = await zipEntry.async('arraybuffer');
          const patUrl = parsePatBuffer(patBuf, fileNameOnly);
          if (patUrl) {
            patternMap.set(relativePath, patUrl);
            patternMap.set(fileNameOnly, patUrl);
            patternMap.set(normKey, patUrl);
          }
          continue;
        } else if (
          lowerPath.endsWith('.png') ||
          lowerPath.endsWith('.jpg') ||
          lowerPath.endsWith('.jpeg')
        ) {
          const blob = await zipEntry.async('blob');
          const patUrl = URL.createObjectURL(blob);
          preloadKritaTexture(patUrl);
          registerCustomKritaPattern(
            fileNameOnly.replace(/\.(png|jpg|jpeg)$/i, ''),
            patUrl
          );
          patternMap.set(relativePath, patUrl);
          patternMap.set(fileNameOnly, patUrl);
          patternMap.set(normKey, patUrl);
          continue;
        }
      }

      // 2. Brushes in brushes/ folder (.gbr, .gih, .png) and root brush tips
      if (
        lowerPath.includes('brushes/') ||
        lowerPath.endsWith('.gbr') ||
        lowerPath.endsWith('.gih') ||
        (lowerPath.endsWith('.png') && !lowerPath.endsWith('.kpp'))
      ) {
        if (lowerPath.endsWith('.gbr')) {
          const gbrBuf = await zipEntry.async('arraybuffer');
          const urls = parseGbrBufferToDataUrls(gbrBuf);
          registerTipUrls(relativePath, urls);
        } else if (lowerPath.endsWith('.gih')) {
          const gihBuf = await zipEntry.async('arraybuffer');
          const urls = parseGihBufferToDataUrls(gihBuf);
          registerTipUrls(relativePath, urls);
        } else if (lowerPath.endsWith('.png')) {
          const blob = await zipEntry.async('blob');
          if (lowerPath.includes('brushes/') || lowerPath.endsWith('shape.png')) {
            const alphaUrl = await convertKritaTipBlobToAlphaDataUrl(blob);
            registerTipUrls(relativePath, [alphaUrl]);
          } else {
            const rawUrl = URL.createObjectURL(blob);
            registerTipUrls(relativePath, [rawUrl]);
          }
        }
      }
    }

    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;
      const lowerPath = relativePath.toLowerCase();

      if (lowerPath.endsWith('.kpp')) {
        const kppBuf = await zipEntry.async('arraybuffer');
        const fileNameOnly = relativePath.split('/').pop()!;
        const parsed = await parseKppFile(kppBuf, fileNameOnly, tipMap, patternMap);
        presets.push(parsed);
      } else if (lowerPath.endsWith('.myb')) {
        const mybText = await zipEntry.async('string');
        const fileNameOnly = relativePath.split('/').pop()!;
        const prevUrls = tipMap.get(fileNameOnly.replace(/\.myb$/i, '_prev.png'));
        const parsed = parseMybFile(mybText, fileNameOnly);
        if (prevUrls?.[0]) parsed.iconUrl = prevUrls[0];
        presets.push(parsed);
      } else if (relativePath.endsWith('Shape.png')) {
        const folderPath = relativePath.slice(0, relativePath.lastIndexOf('/'));
        const folderName =
          folderPath.split('/').pop() || file.name.replace(/\.(brush|brushset)$/i, '');
        const shapeUrls = tipMap.get(relativePath);
        const grainUrls = tipMap.get(`${folderPath}/Grain.png`);
        const thumbUrls = tipMap.get(`${folderPath}/QuickLook/Thumbnail.png`);

        presets.push(
          createDefaultBrush({
            name: folderName,
            category: 'Hunbatz Base Brushes',
            sourceFormat: 'procreate',
            shapeTextureUrl: shapeUrls?.[0],
            grainTextureUrl: grainUrls?.[0],
            iconUrl: thumbUrls?.[0] || shapeUrls?.[0],
            grainDepth: grainUrls?.[0] ? 0.45 : 0,
          })
        );
      }
    }

    return presets;
  }

  return [];
}