/**
 * VHS Filter & LED Screen Glitch Engine
 * Faithful recreation matching effect.app reference screenshots & parameters.
 */

export interface VhsFilterOptions {
  resolution?: number;      // 64 to 1024, default 469
  distortion?: number;      // 0.00 to 2.00, default 0.92
  colorFringing?: number;   // 0.00 to 5.00, default 2.00
  wobble?: number;          // 0.00 to 5.00, default 2.00
  tapeCrease?: number;      // 0.00 to 1.00, default 0.50
  trackingNoise?: number;   // 0.00 to 5.00, default 2.00
  verticalJump?: number;    // 0.00 to 1.00, default 0.05
  sparkle?: number;         // 0.00 to 2.00, default 1.00
  flicker?: number;         // 0.00 to 1.00, default 0.06
  grain?: number;           // 0.00 to 1.00, default 0.75
}

export function applyVhsFilter(
  srcCanvas: HTMLCanvasElement,
  options: VhsFilterOptions = {}
): HTMLCanvasElement {
  const {
    resolution = 469,
    distortion = 0.92,
    colorFringing = 2.00,
    wobble = 2.00,
    tapeCrease = 0.50,
    trackingNoise = 2.00,
    verticalJump = 0.05,
    sparkle = 1.00,
    flicker = 0.06,
    grain = 0.75,
  } = options;

  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;

  // 1. Horizontal Tape Bandwidth Downsample
  const downW = Math.max(32, Math.min(w, Math.round(resolution)));
  const tempDown = document.createElement('canvas');
  tempDown.width = downW;
  tempDown.height = h;
  const tCtx = tempDown.getContext('2d')!;
  tCtx.drawImage(srcCanvas, 0, 0, downW, h);

  // Read downsampled source pixels
  const srcData = tCtx.getImageData(0, 0, downW, h);
  const sd = srcData.data;

  // Prepare full-resolution target buffer
  const outData = ctx.createImageData(w, h);
  const od = outData.data;

  // Pre-generate noise seeds
  const vRoll = Math.round(verticalJump * h * 0.15);
  const creaseY = Math.round(h * 0.72);
  const creaseHeight = Math.round(tapeCrease * 45);

  const flickerMult = 1.0 + (Math.random() - 0.5) * flicker * 0.4;

  for (let y = 0; y < h; y++) {
    // Vertical jump roll
    const srcY = (y + vRoll + h) % h;

    // Wobble: sinusoidal horizontal displacement
    const wobbleOffset = Math.sin(y * 0.04) * wobble * 3.5 + Math.sin(y * 0.01) * wobble * 2.0;

    // Distortion: random high-frequency line jitter
    const lineJitter = (Math.random() - 0.5) * distortion * 12;

    // Tape crease horizontal tearing
    let creaseDisplacement = 0;
    if (tapeCrease > 0 && Math.abs(y - creaseY) < creaseHeight) {
      const distFromCenter = 1 - Math.abs(y - creaseY) / (creaseHeight || 1);
      creaseDisplacement = Math.sin(distFromCenter * Math.PI) * tapeCrease * 35;
    }

    const totalShiftX = wobbleOffset + lineJitter + creaseDisplacement;

    // Tracking noise at bottom and top head-switching zones
    const isTrackingZone = y > h - 40 || (y < 25 && trackingNoise > 0.5);
    const trackingStatic = isTrackingZone && Math.random() < trackingNoise * 0.25;

    for (let x = 0; x < w; x++) {
      const outIdx = (y * w + x) * 4;

      if (trackingStatic) {
        // High static noise band
        const noiseVal = Math.random() > 0.5 ? 255 : 20;
        od[outIdx] = noiseVal;
        od[outIdx + 1] = noiseVal;
        od[outIdx + 2] = noiseVal;
        od[outIdx + 3] = 255;
        continue;
      }

      // Map x from full width to downsampled width with displacement
      const normX = (x + totalShiftX) / w;
      const sx = Math.max(0, Math.min(downW - 1, Math.round(normX * downW)));

      // Color fringing (Chroma horizontal shift): Red shifts right, Blue shifts left
      const fringeDist = colorFringing * 3.5;
      const rx = Math.max(0, Math.min(downW - 1, Math.round(((x + totalShiftX + fringeDist) / w) * downW)));
      const bx = Math.max(0, Math.min(downW - 1, Math.round(((x + totalShiftX - fringeDist) / w) * downW)));

      const rIdx = (srcY * downW + rx) * 4;
      const gIdx = (srcY * downW + sx) * 4;
      const bIdx = (srcY * downW + bx) * 4;

      let r = sd[rIdx] * flickerMult;
      let g = sd[gIdx + 1] * flickerMult;
      let b = sd[bIdx + 2] * flickerMult;
      let a = sd[gIdx + 3];

      // Analog Magnetic Tape Grain
      if (grain > 0) {
        const gVal = (Math.random() - 0.5) * grain * 70;
        r += gVal;
        g += gVal;
        b += gVal;
      }

      // High-frequency edge sparkle dropouts
      if (sparkle > 0 && Math.random() < sparkle * 0.0015) {
        const sparkVal = Math.random() > 0.5 ? 255 : 0;
        r = sparkVal;
        g = sparkVal;
        b = sparkVal;
      }

      od[outIdx] = Math.max(0, Math.min(255, Math.round(r)));
      od[outIdx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      od[outIdx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      od[outIdx + 3] = a;
    }
  }

  ctx.putImageData(outData, 0, 0);
  return out;
}

export interface LedScreenOptions {
  pixelSize?: number;   // 1.00 to 10.00, default 3.10
  gap?: number;         // 0.00 to 1.00, default 0.00
  pixelBlur?: number;   // 0.00 to 5.00, default 0.00
  rgbMode?: boolean;    // default true (splits into R, G, B sub-pixel bars)
  transparent?: boolean;// default false
}

export function applyLedScreen(
  srcCanvas: HTMLCanvasElement,
  options: LedScreenOptions = {}
): HTMLCanvasElement {
  const {
    pixelSize = 3.10,
    gap = 0.00,
    pixelBlur = 0.00,
    rgbMode = true,
    transparent = false,
  } = options;

  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;

  if (!transparent) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
  }

  // Size of each LED macro cell
  const cellSize = Math.max(2, Math.round(pixelSize * 3));
  const gapPx = Math.round(gap * (cellSize * 0.35));
  const activeW = Math.max(1, cellSize - gapPx);
  const activeH = Math.max(1, cellSize - gapPx);

  // Sample original canvas pixels at cell centers
  const srcCtx = srcCanvas.getContext('2d')!;
  const srcData = srcCtx.getImageData(0, 0, w, h);
  const sd = srcData.data;

  if (pixelBlur > 0) {
    ctx.filter = `blur(${pixelBlur}px)`;
  }

  for (let cy = 0; cy < h; cy += cellSize) {
    for (let cx = 0; cx < w; cx += cellSize) {
      // Sample center of cell
      const sampleX = Math.min(w - 1, cx + Math.floor(cellSize / 2));
      const sampleY = Math.min(h - 1, cy + Math.floor(cellSize / 2));
      const sIdx = (sampleY * w + sampleX) * 4;

      const r = sd[sIdx];
      const g = sd[sIdx + 1];
      const b = sd[sIdx + 2];
      const a = sd[sIdx + 3] / 255;
      if (a === 0) continue;

      ctx.save();
      ctx.globalAlpha = a;

      if (rgbMode) {
        // Split active cell into 3 vertical sub-pixel stripes (Red, Green, Blue)
        const subW = Math.max(1, Math.floor(activeW / 3));
        const subH = activeH;

        // Red stripe
        ctx.fillStyle = `rgb(${r}, 0, 0)`;
        ctx.fillRect(cx, cy, subW, subH);

        // Green stripe
        ctx.fillStyle = `rgb(0, ${g}, 0)`;
        ctx.fillRect(cx + subW, cy, subW, subH);

        // Blue stripe
        ctx.fillStyle = `rgb(0, 0, ${b})`;
        ctx.fillRect(cx + subW * 2, cy, Math.max(1, activeW - subW * 2), subH);
      } else {
        // Uniform color LED tile
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(cx, cy, activeW, activeH);
      }

      ctx.restore();
    }
  }

  ctx.filter = 'none';
  return out;
}
