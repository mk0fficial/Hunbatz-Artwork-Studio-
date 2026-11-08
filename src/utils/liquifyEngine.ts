/**
 * Procreate & Krita Grade Liquify Displacement Engine
 * Supports Push, Twirl CW, Twirl CCW, Pinch, Expand, and Reconstruct with bilinear interpolation.
 */

export type LiquifyMode = 'push' | 'twirl_cw' | 'twirl_ccw' | 'pinch' | 'expand' | 'reconstruct';

export interface LiquifyConfig {
  mode: LiquifyMode;
  size: number; // 20 to 300
  strength: number; // 0.1 to 1.0
  momentum: number; // 0 to 1.0
}

/**
 * Apply Liquify brush step onto target canvas
 */
export function applyLiquifyStep(
  targetCtx: CanvasRenderingContext2D,
  originalCanvas: HTMLCanvasElement,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  config: LiquifyConfig
) {
  const w = targetCtx.canvas.width;
  const h = targetCtx.canvas.height;
  const radius = Math.max(10, config.size);
  const radiusSq = radius * radius;

  // Bounding box for affected region
  const minX = Math.max(0, Math.floor(cx - radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxX = Math.min(w, Math.ceil(cx + radius));
  const maxY = Math.min(h, Math.ceil(cy + radius));

  const boxW = maxX - minX;
  const boxH = maxY - minY;
  if (boxW <= 0 || boxH <= 0) return;

  const currentImgData = targetCtx.getImageData(minX, minY, boxW, boxH);
  const currentPixels = currentImgData.data;

  // Clone current pixels to sample from (so reads don't collide with writes)
  const sourcePixels = new Uint8ClampedArray(currentPixels);

  // If reconstruct, we also need original canvas pixels
  let origPixels: Uint8ClampedArray | null = null;
  if (config.mode === 'reconstruct') {
    const oCtx = originalCanvas.getContext('2d');
    if (oCtx) {
      origPixels = oCtx.getImageData(minX, minY, boxW, boxH).data;
    }
  }

  const strength = config.strength * 0.45;

  for (let y = 0; y < boxH; y++) {
    const globalY = minY + y;
    const distY = globalY - cy;

    for (let x = 0; x < boxW; x++) {
      const globalX = minX + x;
      const distX = globalX - cx;
      const dSq = distX * distX + distY * distY;

      if (dSq > radiusSq) continue;

      const dist = Math.sqrt(dSq);
      const normDist = dist / radius; // 0 at center, 1 at boundary
      // Smooth bell curve falloff: (1 - r^2)^2
      const falloff = Math.pow(1 - normDist * normDist, 2) * strength;

      let sampleX = x;
      let sampleY = y;

      switch (config.mode) {
        case 'push': {
          // Displace along stroke velocity vector
          sampleX -= dx * falloff * 2.5;
          sampleY -= dy * falloff * 2.5;
          break;
        }

        case 'twirl_cw':
        case 'twirl_ccw': {
          // Vortex rotation around brush center with boosted angular displacement
          const angle = (config.mode === 'twirl_cw' ? 1 : -1) * falloff * (Math.PI * 0.85 * (1 + (config.momentum || 0)));
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          const rotX = distX * cos - distY * sin;
          const rotY = distX * sin + distY * cos;
          sampleX = cx - minX + rotX;
          sampleY = cy - minY + rotY;
          break;
        }

        case 'pinch': {
          // Pull toward center
          sampleX += distX * falloff * 0.8;
          sampleY += distY * falloff * 0.8;
          break;
        }

        case 'expand': {
          // Push away from center
          sampleX -= distX * falloff * 0.8;
          sampleY -= distY * falloff * 0.8;
          break;
        }

        case 'reconstruct': {
          if (origPixels) {
            const destIdx = (y * boxW + x) * 4;
            const factor = Math.min(1, falloff * 4);
            currentPixels[destIdx] = currentPixels[destIdx] * (1 - factor) + origPixels[destIdx] * factor;
            currentPixels[destIdx + 1] = currentPixels[destIdx + 1] * (1 - factor) + origPixels[destIdx + 1] * factor;
            currentPixels[destIdx + 2] = currentPixels[destIdx + 2] * (1 - factor) + origPixels[destIdx + 2] * factor;
            currentPixels[destIdx + 3] = currentPixels[destIdx + 3] * (1 - factor) + origPixels[destIdx + 3] * factor;
            continue;
          }
          break;
        }
      }

      // Bilinear interpolation for sampleX, sampleY
      const destIdx = (y * boxW + x) * 4;

      const x0 = Math.floor(sampleX);
      const y0 = Math.floor(sampleY);
      const x1 = Math.min(boxW - 1, x0 + 1);
      const y1 = Math.min(boxH - 1, y0 + 1);

      if (x0 < 0 || x0 >= boxW || y0 < 0 || y0 >= boxH) {
        continue;
      }

      const fracX = sampleX - x0;
      const fracY = sampleY - y0;

      const idx00 = (y0 * boxW + x0) * 4;
      const idx10 = (y0 * boxW + x1) * 4;
      const idx01 = (y1 * boxW + x0) * 4;
      const idx11 = (y1 * boxW + x1) * 4;

      for (let c = 0; c < 4; c++) {
        const top = sourcePixels[idx00 + c] * (1 - fracX) + sourcePixels[idx10 + c] * fracX;
        const btm = sourcePixels[idx01 + c] * (1 - fracX) + sourcePixels[idx11 + c] * fracX;
        currentPixels[destIdx + c] = Math.round(top * (1 - fracY) + btm * fracY);
      }
    }
  }

  targetCtx.putImageData(currentImgData, minX, minY);
}
