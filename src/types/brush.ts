import { Brush, BrushTexture, DualBrushConfig } from './canvas';
import { hydrateBrush } from '../constants/brushes';

export type ToolMode = 'paint' | 'smudge' | 'eraser';

export interface CurvePoint {
  x: number;
  y: number;
}

export interface SensorState {
  enabled: boolean;
  curve: CurvePoint[];
}

export type ParameterSensors = Record<string, SensorState>;

export interface UniversalBrushPreset {
  id: string;
  name: string;
  category: string;
  sourceFormat: 'native' | 'myb' | 'kpp' | 'bundle' | 'sut' | 'procreate';
  iconUrl?: string;
  dualBrush?: DualBrushConfig;
  kritaEngine?: 'pixel' | 'colorsmudge' | 'quick' | 'shape';
  kritaPatternId?: string;
  spikes?: number;
  density?: number;
  randomness?: number;
  darkenAmount?: number;

  spacing: number;
  jitterLateral: number;
  jitterLinear: number;
  falloff: number;

  streamline: number;
  stabilization: number;

  taperStart: number;
  taperEnd: number;
  taperSize: number;
  taperOpacity: number;

  shapeTexture?: BrushTexture;
  shapeTextureUrl?: string;
  shapeTextureUrls?: string[];
  hardness: number;
  roundness: number;
  angle: number;
  followStroke: boolean;
  penTiltControl?: boolean;
  scatter: number;
  flipX: boolean;
  flipY: boolean;

  grainTextureUrl?: string;
  grainMode: 'moving' | 'texturized';
  grainScale: number;
  grainDepth: number;
  grainBlendMode: GlobalCompositeOperation;

  patternEnabled?: boolean;
  patternStrength?: number;
  patternScale?: number;
  patternTexturingMode?: 'multiply' | 'subtract';
  patternCutoff?: number;
  patternInvert?: boolean;
  patternContrast?: number;
  patternBrightness?: number;
  patternOffsetX?: number;
  patternOffsetY?: number;
  patternStrengthPressure?: boolean;
  angleOffset?: number;

  sensors?: Record<string, ParameterSensors>;
  shareCurveAcrossSettings?: Record<string, boolean>;
  blendMode: string;
  wetMixDilution: number;
  smudgePull: number;
  smudgeLength: number;

  hueJitter: number;
  saturationJitter: number;
  brightnessJitter: number;

  baseSize: number;
  baseOpacity: number;
  sizeByPressure: CurvePoint[];
  opacityByPressure: CurvePoint[];
  sizeBySpeed: number;
  opacityBySpeed: number;
  tiltAngleInfluence: number;

  minSize: number;
  maxSize: number;
  orientToScreen: boolean;
}

export function brushToUniversal(b: Brush): UniversalBrushPreset {
  const rawAngle =
    b.shape?.rotation ?? (b.shape as any)?.angle ?? (b as any).angle ?? 0;
  const rawRoundness = b.shape?.roundness ?? (b as any).roundness ?? 1.0;
  const normRoundness = rawRoundness > 1.05 ? rawRoundness / 100 : rawRoundness;

  const minPSize = Math.max(0, 1 - (b.pressureSizeFactor ?? 0.75));
  const minPOpacity = Math.max(0, 1 - (b.pressureOpacityFactor ?? 0));

  return {
    id: b.id,
    name: b.name,
    category: b.category || 'Hunbatz Base Brushes',
    sourceFormat: 'native',
    iconUrl: (b as any).iconUrl,
    kritaEngine: (b as any).kritaEngine || 'pixel',
    kritaPatternId: (b as any).kritaPatternId || (b.grain?.texture as string) || 'none',
    spikes: (b as any).spikes ?? 2,
    density: (b as any).density ?? 1.0,
    randomness: (b as any).randomness ?? 0,
    darkenAmount: (b as any).darkenAmount ?? 0,
    spacing: b.strokePath?.spacing ?? b.spacing ?? 0.05,
    jitterLateral: b.strokePath?.jitter ?? b.jitter ?? 0,
    jitterLinear: (b as any).jitterLinear ?? 0,
    falloff: b.strokePath?.fallOff ?? 0,
    streamline: b.stabilization?.streamline ?? b.streamline ?? 0.2,
    stabilization: b.stabilization?.stabilization ?? 0.2,
    taperStart: b.taper?.pressureTaper ?? 0,
    taperEnd: 0,
    taperSize: b.taper?.sizeTaper ?? 0,
    taperOpacity: b.taper?.opacityTaper ?? 0,
    shapeTexture: b.shape?.texture ?? b.texture ?? 'hard_round',
    shapeTextureUrl: (b as any).shapeTextureUrl,
    shapeTextureUrls: (b as any).shapeTextureUrls,
    hardness: b.taper?.tipSharpness ?? b.hardness ?? 0.9,
    roundness: Math.max(0.05, Math.min(1.0, normRoundness)),
    angle: ((Number(rawAngle) || 0) % 360 + 360) % 360,
    followStroke: b.shape?.followStroke ?? false,
    penTiltControl: (b.shape as any)?.penTiltControl ?? false,
    scatter: b.shape?.scatter ?? 0,
    flipX: false,
    flipY: false,
    grainTextureUrl: (b as any).grainTextureUrl,
    grainMode: b.grain?.mode ?? 'moving',
    grainScale: b.grain?.scale ?? 1.0,
    grainDepth: b.grain?.depth ?? 0,
    grainBlendMode: (b.grain?.blendMode as GlobalCompositeOperation) ?? 'multiply',
    patternEnabled: (b as any).patternEnabled ?? (b.grain?.depth ? b.grain.depth > 0 : false),
    patternStrength: (b as any).patternStrength ?? b.grain?.depth ?? 1.0,
    patternScale: (b as any).patternScale ?? b.grain?.scale ?? 1.0,
    patternTexturingMode: (b as any).patternTexturingMode ?? (b.grain?.blendMode === 'subtract' ? 'subtract' : 'multiply'),
    patternCutoff: (b as any).patternCutoff ?? b.grain?.cutoff ?? 0,
    patternInvert: (b as any).patternInvert ?? b.grain?.invert ?? false,
    patternContrast: (b as any).patternContrast ?? b.grain?.contrast ?? 1.0,
    patternBrightness: (b as any).patternBrightness ?? b.grain?.brightness ?? 0,
    patternOffsetX: (b as any).patternOffsetX ?? b.grain?.offsetX ?? 0,
    patternOffsetY: (b as any).patternOffsetY ?? b.grain?.offsetY ?? 0,
    patternStrengthPressure: (b as any).patternStrengthPressure ?? b.grain?.strengthPressure ?? false,
    angleOffset: (b.shape as any)?.angleOffset ?? (b as any).angleOffset ?? 0,
    sensors: (b as any).sensors,
    shareCurveAcrossSettings: (b as any).shareCurveAcrossSettings,
    blendMode:
      ((b.rendering?.blendMode || (b as any).blendMode) as string) || 'source-over',
    wetMixDilution: b.wetMix?.dilution ?? 0,
    smudgePull: b.wetMix?.pull ?? b.properties?.smudgePull ?? 0,
    smudgeLength: (b as any).smudgeLength ?? 0.75,
    hueJitter: b.colorDynamics?.stampHueJitter ?? 0,
    saturationJitter: b.colorDynamics?.stampSatJitter ?? 0,
    brightnessJitter: b.colorDynamics?.stampLightJitter ?? 0,
    baseSize: b.size ?? 24,
    baseOpacity: b.opacity ?? 1.0,
    sizeByPressure: (b as any).sizeByPressure || [
      { x: 0, y: minPSize },
      { x: 0.5, y: (minPSize + 1) / 2 },
      { x: 1, y: 1 },
    ],
    opacityByPressure: (b as any).opacityByPressure || [
      { x: 0, y: minPOpacity },
      { x: 0.5, y: (minPOpacity + 1) / 2 },
      { x: 1, y: 1 },
    ],
    sizeBySpeed: b.dynamics?.speedSize ?? 0,
    opacityBySpeed: b.dynamics?.speedOpacity ?? 0,
    tiltAngleInfluence: (b.shape as any)?.penTiltControl ? 0.85 : 0,
    minSize: b.minSize ?? 1,
    maxSize: b.maxSize ?? 400,
    orientToScreen: b.properties?.orientToScreen ?? true,
    dualBrush: b.dualBrush ? { ...b.dualBrush } : undefined,
  };
}

export function universalToBrush(u: UniversalBrushPreset): Brush {
  const minPSize = u.sizeByPressure?.[0]?.y ?? 0.25;
  const minPOpacity = u.opacityByPressure?.[0]?.y ?? 1.0;

  const hydrated = hydrateBrush({
    id: u.id,
    name: u.name,
    category: u.category || 'Hunbatz Base Brushes',
    size: u.baseSize,
    opacity: u.baseOpacity,
    hardness: u.hardness,
    streamline: u.streamline,
    spacing: u.spacing,
    jitter: u.jitterLateral,
    texture: u.shapeTexture || 'hard_round',
    pressureSizeFactor: Math.max(0, Math.min(1, 1 - minPSize)),
    pressureOpacityFactor: Math.max(0, Math.min(1, 1 - minPOpacity)),
    minSize: u.minSize,
    maxSize: u.maxSize,
    isCustom: true,
    strokePath: {
      spacing: u.spacing,
      streamline: u.streamline,
      jitter: u.jitterLateral,
      fallOff: u.falloff,
    },
    stabilization: {
      streamline: u.streamline,
      stabilization: u.stabilization,
      motionFiltering: 0,
    },
    taper: {
      pressureTaper: u.taperStart,
      tipSharpness: u.hardness,
      sizeTaper: u.taperSize,
      opacityTaper: u.taperOpacity,
    },
    shape: {
      texture: u.shapeTexture || 'hard_round',
      scatter: u.scatter,
      rotation: u.angle,
      followStroke: u.followStroke,
      count: 1,
      countJitter: 0,
      roundness: u.roundness,
      ...({
        angle: u.angle,
        penTiltControl: Boolean(u.penTiltControl || u.tiltAngleInfluence > 0),
        angleOffset: u.angleOffset ?? 0,
      } as any),
    },
    grain: {
      texture: (u.kritaPatternId && u.kritaPatternId !== 'none' ? u.kritaPatternId : 'blank') as any,
      mode: u.grainMode,
      scale: u.patternScale ?? u.grainScale,
      depth: u.patternStrength ?? u.grainDepth,
      contrast: 0.5,
      blendMode: (u.patternTexturingMode === 'subtract' ? 'subtract' : 'multiply') as any,
    },
    wetMix: {
      dilution: u.wetMixDilution,
      charge: 0.85,
      attack: 0.7,
      pull: u.smudgePull,
    },
    colorDynamics: {
      stampHueJitter: u.hueJitter,
      stampSatJitter: u.saturationJitter,
      stampLightJitter: u.brightnessJitter,
      strokeHueJitter: 0,
      pressureHueShift: 0,
    },
  });

  (hydrated as any).shapeTextureUrl = u.shapeTextureUrl;
  (hydrated as any).shapeTextureUrls = u.shapeTextureUrls;
  (hydrated as any).grainTextureUrl = u.grainTextureUrl;
  (hydrated as any).iconUrl = u.iconUrl;
  (hydrated as any).jitterLinear = u.jitterLinear;
  (hydrated as any).smudgeLength = u.smudgeLength;
  (hydrated as any).kritaEngine = u.kritaEngine || 'pixel';
  (hydrated as any).kritaPatternId = u.kritaPatternId || 'none';
  (hydrated as any).patternEnabled = u.patternEnabled ?? (u.grainDepth > 0);
  (hydrated as any).patternStrength = u.patternStrength ?? u.grainDepth ?? 1.0;
  (hydrated as any).patternScale = u.patternScale ?? u.grainScale ?? 1.0;
  (hydrated as any).patternTexturingMode = u.patternTexturingMode || 'multiply';
  (hydrated as any).patternCutoff = u.patternCutoff ?? 0;
  (hydrated as any).patternInvert = u.patternInvert ?? false;
  (hydrated as any).patternContrast = u.patternContrast ?? 1.0;
  (hydrated as any).patternBrightness = u.patternBrightness ?? 0;
  (hydrated as any).patternOffsetX = u.patternOffsetX ?? 0;
  (hydrated as any).patternOffsetY = u.patternOffsetY ?? 0;
  (hydrated as any).patternStrengthPressure = u.patternStrengthPressure ?? false;
  (hydrated as any).angleOffset = u.angleOffset ?? 0;
  (hydrated as any).spikes = u.spikes ?? 2;
  (hydrated as any).density = u.density ?? 1.0;
  (hydrated as any).randomness = u.randomness ?? 0;
  (hydrated as any).darkenAmount = u.darkenAmount ?? 0;
  (hydrated as any).sizeByPressure = u.sizeByPressure;
  (hydrated as any).opacityByPressure = u.opacityByPressure;
  (hydrated as any).sensors = u.sensors;
  (hydrated as any).shareCurveAcrossSettings = u.shareCurveAcrossSettings;
  (hydrated as any).blendMode = u.blendMode;
  hydrated.dualBrush = u.dualBrush ? { ...u.dualBrush } : undefined;
  if (!hydrated.rendering) {
    hydrated.rendering = {} as any;
  }
  if (hydrated.rendering) {
    hydrated.rendering.blendMode = u.blendMode as any;
  }

  if (
    u.kritaEngine === 'colorsmudge' ||
    (u.smudgePull > 0.25 && u.wetMixDilution > 0.25)
  ) {
    (hydrated as any).engine = 'krita_colorsmudge';
  }

  return hydrated;
}