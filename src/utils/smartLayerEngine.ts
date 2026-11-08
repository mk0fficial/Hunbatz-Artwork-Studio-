/**
 * Hunbatz Artwork Studio — Smart Layer & Group Flattening Engine
 * 
 * Provides Photoshop-parity Smart Layers / Smart Objects:
 * - Encapsulation of group folders or multi-selected layers into non-destructive Smart Layers.
 * - Non-destructive sub-layers preserved for lineart, flat coloring, and shading for animation frames.
 * - Non-destructive Smart Filters & Layer Effects applied to the smart layer composite.
 * - Unpacking Smart Layers back to standard Group folders.
 * - Flatten Group to Image (flattens group and children into a single raster image).
 * - Flatten Smart Layer to Image (bakes smart object to pixels).
 * - Flatten Image (flattens entire canvas / all visible layers into a single background image).
 */

import { Layer, LayerMask, SmartFilter, SmartFilterParams, ActiveAdjustment } from '../types/canvas';
import { getCanvasCompositeOperation } from './blendModes';
import { hasActiveEffects, renderLayerEffectsToCanvas } from './layerEffectsEngine';
import { applyProcessedMask } from './compositingEngine';
import {
  renderFastAdjustmentLayer,
  applyGaussianBlur,
  applyHueSaturation,
  applyNoise,
  applyInvert,
  applyGrayscale,
} from './adjustments';
import { processFilterEffect } from './filterEffectsEngine';
import {
  applyIndexedDither,
  applyMacPaintDither,
  applyCmykHalftoneScreen,
  applySignalModulation,
} from './ditherEngine';

const cachedLiquifyCanvases = new Map<string, HTMLCanvasElement>();

export function setCachedLiquifyCanvas(filterId: string, canvas: HTMLCanvasElement): void {
  const copy = document.createElement('canvas');
  copy.width = canvas.width;
  copy.height = canvas.height;
  copy.getContext('2d')?.drawImage(canvas, 0, 0);
  cachedLiquifyCanvases.set(filterId, copy);
}

export function getCachedLiquifyCanvas(
  filterId: string,
  dataUrl?: string,
  width?: number,
  height?: number
): HTMLCanvasElement | null {
  const existing = cachedLiquifyCanvases.get(filterId);
  if (existing) return existing;
  if (dataUrl && width && height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const img = new Image();
    img.onload = () => {
      canvas.getContext('2d')?.drawImage(img, 0, 0);
    };
    img.src = dataUrl;
    cachedLiquifyCanvases.set(filterId, canvas);
    return canvas;
  }
  return null;
}

/**
 * Returns a human-friendly display name for an adjustment / smart filter type.
 */
export function getAdjustmentDisplayName(type: ActiveAdjustment): string {
  switch (type) {
    case 'gaussian_blur':
      return 'Gaussian Blur';
    case 'motion_blur':
      return 'Motion Blur';
    case 'surface_blur':
      return 'Surface Blur';
    case 'perspective_blur':
      return 'Perspective Blur';
    case 'cutout':
      return 'Cutout';
    case 'halftone':
      return 'Halftone';
    case 'pixelate':
      return 'Pixelate';
    case 'noise':
      return 'Noise';
    case 'invert':
      return 'Invert';
    case 'grayscale':
      return 'Grayscale';
    case 'bloom':
      return 'Bloom';
    case 'chromatic_aberration':
      return 'Chromatic Aberration';
    case 'sharpen':
      return 'Sharpen';
    case 'unsharp_mask':
      return 'Unsharp Mask';
    case 'threshold':
      return 'Threshold';
    case 'poster_edges':
      return 'Poster Edges';
    case 'fisheye':
      return 'Fisheye Lens';
    case 'glitch_rgb_offset':
      return 'RGB Offset';
    case 'glitch_color_offset':
      return 'Color Offset';
    case 'glitch_channel_swap':
      return 'Channel Swap';
    case 'glitch_channel_reflector':
      return 'Channel Reflector';
    case 'glitch_random_dispersion':
      return 'Random Dispersion';
    case 'glitch_hue_distortion':
      return 'Hue Distortion';
    case 'glitch_pixel_sort':
      return 'Pixel Sort';
    case 'glitch_kaleidoscope':
      return 'Kaleidoscope';
    case 'glitch_scanlines':
      return 'Scanlines';
    case 'glitch_vhs':
      return 'VHS Glitch';
    case 'glitch_led_screen':
      return 'LED Screen';
    case 'dither_suite':
      return 'Dither Suite';
    case 'curves':
      return 'Curves';
    case 'hue_saturation':
      return 'Hue / Saturation';
    case 'thermal':
      return 'Thermal Gradient';
    case 'channel_extractor':
      return 'Channel Extractor';
    case 'liquify':
      return 'Liquify';
    default:
      return type ? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Filter';
  }
}

/**
 * Deep-clones a SmartFilter.
 */
export function cloneSmartFilter(f: SmartFilter): SmartFilter {
  return {
    ...f,
    id: `sf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    params: {
      ...f.params,
      customLut: f.params.customLut ? new Uint8Array(f.params.customLut) : undefined,
      extraConfig: f.params.extraConfig ? JSON.parse(JSON.stringify(f.params.extraConfig)) : undefined,
    },
  };
}

/**
 * Deep-clones a LayerMask with an independent canvas and 2D context.
 */
export function cloneLayerMask(mask: LayerMask): LayerMask {
  const mCanvas = document.createElement('canvas');
  mCanvas.width = mask.canvas.width;
  mCanvas.height = mask.canvas.height;
  const mCtx = mCanvas.getContext('2d', { willReadFrequently: true })!;
  mCtx.drawImage(mask.canvas, 0, 0);

  return {
    id: `mask_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    canvas: mCanvas,
    ctx: mCtx,
    visible: mask.visible,
    locked: mask.locked,
    thumbnailUrl: mask.thumbnailUrl,
    density: mask.density,
    feather: mask.feather,
  };
}

/**
 * Deep-clones an individual sub-layer inside a smart layer.
 */
export function cloneSubLayer(l: Layer): Layer {
  const copyCanvas = document.createElement('canvas');
  copyCanvas.width = l.canvas.width;
  copyCanvas.height = l.canvas.height;
  const copyCtx = copyCanvas.getContext('2d', { willReadFrequently: true })!;
  copyCtx.drawImage(l.canvas, 0, 0);

  return {
    ...l,
    id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    canvas: copyCanvas,
    ctx: copyCtx,
    mask: l.mask ? cloneLayerMask(l.mask) : undefined,
    vectorPaths: l.vectorPaths ? JSON.parse(JSON.stringify(l.vectorPaths)) : undefined,
    adjustmentConfig: l.adjustmentConfig ? JSON.parse(JSON.stringify(l.adjustmentConfig)) : undefined,
    effects: l.effects ? JSON.parse(JSON.stringify(l.effects)) : undefined,
    smartLayers: l.smartLayers ? l.smartLayers.map(cloneSubLayer) : undefined,
    smartFilters: l.smartFilters ? l.smartFilters.map(cloneSmartFilter) : undefined,
  };
}

/**
 * Applies an individual smart filter to an offscreen canvas buffer non-destructively.
 */
export function applySmartFilter(
  src: HTMLCanvasElement,
  filter: SmartFilter,
  width: number,
  height: number
): HTMLCanvasElement {
  if (!filter.enabled) return src;
  const { type, params } = filter;
  if (!type) return src;

  const target = document.createElement('canvas');
  target.width = width;
  target.height = height;
  const tCtx = target.getContext('2d', { willReadFrequently: true });
  if (!tCtx) return src;

  switch (type) {
    case 'gaussian_blur':
      applyGaussianBlur(src, tCtx, params.val1);
      return target;
    case 'hue_saturation':
      applyHueSaturation(src, tCtx, params.val1, params.val2, params.val3);
      return target;
    case 'noise':
      applyNoise(src, tCtx, params.val1);
      return target;
    case 'invert':
      applyInvert(src, tCtx, params.val1);
      return target;
    case 'grayscale':
      applyGrayscale(src, tCtx, params.val1);
      return target;
    case 'dither_suite': {
      const cfg = params.extraConfig;
      if (!cfg) return src;
      const tab = cfg.tab || 'indexed';
      if (tab === 'indexed' && cfg.indexed) {
        return applyIndexedDither(src, cfg.indexed);
      }
      if (tab === 'macpaint' && cfg.macpaint) {
        return applyMacPaintDither(src, cfg.macpaint);
      }
      if (tab === 'halftone' && cfg.halftone) {
        return applyCmykHalftoneScreen(src, cfg.halftone);
      }
      if (tab === 'modulation' && cfg.modulation) {
        return applySignalModulation(src, cfg.modulation);
      }
      return src;
    }
    case 'liquify': {
      const cached = getCachedLiquifyCanvas(filter.id, params.extraConfig?.warpDataUrl, width, height);
      if (cached) {
        tCtx.drawImage(cached, 0, 0);
        return target;
      }
      return src;
    }
    default: {
      const processed = processFilterEffect(
        src,
        type,
        params.val1,
        params.val2,
        params.val3,
        params.customLut,
        params.extraConfig
      );
      return processed || src;
    }
  }
}

/**
 * Renders the composite of all internal sub-layers of a Smart Layer onto its canvas,
 * and then executes the non-destructive Smart Filters stack in order!
 * The sub-layers themselves are NEVER destroyed or rasterized.
 */
export function renderSmartLayerCanvas(
  smartLayer: Layer,
  width: number,
  height: number
): void {
  // Step 1: Composite all internal sub-layers onto a clean base buffer
  const cleanComposite = document.createElement('canvas');
  cleanComposite.width = width;
  cleanComposite.height = height;
  const compCtx = cleanComposite.getContext('2d', { willReadFrequently: true })!;

  const subLayers = smartLayer.smartLayers || [];

  for (let i = 0; i < subLayers.length; i++) {
    const sub = subLayers[i];
    if (!sub.visible) continue;

    // Handle adjustment layers inside smart layer
    if (sub.type === 'adjustment' && sub.adjustmentConfig) {
      const adjusted = renderFastAdjustmentLayer(cleanComposite, sub.adjustmentConfig);
      compCtx.save();
      compCtx.globalAlpha = sub.opacity;
      compCtx.globalCompositeOperation = getCanvasCompositeOperation(sub.blendMode);

      if (sub.mask && sub.mask.visible) {
        const maskedBuf = document.createElement('canvas');
        maskedBuf.width = width;
        maskedBuf.height = height;
        const mbCtx = maskedBuf.getContext('2d')!;
        mbCtx.drawImage(adjusted, 0, 0);
        applyProcessedMask(mbCtx, sub.mask, width, height);
        compCtx.drawImage(maskedBuf, 0, 0);
      } else {
        compCtx.drawImage(adjusted, 0, 0);
      }
      compCtx.restore();
      continue;
    }

    // Handle layer effects on sub-layer
    const srcCanvas =
      sub.effects && hasActiveEffects(sub.effects)
        ? renderLayerEffectsToCanvas(sub.canvas, sub.effects)
        : sub.canvas;

    compCtx.save();
    compCtx.globalAlpha = sub.opacity;
    compCtx.globalCompositeOperation = getCanvasCompositeOperation(sub.blendMode);

    if (sub.mask && sub.mask.visible) {
      const maskedBuf = document.createElement('canvas');
      maskedBuf.width = width;
      maskedBuf.height = height;
      const mbCtx = maskedBuf.getContext('2d')!;
      mbCtx.drawImage(srcCanvas, 0, 0);
      applyProcessedMask(mbCtx, sub.mask, width, height);
      compCtx.drawImage(maskedBuf, 0, 0);
    } else {
      compCtx.drawImage(srcCanvas, 0, 0);
    }
    compCtx.restore();
  }

  // Step 2: Apply Smart Filters Stack Non-Destructively
  let filteredComposite: HTMLCanvasElement = cleanComposite;
  const isFiltersMasterEnabled = smartLayer.smartFiltersEnabled !== false;

  if (isFiltersMasterEnabled && smartLayer.smartFilters && smartLayer.smartFilters.length > 0) {
    for (const filter of smartLayer.smartFilters) {
      if (filter.enabled) {
        filteredComposite = applySmartFilter(filteredComposite, filter, width, height);
      }
    }
  }

  // Step 3: Draw final filtered composite onto smartLayer canvas
  const ctx = smartLayer.ctx;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(filteredComposite, 0, 0);

  // Step 4: Apply outer Layer Effects / Styles if present
  if (smartLayer.effects && hasActiveEffects(smartLayer.effects)) {
    const fxResult = renderLayerEffectsToCanvas(smartLayer.canvas, smartLayer.effects);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(fxResult, 0, 0);
  }

  // Step 5: Update thumbnail for fast UI previews
  const thumb = document.createElement('canvas');
  thumb.width = 64;
  thumb.height = 64;
  thumb.getContext('2d')?.drawImage(smartLayer.canvas, 0, 0, 64, 64);
  smartLayer.thumbnailUrl = thumb.toDataURL();
}

/**
 * Adds a new smart filter to a smart layer (or updates existing one), then re-renders.
 */
export function addSmartFilterToLayer(
  layer: Layer,
  name: string,
  type: ActiveAdjustment,
  params: SmartFilterParams,
  width: number,
  height: number
): SmartFilter {
  const newFilter: SmartFilter = {
    id: `sf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name,
    type,
    enabled: true,
    params,
  };

  layer.smartFilters = [...(layer.smartFilters || []), newFilter];
  layer.smartFiltersEnabled = true;
  layer.smartFiltersExpanded = true;
  renderSmartLayerCanvas(layer, width, height);
  return newFilter;
}

/**
 * Toggles a specific smart filter enabled/disabled.
 */
export function toggleSmartFilterInLayer(
  layer: Layer,
  filterId: string,
  width: number,
  height: number
): void {
  if (!layer.smartFilters) return;
  layer.smartFilters = layer.smartFilters.map((f) =>
    f.id === filterId ? { ...f, enabled: !f.enabled } : f
  );
  renderSmartLayerCanvas(layer, width, height);
}

/**
 * Toggles all smart filters enabled/disabled.
 */
export function toggleAllSmartFiltersInLayer(
  layer: Layer,
  width: number,
  height: number
): void {
  layer.smartFiltersEnabled = layer.smartFiltersEnabled === false ? true : false;
  renderSmartLayerCanvas(layer, width, height);
}

/**
 * Removes a smart filter from the layer.
 */
export function removeSmartFilterFromLayer(
  layer: Layer,
  filterId: string,
  width: number,
  height: number
): void {
  if (!layer.smartFilters) return;
  layer.smartFilters = layer.smartFilters.filter((f) => f.id !== filterId);
  renderSmartLayerCanvas(layer, width, height);
}

/**
 * Reorders a smart filter up or down in the stack.
 */
export function reorderSmartFilterInLayer(
  layer: Layer,
  filterId: string,
  direction: 'up' | 'down',
  width: number,
  height: number
): void {
  if (!layer.smartFilters || layer.smartFilters.length <= 1) return;
  const idx = layer.smartFilters.findIndex((f) => f.id === filterId);
  if (idx < 0) return;
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= layer.smartFilters.length) return;

  const filters = [...layer.smartFilters];
  const [moved] = filters.splice(idx, 1);
  filters.splice(targetIdx, 0, moved);
  layer.smartFilters = filters;
  renderSmartLayerCanvas(layer, width, height);
}

/**
 * Converts a Group folder (and all its nested child layers) into a Photoshop-parity Smart Layer.
 * The child layers are stored non-destructively in `smartLayer.smartLayers`.
 */
export function convertGroupToSmartLayer(
  group: Layer,
  childLayers: Layer[],
  width: number,
  height: number
): Layer {
  const smartCanvas = document.createElement('canvas');
  smartCanvas.width = width;
  smartCanvas.height = height;
  const smartCtx = smartCanvas.getContext('2d', { willReadFrequently: true })!;

  // Clean group name into Smart Layer name
  const cleanName = group.name.replace(/^Group\b/i, 'Smart').replace(/\bFolder\b/i, '') || `${group.name} (Smart)`;
  const finalName = cleanName.toLowerCase().includes('smart') ? cleanName : `${cleanName} (Smart)`;

  const smartLayer: Layer = {
    id: `smart_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: finalName,
    type: 'smart',
    visible: group.visible,
    opacity: group.opacity,
    blendMode: group.blendMode,
    locked: group.locked,
    canvas: smartCanvas,
    ctx: smartCtx,
    effects: group.effects ? JSON.parse(JSON.stringify(group.effects)) : undefined,
    mask: group.mask ? cloneLayerMask(group.mask) : undefined,
    smartLayers: childLayers.map((c) => ({
      ...cloneSubLayer(c),
      parentId: null, // Sub-layers now belong inside the smart layer container
    })),
    activeSmartSubLayerId: childLayers[0]?.id,
  };

  renderSmartLayerCanvas(smartLayer, width, height);
  return smartLayer;
}

/**
 * Converts one or more layers into a single Smart Layer.
 */
export function convertLayersToSmartLayer(
  layersToConvert: Layer[],
  width: number,
  height: number,
  customName?: string
): Layer {
  const smartCanvas = document.createElement('canvas');
  smartCanvas.width = width;
  smartCanvas.height = height;
  const smartCtx = smartCanvas.getContext('2d', { willReadFrequently: true })!;

  const baseName =
    customName ||
    (layersToConvert.length === 1
      ? `${layersToConvert[0].name} (Smart)`
      : `Smart Object (${layersToConvert.length} Layers)`);

  const smartLayer: Layer = {
    id: `smart_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: baseName,
    type: 'smart',
    visible: true,
    opacity: 1,
    blendMode: 'source-over',
    locked: false,
    canvas: smartCanvas,
    ctx: smartCtx,
    effects:
      layersToConvert.length === 1 && layersToConvert[0].effects
        ? JSON.parse(JSON.stringify(layersToConvert[0].effects))
        : undefined,
    smartLayers: layersToConvert.map((l) => ({
      ...cloneSubLayer(l),
      parentId: null,
    })),
    activeSmartSubLayerId: layersToConvert[0]?.id,
  };

  renderSmartLayerCanvas(smartLayer, width, height);
  return smartLayer;
}

/**
 * Unpacks a Smart Layer back into a regular Group folder with its child layers restored to the stack.
 */
export function unpackSmartLayerToGroup(
  smartLayer: Layer,
  width: number,
  height: number
): { group: Layer; childLayers: Layer[] } {
  const groupCanvas = document.createElement('canvas');
  groupCanvas.width = width;
  groupCanvas.height = height;
  const groupCtx = groupCanvas.getContext('2d', { willReadFrequently: true })!;

  const groupId = `group_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const groupName = smartLayer.name.replace(/\(Smart\)/gi, '').replace(/\bSmart Layer\b/gi, 'Group').trim() || 'Group';

  const group: Layer = {
    id: groupId,
    name: groupName.startsWith('Group') ? groupName : `Group (${groupName})`,
    type: 'group',
    isExpanded: true,
    visible: smartLayer.visible,
    opacity: smartLayer.opacity,
    blendMode: smartLayer.blendMode,
    locked: smartLayer.locked,
    canvas: groupCanvas,
    ctx: groupCtx,
    effects: smartLayer.effects ? JSON.parse(JSON.stringify(smartLayer.effects)) : undefined,
    mask: smartLayer.mask ? cloneLayerMask(smartLayer.mask) : undefined,
  };

  const internalLayers = smartLayer.smartLayers || [];
  const childLayers: Layer[] = internalLayers.map((sub, i) => {
    const cCanvas = document.createElement('canvas');
    cCanvas.width = width;
    cCanvas.height = height;
    const cCtx = cCanvas.getContext('2d', { willReadFrequently: true })!;
    cCtx.drawImage(sub.canvas, 0, 0);

    return {
      ...sub,
      id: `layer_${Date.now()}_child_${i}`,
      parentId: groupId,
      canvas: cCanvas,
      ctx: cCtx,
      mask: sub.mask ? cloneLayerMask(sub.mask) : undefined,
    };
  });

  return { group, childLayers };
}

/**
 * Flattens a Group folder (and all its children) into a single flat raster image layer.
 * All child opacities, blend modes, masks, and the group's own effects and masks are baked.
 */
export function flattenGroupToRasterLayer(
  group: Layer,
  childLayers: Layer[],
  width: number,
  height: number
): Layer {
  const flatCanvas = document.createElement('canvas');
  flatCanvas.width = width;
  flatCanvas.height = height;
  const flatCtx = flatCanvas.getContext('2d', { willReadFrequently: true })!;

  // 1. Composite all visible child layers
  const visibleChildren = childLayers.filter((c) => c.visible);
  visibleChildren.forEach((cl) => {
    const clCanvas =
      cl.effects && hasActiveEffects(cl.effects)
        ? renderLayerEffectsToCanvas(cl.canvas, cl.effects)
        : cl.canvas;

    const tempCl = document.createElement('canvas');
    tempCl.width = width;
    tempCl.height = height;
    const tCtx = tempCl.getContext('2d')!;
    tCtx.drawImage(clCanvas, 0, 0);

    if (cl.mask && cl.mask.visible) {
      applyProcessedMask(tCtx, cl.mask, width, height);
    }

    flatCtx.save();
    flatCtx.globalAlpha = cl.opacity;
    flatCtx.globalCompositeOperation = getCanvasCompositeOperation(cl.blendMode);
    flatCtx.drawImage(tempCl, 0, 0);
    flatCtx.restore();
  });

  // 2. Apply group Layer Effects (FX) if enabled
  let finalCanvas = flatCanvas;
  if (group.effects && hasActiveEffects(group.effects)) {
    finalCanvas = renderLayerEffectsToCanvas(flatCanvas, group.effects);
  }

  // 3. Apply group Mask if enabled
  if (group.mask && group.mask.visible) {
    const resCtx = finalCanvas.getContext('2d')!;
    applyProcessedMask(resCtx, group.mask, width, height);
  }

  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = width;
  resultCanvas.height = height;
  const resultCtx = resultCanvas.getContext('2d', { willReadFrequently: true })!;
  resultCtx.drawImage(finalCanvas, 0, 0);

  const thumb = document.createElement('canvas');
  thumb.width = 64;
  thumb.height = 64;
  thumb.getContext('2d')?.drawImage(resultCanvas, 0, 0, 64, 64);

  return {
    id: `layer_${Date.now()}_flat`,
    name: `${group.name.replace(/\bGroup\b/i, '').trim() || 'Group'} (Image)`,
    type: 'raster',
    visible: group.visible,
    opacity: group.opacity,
    blendMode: group.blendMode,
    locked: group.locked,
    canvas: resultCanvas,
    ctx: resultCtx,
    thumbnailUrl: thumb.toDataURL(),
  };
}

/**
 * Flattens a Smart Layer into a single flat raster image layer.
 * Bakes all sub-layers, smart filter effects, and masks into permanent pixels.
 */
export function flattenSmartLayerToRasterLayer(
  smartLayer: Layer,
  width: number,
  height: number
): Layer {
  // Ensure composite is fully refreshed
  renderSmartLayerCanvas(smartLayer, width, height);

  let bakedCanvas = smartLayer.canvas;

  // Apply smart layer effects
  if (smartLayer.effects && hasActiveEffects(smartLayer.effects)) {
    bakedCanvas = renderLayerEffectsToCanvas(smartLayer.canvas, smartLayer.effects);
  }

  // Apply smart layer mask
  if (smartLayer.mask && smartLayer.mask.visible) {
    const temp = document.createElement('canvas');
    temp.width = width;
    temp.height = height;
    const tCtx = temp.getContext('2d')!;
    tCtx.drawImage(bakedCanvas, 0, 0);
    applyProcessedMask(tCtx, smartLayer.mask, width, height);
    bakedCanvas = temp;
  }

  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = width;
  resultCanvas.height = height;
  const resultCtx = resultCanvas.getContext('2d', { willReadFrequently: true })!;
  resultCtx.drawImage(bakedCanvas, 0, 0);

  const thumb = document.createElement('canvas');
  thumb.width = 64;
  thumb.height = 64;
  thumb.getContext('2d')?.drawImage(resultCanvas, 0, 0, 64, 64);

  const cleanName = smartLayer.name.replace(/\(Smart\)/gi, '').trim() || 'Smart Layer';

  return {
    id: `layer_${Date.now()}_flat`,
    name: `${cleanName} (Image)`,
    type: 'raster',
    visible: smartLayer.visible,
    opacity: smartLayer.opacity,
    blendMode: smartLayer.blendMode,
    locked: smartLayer.locked,
    canvas: resultCanvas,
    ctx: resultCtx,
    thumbnailUrl: thumb.toDataURL(),
  };
}

/**
 * Flattens the entire document (all visible layers + background color) into a single flat background image layer.
 * Standard Photoshop "Flatten Image" behavior.
 */
export function flattenAllLayersToRasterLayer(
  layers: Layer[],
  width: number,
  height: number,
  backgroundColor: string = '#111215'
): Layer {
  const flatCanvas = document.createElement('canvas');
  flatCanvas.width = width;
  flatCanvas.height = height;
  const flatCtx = flatCanvas.getContext('2d', { willReadFrequently: true })!;

  // 1. Draw solid background color
  if (backgroundColor && backgroundColor !== 'transparent') {
    flatCtx.fillStyle = backgroundColor;
    flatCtx.fillRect(0, 0, width, height);
  }

  // 2. Composite layers in ascending order (0 = bottom layer)
  for (let i = 0; i < layers.length; i++) {
    const l = layers[i];
    if (!l.visible) continue;

    // Skip children that are inside a group because group handles them
    if (l.parentId && layers.some((p) => p.id === l.parentId && p.type === 'group')) {
      continue;
    }

    if (l.type === 'group') {
      const children = layers.filter((c) => c.parentId === l.id && c.visible);
      const groupRaster = flattenGroupToRasterLayer(l, children, width, height);

      flatCtx.save();
      flatCtx.globalAlpha = l.opacity;
      flatCtx.globalCompositeOperation = getCanvasCompositeOperation(l.blendMode);
      flatCtx.drawImage(groupRaster.canvas, 0, 0);
      flatCtx.restore();
      continue;
    }

    if (l.type === 'smart') {
      const smartRaster = flattenSmartLayerToRasterLayer(l, width, height);
      flatCtx.save();
      flatCtx.globalAlpha = l.opacity;
      flatCtx.globalCompositeOperation = getCanvasCompositeOperation(l.blendMode);
      flatCtx.drawImage(smartRaster.canvas, 0, 0);
      flatCtx.restore();
      continue;
    }

    if (l.type === 'adjustment' && l.adjustmentConfig) {
      const adjusted = renderFastAdjustmentLayer(flatCanvas, l.adjustmentConfig);
      flatCtx.save();
      flatCtx.globalAlpha = l.opacity;
      flatCtx.globalCompositeOperation = getCanvasCompositeOperation(l.blendMode);

      if (l.mask && l.mask.visible) {
        const mb = document.createElement('canvas');
        mb.width = width;
        mb.height = height;
        const mbCtx = mb.getContext('2d')!;
        mbCtx.drawImage(adjusted, 0, 0);
        applyProcessedMask(mbCtx, l.mask, width, height);
        flatCtx.drawImage(mb, 0, 0);
      } else {
        flatCtx.drawImage(adjusted, 0, 0);
      }
      flatCtx.restore();
      continue;
    }

    // Standard raster / vector layer
    const srcCanvas =
      l.effects && hasActiveEffects(l.effects)
        ? renderLayerEffectsToCanvas(l.canvas, l.effects)
        : l.canvas;

    flatCtx.save();
    flatCtx.globalAlpha = l.opacity;
    flatCtx.globalCompositeOperation = getCanvasCompositeOperation(l.blendMode);

    if (l.mask && l.mask.visible) {
      const mb = document.createElement('canvas');
      mb.width = width;
      mb.height = height;
      const mbCtx = mb.getContext('2d')!;
      mbCtx.drawImage(srcCanvas, 0, 0);
      applyProcessedMask(mbCtx, l.mask, width, height);
      flatCtx.drawImage(mb, 0, 0);
    } else {
      flatCtx.drawImage(srcCanvas, 0, 0);
    }
    flatCtx.restore();
  }

  const thumb = document.createElement('canvas');
  thumb.width = 64;
  thumb.height = 64;
  thumb.getContext('2d')?.drawImage(flatCanvas, 0, 0, 64, 64);

  return {
    id: `layer_${Date.now()}_flattened_all`,
    name: 'Background (Flattened Image)',
    type: 'raster',
    visible: true,
    opacity: 1,
    blendMode: 'source-over',
    locked: false,
    canvas: flatCanvas,
    ctx: flatCtx,
    thumbnailUrl: thumb.toDataURL(),
  };
}
