export type ToolType = 'brush' | 'smudge' | 'eraser' | 'eyedropper' | 'select' | 'transform';

// ─── Blend Mode Types (Krita-Parity Suite) ──────────────────────────────
// Standard Canvas globalCompositeOperation modes + full Krita blend mode suite.
// See src/utils/blendModes.ts for pixel-level implementations and category mapping.

export type BlendMode =
  // Standard Canvas modes (fast path via ctx.globalCompositeOperation)
  | 'source-over'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  // Arithmetic
  | 'add'
  | 'subtract'
  | 'divide'
  | 'inverse-subtract'
  | 'multiply-arith'
  // Binary (bitwise per channel)
  | 'and'
  | 'or'
  | 'xor'
  | 'nand'
  | 'nor'
  | 'xnor'
  | 'implication'
  | 'not-implication'
  | 'converse'
  | 'not-converse'
  // Darken
  | 'burn'
  | 'easy-burn'
  | 'gamma-dark'
  | 'fog-darken'
  | 'shade'
  | 'linear-burn'
  | 'darker-color'
  // Lighten
  | 'color-dodge-lighten'
  | 'linear-dodge'
  | 'linear-dodge-minus-two-times'
  | 'normal-lighten'
  | 'addition'
  // HSI (Hue/Saturation/Intensity)
  | 'hue-hsi'
  | 'saturation-hsi'
  | 'increase-intensity-hsi'
  | 'decrease-intensity-hsi'
  | 'color-hsi'
  // HSL (Hue/Saturation/Lightness)
  | 'hue-hsl'
  | 'saturation-hsl'
  | 'increase-lightness'
  | 'decrease-lightness'
  | 'increase-saturation-hsl'
  | 'decrease-saturation-hsl'
  | 'color-hsl'
  | 'lightness'
  // HSV (Hue/Saturation/Value)
  | 'hue-hsv'
  | 'saturation-hsv'
  | 'increase-value'
  | 'decrease-value'
  | 'increase-saturation-hsv'
  | 'decrease-saturation-hsv'
  | 'color-hsv'
  | 'value'
  // HSY (Hue/Saturation/Luminosity — BT.601)
  | 'hue-hsy'
  | 'saturation-hsy'
  | 'increase-luminosity'
  | 'decrease-luminosity'
  | 'tint'
  | 'color-hsy'
  | 'luminosity'
  // Misc
  | 'copy'
  | 'copy-red'
  | 'copy-green'
  | 'copy-blue'
  | 'dissolve'
  | 'bumpmap'
  | 'combine-normal-map'
  | 'tangent-normal-map'
  // Mix
  | 'modulo'
  | 'modulo-continuous'
  | 'divisive-modulo'
  | 'divisive-modulo-continuous'
  | 'modulo-shift'
  | 'modulo-shift-continuous'
  // Negative
  | 'heat'
  | 'freeze'
  | 'glow'
  | 'reflect'
  | 'heat-glow'
  | 'freeze-reflect'
  | 'heat-glow-freeze-hybrid'
  | 'glow-heat'
  | 'reflect-freeze'
  // Quadratic
  | 'quadratic-intersection'
  | 'quadratic-union'
  | 'quadratic-multiply'
  | 'quadratic-divide'
  | 'quadratic-subtract';

export interface BevelEmbossEffect {
  enabled: boolean;
  style: 'inner_bevel' | 'outer_bevel' | 'emboss' | 'pillow_emboss';
  depth: number;
  size: number;
  soften: number;
  angle: number;
  altitude: number;
  highlightColor: string;
  highlightOpacity: number;
  shadowColor: string;
  shadowOpacity: number;
  blendMode?: BlendMode;
}

export interface StrokeEffect {
  enabled: boolean;
  size: number;
  position: 'outside' | 'inside' | 'center';
  color: string;
  opacity: number;
  blendMode?: BlendMode;
}

export interface InnerShadowEffect {
  enabled: boolean;
  color: string;
  opacity: number;
  angle: number;
  distance: number;
  choke: number;
  size: number;
  blendMode?: BlendMode;
}

export interface InnerGlowEffect {
  enabled: boolean;
  color: string;
  opacity: number;
  choke: number;
  size: number;
  blendMode?: BlendMode;
}

export interface SatinEffect {
  enabled: boolean;
  color: string;
  opacity: number;
  angle: number;
  distance: number;
  size: number;
  invert: boolean;
  blendMode?: BlendMode;
}

export interface ColorOverlayEffect {
  enabled: boolean;
  color: string;
  opacity: number;
  blendMode?: BlendMode;
}

export interface GradientOverlayEffect {
  enabled: boolean;
  color1: string;
  color2: string;
  angle: number;
  opacity: number;
  scale: number;
  reverse: boolean;
  blendMode?: BlendMode;
}

export interface PatternOverlayEffect {
  enabled: boolean;
  pattern: 'dots' | 'grid' | 'stripes' | 'noise';
  opacity: number;
  scale: number;
  blendMode?: BlendMode;
}

export interface OuterGlowEffect {
  enabled: boolean;
  color: string;
  opacity: number;
  spread: number;
  size: number;
  blendMode?: BlendMode;
}

export interface DropShadowEffect {
  enabled: boolean;
  color: string;
  opacity: number;
  angle: number;
  distance: number;
  spread: number;
  size: number;
  blendMode?: BlendMode;
}

export interface LayerEffectsConfig {
  bevelEmboss: BevelEmbossEffect;
  stroke: StrokeEffect;
  innerShadow: InnerShadowEffect;
  innerGlow: InnerGlowEffect;
  satin: SatinEffect;
  colorOverlay: ColorOverlayEffect;
  gradientOverlay: GradientOverlayEffect;
  patternOverlay: PatternOverlayEffect;
  outerGlow: OuterGlowEffect;
  dropShadow: DropShadowEffect;
}

export interface VectorPathStroke {
  id: string;
  points: { x: number; y: number; width?: number }[];
  strokeWidth: number;
  strokeColor: string;
  strokeCap?: 'round' | 'butt' | 'square' | 'tapered';
  mimicBrush?: boolean;
  opacity?: number;
}

export interface VectorPoint {
  id: string;
  x: number;
  y: number;
  width?: number;
}

export interface VectorPath {
  id: string;
  points: VectorPoint[];
  strokeWidth: number;
  strokeColor: string;
  closed: boolean;
  fillColor?: string;
  brushTexture?: BrushTexture;
}

export type LayerType = 'raster' | 'vector' | 'shape' | 'adjustment' | 'group' | 'smart';

export interface LayerMask {
  id: string;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  visible: boolean;
  locked: boolean;
  thumbnailUrl?: string;
  density?: number; // 0 to 100, default 100
  feather?: number; // 0 to 50 px, default 0
}

export interface AdjustmentLayerConfig {
  type:
    | 'relight'
    | 'curves'
    | 'hue_saturation'
    | 'black_and_white'
    | 'brightness_contrast'
    | 'invert'
    | 'threshold'
    | 'posterize'
    | 'color_lookup'
    | 'gradient_fill'
    | 'gradient_map'
    | 'selective_color'
    | 'photo_filter'
    | 'style_filters'
    | 'exposure'
    | 'thermal';
  settings: Record<string, any>;
  lutUrl?: string;
}

export interface LayerGroup {
  id: string;
  name: string;
  collapsed: boolean;
  visible?: boolean;
  opacity?: number;
  color?: string;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number; // 0 to 1
  blendMode: BlendMode;
  locked: boolean;
  alphaLocked?: boolean; // Deprecated: Standardized on Layer Masks
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  thumbnailUrl?: string;
  effects?: LayerEffectsConfig;
  type?: LayerType;
  parentId?: string | null;
  isExpanded?: boolean;
  isVector?: boolean;
  vectorPaths?: VectorPath[];
  vectorStrokes?: VectorPathStroke[];
  groupId?: string;
  assisted?: boolean;
  mask?: LayerMask;
  isClippingMask?: boolean; // Deprecated: Standardized on Layer Masks
  adjustmentConfig?: AdjustmentLayerConfig;
  // Photoshop-Parity Smart Layer / Smart Object Fields
  smartLayers?: Layer[];
  activeSmartSubLayerId?: string;
  smartFilters?: SmartFilter[];
  smartFiltersEnabled?: boolean;
  smartFiltersExpanded?: boolean;
}

export interface SmartFilterParams {
  val1: number;
  val2: number;
  val3: number;
  customLut?: Uint8Array;
  extraConfig?: any;
}

export interface SmartFilter {
  id: string;
  name: string;
  type: ActiveAdjustment;
  enabled: boolean;
  params: SmartFilterParams;
}

// Supports both default folders and any user-created custom folder name
export type BrushCategory = string;

export type BrushTexture =
  | 'hard_round'
  | 'hard_triangle'
  | 'hard_square'
  | 'pencil_grain'
  | 'smooth_ink'
  | 'bleed_ink'
  | 'acrylic_wet'
  | 'oil_bristle'
  | 'watercolor_wash'
  | 'soft_airbrush'
  | 'hard_airbrush'
  | 'halftone_dots'
  | 'charcoal_coarse'
  | 'charcoal_rough'
  | 'splatter_organic'
  | 'calligraphy_nib'
  | 'flat_bristle'
  | 'dry_bristle'
  | 'sumi_wash'
  | 'gouache_flat'
  | 'oil_impasto'
  | 'chisel_marker';

export interface BrushStrokePath {
  spacing: number; // distance fraction between dab stamps (0.01 - 1.0)
  streamline?: number; // Procreate Stroke Path StreamLine
  jitter: number; // spatial jitter (0 - 1.0)
  jitterLateral?: number; // perpendicular scatter (0 - 1.0)
  jitterLinear?: number; // along trajectory scatter (0 - 1.0)
  fallOff: number; // stroke fade out distance (0 - 1.0, 0 = infinite)
}

export interface BrushStabilization {
  streamline: number; // 0 (raw) to 0.95 (super smooth)
  stabilization: number; // 0 to 1.0 averaging radius
  motionFiltering: number; // 0 to 1.0 velocity cutoff
  motionFilteringExpression?: number; // 0 to 1.0
}

export interface BrushTaper {
  pressureTaper: number; // 0 to 1.0
  touchTaper?: number; // 0 to 1.0
  tipSharpness: number; // 0 to 1.0 (1.0 = 100% hard edge)
  sizeTaper: number; // 0 to 1.0
  opacityTaper: number; // 0 to 1.0
  tipAnimation?: boolean;
}

export interface BrushShape {
  texture: BrushTexture;
  scatter: number; // 0 to 1.0 random rotation
  rotation: number; // 0 to 360 deg
  angle?: number; // 0 to 360 deg alias
  followStroke: boolean; // align angle to movement vector (Azimuth)
  count: number; // 1 to 16 dabs per stamp
  countJitter: number; // 0 to 1.0
  roundness?: number; // 0.05 to 1.0 elliptical ratio (`elliptical_dab_ratio`)
  flipX?: boolean;
  flipY?: boolean;
  randomized?: boolean;
  shapeTextureUrl?: string;
  penTiltControl?: boolean;
}

export interface BrushGrain {
  texture: string; // 'blank' | 'canvas' | 'paper' | 'charcoal' | 'halftone' | 'none'
  movement?: 'rolling' | 'texturized';
  mode?: 'moving' | 'texturized';
  scale: number; // 10% to 500%
  zoom?: number; // 10% to 200%
  contrast?: number; // 0.1 to 3.0 (default 1.0)
  depth?: number; // 0 to 1.0
  brightness?: number; // -1.0 to 1.0 (default 0)
  cutoff?: number; // 0 to 1.0 (default 0)
  invert?: boolean;
  offsetX?: number; // 0 to 1.0
  offsetY?: number; // 0 to 1.0
  strengthPressure?: boolean;
  offsetJitter?: boolean;
  blendMode?: 'multiply' | 'subtract' | 'overlay' | 'screen' | 'normal' | string;
}

export interface BrushRendering {
  mode:
    | 'light_glaze'
    | 'uniform_glaze'
    | 'intense_glaze'
    | 'heavy_glaze'
    | 'uniform_blending'
    | 'intense_blending';
  flow: number; // 0 to 1.0
  wetEdges: number; // 0 to 1.0
  burntEdges?: number; // 0 to 1.0
  blendMode?: string;
}

export interface BrushWetMix {
  dilution: number; // 0 to 1.0
  charge: number; // 0 to 1.0
  attack: number; // 0 to 1.0
  pull: number; // 0 to 1.0
  grade?: number; // 0 to 1.0
  blur?: number; // 0 to 1.0
  blurJitter?: number; // 0 to 1.0
  wetnessJitter?: number; // 0 to 1.0
}

export interface BrushColorDynamics {
  stampHueJitter: number; // 0 to 1.0
  stampSatJitter: number; // 0 to 1.0
  stampLightJitter: number; // 0 to 1.0
  strokeHueJitter: number; // 0 to 1.0
  pressureHueShift: number; // 0 to 1.0
  secondaryColorShift?: number; // 0 to 1.0
  tiltHueShift?: number; // 0 to 1.0
}

export interface BrushDynamics {
  speedSize: number; // -1.0 to 1.0
  speedOpacity: number; // -1.0 to 1.0
  jitterSize: number; // 0 to 1.0
  jitterOpacity: number; // 0 to 1.0
}

export interface BrushApplePencil {
  pressureSize: number; // 0 to 1.0
  pressureOpacity: number; // 0 to 1.0
  pressureFlow: number; // 0 to 1.0
  pressureBleed: number; // 0 to 1.0
  pressureSoftness: number; // 0 to 1.0
  tiltAngle: number; // 0 to 90 deg
  tiltOpacity: number; // 0 to 1.0
  tiltGradation: number; // 0 to 1.0
  tiltBleed: number; // 0 to 1.0
  tiltSize: number; // 0 to 1.0
}

export interface BrushPenControls {
  pressureSizeCurve?: number;
  pressureOpacityCurve?: number;
  tiltAngle?: boolean;
  tiltOpacity?: number;
  tiltGradation?: number;
  tiltSize?: number;
  pressureToSize?: number;
  pressureToOpacity?: number;
  tiltToAngle?: boolean;
}

export interface BrushProperties {
  minSize?: number;
  maxSize?: number;
  minOpacity?: number;
  maxOpacity?: number;
  previewSize?: number;
  orientToScreen: boolean;
  useStampPreview?: boolean;
  smudgePull?: number;
  minSizeLimit?: number;
  maxSizeLimit?: number;
}

export interface BrushMaterials {
  metallic: number; // 0 to 1.0
  roughness: number; // 0 to 1.0
}

export interface BrushSmudgeDynamics {
  strength: number; // 0 to 1.0 (how far smear travels)
  jitter: number; // 0 to 1.0 (spatial scatter during smear)
  brushFlow: number; // 0 to 1.0 (opacity / drag deposit rate)
}

export interface DualBrushConfig {
  enabled: boolean;
  stampShape?:
    | 'circle'
    | 'square'
    | 'grunge_splatter'
    | 'raked_bristles'
    | 'noise_grain'
    | 'charcoal_grit'
    | 'stipple'
    | 'canvas_weave';
  shapeTextureUrl?: string;
  texture?: BrushTexture | string;
  blendMode:
    | 'multiply'
    | 'mask'
    | 'subtract'
    | 'overlay'
    | 'darken'
    | 'lighten'
    | 'color-dodge'
    | 'screen'
    | 'linear-burn'
    | string;
  size?: number; // base secondary pixel size (e.g. 1 to 200px)
  sizeRatio: number; // 0.1 to 3.0 (fraction of primary brush size)
  opacity?: number; // 0 to 1.0 (Opacity)
  flow?: number; // 0 to 1.0 (Flow)
  spacing: number; // 0.05 to 2.0
  scatter: number; // 0 to 1.0
  intensity: number; // 0.0 to 1.0 (Pattern intensity / strength slider, Krita standard)
  rotation: number; // 0 to 360 deg
  colorDynamics?: {
    hueJitter?: number; // 0 to 1.0
    saturationJitter?: number; // 0 to 1.0
    lightnessJitter?: number; // 0 to 1.0
  };
  textureScale?: number; // 10 to 400%
  textureDepth?: number; // 0 to 1.0
}

export interface Brush {
  id: string;
  name: string;
  category: BrushCategory;
  description: string;
  size: number; // base pixel size
  opacity: number; // 0 to 1
  hardness?: number; // 0 to 1 (1.0 = 100% hard edge)
  streamline: number; // 0 (raw) to 0.95 (super smooth stabilization)
  spacing: number; // distance fraction between dab stamps (0.01 to 0.8)
  jitter: number; // random offset percentage
  texture: BrushTexture;
  pressureSizeFactor: number; // 0 to 1
  pressureOpacityFactor: number; // 0 to 1
  minSize: number;
  maxSize: number;

  // 1:1 Procreate & Krita Brush Studio Categories
  strokePath?: BrushStrokePath;
  stabilization?: BrushStabilization;
  taper?: BrushTaper;
  shape?: BrushShape;
  grain?: BrushGrain;
  dualBrush?: DualBrushConfig;
  rendering?: BrushRendering;
  wetMix?: BrushWetMix;
  colorDynamics?: BrushColorDynamics;
  dynamics?: BrushDynamics;
  applePencil?: BrushApplePencil;
  penControls?: BrushPenControls;
  properties?: BrushProperties;
  materials?: BrushMaterials;
  smudge?: BrushSmudgeDynamics;
  author?: string;
  isCustom?: boolean;
  customStampUrl?: string;
  shapeTextureUrl?: string;
  customGrainUrl?: string;
  sourceFormat?: 'procreate' | 'photoshop' | 'native' | 'krita' | 'mypaint';
  sensors?: Record<string, Record<string, { enabled: boolean; curve: { x: number; y: number }[] }>>;
  shareCurveAcrossSettings?: Record<string, boolean>;
  blendMode?: BlendMode | string;
}

export interface ColorPalette {
  id: string;
  name: string;
  colors: string[];
  isDefault?: boolean;
}

export type ColorTab = 'disc' | 'classic' | 'harmony' | 'value' | 'palettes';

export type HarmonyMode = 'complementary' | 'split' | 'triadic' | 'tetradic' | 'analogous';

export type DrawingGuideType =
  | 'none'
  | '2d_grid'
  | 'isometric'
  | 'perspective'
  | 'symmetry_vertical'
  | 'symmetry_horizontal'
  | 'symmetry_quad'
  | 'symmetry_radial';

export interface VanishingPoint {
  id: string;
  x: number;
  y: number;
  color: string;
}

export type SymmetryOption = 'vertical' | 'horizontal' | 'quadrant' | 'radial';

export interface DrawingGuideConfig {
  type: DrawingGuideType;
  opacity: number;
  thickness: number;
  gridSize: number;
  color: string;
  assisted: boolean;
  angle?: number;
  origin?: { x: number; y: number };
  vanishingPoints?: VanishingPoint[];
  symmetryOption?: SymmetryOption;
  rotationalSymmetry?: boolean;
}

export interface AnimationConfig {
  fps: number;
  loopMode: 'loop' | 'pingpong' | 'oneshot';
  onionSkinFrames: number;
  onionSkinOpacity: number;
  onionSkinPrevColor: string;
  onionSkinNextColor: string;
  isPlaying: boolean;
}

export type TransformMode = 'freeform' | 'uniform' | 'distort' | 'warp' | 'puppet';

export interface PuppetPin {
  id: string;
  x: number; // canvas space
  y: number;
  origX: number;
  origY: number;
}

export interface TransformState {
  isActive: boolean;
  mode: TransformMode;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // radians
  scaleX: number;
  scaleY: number;
  sourceCanvas?: HTMLCanvasElement;
  patchCanvas?: HTMLCanvasElement;
  baseCanvas?: HTMLCanvasElement;
  targetLayerId?: string;
  corners?: {
    tl: { x: number; y: number };
    tr: { x: number; y: number };
    br: { x: number; y: number };
    bl: { x: number; y: number };
  };
  meshGrid?: { x: number; y: number }[][];
  puppetPins?: PuppetPin[];
  showPuppetMesh?: boolean;
  originX?: number;
  originY?: number;
}

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
  tiltX?: number;
  tiltY?: number;
  time: number;
}

export interface CanvasStrokeRecord {
  tool: ToolType;
  brushId: string;
  color: string;
  size: number;
  opacity: number;
  layerId: string;
  points: StrokePoint[];
}

export interface ArtworkProject {
  id: string;
  title: string;
  width: number;
  height: number;
  createdAt: number;
  updatedAt: number;
  backgroundColor: string;
  layers: {
    id: string;
    name: string;
    visible: boolean;
    opacity: number;
    blendMode: BlendMode;
    locked: boolean;
    alphaLocked?: boolean;
    dataUrl: string;
    effects?: LayerEffectsConfig;
  }[];
  thumbnailUrl: string;
  recordedStrokes?: CanvasStrokeRecord[];
  fileName?: string;
  fileSize?: number;
}

export type ActiveAdjustment =
  | null
  | 'hue_saturation'
  | 'curves'
  | 'gaussian_blur'
  | 'motion_blur'
  | 'surface_blur'
  | 'perspective_blur'
  | 'noise'
  | 'invert'
  | 'grayscale'
  | 'gradient_map'
  | 'bloom'
  | 'chromatic_aberration'
  | 'halftone'
  | 'sharpen'
  | 'unsharp_mask'
  | 'fisheye'
  | 'poster_edges'
  | 'pixelate'
  | 'threshold'
  | 'cutout'
  | 'glitch_rgb_offset'
  | 'glitch_color_offset'
  | 'glitch_channel_swap'
  | 'glitch_channel_reflector'
  | 'glitch_random_dispersion'
  | 'glitch_hue_distortion'
  | 'glitch_pixel_sort'
  | 'glitch_kaleidoscope'
  | 'glitch_scanlines'
  | 'glitch_vhs'
  | 'glitch_led_screen'
  | 'dither_suite'
  | 'thermal'
  | 'channel_extractor'
  | 'liquify';