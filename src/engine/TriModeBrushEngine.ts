import { UniversalBrushPreset, ToolMode, CurvePoint } from '../types/brush';
import { getCanvasCompositeOperation } from '../utils/blendModes';

export function evaluateCurve(curve: CurvePoint[], input: number): number {
  if (!curve || curve.length === 0) return 1;
  const clamped = Math.max(0, Math.min(1, input));
  for (let i = 0; i < curve.length - 1; i++) {
    const p0 = curve[i];
    const p1 = curve[i + 1];
    if (clamped >= p0.x && clamped <= p1.x) {
      const t = (clamped - p0.x) / Math.max(0.0001, p1.x - p0.x);
      return p0.y + t * (p1.y - p0.y);
    }
  }
  return curve[curve.length - 1].y;
}

export class TriModeBrushEngine {
  private tipCache = new Map<string, HTMLImageElement>();
  private pickupCanvas: HTMLCanvasElement;
  private pickupCtx: CanvasRenderingContext2D;
  private dabCanvas: HTMLCanvasElement;
  private dabCtx: CanvasRenderingContext2D;

  constructor() {
    this.pickupCanvas = document.createElement('canvas');
    this.pickupCanvas.width = 256;
    this.pickupCanvas.height = 256;
    this.pickupCtx = this.pickupCanvas.getContext('2d', { willReadFrequently: true })!;

    this.dabCanvas = document.createElement('canvas');
    this.dabCanvas.width = 256;
    this.dabCanvas.height = 256;
    this.dabCtx = this.dabCanvas.getContext('2d')!;
  }

  public preloadTexture(url?: string): Promise<HTMLImageElement | null> {
    if (!url) return Promise.resolve(null);
    if (this.tipCache.has(url)) return Promise.resolve(this.tipCache.get(url)!);
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.tipCache.set(url, img);
        resolve(img);
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  public evaluateCurve(curve: CurvePoint[], input: number): number {
    return evaluateCurve(curve, input);
  }

  public renderStrokeSegment(
    ctx: CanvasRenderingContext2D,
    preset: UniversalBrushPreset,
    mode: ToolMode,
    colorHex: string,
    p0: { x: number; y: number; pressure: number },
    p1: { x: number; y: number; pressure: number }
  ) {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const dist = Math.hypot(dx, dy);
    const strokeAngle = Math.atan2(dy, dx);

    const stepSize = Math.max(1, preset.baseSize * preset.spacing);
    const steps = Math.max(1, Math.ceil(dist / stepSize));

    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const x = p0.x + dx * t;
      const y = p0.y + dy * t;
      const pressure = p0.pressure + (p1.pressure - p0.pressure) * t;

      const sizeMult = this.evaluateCurve(preset.sizeByPressure, pressure);
      const opacityMult = this.evaluateCurve(preset.opacityByPressure, pressure);

      const radius = Math.max(1, (preset.baseSize * sizeMult) / 2);
      const dabSize = Math.ceil(radius * 2);
      const alpha = Math.max(0.01, Math.min(1, preset.baseOpacity * opacityMult));

      // Calculate Jitter
      const jLat = (Math.random() - 0.5) * 2 * (preset.jitterLateral || 0) * radius;
      const jLin = (Math.random() - 0.5) * 2 * (preset.jitterLinear || 0) * radius;
      const dabX = x + Math.cos(strokeAngle + Math.PI / 2) * jLat + Math.cos(strokeAngle) * jLin;
      const dabY = y + Math.sin(strokeAngle + Math.PI / 2) * jLat + Math.sin(strokeAngle) * jLin;

      // Calculate Rotation
      let angleRad = ((preset.angle || 0) * Math.PI) / 180;
      if (preset.followStroke) angleRad += strokeAngle;
      if (preset.scatter > 0) {
        angleRad += ((Math.random() - 0.5) * preset.scatter * Math.PI) / 180;
      }

      // Prepare Dab Stamp Mask on dabCanvas
      if (this.dabCanvas.width !== dabSize || this.dabCanvas.height !== dabSize) {
        this.dabCanvas.width = dabSize;
        this.dabCanvas.height = dabSize;
      }
      this.dabCtx.clearRect(0, 0, dabSize, dabSize);

      this.dabCtx.save();
      this.dabCtx.translate(dabSize / 2, dabSize / 2);
      this.dabCtx.rotate(angleRad);
      this.dabCtx.scale(
        preset.flipX ? -1 : 1,
        (preset.flipY ? -1 : 1) * Math.max(0.05, Math.min(1, preset.roundness || 1))
      );

      const shapeImg = preset.shapeTextureUrl ? this.tipCache.get(preset.shapeTextureUrl) : null;
      if (shapeImg) {
        this.dabCtx.drawImage(shapeImg, -radius, -radius, dabSize, dabSize);
      } else {
        const grad = this.dabCtx.createRadialGradient(
          0,
          0,
          radius * Math.max(0, Math.min(0.99, preset.hardness * 0.9)),
          0,
          0,
          radius
        );
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        this.dabCtx.fillStyle = grad;
        this.dabCtx.beginPath();
        this.dabCtx.arc(0, 0, radius, 0, Math.PI * 2);
        this.dabCtx.fill();
      }
      this.dabCtx.restore();

      // Apply Grain Texture ONLY if explicitly present and grainDepth > 0
      const grainImg = preset.grainTextureUrl ? this.tipCache.get(preset.grainTextureUrl) : null;
      if (grainImg && (preset.grainDepth || 0) > 0) {
        this.dabCtx.save();
        this.dabCtx.globalCompositeOperation = 'source-in';
        this.dabCtx.globalAlpha = 1 - preset.grainDepth * 0.5;
        this.dabCtx.drawImage(
          grainImg,
          (dabX % grainImg.width + grainImg.width) % grainImg.width,
          (dabY % grainImg.height + grainImg.height) % grainImg.height,
          dabSize * (preset.grainScale || 1),
          dabSize * (preset.grainScale || 1),
          0,
          0,
          dabSize,
          dabSize
        );
        this.dabCtx.restore();
      }

      // TRI-MODE EXECUTION: PAINT vs SMUDGE vs ERASER
      if (mode === 'eraser') {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = alpha;
        ctx.drawImage(this.dabCanvas, dabX - radius, dabY - radius);
        ctx.restore();
      } else if (mode === 'smudge') {
        // Sample pickup buffer from previous dab coordinates
        if (i === 0) {
          if (this.pickupCanvas.width !== dabSize || this.pickupCanvas.height !== dabSize) {
            this.pickupCanvas.width = dabSize;
            this.pickupCanvas.height = dabSize;
          }
          this.pickupCtx.clearRect(0, 0, dabSize, dabSize);
          try {
            this.pickupCtx.drawImage(
              ctx.canvas,
              p0.x - radius,
              p0.y - radius,
              dabSize,
              dabSize,
              0,
              0,
              dabSize,
              dabSize
            );
          } catch {}
        }

        // Mask the sampled pickup buffer with current brush tip shape
        this.dabCtx.save();
        this.dabCtx.globalCompositeOperation = 'source-in';
        this.dabCtx.drawImage(this.pickupCanvas, 0, 0, dabSize, dabSize);
        this.dabCtx.restore();

        // Stamp smudged pixels onto main canvas
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = alpha * Math.max(0.15, preset.smudgePull || 0.5);
        ctx.drawImage(this.dabCanvas, dabX - radius, dabY - radius);
        ctx.restore();

        // Update pickup buffer for next step (rolling smudgeLength decay)
        this.pickupCtx.globalAlpha = Math.max(0.01, 1 - (preset.smudgeLength || 0.5));
        try {
          this.pickupCtx.drawImage(
            ctx.canvas,
            dabX - radius,
            dabY - radius,
            dabSize,
            dabSize,
            0,
            0,
            dabSize,
            dabSize
          );
        } catch {}
      } else {
        // Standard Paint Mode
        this.dabCtx.save();
        this.dabCtx.globalCompositeOperation = 'source-in';
        this.dabCtx.fillStyle = colorHex;
        this.dabCtx.fillRect(0, 0, dabSize, dabSize);
        this.dabCtx.restore();

        ctx.save();
        ctx.globalCompositeOperation = getCanvasCompositeOperation(preset.blendMode || 'source-over');
        ctx.globalAlpha = alpha * (1 - (preset.wetMixDilution || 0) * 0.7);
        ctx.drawImage(this.dabCanvas, dabX - radius, dabY - radius);
        ctx.restore();
      }
    }
  }
}
