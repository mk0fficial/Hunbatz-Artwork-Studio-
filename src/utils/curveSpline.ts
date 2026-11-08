// Monotonic cubic spline interpolation for Curves adjustment tool
// Produces monotonic, smooth 256-entry lookup tables (LUT) for RGB channels

export interface SplinePoint {
  x: number; // 0 to 255
  y: number; // 0 to 255
}

/**
 * Generate 256-byte LUT using monotonic cubic Hermite spline interpolation
 */
export function generateMonotonicLut(points: SplinePoint[]): Uint8Array {
  const lut = new Uint8Array(256);
  if (!points || points.length === 0) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }

  // Sort by x
  const sorted = [...points].sort((a, b) => a.x - b.x);

  // Ensure 0 and 255 endpoints
  if (sorted[0].x > 0) {
    sorted.unshift({ x: 0, y: sorted[0].y });
  }
  if (sorted[sorted.length - 1].x < 255) {
    sorted.push({ x: 255, y: sorted[sorted.length - 1].y });
  }

  const n = sorted.length;
  const xs = sorted.map((p) => p.x);
  const ys = sorted.map((p) => p.y);

  // Compute secants (deltas)
  const deltas = new Array(n - 1).fill(0);
  const m = new Array(n).fill(0);

  for (let i = 0; i < n - 1; i++) {
    const dx = xs[i + 1] - xs[i];
    deltas[i] = dx !== 0 ? (ys[i + 1] - ys[i]) / dx : 0;
  }

  // Tangents at internal points
  m[0] = deltas[0];
  for (let i = 1; i < n - 1; i++) {
    m[i] = (deltas[i - 1] + deltas[i]) / 2;
  }
  m[n - 1] = deltas[n - 2];

  // Monotonicity enforcement (Fritsch-Carlson method)
  for (let i = 0; i < n - 1; i++) {
    if (deltas[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const alpha = m[i] / deltas[i];
      const beta = m[i + 1] / deltas[i];
      const dist = alpha * alpha + beta * beta;
      if (dist > 9) {
        const tau = 3 / Math.sqrt(dist);
        m[i] = tau * alpha * deltas[i];
        m[i + 1] = tau * beta * deltas[i];
      }
    }
  }

  // Evaluate cubic Hermite spline for each integer x from 0 to 255
  for (let x = 0; x < 256; x++) {
    let seg = 0;
    while (seg < n - 2 && xs[seg + 1] <= x) {
      seg++;
    }

    const x0 = xs[seg];
    const x1 = xs[seg + 1];
    const y0 = ys[seg];
    const y1 = ys[seg + 1];
    const h = x1 - x0;

    let yVal = y0;
    if (h > 0) {
      const t = (x - x0) / h;
      const t2 = t * t;
      const t3 = t2 * t;

      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;

      yVal = h00 * y0 + h10 * h * m[seg] + h01 * y1 + h11 * h * m[seg + 1];
    }

    lut[x] = Math.max(0, Math.min(255, Math.round(yVal)));
  }

  return lut;
}
