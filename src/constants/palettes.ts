import { ColorPalette } from '../types/canvas';

export const DEFAULT_PALETTES: ColorPalette[] = [
  {
    id: 'campfire',
    name: 'Campfire',
    isDefault: true,
    colors: [
      '#1b1c24', '#2d2238', '#5c2040', '#9c2f45', '#cf4a30',
      '#e57a38', '#f5b144', '#fae17d', '#fffbd1', '#f0f3f5',
      '#142433', '#1e4856', '#2b7573', '#52a584', '#99cf8e',
      '#dff2a7', '#543d2b', '#7c5335', '#ac7343', '#d99f66',
      '#63474d', '#8a5e62', '#b37d80', '#dba6a7', '#fcdedc',
      '#1c2d37', '#254452', '#32667d', '#4c92b0', '#83c5e0',
    ],
  },
  {
    id: 'ascent',
    name: 'Ascent',
    isDefault: false,
    colors: [
      '#0d1322', '#142850', '#27496d', '#00909e', '#dae1e7',
      '#111d4a', '#ffcf56', '#f45b69', '#6b2737', '#e2c2c6',
      '#101d24', '#1f3c4d', '#326273', '#e39774', '#eee2df',
      '#222831', '#393e46', '#00adb5', '#eeeeee', '#ffd369',
      '#232931', '#4ecca3', '#393e46', '#eeeeee', '#f8f8f8',
      '#1f1d36', '#3f3351', '#864879', '#e9a6a6', '#fbf4e6',
    ],
  },
  {
    id: 'neon_tokyo',
    name: 'Neon Tokyo',
    isDefault: false,
    colors: [
      '#050505', '#0f051d', '#280659', '#6700ff', '#b000ff',
      '#ff007f', '#ff003c', '#ff6b00', '#ffe600', '#00f0ff',
      '#00ff66', '#ffffff', '#2a0845', '#6441a5', '#fe8c00',
      '#f83600', '#7f00ff', '#e100ff', '#00c6ff', '#0072ff',
      '#11998e', '#38ef7d', '#fc4a1a', '#f7b733', '#ff007f',
      '#120136', '#035aa6', '#40bad5', '#fcbf1e', '#e8e8e8',
    ],
  },
  {
    id: 'earthy',
    name: 'Earthy Botanics',
    isDefault: false,
    colors: [
      '#2b2d2f', '#46494c', '#4c5c68', '#1985a1', '#dcdcdd',
      '#2c3531', '#116466', '#d9b08c', '#ffcb9a', '#d1e8e2',
      '#283618', '#606c38', '#fefae0', '#dda15e', '#bc6c25',
      '#343a40', '#495057', '#6c757d', '#adb5bd', '#ced4da',
      '#3d312a', '#694e3d', '#997356', '#c99e7b', '#f2d4b7',
      '#3a5a40', '#588157', '#a3b18a', '#dad7cd', '#ffffff',
    ],
  },
  {
    id: 'pastel_dreams',
    name: 'Pastel Dreams',
    isDefault: false,
    colors: [
      '#ffbebc', '#fff5ba', '#c4faf8', '#dbdcff', '#afcbff',
      '#fed7c3', '#fbe2d5', '#f7edd9', '#ebf2d6', '#def4c6',
      '#fbf8cc', '#fde4cf', '#ffcfd2', '#f1c0e8', '#cfbaf0',
      '#a3c4f3', '#90dbf4', '#8eecf5', '#98f5e1', '#b9fbc0',
      '#ecd4d4', '#e2c4c4', '#c9b1bd', '#7f7b82', '#444554',
      '#e0c3fc', '#8ec5fc', '#fbc2eb', '#a6c1ee', '#fdcbf1',
    ],
  },
];

// Color Math & Conversion Utilities
export interface HSV {
  h: number; // 0-360
  s: number; // 0-100
  v: number; // 0-100
}

export interface RGB {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export function hexToRgb(hex: string): RGB {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const num = parseInt(cleanHex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export function rgbToHsv(r: number, g: number, b: number): HSV {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  let h = 0;
  let s = max === 0 ? 0 : diff / max;
  let v = max;

  if (diff !== 0) {
    if (max === r) {
      h = (60 * ((g - b) / diff) + 360) % 360;
    } else if (max === g) {
      h = (60 * ((b - r) / diff) + 120) % 360;
    } else {
      h = (60 * ((r - g) / diff) + 240) % 360;
    }
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    v: Math.round(v * 100),
  };
}

export function hsvToRgb(h: number, s: number, v: number): RGB {
  h = (h % 360 + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  v = Math.max(0, Math.min(100, v)) / 100;

  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r1 = 0, g1 = 0, b1 = 0;
  if (h >= 0 && h < 60) {
    r1 = c; g1 = x; b1 = 0;
  } else if (h >= 60 && h < 120) {
    r1 = x; g1 = c; b1 = 0;
  } else if (h >= 120 && h < 180) {
    r1 = 0; g1 = c; b1 = x;
  } else if (h >= 180 && h < 240) {
    r1 = 0; g1 = x; b1 = c;
  } else if (h >= 240 && h < 300) {
    r1 = x; g1 = 0; b1 = c;
  } else {
    r1 = c; g1 = 0; b1 = x;
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

export function hexToHsv(hex: string): HSV {
  const rgb = hexToRgb(hex);
  return rgbToHsv(rgb.r, rgb.g, rgb.b);
}

export function hsvToHex(h: number, s: number, v: number): string {
  const rgb = hsvToRgb(h, s, v);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

// Calculate color harmonies based on HSV
export function getHarmonies(hsv: HSV, mode: 'complementary' | 'split' | 'triadic' | 'tetradic' | 'analogous'): string[] {
  const angles: number[] = [];
  switch (mode) {
    case 'complementary':
      angles.push(180);
      break;
    case 'split':
      angles.push(150, 210);
      break;
    case 'triadic':
      angles.push(120, 240);
      break;
    case 'tetradic':
      angles.push(90, 180, 270);
      break;
    case 'analogous':
      angles.push(-30, 30);
      break;
  }

  return angles.map((offset) => {
    const newH = (hsv.h + offset + 360) % 360;
    return hsvToHex(newH, hsv.s, hsv.v);
  });
}
