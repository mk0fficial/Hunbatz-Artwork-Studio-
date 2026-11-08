/**
 * High-performance Selection Engine for Procreate Studio PC
 * Supports Rectangle, Ellipse/Circle, and Freehand Lasso selections with mask clipping,
 * marching ants outline, feathering, inversion, and fill.
 */

export type SelectionMode = 'rectangle' | 'ellipse' | 'freehand' | 'magic_wand' | 'none';

export type SelectionCombineMode = 'replace' | 'add' | 'subtract';

export interface SelectionState {
  isActive: boolean;
  mode: SelectionMode;
  path: { x: number; y: number }[];
  isInverse: boolean;
  feather: number; // 0 to 50px
  maskCanvas: HTMLCanvasElement | null;
  bounds: { x: number; y: number; width: number; height: number } | null;
  combineMode?: SelectionCombineMode;
  magicWandTolerance?: number;
  contours?: { x: number; y: number }[][];
}

/**
 * Creates or updates a binary/alpha selection mask canvas
 */
export function generateSelectionMask(
  width: number,
  height: number,
  mode: SelectionMode,
  path: { x: number; y: number }[],
  isInverse: boolean = false,
  featherRadius: number = 0
): { maskCanvas: HTMLCanvasElement; bounds: { x: number; y: number; width: number; height: number } } | null {
  if (path.length < 2 || mode === 'none') return null;

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const ctx = maskCanvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, width, height);

  // If inverted, fill whole mask first
  if (isInverse) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'destination-out';
  } else {
    ctx.fillStyle = '#ffffff';
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  ctx.beginPath();
  if (mode === 'rectangle') {
    const start = path[0];
    const end = path[path.length - 1];
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    ctx.rect(x, y, w, h);
    minX = x; minY = y; maxX = x + w; maxY = y + h;
  } else if (mode === 'ellipse') {
    const start = path[0];
    const end = path[path.length - 1];
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const rx = Math.abs(end.x - start.x) / 2;
    const ry = Math.abs(end.y - start.y) / 2;
    ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
    minX = cx - rx; minY = cy - ry; maxX = cx + rx; maxY = cy + ry;
  } else if (mode === 'freehand') {
    ctx.moveTo(path[0].x, path[0].y);
    minX = path[0].x; maxX = path[0].x;
    minY = path[0].y; maxY = path[0].y;
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].x, path[i].y);
      if (path[i].x < minX) minX = path[i].x;
      if (path[i].x > maxX) maxX = path[i].x;
      if (path[i].y < minY) minY = path[i].y;
      if (path[i].y > maxY) maxY = path[i].y;
    }
    ctx.closePath();
  }

  // Stamp the shape into the mask canvas
  ctx.fill();

  const clampedMinX = Math.max(0, Math.floor(minX));
  const clampedMinY = Math.max(0, Math.floor(minY));
  const clampedMaxX = Math.min(width, Math.ceil(maxX));
  const clampedMaxY = Math.min(height, Math.ceil(maxY));

  const bounds = isInverse
    ? { x: 0, y: 0, width, height }
    : {
        x: clampedMinX,
        y: clampedMinY,
        width: Math.max(1, clampedMaxX - clampedMinX),
        height: Math.max(1, clampedMaxY - clampedMinY),
      };

  // Apply feather if specified
  if (featherRadius > 0) {
    const featheredCanvas = document.createElement('canvas');
    featheredCanvas.width = width;
    featheredCanvas.height = height;
    const fCtx = featheredCanvas.getContext('2d');
    if (fCtx) {
      fCtx.filter = `blur(${Math.min(30, featherRadius)}px)`;
      fCtx.drawImage(maskCanvas, 0, 0);
      return {
        maskCanvas: featheredCanvas,
        bounds,
      };
    }
  }

  return {
    maskCanvas,
    bounds,
  };
}

/**
 * Combines two selection masks based on the combineMode ('replace' | 'add' | 'subtract')
 */
export function combineSelectionMasks(
  baseMask: HTMLCanvasElement,
  newMask: HTMLCanvasElement,
  combineMode: SelectionCombineMode,
  width: number,
  height: number
): { maskCanvas: HTMLCanvasElement; bounds: { x: number; y: number; width: number; height: number } } {
  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = width;
  resultCanvas.height = height;
  const ctx = resultCanvas.getContext('2d');
  if (!ctx) {
    return { maskCanvas: baseMask, bounds: { x: 0, y: 0, width, height } };
  }

  if (combineMode === 'add') {
    ctx.drawImage(baseMask, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(newMask, 0, 0);
  } else if (combineMode === 'subtract') {
    ctx.drawImage(baseMask, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(newMask, 0, 0);
  } else {
    // replace
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(newMask, 0, 0);
  }

  const bounds = getContentBounds(ctx) || { x: 0, y: 0, width, height };
  return { maskCanvas: resultCanvas, bounds };
}

/**
 * High-performance flood fill (Magic Wand) selection mask generator
 */
export function floodFillSelectionMask(
  sourceCanvas: HTMLCanvasElement,
  startX: number,
  startY: number,
  tolerance: number = 25,
  isInverse: boolean = false
): { maskCanvas: HTMLCanvasElement; bounds: { x: number; y: number; width: number; height: number } } | null {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return null;

  const sCtx = sourceCanvas.getContext('2d');
  if (!sCtx) return null;

  const imgData = sCtx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const mCtx = maskCanvas.getContext('2d');
  if (!mCtx) return null;

  const maskImgData = mCtx.createImageData(width, height);
  const maskData = maskImgData.data;

  const startIndex = (startY * width + startX) * 4;
  const startR = data[startIndex];
  const startG = data[startIndex + 1];
  const startB = data[startIndex + 2];
  const startA = data[startIndex + 3];

  const tolSq = ((tolerance / 100) * 255 * 1.5) ** 2;

  // 4-way flood fill with visited tracker
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height * 2);
  let qHead = 0;
  let qTail = 0;

  queue[qTail++] = startX;
  queue[qTail++] = startY;
  visited[startY * width + startX] = 1;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  const colorMatch = (idx: number) => {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];

    const dr = r - startR;
    const dg = g - startG;
    const db = b - startB;
    const da = a - startA;

    return dr * dr + dg * dg + db * db + da * da <= tolSq;
  };

  while (qHead < qTail) {
    const cx = queue[qHead++];
    const cy = queue[qHead++];

    const idx = (cy * width + cx) * 4;
    maskData[idx] = 255;
    maskData[idx + 1] = 255;
    maskData[idx + 2] = 255;
    maskData[idx + 3] = 255;

    if (cx < minX) minX = cx;
    if (cx > maxX) maxX = cx;
    if (cy < minY) minY = cy;
    if (cy > maxY) maxY = cy;

    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];

    for (let i = 0; i < 4; i++) {
      const nx = neighbors[i][0];
      const ny = neighbors[i][1];

      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nPos = ny * width + nx;
        if (!visited[nPos]) {
          visited[nPos] = 1;
          const nIdx = nPos * 4;
          if (colorMatch(nIdx)) {
            queue[qTail++] = nx;
            queue[qTail++] = ny;
          }
        }
      }
    }
  }

  mCtx.putImageData(maskImgData, 0, 0);

  if (isInverse) {
    const invCanvas = document.createElement('canvas');
    invCanvas.width = width;
    invCanvas.height = height;
    const invCtx = invCanvas.getContext('2d');
    if (invCtx) {
      invCtx.fillStyle = '#ffffff';
      invCtx.fillRect(0, 0, width, height);
      invCtx.globalCompositeOperation = 'destination-out';
      invCtx.drawImage(maskCanvas, 0, 0);
      return {
        maskCanvas: invCanvas,
        bounds: { x: 0, y: 0, width, height },
      };
    }
  }

  const bounds = {
    x: Math.max(0, minX),
    y: Math.max(0, minY),
    width: Math.max(1, maxX - minX + 1),
    height: Math.max(1, maxY - minY + 1),
  };

  return { maskCanvas, bounds };
}

/**
 * Checks if a point (x, y) is inside the active selection mask
 */
export function isPointInSelection(maskCanvas: HTMLCanvasElement | null, x: number, y: number): boolean {
  if (!maskCanvas) return true; // No selection = whole canvas is editable
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (px < 0 || px >= maskCanvas.width || py < 0 || py >= maskCanvas.height) return false;

  const ctx = maskCanvas.getContext('2d');
  if (!ctx) return true;
  const p = ctx.getImageData(px, py, 1, 1).data;
  return p[3] > 20; // Check alpha
}

/**
 * Apply the selection mask onto a layer context before drawing, restricting paint
 */
export function applySelectionClip(ctx: CanvasRenderingContext2D, maskCanvas: HTMLCanvasElement) {
  // Use destination-in with mask canvas
  const temp = document.createElement('canvas');
  temp.width = ctx.canvas.width;
  temp.height = ctx.canvas.height;
  const tCtx = temp.getContext('2d');
  if (!tCtx) return;

  tCtx.drawImage(ctx.canvas, 0, 0);
  tCtx.globalCompositeOperation = 'destination-in';
  tCtx.drawImage(maskCanvas, 0, 0);

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(temp, 0, 0);
}

/**
 * Fill selected area with a given color
 */
export function fillSelection(
  targetCtx: CanvasRenderingContext2D,
  maskCanvas: HTMLCanvasElement,
  colorHex: string
) {
  const w = targetCtx.canvas.width;
  const h = targetCtx.canvas.height;
  const fillCanvas = document.createElement('canvas');
  fillCanvas.width = w;
  fillCanvas.height = h;
  const fCtx = fillCanvas.getContext('2d');
  if (!fCtx) return;

  fCtx.fillStyle = colorHex;
  fCtx.fillRect(0, 0, w, h);
  fCtx.globalCompositeOperation = 'destination-in';
  fCtx.drawImage(maskCanvas, 0, 0);

  targetCtx.drawImage(fillCanvas, 0, 0);
}

/**
 * Clear pixels inside the active selection
 */
export function clearSelection(
  targetCtx: CanvasRenderingContext2D,
  maskCanvas: HTMLCanvasElement
) {
  targetCtx.save();
  targetCtx.globalCompositeOperation = 'destination-out';
  targetCtx.drawImage(maskCanvas, 0, 0);
  targetCtx.restore();
}

/**
 * Extract selected pixels cropped tightly to bounds
 */
export function extractSelectionPatch(
  sourceCanvas: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement,
  bounds: { x: number; y: number; width: number; height: number }
): HTMLCanvasElement {
  const bx = Math.max(0, Math.min(sourceCanvas.width - 1, Math.floor(bounds.x)));
  const by = Math.max(0, Math.min(sourceCanvas.height - 1, Math.floor(bounds.y)));
  const bw = Math.max(1, Math.min(sourceCanvas.width - bx, Math.ceil(bounds.width)));
  const bh = Math.max(1, Math.min(sourceCanvas.height - by, Math.ceil(bounds.height)));

  const patch = document.createElement('canvas');
  patch.width = bw;
  patch.height = bh;
  const ctx = patch.getContext('2d');
  if (!ctx) return patch;

  // Draw source cropped to bounds
  ctx.drawImage(
    sourceCanvas,
    bx, by, bw, bh,
    0, 0, bw, bh
  );
  // Mask by selection
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(
    maskCanvas,
    bx, by, bw, bh,
    0, 0, bw, bh
  );

  return patch;
}

/**
 * Calculate tight bounding box of non-transparent pixels on a layer
 */
export function getContentBounds(ctx: CanvasRenderingContext2D): { x: number; y: number; width: number; height: number } | null {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  let minX = w, minY = h, maxX = -1, maxY = -1;

  // Step by 2 pixels for fast scanning
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const idx = (y * w + x) * 4;
      if (data[idx + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX === -1) return null; // Layer is completely transparent

  const pad = 4;
  const boundX = Math.max(0, minX - pad);
  const boundY = Math.max(0, minY - pad);
  const boundW = Math.min(w - boundX, maxX - minX + pad * 2);
  const boundH = Math.min(h - boundY, maxY - minY + pad * 2);

  return {
    x: boundX,
    y: boundY,
    width: Math.max(1, boundW),
    height: Math.max(1, boundH),
  };
}

export type SelectionPatternType =
  | 'dots'
  | 'halftone'
  | 'grid'
  | 'stripes'
  | 'diagonal'
  | 'checker'
  | 'noise';

export interface PatternFillOptions {
  pattern: SelectionPatternType;
  color: string;
  backgroundColor?: string; // transparent if undefined or empty
  scale: number; // 4 to 64
  opacity: number; // 0.1 to 1
  angle?: number; // 0 to 180 degrees
}

/**
 * Fills the active selection with a generated procedural pattern tile
 * (Dots, Manga Halftone Screentone, Grid, Stripes, Diagonals, Checkerboard, Noise).
 */
export function fillSelectionWithPattern(
  targetCtx: CanvasRenderingContext2D,
  maskCanvas: HTMLCanvasElement,
  options: PatternFillOptions
) {
  const w = targetCtx.canvas.width;
  const h = targetCtx.canvas.height;

  const tileSize = Math.max(4, Math.min(128, Math.round(options.scale || 16)));
  const patCanvas = document.createElement('canvas');
  patCanvas.width = tileSize;
  patCanvas.height = tileSize;
  const patCtx = patCanvas.getContext('2d');
  if (!patCtx) return;

  // Background
  if (options.backgroundColor && options.backgroundColor !== 'transparent') {
    patCtx.fillStyle = options.backgroundColor;
    patCtx.fillRect(0, 0, tileSize, tileSize);
  }

  patCtx.fillStyle = options.color;
  patCtx.strokeStyle = options.color;

  const half = tileSize / 2;

  switch (options.pattern) {
    case 'dots': {
      // Polka dots
      const r = Math.max(1, Math.round(tileSize * 0.25));
      patCtx.beginPath();
      patCtx.arc(half, half, r, 0, Math.PI * 2);
      patCtx.fill();
      break;
    }

    case 'halftone': {
      // Authentic manga screentone: 5-dot stipple array
      const rCenter = Math.max(1, Math.round(tileSize * 0.22));
      const rCorner = Math.max(1, Math.round(tileSize * 0.16));
      patCtx.beginPath();
      patCtx.arc(half, half, rCenter, 0, Math.PI * 2);
      patCtx.fill();

      // 4 corners
      [
        [0, 0],
        [tileSize, 0],
        [0, tileSize],
        [tileSize, tileSize],
      ].forEach(([cx, cy]) => {
        patCtx.beginPath();
        patCtx.arc(cx, cy, rCorner, 0, Math.PI * 2);
        patCtx.fill();
      });
      break;
    }

    case 'grid': {
      patCtx.lineWidth = Math.max(1, Math.round(tileSize / 16));
      patCtx.strokeRect(0, 0, tileSize, tileSize);
      break;
    }

    case 'stripes': {
      patCtx.fillRect(0, 0, half, tileSize);
      break;
    }

    case 'diagonal': {
      patCtx.lineWidth = Math.max(1.5, Math.round(tileSize / 8));
      patCtx.beginPath();
      // Main diagonal and wrap corners
      patCtx.moveTo(0, tileSize);
      patCtx.lineTo(tileSize, 0);
      patCtx.moveTo(-half, half);
      patCtx.lineTo(half, -half);
      patCtx.moveTo(half, tileSize + half);
      patCtx.lineTo(tileSize + half, half);
      patCtx.stroke();
      break;
    }

    case 'checker': {
      patCtx.fillRect(0, 0, half, half);
      patCtx.fillRect(half, half, half, half);
      break;
    }

    case 'noise': {
      const step = Math.max(1, Math.floor(tileSize / 16));
      for (let x = 0; x < tileSize; x += step) {
        for (let y = 0; y < tileSize; y += step) {
          if (Math.random() > 0.45) {
            patCtx.fillRect(x, y, step, step);
          }
        }
      }
      break;
    }
  }

  // Create pattern fill on temporary buffer
  const fillCanvas = document.createElement('canvas');
  fillCanvas.width = w;
  fillCanvas.height = h;
  const fCtx = fillCanvas.getContext('2d');
  if (!fCtx) return;

  const pattern = fCtx.createPattern(patCanvas, 'repeat');
  if (!pattern) return;

  fCtx.save();
  fCtx.globalAlpha = Math.max(0.01, Math.min(1, options.opacity ?? 1));

  if (options.angle && options.angle !== 0) {
    const rad = (options.angle * Math.PI) / 180;
    const matrix = new DOMMatrix().rotateSelf(options.angle);
    pattern.setTransform(matrix);
  }

  fCtx.fillStyle = pattern;
  fCtx.fillRect(0, 0, w, h);
  fCtx.restore();

  // Mask by selection
  fCtx.globalCompositeOperation = 'destination-in';
  fCtx.drawImage(maskCanvas, 0, 0);

  // Paint onto layer context
  targetCtx.drawImage(fillCanvas, 0, 0);
}

/**
 * Marching squares contour extraction directly from maskCanvas
 * Generates accurate compound marching ants paths for Add and Subtract modes,
 * including holes and disjoint islands.
 */
export function extractMaskContours(
  maskCanvas: HTMLCanvasElement,
  bounds?: { x: number; y: number; width: number; height: number } | null,
  step = 3
): { x: number; y: number }[][] {
  const w = maskCanvas.width;
  const h = maskCanvas.height;
  const ctx = maskCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  // Constrain scanning to bounds with padding for performance
  const minX = Math.max(0, Math.floor((bounds?.x ?? 0) - step));
  const minY = Math.max(0, Math.floor((bounds?.y ?? 0) - step));
  const maxX = Math.min(w, Math.ceil((bounds ? bounds.x + bounds.width : w) + step));
  const maxY = Math.min(h, Math.ceil((bounds ? bounds.y + bounds.height : h) + step));

  const scanW = maxX - minX;
  const scanH = maxY - minY;
  if (scanW <= 0 || scanH <= 0) return [];

  const imgData = ctx.getImageData(minX, minY, scanW, scanH);
  const data = imgData.data;

  const isFilled = (gx: number, gy: number): boolean => {
    const lx = gx - minX;
    const ly = gy - minY;
    if (lx < 0 || lx >= scanW || ly < 0 || ly >= scanH) return false;
    return data[(ly * scanW + lx) * 4 + 3] > 30;
  };

  const segments: [{ x: number; y: number }, { x: number; y: number }][] = [];

  for (let y = minY; y < maxY; y += step) {
    for (let x = minX; x < maxX; x += step) {
      const tl = isFilled(x, y) ? 8 : 0;
      const tr = isFilled(x + step, y) ? 4 : 0;
      const br = isFilled(x + step, y + step) ? 2 : 0;
      const bl = isFilled(x, y + step) ? 1 : 0;
      const code = tl | tr | br | bl;

      if (code === 0 || code === 15) continue;

      const top = { x: x + step / 2, y };
      const right = { x: x + step, y: y + step / 2 };
      const bottom = { x: x + step / 2, y: y + step };
      const left = { x, y: y + step / 2 };

      switch (code) {
        case 1:
        case 14:
          segments.push([bottom, left]);
          break;
        case 2:
        case 13:
          segments.push([right, bottom]);
          break;
        case 3:
        case 12:
          segments.push([right, left]);
          break;
        case 4:
        case 11:
          segments.push([top, right]);
          break;
        case 5:
          segments.push([top, right]);
          segments.push([bottom, left]);
          break;
        case 6:
        case 9:
          segments.push([top, bottom]);
          break;
        case 7:
        case 8:
          segments.push([left, top]);
          break;
        case 10:
          segments.push([left, top]);
          segments.push([right, bottom]);
          break;
      }
    }
  }

  if (segments.length === 0) return [];

  const polylines: { x: number; y: number }[][] = [];
  const visited = new Uint8Array(segments.length);

  for (let i = 0; i < segments.length; i++) {
    if (visited[i]) continue;
    visited[i] = 1;

    const poly: { x: number; y: number }[] = [segments[i][0], segments[i][1]];
    let growing = true;

    while (growing) {
      growing = false;
      const head = poly[0];
      const tail = poly[poly.length - 1];

      for (let j = 0; j < segments.length; j++) {
        if (visited[j]) continue;
        const [p1, p2] = segments[j];

        if (Math.hypot(p1.x - tail.x, p1.y - tail.y) <= step * 1.5) {
          visited[j] = 1;
          poly.push(p2);
          growing = true;
          break;
        } else if (Math.hypot(p2.x - tail.x, p2.y - tail.y) <= step * 1.5) {
          visited[j] = 1;
          poly.push(p1);
          growing = true;
          break;
        } else if (Math.hypot(p2.x - head.x, p2.y - head.y) <= step * 1.5) {
          visited[j] = 1;
          poly.unshift(p1);
          growing = true;
          break;
        } else if (Math.hypot(p1.x - head.x, p1.y - head.y) <= step * 1.5) {
          visited[j] = 1;
          poly.unshift(p2);
          growing = true;
          break;
        }
      }
    }

    if (poly.length >= 3) {
      polylines.push(poly);
    }
  }

  return polylines;
}

