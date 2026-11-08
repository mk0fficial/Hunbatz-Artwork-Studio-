import { VectorShapeConfig, Point2D } from '../types/shapes';
import { Brush, StrokePoint } from '../types/canvas';
import { renderStrokeSegment } from './brushEngine';

/**
 * Generates an organic comic speech bubble path:
 * Body is a rounded rectangle, and the tail extends seamlessly from the body to tailTip.
 */
export function buildSpeechBubblePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  tailTip: Point2D,
  tailBaseWidth: number = 30
) {
  const radius = Math.min(r, w / 2, h / 2);
  const left = x;
  const top = y;
  const right = x + w;
  const bottom = y + h;
  const centerX = x + w / 2;

  // Tail base sits along bottom (or nearest side)
  const baseHalf = tailBaseWidth / 2;
  const tailBaseX = Math.max(left + radius + baseHalf, Math.min(right - radius - baseHalf, centerX));

  ctx.beginPath();
  ctx.moveTo(left + radius, top);
  ctx.lineTo(right - radius, top);
  ctx.quadraticCurveTo(right, top, right, top + radius);
  ctx.lineTo(right, bottom - radius);
  ctx.quadraticCurveTo(right, bottom, right - radius, bottom);

  // Bottom edge with tail
  if (tailTip.y >= bottom) {
    ctx.lineTo(tailBaseX + baseHalf, bottom);
    ctx.lineTo(tailTip.x, tailTip.y);
    ctx.lineTo(tailBaseX - baseHalf, bottom);
  } else if (tailTip.x <= left) {
    // Tail on left side
    ctx.lineTo(left + radius, bottom);
  } else {
    ctx.lineTo(left + radius, bottom);
  }

  ctx.quadraticCurveTo(left, bottom, left, bottom - radius);
  ctx.lineTo(left, top + radius);
  ctx.quadraticCurveTo(left, top, left + radius, top);
  ctx.closePath();
}

/**
 * Builds a comic thought bubble path with cloud lobes and trailing circles.
 */
export function buildThoughtBubblePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  lobes: number = 10
) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2;
  const ry = h / 2;

  ctx.beginPath();
  const step = (Math.PI * 2) / lobes;

  for (let i = 0; i < lobes; i++) {
    const angle1 = i * step;
    const angle2 = (i + 1) * step;
    const midAngle = (angle1 + angle2) / 2;

    const x1 = cx + rx * Math.cos(angle1);
    const y1 = cy + ry * Math.sin(angle1);
    const x2 = cx + rx * Math.cos(angle2);
    const y2 = cy + ry * Math.sin(angle2);

    // Control point bulges outward
    const bulge = 1.32;
    const cpX = cx + rx * bulge * Math.cos(midAngle);
    const cpY = cy + ry * bulge * Math.sin(midAngle);

    if (i === 0) {
      ctx.moveTo(x1, y1);
    }
    ctx.quadraticCurveTo(cpX, cpY, x2, y2);
  }
  ctx.closePath();
}

/**
 * Builds a comic explosion/shout bubble with alternating sharp spikes.
 */
export function buildSpikyBubblePath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  numSpikes: number = 16,
  amplitude: number = 0.35
) {
  const rxOuter = w / 2;
  const ryOuter = h / 2;
  const rxInner = rxOuter * (1 - amplitude);
  const ryInner = ryOuter * (1 - amplitude);

  const totalPoints = numSpikes * 2;
  const step = (Math.PI * 2) / totalPoints;

  ctx.beginPath();
  for (let i = 0; i < totalPoints; i++) {
    const angle = i * step;
    const isTip = i % 2 === 0;
    const currRx = isTip ? rxOuter : rxInner;
    const currRy = isTip ? ryOuter : ryInner;

    const px = cx + currRx * Math.cos(angle);
    const py = cy + currRy * Math.sin(angle);

    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}

/**
 * Builds star polygon with N points
 */
export function buildStarPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  points: number = 5
) {
  const step = Math.PI / points;
  ctx.beginPath();
  for (let i = 0; i < 2 * points; i++) {
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = i * step - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function perpendicularDistance(point: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  return Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / mag;
}

/**
 * Ramer-Douglas-Peucker simplification algorithm.
 * Reduces dense point trails by ~70-85% while keeping key curve curvature and corners.
 */
export function simplifyPointsRDP(points: Point2D[], epsilon: number = 4.5): Point2D[] {
  if (points.length <= 2) return points;

  let dmax = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    const rec1 = simplifyPointsRDP(points.slice(0, index + 1), epsilon);
    const rec2 = simplifyPointsRDP(points.slice(index), epsilon);
    return rec1.slice(0, -1).concat(rec2);
  } else {
    return [points[0], points[end]];
  }
}

/**
 * Catmull-Rom spline interpolation to convert points into a smooth curved path
 * with seamless width interpolation.
 */
export function getCatmullRomPoints(
  points: Point2D[],
  tension: number = 0.5,
  segments: number = 16,
  defaultWidth?: number
): Point2D[] {
  if (points.length < 2) return points;
  if (points.length === 2) {
    const p1 = points[0];
    const p2 = points[1];
    const res: Point2D[] = [];
    const w1 = p1.width ?? defaultWidth ?? 4;
    const w2 = p2.width ?? defaultWidth ?? 4;
    for (let t = 0; t <= segments; t++) {
      const step = t / segments;
      res.push({
        x: p1.x + (p2.x - p1.x) * step,
        y: p1.y + (p2.y - p1.y) * step,
        width: w1 + (w2 - w1) * step,
      });
    }
    return res;
  }

  const result: Point2D[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;

    const w1 = p1.width ?? defaultWidth ?? 4;
    const w2 = p2.width ?? defaultWidth ?? 4;

    for (let t = 0; t <= segments; t++) {
      const step = t / segments;
      const t2 = step * step;
      const t3 = t2 * step;

      const f1 = -tension * t3 + 2 * tension * t2 - tension * step;
      const f2 = (2 - tension) * t3 + (tension - 3) * t2 + 1;
      const f3 = (tension - 2) * t3 + (3 - 2 * tension) * t2 + tension * step;
      const f4 = tension * t3 - tension * t2;

      const x = p0.x * f1 + p1.x * f2 + p2.x * f3 + p3.x * f4;
      const y = p0.y * f1 + p1.y * f2 + p2.y * f3 + p3.y * f4;
      const width = w1 + (w2 - w1) * step;

      result.push({ x, y, width });
    }
  }

  return result;
}

/**
 * Renders vector shape directly onto the 2D canvas context.
 */
export function renderVectorShape(
  ctx: CanvasRenderingContext2D,
  config: VectorShapeConfig,
  activeBrush?: Brush
) {
  ctx.save();
  ctx.globalAlpha = config.opacity;
  ctx.strokeStyle = config.strokeColor;
  ctx.fillStyle = config.fillColor;
  ctx.lineWidth = Math.max(0.5, config.strokeWidth);
  if (config.strokeCap === 'butt' || config.strokeCap === 'square') {
    ctx.lineCap = config.strokeCap;
  } else {
    ctx.lineCap = 'round';
  }
  ctx.lineJoin = 'round';

  if (config.strokeStyle === 'dashed') {
    ctx.setLineDash([config.strokeWidth * 3, config.strokeWidth * 2]);
  } else if (config.strokeStyle === 'dotted') {
    ctx.setLineDash([config.strokeWidth, config.strokeWidth * 1.5]);
  } else {
    ctx.setLineDash([]);
  }

  const { x, y, width, height } = config;
  const cx = x + width / 2;
  const cy = y + height / 2;

  switch (config.type) {
    case 'line': {
      if (config.strokeCap === 'tapered') {
        const segCount = 30;
        const startX = x;
        const startY = y;
        const endX = x + width;
        const endY = y + height;
        for (let i = 0; i < segCount; i++) {
          const t1 = i / segCount;
          const t2 = (i + 1) / segCount;
          const p1x = startX + t1 * (endX - startX);
          const p1y = startY + t1 * (endY - startY);
          const p2x = startX + t2 * (endX - startX);
          const p2y = startY + t2 * (endY - startY);
          const startTaper = Math.min(1, t1 / 0.25);
          const endTaper = Math.min(1, (1 - t1) / 0.25);
          const segW = Math.max(0.5, config.strokeWidth * Math.min(startTaper, endTaper));

          ctx.beginPath();
          ctx.lineWidth = segW;
          ctx.lineCap = 'round';
          ctx.moveTo(p1x, p1y);
          ctx.lineTo(p2x, p2y);
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + width, y + height);
        ctx.stroke();
      }

      if (config.arrowHead) {
        // Arrowhead at end
        const angle = Math.atan2(height, width);
        const arrowLength = Math.max(12, config.strokeWidth * 3.5);
        ctx.beginPath();
        ctx.moveTo(x + width, y + height);
        ctx.lineTo(
          x + width - arrowLength * Math.cos(angle - Math.PI / 6),
          y + height - arrowLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          x + width - arrowLength * Math.cos(angle + Math.PI / 6),
          y + height - arrowLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = config.strokeColor;
        ctx.fill();
      }
      break;
    }

    case 'rectangle':
    case 'square': {
      const r = config.cornerRadius || 0;
      ctx.beginPath();
      if (r > 0) {
        const radius = Math.min(r, Math.abs(width) / 2, Math.abs(height) / 2);
        ctx.roundRect(x, y, width, height, radius);
      } else {
        ctx.rect(x, y, width, height);
      }
      if (config.hasFill) ctx.fill();
      if (config.strokeWidth > 0) ctx.stroke();
      break;
    }

    case 'circle': {
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.abs(width / 2), Math.abs(height / 2), 0, 0, Math.PI * 2);
      if (config.hasFill) ctx.fill();
      if (config.strokeWidth > 0) ctx.stroke();
      break;
    }

    case 'triangle': {
      const vertices = config.triangleVertices || [
        { x: cx, y: y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ];
      ctx.beginPath();
      ctx.moveTo(vertices[0].x, vertices[0].y);
      ctx.lineTo(vertices[1].x, vertices[1].y);
      ctx.lineTo(vertices[2].x, vertices[2].y);
      ctx.closePath();
      if (config.hasFill) ctx.fill();
      if (config.strokeWidth > 0) ctx.stroke();
      break;
    }

    case 'star': {
      const points = config.starPoints || 5;
      const outerR = Math.min(width, height) / 2;
      const innerR = outerR * (config.starInnerRatio || 0.45);
      buildStarPath(ctx, cx, cy, outerR, innerR, points);
      if (config.hasFill) ctx.fill();
      if (config.strokeWidth > 0) ctx.stroke();
      break;
    }

    case 'grid': {
      const rows = config.gridRows || 4;
      const cols = config.gridCols || 4;
      if (config.hasFill) {
        ctx.fillRect(x, y, width, height);
      }
      if (config.strokeWidth > 0) {
        // Outer box
        ctx.strokeRect(x, y, width, height);

        // Internal row lines
        const rowStep = height / rows;
        for (let r = 1; r < rows; r++) {
          ctx.beginPath();
          ctx.moveTo(x, y + r * rowStep);
          ctx.lineTo(x + width, y + r * rowStep);
          ctx.stroke();
        }

        // Internal col lines
        const colStep = width / cols;
        for (let c = 1; c < cols; c++) {
          ctx.beginPath();
          ctx.moveTo(x + c * colStep, y);
          ctx.lineTo(x + c * colStep, y + height);
          ctx.stroke();
        }
      }
      break;
    }

    case 'speech_bubble': {
      const tailTip = config.tailTip || { x: x + width * 0.2, y: y + height + 50 };
      const r = config.cornerRadius ?? 16;
      buildSpeechBubblePath(ctx, x, y, width, height, r, tailTip, config.tailBaseWidth || 28);
      if (config.hasFill) ctx.fill();
      if (config.strokeWidth > 0) ctx.stroke();
      break;
    }

    case 'thought_bubble': {
      buildThoughtBubblePath(ctx, x, y, width, height, config.thoughtLobeCount || 10);
      if (config.hasFill) ctx.fill();
      if (config.strokeWidth > 0) ctx.stroke();

      // Trailing circles towards thought origin
      const origin = config.thoughtOrigin || { x: x + width * 0.2, y: y + height + 60 };
      const bubbleBottom = { x: cx - width * 0.2, y: y + height };
      const trailCount = 3;
      for (let i = 1; i <= trailCount; i++) {
        const factor = i / (trailCount + 1);
        const dotX = bubbleBottom.x + (origin.x - bubbleBottom.x) * factor;
        const dotY = bubbleBottom.y + (origin.y - bubbleBottom.y) * factor;
        const radius = Math.max(3, (12 * (trailCount - i + 1)) / trailCount);

        ctx.beginPath();
        ctx.arc(dotX, dotY, radius, 0, Math.PI * 2);
        if (config.hasFill) ctx.fill();
        if (config.strokeWidth > 0) ctx.stroke();
      }
      break;
    }

    case 'spiky_bubble': {
      buildSpikyBubblePath(
        ctx,
        cx,
        cy,
        width,
        height,
        config.spikesCount || 16,
        config.spikeAmplitude || 0.35
      );
      if (config.hasFill) ctx.fill();
      if (config.strokeWidth > 0) ctx.stroke();
      break;
    }

    case 'comic_vignette': {
      const layout = config.vignetteLayout || 'single';
      const gutter = config.vignetteGutter || 12;
      const cornerR = config.cornerRadius || 0;

      const drawPanel = (px: number, py: number, pw: number, ph: number) => {
        ctx.beginPath();
        if (cornerR > 0) {
          ctx.roundRect(px, py, pw, ph, cornerR);
        } else {
          ctx.rect(px, py, pw, ph);
        }
        if (config.hasFill) ctx.fill();
        if (config.strokeWidth > 0) ctx.stroke();
      };

      if (layout === 'single') {
        drawPanel(x, y, width, height);
      } else if (layout === 'two_horizontal') {
        const halfH = (height - gutter) / 2;
        drawPanel(x, y, width, halfH);
        drawPanel(x, y + halfH + gutter, width, halfH);
      } else if (layout === 'two_vertical') {
        const halfW = (width - gutter) / 2;
        drawPanel(x, y, halfW, height);
        drawPanel(x + halfW + gutter, y, halfW, height);
      } else if (layout === 'four_grid') {
        const halfW = (width - gutter) / 2;
        const halfH = (height - gutter) / 2;
        drawPanel(x, y, halfW, halfH);
        drawPanel(x + halfW + gutter, y, halfW, halfH);
        drawPanel(x, y + halfH + gutter, halfW, halfH);
        drawPanel(x + halfW + gutter, y + halfH + gutter, halfW, halfH);
      } else if (layout === 'three_strip') {
        const stepH = (height - gutter * 2) / 3;
        for (let i = 0; i < 3; i++) {
          drawPanel(x, y + i * (stepH + gutter), width, stepH);
        }
      }
      break;
    }

    case 'brush_path': {
      const rawPoints = config.pathPoints || [
        { x: x, y: y + height / 2 },
        { x: x + width * 0.33, y: y },
        { x: x + width * 0.66, y: y + height },
        { x: x + width, y: y + height / 2 },
      ];

      const splinePts = getCatmullRomPoints(rawPoints, 0.5, 20, config.strokeWidth);
      const isTapered = config.strokeCap === 'tapered';
      const hasVariableWidth = rawPoints.some((p) => p.width !== undefined && p.width !== config.strokeWidth);
      const totalSegs = splinePts.length - 1;

      if (config.mimicBrush && activeBrush) {
        // Stamp using active brush along spline points!
        for (let i = 0; i < totalSegs; i++) {
          let pressureFactor = 0.7;
          let currentW = splinePts[i].width ?? config.strokeWidth;
          if (isTapered && totalSegs > 0) {
            const progress = i / totalSegs;
            const startTaper = Math.min(1, progress / 0.25);
            const endTaper = Math.min(1, (1 - progress) / 0.25);
            pressureFactor = Math.max(0.1, 0.8 * Math.min(startTaper, endTaper));
            currentW = Math.max(0.5, currentW * Math.min(startTaper, endTaper));
          }

          const p1: StrokePoint = {
            x: splinePts[i].x,
            y: splinePts[i].y,
            pressure: pressureFactor,
            time: Date.now(),
          };
          const p2: StrokePoint = {
            x: splinePts[i + 1].x,
            y: splinePts[i + 1].y,
            pressure: pressureFactor,
            time: Date.now(),
          };
          renderStrokeSegment(
            ctx,
            p1,
            p2,
            activeBrush,
            config.strokeColor,
            currentW,
            config.opacity,
            false
          );
        }
      } else if ((isTapered || hasVariableWidth) && totalSegs > 0) {
        // Render variable/tapered vector segments with smooth width transitions
        for (let i = 0; i < totalSegs; i++) {
          let segWidth = splinePts[i].width ?? config.strokeWidth;
          if (isTapered) {
            const progress = i / totalSegs;
            const startTaper = Math.min(1, progress / 0.25);
            const endTaper = Math.min(1, (1 - progress) / 0.25);
            segWidth = Math.max(0.5, segWidth * Math.min(startTaper, endTaper));
          }

          ctx.beginPath();
          ctx.lineWidth = Math.max(0.5, segWidth);
          ctx.lineCap = config.strokeCap === 'square' ? 'square' : config.strokeCap === 'butt' ? 'butt' : 'round';
          ctx.moveTo(splinePts[i].x, splinePts[i].y);
          ctx.lineTo(splinePts[i + 1].x, splinePts[i + 1].y);
          ctx.stroke();
        }
      } else {
        // Crisp smooth vector stroke
        ctx.beginPath();
        ctx.lineWidth = config.strokeWidth;
        ctx.lineCap = config.strokeCap === 'square' ? 'square' : config.strokeCap === 'butt' ? 'butt' : 'round';
        ctx.moveTo(splinePts[0].x, splinePts[0].y);
        for (let i = 1; i < splinePts.length; i++) {
          ctx.lineTo(splinePts[i].x, splinePts[i].y);
        }
        if (config.hasFill) {
          ctx.closePath();
          ctx.fill();
        }
        if (config.strokeWidth > 0) {
          ctx.stroke();
        }
      }
      break;
    }
  }

  ctx.restore();
}
