/**
 * Procedural Brush Stamp Alpha Masks for Professional Brushes
 * Generates transparent white alpha masks that are dynamically tinted by canvas brush rendering.
 */

function createStamp(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): string {
  if (typeof document === 'undefined') {
    return '';
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  draw(ctx);
  return canvas.toDataURL('image/png');
}

// 1. Prismatic Shard Stamp (Faceted geometric crystal fragments)
export const STAMP_PRISMATIC_SHARD = createStamp(128, 128, (ctx) => {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  // Faceted crystal polygon 1
  ctx.beginPath();
  ctx.moveTo(64, 16);
  ctx.lineTo(96, 48);
  ctx.lineTo(84, 112);
  ctx.lineTo(44, 112);
  ctx.lineTo(32, 48);
  ctx.closePath();
  ctx.fill();

  // Internal facet shading
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.beginPath();
  ctx.moveTo(64, 16);
  ctx.lineTo(64, 112);
  ctx.lineTo(32, 48);
  ctx.closePath();
  ctx.fill();

  // Tiny shard satellite particles
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fillRect(16, 28, 8, 8);
  ctx.fillRect(104, 76, 10, 6);
  ctx.fillRect(20, 92, 6, 10);
});

// 2. Faceted Diamond Gem Stamp
export const STAMP_FACETED_GEM = createStamp(128, 128, (ctx) => {
  const cx = 64, cy = 64, r = 50;
  // Brilliant cut outer circle
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fill();

  // Star facets
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
    ctx.stroke();
  }

  // Inner table octagon
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4;
    const px = cx + Math.cos(ang) * (r * 0.45);
    const py = cy + Math.sin(ang) * (r * 0.45);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fill();
});

// 3. Multi-Tine Rake & Hair Fur Stamp
export const STAMP_HAIR_RAKE = createStamp(128, 64, (ctx) => {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  const tines = 7;
  for (let i = 0; i < tines; i++) {
    const x = 16 + i * 16;
    ctx.beginPath();
    ctx.ellipse(x, 32, 3, 24, 0, 0, Math.PI * 2);
    ctx.fill();
  }
});

// 4. Foliage & Leaves Cluster Stamp
export const STAMP_FOLIAGE_LEAVES = createStamp(128, 128, (ctx) => {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  const leaves = [
    { x: 64, y: 36, ang: -0.4, w: 20, h: 36 },
    { x: 42, y: 70, ang: 0.6, w: 18, h: 32 },
    { x: 86, y: 74, ang: -0.7, w: 19, h: 34 },
    { x: 64, y: 92, ang: 0.2, w: 17, h: 28 },
  ];
  for (const l of leaves) {
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(l.ang);
    ctx.beginPath();
    ctx.ellipse(0, 0, l.w / 2, l.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
});

// 5. Cloud & Smoke Puff Stamp
export const STAMP_CLOUD_PUFF = createStamp(128, 128, (ctx) => {
  const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 60);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();

  // Fluffy sub-puffs
  const puffs = [
    { x: 44, y: 52, r: 28 },
    { x: 80, y: 48, r: 26 },
    { x: 50, y: 80, r: 24 },
    { x: 78, y: 76, r: 25 },
  ];
  for (const p of puffs) {
    const pGrad = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, p.r);
    pGrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
    pGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
});

// 6. Sponge Stipple & Rock Noise Grain Stamp
export const STAMP_SPONGE_STIPPLE = createStamp(128, 128, (ctx) => {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  const count = 180;
  for (let i = 0; i < count; i++) {
    const r = Math.sqrt(Math.random()) * 56;
    const theta = Math.random() * Math.PI * 2;
    const x = 64 + Math.cos(theta) * r;
    const y = 64 + Math.sin(theta) * r;
    const dotR = 0.8 + Math.random() * 2.2;
    ctx.beginPath();
    ctx.arc(x, y, dotR, 0, Math.PI * 2);
    ctx.fill();
  }
});
