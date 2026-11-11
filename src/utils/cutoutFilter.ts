/**
 * PHOTOPEA-PARITY SHARP TRIANGULAR / POLYGONAL CUTOUT ENGINE
 * Generates crisp, straight-edged triangular & polygonal vector facets snapped to image edges
 * and quantized into discrete posterized color levels (eliminating blurry Kuwahara blotches).
 */
export function renderSharpTriangularCutout(
  sourceCanvas: HTMLCanvasElement,
  levels: number = 6,
  simplicity: number = 4,
  fidelity: number = 2
): HTMLCanvasElement {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d', { willReadFrequently: true })!;

  const srcCtx = sourceCanvas.getContext('2d', { willReadFrequently: true })!;
  const srcData = srcCtx.getImageData(0, 0, w, h).data;

  // 1. Compute luminance & Sobel edge gradient so triangle vertices snap to high-contrast contours
  const lum = new Float32Array(w * h);
  for (let i = 0, p = 0; i < srcData.length; i += 4, p++) {
    lum[p] = 0.299 * srcData[i] + 0.587 * srcData[i + 1] + 0.114 * srcData[i + 2];
  }

  const grad = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const gx =
        -lum[idx - w - 1] + lum[idx - w + 1] -
        2 * lum[idx - 1] + 2 * lum[idx + 1] -
        lum[idx + w - 1] + lum[idx + w + 1];
      const gy =
        -lum[idx - w - 1] - 2 * lum[idx - w] - lum[idx - w + 1] +
        lum[idx + w - 1] + 2 * lum[idx + w] + lum[idx + w + 1];
      grad[idx] = Math.hypot(gx, gy);
    }
  }

  // 2. Build an adaptive triangular mesh where cell size scales with Edge Simplicity (0..10)
  // Lower simplicity = finer detailed triangles; Higher simplicity = bold, graphic angular cutouts
  const baseCell = Math.max(6, Math.round(6 + simplicity * 3.6 - (fidelity - 1) * 2.2));
  const cols = Math.ceil(w / baseCell) + 1;
  const rows = Math.ceil(h / baseCell) + 1;

  const verticesX = new Float32Array(cols * rows);
  const verticesY = new Float32Array(cols * rows);

  // Deterministic pseudo-random jitter + edge-gradient attraction
  const searchRadius = Math.max(2, Math.round(baseCell * (0.35 + fidelity * 0.12)));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const vIdx = r * cols + c;
      const baseX = Math.min(w - 1, c * baseCell);
      const baseY = Math.min(h - 1, r * baseCell);

      // Keep border vertices locked to canvas edges
      if (c === 0 || c === cols - 1 || r === 0 || r === rows - 1) {
        verticesX[vIdx] = baseX;
        verticesY[vIdx] = baseY;
        continue;
      }

      // Hash-based organic jitter so vertices aren't on a rigid square grid
      const hash = Math.sin(c * 127.1 + r * 311.7) * 43758.5453;
      const jx = ((hash - Math.floor(hash)) - 0.5) * baseCell * 0.55;
      const hash2 = Math.sin(c * 269.5 + r * 183.3) * 43758.5453;
      const jy = ((hash2 - Math.floor(hash2)) - 0.5) * baseCell * 0.55;

      let bestX = Math.max(1, Math.min(w - 2, Math.round(baseX + jx)));
      let bestY = Math.max(1, Math.min(h - 2, Math.round(baseY + jy)));
      let maxG = grad[bestY * w + bestX];

      // Snap vertex toward strongest nearby edge contour (controlled by Edge Fidelity 1..3)
      const step = fidelity >= 3 ? 1 : 2;
      for (let dy = -searchRadius; dy <= searchRadius; dy += step) {
        const ny = bestY + dy;
        if (ny < 1 || ny >= h - 1) continue;
        for (let dx = -searchRadius; dx <= searchRadius; dx += step) {
          const nx = bestX + dx;
          if (nx < 1 || nx >= w - 1) continue;
          const g = grad[ny * w + nx];
          if (g > maxG * 1.15 && g > 38) {
            maxG = g;
            bestX = nx;
            bestY = ny;
          }
        }
      }

      verticesX[vIdx] = bestX;
      verticesY[vIdx] = bestY;
    }
  }

  // 3. Quantization helper for Number of Levels (2..8)
  const numLevels = Math.max(2, Math.min(16, Math.round(levels)));
  const qStep = 255 / (numLevels - 1);

  const sampleAndQuantizeTriangle = (
    x0: number, y0: number,
    x1: number, y1: number,
    x2: number, y2: number
  ): string | null => {
    // Sample 4 interior points (centroid + 3 mid-vertex points) for accurate facet color
    const cx = (x0 + x1 + x2) / 3;
    const cy = (y0 + y1 + y2) / 3;
    const pts = [
      [cx, cy],
      [(cx + x0) * 0.5, (cy + y0) * 0.5],
      [(cx + x1) * 0.5, (cy + y1) * 0.5],
      [(cx + x2) * 0.5, (cy + y2) * 0.5],
    ];

    let rSum = 0, gSum = 0, bSum = 0, aSum = 0, count = 0;
    for (let i = 0; i < pts.length; i++) {
      const sx = Math.max(0, Math.min(w - 1, Math.round(pts[i][0])));
      const sy = Math.max(0, Math.min(h - 1, Math.round(pts[i][1])));
      const pIdx = (sy * w + sx) * 4;
      const a = srcData[pIdx + 3];
      if (a > 12) {
        rSum += srcData[pIdx];
        gSum += srcData[pIdx + 1];
        bSum += srcData[pIdx + 2];
        aSum += a;
        count++;
      }
    }

    if (count === 0) return null;

    const avgR = rSum / count;
    const avgG = gSum / count;
    const avgB = bSum / count;
    const avgA = aSum / (pts.length * 255);

    // Quantize luminance while preserving rich chromatic hue (Photopea Cutout style)
    const qr = Math.min(255, Math.max(0, Math.round(Math.round(avgR / qStep) * qStep)));
    const qg = Math.min(255, Math.max(0, Math.round(Math.round(avgG / qStep) * qStep)));
    const qb = Math.min(255, Math.max(0, Math.round(Math.round(avgB / qStep) * qStep)));

    return `rgba(${qr},${qg},${qb},${avgA.toFixed(3)})`;
  };

  // 4. Render crisp, gap-free triangles choosing the diagonal that aligns with local edges
  outCtx.save();
  outCtx.lineJoin = 'miter';
  outCtx.lineWidth = 0.65;

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const i00 = r * cols + c;
      const i10 = r * cols + (c + 1);
      const i01 = (r + 1) * cols + c;
      const i11 = (r + 1) * cols + (c + 1);

      const x00 = verticesX[i00], y00 = verticesY[i00];
      const x10 = verticesX[i10], y10 = verticesY[i10];
      const x01 = verticesX[i01], y01 = verticesY[i01];
      const x11 = verticesX[i11], y11 = verticesY[i11];

      // Choose diagonal split (00->11 vs 10->01) based on smaller luminance difference along diagonal
      const p00 = (Math.round(y00) * w + Math.round(x00));
      const p11 = (Math.round(y11) * w + Math.round(x11));
      const p10 = (Math.round(y10) * w + Math.round(x10));
      const p01 = (Math.round(y01) * w + Math.round(x01));

      const diffDiagA = Math.abs(lum[p00] - lum[p11]);
      const diffDiagB = Math.abs(lum[p10] - lum[p01]);

      if (diffDiagA <= diffDiagB) {
        // Split along (00 -> 11)
        const col1 = sampleAndQuantizeTriangle(x00, y00, x10, y10, x11, y11);
        if (col1) {
          outCtx.fillStyle = col1;
          outCtx.strokeStyle = col1;
          outCtx.beginPath();
          outCtx.moveTo(x00, y00);
          outCtx.lineTo(x10, y10);
          outCtx.lineTo(x11, y11);
          outCtx.closePath();
          outCtx.fill();
          outCtx.stroke();
        }
        const col2 = sampleAndQuantizeTriangle(x00, y00, x11, y11, x01, y01);
        if (col2) {
          outCtx.fillStyle = col2;
          outCtx.strokeStyle = col2;
          outCtx.beginPath();
          outCtx.moveTo(x00, y00);
          outCtx.lineTo(x11, y11);
          outCtx.lineTo(x01, y01);
          outCtx.closePath();
          outCtx.fill();
          outCtx.stroke();
        }
      } else {
        // Split along (10 -> 01)
        const col1 = sampleAndQuantizeTriangle(x00, y00, x10, y10, x01, y01);
        if (col1) {
          outCtx.fillStyle = col1;
          outCtx.strokeStyle = col1;
          outCtx.beginPath();
          outCtx.moveTo(x00, y00);
          outCtx.lineTo(x10, y10);
          outCtx.lineTo(x01, y01);
          outCtx.closePath();
          outCtx.fill();
          outCtx.stroke();
        }
        const col2 = sampleAndQuantizeTriangle(x10, y10, x11, y11, x01, y01);
        if (col2) {
          outCtx.fillStyle = col2;
          outCtx.strokeStyle = col2;
          outCtx.beginPath();
          outCtx.moveTo(x10, y10);
          outCtx.lineTo(x11, y11);
          outCtx.lineTo(x01, y01);
          outCtx.closePath();
          outCtx.fill();
          outCtx.stroke();
        }
      }
    }
  }
  outCtx.restore();
  return outCanvas;
}
