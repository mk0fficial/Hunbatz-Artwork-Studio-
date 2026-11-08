/**
 * High-Resolution Procedural Nature & Foliage Stamp Generator
 * Generates pure white alpha stamp PNG data URLs for trees, pines, leaf clusters, and grass.
 */

// Helper to create an offscreen canvas in browser or fallback in node
function createStampCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return { canvas, ctx };
}

/**
 * Generates a high-resolution Deciduous Tree silhouette stamp (Oak / Elm)
 */
export function generateDeciduousTreeStamp(): string {
  const size = 320;
  const c = createStampCanvas(size, size);
  if (!c) return '';
  const { canvas, ctx } = c;

  ctx.fillStyle = '#ffffff';

  // 1. Trunk and major roots
  ctx.beginPath();
  ctx.moveTo(150, 310);
  ctx.quadraticCurveTo(154, 250, 156, 180);
  ctx.lineTo(164, 180);
  ctx.quadraticCurveTo(166, 250, 170, 310);
  ctx.quadraticCurveTo(160, 305, 150, 310);
  ctx.fill();

  // Root flares
  ctx.beginPath();
  ctx.moveTo(150, 310);
  ctx.quadraticCurveTo(140, 316, 125, 318);
  ctx.quadraticCurveTo(145, 312, 152, 290);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(170, 310);
  ctx.quadraticCurveTo(180, 316, 195, 318);
  ctx.quadraticCurveTo(175, 312, 168, 290);
  ctx.fill();

  // 2. Primary branches
  const branches = [
    { startX: 158, startY: 180, cpx: 130, cpy: 140, endX: 100, endY: 110, w: 8 },
    { startX: 162, startY: 180, cpx: 190, cpy: 140, endX: 220, endY: 110, w: 8 },
    { startX: 160, startY: 170, cpx: 160, cpy: 120, endX: 160, endY: 80, w: 9 },
    { startX: 135, startY: 145, cpx: 110, cpy: 155, endX: 80, endY: 150, w: 5 },
    { startX: 185, startY: 145, cpx: 210, cpy: 155, endX: 240, endY: 150, w: 5 },
  ];

  ctx.lineCap = 'round';
  ctx.strokeStyle = '#ffffff';
  for (const b of branches) {
    ctx.lineWidth = b.w;
    ctx.beginPath();
    ctx.moveTo(b.startX, b.startY);
    ctx.quadraticCurveTo(b.cpx, b.cpy, b.endX, b.endY);
    ctx.stroke();
  }

  // 3. Dense leafy canopy clusters
  const clusters = [
    { x: 160, y: 70, rx: 55, ry: 45 },
    { x: 120, y: 95, rx: 50, ry: 42 },
    { x: 200, y: 95, rx: 50, ry: 42 },
    { x: 80, y: 135, rx: 48, ry: 40 },
    { x: 240, y: 135, rx: 48, ry: 40 },
    { x: 140, y: 140, rx: 55, ry: 42 },
    { x: 180, y: 140, rx: 55, ry: 42 },
    { x: 160, y: 110, rx: 65, ry: 50 },
    { x: 105, y: 165, rx: 42, ry: 35 },
    { x: 215, y: 165, rx: 42, ry: 35 },
  ];

  for (const cl of clusters) {
    ctx.beginPath();
    ctx.ellipse(cl.x, cl.y, cl.rx, cl.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Textured edge stippling for leafy silhouette
  const seed = 42;
  const pseudoRand = (i: number) => {
    const x = Math.sin(seed + i * 99.13) * 10000;
    return x - Math.floor(x);
  };

  for (let i = 0; i < 280; i++) {
    const angle = pseudoRand(i) * Math.PI * 2;
    const cl = clusters[i % clusters.length];
    const rOffset = 0.85 + pseudoRand(i * 3) * 0.35;
    const px = cl.x + Math.cos(angle) * cl.rx * rOffset;
    const py = cl.y + Math.sin(angle) * cl.ry * rOffset;
    const r = 4 + pseudoRand(i * 7) * 9;

    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas.toDataURL('image/png');
}

/**
 * Generates a high-resolution Pine / Conifer Tree silhouette stamp
 */
export function generatePineTreeStamp(): string {
  const size = 320;
  const c = createStampCanvas(size, size);
  if (!c) return '';
  const { canvas, ctx } = c;

  ctx.fillStyle = '#ffffff';

  // 1. Trunk
  ctx.beginPath();
  ctx.moveTo(154, 310);
  ctx.lineTo(157, 40);
  ctx.lineTo(163, 40);
  ctx.lineTo(166, 310);
  ctx.fill();

  // Root flare
  ctx.beginPath();
  ctx.moveTo(154, 310);
  ctx.quadraticCurveTo(145, 316, 135, 318);
  ctx.quadraticCurveTo(150, 312, 155, 290);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(166, 310);
  ctx.quadraticCurveTo(175, 316, 185, 318);
  ctx.quadraticCurveTo(170, 312, 165, 290);
  ctx.fill();

  // 2. Tiered needle branches from spire to base
  const tiers = 11;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const topY = 40 + t * 200;
    const bottomY = topY + 28 + t * 14;
    const halfWidth = 14 + t * 90;

    ctx.beginPath();
    ctx.moveTo(160, topY);
    // Jagged needle foliage contour
    const steps = 7 + i;
    for (let s = 1; s <= steps; s++) {
      const st = s / steps;
      const x = 160 + st * halfWidth;
      const y = topY + st * (bottomY - topY) + ((s % 2 === 0) ? -4 : 4);
      ctx.lineTo(x, y);
    }
    // Bottom curve with jagged teeth
    for (let s = steps; s >= 0; s--) {
      const st = s / steps;
      const x = 160 + st * halfWidth * 0.9;
      const y = bottomY - 3 + ((s % 2 === 0) ? 5 : -2);
      ctx.lineTo(x, y);
    }
    // Left side
    for (let s = 1; s <= steps; s++) {
      const st = s / steps;
      const x = 160 - st * halfWidth * 0.9;
      const y = bottomY - 3 + ((s % 2 === 0) ? 5 : -2);
      ctx.lineTo(x, y);
    }
    for (let s = steps; s >= 0; s--) {
      const st = s / steps;
      const x = 160 - st * halfWidth;
      const y = topY + st * (bottomY - topY) + ((s % 2 === 0) ? -4 : 4);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  return canvas.toDataURL('image/png');
}

/**
 * Generates a detailed Leaf Canopy & Branch Cluster stamp
 */
export function generateLeafClusterStamp(): string {
  const size = 280;
  const c = createStampCanvas(size, size);
  if (!c) return '';
  const { canvas, ctx } = c;

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';

  // Delicate twigs
  const twigs = [
    { x1: 140, y1: 270, x2: 140, y2: 170, w: 5 },
    { x1: 140, y1: 200, x2: 80, y2: 130, w: 3.5 },
    { x1: 140, y1: 180, x2: 200, y2: 120, w: 3.5 },
    { x1: 80, y1: 130, x2: 50, y2: 80, w: 2 },
    { x1: 200, y1: 120, x2: 230, y2: 70, w: 2 },
    { x1: 140, y1: 170, x2: 140, y2: 80, w: 3 },
  ];

  for (const tw of twigs) {
    ctx.lineWidth = tw.w;
    ctx.beginPath();
    ctx.moveTo(tw.x1, tw.y1);
    ctx.lineTo(tw.x2, tw.y2);
    ctx.stroke();
  }

  // Draw distinct pointed leaf silhouettes
  const drawLeaf = (cx: number, cy: number, length: number, width: number, angle: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(width, -length * 0.45, 0, -length);
    ctx.quadraticCurveTo(-width, -length * 0.45, 0, 0);
    ctx.fill();
    ctx.restore();
  };

  const leafPoints = [
    { x: 140, y: 70, l: 36, w: 14, a: 0 },
    { x: 128, y: 95, l: 32, w: 13, a: -0.4 },
    { x: 152, y: 95, l: 32, w: 13, a: 0.4 },
    { x: 110, y: 120, l: 34, w: 14, a: -0.7 },
    { x: 170, y: 120, l: 34, w: 14, a: 0.7 },
    { x: 75, y: 80, l: 30, w: 12, a: -0.5 },
    { x: 45, y: 85, l: 28, w: 11, a: -0.9 },
    { x: 60, y: 120, l: 30, w: 12, a: -1.2 },
    { x: 205, y: 70, l: 30, w: 12, a: 0.5 },
    { x: 235, y: 75, l: 28, w: 11, a: 0.9 },
    { x: 220, y: 115, l: 30, w: 12, a: 1.2 },
    { x: 95, y: 160, l: 32, w: 13, a: -1.1 },
    { x: 185, y: 155, l: 32, w: 13, a: 1.1 },
    { x: 140, y: 140, l: 34, w: 14, a: 0.1 },
    { x: 125, y: 170, l: 28, w: 11, a: -0.3 },
    { x: 155, y: 170, l: 28, w: 11, a: 0.3 },
  ];

  for (const lp of leafPoints) {
    drawLeaf(lp.x, lp.y, lp.l, lp.w, lp.a);
  }

  return canvas.toDataURL('image/png');
}

/**
 * Generates a Scattered Foliage & Grass Blade stamp
 */
export function generateGrassScatterStamp(): string {
  const size = 260;
  const c = createStampCanvas(size, size);
  if (!c) return '';
  const { canvas, ctx } = c;

  ctx.fillStyle = '#ffffff';

  // Draw tapered, curved blades of grass
  const drawBlade = (x: number, y: number, height: number, width: number, curve: number) => {
    ctx.beginPath();
    ctx.moveTo(x - width / 2, y);
    ctx.quadraticCurveTo(x + curve * 0.5, y - height * 0.5, x + curve, y - height);
    ctx.quadraticCurveTo(x + curve * 0.5 + width / 4, y - height * 0.5, x + width / 2, y);
    ctx.closePath();
    ctx.fill();
  };

  const blades = [
    { x: 130, y: 240, h: 140, w: 8, c: -18 },
    { x: 140, y: 240, h: 155, w: 9, c: 6 },
    { x: 150, y: 240, h: 135, w: 8, c: 22 },
    { x: 115, y: 242, h: 120, w: 7, c: -32 },
    { x: 165, y: 242, h: 115, w: 7, c: 35 },
    { x: 100, y: 245, h: 95, w: 6, c: -45 },
    { x: 180, y: 245, h: 90, w: 6, c: 48 },
    { x: 85, y: 248, h: 75, w: 5, c: -55 },
    { x: 195, y: 248, h: 70, w: 5, c: 58 },
    { x: 125, y: 244, h: 105, w: 6, c: -10 },
    { x: 145, y: 244, h: 110, w: 6, c: 15 },
  ];

  for (const b of blades) {
    drawBlade(b.x, b.y, b.h, b.w, b.c);
  }

  // Base grass tuft connection
  ctx.beginPath();
  ctx.ellipse(135, 245, 60, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toDataURL('image/png');
}
