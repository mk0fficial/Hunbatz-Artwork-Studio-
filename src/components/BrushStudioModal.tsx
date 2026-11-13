import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UniversalBrushPreset,
  ToolMode,
  brushToUniversal,
  universalToBrush,
} from '../types/brush';
import { Brush, StrokePoint } from '../types/canvas';
import {
  renderStrokeSegment,
  renderSmudgeSegment,
  preloadKritaTexture,
  getAllKritaPatterns,
  registerCustomKritaPattern,
  deleteCustomKritaPattern,
  getKritaPatternCanvas,
  onKritaTipTextureLoaded,
  generateBrushSwatch,
} from '../utils/brushEngine';
import { parseBrushArchiveOrBinary } from '../utils/brushParsers';
import {
  BLEND_MODE_LABELS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  BLEND_MODE_CATEGORIES,
  KRITA_BLEND_MODE_GROUPS,
  getStoredFavoriteBlendModes,
  saveStoredFavoriteBlendModes,
  type KritaBlendMode,
  type BlendModeCategory,
} from '../utils/blendModes';
import { BrushTipGizmo } from './BrushTipGizmo';
import { PREDEFINED_BRUSH_TIPS, PredefinedBrushTip } from '../constants/predefinedBrushTips';
import {
  saveLocalBrush,
  fetchLocalTextures,
  fetchLocalBrushTips,
  subscribeToLocalTextures,
  type LocalTextureDef,
  type LocalTipDef,
} from '../services/localContentService';
import {
  Upload,
  Download,
  Trash2,
  Check,
  X,
  RotateCcw,
  Copy,
  Sliders,
  CheckSquare,
  Square,
  Search,
  Bookmark,
  Layers,
  ChevronDown,
  ChevronRight,
  Eraser,
} from 'lucide-react';

export interface UnifiedTipDef {
  id: string;
  name: string;
  url: string;
  source: 'local_tip' | 'local_texture' | 'predefined';
  badge: string;
  width?: number;
  height?: number;
}

interface BrushStudioModalProps {
  brush: UniversalBrushPreset | Brush;
  allBrushes?: Brush[];
  onSelectPreset?: (brush: Brush) => void;
  onSave?: (updatedBrush: UniversalBrushPreset) => void;
  onUpdateBrush?: (updatedBrush: Brush) => void;
  onImportBrushes?: (newBrushes: UniversalBrushPreset[]) => void;
  onDuplicateBrush?: (clonedBrush: Brush) => void;
  onDeleteBrush?: (brushId: string) => void;
  onClose: () => void;
}

type KritaTreeNodeId =
  | 'brush_tip'
  | 'dual_brush'
  | 'dual_tip'
  | 'dual_blending'
  | 'dual_opacity'
  | 'dual_flow'
  | 'dual_size'
  | 'dual_ratio'
  | 'dual_spacing'
  | 'dual_rotation'
  | 'dual_scatter'
  | 'blending_mode'
  | 'opacity'
  | 'flow'
  | 'size'
  | 'ratio'
  | 'spacing'
  | 'mirror'
  | 'softness'
  | 'rotation'
  | 'scatter'
  | 'color_source'
  | 'darken'
  | 'mix'
  | 'hue'
  | 'saturation'
  | 'value'
  | 'pattern'
  | 'pattern_strength';

const KRITA_SENSORS = [
  'Pressure',
  'PressureIn',
  'Tangential pressure',
  'Drawing angle',
  'Speed',
  'Tilt direction',
  'Tilt elevation',
  'Distance',
  'Time',
  'Fuzzy Dab',
  'Fuzzy Stroke',
  'Fade',
  'Perspective',
] as const;

function getSplineSvgPath(pts: { x: number; y: number }[], width: number, height: number): string {
  if (pts.length < 2) return '';
  const sorted = [...pts].sort((a, b) => a.x - b.x);
  const coords = sorted.map((p) => ({
    x: p.x * width,
    y: (1 - Math.max(0, Math.min(1, p.y))) * height,
  }));

  if (coords.length === 2) {
    return `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)} L ${coords[1].x.toFixed(1)} ${coords[1].y.toFixed(1)}`;
  }

  let path = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = i > 0 ? coords[i - 1] : coords[0];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = i < coords.length - 2 ? coords[i + 2] : p2;

    const tension = 0.5;
    const cp1x = p1.x + (p2.x - p0.x) * (tension / 3);
    const cp1y = p1.y + (p2.y - p0.y) * (tension / 3);
    const cp2x = p2.x - (p3.x - p1.x) * (tension / 3);
    const cp2y = p2.y - (p3.y - p1.y) * (tension / 3);

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return path;
}

function createInitialSensors(initial: UniversalBrushPreset): Record<string, Record<string, { enabled: boolean; curve: { x: number; y: number }[] }>> {
  const result: Record<string, Record<string, { enabled: boolean; curve: { x: number; y: number }[] }>> = {};
  const params = [
    'size', 'opacity', 'flow', 'ratio', 'spacing', 'mirror', 'softness',
    'rotation', 'scatter', 'color_source', 'darken', 'mix', 'hue', 'saturation', 'value',
    'dual_size', 'dual_opacity', 'dual_flow', 'dual_spacing', 'dual_rotation', 'dual_scatter'
  ];

  for (const param of params) {
    result[param] = {};
    for (const sensor of KRITA_SENSORS) {
      if (initial.sensors?.[param]?.[sensor]) {
        result[param][sensor] = {
          enabled: Boolean(initial.sensors[param][sensor].enabled),
          curve: initial.sensors[param][sensor].curve?.length
            ? [...initial.sensors[param][sensor].curve]
            : [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }],
        };
      } else {
        let isEnabled = false;
        let defaultCurve = [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }];

        if (param === 'size' && sensor === 'Pressure') {
          isEnabled = true;
          defaultCurve = initial.sizeByPressure?.length
            ? [...initial.sizeByPressure]
            : [{ x: 0, y: 0.15 }, { x: 0.5, y: 0.55 }, { x: 1, y: 1 }];
        } else if (param === 'opacity' && sensor === 'Pressure') {
          isEnabled = true;
          defaultCurve = initial.opacityByPressure?.length
            ? [...initial.opacityByPressure]
            : [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }];
        } else if (param === 'flow' && sensor === 'Pressure') {
          isEnabled = true;
          defaultCurve = [{ x: 0, y: 0.2 }, { x: 0.5, y: 0.6 }, { x: 1, y: 1 }];
        } else if (param === 'rotation' && (sensor === 'Drawing angle' || sensor === 'Tilt direction')) {
          isEnabled = Boolean(initial.followStroke || initial.penTiltControl);
        } else if (param === 'scatter' && sensor === 'Pressure') {
          isEnabled = Boolean(initial.scatter || initial.jitterLateral > 0);
          defaultCurve = [{ x: 0, y: 0.2 }, { x: 0.5, y: 0.6 }, { x: 1, y: 1 }];
        }

        result[param][sensor] = {
          enabled: isEnabled,
          curve: defaultCurve,
        };
      }
    }
  }
  return result;
}

export const BrushStudioModal: React.FC<BrushStudioModalProps> = ({
  brush,
  allBrushes = [],
  onSelectPreset,
  onSave,
  onUpdateBrush,
  onImportBrushes,
  onDuplicateBrush,
  onDeleteBrush,
  onClose,
}) => {
  const initialPreset: UniversalBrushPreset =
    'baseSize' in brush
      ? (brush as UniversalBrushPreset)
      : brushToUniversal(brush as Brush);

  const [resetSnapshot, setResetSnapshot] = useState<UniversalBrushPreset>(() => ({
    ...initialPreset,
  }));
  const [draft, setDraft] = useState<UniversalBrushPreset>({ ...initialPreset });
  const [activeNode, setActiveNode] = useState<KritaTreeNodeId>('brush_tip');
  const [activeSensor, setActiveSensor] = useState<string>('Pressure');
  const [engineFilter, setEngineFilter] = useState<string>('all');
  const [tipSubTab, setTipSubTab] = useState<'auto' | 'predefined'>(() =>
    initialPreset.shapeTextureUrl ? 'predefined' : 'auto'
  );
  const [tipSearchQuery, setTipSearchQuery] = useState<string>('');
  const [stampPreviewSize, setStampPreviewSize] = useState<number>(56);
  const [brokenTipIds, setBrokenTipIds] = useState<Set<string>>(() => new Set());
  const [allUnifiedTips, setAllUnifiedTips] = useState<UnifiedTipDef[]>(() => {
    return PREDEFINED_BRUSH_TIPS.map((t) => ({
      id: t.id,
      name: t.name,
      url: t.url,
      source: 'predefined' as const,
      badge: 'Stamp',
      width: t.width,
      height: t.height,
    }));
  });

  const [previewMode, setPreviewMode] = useState<ToolMode>('paint');
  const [previewColor, setPreviewColor] = useState('#111215');
  const [scratchpadBg, setScratchpadBg] = useState<'light' | 'dark'>('light');
  const [patternsList, setPatternsList] = useState(() => getAllKritaPatterns());
  const [patternPreviewUrls, setPatternPreviewUrls] = useState<Record<string, string>>({});
  const [textureSubTab, setTextureSubTab] = useState<'texture' | 'options'>('texture');
  const [textureTagFilter, setTextureTagFilter] = useState<string>('All');
  const [textureSearchQuery, setTextureSearchQuery] = useState<string>('');
  const [tipLoadTick, setTipLoadTick] = useState(0);
  const textureTilingCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Isolated curve state per parameter AND per sensor
  const [sensors, setSensors] = useState(() => createInitialSensors(initialPreset));
  const [shareCurveAcrossSettings, setShareCurveAcrossSettings] = useState<Record<string, boolean>>(() => ({
    ...(initialPreset.shareCurveAcrossSettings || {}),
  }));

  const [blendModeFavorites, setBlendModeFavorites] = useState<KritaBlendMode[]>(() => getStoredFavoriteBlendModes());
  const [blendSearchQuery, setBlendSearchQuery] = useState('');
  const [lastNonEraserMode, setLastNonEraserMode] = useState<string>(() =>
    initialPreset.blendMode === 'erase' || initialPreset.blendMode === 'destination-out'
      ? 'source-over'
      : (initialPreset.blendMode || 'source-over')
  );
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    favorites: true,
    arithmetic: false,
    binary: false,
    darken: false,
    hsi: false,
    hsl: false,
    hsv: false,
    hsy: false,
    lighten: false,
    misc: false,
    mix: false,
    negative: false,
    quadratic: false,
  });

  const [draggedNodeIdx, setDraggedNodeIdx] = useState<number | null>(null);
  const [hoveredNodeIdx, setHoveredNodeIdx] = useState<number | null>(null);
  const activeNodeIdxRef = useRef<number | null>(null);
  const isDraggingCurveRef = useRef(false);

  useEffect(() => {
    const next =
      'baseSize' in brush
        ? (brush as UniversalBrushPreset)
        : brushToUniversal(brush as Brush);
    setDraft({ ...next });
    setResetSnapshot({ ...next });
    setSensors(createInitialSensors(next));
    setShareCurveAcrossSettings({ ...(next.shareCurveAcrossSettings || {}) });
    if (next.blendMode && next.blendMode !== 'erase' && next.blendMode !== 'destination-out') {
      setLastNonEraserMode(next.blendMode);
    }
  }, [brush]);

  const refreshPatternPreviews = useCallback(() => {
    const allPats = getAllKritaPatterns();
    setPatternsList(allPats);
    const urls: Record<string, string> = {};
    allPats.forEach((p) => {
      if (p.id === 'none') return;
      if (p.url) {
        urls[p.id] = p.url;
      } else if (p.customUrl) {
        urls[p.id] = p.customUrl;
      } else {
        const c = getKritaPatternCanvas(p.id);
        if (c) urls[p.id] = c.toDataURL();
      }
    });
    setPatternPreviewUrls(urls);
  }, []);

  const loadAllUnifiedTips = useCallback(async () => {
    try {
      const [localTips, localTextures] = await Promise.all([
        fetchLocalBrushTips().catch(() => [] as LocalTipDef[]),
        fetchLocalTextures().catch(() => [] as LocalTextureDef[]),
      ]);

      const seenUrls = new Set<string>();
      const unified: UnifiedTipDef[] = [];

      // 1. Local Brush Tips first (uploaded stamps & tips)
      if (Array.isArray(localTips)) {
        for (const t of localTips) {
          if (t && t.url && !seenUrls.has(t.url)) {
            seenUrls.add(t.url);
            unified.push({
              id: t.id || t.fileName || t.name,
              name: t.name || t.fileName || 'Local Tip',
              url: t.url,
              source: 'local_tip',
              badge: 'Local Tip',
            });
          }
        }
      }

      // 2. Local Textures (surface patterns & canvas grains as tips)
      if (Array.isArray(localTextures)) {
        for (const tex of localTextures) {
          if (tex && tex.url && !seenUrls.has(tex.url)) {
            seenUrls.add(tex.url);
            unified.push({
              id: tex.id || tex.fileName || tex.name,
              name: tex.name || tex.fileName || 'Local Texture',
              url: tex.url,
              source: 'local_texture',
              badge: 'Texture',
            });
          }
        }
      }

      // 3. Predefined Built-in Tips
      for (const pt of PREDEFINED_BRUSH_TIPS) {
        if (pt && pt.url && !seenUrls.has(pt.url)) {
          seenUrls.add(pt.url);
          unified.push({
            id: pt.id,
            name: pt.name,
            url: pt.url,
            source: 'predefined',
            badge: 'Built-in',
            width: pt.width,
            height: pt.height,
          });
        }
      }

      setAllUnifiedTips(unified);
    } catch (err) {
      console.warn('Failed loading unified tips:', err);
    }
  }, []);

  useEffect(() => {
    loadAllUnifiedTips();
    fetchLocalTextures().then(() => {
      refreshPatternPreviews();
    });
    const unsub = subscribeToLocalTextures(() => {
      loadAllUnifiedTips();
      refreshPatternPreviews();
    });
    const unregisterTipLoad = onKritaTipTextureLoaded(() => {
      setTipLoadTick((t) => t + 1);
    });
    return () => {
      unsub();
      unregisterTipLoad();
    };
  }, [loadAllUnifiedTips, refreshPatternPreviews]);

  // Render vertical seamless tiled preview in texture picker
  useEffect(() => {
    const canvas = textureTilingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const activePatId = draft.kritaPatternId || '01_canvas';
    if (activePatId === 'none') {
      ctx.fillStyle = '#141817';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const patCanvas = getKritaPatternCanvas(activePatId);
    if (patCanvas) {
      const pat = ctx.createPattern(patCanvas, 'repeat');
      if (pat) {
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [draft.kritaPatternId, tipLoadTick]);

  useEffect(() => {
    preloadKritaTexture(draft.shapeTextureUrl);
    preloadKritaTexture(draft.grainTextureUrl);
  }, [draft.shapeTextureUrl, draft.grainTextureUrl]);

  const bannerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawKritaBannerStroke = useCallback(() => {
    const canvas = bannerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width;
    const h = canvas.height;
    const steps = 48;
    const asBrush = universalToBrush({
      ...draft,
      sensors,
      shareCurveAcrossSettings,
      blendMode: draft.blendMode || 'source-over',
    });
    (asBrush as any).sensors = sensors;
    (asBrush as any).blendMode = draft.blendMode || 'source-over';
    const pts: StrokePoint[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push({
        x: 16 + t * (w - 32),
        y: h / 2 + Math.sin(t * Math.PI * 2) * (h * 0.26),
        pressure: Math.sin(t * Math.PI) * 0.9 + 0.1,
        time: i * 12,
      });
    }

    const demoSize = Math.max(6, Math.min(28, draft.baseSize * 0.6));
    for (let i = 0; i < pts.length - 1; i++) {
      renderStrokeSegment(
        ctx,
        pts[i],
        pts[i + 1],
        asBrush,
        '#5fd3ad',
        demoSize,
        draft.baseOpacity,
        false
      );
    }
  }, [draft, sensors, tipLoadTick]);

  useEffect(() => {
    const animId = requestAnimationFrame(() => {
      drawKritaBannerStroke();
    });
    return () => cancelAnimationFrame(animId);
  }, [drawKritaBannerStroke]);

  const padCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<StrokePoint | null>(null);

  const seedDrawingPad = useCallback(() => {
    const canvas = padCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = scratchpadBg === 'light' ? '#f4f4f6' : '#121615';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const grad = ctx.createLinearGradient(20, 20, canvas.width - 20, 65);
    grad.addColorStop(0, '#cf4a30');
    grad.addColorStop(0.5, '#b89058');
    grad.addColorStop(1, '#5fd3ad');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(20, 16, canvas.width - 40, 42, 8);
    ctx.fill();
  }, [scratchpadBg]);

  const clearBlankPad = useCallback(() => {
    const canvas = padCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = scratchpadBg === 'light' ? '#f4f4f6' : '#121615';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [scratchpadBg]);

  useEffect(() => {
    seedDrawingPad();
  }, [seedDrawingPad]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    isDrawingRef.current = true;
    const pt: StrokePoint = {
      x: ((e.clientX - rect.left) / rect.width) * e.currentTarget.width,
      y: ((e.clientY - rect.top) / rect.height) * e.currentTarget.height,
      pressure: e.pressure > 0 ? e.pressure : 0.7,
      tiltX: e.tiltX,
      tiltY: e.tiltY,
      time: Date.now(),
    };
    lastPointRef.current = pt;

    const ctx = e.currentTarget.getContext('2d')!;
    const asBrush = universalToBrush(draft);
    (asBrush as any).sensors = sensors;
    (asBrush as any).blendMode = draft.blendMode || 'source-over';
    if (previewMode !== 'smudge') {
      renderStrokeSegment(
        ctx,
        pt,
        { ...pt, x: pt.x + 0.5, y: pt.y + 0.5 },
        asBrush,
        previewColor,
        draft.baseSize,
        draft.baseOpacity,
        previewMode === 'eraser'
      );
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPointRef.current || !padCanvasRef.current)
      return;
    const rect = e.currentTarget.getBoundingClientRect();
    const currentPoint: StrokePoint = {
      x: ((e.clientX - rect.left) / rect.width) * e.currentTarget.width,
      y: ((e.clientY - rect.top) / rect.height) * e.currentTarget.height,
      pressure: e.pressure > 0 ? e.pressure : 0.7,
      tiltX: e.tiltX,
      tiltY: e.tiltY,
      time: Date.now(),
    };
    const ctx = padCanvasRef.current.getContext('2d')!;
    const asBrush = universalToBrush({
      ...draft,
      sensors,
      shareCurveAcrossSettings,
      blendMode: draft.blendMode || 'source-over',
    });
    (asBrush as any).sensors = sensors;
    (asBrush as any).blendMode = draft.blendMode || 'source-over';

    if (previewMode === 'smudge') {
      renderSmudgeSegment(
        ctx,
        lastPointRef.current,
        currentPoint,
        asBrush,
        draft.baseSize,
        draft.baseOpacity
      );
    } else {
      renderStrokeSegment(
        ctx,
        lastPointRef.current,
        currentPoint,
        asBrush,
        previewColor,
        draft.baseSize,
        draft.baseOpacity,
        previewMode === 'eraser'
      );
    }
    lastPointRef.current = currentPoint;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const allImported: UniversalBrushPreset[] = [];
    for (const file of Array.from(e.target.files)) {
      const parsed = await parseBrushArchiveOrBinary(file);
      allImported.push(...parsed);
    }
    if (allImported.length > 0) {
      setDraft(allImported[0]);
      onImportBrushes?.(allImported);
    }
  };

  const handleExportCurrentPreset = () => {
    const asBrush = universalToBrush(draft);
    const cleanName = draft.name.replace(/[^a-z0-9_-]/gi, '_');
    const blob = new Blob([JSON.stringify(asBrush, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanName}.hunbatz.brush.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateField = <K extends keyof UniversalBrushPreset>(
    key: K,
    value: UniversalBrushPreset[K]
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleCommitSave = () => {
    const updatedPreset: UniversalBrushPreset = {
      ...draft,
      sensors,
      shareCurveAcrossSettings,
      blendMode: draft.blendMode || 'source-over',
      sizeByPressure: sensors.size?.Pressure?.curve || draft.sizeByPressure,
      opacityByPressure: sensors.opacity?.Pressure?.curve || draft.opacityByPressure,
    };

    if (onSave) {
      onSave(updatedPreset);
    }
    const b = universalToBrush(updatedPreset);
    b.size = draft.baseSize;
    (b as any).baseSize = draft.baseSize;
    (b as any).sensors = sensors;
    (b as any).shareCurveAcrossSettings = shareCurveAcrossSettings;
    (b as any).blendMode = draft.blendMode || 'source-over';
    if (!b.rendering) (b as any).rendering = {};
    (b as any).dualBrush = draft.dualBrush;

    // Persist as .myb in Hunbatz local content/brushes/<folder>/
    saveLocalBrush(b, b.category || 'Inking').catch(() => {});

    if (onUpdateBrush) {
      onUpdateBrush(b);
    }
    onClose();
  };

  // Toggle checkbox on any Krita tree node (e.g., clicking Scatter or Pattern checkbox turns it on/off directly!)
  const toggleTreeNodeCheckbox = (nodeId: KritaTreeNodeId, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveNode(nodeId);
    if (nodeId.startsWith('dual_') || nodeId === 'dual_brush') {
      const isCurrentlyActive = Boolean(draft.dualBrush?.enabled);
      setDraft((d) => ({
        ...d,
        dualBrush: {
          enabled: !isCurrentlyActive,
          texture: d.dualBrush?.texture || 'charcoal',
          blendMode: d.dualBrush?.blendMode || 'multiply',
          sizeRatio: d.dualBrush?.sizeRatio ?? 1.0,
          opacity: d.dualBrush?.opacity ?? 1.0,
          flow: d.dualBrush?.flow ?? 1.0,
          spacing: d.dualBrush?.spacing ?? 0.25,
          scatter: d.dualBrush?.scatter ?? 0,
          intensity: d.dualBrush?.intensity ?? 0.8,
          rotation: d.dualBrush?.rotation ?? 0,
          roundness: d.dualBrush?.roundness ?? 1.0,
          hardness: d.dualBrush?.hardness ?? 0.8,
        },
      }));
    } else if (nodeId === 'scatter') {
      const isCurrentlyActive = draft.jitterLateral > 0 || draft.jitterLinear > 0;
      updateField('jitterLateral', isCurrentlyActive ? 0 : 0.35);
      updateField('jitterLinear', isCurrentlyActive ? 0 : 0.15);
    } else if (nodeId === 'rotation') {
      updateField('followStroke', !draft.followStroke);
    } else if (nodeId === 'mirror') {
      updateField('flipX', !draft.flipX);
    } else if (nodeId === 'pattern' || nodeId === 'pattern_strength') {
      if (draft.grainDepth > 0) {
        updateField('grainDepth', 0);
      } else {
        updateField(
          'kritaPatternId',
          draft.kritaPatternId && draft.kritaPatternId !== 'none'
            ? draft.kritaPatternId
            : '01_canvas'
        );
        updateField('grainDepth', 0.6);
      }
    } else if (nodeId === 'mix') {
      updateField('smudgePull', draft.smudgePull > 0 ? 0 : 0.75);
      updateField('wetMixDilution', draft.wetMixDilution > 0 ? 0 : 0.5);
    } else if (nodeId === 'darken') {
      updateField('darkenAmount', draft.darkenAmount && draft.darkenAmount > 0 ? 0 : 0.4);
    } else if (nodeId === 'hue') {
      updateField('hueJitter', draft.hueJitter > 0 ? 0 : 0.3);
    } else if (nodeId === 'saturation') {
      updateField('saturationJitter', draft.saturationJitter > 0 ? 0 : 0.3);
    } else if (nodeId === 'value') {
      updateField('brightnessJitter', draft.brightnessJitter > 0 ? 0 : 0.3);
    }
  };

  const curveSvgRef = useRef<SVGSVGElement | null>(null);

  const getActiveCurvePoints = (): { x: number; y: number }[] => {
    const curSensor = sensors[activeNode]?.[activeSensor];
    const pts = curSensor?.curve;
    if (pts && pts.length >= 2) return pts;
    return [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 1 },
    ];
  };

  const setActiveCurvePoints = (nextPts: { x: number; y: number }[]) => {
    const sorted = [...nextPts].sort((a, b) => a.x - b.x);
    setSensors((prev) => {
      const updated = { ...prev };
      const paramObj = { ...(updated[activeNode] || {}) };
      const curSensor = paramObj[activeSensor] || { enabled: true, curve: sorted };
      paramObj[activeSensor] = { ...curSensor, curve: sorted };
      updated[activeNode] = paramObj;

      if (shareCurveAcrossSettings[activeNode]) {
        for (const p of Object.keys(updated)) {
          if (p !== activeNode && updated[p]) {
            const targetObj = { ...updated[p] };
            if (targetObj[activeSensor]) {
              targetObj[activeSensor] = { ...targetObj[activeSensor], curve: sorted };
            }
            updated[p] = targetObj;
          }
        }
      }
      return updated;
    });

    if (activeNode === 'size' && activeSensor === 'Pressure') {
      updateField('sizeByPressure', sorted);
    } else if ((activeNode === 'opacity' || activeNode === 'flow') && activeSensor === 'Pressure') {
      updateField('opacityByPressure', sorted);
    } else if (activeNode === 'scatter') {
      if (draft.jitterLateral <= 0.01 && draft.jitterLinear <= 0.01) {
        updateField('jitterLateral', 0.35);
      }
    }
  };

  const toggleSensorEnabled = (sensorName: string, enabled: boolean) => {
    setSensors((prev) => {
      const updated = { ...prev };
      const paramObj = { ...(updated[activeNode] || {}) };
      const cur = paramObj[sensorName] || { enabled: false, curve: [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }] };
      paramObj[sensorName] = { ...cur, enabled };
      updated[activeNode] = paramObj;
      return updated;
    });
  };

  const toggleFavoriteBlendMode = (mode: KritaBlendMode) => {
    setBlendModeFavorites((prev) => {
      let updated: KritaBlendMode[];
      if (prev.includes(mode)) {
        updated = prev.filter((m) => m !== mode);
      } else {
        updated = [...prev, mode];
      }
      saveStoredFavoriteBlendModes(updated);
      return updated;
    });
  };

  const applyKritaCurvePreset = (
    presetType: 'linear' | 'scurve' | 'reverse' | 'ucurve' | 'arch' | 'flat'
  ) => {
    switch (presetType) {
      case 'linear':
        setActiveCurvePoints([
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ]);
        break;
      case 'scurve':
        setActiveCurvePoints([
          { x: 0, y: 0 },
          { x: 0.35, y: 0.15 },
          { x: 0.65, y: 0.85 },
          { x: 1, y: 1 },
        ]);
        break;
      case 'reverse':
        setActiveCurvePoints([
          { x: 0, y: 1 },
          { x: 1, y: 0 },
        ]);
        break;
      case 'ucurve':
        setActiveCurvePoints([
          { x: 0, y: 1 },
          { x: 0.5, y: 0.0 },
          { x: 1, y: 1 },
        ]);
        break;
      case 'arch':
        setActiveCurvePoints([
          { x: 0, y: 0 },
          { x: 0.5, y: 1.0 },
          { x: 1, y: 0 },
        ]);
        break;
      case 'flat':
        setActiveCurvePoints([
          { x: 0, y: 1 },
          { x: 1, y: 1 },
        ]);
        break;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 select-none"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col w-full max-w-[1320px] h-[90vh] mayan-panel border-2 border-[#b89058] rounded-2xl overflow-hidden shadow-[0_20px_70px_rgba(0,0,0,0.95)] text-[#e6c699]">
        {/* TOP KRITA EDITOR HEADER BAR */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#0c100f] border-b border-[#2c3532] gap-3 shrink-0 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#164435] border border-[#5fd3ad]/50 text-[#5fd3ad] text-xs font-mayan font-bold tracking-wider">
              <Sliders size={13} />
              <span>Brush Editor</span>
            </div>

            <input
              type="text"
              value={draft.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="px-2.5 py-1 bg-[#141a18] border border-[#2c3532] rounded text-xs sm:text-sm text-[#f2fbf7] font-semibold focus:outline-none focus:border-[#5fd3ad] w-44 sm:w-56 truncate"
            />

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[#9e9484]">Engine:</span>
              <select
                value={draft.kritaEngine || 'pixel'}
                onChange={(e) =>
                  updateField('kritaEngine', e.target.value as any)
                }
                className="px-2 py-1 rounded bg-[#141a18] border border-[#2c3532] text-[#5fd3ad] font-semibold text-xs outline-none cursor-pointer"
              >
                <option value="pixel">Pixel Engine</option>
                <option value="colorsmudge">Color Smudge Engine</option>
                <option value="quick">Quick Brush Engine</option>
                <option value="shape">Shape Engine (Spikes / Fill)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <label className="flex items-center gap-1.5 px-2.5 py-1.5 mayan-btn-stone text-xs font-semibold rounded-lg cursor-pointer transition hover:border-[#5fd3ad]">
              <Upload className="w-3.5 h-3.5 text-[#5fd3ad]" />
              <span>Import</span>
              <input
                type="file"
                multiple
                accept=".myb,.kpp,.bundle,.gbr,.gih,.sut,.brush,.brushset,.png,.zip,.json"
                onChange={handleFileImport}
                className="hidden"
              />
            </label>

            <button
              onClick={handleExportCurrentPreset}
              className="flex items-center gap-1 px-2.5 py-1.5 mayan-btn-stone rounded-lg text-xs cursor-pointer hover:text-white"
              title="Export Brush Preset (.json)"
            >
              <Download className="w-3.5 h-3.5 text-[#5fd3ad]" /> Export
            </button>

            {onDuplicateBrush && (
              <button
                onClick={() => {
                  const cloned = universalToBrush({
                    ...draft,
                    id: `krita_clone_${Date.now()}`,
                    name: `${draft.name} Copy`,
                  });
                  onDuplicateBrush(cloned);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 mayan-btn-stone rounded-lg text-xs cursor-pointer hover:text-white"
                title="Clone Brush Preset"
              >
                <Copy className="w-3.5 h-3.5" /> Clone
              </button>
            )}

            <button
              onClick={() => setDraft({ ...resetSnapshot })}
              className="flex items-center gap-1 px-2.5 py-1.5 mayan-btn-stone rounded-lg text-xs cursor-pointer hover:text-white"
              title="Reload Original Preset"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#b89058]" /> Reset
            </button>

            {onDeleteBrush && (
              <button
                onClick={() => {
                  onDeleteBrush(draft.id);
                  onClose();
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 mayan-btn-terracotta rounded-lg text-xs cursor-pointer"
                title="Delete Brush Preset"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            )}

            <button
              onClick={onClose}
              className="flex items-center gap-1 px-2.5 py-1.5 mayan-btn-stone rounded-lg text-xs cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Close
            </button>

            <button
              onClick={handleCommitSave}
              className="flex items-center gap-1.5 px-3.5 py-1.5 mayan-btn-cta font-bold rounded-lg text-xs shadow-md cursor-pointer"
              title="Save & persist brush preset directly to Hunbatz local content"
            >
              <Check className="w-4 h-4" /> Save to Local Content
            </button>
          </div>
        </div>

        {/* DEDICATED LIVE STROKE PREVIEW SUB-HEADER BANNER */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-[#080b0a] border-b border-[#2c3532] gap-3 shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-[#9e9484]">
            <span className="w-2 h-2 rounded-full bg-[#5fd3ad]" />
            <span className="font-mayan font-bold uppercase tracking-wider text-[#b89058]">Live Stroke Ribbon:</span>
            <span className="text-[10px] hidden sm:inline text-zinc-400">Real-time pressure gradient & dab composite</span>
          </div>
          <div className="flex-1 max-w-xl h-7 bg-[#050706] border border-[#2c3532] rounded-md px-2 py-0.5 overflow-hidden flex items-center justify-center">
            <canvas
              ref={bannerCanvasRef}
              width={520}
              height={28}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="text-[10px] text-[#9e9484] shrink-0 font-mono">
            {draft.baseSize}px · {Math.round(draft.baseOpacity * 100)}%
          </div>
        </div>

        {/* 4-PANE KRITA BRUSH EDITOR BODY */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* PANE 1: LEFT KRITA PRESET CHOOSER */}
          <div className="w-48 bg-[#0b0e0d] border-r border-[#2c3532] flex flex-col shrink-0">
            <div className="p-2 border-b border-[#2c3532] space-y-1.5">
              <span className="text-[10px] font-mayan font-bold uppercase tracking-wider text-[#b89058]">
                Presets ({allBrushes.length || 1})
              </span>
              <select
                value={engineFilter}
                onChange={(e) => setEngineFilter(e.target.value)}
                className="w-full px-2 py-1 bg-[#141a18] border border-[#2c3532] rounded text-[11px] text-[#e6c699] outline-none"
              >
                <option value="all">Engine: All</option>
                <option value="pixel">Pixel Engine</option>
                <option value="colorsmudge">Color Smudge</option>
                <option value="shape">Shape Engine</option>
              </select>
            </div>

            <div className="flex-1 overflow-y-auto p-2 grid grid-cols-3 gap-1.5 content-start">
              {(allBrushes.length > 0 ? allBrushes : [universalToBrush(draft)])
                .filter((b) => {
                  if (engineFilter === 'all') return true;
                  return ((b as any).kritaEngine || 'pixel') === engineFilter;
                })
                .map((b) => {
                  const isCurrent = b.id === draft.id;
                  const iconUrl = (b as any).iconUrl || (b as any).shapeTextureUrl;
                  const swatch = generateBrushSwatch(b, 64, 64, isCurrent ? '#5fd3ad' : '#b89058');
                  return (
                    <button
                      key={b.id}
                      onClick={() => {
                        const u = brushToUniversal(b);
                        setDraft(u);
                        setResetSnapshot(u);
                        onSelectPreset?.(b);
                      }}
                      title={`${b.name}\n(${b.description || 'Brush Preset'})`}
                      className={`group relative aspect-square rounded-lg border flex flex-col items-center justify-center p-1 overflow-hidden cursor-pointer transition ${
                        isCurrent
                          ? 'border-2 border-[#5fd3ad] bg-[#164435]/60 shadow-[0_0_10px_rgba(95,211,173,0.4)]'
                          : 'border-[#2c3532] bg-[#141a18] hover:border-[#b89058]'
                      }`}
                    >
                      <img
                        src={iconUrl || swatch}
                        alt={b.name}
                        onError={(e) => {
                          if (swatch) (e.currentTarget as HTMLImageElement).src = swatch;
                        }}
                        className="w-full h-full object-cover rounded bg-black/60"
                      />
                      <span className="absolute bottom-0 inset-x-0 bg-black/85 text-[8px] text-[#f2fbf7] truncate px-0.5 py-0.5 text-center font-medium">
                        {b.name.replace(/^[a-z]+\)\s*/i, '')}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* PANE 2: KRITA PARAMETER TREE (Clickable Checkboxes!) */}
          <div className="w-48 bg-[#0e1311] border-r border-[#2c3532] overflow-y-auto py-2 px-1.5 space-y-3 shrink-0 text-xs">
            <div>
              <div className="px-2 py-1 text-[10px] font-mayan font-bold uppercase tracking-wider text-[#b89058]">
                ▾ General
              </div>
              <div className="space-y-0.5 mt-0.5">
                {(
                  [
                    { id: 'brush_tip', label: 'Brush Tip', checked: true },
                    { id: 'blending_mode', label: 'Blending Mode', checked: true },
                    { id: 'opacity', label: 'Opacity', checked: true },
                    { id: 'flow', label: 'Flow', checked: true },
                    { id: 'size', label: 'Size', checked: true },
                    { id: 'ratio', label: 'Ratio', checked: draft.roundness < 0.99 },
                    { id: 'spacing', label: 'Spacing', checked: true },
                    { id: 'mirror', label: 'Mirror', checked: draft.flipX || draft.flipY },
                    { id: 'softness', label: 'Softness', checked: draft.hardness < 0.9 },
                    {
                      id: 'rotation',
                      label: 'Rotation',
                      checked: draft.followStroke || draft.angle > 0,
                    },
                    {
                      id: 'scatter',
                      label: 'Scatter',
                      checked: draft.jitterLateral > 0 || draft.jitterLinear > 0,
                    },
                  ] as const
                ).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setActiveNode(item.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition cursor-pointer ${
                      activeNode === item.id
                        ? 'bg-[#164435] text-[#f2fbf7] font-semibold border-l-2 border-[#5fd3ad]'
                        : 'text-[#e6c699]/80 hover:bg-white/5'
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                    <span
                      onClick={(e) => toggleTreeNodeCheckbox(item.id, e)}
                      title="Click to toggle this option on/off"
                      className="p-0.5 hover:scale-110 transition-transform"
                    >
                      {item.checked ? (
                        <CheckSquare size={13} className="text-[#5fd3ad] shrink-0" />
                      ) : (
                        <Square size={13} className="text-[#9e9484]/60 shrink-0" />
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* DEDICATED TOP-LEVEL CATEGORY: DUAL BRUSH */}
            <div>
              <div className="px-2 py-1 text-[10px] font-mayan font-bold uppercase tracking-wider text-[#b89058] flex items-center justify-between">
                <span>▾ Dual Brush</span>
                <span
                  onClick={(e) => toggleTreeNodeCheckbox('dual_brush', e)}
                  title="Toggle Dual Brush Engine on/off"
                  className="p-0.5 hover:scale-110 transition-transform cursor-pointer"
                >
                  {draft.dualBrush?.enabled ? (
                    <CheckSquare size={13} className="text-[#5fd3ad] shrink-0" />
                  ) : (
                    <Square size={13} className="text-[#9e9484]/60 shrink-0" />
                  )}
                </span>
              </div>
              <div className="space-y-0.5 mt-0.5">
                {(
                  [
                    { id: 'dual_brush', label: 'Dual Overview', checked: Boolean(draft.dualBrush?.enabled) },
                    { id: 'dual_tip', label: 'Secondary Tip', checked: Boolean(draft.dualBrush?.enabled) },
                    { id: 'dual_blending', label: 'Blending Mode', checked: Boolean(draft.dualBrush?.enabled) },
                    { id: 'dual_opacity', label: 'Opacity', checked: Boolean(draft.dualBrush?.enabled) },
                    { id: 'dual_flow', label: 'Flow', checked: Boolean(draft.dualBrush?.enabled) },
                    { id: 'dual_size', label: 'Size & Ratio', checked: Boolean(draft.dualBrush?.enabled) },
                    { id: 'dual_ratio', label: 'Ratio / Aspect', checked: Boolean(draft.dualBrush?.enabled) },
                    { id: 'dual_spacing', label: 'Spacing', checked: Boolean(draft.dualBrush?.enabled) },
                    { id: 'dual_rotation', label: 'Rotation', checked: Boolean(draft.dualBrush?.enabled) },
                    { id: 'dual_scatter', label: 'Scatter', checked: Boolean(draft.dualBrush?.enabled) },
                  ] as const
                ).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setActiveNode(item.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition cursor-pointer ${
                      activeNode === item.id
                        ? 'bg-[#164435] text-[#f2fbf7] font-semibold border-l-2 border-[#5fd3ad]'
                        : 'text-[#e6c699]/80 hover:bg-white/5'
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                    <span
                      onClick={(e) => toggleTreeNodeCheckbox(item.id, e)}
                      title="Click to toggle option on/off"
                      className="p-0.5 hover:scale-110 transition-transform"
                    >
                      {item.checked ? (
                        <CheckSquare size={13} className="text-[#5fd3ad] shrink-0" />
                      ) : (
                        <Square size={13} className="text-[#9e9484]/60 shrink-0" />
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="px-2 py-1 text-[10px] font-mayan font-bold uppercase tracking-wider text-[#b89058]">
                ▾ Color
              </div>
              <div className="space-y-0.5 mt-0.5">
                {(
                  [
                    { id: 'color_source', label: 'Source', checked: true },
                    {
                      id: 'darken',
                      label: 'Darken',
                      checked: Boolean(draft.darkenAmount && draft.darkenAmount > 0),
                    },
                    {
                      id: 'mix',
                      label: 'Mix / Smudge',
                      checked: draft.smudgePull > 0 || draft.wetMixDilution > 0,
                    },
                    { id: 'hue', label: 'Hue', checked: Math.abs(draft.hueJitter) > 0 },
                    {
                      id: 'saturation',
                      label: 'Saturation',
                      checked: Math.abs(draft.saturationJitter) > 0,
                    },
                    {
                      id: 'value',
                      label: 'Value',
                      checked: Math.abs(draft.brightnessJitter) > 0,
                    },
                  ] as const
                ).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setActiveNode(item.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition cursor-pointer ${
                      activeNode === item.id
                        ? 'bg-[#164435] text-[#f2fbf7] font-semibold border-l-2 border-[#5fd3ad]'
                        : 'text-[#e6c699]/80 hover:bg-white/5'
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                    <span
                      onClick={(e) => toggleTreeNodeCheckbox(item.id, e)}
                      className="p-0.5 hover:scale-110 transition-transform"
                    >
                      {item.checked ? (
                        <CheckSquare size={13} className="text-[#5fd3ad] shrink-0" />
                      ) : (
                        <Square size={13} className="text-[#9e9484]/60 shrink-0" />
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="px-2 py-1 text-[10px] font-mayan font-bold uppercase tracking-wider text-[#b89058]">
                ▾ Texture
              </div>
              <div className="space-y-0.5 mt-0.5">
                {(
                  [
                    {
                      id: 'pattern',
                      label: 'Pattern',
                      checked:
                        draft.grainDepth > 0 &&
                        (draft.kritaPatternId !== 'none' || Boolean(draft.grainTextureUrl)),
                    },
                    {
                      id: 'pattern_strength',
                      label: 'Strength',
                      checked: draft.grainDepth > 0,
                    },
                  ] as const
                ).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setActiveNode(item.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition cursor-pointer ${
                      activeNode === item.id
                        ? 'bg-[#164435] text-[#f2fbf7] font-semibold border-l-2 border-[#5fd3ad]'
                        : 'text-[#e6c699]/80 hover:bg-white/5'
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                    <span
                      onClick={(e) => toggleTreeNodeCheckbox(item.id, e)}
                      className="p-0.5 hover:scale-110 transition-transform"
                    >
                      {item.checked ? (
                        <CheckSquare size={13} className="text-[#5fd3ad] shrink-0" />
                      ) : (
                        <Square size={13} className="text-[#9e9484]/60 shrink-0" />
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* PANE 3: CENTER KRITA INSPECTOR */}
          <div className="flex-1 p-5 overflow-y-auto bg-[#111614] space-y-5">
            {activeNode === 'brush_tip' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#2c3532] pb-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTipSubTab('auto')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                        tipSubTab === 'auto' ? 'mayan-btn-jade' : 'mayan-btn-stone'
                      }`}
                    >
                      Auto Brush Tip
                    </button>
                    <button
                      onClick={() => setTipSubTab('predefined')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                        tipSubTab === 'predefined' ? 'mayan-btn-jade' : 'mayan-btn-stone'
                      }`}
                    >
                      Predefined Stamp (.png / .gbr / .gih)
                    </button>
                  </div>
                </div>

                {tipSubTab === 'auto' ? (
                  <div className="space-y-4">
                    <KritaBarSlider
                      label="Diameter"
                      value={draft.baseSize}
                      min={1}
                      max={400}
                      step={1}
                      unit=" px"
                      onChange={(v) => updateField('baseSize', v)}
                    />
                    <KritaBarSlider
                      label="Ratio (Roundness)"
                      value={draft.roundness}
                      min={0.05}
                      max={1.0}
                      step={0.01}
                      onChange={(v) => updateField('roundness', v)}
                    />
                    <KritaBarSlider
                      label="Softness / Fade"
                      value={draft.hardness}
                      min={0.02}
                      max={1.0}
                      step={0.01}
                      onChange={(v) => updateField('hardness', v)}
                    />
                    <KritaBarSlider
                      label="Angle"
                      value={draft.angle}
                      min={0}
                      max={360}
                      step={1}
                      unit="°"
                      onChange={(v) => updateField('angle', v)}
                    />
                    <KritaBarSlider
                      label="Spikes"
                      value={draft.spikes ?? 2}
                      min={2}
                      max={20}
                      step={1}
                      onChange={(v) => updateField('spikes', v)}
                    />
                    <KritaBarSlider
                      label="Randomness"
                      value={draft.randomness ?? 0}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(v) => updateField('randomness', v)}
                    />
                    <KritaBarSlider
                      label="Density"
                      value={(draft.density ?? 1) * 100}
                      min={10}
                      max={100}
                      step={1}
                      unit="%"
                      onChange={(v) => updateField('density', v / 100)}
                    />
                    <KritaBarSlider
                      label="Spacing (Auto)"
                      value={draft.spacing}
                      min={0.01}
                      max={1.0}
                      step={0.01}
                      onChange={(v) => updateField('spacing', v)}
                    />

                    <div className="p-3.5 mayan-well rounded-xl border border-[#2c3532] flex items-center justify-between gap-4">
                      <div className="space-y-1 text-xs">
                        <span className="font-bold text-[#5fd3ad]">
                          Mask Shape & Orientation
                        </span>
                        <p className="text-[11px] text-[#9e9484]">
                          Choose Circle, Chisel Square, Triangle, or Bristle Rake and rotate tip.
                        </p>
                        <div className="flex flex-wrap gap-1.5 pt-1.5">
                          {(
                            [
                              { id: 'hard_round', label: 'Circle' },
                              { id: 'soft_airbrush', label: 'Gaussian Soft' },
                              { id: 'chisel_marker', label: 'Square / Chisel' },
                              { id: 'hard_triangle', label: 'Triangle' },
                              { id: 'flat_bristle', label: 'Bristle Rake' },
                            ] as const
                          ).map((m) => (
                            <button
                              key={m.id}
                              onClick={() => updateField('shapeTexture', m.id)}
                              className={`px-2 py-1 rounded text-[10px] font-semibold cursor-pointer ${
                                draft.shapeTexture === m.id
                                  ? 'mayan-btn-jade'
                                  : 'mayan-btn-stone'
                              }`}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <BrushTipGizmo
                        angle={draft.angle}
                        roundness={draft.roundness}
                        onChange={(ang, rnd) => {
                          updateField('angle', ang);
                          updateField('roundness', rnd);
                        }}
                        size={96}
                        showTiltButton={false}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5 flex-1 min-h-0">
                    {/* Active Stamp Info Banner */}
                    <div className="px-3 py-1.5 rounded-lg bg-[#0e1312] border border-[#2c3532] flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[#9e9484]">Active Tip:</span>
                        <span className="font-semibold text-white/95 truncate">
                          {(() => {
                            if (!draft.shapeTextureUrl) return 'Procedural Auto Tip (Circle/Chisel)';
                            const matched = allUnifiedTips.find(
                              (t) =>
                                t.url === draft.shapeTextureUrl ||
                                draft.shapeTextureUrl?.includes(t.id)
                            );
                            return matched
                              ? `${matched.name} (${matched.badge || 'Stamp'})`
                              : 'Custom Stamp';
                          })()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#164435] text-[#5fd3ad] font-mono">
                          {allUnifiedTips.length} Tips & Textures
                        </span>
                        {draft.shapeTextureUrl && (
                          <button
                            onClick={() => {
                              updateField('shapeTextureUrl', undefined);
                              updateField('shapeTextureUrls', undefined);
                            }}
                            className="text-[10px] text-red-400 hover:text-red-300 underline cursor-pointer"
                          >
                            Reset to Auto Tip
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Unified Search Header (Categories Removed) */}
                    <div className="flex items-center justify-between gap-3 bg-[#0c100e] px-3 py-1.5 rounded-xl border border-[#2c3532]">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-[#e6c699]">Unified Library</span>
                        <span className="text-[10px] text-[#9e9484]">
                          All local brush tips, uploaded textures & built-in stamps
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-[#060807] rounded-lg border border-[#2c3532] text-xs">
                          <Sliders size={11} className="text-[#b89058]" />
                          <span className="text-[10px] text-[#9e9484] shrink-0">Zoom: {stampPreviewSize}px</span>
                          <input
                            type="range"
                            min="36"
                            max="120"
                            value={stampPreviewSize}
                            onChange={(e) => setStampPreviewSize(Number(e.target.value))}
                            className="w-16 mayan-range-slider cursor-pointer"
                            title="Adjust stamp preview thumbnail size"
                          />
                        </div>

                        <div className="relative w-44 shrink-0">
                          <Search
                            size={11}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5fd3ad]"
                          />
                          <input
                            type="text"
                            placeholder="Search stamps..."
                            value={tipSearchQuery}
                            onChange={(e) => setTipSearchQuery(e.target.value)}
                            className="w-full bg-[#060807] text-white text-[11px] pl-6 pr-5 py-1 rounded-lg border border-[#2c3532] focus:outline-none focus:border-[#5fd3ad]"
                          />
                          {tipSearchQuery && (
                            <button
                              onClick={() => setTipSearchQuery('')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs cursor-pointer"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Split: Left Thumbnails Grid + Right Tip Gizmo & Controls */}
                    <div className="flex gap-3 flex-1 min-h-0">
                      {/* Left: Dense Scrollable Grid of Tip Thumbnails with Zoom */}
                      <div
                        className="flex-1 overflow-y-auto max-h-[300px] p-2 mayan-well rounded-xl border border-[#2c3532] content-start"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(auto-fill, minmax(${stampPreviewSize}px, 1fr))`,
                          gap: '6px',
                        }}
                      >
                        {allUnifiedTips
                          .filter((tip) => {
                            if (brokenTipIds.has(tip.id) || brokenTipIds.has(tip.url)) return false;
                            if (tipSearchQuery.trim()) {
                              const q = tipSearchQuery.toLowerCase();
                              return (
                                tip.name.toLowerCase().includes(q) ||
                                (tip.badge && tip.badge.toLowerCase().includes(q))
                              );
                            }
                            return true;
                          })
                          .map((tip) => {
                            const isSelected =
                              draft.shapeTextureUrl === tip.url ||
                              Boolean(
                                draft.shapeTextureUrl &&
                                  draft.shapeTextureUrl.includes(tip.id)
                              );

                            return (
                              <button
                                key={`${tip.source}_${tip.id}`}
                                onClick={() => {
                                  updateField('shapeTextureUrl', tip.url);
                                  updateField('shapeTextureUrls', undefined);
                                  preloadKritaTexture(tip.url);
                                }}
                                title={`${tip.name} (${tip.badge || 'Tip'}${tip.width ? ` • ${tip.width}×${tip.height}` : ''})`}
                                className={`group relative flex flex-col items-center justify-center p-1 rounded-lg border cursor-pointer transition aspect-square overflow-hidden ${
                                  isSelected
                                    ? 'border-2 border-[#5fd3ad] bg-[#164435]/70 ring-2 ring-[#5fd3ad]/50 shadow-lg scale-95'
                                    : 'border-[#2c3532] bg-[#0c100e] hover:border-[#b89058] hover:bg-[#141a18]'
                                }`}
                              >
                                <img
                                  src={tip.url}
                                  alt={tip.name}
                                  loading="lazy"
                                  onError={() => {
                                    setBrokenTipIds((prev) => new Set(prev).add(tip.id));
                                  }}
                                  className="w-full h-full object-contain filter drop-shadow-sm"
                                />
                                {tip.source === 'local_tip' && (
                                  <span
                                    title="Local Tip"
                                    className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-[#5fd3ad] shadow-[0_0_4px_rgba(95,211,173,0.8)] pointer-events-none"
                                  />
                                )}
                                {tip.source === 'local_texture' && (
                                  <span
                                    title="Local Texture"
                                    className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-[#e6c699] shadow-[0_0_4px_rgba(230,198,153,0.8)] pointer-events-none"
                                  />
                                )}
                                {isSelected && (
                                  <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#5fd3ad] shadow-[0_0_6px_rgba(95,211,173,0.9)]" />
                                )}
                              </button>
                            );
                          })}
                      </div>

                      {/* Right: Tip Angle Gizmo & Dynamics */}
                      <div className="w-48 shrink-0 flex flex-col gap-2 p-2.5 rounded-xl bg-[#0b0e0d] border border-[#2c3532] overflow-y-auto max-h-[300px]">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#9e9484]">
                          Orientation & Ratio
                        </span>

                        <div className="flex justify-center py-1">
                          <BrushTipGizmo
                            angle={draft.angle}
                            roundness={draft.roundness}
                            onChange={(ang, rnd) => {
                              updateField('angle', ang);
                              updateField('roundness', rnd);
                            }}
                            size={84}
                            showTiltButton={false}
                          />
                        </div>

                        {/* Tip Diameter Slider */}
                        <div className="space-y-1 pt-1 border-t border-[#2c3532]">
                          <div className="flex justify-between text-[10px] text-[#9e9484]">
                            <span className="font-semibold text-[#e6c699]">Base Diameter</span>
                            <span className="text-[#5fd3ad] font-mono font-bold">{draft.baseSize} px</span>
                          </div>
                          <input
                            type="range"
                            min={1}
                            max={400}
                            value={draft.baseSize}
                            onChange={(e) => updateField('baseSize', parseInt(e.target.value, 10))}
                            className="w-full accent-[#5fd3ad] cursor-pointer"
                          />
                        </div>

                        <label className="flex items-center gap-1.5 text-[11px] text-[#e6c699] cursor-pointer pt-1 border-t border-[#2c3532]">
                          <input
                            type="checkbox"
                            checked={Boolean(draft.followStroke)}
                            onChange={(e) => updateField('followStroke', e.target.checked)}
                            className="rounded accent-[#5fd3ad] cursor-pointer"
                          />
                          <span>Follow Stroke</span>
                        </label>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-[#9e9484]">
                            <span>Angle</span>
                            <span className="text-[#5fd3ad] font-mono">{Math.round(draft.angle)}°</span>
                          </div>
                          <input
                            type="range"
                            min={-180}
                            max={180}
                            value={Math.round(draft.angle)}
                            onChange={(e) => updateField('angle', parseInt(e.target.value, 10))}
                            className="w-full accent-[#5fd3ad] cursor-pointer"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-[#9e9484]">
                            <span>Roundness</span>
                            <span className="text-[#5fd3ad] font-mono">{Math.round(draft.roundness * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min={5}
                            max={100}
                            value={Math.round(draft.roundness * 100)}
                            onChange={(e) => updateField('roundness', parseInt(e.target.value, 10) / 100)}
                            className="w-full accent-[#5fd3ad] cursor-pointer"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-[#9e9484]">
                            <span>Spacing</span>
                            <span className="text-[#5fd3ad] font-mono">{Math.round(draft.spacing * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min={1}
                            max={100}
                            value={Math.round(draft.spacing * 100)}
                            onChange={(e) => updateField('spacing', parseInt(e.target.value, 10) / 100)}
                            className="w-full accent-[#5fd3ad] cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="flex items-center justify-between pt-1 border-t border-[#2c3532] text-xs">
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 px-2.5 py-1 mayan-btn-jade rounded-lg text-xs font-semibold cursor-pointer">
                          <Upload size={12} />
                          <span>+ Upload Custom Stamp (.png / .gbr / .gih)</span>
                          <input
                            type="file"
                            accept=".png,.gbr,.gih"
                            onChange={handleFileImport}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <div className="text-[11px] text-[#9e9484]">
                        Click any tip to apply. Angle gizmo rotates tip live.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(activeNode === 'size' ||
              activeNode === 'opacity' ||
              activeNode === 'flow' ||
              activeNode === 'ratio' ||
              activeNode === 'softness' ||
              activeNode === 'rotation' ||
              activeNode === 'scatter') && (
              <div className="space-y-4">
                <div className="border-b border-[#2c3532] pb-2 flex items-center justify-between">
                  <span className="text-sm font-mayan font-bold uppercase tracking-wider text-[#5fd3ad]">
                    {activeNode.toUpperCase()} — Dynamic Sensor Curves
                  </span>
                  <label className="flex items-center gap-2 text-xs text-[#e6c699]">
                    <input
                      type="checkbox"
                      checked={true}
                      readOnly
                      className="accent-[#5fd3ad]"
                    />
                    <span>Enable Pen Settings</span>
                  </label>
                </div>

                {activeNode === 'size' && (
                  <KritaBarSlider
                    label="Base Size Diameter"
                    value={draft.baseSize}
                    min={1}
                    max={400}
                    step={1}
                    unit=" px"
                    onChange={(v) => updateField('baseSize', v)}
                  />
                )}
                {(activeNode === 'opacity' || activeNode === 'flow') && (
                  <KritaBarSlider
                    label="Strength"
                    value={Math.round(draft.baseOpacity * 100)}
                    min={1}
                    max={100}
                    step={1}
                    unit="%"
                    onChange={(v) => updateField('baseOpacity', v / 100)}
                  />
                )}
                {activeNode === 'ratio' && (
                  <KritaBarSlider
                    label="Elliptical Ratio (Roundness)"
                    value={draft.roundness}
                    min={0.05}
                    max={1.0}
                    step={0.01}
                    onChange={(v) => updateField('roundness', v)}
                  />
                )}
                {activeNode === 'softness' && (
                  <KritaBarSlider
                    label="Softness / Edge Fade"
                    value={draft.hardness}
                    min={0.02}
                    max={1.0}
                    step={0.01}
                    onChange={(v) => updateField('hardness', v)}
                  />
                )}
                {activeNode === 'rotation' && (
                  <div className="space-y-2">
                    <KritaBarSlider
                      label="Base Angle"
                      value={draft.angle}
                      min={0}
                      max={360}
                      step={1}
                      unit="°"
                      onChange={(v) => updateField('angle', v)}
                    />
                    <label className="flex items-center gap-2 text-xs text-[#e6c699] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.followStroke}
                        onChange={(e) => updateField('followStroke', e.target.checked)}
                        className="accent-[#5fd3ad]"
                      />
                      <span>Bind Rotation to Drawing Angle (Rake / Direction Follow)</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-[#e6c699] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(draft.penTiltControl || draft.tiltAngleInfluence > 0)}
                        onChange={(e) => {
                          updateField('penTiltControl', e.target.checked);
                          updateField('tiltAngleInfluence', e.target.checked ? 0.85 : 0);
                        }}
                        className="accent-[#5fd3ad]"
                      />
                      <span>Bind Rotation to Hardware Stylus Tilt Direction</span>
                    </label>
                  </div>
                )}
                {activeNode === 'scatter' && (
                  <div className="space-y-3">
                    <KritaBarSlider
                      label="Scatter X (Linear)"
                      value={draft.jitterLinear}
                      min={0}
                      max={2}
                      step={0.05}
                      onChange={(v) => updateField('jitterLinear', v)}
                    />
                    <KritaBarSlider
                      label="Scatter Y (Lateral)"
                      value={draft.jitterLateral}
                      min={0}
                      max={2}
                      step={0.05}
                      onChange={(v) => updateField('jitterLateral', v)}
                    />
                  </div>
                )}

                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-[#9e9484] mr-2">Curve Presets:</span>
                  {(
                    [
                      { id: 'linear', label: '╱ Linear' },
                      { id: 'scurve', label: '∫ S-Curve' },
                      { id: 'ucurve', label: '∪ U-Shape' },
                      { id: 'arch', label: '∩ Arch' },
                      { id: 'reverse', label: '╲ Reverse' },
                      { id: 'flat', label: '— Constant' },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => applyKritaCurvePreset(p.id)}
                      className="px-2 py-1 mayan-btn-stone rounded text-[10px] font-mono hover:border-[#5fd3ad] cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-12 gap-3 mayan-well p-3 rounded-xl border border-[#2c3532]">
                  {/* Left Column: Krita Sensor List + Share curve checkbox */}
                  <div className="col-span-5 border-r border-[#2c3532] pr-2 flex flex-col justify-between">
                    <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                      {KRITA_SENSORS.map((sensor) => {
                        const isSel = activeSensor === sensor;
                        const sensorState = sensors[activeNode]?.[sensor] || { enabled: false, curve: [] };
                        return (
                          <div
                            key={sensor}
                            onClick={() => setActiveSensor(sensor)}
                            className={`w-full flex items-center justify-between px-2 py-1 rounded text-[11px] cursor-pointer transition select-none ${
                              isSel
                                ? 'bg-[#164435] text-[#5fd3ad] font-bold border border-[#5fd3ad]/30 shadow-sm'
                                : 'text-[#e6c699]/70 hover:bg-white/5'
                            }`}
                          >
                            <span className="truncate flex-1 text-left">{sensor}</span>
                            <input
                              type="checkbox"
                              checked={Boolean(sensorState.enabled)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => toggleSensorEnabled(sensor, e.target.checked)}
                              className="rounded accent-[#5fd3ad] cursor-pointer ml-1.5 shrink-0"
                              title={`Toggle ${sensor} sensor`}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* "Share curve across all settings" checkbox below sensor list */}
                    <label className="flex items-center gap-2 text-[11px] text-[#e6c699] pt-2 mt-2 border-t border-[#2c3532] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(shareCurveAcrossSettings[activeNode])}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setShareCurveAcrossSettings((prev) => ({
                            ...prev,
                            [activeNode]: val,
                          }));
                          if (val) {
                            const pts = getActiveCurvePoints();
                            setSensors((prev) => {
                              const updated = { ...prev };
                              for (const p of Object.keys(updated)) {
                                if (updated[p]) {
                                  const targetObj = { ...updated[p] };
                                  if (targetObj[activeSensor]) {
                                    targetObj[activeSensor] = { ...targetObj[activeSensor], curve: pts };
                                  }
                                  updated[p] = targetObj;
                                }
                              }
                              return updated;
                            });
                          }
                        }}
                        className="rounded accent-[#5fd3ad] cursor-pointer shrink-0"
                      />
                      <span className="text-[#9e9484] hover:text-[#e6c699] text-[10px]">Share curve across all settings</span>
                    </label>
                  </div>

                  {/* Right Column: Multi-Node Interactive SVG Curve Graph */}
                  <div className="col-span-7 flex flex-col items-center justify-center">
                    <svg
                      ref={curveSvgRef}
                      width={240}
                      height={200}
                      viewBox="0 0 240 200"
                      className="bg-[#080a09] rounded-lg border border-[#2c3532] cursor-crosshair touch-none select-none relative"
                      onPointerDown={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const mouseX = Math.max(0, Math.min(240, ((e.clientX - rect.left) / rect.width) * 240));
                        const mouseY = Math.max(0, Math.min(200, ((e.clientY - rect.top) / rect.height) * 200));
                        const pts = getActiveCurvePoints();

                        // Check if clicked close to an existing control point
                        let hitIdx = -1;
                        for (let i = 0; i < pts.length; i++) {
                          const px = pts[i].x * 240;
                          const py = (1 - pts[i].y) * 200;
                          if (Math.hypot(px - mouseX, py - mouseY) <= 12) {
                            hitIdx = i;
                            break;
                          }
                        }

                        if (hitIdx !== -1) {
                          // Shift-click on interior node deletes it! (keeps at least 2 endpoints)
                          if (e.shiftKey && hitIdx > 0 && hitIdx < pts.length - 1) {
                            const filtered = pts.filter((_, idx) => idx !== hitIdx);
                            setActiveCurvePoints(filtered);
                            return;
                          }
                          activeNodeIdxRef.current = hitIdx;
                          isDraggingCurveRef.current = true;
                          setDraggedNodeIdx(hitIdx);
                          try {
                            e.currentTarget.setPointerCapture(e.pointerId);
                          } catch {}
                        } else {
                          // Click on empty graph/curve area: add new control point!
                          const nx = Math.max(0.02, Math.min(0.98, mouseX / 240));
                          const ny = Math.max(0.0, Math.min(1.0, 1 - mouseY / 200));
                          const newPts = [...pts, { x: nx, y: ny }].sort((a, b) => a.x - b.x);
                          const newIdx = newPts.findIndex((p) => Math.abs(p.x - nx) < 0.001 && Math.abs(p.y - ny) < 0.001);
                          setActiveCurvePoints(newPts);
                          activeNodeIdxRef.current = newIdx >= 0 ? newIdx : null;
                          isDraggingCurveRef.current = true;
                          setDraggedNodeIdx(newIdx);
                          try {
                            e.currentTarget.setPointerCapture(e.pointerId);
                          } catch {}
                        }
                      }}
                      onPointerMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const mouseX = ((e.clientX - rect.left) / rect.width) * 240;
                        const mouseY = ((e.clientY - rect.top) / rect.height) * 200;
                        const pts = getActiveCurvePoints();

                        if (!isDraggingCurveRef.current || activeNodeIdxRef.current === null) {
                          let hIdx: number | null = null;
                          for (let i = 0; i < pts.length; i++) {
                            const px = pts[i].x * 240;
                            const py = (1 - pts[i].y) * 200;
                            if (Math.hypot(px - mouseX, py - mouseY) <= 12) {
                              hIdx = i;
                              break;
                            }
                          }
                          setHoveredNodeIdx(hIdx);
                          return;
                        }

                        const idx = activeNodeIdxRef.current;
                        const rawNx = (e.clientX - rect.left) / rect.width;
                        const rawNy = 1 - (e.clientY - rect.top) / rect.height;

                        // Delete interior node if dragged off grid
                        if (idx > 0 && idx < pts.length - 1 && (rawNy < -0.25 || rawNy > 1.25 || rawNx < -0.25 || rawNx > 1.25)) {
                          const filtered = pts.filter((_, i) => i !== idx);
                          setActiveCurvePoints(filtered);
                          isDraggingCurveRef.current = false;
                          activeNodeIdxRef.current = null;
                          setDraggedNodeIdx(null);
                          try {
                            e.currentTarget.releasePointerCapture(e.pointerId);
                          } catch {}
                          return;
                        }

                        const updated = [...pts];
                        if (idx === 0) {
                          updated[0] = { x: 0, y: Math.max(0, Math.min(1, rawNy)) };
                        } else if (idx === pts.length - 1) {
                          updated[updated.length - 1] = { x: 1, y: Math.max(0, Math.min(1, rawNy)) };
                        } else {
                          const minX = (pts[idx - 1]?.x ?? 0) + 0.01;
                          const maxX = (pts[idx + 1]?.x ?? 1) - 0.01;
                          const nx = Math.max(minX, Math.min(maxX, Math.max(0.02, Math.min(0.98, rawNx))));
                          const ny = Math.max(0, Math.min(1, rawNy));
                          updated[idx] = { x: nx, y: ny };
                        }
                        setActiveCurvePoints(updated);
                      }}
                      onPointerUp={(e) => {
                        isDraggingCurveRef.current = false;
                        activeNodeIdxRef.current = null;
                        setDraggedNodeIdx(null);
                        try {
                          e.currentTarget.releasePointerCapture(e.pointerId);
                        } catch {}
                      }}
                    >
                      {/* Grid Lines */}
                      <line x1="0" y1="50" x2="240" y2="50" stroke="#1b2220" />
                      <line x1="0" y1="100" x2="240" y2="100" stroke="#1b2220" />
                      <line x1="0" y1="150" x2="240" y2="150" stroke="#1b2220" />
                      <line x1="60" y1="0" x2="60" y2="200" stroke="#1b2220" />
                      <line x1="120" y1="0" x2="120" y2="200" stroke="#1b2220" />
                      <line x1="180" y1="0" x2="180" y2="200" stroke="#1b2220" />

                      {(() => {
                        const pts = getActiveCurvePoints();
                        const pathD = getSplineSvgPath(pts, 240, 200);

                        return (
                          <>
                            <path
                              d={pathD}
                              fill="none"
                              stroke="#5fd3ad"
                              strokeWidth="2.5"
                            />
                            {pts.map((pt, i) => {
                              const cx = pt.x * 240;
                              const cy = (1 - pt.y) * 200;
                              const isEndpoint = i === 0 || i === pts.length - 1;
                              const isHovered = hoveredNodeIdx === i;
                              const isDragged = draggedNodeIdx === i;

                              return (
                                <g key={i}>
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={isDragged || isHovered ? 7.5 : 5.5}
                                    fill={isEndpoint ? '#e6c699' : '#5fd3ad'}
                                    stroke="#0c100f"
                                    strokeWidth={isDragged || isHovered ? 2.5 : 1.5}
                                    className="cursor-pointer transition-all"
                                  />
                                  {(isDragged || isHovered) && (
                                    <text
                                      x={Math.max(22, Math.min(218, cx))}
                                      y={cy > 24 ? cy - 10 : cy + 18}
                                      textAnchor="middle"
                                      fill="#5fd3ad"
                                      fontSize="10"
                                      fontFamily="monospace"
                                      fontWeight="bold"
                                      className="pointer-events-none drop-shadow"
                                    >
                                      {Math.round(pt.x * 100)}%, {Math.round(pt.y * 100)}%
                                    </text>
                                  )}
                                </g>
                              );
                            })}
                          </>
                        );
                      })()}
                    </svg>

                    <div className="w-full flex justify-between items-center text-[10px] text-[#9e9484] mt-1.5 px-2">
                      <span className="font-mono">
                        {activeNode.toUpperCase()} • {activeSensor}
                      </span>
                      <span className="text-[9px] text-[#9e9484]/70">
                        Click curve to add node · Shift+Click to delete
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DUAL BRUSH ENGINE & FULL PARAMETER PARITY SUBNODES */}
            {activeNode === 'dual_brush' && (
              <div className="space-y-5">
                {/* Header & Main Toggle */}
                <div className="flex items-center justify-between border-b border-[#2c3532] pb-3">
                  <div>
                    <h3 className="text-sm font-mayan font-bold text-[#f2fbf7] tracking-wide flex items-center gap-2">
                      <span>Dual Brush Engine</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#164435] text-[#5fd3ad] border border-[#5fd3ad]/40 font-mono">
                        Secondary Brush
                      </span>
                    </h3>
                    <p className="text-[11px] text-[#9e9484] mt-0.5">
                      Composites a secondary brush shape to mask, blend, or subtract against primary dab
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer bg-[#0e1311] px-3 py-1.5 rounded-lg border border-[#2c3532] hover:border-[#5fd3ad]/50 transition">
                    <input
                      type="checkbox"
                      checked={Boolean(draft.dualBrush?.enabled)}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setDraft((d) => ({
                          ...d,
                          dualBrush: {
                            enabled,
                            texture: d.dualBrush?.texture || 'charcoal',
                            blendMode: d.dualBrush?.blendMode || 'multiply',
                            sizeRatio: d.dualBrush?.sizeRatio ?? 1.0,
                            opacity: d.dualBrush?.opacity ?? 1.0,
                            flow: d.dualBrush?.flow ?? 1.0,
                            spacing: d.dualBrush?.spacing ?? 0.25,
                            scatter: d.dualBrush?.scatter ?? 0,
                            intensity: d.dualBrush?.intensity ?? 0.8,
                            rotation: d.dualBrush?.rotation ?? 0,
                            roundness: d.dualBrush?.roundness ?? 1.0,
                            hardness: d.dualBrush?.hardness ?? 0.8,
                          },
                        }));
                      }}
                      className="accent-[#5fd3ad] rounded cursor-pointer w-4 h-4"
                    />
                    <span className="text-xs font-semibold text-[#f2fbf7]">
                      {draft.dualBrush?.enabled ? 'Secondary Brush: Active' : 'Enable Secondary Brush'}
                    </span>
                  </label>
                </div>

                {/* Subcategory Navigation Grid */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'dual_tip', label: 'Secondary Tip', desc: draft.dualBrush?.stampShape?.replace('_', ' ') || 'Select Tip & Stamps' },
                    { id: 'dual_blending', label: 'Blending Mode', desc: draft.dualBrush?.blendMode || 'multiply' },
                    { id: 'dual_opacity', label: 'Opacity', desc: `${Math.round((draft.dualBrush?.opacity ?? 1.0) * 100)}%` },
                    { id: 'dual_flow', label: 'Flow', desc: `${Math.round((draft.dualBrush?.flow ?? 1.0) * 100)}%` },
                    { id: 'dual_size', label: 'Size & Ratio', desc: `${Math.round((draft.dualBrush?.sizeRatio ?? 1.0) * 100)}% ratio` },
                    { id: 'dual_ratio', label: 'Ratio / Aspect', desc: `${Math.round((draft.dualBrush?.roundness ?? 1.0) * 100)}% roundness` },
                    { id: 'dual_spacing', label: 'Spacing', desc: `${Math.round((draft.dualBrush?.spacing ?? 0.25) * 100)}%` },
                    { id: 'dual_rotation', label: 'Rotation', desc: `${Math.round(draft.dualBrush?.rotation ?? 0)}°` },
                    { id: 'dual_scatter', label: 'Scatter', desc: `${Math.round(draft.dualBrush?.scatter ?? 0)}%` },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveNode(cat.id as KritaTreeNodeId)}
                      className="p-2.5 rounded-xl border border-[#2c3532] bg-[#0c100e] hover:border-[#5fd3ad]/60 hover:bg-[#141a18] text-left transition cursor-pointer flex flex-col gap-0.5 group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#e6c699] group-hover:text-[#5fd3ad] transition-colors">{cat.label}</span>
                        <ChevronRight size={12} className="text-[#9e9484] group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <span className="text-[10px] text-[#9e9484] capitalize truncate font-mono">{cat.desc}</span>
                    </button>
                  ))}
                </div>

                {/* Quick Master Controls */}
                <div className="space-y-3 pt-3 border-t border-[#2c3532]">
                  <span className="text-xs font-semibold text-[#e6c699]">Quick Adjustments:</span>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1 bg-[#0e1311] p-2.5 rounded-lg border border-[#2c3532]">
                      <div className="flex justify-between text-xs text-[#9e9484]">
                        <span>Secondary Opacity</span>
                        <span className="text-[#5fd3ad] font-mono">{Math.round((draft.dualBrush?.opacity ?? 1.0) * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="100"
                        value={Math.round((draft.dualBrush?.opacity ?? 1.0) * 100)}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) / 100;
                          setDraft((d) => ({
                            ...d,
                            dualBrush: { ...(d.dualBrush || { enabled: true, texture: 'charcoal', blendMode: 'multiply', sizeRatio: 1.0, spacing: 0.25, scatter: 0, intensity: 0.8, rotation: 0 }), opacity: val },
                          }));
                        }}
                        className="w-full mayan-range-slider cursor-pointer"
                      />
                    </div>

                    <div className="flex flex-col gap-1 bg-[#0e1311] p-2.5 rounded-lg border border-[#2c3532]">
                      <div className="flex justify-between text-xs text-[#9e9484]">
                        <span>Secondary Flow</span>
                        <span className="text-[#5fd3ad] font-mono">{Math.round((draft.dualBrush?.flow ?? 1.0) * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="100"
                        value={Math.round((draft.dualBrush?.flow ?? 1.0) * 100)}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) / 100;
                          setDraft((d) => ({
                            ...d,
                            dualBrush: { ...(d.dualBrush || { enabled: true, texture: 'charcoal', blendMode: 'multiply', sizeRatio: 1.0, spacing: 0.25, scatter: 0, intensity: 0.8, rotation: 0 }), flow: val },
                          }));
                        }}
                        className="w-full mayan-range-slider cursor-pointer"
                      />
                    </div>

                    <div className="flex flex-col gap-1 bg-[#0e1311] p-2.5 rounded-lg border border-[#2c3532]">
                      <div className="flex justify-between text-xs text-[#9e9484]">
                        <span>Size Ratio</span>
                        <span className="text-[#5fd3ad] font-mono">{Math.round((draft.dualBrush?.sizeRatio ?? 1.0) * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="20"
                        max="300"
                        value={Math.round((draft.dualBrush?.sizeRatio ?? 1.0) * 100)}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) / 100;
                          setDraft((d) => ({
                            ...d,
                            dualBrush: { ...(d.dualBrush || { enabled: true, texture: 'charcoal', blendMode: 'multiply', spacing: 0.25, scatter: 0, intensity: 0.8, rotation: 0 }), sizeRatio: val },
                          }));
                        }}
                        className="w-full mayan-range-slider cursor-pointer"
                      />
                    </div>

                    <div className="flex flex-col gap-1 bg-[#0e1311] p-2.5 rounded-lg border border-[#2c3532]">
                      <div className="flex justify-between text-xs text-[#9e9484]">
                        <span>Tip Spacing</span>
                        <span className="text-[#5fd3ad] font-mono">{Math.round((draft.dualBrush?.spacing ?? 0.25) * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="150"
                        value={Math.round((draft.dualBrush?.spacing ?? 0.25) * 100)}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) / 100;
                          setDraft((d) => ({
                            ...d,
                            dualBrush: { ...(d.dualBrush || { enabled: true, texture: 'charcoal', blendMode: 'multiply', sizeRatio: 1.0, scatter: 0, intensity: 0.8, rotation: 0 }), spacing: val },
                          }));
                        }}
                        className="w-full mayan-range-slider cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUBNODE 1: SECONDARY BRUSH TIP PICKER */}
            {activeNode === 'dual_tip' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#2c3532] pb-2">
                  <span className="text-sm font-mayan font-bold text-[#5fd3ad] uppercase tracking-wide">
                    Secondary Brush Tip & Stamps
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-[#060807] rounded-lg border border-[#2c3532] text-xs">
                      <Sliders size={11} className="text-[#b89058]" />
                      <span className="text-[10px] text-[#9e9484] shrink-0">Zoom: {stampPreviewSize}px</span>
                      <input
                        type="range"
                        min="36"
                        max="120"
                        value={stampPreviewSize}
                        onChange={(e) => setStampPreviewSize(Number(e.target.value))}
                        className="w-16 mayan-range-slider cursor-pointer"
                        title="Adjust stamp preview thumbnail size"
                      />
                    </div>
                    <div className="relative w-40 shrink-0">
                      <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5fd3ad]" />
                      <input
                        type="text"
                        placeholder="Search secondary stamps..."
                        value={tipSearchQuery}
                        onChange={(e) => setTipSearchQuery(e.target.value)}
                        className="w-full bg-[#060807] text-white text-[11px] pl-6 pr-5 py-1 rounded-lg border border-[#2c3532] focus:outline-none focus:border-[#5fd3ad]"
                      />
                    </div>
                  </div>
                </div>

                {/* Predefined Shape Presets */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-[#e6c699]">Geometric & Natural Shape Presets:</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: 'circle', label: 'Circle', desc: 'Soft gradient stamp' },
                      { id: 'square', label: 'Square', desc: 'Crisp chisel stamp' },
                      { id: 'grunge_splatter', label: 'Splatter', desc: 'Spray & droplets' },
                      { id: 'raked_bristles', label: 'Bristles', desc: 'Multi-fiber rake' },
                      { id: 'noise_grain', label: 'Grain', desc: 'Film noise speckle' },
                      { id: 'charcoal_grit', label: 'Charcoal', desc: 'Porous grit flecks' },
                      { id: 'stipple', label: 'Stipple', desc: 'Concentric dots' },
                      { id: 'canvas_weave', label: 'Weave', desc: 'Cross-hatch grid' },
                    ].map((stampItem) => {
                      const isSelected = draft.dualBrush?.stampShape === stampItem.id && !draft.dualBrush?.shapeTextureUrl;
                      return (
                        <button
                          key={stampItem.id}
                          type="button"
                          onClick={() => {
                            setDraft((d) => ({
                              ...d,
                              dualBrush: {
                                ...(d.dualBrush || { enabled: true, texture: 'charcoal', blendMode: 'multiply', sizeRatio: 1.0, spacing: 0.25, scatter: 0, intensity: 0.8, rotation: 0 }),
                                stampShape: stampItem.id as any,
                                shapeTextureUrl: undefined,
                              },
                            }));
                          }}
                          className={`p-2 rounded-xl border text-left transition cursor-pointer flex flex-col gap-0.5 ${
                            isSelected
                              ? 'bg-[#164435] border-[#5fd3ad] text-[#f2fbf7] shadow-sm ring-1 ring-[#5fd3ad]/50'
                              : 'bg-[#0e1311] border-[#2c3532] text-[#e6c699]/70 hover:border-[#b89058]/50 hover:text-[#f2fbf7]'
                          }`}
                        >
                          <span className="text-[11px] font-bold truncate">{stampItem.label}</span>
                          <span className="text-[9px] text-[#9e9484] truncate">{stampItem.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Stamp Library Grid */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#e6c699]">Unified Stamp Library (Click to assign secondary tip):</span>
                    {draft.dualBrush?.shapeTextureUrl && (
                      <span className="text-[10px] text-[#5fd3ad] font-mono">Custom Tip Assigned</span>
                    )}
                  </div>
                  <div
                    className="overflow-y-auto max-h-[220px] p-2 mayan-well rounded-xl border border-[#2c3532] content-start"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(auto-fill, minmax(${stampPreviewSize}px, 1fr))`,
                      gap: '6px',
                    }}
                  >
                    {allUnifiedTips
                      .filter((tip) => {
                        if (brokenTipIds.has(tip.id) || brokenTipIds.has(tip.url)) return false;
                        if (tipSearchQuery.trim()) {
                          const q = tipSearchQuery.toLowerCase();
                          return tip.name.toLowerCase().includes(q) || (tip.badge && tip.badge.toLowerCase().includes(q));
                        }
                        return true;
                      })
                      .map((tip) => {
                        const isSelected = draft.dualBrush?.shapeTextureUrl === tip.url;
                        return (
                          <button
                            key={`dual_${tip.source}_${tip.id}`}
                            onClick={() => {
                              preloadKritaTexture(tip.url);
                              setDraft((d) => ({
                                ...d,
                                dualBrush: {
                                  ...(d.dualBrush || { enabled: true, texture: 'charcoal', blendMode: 'multiply', sizeRatio: 1.0, spacing: 0.25, scatter: 0, intensity: 0.8, rotation: 0 }),
                                  shapeTextureUrl: tip.url,
                                  stampShape: tip.name as any,
                                },
                              }));
                            }}
                            title={`${tip.name} (${tip.badge || 'Tip'}${tip.width ? ` • ${tip.width}×${tip.height}` : ''})`}
                            className={`group relative flex flex-col items-center justify-center p-1 rounded-lg border cursor-pointer transition aspect-square overflow-hidden ${
                              isSelected
                                ? 'border-2 border-[#5fd3ad] bg-[#164435]/70 ring-2 ring-[#5fd3ad]/50 shadow-lg scale-95'
                                : 'border-[#2c3532] bg-[#0c100e] hover:border-[#b89058] hover:bg-[#141a18]'
                            }`}
                          >
                            <img
                              src={tip.url}
                              alt={tip.name}
                              loading="lazy"
                              onError={() => setBrokenTipIds((prev) => new Set(prev).add(tip.id))}
                              className="w-full h-full object-contain filter drop-shadow-sm"
                            />
                            {tip.source === 'local_tip' && (
                              <span title="Local Tip" className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-[#5fd3ad] shadow-[0_0_4px_rgba(95,211,173,0.8)] pointer-events-none" />
                            )}
                            {tip.source === 'local_texture' && (
                              <span title="Local Texture" className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-[#e6c699] shadow-[0_0_4px_rgba(230,198,153,0.8)] pointer-events-none" />
                            )}
                            {isSelected && (
                              <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#5fd3ad] shadow-[0_0_6px_rgba(95,211,173,0.9)]" />
                            )}
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}

            {/* SUBNODE 2: SECONDARY BLENDING MODE */}
            {activeNode === 'dual_blending' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#2c3532] pb-2">
                  <span className="text-sm font-mayan font-bold text-[#5fd3ad] uppercase tracking-wide">
                    Secondary Tip Blending Mode
                  </span>
                  <span className="text-xs font-mono text-[#5fd3ad] bg-[#164435] px-2.5 py-1 rounded-lg border border-[#5fd3ad]/30">
                    Active: {draft.dualBrush?.blendMode || 'multiply'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'multiply', label: 'Multiply (Darken)', desc: 'Darkens and stains secondary texture into the primary stroke body' },
                    { id: 'mask', label: 'Mask (Stencil)', desc: 'Clips primary dab pixels directly to secondary tip silhouette' },
                    { id: 'subtract', label: 'Subtract (Carve)', desc: 'Erodes and cuts the secondary tip shape out of primary dab' },
                    { id: 'overlay', label: 'Overlay (Contrast)', desc: 'Applies rich contrast dual lighting texture' },
                    { id: 'darken', label: 'Darken (Minimum)', desc: 'Takes the minimum luminance between primary and secondary dabs' },
                  ].map((m) => {
                    const isSel = (draft.dualBrush?.blendMode || 'multiply') === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setDraft((d) => ({
                            ...d,
                            dualBrush: {
                              ...(d.dualBrush || { enabled: true, texture: 'charcoal', sizeRatio: 1.0, spacing: 0.25, scatter: 0, intensity: 0.8, rotation: 0 }),
                              blendMode: m.id as any,
                            },
                          }));
                        }}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                          isSel
                            ? 'bg-[#164435] border-[#5fd3ad] text-[#f2fbf7] ring-1 ring-[#5fd3ad]/50 shadow-md'
                            : 'bg-[#0e1311] border-[#2c3532] text-[#e6c699]/70 hover:border-[#b89058] hover:text-[#f2fbf7]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">{m.label}</span>
                          {isSel && <div className="w-2 h-2 rounded-full bg-[#5fd3ad]" />}
                        </div>
                        <span className="text-[10px] text-[#9e9484] leading-relaxed">{m.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SUBNODE 3: SECONDARY OPACITY */}
            {activeNode === 'dual_opacity' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#2c3532] pb-2">
                  <span className="text-sm font-mayan font-bold text-[#5fd3ad] uppercase tracking-wide">
                    Secondary Tip Opacity
                  </span>
                  <span className="text-xs font-mono text-[#5fd3ad]">
                    {Math.round((draft.dualBrush?.opacity ?? 1.0) * 100)}%
                  </span>
                </div>

                <div className="bg-[#0e1311] p-3 rounded-xl border border-[#2c3532] space-y-3">
                  <div className="flex justify-between text-xs text-[#e6c699]">
                    <span>Base Opacity</span>
                    <span className="font-mono text-[#5fd3ad]">{Math.round((draft.dualBrush?.opacity ?? 1.0) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    value={Math.round((draft.dualBrush?.opacity ?? 1.0) * 100)}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) / 100;
                      setDraft((d) => ({
                        ...d,
                        dualBrush: { ...(d.dualBrush || { enabled: true, texture: 'charcoal', blendMode: 'multiply', sizeRatio: 1.0, spacing: 0.25, scatter: 0, intensity: 0.8, rotation: 0 }), opacity: val },
                      }));
                    }}
                    className="w-full mayan-range-slider cursor-pointer"
                  />
                  <div className="flex gap-2">
                    {[25, 50, 75, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setDraft((d) => ({
                            ...d,
                            dualBrush: { ...(d.dualBrush || { enabled: true, texture: 'charcoal', blendMode: 'multiply', sizeRatio: 1.0, spacing: 0.25, scatter: 0, intensity: 0.8, rotation: 0 }), opacity: preset / 100 },
                          }));
                        }}
                        className="flex-1 py-1 text-xs mayan-btn-stone rounded-lg cursor-pointer font-mono"
                      >
                        {preset}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SUBNODE 4: SECONDARY FLOW */}
            {activeNode === 'dual_flow' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#2c3532] pb-2">
                  <span className="text-sm font-mayan font-bold text-[#5fd3ad] uppercase tracking-wide">
                    Secondary Tip Flow
                  </span>
                  <span className="text-xs font-mono text-[#5fd3ad]">
                    {Math.round((draft.dualBrush?.flow ?? 1.0) * 100)}%
                  </span>
                </div>

                <div className="bg-[#0e1311] p-3 rounded-xl border border-[#2c3532] space-y-3">
                  <div className="flex justify-between text-xs text-[#e6c699]">
                    <span>Deposit Rate (Flow)</span>
                    <span className="font-mono text-[#5fd3ad]">{Math.round((draft.dualBrush?.flow ?? 1.0) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    value={Math.round((draft.dualBrush?.flow ?? 1.0) * 100)}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) / 100;
                      setDraft((d) => ({
                        ...d,
                        dualBrush: { ...(d.dualBrush || { enabled: true, texture: 'charcoal', blendMode: 'multiply', sizeRatio: 1.0, spacing: 0.25, scatter: 0, intensity: 0.8, rotation: 0 }), flow: val },
                      }));
                    }}
                    className="w-full mayan-range-slider cursor-pointer"
                  />
                  <div className="flex gap-2">
                    {[15, 35, 70, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setDraft((d) => ({
                            ...d,
                            dualBrush: { ...(d.dualBrush || { enabled: true, texture: 'charcoal', blendMode: 'multiply', sizeRatio: 1.0, spacing: 0.25, scatter: 0, intensity: 0.8, rotation: 0 }), flow: preset / 100 },
                          }));
                        }}
                        className="flex-1 py-1 text-xs mayan-btn-stone rounded-lg cursor-pointer font-mono"
                      >
                        {preset}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SUBNODE 5: SECONDARY SIZE & RATIO */}
            {activeNode === 'dual_size' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#2c3532] pb-2">
                  <span className="text-sm font-mayan font-bold text-[#5fd3ad] uppercase tracking-wide">
                    Secondary Tip Size & Scale Ratio
                  </span>
                  <span className="text-xs font-mono text-[#5fd3ad]">
                    {Math.round((draft.dualBrush?.sizeRatio ?? 1.0) * 100)}%
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="bg-[#0e1311] p-3 rounded-xl border border-[#2c3532] space-y-2">
                    <div className="flex justify-between text-xs text-[#e6c699]">
                      <span>Size Ratio (Relative to Primary Brush)</span>
                      <span className="font-mono text-[#5fd3ad]">{Math.round((draft.dualBrush?.sizeRatio ?? 1.0) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="300"
                      value={Math.round((draft.dualBrush?.sizeRatio ?? 1.0) * 100)}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) / 100;
                        setDraft((d) => ({
                          ...d,
                          dualBrush: { ...(d.dualBrush || { enabled: true, texture: 'charcoal', blendMode: 'multiply', spacing: 0.25, scatter: 0, intensity: 0.8, rotation: 0 }), sizeRatio: val },
                        }));
                      }}
                      className="w-full mayan-range-slider cursor-pointer"
                    />
                    <div className="flex gap-2">
                      {[50, 75, 100, 150, 200].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            setDraft((d) => ({
                              ...d,
                              dualBrush: { ...(d.dualBrush || { enabled: true, texture: 'charcoal', blendMode: 'multiply', spacing: 0.25, scatter: 0, intensity: 0.8, rotation: 0 }), sizeRatio: preset / 100 },
                            }));
                          }}
                          className="flex-1 py-1 text-xs mayan-btn-stone rounded-lg cursor-pointer font-mono"
                        >
                          {preset}%
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#0e1311] p-3 rounded-xl border border-[#2c3532] space-y-2">
                    <div className="flex justify-between text-xs text-[#e6c699]">
                      <span>Explicit Pixel Diameter (Optional)</span>
                      <span className="font-mono text-[#5fd3ad]">{draft.dualBrush?.size ? `${draft.dualBrush.size} px` : 'Auto (Inherit)'}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="250"
                      value={draft.dualBrush?.size ?? 0}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setDraft((d) => ({
                          ...d,
                          dualBrush: { ...(d.dualBrush || { enabled: true, texture: 'charcoal', blendMode: 'multiply', sizeRatio: 1.0, spacing: 0.25, scatter: 0, intensity: 0.8, rotation: 0 }), size: val > 0 ? val : undefined },
                        }));
                      }}
                      className="w-full mayan-range-slider cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SUBNODE 6: SECONDARY RATIO & ASPECT */}
            {activeNode === 'dual_ratio' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#2c3532] pb-2">
                  <span className="text-sm font-mayan font-bold text-[#5fd3ad] uppercase tracking-wide">
                    Secondary Tip Ratio & Roundness
                  </span>
                  <span className="text-xs font-mono text-[#5fd3ad]">
                    {Math.round((draft.dualBrush?.roundness ?? 1.0) * 100)}%
                  </span>
                </div>

                <div className="bg-[#0e1311] p-3 rounded-xl border border-[#2c3532] space-y-3">
                  <div className="flex justify-between text-xs text-[#e6c699]">
                    <span>Aspect Ratio (Roundness)</span>
                    <span className="font-mono text-[#5fd3ad]">{Math.round((draft.dualBrush?.roundness ?? 1.0) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    value={Math.round((draft.dualBrush?.roundness ?? 1.0) * 100)}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) / 100;
                      setDraft((d) => ({
                        ...d,
                        dualBrush: { ...(d.dualBrush || { enabled: true, texture: 'charcoal', blendMode: 'multiply', sizeRatio: 1.0, spacing: 0.25, scatter: 0, intensity: 0.8, rotation: 0 }), roundness: val },
                      }));
                    }}
                    className="w-full mayan-range-slider cursor-pointer"
                  />

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#2c3532]">
                    <label className="flex items-center gap-2 text-xs text-[#e6c699] cursor-pointer bg-[#141817] p-2 rounded-lg border border-[#2c3532]">
                      <input
                        type="checkbox"
                        checked={Boolean(draft.dualBrush?.flipX)}
                        onChange={(e) => {
                          setDraft((d) => ({
                            ...d,
                            dualBrush: { ...(d.dualBrush || { enabled: true, texture: 'charcoal', blendMode: 'multiply', sizeRatio: 1.0, spacing: 0.25, scatter: 0, intensity: 0.8, rotation: 0 }), flipX: e.target.checked },
                          }));
                        }}
                        className="accent-[#5fd3ad]"
                      />
                      <span>Flip Horizontal</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-[#e6c699] cursor-pointer bg-[#141817] p-2 rounded-lg border border-[#2c3532]">
                      <input
                        type="checkbox"
                        checked={Boolean(draft.dualBrush?.flipY)}
                        onChange={(e) => {
                          setDraft((d) => ({
                            ...d,
                            dualBrush: { ...(d.dualBrush || { enabled: true, texture: 'charcoal', blendMode: 'multiply', sizeRatio: 1.0, spacing: 0.25, scatter: 0, intensity: 0.8, rotation: 0 }), flipY: e.target.checked },
                          }));
                        }}
                        className="accent-[#5fd3ad]"
                      />
                      <span>Flip Vertical</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* SUBNODE 7: SECONDARY SPACING */}
            {activeNode === 'dual_spacing' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#2c3532] pb-2">
                  <span className="text-sm font-mayan font-bold text-[#5fd3ad] uppercase tracking-wide">
                    Secondary Tip Dab Spacing
                  </span>
                  <span className="text-xs font-mono text-[#5fd3ad]">
                    {Math.round((draft.dualBrush?.spacing ?? 0.25) * 100)}%
                  </span>
                </div>

                <div className="bg-[#0e1311] p-3 rounded-xl border border-[#2c3532] space-y-3">
                  <div className="flex justify-between text-xs text-[#e6c699]">
                    <span>Dab Spacing (Fraction of Radius)</span>
                    <span className="font-mono text-[#5fd3ad]">{Math.round((draft.dualBrush?.spacing ?? 0.25) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="150"
                    value={Math.round((draft.dualBrush?.spacing ?? 0.25) * 100)}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) / 100;
                      setDraft((d) => ({
                        ...d,
                        dualBrush: { ...(d.dualBrush || { enabled: true, texture: 'charcoal', blendMode: 'multiply', sizeRatio: 1.0, scatter: 0, intensity: 0.8, rotation: 0 }), spacing: val },
                      }));
                    }}
                    className="w-full mayan-range-slider cursor-pointer"
                  />
                  <div className="flex gap-2">
                    {[10, 25, 50, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setDraft((d) => ({
                            ...d,
                            dualBrush: { ...(d.dualBrush || { enabled: true, texture: 'charcoal', blendMode: 'multiply', sizeRatio: 1.0, scatter: 0, intensity: 0.8, rotation: 0 }), spacing: preset / 100 },
                          }));
                        }}
                        className="flex-1 py-1 text-xs mayan-btn-stone rounded-lg cursor-pointer font-mono"
                      >
                        {preset}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SUBNODE 8: SECONDARY ROTATION */}
            {activeNode === 'dual_rotation' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#2c3532] pb-2">
                  <span className="text-sm font-mayan font-bold text-[#5fd3ad] uppercase tracking-wide">
                    Secondary Tip Rotation & Direction
                  </span>
                  <span className="text-xs font-mono text-[#5fd3ad]">
                    {Math.round(draft.dualBrush?.rotation ?? 0)}°
                  </span>
                </div>

                <div className="bg-[#0e1311] p-3 rounded-xl border border-[#2c3532] space-y-3">
                  <div className="flex justify-between text-xs text-[#e6c699]">
                    <span>Fixed Angle</span>
                    <span className="font-mono text-[#5fd3ad]">{Math.round(draft.dualBrush?.rotation ?? 0)}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={Math.round(draft.dualBrush?.rotation ?? 0)}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setDraft((d) => ({
                        ...d,
                        dualBrush: { ...(d.dualBrush || { enabled: true, texture: 'charcoal', blendMode: 'multiply', sizeRatio: 1.0, spacing: 0.25, scatter: 0, intensity: 0.8 }), rotation: val },
                      }));
                    }}
                    className="w-full mayan-range-slider cursor-pointer"
                  />

                  <label className="flex items-center gap-2 text-xs text-[#e6c699] cursor-pointer bg-[#141817] p-2.5 rounded-lg border border-[#2c3532] mt-2">
                    <input
                      type="checkbox"
                      checked={Boolean(draft.dualBrush?.followStroke)}
                      onChange={(e) => {
                        setDraft((d) => ({
                          ...d,
                          dualBrush: { ...(d.dualBrush || { enabled: true, texture: 'charcoal', blendMode: 'multiply', sizeRatio: 1.0, spacing: 0.25, scatter: 0, intensity: 0.8, rotation: 0 }), followStroke: e.target.checked },
                        }));
                      }}
                      className="accent-[#5fd3ad]"
                    />
                    <span>Follow Stroke Direction (Dynamic Tangent Orientation)</span>
                  </label>
                </div>
              </div>
            )}

            {/* SUBNODE 9: SECONDARY SCATTER */}
            {activeNode === 'dual_scatter' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#2c3532] pb-2">
                  <span className="text-sm font-mayan font-bold text-[#5fd3ad] uppercase tracking-wide">
                    Secondary Tip Scatter & Jitter
                  </span>
                  <span className="text-xs font-mono text-[#5fd3ad]">
                    {Math.round(draft.dualBrush?.scatter ?? 0)}%
                  </span>
                </div>

                <div className="bg-[#0e1311] p-3 rounded-xl border border-[#2c3532] space-y-3">
                  <div className="flex justify-between text-xs text-[#e6c699]">
                    <span>Scatter Radius Fraction</span>
                    <span className="font-mono text-[#5fd3ad]">{Math.round(draft.dualBrush?.scatter ?? 0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(draft.dualBrush?.scatter ?? 0)}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setDraft((d) => ({
                        ...d,
                        dualBrush: { ...(d.dualBrush || { enabled: true, texture: 'charcoal', blendMode: 'multiply', sizeRatio: 1.0, spacing: 0.25, intensity: 0.8, rotation: 0 }), scatter: val },
                      }));
                    }}
                    className="w-full mayan-range-slider cursor-pointer"
                  />
                  <div className="flex gap-2">
                    {[0, 15, 35, 75].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setDraft((d) => ({
                            ...d,
                            dualBrush: { ...(d.dualBrush || { enabled: true, texture: 'charcoal', blendMode: 'multiply', sizeRatio: 1.0, spacing: 0.25, intensity: 0.8, rotation: 0 }), scatter: preset },
                          }));
                        }}
                        className="flex-1 py-1 text-xs mayan-btn-stone rounded-lg cursor-pointer font-mono"
                      >
                        {preset}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeNode === 'blending_mode' && (
              <div className="flex flex-col h-full space-y-3">
                {/* Top bar: Selected: [ Mode ] and Eraser Checkbox */}
                <div className="flex items-center justify-between pb-2 border-b border-[#2c3532] gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#9e9484] font-medium">Selected:</span>
                    <button
                      type="button"
                      className="px-3 py-1 bg-[#141a18] border border-[#2c3532] rounded text-xs text-[#5fd3ad] font-bold font-mono min-w-32 text-left"
                    >
                      {BLEND_MODE_LABELS[draft.blendMode as KritaBlendMode] || draft.blendMode || 'Normal'}
                    </button>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-[#e6c699] font-medium cursor-pointer px-2.5 py-1 rounded bg-[#141a18] border border-[#2c3532] hover:border-[#5fd3ad]">
                    <input
                      type="checkbox"
                      checked={draft.blendMode === 'erase' || draft.blendMode === 'destination-out'}
                      onChange={(e) => {
                        if (e.target.checked) {
                          if (draft.blendMode !== 'erase' && draft.blendMode !== 'destination-out') {
                            setLastNonEraserMode(draft.blendMode || 'source-over');
                          }
                          updateField('blendMode', 'erase');
                        } else {
                          updateField('blendMode', lastNonEraserMode || 'source-over');
                        }
                      }}
                      className="accent-[#5fd3ad] cursor-pointer"
                    />
                    <span className="flex items-center gap-1.5">
                      <Eraser size={13} className="text-[#b89058]" />
                      Eraser
                    </span>
                  </label>
                </div>

                {/* Subheading and Search Bar */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-mayan font-bold uppercase tracking-wider text-[#b89058]">
                    Available Blending Modes
                  </span>
                  <div className="relative w-48">
                    <Search size={12} className="absolute left-2.5 top-2 text-[#9e9484]" />
                    <input
                      type="text"
                      placeholder="Search modes..."
                      value={blendSearchQuery}
                      onChange={(e) => setBlendSearchQuery(e.target.value)}
                      className="w-full pl-7 pr-2.5 py-1 bg-[#141a18] border border-[#2c3532] rounded text-xs text-[#e6c699] outline-none focus:border-[#5fd3ad]"
                    />
                  </div>
                </div>

                {/* Categories Tree View matching Krita image_ca626ad7.png */}
                <div className="flex-1 overflow-y-auto pr-1 border border-[#2c3532] rounded-xl bg-[#090c0b] p-2 space-y-1.5 max-h-[460px]">
                  {CATEGORY_ORDER.map((catKey) => {
                    const catLabel = CATEGORY_LABELS[catKey];
                    const items = catKey === 'favorites'
                      ? blendModeFavorites.map((favId) => ({
                          id: favId,
                          name: BLEND_MODE_LABELS[favId] || favId,
                          category: 'favorites' as BlendModeCategory,
                        }))
                      : KRITA_BLEND_MODE_GROUPS[catKey] || [];

                    const filteredItems = items.filter((item) =>
                      !blendSearchQuery ||
                      item.name.toLowerCase().includes(blendSearchQuery.toLowerCase()) ||
                      item.id.toLowerCase().includes(blendSearchQuery.toLowerCase())
                    );

                    if (blendSearchQuery && filteredItems.length === 0) return null;

                    const isExpanded = blendSearchQuery ? true : Boolean(expandedCategories[catKey]);

                    return (
                      <div key={catKey} className="border border-[#1f2624] rounded-lg overflow-hidden bg-[#0e1211]">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedCategories((prev) => ({
                              ...prev,
                              [catKey]: !prev[catKey],
                            }))
                          }
                          className="w-full flex items-center justify-between px-2.5 py-1.5 bg-[#141a18] hover:bg-[#1a221f] text-xs font-semibold text-[#e6c699] cursor-pointer transition"
                        >
                          <span className="flex items-center gap-2">
                            {isExpanded ? <ChevronDown size={14} className="text-[#5fd3ad]" /> : <ChevronRight size={14} className="text-[#9e9484]" />}
                            <span className="font-mayan tracking-wide">{catLabel}</span>
                          </span>
                          <span className="text-[10px] text-[#9e9484] font-mono">
                            ({filteredItems.length})
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="p-1 space-y-0.5 border-t border-[#1f2624]">
                            {filteredItems.length === 0 ? (
                              <div className="text-[11px] text-[#9e9484] italic px-3 py-1.5">
                                {catKey === 'favorites' ? 'No favorites selected. Check any mode to add it here.' : 'No modes match filter.'}
                              </div>
                            ) : (
                              filteredItems.map((item) => {
                                const isCurrent = draft.blendMode === item.id;
                                const isFav = blendModeFavorites.includes(item.id);

                                return (
                                  <div
                                    key={item.id}
                                    className={`flex items-center justify-between px-2 py-1 rounded transition text-xs ${
                                      isCurrent
                                        ? 'bg-[#164435] text-[#5fd3ad] font-bold border border-[#5fd3ad]/40 shadow-sm'
                                        : 'hover:bg-white/5 text-[#e6c699]/85'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      {/* Checkbox indicates / toggles membership in Favorites */}
                                      <input
                                        type="checkbox"
                                        checked={isFav}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          toggleFavoriteBlendMode(item.id);
                                        }}
                                        title={isFav ? 'Remove from Favorites' : 'Add to Favorites'}
                                        className="rounded accent-[#5fd3ad] cursor-pointer shrink-0"
                                      />
                                      {/* Clicking name selects the blend mode */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setLastNonEraserMode(item.id);
                                          updateField('blendMode', item.id);
                                        }}
                                        className="text-left truncate flex-1 cursor-pointer"
                                      >
                                        {item.name}
                                      </button>
                                    </div>
                                    {isCurrent && (
                                      <Check size={12} className="text-[#5fd3ad] shrink-0 ml-2" />
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeNode === 'spacing' && (
              <div className="space-y-4">
                <h3 className="text-sm font-mayan font-bold uppercase tracking-wider text-[#5fd3ad]">
                  Dab Spacing & StreamLine
                </h3>
                <KritaBarSlider
                  label="Spacing"
                  value={draft.spacing}
                  min={0.01}
                  max={1.0}
                  step={0.01}
                  onChange={(v) => updateField('spacing', v)}
                />
                <KritaBarSlider
                  label="StreamLine Stabilizer"
                  value={draft.streamline}
                  min={0}
                  max={0.95}
                  step={0.01}
                  onChange={(v) => updateField('streamline', v)}
                />
              </div>
            )}

            {activeNode === 'mirror' && (
              <div className="space-y-4">
                <h3 className="text-sm font-mayan font-bold uppercase tracking-wider text-[#5fd3ad]">
                  Mirror Dab
                </h3>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.flipX}
                    onChange={(e) => updateField('flipX', e.target.checked)}
                    className="accent-[#5fd3ad]"
                  />
                  <span>Horizontal Mirror Flip</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.flipY}
                    onChange={(e) => updateField('flipY', e.target.checked)}
                    className="accent-[#5fd3ad]"
                  />
                  <span>Vertical Mirror Flip</span>
                </label>
              </div>
            )}

            {(activeNode === 'color_source' ||
              activeNode === 'darken' ||
              activeNode === 'mix' ||
              activeNode === 'hue' ||
              activeNode === 'saturation' ||
              activeNode === 'value') && (
              <div className="space-y-4">
                <h3 className="text-sm font-mayan font-bold uppercase tracking-wider text-[#5fd3ad]">
                  Color & Wet Smudge Dynamics
                </h3>
                <KritaBarSlider
                  label="Darken (Pressure Darkening)"
                  value={draft.darkenAmount ?? 0}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => updateField('darkenAmount', v)}
                />
                <KritaBarSlider
                  label="Mix / Smudge Rate (ColorSmudge Pull)"
                  value={draft.smudgePull}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => updateField('smudgePull', v)}
                />
                <KritaBarSlider
                  label="Paint Dilution (Glaze Translucency)"
                  value={draft.wetMixDilution}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => updateField('wetMixDilution', v)}
                />
                <KritaBarSlider
                  label="Hue Dynamics"
                  value={draft.hueJitter}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => updateField('hueJitter', v)}
                />
                <KritaBarSlider
                  label="Saturation Dynamics"
                  value={draft.saturationJitter}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => updateField('saturationJitter', v)}
                />
                <KritaBarSlider
                  label="Value / Brightness Dynamics"
                  value={draft.brightnessJitter}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => updateField('brightnessJitter', v)}
                />
              </div>
            )}

            {(activeNode === 'pattern' || activeNode === 'pattern_strength') && (
              <div className="space-y-3.5 flex flex-col h-full">
                {/* Sub-Tabs: Texture vs Options (as in Krita's Texture panel) */}
                <div className="flex items-center justify-between border-b border-[#2c3532] pb-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setTextureSubTab('texture')}
                      className={`px-3 py-1 rounded-t-lg text-xs font-bold transition cursor-pointer ${
                        textureSubTab === 'texture'
                          ? 'bg-[#164435] text-[#5fd3ad] border-t-2 border-[#5fd3ad]'
                          : 'bg-[#141a18] text-[#9e9484] hover:text-[#e6c699]'
                      }`}
                    >
                      Texture
                    </button>
                    <button
                      onClick={() => setTextureSubTab('options')}
                      className={`px-3 py-1 rounded-t-lg text-xs font-bold transition cursor-pointer ${
                        textureSubTab === 'options'
                          ? 'bg-[#164435] text-[#5fd3ad] border-t-2 border-[#5fd3ad]'
                          : 'bg-[#141a18] text-[#9e9484] hover:text-[#e6c699]'
                      }`}
                    >
                      Options
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer text-[#e6c699]/90">
                      <input
                        type="checkbox"
                        checked={draft.grainDepth > 0}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          updateField('grainDepth', enabled ? 0.6 : 0);
                          updateField('patternEnabled', enabled);
                        }}
                        className="rounded accent-[#5fd3ad] cursor-pointer"
                      />
                      <span>Enable Texture</span>
                    </label>
                  </div>
                </div>

                {textureSubTab === 'texture' ? (
                  <div className="flex flex-col gap-2.5 flex-1 min-h-0">
                    {/* Active Texture Name & Dimensions Header */}
                    <div className="px-3 py-1.5 rounded-lg bg-[#0e1312] border border-[#2c3532] flex items-center justify-between text-xs">
                      <span className="font-semibold text-white/95 truncate">
                        {(() => {
                          const cur = patternsList.find((p) => p.id === (draft.kritaPatternId || 'none'));
                          if (!cur || cur.id === 'none') return '00_No_Pattern (Solid)';
                          return `${cur.name} ${cur.dim ? `(${cur.dim})` : ''}`;
                        })()}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#164435] text-[#5fd3ad] font-mono">
                        {patternsList.length - 1} Seamless Textures
                      </span>
                    </div>

                    {/* DEDICATED PATTERN INTENSITY & ALIGNMENT CONTROLS (KRITA STANDARD) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-2.5 rounded-xl bg-[#0e1312] border border-[#2c3532]">
                      {/* Strength / Intensity Slider */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#e6c699]">Pattern Strength / Intensity</span>
                          <span className="font-mono text-xs font-bold text-[#5fd3ad]">
                            {Math.round((draft.patternStrength ?? draft.grainDepth ?? 0.6) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={Math.round((draft.patternStrength ?? draft.grainDepth ?? 0.6) * 100)}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) / 100;
                            updateField('patternStrength', val);
                            updateField('grainDepth', val);
                          }}
                          className="w-full h-1.5 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                        />
                        <div className="flex items-center justify-between text-[10px] text-[#9e9484]">
                          <span>Subtle (0%)</span>
                          <span>Maximum Relief (100%)</span>
                        </div>
                      </div>

                      {/* Alignment & Scale Quick Controls */}
                      <div className="space-y-1 flex flex-col justify-between">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#e6c699]">Alignment & Scale</span>
                          <span className="font-mono text-xs text-[#5fd3ad]">
                            {((draft.patternScale ?? draft.grainScale ?? 1.0) * 100).toFixed(0)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="3.0"
                          step="0.05"
                          value={draft.patternScale ?? draft.grainScale ?? 1.0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            updateField('patternScale', val);
                            updateField('grainScale', val);
                          }}
                          className="w-full h-1.5 bg-white/10 accent-[#b89058] rounded cursor-pointer"
                        />
                        <div className="flex items-center justify-between text-[10px]">
                          <label className="flex items-center gap-1.5 text-[#e6c699] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(draft.patternInvert)}
                              onChange={(e) => updateField('patternInvert', e.target.checked)}
                              className="accent-[#5fd3ad] rounded"
                            />
                            <span>Invert</span>
                          </label>
                          <label className="flex items-center gap-1.5 text-[#e6c699] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(draft.patternStrengthPressure)}
                              onChange={(e) => updateField('patternStrengthPressure', e.target.checked)}
                              className="accent-[#5fd3ad] rounded"
                            />
                            <span>Stylus Pressure</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Tag Filter Tabs & Search Bar */}
                    <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px]">
                        {[
                          'All',
                          'Paper & Canvas',
                          'Surface & Relief',
                          'Lines & Screentones',
                          'Organic',
                          'Custom',
                        ].map((tag) => (
                          <button
                            key={tag}
                            onClick={() => setTextureTagFilter(tag)}
                            className={`px-2 py-0.5 rounded font-medium whitespace-nowrap cursor-pointer transition ${
                              textureTagFilter === tag
                                ? 'bg-[#5fd3ad] text-black font-bold'
                                : 'bg-[#141a18] text-[#9e9484] hover:text-[#e6c699] border border-[#2c3532]'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>

                      <div className="relative w-36 shrink-0">
                        <Search
                          size={11}
                          className="absolute left-2 top-1/2 -translate-y-1/2 text-white/40"
                        />
                        <input
                          type="text"
                          placeholder="Search..."
                          value={textureSearchQuery}
                          onChange={(e) => setTextureSearchQuery(e.target.value)}
                          className="w-full bg-[#0a0d0c] text-white text-[11px] pl-6 pr-2 py-1 rounded border border-[#2c3532] focus:outline-none focus:border-[#5fd3ad]"
                        />
                      </div>
                    </div>

                    {/* Two-Column Area: Left Pattern Grid + Right Vertical Seamless Preview */}
                    <div className="flex gap-2.5 flex-1 min-h-0">
                      {/* Left: Dense Pattern Thumbnail Grid */}
                      <div className="flex-1 overflow-y-auto max-h-[310px] p-2 mayan-well rounded-xl border border-[#2c3532] grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 gap-1.5">
                        {patternsList
                          .filter((pat) => {
                            if (textureTagFilter !== 'All') {
                              if (textureTagFilter === 'Custom') {
                                if (!pat.isCustom) return false;
                              } else if (pat.tag !== textureTagFilter) {
                                return false;
                              }
                            }
                            if (textureSearchQuery.trim()) {
                              return pat.name
                                .toLowerCase()
                                .includes(textureSearchQuery.toLowerCase());
                            }
                            return true;
                          })
                          .map((pat) => {
                            const isSelected =
                              (draft.kritaPatternId || 'none') === pat.id &&
                              (pat.id === 'none'
                                ? draft.grainDepth === 0
                                : draft.grainDepth > 0);
                            const previewUrl = patternPreviewUrls[pat.id];

                            return (
                              <button
                                key={pat.id}
                                onClick={() => {
                                  updateField('kritaPatternId', pat.id);
                                  updateField('grainTextureUrl', undefined);
                                  if (pat.id === 'none') {
                                    updateField('grainDepth', 0);
                                  } else if (draft.grainDepth <= 0.05) {
                                    updateField('grainDepth', 0.6);
                                  }
                                }}
                                title={`${pat.name} ${pat.dim ? `(${pat.dim})` : ''}`}
                                className={`relative flex flex-col items-center justify-center p-1 rounded-lg border cursor-pointer transition aspect-square overflow-hidden ${
                                  isSelected
                                    ? 'border-2 border-[#5fd3ad] bg-[#164435]/60 ring-2 ring-[#5fd3ad]/40 shadow-lg'
                                    : 'border-[#2c3532] bg-[#101413] hover:border-[#b89058]'
                                }`}
                              >
                                {pat.id === 'none' ? (
                                  <span className="text-[9px] font-bold text-[#9e9484]">
                                    SOLID
                                  </span>
                                ) : previewUrl ? (
                                  <img
                                    src={previewUrl}
                                    alt={pat.name}
                                    className="w-full h-full object-cover rounded"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-[#1b2220] flex items-center justify-center">
                                    <span className="text-[8px] text-white/40">...</span>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                      </div>

                      {/* Right: Vertical Seamless Repeating Preview (as in Krita UI) */}
                      <div className="w-28 shrink-0 flex flex-col gap-1 items-center p-2 rounded-xl bg-[#0b0e0d] border border-[#2c3532]">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#9e9484] text-center">
                          Tiling Preview
                        </span>
                        <div className="w-full h-[270px] rounded-lg overflow-hidden border border-[#2c3532]/80 bg-black flex items-center justify-center">
                          <canvas
                            ref={textureTilingCanvasRef}
                            width={112}
                            height={270}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Controls: Import, Delete, Strength Quick Bar */}
                    <div className="flex items-center justify-between pt-1 border-t border-[#2c3532] text-xs">
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 px-2.5 py-1 mayan-btn-jade rounded-lg text-xs font-semibold cursor-pointer">
                          <Upload size={12} />
                          <span>+ Upload Pattern</span>
                          <input
                            type="file"
                            accept="image/*,.pat"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  const dataUrl = ev.target?.result as string;
                                  if (dataUrl) {
                                    const newPat = registerCustomKritaPattern(
                                      file.name.replace(/\.[^/.]+$/, ''),
                                      dataUrl
                                    );
                                    refreshPatternPreviews();
                                    updateField('kritaPatternId', newPat.id);
                                    updateField('grainTextureUrl', undefined);
                                    updateField(
                                      'grainDepth',
                                      Math.max(0.6, draft.grainDepth)
                                    );
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="hidden"
                          />
                        </label>

                        {(() => {
                          const cur = patternsList.find(
                            (p) => p.id === draft.kritaPatternId
                          );
                          if (!cur?.isCustom) return null;
                          return (
                            <button
                              onClick={() => {
                                if (cur?.id) {
                                  deleteCustomKritaPattern(cur.id);
                                  refreshPatternPreviews();
                                  updateField('kritaPatternId', '01_canvas');
                                }
                              }}
                              className="flex items-center gap-1 px-2 py-1 rounded bg-red-900/30 text-red-300 border border-red-800/40 text-[11px] cursor-pointer hover:bg-red-900/50"
                              title="Delete this custom pattern"
                            >
                              <Trash2 size={11} />
                              <span>Delete</span>
                            </button>
                          );
                        })()}
                      </div>

                      <div className="text-[11px] text-[#9e9484]">
                        Switch to <button onClick={() => setTextureSubTab('options')} className="text-[#5fd3ad] underline font-bold cursor-pointer">Options tab</button> for scale, depth, & texturing mode.
                      </div>
                    </div>
                  </div>
                ) : (
                  /* OPTIONS TAB: Comprehensive Texture Engine Controls */
                  <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-[#0e1312] border border-[#2c3532]">
                      {/* Texturing Mode: Multiply vs Subtract */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-[#e6c699]">
                          Texturing Mode
                        </label>
                        <select
                          value={draft.patternTexturingMode || 'multiply'}
                          onChange={(e) =>
                            updateField(
                              'patternTexturingMode',
                              e.target.value as 'multiply' | 'subtract'
                            )
                          }
                          className="w-full bg-[#141a18] text-[#5fd3ad] text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#2c3532] focus:outline-none focus:border-[#5fd3ad] cursor-pointer"
                        >
                          <option value="multiply">Multiply (Classic Grain Build-up)</option>
                          <option value="subtract">Subtract (Airbrush Grain Carve)</option>
                        </select>
                        <p className="text-[10px] text-white/50 leading-tight">
                          Multiply scales alpha by pattern lightness; Subtract carves negative texture ridges out of the stroke.
                        </p>
                      </div>

                      {/* Invert Texture Toggle */}
                      <div className="space-y-1 flex flex-col justify-center">
                        <label className="flex items-center gap-2 text-xs font-semibold text-[#e6c699] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(draft.patternInvert)}
                            onChange={(e) =>
                              updateField('patternInvert', e.target.checked)
                            }
                            className="rounded accent-[#5fd3ad] cursor-pointer"
                          />
                          <span>Invert Texture (Flips High & Low Ridges)</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs font-semibold text-[#e6c699] cursor-pointer mt-2">
                          <input
                            type="checkbox"
                            checked={Boolean(draft.patternStrengthPressure)}
                            onChange={(e) =>
                              updateField(
                                'patternStrengthPressure',
                                e.target.checked
                              )
                            }
                            className="rounded accent-[#5fd3ad] cursor-pointer"
                          />
                          <span>Strength by Stylus Pressure</span>
                        </label>
                      </div>
                    </div>

                    {/* Scale Slider with 1.0x Reset Button */}
                    <div className="p-3 rounded-xl bg-[#0e1312] border border-[#2c3532] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#e6c699]">
                          Texture Scale
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono text-[#5fd3ad]">
                            {((draft.patternScale ?? draft.grainScale ?? 1.0) * 100).toFixed(0)}%
                          </span>
                          <button
                            onClick={() => {
                              updateField('patternScale', 1.0);
                              updateField('grainScale', 1.0);
                            }}
                            className="text-[10px] px-1.5 py-0.5 rounded mayan-btn-stone cursor-pointer"
                          >
                            Reset 1.0x
                          </button>
                        </div>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={5.0}
                        step={0.05}
                        value={draft.patternScale ?? draft.grainScale ?? 1.0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          updateField('patternScale', val);
                          updateField('grainScale', val);
                        }}
                        className="w-full accent-[#5fd3ad] cursor-pointer"
                      />
                    </div>

                    {/* Strength / Depth */}
                    <KritaBarSlider
                      label="Texture Strength / Depth"
                      value={Math.round((draft.patternStrength ?? draft.grainDepth ?? 0.6) * 100)}
                      min={0}
                      max={100}
                      step={1}
                      unit="%"
                      onChange={(v) => {
                        const val = v / 100;
                        updateField('patternStrength', val);
                        updateField('grainDepth', val);
                      }}
                    />

                    {/* Cutoff / Valley Floor Threshold */}
                    <KritaBarSlider
                      label="Cutoff / Valley Floor (Paper Cavities)"
                      value={Math.round((draft.patternCutoff ?? 0) * 100)}
                      min={0}
                      max={85}
                      step={1}
                      unit="%"
                      onChange={(v) => updateField('patternCutoff', v / 100)}
                    />

                    {/* Contrast & Brightness */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <KritaBarSlider
                        label="Texture Contrast"
                        value={Math.round((draft.patternContrast ?? 1.0) * 100)}
                        min={20}
                        max={300}
                        step={5}
                        unit="%"
                        onChange={(v) => updateField('patternContrast', v / 100)}
                      />
                      <KritaBarSlider
                        label="Texture Brightness"
                        value={Math.round((draft.patternBrightness ?? 0) * 100)}
                        min={-100}
                        max={100}
                        step={1}
                        unit="%"
                        onChange={(v) => updateField('patternBrightness', v / 100)}
                      />
                    </div>

                    {/* Offset X & Offset Y */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <KritaBarSlider
                        label="Offset X"
                        value={Math.round((draft.patternOffsetX ?? 0) * 100)}
                        min={0}
                        max={100}
                        step={1}
                        unit="%"
                        onChange={(v) => updateField('patternOffsetX', v / 100)}
                      />
                      <KritaBarSlider
                        label="Offset Y"
                        value={Math.round((draft.patternOffsetY ?? 0) * 100)}
                        min={0}
                        max={100}
                        step={1}
                        unit="%"
                        onChange={(v) => updateField('patternOffsetY', v / 100)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PANE 4: RIGHT KRITA SCRATCHPAD */}
          <div className="w-80 sm:w-88 bg-[#0b0e0d] border-l border-[#2c3532] p-3.5 flex flex-col justify-between shrink-0">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mayan font-bold uppercase tracking-wider text-[#b89058]">
                  Scratchpad
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      setScratchpadBg((b) => (b === 'light' ? 'dark' : 'light'))
                    }
                    className="px-2 py-0.5 rounded mayan-btn-stone text-[10px] cursor-pointer"
                  >
                    {scratchpadBg === 'light' ? '☀ Paper' : '☾ Dark'}
                  </button>
                  <button
                    onClick={seedDrawingPad}
                    className="flex items-center gap-1 px-2 py-0.5 rounded mayan-btn-stone text-[10px] cursor-pointer hover:text-white"
                    title="Reset with top color gradient bar"
                  >
                    <RotateCcw className="w-3 h-3" /> Swatch
                  </button>
                  <button
                    onClick={clearBlankPad}
                    className="flex items-center gap-1 px-2 py-0.5 rounded mayan-btn-terracotta text-[10px] cursor-pointer"
                    title="Wipe entire scratchpad clean"
                  >
                    <Trash2 className="w-3 h-3" /> Clear
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1 p-1 mayan-well rounded-xl border border-[#2c3532]">
                {(['paint', 'smudge', 'eraser'] as ToolMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setPreviewMode(m)}
                    className={`py-1 rounded-lg text-xs font-semibold capitalize transition cursor-pointer ${
                      previewMode === m ? 'mayan-btn-jade' : 'text-[#9e9484] hover:text-white'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-[#9e9484]">Stroke Color:</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={previewColor}
                    onChange={(e) => setPreviewColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="font-mono text-[11px] text-[#e6c699] uppercase">
                    {previewColor}
                  </span>
                </div>
              </div>
            </div>

            <div className="my-2.5 flex-1 rounded-xl border-2 border-[#2c3532] overflow-hidden relative shadow-inner">
              <canvas
                ref={padCanvasRef}
                width={320}
                height={440}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="w-full h-full cursor-crosshair touch-none"
              />
            </div>

            <p className="text-[10px] text-[#9e9484] text-center">
              Test your brush preset on the scratchpad above, then click{' '}
              <strong className="text-[#e6c699]">Save Brush Preset</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const KritaBarSlider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (val: number) => void;
}> = ({ label, value, min, max, step, unit = '', onChange }) => {
  const pct = Math.max(0, Math.min(100, ((value - min) / Math.max(0.0001, max - min)) * 100));
  return (
    <div className="space-y-1 select-none">
      <div className="relative h-7 rounded-lg bg-[#0b0e0d] border border-[#2c3532] overflow-hidden flex items-center justify-between px-3">
        <div
          className="absolute inset-y-0 left-0 bg-[#164435]/80 border-r border-[#5fd3ad]/60 pointer-events-none"
          style={{ width: `${pct}%` }}
        />
        <span className="relative z-10 text-xs font-medium text-[#f2fbf7]">
          {label}:
        </span>
        <span className="relative z-10 text-xs font-mono font-bold text-[#5fd3ad]">
          {step < 1 ? value.toFixed(2) : Math.round(value)}
          {unit}
        </span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
        />
      </div>
    </div>
  );
};