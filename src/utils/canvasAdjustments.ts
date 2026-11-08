/**
 * High-performance non-destructive adjustment layer algorithms for Hunbatz Studio
 * Implements: Gradient Map, Selective Color, Color Lookup (3D LUT & .cube parser),
 * Photo Filter, Style Filters (24 Instagram/VSCO presets), Exposure, and Thermal Effect.
 */

// --- 1. GRADIENT MAP ENGINE ---
export interface GradientMapStop {
  id: string;
  offset: number; // 0.0 to 1.0
  color: string;  // #hex
}

export interface GradientMapMidpoint {
  id: string;
  offset: number; // 0.0 to 1.0 between stops
}

export const GRADIENT_MAP_PRESETS: { name: string; stops: GradientMapStop[] }[] = [
  {
    name: 'Cyberpunk Red/Blue',
    stops: [
      { id: 'cp1', offset: 0, color: '#ff0055' },
      { id: 'cp2', offset: 0.5, color: '#160033' },
      { id: 'cp3', offset: 1, color: '#00ffff' },
    ],
  },
  {
    name: 'Thermal',
    stops: [
      { id: 'th1', offset: 0, color: '#000033' },
      { id: 'th2', offset: 0.2, color: '#0000ff' },
      { id: 'th3', offset: 0.45, color: '#00ffff' },
      { id: 'th4', offset: 0.7, color: '#ffff00' },
      { id: 'th5', offset: 0.88, color: '#ff0000' },
      { id: 'th6', offset: 1, color: '#ffffff' },
    ],
  },
  {
    name: 'Classic Duotone',
    stops: [
      { id: 'cd1', offset: 0, color: '#1a103c' },
      { id: 'cd2', offset: 1, color: '#f7e3af' },
    ],
  },
  {
    name: 'Gold & Obsidian',
    stops: [
      { id: 'go1', offset: 0, color: '#090c0b' },
      { id: 'go2', offset: 0.35, color: '#45351a' },
      { id: 'go3', offset: 0.75, color: '#d4af37' },
      { id: 'go4', offset: 1, color: '#fff9e6' },
    ],
  },
  {
    name: 'Sepia Vintage',
    stops: [
      { id: 'sp1', offset: 0, color: '#1a0f00' },
      { id: 'sp2', offset: 0.4, color: '#704214' },
      { id: 'sp3', offset: 0.8, color: '#c39b77' },
      { id: 'sp4', offset: 1, color: '#fbf0d9' },
    ],
  },
];

export function hexToRgb(hex: string): [number, number, number] {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return [0, 0, 0];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export interface GradientOpacityStop {
  id: string;
  offset: number; // 0.0 to 1.0
  opacity: number; // 0.0 to 1.0
}

export function buildGradientMapLut(
  stops: GradientMapStop[],
  shift: number = 0,
  repeat: number = 1,
  reverse: boolean = false,
  midpoints?: number[],
  opacityStops?: GradientOpacityStop[]
): Uint8Array {
  const lut = new Uint8Array(256 * 4);
  if (!stops || stops.length === 0) {
    for (let i = 0; i < 256; i++) {
      const idx = i * 4;
      lut[idx] = i;
      lut[idx + 1] = i;
      lut[idx + 2] = i;
      lut[idx + 3] = 255;
    }
    return lut;
  }

  const sorted = [...stops].sort((a, b) => a.offset - b.offset);
  const sortedOpacity = opacityStops && opacityStops.length > 0
    ? [...opacityStops].sort((a, b) => a.offset - b.offset)
    : null;

  const rep = Math.max(1, Math.min(10, repeat));
  const sh = shift || 0;

  for (let i = 0; i < 256; i++) {
    let t = i / 255;
    if (reverse) {
      t = 1 - t;
    }
    // Apply shift and repeat
    if (t >= 1 && sh === 0) {
      t = 1.0;
    } else {
      t = ((t * rep + sh) % 1 + 1) % 1;
      if (t === 0 && i === 255 && sh === 0) t = 1.0;
    }

    let r = 0, g = 0, b = 0;
    if (t <= sorted[0].offset) {
      [r, g, b] = hexToRgb(sorted[0].color);
    } else if (t >= sorted[sorted.length - 1].offset) {
      [r, g, b] = hexToRgb(sorted[sorted.length - 1].color);
    } else {
      for (let s = 0; s < sorted.length - 1; s++) {
        const s1 = sorted[s];
        const s2 = sorted[s + 1];
        if (t >= s1.offset && t <= s2.offset) {
          const span = s2.offset - s1.offset || 0.0001;
          let factor = (t - s1.offset) / span;

          // Midpoint diamond skewing
          if (midpoints && midpoints[s] !== undefined) {
            const m = Math.max(0.05, Math.min(0.95, midpoints[s]));
            if (Math.abs(m - 0.5) > 0.005) {
              factor = Math.pow(Math.max(0, Math.min(1, factor)), Math.log(0.5) / Math.log(m));
            }
          }

          const c1 = hexToRgb(s1.color);
          const c2 = hexToRgb(s2.color);
          r = c1[0] + (c2[0] - c1[0]) * factor;
          g = c1[1] + (c2[1] - c1[1]) * factor;
          b = c1[2] + (c2[2] - c1[2]) * factor;
          break;
        }
      }
    }

    // Evaluate opacity stop interpolation if present
    let alpha = 255;
    if (sortedOpacity && sortedOpacity.length > 0) {
      if (t <= sortedOpacity[0].offset) {
        alpha = Math.round(sortedOpacity[0].opacity * 255);
      } else if (t >= sortedOpacity[sortedOpacity.length - 1].offset) {
        alpha = Math.round(sortedOpacity[sortedOpacity.length - 1].opacity * 255);
      } else {
        for (let oIdx = 0; oIdx < sortedOpacity.length - 1; oIdx++) {
          const o1 = sortedOpacity[oIdx];
          const o2 = sortedOpacity[oIdx + 1];
          if (t >= o1.offset && t <= o2.offset) {
            const span = o2.offset - o1.offset || 0.0001;
            const factor = (t - o1.offset) / span;
            const aVal = o1.opacity + (o2.opacity - o1.opacity) * factor;
            alpha = Math.round(Math.max(0, Math.min(1, aVal)) * 255);
            break;
          }
        }
      }
    }

    const idx = i * 4;
    lut[idx] = Math.round(r);
    lut[idx + 1] = Math.round(g);
    lut[idx + 2] = Math.round(b);
    lut[idx + 3] = alpha;
  }

  return lut;
}

export function applyGradientMapToImageData(
  imgData: ImageData,
  lut: Uint8Array,
  opacity: number = 1.0
) {
  const d = imgData.data;
  const op = Math.max(0, Math.min(1, opacity));
  const invOp = 1 - op;

  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a === 0) continue;

    // Luminance formula: 0.299R + 0.587G + 0.114B
    const luma = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    const clampedLuma = Math.max(0, Math.min(255, luma));
    const lutIdx = clampedLuma * 4;

    const mappedR = lut[lutIdx];
    const mappedG = lut[lutIdx + 1];
    const mappedB = lut[lutIdx + 2];

    d[i] = Math.round(d[i] * invOp + mappedR * op);
    d[i + 1] = Math.round(d[i + 1] * invOp + mappedG * op);
    d[i + 2] = Math.round(d[i + 2] * invOp + mappedB * op);
  }
}

// --- 2. SELECTIVE COLOR ENGINE ---
export type SelectiveColorChannel =
  | 'reds'
  | 'yellows'
  | 'greens'
  | 'cyans'
  | 'blues'
  | 'magentas'
  | 'whites'
  | 'neutrals'
  | 'blacks'
  | 'custom';

export interface SelectiveColorSettings {
  channel: SelectiveColorChannel;
  channels: Record<
    SelectiveColorChannel,
    { cyan: number; magenta: number; yellow: number; black: number }
  >;
  method: 'relative' | 'absolute';
  targetHex?: string;
  tolerance?: number; // 0.05 to 1.0
}

export function applySelectiveColorToImageData(
  imgData: ImageData,
  settings: SelectiveColorSettings
) {
  const d = imgData.data;
  const method = settings.method || 'relative';
  const customTargetRgb = settings.targetHex ? hexToRgb(settings.targetHex) : [255, 0, 0];
  const tolerance = (settings.tolerance ?? 25) / 100;

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;

    const r = d[i] / 255;
    const g = d[i + 1] / 255;
    const b = d[i + 2] / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let deltaC = 0, deltaM = 0, deltaY = 0, deltaK = 0;

    // Evaluate each channel's weight for this pixel
    const channelWeights: Record<SelectiveColorChannel, number> = {
      reds: Math.max(0, r - Math.max(g, b)),
      yellows: Math.max(0, Math.min(r, g) - b),
      greens: Math.max(0, g - Math.max(r, b)),
      cyans: Math.max(0, Math.min(g, b) - r),
      blues: Math.max(0, b - Math.max(r, g)),
      magentas: Math.max(0, Math.min(r, b) - g),
      whites: max > 0.5 ? Math.max(0, (min - 0.5) * 2) : 0,
      neutrals: max > 0 && min < 1 ? Math.max(0, 1 - Math.abs(max - 0.5) * 2 - delta) : 0,
      blacks: max < 0.5 ? Math.max(0, (0.5 - max) * 2) : 0,
      custom: 0,
    };

    if (settings.targetHex) {
      const dist = Math.hypot(
        d[i] - customTargetRgb[0],
        d[i + 1] - customTargetRgb[1],
        d[i + 2] - customTargetRgb[2]
      ) / 441.67; // max distance is sqrt(255^2 * 3) ~ 441.67
      if (dist <= tolerance) {
        channelWeights.custom = Math.max(0, 1 - dist / (tolerance || 0.001));
      }
    }

    for (const [ch, weight] of Object.entries(channelWeights) as [SelectiveColorChannel, number][]) {
      if (weight <= 0) continue;
      const chSettings = settings.channels?.[ch];
      if (!chSettings) continue;

      const cFactor = (chSettings.cyan || 0) / 100;
      const mFactor = (chSettings.magenta || 0) / 100;
      const yFactor = (chSettings.yellow || 0) / 100;
      const kFactor = (chSettings.black || 0) / 100;

      deltaC += weight * cFactor;
      deltaM += weight * mFactor;
      deltaY += weight * yFactor;
      deltaK += weight * kFactor;
    }

    // Convert RGB to standard CMYK
    const k = 1 - max;
    const c = k < 1 ? (1 - r - k) / (1 - k) : 0;
    const m = k < 1 ? (1 - g - k) / (1 - k) : 0;
    const y = k < 1 ? (1 - b - k) / (1 - k) : 0;

    let newC = c;
    let newM = m;
    let newY = y;
    let newK = k;

    if (method === 'relative') {
      newC += deltaC > 0 ? deltaC * (1 - c) : deltaC * c;
      newM += deltaM > 0 ? deltaM * (1 - m) : deltaM * m;
      newY += deltaY > 0 ? deltaY * (1 - y) : deltaY * y;
      newK += deltaK > 0 ? deltaK * (1 - k) : deltaK * k;
    } else {
      newC += deltaC;
      newM += deltaM;
      newY += deltaY;
      newK += deltaK;
    }

    newC = Math.max(0, Math.min(1, newC));
    newM = Math.max(0, Math.min(1, newM));
    newY = Math.max(0, Math.min(1, newY));
    newK = Math.max(0, Math.min(1, newK));

    // Convert back from CMYK to RGB
    d[i] = Math.round(255 * (1 - newC) * (1 - newK));
    d[i + 1] = Math.round(255 * (1 - newM) * (1 - newK));
    d[i + 2] = Math.round(255 * (1 - newY) * (1 - newK));
  }
}

// --- 3. COLOR LOOKUP / 3D LUT ENGINE & .CUBE PARSER ---
export interface ColorLookupPreset {
  id: string;
  name: string;
  description: string;
  lutTransform: (r: number, g: number, b: number) => [number, number, number];
}

export const CINEMATIC_3D_LUTS: ColorLookupPreset[] = [
  {
    id: '3strip',
    name: '3Strip',
    description: 'Vintage 1930s Technicolor saturated primary look',
    lutTransform: (r, g, b) => [
      Math.min(255, r * 1.25),
      Math.min(255, g * 0.95),
      Math.min(255, b * 0.9),
    ],
  },
  {
    id: 'crisp_warm',
    name: 'Crisp Warm',
    description: 'Warm golden highlights and punchy contrast',
    lutTransform: (r, g, b) => [
      Math.min(255, r * 1.15 + 10),
      Math.min(255, g * 1.05 + 5),
      Math.max(0, b * 0.9 - 5),
    ],
  },
  {
    id: 'crisp_winter',
    name: 'Crisp Winter',
    description: 'Cool blue shadows and silver high-key frost',
    lutTransform: (r, g, b) => [
      Math.max(0, r * 0.92 - 4),
      Math.min(255, g * 1.02),
      Math.min(255, b * 1.22 + 12),
    ],
  },
  {
    id: 'drop_blues',
    name: 'DropBlues',
    description: 'Warm retro film tone with suppressed cyan/blue saturation',
    lutTransform: (r, g, b) => [
      Math.min(255, r * 1.1 + 8),
      Math.min(255, g * 1.05 + 4),
      Math.max(0, b * 0.65),
    ],
  },
  {
    id: 'fall_colors',
    name: 'FallColors',
    description: 'Amber, burnt orange, and deep forest hues',
    lutTransform: (r, g, b) => [
      Math.min(255, r * 1.28 + 14),
      Math.min(255, g * 0.98),
      Math.max(0, b * 0.72 - 6),
    ],
  },
  {
    id: 'filmstock_50',
    name: 'FilmStock 50',
    description: 'Low-speed 35mm cinema negative with rich blacks',
    lutTransform: (r, g, b) => [
      Math.min(255, Math.pow(r / 255, 1.1) * 260),
      Math.min(255, Math.pow(g / 255, 1.12) * 255),
      Math.min(255, Math.pow(b / 255, 1.05) * 245),
    ],
  },
  {
    id: 'futuristic_bleak',
    name: 'Futuristic Bleak',
    description: 'Desaturated sci-fi dystopia with steel teal wash',
    lutTransform: (r, g, b) => {
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      return [
        Math.round(luma * 0.85 + 5),
        Math.round(luma * 0.95 + 15),
        Math.round(luma * 1.05 + 25),
      ];
    },
  },
  {
    id: 'horror_blue',
    name: 'Horror Blue',
    description: 'Eerie midnight cold monochromatic tension grade',
    lutTransform: (r, g, b) => {
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      return [
        Math.round(luma * 0.4),
        Math.round(luma * 0.7 + 10),
        Math.min(255, Math.round(luma * 1.25 + 35)),
      ];
    },
  },
  {
    id: 'kodak_5218',
    name: 'Kodak 5218',
    description: 'Legendary 500T Kodak tungsten cinema film emulation',
    lutTransform: (r, g, b) => [
      Math.min(255, r * 1.08 + 12),
      Math.min(255, g * 1.02 + 6),
      Math.max(0, b * 0.92 + 2),
    ],
  },
  {
    id: 'late_sunset',
    name: 'LateSunset',
    description: 'Dramatic twilight magenta/orange split tone',
    lutTransform: (r, g, b) => [
      Math.min(255, r * 1.3 + 18),
      Math.min(255, g * 0.85),
      Math.min(255, b * 1.1 + 8),
    ],
  },
  {
    id: 'moonlight',
    name: 'Moonlight',
    description: 'Deep navy night with crisp silvery pale highlights',
    lutTransform: (r, g, b) => [
      Math.max(0, r * 0.65),
      Math.min(255, g * 0.8 + 10),
      Math.min(255, b * 1.2 + 28),
    ],
  },
  {
    id: 'night_from_day',
    name: 'NightFromDay',
    description: 'Day-for-night Hollywood filter with deep crushed shadows',
    lutTransform: (r, g, b) => {
      const luma = Math.pow((0.299 * r + 0.587 * g + 0.114 * b) / 255, 1.4) * 180;
      return [Math.round(luma * 0.5), Math.round(luma * 0.75 + 10), Math.round(luma + 20)];
    },
  },
  {
    id: 'teal_orange',
    name: 'TealOrange',
    description: 'Blockbuster Hollywood teal shadows and warm orange skin tones',
    lutTransform: (r, g, b) => {
      const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (luma > 0.5) {
        return [Math.min(255, r * 1.25 + 15), Math.min(255, g * 1.05 + 5), Math.max(0, b * 0.8)];
      } else {
        return [Math.max(0, r * 0.75), Math.min(255, g * 1.1 + 10), Math.min(255, b * 1.35 + 20)];
      }
    },
  },
  {
    id: 'tension_green',
    name: 'TensionGreen',
    description: 'Thriller & Matrix style institutional sickly green wash',
    lutTransform: (r, g, b) => [
      Math.max(0, r * 0.85),
      Math.min(255, g * 1.22 + 16),
      Math.max(0, b * 0.85),
    ],
  },
  {
    id: 'candlelight',
    name: 'Candlelight',
    description: 'Intimate flickering amber glow and soft warm shadows',
    lutTransform: (r, g, b) => [
      Math.min(255, r * 1.35 + 22),
      Math.min(255, g * 1.05 + 12),
      Math.max(0, b * 0.6 - 10),
    ],
  },
];

export function parseCubeLut(cubeText: string): {
  size: number;
  data: Float32Array;
} | null {
  try {
    const lines = cubeText.split(/\r?\n/);
    let size = 0;
    const values: number[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      if (line.startsWith('LUT_3D_SIZE')) {
        size = parseInt(line.split(/\s+/)[1], 10);
        continue;
      }

      const parts = line.split(/\s+/).map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        values.push(parts[0], parts[1], parts[2]);
      }
    }

    if (size > 0 && values.length === size * size * size * 3) {
      return { size, data: new Float32Array(values) };
    }
    return null;
  } catch {
    return null;
  }
}

// --- 4. PHOTO FILTER ENGINE ---
export const PHOTO_FILTER_PRESETS = [
  { name: 'Warming Filter (85)', color: '#ec8a00' },
  { name: 'Warming Filter (LBA)', color: '#fa9600' },
  { name: 'Warming Filter (81)', color: '#ebb113' },
  { name: 'Cooling Filter (80)', color: '#006dff' },
  { name: 'Cooling Filter (LBB)', color: '#005dff' },
  { name: 'Cooling Filter (82)', color: '#00b5ff' },
  { name: 'Red', color: '#ea1c24' },
  { name: 'Orange', color: '#f15a24' },
  { name: 'Yellow', color: '#fff200' },
  { name: 'Green', color: '#00a651' },
  { name: 'Cyan', color: '#00aeef' },
  { name: 'Blue', color: '#2e3192' },
  { name: 'Violet', color: '#92278f' },
  { name: 'Magenta', color: '#ec008c' },
  { name: 'Sepia', color: '#ae8547' },
  { name: 'Deep Emerald', color: '#006837' },
  { name: 'Underwater', color: '#00a896' },
];

export function applyPhotoFilterToImageData(
  imgData: ImageData,
  filterHex: string,
  density: number = 25,
  preserveLuminosity: boolean = true
) {
  const d = imgData.data;
  const [fr, fg, fb] = hexToRgb(filterHex);
  const factor = Math.max(0, Math.min(100, density)) / 100;
  const invFactor = 1 - factor;

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;

    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const origLuma = 0.299 * r + 0.587 * g + 0.114 * b;

    let nr = r * invFactor + fr * factor;
    let ng = g * invFactor + fg * factor;
    let nb = b * invFactor + fb * factor;

    if (preserveLuminosity) {
      const newLuma = 0.299 * nr + 0.587 * ng + 0.114 * nb;
      const lumaRatio = newLuma > 0.001 ? origLuma / newLuma : 1.0;
      nr *= lumaRatio;
      ng *= lumaRatio;
      nb *= lumaRatio;
    }

    d[i] = Math.max(0, Math.min(255, Math.round(nr)));
    d[i + 1] = Math.max(0, Math.min(255, Math.round(ng)));
    d[i + 2] = Math.max(0, Math.min(255, Math.round(nb)));
  }
}

// --- 5. STYLE FILTERS ENGINE (24 INSTAGRAM/VSCO PRESETS) ---
export interface StyleFilterDefinition {
  id: string;
  name: string;
  apply: (r: number, g: number, b: number) => [number, number, number];
}

export const STYLE_FILTERS_24: StyleFilterDefinition[] = [
  {
    id: 'clarendon',
    name: 'Clarendon',
    apply: (r, g, b) => [
      Math.min(255, Math.pow(r / 255, 0.9) * 265),
      Math.min(255, Math.pow(g / 255, 0.95) * 255),
      Math.min(255, Math.pow(b / 255, 0.85) * 270),
    ],
  },
  {
    id: 'gingham',
    name: 'Gingham',
    apply: (r, g, b) => [
      Math.min(255, r * 0.95 + 20),
      Math.min(255, g * 0.92 + 22),
      Math.min(255, b * 0.98 + 30),
    ],
  },
  {
    id: 'moon',
    name: 'Moon',
    apply: (r, g, b) => {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const c = Math.min(255, Math.pow(lum / 255, 1.2) * 255 + 10);
      return [c, c, c];
    },
  },
  {
    id: 'lark',
    name: 'Lark',
    apply: (r, g, b) => [
      Math.max(0, r * 0.9 - 5),
      Math.min(255, g * 1.15 + 8),
      Math.min(255, b * 1.25 + 15),
    ],
  },
  {
    id: 'reyes',
    name: 'Reyes',
    apply: (r, g, b) => [
      Math.min(255, r * 0.9 + 35),
      Math.min(255, g * 0.88 + 32),
      Math.min(255, b * 0.82 + 25),
    ],
  },
  {
    id: 'juno',
    name: 'Juno',
    apply: (r, g, b) => [
      Math.min(255, r * 1.2 + 10),
      Math.min(255, g * 1.05 + 5),
      Math.min(255, b * 0.85 + 15),
    ],
  },
  {
    id: 'slumber',
    name: 'Slumber',
    apply: (r, g, b) => [
      Math.min(255, r * 0.9 + 25),
      Math.min(255, g * 0.85 + 20),
      Math.min(255, b * 0.8 + 15),
    ],
  },
  {
    id: 'crema',
    name: 'Crema',
    apply: (r, g, b) => [
      Math.min(255, r * 1.05 + 12),
      Math.min(255, g * 1.02 + 10),
      Math.min(255, b * 0.95 + 8),
    ],
  },
  {
    id: 'ludwig',
    name: 'Ludwig',
    apply: (r, g, b) => [
      Math.min(255, r * 1.18 + 5),
      Math.min(255, g * 1.02),
      Math.min(255, b * 0.98),
    ],
  },
  {
    id: 'aden',
    name: 'Aden',
    apply: (r, g, b) => [
      Math.min(255, r * 0.95 + 28),
      Math.min(255, g * 0.92 + 25),
      Math.min(255, b * 0.98 + 35),
    ],
  },
  {
    id: 'perpetua',
    name: 'Perpetua',
    apply: (r, g, b) => [
      Math.min(255, r * 0.95 + 5),
      Math.min(255, g * 1.12 + 12),
      Math.min(255, b * 1.08 + 15),
    ],
  },
  {
    id: 'amaro',
    name: 'Amaro',
    apply: (r, g, b) => [
      Math.min(255, r * 1.15 + 18),
      Math.min(255, g * 1.1 + 15),
      Math.min(255, b * 1.05 + 20),
    ],
  },
  {
    id: 'mayfair',
    name: 'Mayfair',
    apply: (r, g, b) => [
      Math.min(255, r * 1.12 + 15),
      Math.min(255, g * 0.98 + 8),
      Math.min(255, b * 1.05 + 12),
    ],
  },
  {
    id: 'rise',
    name: 'Rise',
    apply: (r, g, b) => [
      Math.min(255, r * 1.2 + 20),
      Math.min(255, g * 1.08 + 12),
      Math.min(255, b * 0.9 + 5),
    ],
  },
  {
    id: 'hudson',
    name: 'Hudson',
    apply: (r, g, b) => [
      Math.min(255, r * 0.88),
      Math.min(255, g * 1.02 + 8),
      Math.min(255, b * 1.35 + 25),
    ],
  },
  {
    id: 'valencia',
    name: 'Valencia',
    apply: (r, g, b) => [
      Math.min(255, r * 1.18 + 15),
      Math.min(255, g * 1.12 + 10),
      Math.min(255, b * 0.85 + 5),
    ],
  },
  {
    id: 'x_pro_ii',
    name: 'X-Pro II',
    apply: (r, g, b) => [
      Math.min(255, Math.pow(r / 255, 1.3) * 310),
      Math.min(255, Math.pow(g / 255, 1.1) * 260),
      Math.min(255, Math.pow(b / 255, 0.9) * 230),
    ],
  },
  {
    id: 'sierra',
    name: 'Sierra',
    apply: (r, g, b) => [
      Math.min(255, r * 0.95 + 18),
      Math.min(255, g * 0.92 + 14),
      Math.min(255, b * 0.98 + 22),
    ],
  },
  {
    id: 'willow',
    name: 'Willow',
    apply: (r, g, b) => {
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      return [
        Math.min(255, luma * 0.95 + 15),
        Math.min(255, luma * 0.92 + 12),
        Math.min(255, luma * 1.02 + 20),
      ];
    },
  },
  {
    id: 'lo_fi',
    name: 'Lo-Fi',
    apply: (r, g, b) => [
      Math.min(255, Math.pow(r / 255, 1.4) * 320),
      Math.min(255, Math.pow(g / 255, 1.3) * 300),
      Math.min(255, Math.pow(b / 255, 1.3) * 280),
    ],
  },
  {
    id: 'inkwell',
    name: 'Inkwell',
    apply: (r, g, b) => {
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const v = Math.min(255, Math.pow(luma / 255, 1.4) * 290);
      return [v, v, v];
    },
  },
  {
    id: 'hefe',
    name: 'Hefe',
    apply: (r, g, b) => [
      Math.min(255, r * 1.25 + 15),
      Math.min(255, g * 1.05 + 5),
      Math.max(0, b * 0.85 - 5),
    ],
  },
  {
    id: 'nashville',
    name: 'Nashville',
    apply: (r, g, b) => [
      Math.min(255, r * 1.1 + 25),
      Math.min(255, g * 0.9 + 10),
      Math.min(255, b * 1.15 + 30),
    ],
  },
  {
    id: 'tokyo_cyberpunk',
    name: 'Tokyo Cyberpunk',
    apply: (r, g, b) => [
      Math.min(255, r * 1.35 + 20),
      Math.min(255, g * 0.8),
      Math.min(255, b * 1.4 + 30),
    ],
  },
];

export function applyStyleFilterToImageData(
  imgData: ImageData,
  filterId: string,
  intensity: number = 100,
  vignette: number = 0,
  width: number = 0,
  height: number = 0
) {
  const filter = STYLE_FILTERS_24.find((f) => f.id === filterId) || STYLE_FILTERS_24[0];
  const d = imgData.data;
  const factor = Math.max(0, Math.min(100, intensity)) / 100;
  const invFactor = 1 - factor;
  const vig = Math.max(0, Math.min(100, vignette)) / 100;

  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.hypot(cx, cy) || 1;

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;

    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];

    const [fr, fg, fb] = filter.apply(r, g, b);

    let outR = r * invFactor + fr * factor;
    let outG = g * invFactor + fg * factor;
    let outB = b * invFactor + fb * factor;

    if (vig > 0 && width > 0 && height > 0) {
      const pIdx = i / 4;
      const px = pIdx % width;
      const py = Math.floor(pIdx / width);
      const dist = Math.hypot(px - cx, py - cy) / maxDist;
      const darkFactor = 1 - Math.pow(dist, 1.8) * vig * 0.7;
      outR *= darkFactor;
      outG *= darkFactor;
      outB *= darkFactor;
    }

    d[i] = Math.max(0, Math.min(255, Math.round(outR)));
    d[i + 1] = Math.max(0, Math.min(255, Math.round(outG)));
    d[i + 2] = Math.max(0, Math.min(255, Math.round(outB)));
  }
}

// --- 6. EXPOSURE ENGINE ---
export function applyExposureToImageData(
  imgData: ImageData,
  exposure: number = 0,
  offset: number = 0,
  gamma: number = 1.0
) {
  const d = imgData.data;
  const expMult = Math.pow(2, exposure);
  const invGamma = 1 / Math.max(0.01, gamma);

  // Precompute 256-entry lookup table for speed
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    const norm = i / 255;
    const val = Math.pow(Math.max(0, norm * expMult + offset), invGamma);
    lut[i] = Math.max(0, Math.min(255, Math.round(val * 255)));
  }

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    d[i] = lut[d[i]];
    d[i + 1] = lut[d[i + 1]];
    d[i + 2] = lut[d[i + 2]];
  }
}

// --- 7. THERMAL EFFECT ENGINE (effect.app REFERENCE) ---
export const THERMAL_GRADIENT_TYPES: { id: number; name: string; stops: string[] }[] = [
  { id: 1, name: 'FLIR Ironbow', stops: ['#000020', '#1c0066', '#880088', '#dd3300', '#ffaa00', '#ffffff'] },
  { id: 2, name: 'Cyan-Green-Blue', stops: ['#001122', '#0044aa', '#00ddaa', '#66ff66', '#ffff88', '#ffffff'] },
  { id: 3, name: 'Rainbow Heat', stops: ['#000033', '#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000', '#ffffff'] },
  { id: 4, name: 'Lava Red', stops: ['#110000', '#440000', '#aa1100', '#ff4400', '#ffaa00', '#ffffff'] },
  { id: 5, name: 'Nightvision Green', stops: ['#001100', '#003300', '#008800', '#22dd22', '#88ff88', '#ffffff'] },
  { id: 6, name: 'Arctic Blue', stops: ['#05101a', '#0a2540', '#1f5f8b', '#48bfe3', '#a2d2ff', '#ffffff'] },
];

export function applyThermalEffectToImageData(
  imgData: ImageData,
  options: {
    invert?: boolean;
    shadows?: number;    // -1.0 to 1.0, default -0.45
    midtones?: number;   // -1.0 to 1.0, default -0.11
    highlights?: number; // -1.0 to 1.0, default -0.05
    gradientType?: number; // 1 to 6, default 3
    gradientShift?: number; // 0.0 to 1.0, default 0.0
    gradientRepeat?: number; // 0.1 to 5.0, default 0.7
    showEdges?: boolean; // default true/false
    edgeRange?: number;  // 0.0 to 1.0, default 0.50
    width: number;
    height: number;
  }
) {
  const {
    invert = false,
    shadows = -0.45,
    midtones = -0.11,
    highlights = -0.05,
    gradientType = 3,
    gradientShift = 0.0,
    gradientRepeat = 0.7,
    showEdges = false,
    edgeRange = 0.50,
    width,
    height,
  } = options;

  const gDef = THERMAL_GRADIENT_TYPES.find((g) => g.id === gradientType) || THERMAL_GRADIENT_TYPES[2];
  const gStops = gDef.stops.map((hex, idx) => ({
    id: `th_stop_${idx}`,
    offset: idx / (gDef.stops.length - 1),
    color: hex,
  }));

  const lut = buildGradientMapLut(gStops, gradientShift, gradientRepeat, invert);

  const d = imgData.data;

  // 1. Tonal adjustments (shadows, midtones, highlights)
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;

    let luma = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;

    // Apply polynomial shadow / midtone / highlight modulation
    const sMod = Math.pow(1 - luma, 2) * shadows * 0.5;
    const mMod = 4 * luma * (1 - luma) * midtones * 0.5;
    const hMod = Math.pow(luma, 2) * highlights * 0.5;

    luma = Math.max(0, Math.min(1, luma + sMod + mMod + hMod));

    const lutIdx = Math.round(luma * 255) * 4;
    d[i] = lut[lutIdx];
    d[i + 1] = lut[lutIdx + 1];
    d[i + 2] = lut[lutIdx + 2];
  }

  // 2. Sobel Edge Detection Overlay (if showEdges is true)
  if (showEdges && width > 2 && height > 2) {
    const copy = new Uint8ClampedArray(d);
    const threshold = edgeRange * 128;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        if (copy[idx + 3] === 0) continue;

        // Sobel horizontal & vertical gradients
        const lum = (cx: number, cy: number) => {
          const p = (cy * width + cx) * 4;
          return 0.299 * copy[p] + 0.587 * copy[p + 1] + 0.114 * copy[p + 2];
        };

        const gx =
          -1 * lum(x - 1, y - 1) + 1 * lum(x + 1, y - 1) +
          -2 * lum(x - 1, y)     + 2 * lum(x + 1, y) +
          -1 * lum(x - 1, y + 1) + 1 * lum(x + 1, y + 1);

        const gy =
          -1 * lum(x - 1, y - 1) - 2 * lum(x, y - 1) - 1 * lum(x + 1, y - 1) +
           1 * lum(x - 1, y + 1) + 2 * lum(x, y + 1) + 1 * lum(x + 1, y + 1);

        const edgeMagnitude = Math.hypot(gx, gy);
        if (edgeMagnitude > threshold) {
          // Highlight edge contour in cyan/electric thermal line
          const blend = Math.min(1, edgeMagnitude / 255);
          d[idx] = Math.round(d[idx] * (1 - blend) + 0 * blend);
          d[idx + 1] = Math.round(d[idx + 1] * (1 - blend) + 255 * blend);
          d[idx + 2] = Math.round(d[idx + 2] * (1 - blend) + 255 * blend);
        }
      }
    }
  }
}
