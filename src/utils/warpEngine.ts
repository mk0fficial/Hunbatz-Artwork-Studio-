/**
 * High-performance 2D Canvas Triangle Texture Warping Engine
 * Powers Perspective Distort (4-Corner Quad) and 4x4 Mesh Warp Grid.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface QuadCorners {
  tl: Point2D;
  tr: Point2D;
  br: Point2D;
  bl: Point2D;
}

export type MeshGrid = Point2D[][]; // 4 rows x 4 columns

/**
 * Creates an initial 4x4 uniform mesh grid
 */
export function createDefaultMeshGrid(x: number, y: number, width: number, height: number): MeshGrid {
  const grid: MeshGrid = [];
  const rows = 4;
  const cols = 4;

  for (let r = 0; r < rows; r++) {
    const rowPoints: Point2D[] = [];
    const v = r / (rows - 1);
    for (let c = 0; c < cols; c++) {
      const u = c / (cols - 1);
      rowPoints.push({
        x: x + u * width,
        y: y + v * height,
      });
    }
    grid.push(rowPoints);
  }

  return grid;
}

/**
 * Bilinear Quad Interpolation for Perspective Distort
 */
export function evaluateQuadPoint(corners: QuadCorners, u: number, v: number): Point2D {
  const { tl, tr, br, bl } = corners;
  const x = (1 - u) * (1 - v) * tl.x + u * (1 - v) * tr.x + u * v * br.x + (1 - u) * v * bl.x;
  const y = (1 - u) * (1 - v) * tl.y + u * (1 - v) * tr.y + u * v * br.y + (1 - u) * v * bl.y;
  return { x, y };
}

/**
 * Bicubic / Bilinear Patch Interpolation for 4x4 Mesh Warp Grid
 */
export function evaluateMeshPoint(grid: MeshGrid, u: number, v: number): Point2D {
  const numRows = grid.length;
  const numCols = grid[0].length;

  // Find cell index
  const cellCol = Math.min(numCols - 2, Math.max(0, Math.floor(u * (numCols - 1))));
  const cellRow = Math.min(numRows - 2, Math.max(0, Math.floor(v * (numRows - 1))));

  const localU = u * (numCols - 1) - cellCol;
  const localV = v * (numRows - 1) - cellRow;

  const tl = grid[cellRow][cellCol];
  const tr = grid[cellRow][cellCol + 1];
  const bl = grid[cellRow + 1][cellCol];
  const br = grid[cellRow + 1][cellCol + 1];

  const x = (1 - localU) * (1 - localV) * tl.x + localU * (1 - localV) * tr.x + localU * localV * br.x + (1 - localU) * localV * bl.x;
  const y = (1 - localU) * (1 - localV) * tl.y + localU * (1 - localV) * tr.y + localU * localV * br.y + (1 - localU) * localV * bl.y;

  return { x, y };
}

/**
 * Exact analytical 2D affine triangle texture rasterizer
 * Maps (sx0, sy0), (sx1, sy1), (sx2, sy2) from source canvas
 * to (dx0, dy0), (dx1, dy1), (dx2, dy2) on destination ctx.
 */
function renderTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  sx0: number, sy0: number,
  sx1: number, sy1: number,
  sx2: number, sy2: number,
  dx0: number, dy0: number,
  dx1: number, dy1: number,
  dx2: number, dy2: number
) {
  // Determinant of the source triangle matrix
  const denom = sx0 * (sy1 - sy2) + sx1 * (sy2 - sy0) + sx2 * (sy0 - sy1);
  if (Math.abs(denom) < 0.00001) return;

  // Triangle centroid for micro-seam expansion (prevents transparent antialiasing hairline cracks)
  const cx = (dx0 + dx1 + dx2) / 3;
  const cy = (dy0 + dy1 + dy2) / 3;
  const pad = 0.45;
  const px0 = dx0 + (dx0 >= cx ? pad : -pad);
  const py0 = dy0 + (dy0 >= cy ? pad : -pad);
  const px1 = dx1 + (dx1 >= cx ? pad : -pad);
  const py1 = dy1 + (dy1 >= cy ? pad : -pad);
  const px2 = dx2 + (dx2 >= cx ? pad : -pad);
  const py2 = dy2 + (dy2 >= cy ? pad : -pad);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(px0, py0);
  ctx.lineTo(px1, py1);
  ctx.lineTo(px2, py2);
  ctx.closePath();
  ctx.clip();

  // Exact 2D affine transform coefficients mapping [sx, sy, 1]^T -> [dx, dy, 1]^T:
  // [ dx ]   [ a  c  e ] [ sx ]
  // [ dy ] = [ b  d  f ] [ sy ]
  // [ 1  ]   [ 0  0  1 ] [ 1  ]
  const a = (dx0 * (sy1 - sy2) + dx1 * (sy2 - sy0) + dx2 * (sy0 - sy1)) / denom;
  const c = (dx0 * (sx2 - sx1) + dx1 * (sx0 - sx2) + dx2 * (sx1 - sx0)) / denom;
  const e = (dx0 * (sx1 * sy2 - sx2 * sy1) + dx1 * (sx2 * sy0 - sx0 * sy2) + dx2 * (sx0 * sy1 - sx1 * sy0)) / denom;

  const b = (dy0 * (sy1 - sy2) + dy1 * (sy2 - sy0) + dy2 * (sy0 - sy1)) / denom;
  const d = (dy0 * (sx2 - sx1) + dy1 * (sx0 - sx2) + dy2 * (sx1 - sx0)) / denom;
  const f = (dy0 * (sx1 * sy2 - sx2 * sy1) + dy1 * (sx2 * sy0 - sx0 * sy2) + dy2 * (sx0 * sy1 - sx1 * sy0)) / denom;

  ctx.transform(a, b, c, d, e, f);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0);
  ctx.restore();
}

/**
 * Render Perspective Distort (4-Corner Quad) onto target canvas
 */
export function renderPerspectiveWarp(
  targetCtx: CanvasRenderingContext2D,
  sourceCanvas: HTMLCanvasElement,
  corners: QuadCorners,
  subdivisions: number = 16
) {
  const sw = sourceCanvas.width;
  const sh = sourceCanvas.height;
  const step = 1 / subdivisions;

  for (let r = 0; r < subdivisions; r++) {
    const v0 = r * step;
    const v1 = (r + 1) * step;
    const sy0 = v0 * sh;
    const sy1 = v1 * sh;

    for (let c = 0; c < subdivisions; c++) {
      const u0 = c * step;
      const u1 = (c + 1) * step;
      const sx0 = u0 * sw;
      const sx1 = u1 * sw;

      const p00 = evaluateQuadPoint(corners, u0, v0);
      const p10 = evaluateQuadPoint(corners, u1, v0);
      const p01 = evaluateQuadPoint(corners, u0, v1);
      const p11 = evaluateQuadPoint(corners, u1, v1);

      // Upper triangle (p00, p10, p01)
      renderTexturedTriangle(
        targetCtx, sourceCanvas,
        sx0, sy0, sx1, sy0, sx0, sy1,
        p00.x, p00.y, p10.x, p10.y, p01.x, p01.y
      );

      // Lower triangle (p10, p11, p01)
      renderTexturedTriangle(
        targetCtx, sourceCanvas,
        sx1, sy0, sx1, sy1, sx0, sy1,
        p10.x, p10.y, p11.x, p11.y, p01.x, p01.y
      );
    }
  }
}

/**
 * Render 4x4 Mesh Warp Grid onto target canvas
 */
export function renderMeshWarp(
  targetCtx: CanvasRenderingContext2D,
  sourceCanvas: HTMLCanvasElement,
  grid: MeshGrid,
  subdivisions: number = 18
) {
  const sw = sourceCanvas.width;
  const sh = sourceCanvas.height;
  const step = 1 / subdivisions;

  for (let r = 0; r < subdivisions; r++) {
    const v0 = r * step;
    const v1 = (r + 1) * step;
    const sy0 = v0 * sh;
    const sy1 = v1 * sh;

    for (let c = 0; c < subdivisions; c++) {
      const u0 = c * step;
      const u1 = (c + 1) * step;
      const sx0 = u0 * sw;
      const sx1 = u1 * sw;

      const p00 = evaluateMeshPoint(grid, u0, v0);
      const p10 = evaluateMeshPoint(grid, u1, v0);
      const p01 = evaluateMeshPoint(grid, u0, v1);
      const p11 = evaluateMeshPoint(grid, u1, v1);

      // Upper triangle
      renderTexturedTriangle(
        targetCtx, sourceCanvas,
        sx0, sy0, sx1, sy0, sx0, sy1,
        p00.x, p00.y, p10.x, p10.y, p01.x, p01.y
      );

      // Lower triangle
      renderTexturedTriangle(
        targetCtx, sourceCanvas,
        sx1, sy0, sx1, sy1, sx0, sy1,
        p10.x, p10.y, p11.x, p11.y, p01.x, p01.y
      );
    }
  }
}

/**
 * Puppet Warp Triangle Definition
 */
export interface PuppetTriangle {
  a: number; // vertex index 0
  b: number; // vertex index 1
  c: number; // vertex index 2
}

export interface PuppetMesh {
  vertices: Point2D[];
  triangles: PuppetTriangle[];
  cols: number;
  rows: number;
}

/**
 * Generates an organic triangular lattice mesh across the layer bounds for Puppet Warp
 */
export function createPuppetMesh(
  x: number,
  y: number,
  width: number,
  height: number,
  cols: number = 12,
  rows: number = 12
): PuppetMesh {
  const vertices: Point2D[] = [];
  const triangles: PuppetTriangle[] = [];

  const w = Math.max(10, width);
  const h = Math.max(10, height);

  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    for (let c = 0; c <= cols; c++) {
      const u = c / cols;
      vertices.push({
        x: x + u * w,
        y: y + v * h,
      });
    }
  }

  const stride = cols + 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i00 = r * stride + c;
      const i10 = r * stride + (c + 1);
      const i01 = (r + 1) * stride + c;
      const i11 = (r + 1) * stride + (c + 1);

      // Alternating diagonals for isotropic deformation
      if ((r + c) % 2 === 0) {
        triangles.push({ a: i00, b: i10, c: i01 });
        triangles.push({ a: i10, b: i11, c: i01 });
      } else {
        triangles.push({ a: i00, b: i10, c: i11 });
        triangles.push({ a: i00, b: i11, c: i01 });
      }
    }
  }

  return { vertices, triangles, cols, rows };
}

/**
 * High-precision Moving Least Squares / Inverse-Distance-Weighted deformation for Puppet Pins
 */
export function deformPuppetMesh(
  pins: { id: string; x: number; y: number; origX: number; origY: number }[],
  originalVertices: Point2D[]
): Point2D[] {
  if (!pins || pins.length === 0) {
    return originalVertices.map((pt) => ({ x: pt.x, y: pt.y }));
  }

  // Single Pin: rigid translation
  if (pins.length === 1) {
    const pin = pins[0];
    const dx = pin.x - pin.origX;
    const dy = pin.y - pin.origY;
    return originalVertices.map((pt) => ({
      x: pt.x + dx,
      y: pt.y + dy,
    }));
  }

  // Multiple Pins: Inverse Distance Weighting with smooth quadratic falloff
  const deformed: Point2D[] = [];
  const epsilon = 100; // prevents division by zero and provides natural stiffness around pins

  for (let i = 0; i < originalVertices.length; i++) {
    const orig = originalVertices[i];
    let totalWeight = 0;
    let dispX = 0;
    let dispY = 0;

    for (let p = 0; p < pins.length; p++) {
      const pin = pins[p];
      const distSq = (orig.x - pin.origX) ** 2 + (orig.y - pin.origY) ** 2;
      const weight = 1 / Math.pow(distSq + epsilon, 1.25);

      const pdx = pin.x - pin.origX;
      const pdy = pin.y - pin.origY;

      dispX += pdx * weight;
      dispY += pdy * weight;
      totalWeight += weight;
    }

    if (totalWeight > 0.000001) {
      deformed.push({
        x: orig.x + dispX / totalWeight,
        y: orig.y + dispY / totalWeight,
      });
    } else {
      deformed.push({ x: orig.x, y: orig.y });
    }
  }

  return deformed;
}

/**
 * Renders the Puppet Warped mesh onto the destination canvas context
 */
export function renderPuppetWarp(
  targetCtx: CanvasRenderingContext2D,
  sourceCanvas: HTMLCanvasElement,
  bounds: { x: number; y: number; width: number; height: number },
  origVertices: Point2D[],
  deformedVertices: Point2D[],
  triangles: PuppetTriangle[]
) {
  const sw = sourceCanvas.width;
  const sh = sourceCanvas.height;

  for (let i = 0; i < triangles.length; i++) {
    const tri = triangles[i];
    const o0 = origVertices[tri.a];
    const o1 = origVertices[tri.b];
    const o2 = origVertices[tri.c];

    const d0 = deformedVertices[tri.a];
    const d1 = deformedVertices[tri.b];
    const d2 = deformedVertices[tri.c];

    // Source local coords
    const sx0 = ((o0.x - bounds.x) / bounds.width) * sw;
    const sy0 = ((o0.y - bounds.y) / bounds.height) * sh;

    const sx1 = ((o1.x - bounds.x) / bounds.width) * sw;
    const sy1 = ((o1.y - bounds.y) / bounds.height) * sh;

    const sx2 = ((o2.x - bounds.x) / bounds.width) * sw;
    const sy2 = ((o2.y - bounds.y) / bounds.height) * sh;

    renderTexturedTriangle(
      targetCtx,
      sourceCanvas,
      sx0, sy0,
      sx1, sy1,
      sx2, sy2,
      d0.x, d0.y,
      d1.x, d1.y,
      d2.x, d2.y
    );
  }
}
