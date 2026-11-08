import { Layer, LayerEffectsConfig, BlendMode } from '../types/canvas';
import { getKritaPatternCanvas } from './brushEngine';

export function createDefaultLayerEffects(): LayerEffectsConfig {
  return {
    bevelEmboss: {
      enabled: false,
      style: 'inner_bevel',
      depth: 100,
      size: 8,
      soften: 2,
      angle: 120,
      altitude: 30,
      highlightColor: '#ffffff',
      highlightOpacity: 0.75,
      shadowColor: '#000000',
      shadowOpacity: 0.75,
    },
    stroke: {
      enabled: false,
      size: 4,
      position: 'outside',
      color: '#000000',
      opacity: 1.0,
    },
    innerShadow: {
      enabled: false,
      color: '#000000',
      opacity: 0.6,
      angle: 120,
      distance: 5,
      choke: 0,
      size: 7,
    },
    innerGlow: {
      enabled: false,
      color: '#ffffbe',
      opacity: 0.75,
      choke: 0,
      size: 10,
    },
    satin: {
      enabled: false,
      color: '#191919',
      opacity: 0.5,
      angle: 19,
      distance: 11,
      size: 14,
      invert: true,
    },
    colorOverlay: {
      enabled: false,
      color: '#ff3b30',
      opacity: 0.7,
    },
    gradientOverlay: {
      enabled: false,
      color1: '#3b82f6',
      color2: '#ec4899',
      angle: 90,
      opacity: 0.8,
      scale: 100,
      reverse: false,
    },
    patternOverlay: {
      enabled: false,
      pattern: 'dots',
      opacity: 0.5,
      scale: 100,
    },
    outerGlow: {
      enabled: false,
      color: '#ffffbe',
      opacity: 0.75,
      spread: 0,
      size: 12,
    },
    dropShadow: {
      enabled: false,
      color: '#000000',
      opacity: 0.65,
      angle: 120,
      distance: 8,
      spread: 0,
      size: 10,
    },
  };
}

export function hasActiveEffects(effects?: LayerEffectsConfig): boolean {
  if (!effects) return false;
  return (
    effects.bevelEmboss.enabled ||
    effects.stroke.enabled ||
    effects.innerShadow.enabled ||
    effects.innerGlow.enabled ||
    effects.satin.enabled ||
    effects.colorOverlay.enabled ||
    effects.gradientOverlay.enabled ||
    effects.patternOverlay.enabled ||
    effects.outerGlow.enabled ||
    effects.dropShadow.enabled
  );
}

/**
 * Creates an alpha silhouette mask of the source canvas.
 */
function createAlphaMask(src: HTMLCanvasElement): HTMLCanvasElement {
  const mask = document.createElement('canvas');
  mask.width = src.width;
  mask.height = src.height;
  const ctx = mask.getContext('2d');
  if (!ctx) return mask;

  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, src.width, src.height);
  return mask;
}

/**
 * Renders full Layer Effects onto a buffer canvas and composites with source layer.
 */
export function renderLayerEffectsToCanvas(
  srcCanvas: HTMLCanvasElement,
  effects: LayerEffectsConfig
): HTMLCanvasElement {
  const w = srcCanvas.width;
  const h = srcCanvas.height;

  const output = document.createElement('canvas');
  output.width = w;
  output.height = h;
  const outCtx = output.getContext('2d');
  if (!outCtx) return srcCanvas;

  // 1. DROP SHADOW (rendered underneath)
  if (effects.dropShadow.enabled) {
    const ds = effects.dropShadow;
    const rad = ((ds.angle - 180) * Math.PI) / 180;
    const offX = Math.round(Math.cos(rad) * ds.distance);
    const offY = Math.round(Math.sin(rad) * ds.distance);

    outCtx.save();
    outCtx.globalCompositeOperation = ds.blendMode ? (ds.blendMode as GlobalCompositeOperation) : 'source-over';
    outCtx.shadowColor = ds.color;
    outCtx.shadowBlur = Math.max(1, ds.size * 1.5);
    outCtx.shadowOffsetX = offX;
    outCtx.shadowOffsetY = offY;
    outCtx.globalAlpha = ds.opacity;
    outCtx.drawImage(srcCanvas, 0, 0);
    outCtx.restore();
  }

  // 2. OUTER GLOW (rendered underneath)
  if (effects.outerGlow.enabled) {
    const og = effects.outerGlow;
    outCtx.save();
    outCtx.globalCompositeOperation = og.blendMode ? (og.blendMode as GlobalCompositeOperation) : 'source-over';
    outCtx.shadowColor = og.color;
    outCtx.shadowBlur = Math.max(2, og.size * 1.8);
    outCtx.shadowOffsetX = 0;
    outCtx.shadowOffsetY = 0;
    outCtx.globalAlpha = og.opacity;
    outCtx.drawImage(srcCanvas, 0, 0);
    outCtx.restore();
  }

  // 3. OUTSIDE STROKE (rendered underneath base)
  if (effects.stroke.enabled && effects.stroke.position === 'outside') {
    const str = effects.stroke;
    outCtx.save();
    outCtx.globalCompositeOperation = str.blendMode ? (str.blendMode as GlobalCompositeOperation) : 'source-over';
    outCtx.globalAlpha = str.opacity;
    const blur = Math.max(1, str.size);
    outCtx.shadowColor = str.color;
    outCtx.shadowBlur = blur;
    for (let angle = 0; angle < 360; angle += 45) {
      const r = (angle * Math.PI) / 180;
      outCtx.shadowOffsetX = Math.cos(r) * (str.size * 0.7);
      outCtx.shadowOffsetY = Math.sin(r) * (str.size * 0.7);
      outCtx.drawImage(srcCanvas, 0, 0);
    }
    outCtx.restore();
  }

  // 4. DRAW BASE LAYER PIXELS
  outCtx.drawImage(srcCanvas, 0, 0);

  // 5. COLOR OVERLAY (clipped to silhouette)
  if (effects.colorOverlay.enabled) {
    const co = effects.colorOverlay;
    outCtx.save();
    outCtx.globalCompositeOperation = co.blendMode && co.blendMode !== 'source-over' ? (co.blendMode as GlobalCompositeOperation) : 'source-atop';
    outCtx.globalAlpha = co.opacity;
    outCtx.fillStyle = co.color;
    outCtx.fillRect(0, 0, w, h);
    outCtx.restore();
  }

  // 6. GRADIENT OVERLAY (clipped to silhouette)
  if (effects.gradientOverlay.enabled) {
    const go = effects.gradientOverlay;
    outCtx.save();
    outCtx.globalCompositeOperation = go.blendMode && go.blendMode !== 'source-over' ? (go.blendMode as GlobalCompositeOperation) : 'source-atop';
    outCtx.globalAlpha = go.opacity;
    const rad = (go.angle * Math.PI) / 180;
    const length = Math.max(w, h);
    const cx = w / 2;
    const cy = h / 2;
    const grad = outCtx.createLinearGradient(
      cx - Math.cos(rad) * (length / 2),
      cy - Math.sin(rad) * (length / 2),
      cx + Math.cos(rad) * (length / 2),
      cy + Math.sin(rad) * (length / 2)
    );
    grad.addColorStop(0, go.reverse ? go.color2 : go.color1);
    grad.addColorStop(1, go.reverse ? go.color1 : go.color2);
    outCtx.fillStyle = grad;
    outCtx.fillRect(0, 0, w, h);
    outCtx.restore();
  }

  // 7. PATTERN OVERLAY (clipped to silhouette)
  if (effects.patternOverlay.enabled) {
    const po = effects.patternOverlay;
    const patCanvas = createPatternCanvas(po.pattern, po.scale || 100);
    const pattern = outCtx.createPattern(patCanvas, 'repeat');
    if (pattern) {
      outCtx.save();
      outCtx.globalCompositeOperation = po.blendMode && po.blendMode !== 'source-over' ? (po.blendMode as GlobalCompositeOperation) : 'source-atop';
      outCtx.globalAlpha = po.opacity;
      outCtx.fillStyle = pattern;
      outCtx.fillRect(0, 0, w, h);
      outCtx.restore();
    }
  }

  // 8. INNER SHADOW (clipped to silhouette with inverted mask)
  if (effects.innerShadow.enabled) {
    const is = effects.innerShadow;
    const rad = ((is.angle - 180) * Math.PI) / 180;
    const offX = Math.round(Math.cos(rad) * is.distance);
    const offY = Math.round(Math.sin(rad) * is.distance);
    const pad = Math.max(40, Math.ceil(is.size * 2 + Math.abs(is.distance)));

    // Inverted mask: black surrounding box with the shape cut out
    const invCanvas = document.createElement('canvas');
    invCanvas.width = w + pad * 2;
    invCanvas.height = h + pad * 2;
    const invCtx = invCanvas.getContext('2d');
    if (invCtx) {
      invCtx.fillStyle = '#000000';
      invCtx.fillRect(0, 0, invCanvas.width, invCanvas.height);
      invCtx.globalCompositeOperation = 'destination-out';
      invCtx.drawImage(srcCanvas, pad, pad);

      // Shadow canvas
      const shadowCanvas = document.createElement('canvas');
      shadowCanvas.width = w;
      shadowCanvas.height = h;
      const sCtx = shadowCanvas.getContext('2d');
      if (sCtx) {
        sCtx.save();
        sCtx.shadowColor = is.color;
        sCtx.shadowBlur = Math.max(1, is.size * 1.5);
        sCtx.shadowOffsetX = offX;
        sCtx.shadowOffsetY = offY;
        sCtx.drawImage(invCanvas, -pad, -pad);
        sCtx.restore();

        // Stencil strictly to the layer silhouette
        sCtx.globalCompositeOperation = 'destination-in';
        sCtx.drawImage(srcCanvas, 0, 0);

        outCtx.save();
        outCtx.globalCompositeOperation = is.blendMode && is.blendMode !== 'source-over' ? (is.blendMode as GlobalCompositeOperation) : 'source-atop';
        outCtx.globalAlpha = is.opacity;
        outCtx.drawImage(shadowCanvas, 0, 0);
        outCtx.restore();
      }
    }
  }

  // 9. INNER GLOW (clipped to silhouette with inverted mask)
  if (effects.innerGlow.enabled) {
    const ig = effects.innerGlow;
    const pad = Math.max(40, Math.ceil(ig.size * 2));

    const invCanvas = document.createElement('canvas');
    invCanvas.width = w + pad * 2;
    invCanvas.height = h + pad * 2;
    const invCtx = invCanvas.getContext('2d');
    if (invCtx) {
      invCtx.fillStyle = '#000000';
      invCtx.fillRect(0, 0, invCanvas.width, invCanvas.height);
      invCtx.globalCompositeOperation = 'destination-out';
      invCtx.drawImage(srcCanvas, pad, pad);

      const glowCanvas = document.createElement('canvas');
      glowCanvas.width = w;
      glowCanvas.height = h;
      const gCtx = glowCanvas.getContext('2d');
      if (gCtx) {
        gCtx.save();
        gCtx.shadowColor = ig.color;
        gCtx.shadowBlur = Math.max(2, ig.size * 1.8);
        gCtx.shadowOffsetX = 0;
        gCtx.shadowOffsetY = 0;
        gCtx.drawImage(invCanvas, -pad, -pad);
        gCtx.restore();

        // Stencil strictly to the layer silhouette
        gCtx.globalCompositeOperation = 'destination-in';
        gCtx.drawImage(srcCanvas, 0, 0);

        outCtx.save();
        outCtx.globalCompositeOperation = ig.blendMode && ig.blendMode !== 'source-over' ? (ig.blendMode as GlobalCompositeOperation) : 'source-atop';
        outCtx.globalAlpha = ig.opacity;
        outCtx.drawImage(glowCanvas, 0, 0);
        outCtx.restore();
      }
    }
  }

  // 10. SATIN EFFECT (clipped to silhouette)
  if (effects.satin.enabled) {
    const st = effects.satin;
    const rad = (st.angle * Math.PI) / 180;
    const offX = Math.round(Math.cos(rad) * st.distance);
    const offY = Math.round(Math.sin(rad) * st.distance);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tCtx = tempCanvas.getContext('2d');
    if (tCtx) {
      tCtx.drawImage(srcCanvas, -offX, -offY);
      tCtx.globalCompositeOperation = 'destination-out';
      tCtx.drawImage(srcCanvas, offX, offY);

      outCtx.save();
      outCtx.globalCompositeOperation = st.blendMode && st.blendMode !== 'source-over' ? (st.blendMode as GlobalCompositeOperation) : 'source-atop';
      outCtx.globalAlpha = st.opacity;
      outCtx.fillStyle = st.color;
      outCtx.fillRect(0, 0, w, h);
      outCtx.drawImage(tempCanvas, 0, 0);
      outCtx.restore();
    }
  }

  // 11. BEVEL & EMBOSS (Highlight & Shadow edges)
  if (effects.bevelEmboss.enabled) {
    const be = effects.bevelEmboss;
    const rad = (be.angle * Math.PI) / 180;
    const offX = Math.max(1, Math.round(Math.cos(rad) * (be.size / 3)));
    const offY = Math.max(1, Math.round(Math.sin(rad) * (be.size / 3)));

    const hlCanvas = document.createElement('canvas');
    hlCanvas.width = w;
    hlCanvas.height = h;
    const hlCtx = hlCanvas.getContext('2d');
    if (hlCtx) {
      // Highlight edge
      hlCtx.drawImage(srcCanvas, -offX, -offY);
      hlCtx.globalCompositeOperation = 'destination-out';
      hlCtx.drawImage(srcCanvas, 0, 0);

      outCtx.save();
      outCtx.globalCompositeOperation = 'source-atop';
      outCtx.globalAlpha = be.highlightOpacity;
      outCtx.fillStyle = be.highlightColor;
      outCtx.fillRect(0, 0, w, h);
      outCtx.drawImage(hlCanvas, 0, 0);
      outCtx.restore();
    }

    const shCanvas = document.createElement('canvas');
    shCanvas.width = w;
    shCanvas.height = h;
    const shCtx = shCanvas.getContext('2d');
    if (shCtx) {
      // Shadow edge
      shCtx.drawImage(srcCanvas, offX, offY);
      shCtx.globalCompositeOperation = 'destination-out';
      shCtx.drawImage(srcCanvas, 0, 0);

      outCtx.save();
      outCtx.globalCompositeOperation = 'source-atop';
      outCtx.globalAlpha = be.shadowOpacity;
      outCtx.fillStyle = be.shadowColor;
      outCtx.fillRect(0, 0, w, h);
      outCtx.drawImage(shCanvas, 0, 0);
      outCtx.restore();
    }
  }

  // 12. INSIDE / CENTER STROKE
  if (effects.stroke.enabled && effects.stroke.position !== 'outside') {
    const str = effects.stroke;
    const strokeCanvas = document.createElement('canvas');
    strokeCanvas.width = w;
    strokeCanvas.height = h;
    const sCtx = strokeCanvas.getContext('2d');
    if (sCtx) {
      sCtx.drawImage(srcCanvas, 0, 0);
      sCtx.globalCompositeOperation = 'source-out';
      sCtx.shadowColor = str.color;
      sCtx.shadowBlur = Math.max(1, str.size);
      sCtx.drawImage(srcCanvas, 0, 0);

      outCtx.save();
      outCtx.globalCompositeOperation = 'source-atop';
      outCtx.globalAlpha = str.opacity;
      outCtx.drawImage(strokeCanvas, 0, 0);
      outCtx.restore();
    }
  }

  return output;
}

/**
 * Commits and bakes layer effects into the layer's raw pixels.
 */
export function rasterizeLayerEffects(layer: Layer): void {
  if (!layer.effects || !hasActiveEffects(layer.effects)) return;

  const rendered = renderLayerEffectsToCanvas(layer.canvas, layer.effects);
  layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
  layer.ctx.drawImage(rendered, 0, 0);

  // Clear effects after rasterizing
  layer.effects = createDefaultLayerEffects();

  const thumb = document.createElement('canvas');
  thumb.width = 64;
  thumb.height = 64;
  thumb.getContext('2d')?.drawImage(layer.canvas, 0, 0, 64, 64);
  layer.thumbnailUrl = thumb.toDataURL();
}

export const applyLayerEffects = renderLayerEffectsToCanvas;

/**
 * Generates seamless repeating pattern tile canvases
 */
export function createPatternCanvas(
  pattern: string,
  scale: number = 100,
  foreground: string = '#000000',
  background: string = 'transparent'
): HTMLCanvasElement {
  // Check if pattern is in the pattern registry or Hunbatz local content textures
  const textureCanvas = getKritaPatternCanvas(pattern);
  if (textureCanvas) {
    const s = Math.max(8, Math.round((textureCanvas.width * scale) / 100));
    const patCanvas = document.createElement('canvas');
    patCanvas.width = s;
    patCanvas.height = s;
    const pCtx = patCanvas.getContext('2d');
    if (pCtx) {
      if (background !== 'transparent') {
        pCtx.fillStyle = background;
        pCtx.fillRect(0, 0, s, s);
      }
      pCtx.drawImage(textureCanvas, 0, 0, s, s);
      return patCanvas;
    }
  }

  const baseSize = 24;
  const s = Math.max(8, Math.min(128, Math.round((baseSize * scale) / 100)));
  const patCanvas = document.createElement('canvas');
  patCanvas.width = s;
  patCanvas.height = s;
  const pCtx = patCanvas.getContext('2d');
  if (!pCtx) return patCanvas;

  if (background !== 'transparent') {
    pCtx.fillStyle = background;
    pCtx.fillRect(0, 0, s, s);
  }

  pCtx.fillStyle = foreground;
  pCtx.strokeStyle = foreground;

  switch (pattern) {
    case 'dots': {
      const r = Math.max(1.5, s * 0.18);
      pCtx.beginPath();
      pCtx.arc(s / 2, s / 2, r, 0, Math.PI * 2);
      pCtx.fill();
      // Corner half dots for seamless repeat
      pCtx.beginPath();
      pCtx.arc(0, 0, r, 0, Math.PI * 2);
      pCtx.arc(s, 0, r, 0, Math.PI * 2);
      pCtx.arc(0, s, r, 0, Math.PI * 2);
      pCtx.arc(s, s, r, 0, Math.PI * 2);
      pCtx.fill();
      break;
    }
    case 'grid': {
      pCtx.lineWidth = Math.max(1, Math.round(s * 0.08));
      pCtx.strokeRect(0, 0, s, s);
      break;
    }
    case 'stripes': {
      pCtx.fillRect(0, 0, s / 2, s);
      break;
    }
    case 'diagonal': {
      pCtx.lineWidth = Math.max(1.5, Math.round(s * 0.1));
      pCtx.beginPath();
      pCtx.moveTo(-s, 0);
      pCtx.lineTo(0, s);
      pCtx.moveTo(0, 0);
      pCtx.lineTo(s, s);
      pCtx.moveTo(0, -s);
      pCtx.lineTo(s * 2, s);
      pCtx.stroke();
      break;
    }
    case 'checker': {
      const half = s / 2;
      pCtx.fillRect(0, 0, half, half);
      pCtx.fillRect(half, half, half, half);
      break;
    }
    case 'hexagons': {
      pCtx.lineWidth = Math.max(1, Math.round(s * 0.06));
      const r = s * 0.45;
      const cx = s / 2;
      const cy = s / 2;
      pCtx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        if (i === 0) pCtx.moveTo(x, y);
        else pCtx.lineTo(x, y);
      }
      pCtx.closePath();
      pCtx.stroke();
      break;
    }
    case 'carbon': {
      // Carbon fiber weave (alternating checker hatch)
      const half = s / 2;
      pCtx.fillStyle = 'rgba(0,0,0,0.6)';
      pCtx.fillRect(0, 0, half, half);
      pCtx.fillRect(half, half, half, half);
      pCtx.fillStyle = 'rgba(255,255,255,0.2)';
      pCtx.fillRect(half, 0, half, half);
      pCtx.fillRect(0, half, half, half);
      pCtx.fillStyle = foreground;
      pCtx.fillRect(2, 2, half - 4, half - 4);
      pCtx.fillRect(half + 2, half + 2, half - 4, half - 4);
      break;
    }
    case 'moroccan': {
      // Quatrefoil tile
      pCtx.lineWidth = Math.max(1.5, Math.round(s * 0.07));
      const rad = s * 0.25;
      pCtx.beginPath();
      pCtx.arc(s / 2, rad, rad, Math.PI, 0);
      pCtx.arc(s - rad, s / 2, rad, -Math.PI / 2, Math.PI / 2);
      pCtx.arc(s / 2, s - rad, rad, 0, Math.PI);
      pCtx.arc(rad, s / 2, rad, Math.PI / 2, -Math.PI / 2);
      pCtx.stroke();
      break;
    }
    case 'noise':
    default: {
      const step = Math.max(1, Math.round(s / 12));
      for (let x = 0; x < s; x += step) {
        for (let y = 0; y < s; y += step) {
          if (Math.random() > 0.4) {
            pCtx.fillRect(x, y, step, step);
          }
        }
      }
      break;
    }
  }

  return patCanvas;
}
