import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Layer,
  ToolType,
  Brush,
  DrawingGuideConfig,
  ArtworkProject,
  CanvasStrokeRecord,
  ActiveAdjustment,
  BlendMode,
  AnimationConfig,
  AdjustmentLayerConfig,
  BrushTexture,
  TransformMode,
  SmartFilter,
} from './types/canvas';
import { DEFAULT_BRUSHES, hydrateBrush, saveBrushFolders } from './constants/brushes';
import { fetchLocalBrushes, saveLocalBrush, deleteLocalBrush, syncAllToLocalContent } from './services/localContentService';
import { HeaderBar } from './components/HeaderBar';
import { SidebarControls } from './components/SidebarControls';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import { ColorStudio } from './components/ColorStudio';
import { LayersPanel } from './components/LayersPanel';
import { BrushLibrary } from './components/BrushLibrary';
import { BrushStudioModal } from './components/BrushStudioModal';
import { BrushTipGizmo } from './components/BrushTipGizmo';
import { universalToBrush } from './types/brush';
import { ActionsModal } from './components/ActionsModal';
import { Settings2 } from 'lucide-react';
import { DrawingGuideSettingsModal } from './components/DrawingGuideSettingsModal';
import { ShortcutsHelpModal } from './components/ShortcutsHelpModal';
import { TimeLapseModal } from './components/TimeLapseModal';
import { GalleryView } from './components/GalleryView';
import { AnimationAssistBar } from './components/AnimationAssistBar';
import { PageAssistBar } from './components/PageAssistBar';
import { VectorShapeConfig } from './types/shapes';
import { ShapeToolbar } from './components/ShapeToolbar';
import { renderVectorShape } from './utils/shapeRenderer';
import { LayerEffectsModal } from './components/LayerEffectsModal';
import {
  createDefaultLayerEffects,
  rasterizeLayerEffects,
  hasActiveEffects,
  renderLayerEffectsToCanvas,
} from './utils/layerEffectsEngine';
import { applyProcessedMask } from './utils/compositingEngine';
import { AdjustmentControlBar } from './components/AdjustmentControlBar';
import { DitherSuiteModal } from './components/DitherSuiteModal';
import { getCanvasCompositeOperation } from './utils/blendModes';
import { GradientEditorModal } from './components/GradientEditorModal';
import { GRADIENT_MAP_PRESETS, applyGradientMapToImageData } from './utils/canvasAdjustments';
import { renderFastAdjustmentLayer } from './utils/adjustments';
import { VectorPenToolbar, VectorToolSubMode } from './components/VectorPenToolbar';
import {
  exportAsPng,
  exportAsJpeg,
  exportAsTiff,
  exportAsPdf,
  exportAsPsd,
  exportAsProcreate,
  exportAsHbatz,
  importHbatzFile,
  renderFullArtworkCanvas,
  saveProjectToLocalContent,
  fetchLocalProjects,
  deleteLocalProject,
  buildHbatzZipBlob,
} from './utils/exportEngine';
import { ReferenceWindow } from './components/ReferenceWindow';
import {
  convertGroupToSmartLayer,
  convertLayersToSmartLayer,
  unpackSmartLayerToGroup,
  flattenGroupToRasterLayer,
  flattenSmartLayerToRasterLayer,
  flattenAllLayersToRasterLayer,
  renderSmartLayerCanvas,
  cloneSubLayer,
  addSmartFilterToLayer,
  toggleSmartFilterInLayer,
  toggleAllSmartFiltersInLayer,
  removeSmartFilterFromLayer,
  reorderSmartFilterInLayer,
} from './utils/smartLayerEngine';
import { SmartLayerEditorModal } from './components/SmartLayerEditorModal';

// Helper to create a fresh canvas layer with high-quality image smoothing
function createLayer(
  id: string,
  name: string,
  width: number,
  height: number,
  options: Partial<Layer> = {}
): Layer {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return {
    id,
    name,
    visible: true,
    opacity: 1,
    blendMode: 'source-over',
    locked: false,
    alphaLocked: false,
    canvas,
    ctx,
    ...options,
  };
}
import { renderSharpTriangularCutout } from './utils/cutoutFilter';

// Helper to deep-clone a layer for rock-solid Undo/Redo without losing layers
function cloneLayerSnapshot(l: Layer): Layer {
  const copyCanvas = document.createElement('canvas');
  copyCanvas.width = l.canvas.width;
  copyCanvas.height = l.canvas.height;
  const copyCtx = copyCanvas.getContext('2d', { willReadFrequently: true })!;
  copyCtx.imageSmoothingEnabled = true;
  copyCtx.imageSmoothingQuality = 'high';
  copyCtx.drawImage(l.canvas, 0, 0);

  let clonedMask = undefined;
  if (l.mask) {
    const mCanvas = document.createElement('canvas');
    mCanvas.width = l.mask.canvas.width;
    mCanvas.height = l.mask.canvas.height;
    const mCtx = mCanvas.getContext('2d', { willReadFrequently: true })!;
    mCtx.drawImage(l.mask.canvas, 0, 0);
    clonedMask = {
      ...l.mask,
      canvas: mCanvas,
      ctx: mCtx,
    };
  }

  let clonedSmartLayers = undefined;
  if (l.smartLayers) {
    clonedSmartLayers = l.smartLayers.map((sl) => cloneLayerSnapshot(sl));
  }

  let clonedSmartFilters = undefined;
  if (l.smartFilters) {
    clonedSmartFilters = l.smartFilters.map((sf) => ({
      ...sf,
      params: {
        ...sf.params,
        customLut: sf.params.customLut ? new Uint8Array(sf.params.customLut) : undefined,
        extraConfig: sf.params.extraConfig ? JSON.parse(JSON.stringify(sf.params.extraConfig)) : undefined,
      },
    }));
  }

  return {
    ...l,
    canvas: copyCanvas,
    ctx: copyCtx,
    mask: clonedMask,
    smartLayers: clonedSmartLayers,
    smartFilters: clonedSmartFilters,
    vectorPaths: l.vectorPaths ? JSON.parse(JSON.stringify(l.vectorPaths)) : undefined,
    adjustmentConfig: l.adjustmentConfig ? JSON.parse(JSON.stringify(l.adjustmentConfig)) : undefined,
    effects: l.effects ? JSON.parse(JSON.stringify(l.effects)) : undefined,
  };
}

// Generate Starter Demo Artwork
function generateInitialArtwork(): ArtworkProject {
  const width = 1600;
  const height = 1200;

  const l1Canvas = document.createElement('canvas');
  l1Canvas.width = width;
  l1Canvas.height = height;
  const ctx1 = l1Canvas.getContext('2d')!;
  const skyGrad = ctx1.createLinearGradient(0, 0, 0, height);
  skyGrad.addColorStop(0, '#1a102f');
  skyGrad.addColorStop(0.4, '#4a154b');
  skyGrad.addColorStop(0.7, '#b83b5e');
  skyGrad.addColorStop(1, '#f08a5d');
  ctx1.fillStyle = skyGrad;
  ctx1.fillRect(0, 0, width, height);

  ctx1.fillStyle = '#fee385';
  ctx1.beginPath();
  ctx1.arc(width / 2, height * 0.65, 140, 0, Math.PI * 2);
  ctx1.fill();

  const l2Canvas = document.createElement('canvas');
  l2Canvas.width = width;
  l2Canvas.height = height;
  const ctx2 = l2Canvas.getContext('2d')!;
  ctx2.fillStyle = '#2c0c30';
  ctx2.beginPath();
  ctx2.moveTo(0, height);
  ctx2.lineTo(0, height * 0.7);
  ctx2.lineTo(width * 0.35, height * 0.45);
  ctx2.lineTo(width * 0.7, height * 0.75);
  ctx2.lineTo(width, height * 0.55);
  ctx2.lineTo(width, height);
  ctx2.closePath();
  ctx2.fill();

  ctx2.fillStyle = '#160824';
  ctx2.beginPath();
  ctx2.moveTo(0, height);
  ctx2.lineTo(0, height * 0.85);
  ctx2.lineTo(width * 0.25, height * 0.68);
  ctx2.lineTo(width * 0.6, height * 0.9);
  ctx2.lineTo(width * 0.85, height * 0.75);
  ctx2.lineTo(width, height * 0.82);
  ctx2.lineTo(width, height);
  ctx2.closePath();
  ctx2.fill();

  const l3Canvas = document.createElement('canvas');
  l3Canvas.width = width;
  l3Canvas.height = height;
  const ctx3 = l3Canvas.getContext('2d')!;
  ctx3.fillStyle = '#ffffff';
  for (let i = 0; i < 90; i++) {
    const sx = Math.random() * width;
    const sy = Math.random() * (height * 0.5);
    const sr = Math.random() * 2 + 0.5;
    ctx3.beginPath();
    ctx3.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx3.fill();
  }

  const thumb = document.createElement('canvas');
  thumb.width = 300;
  thumb.height = 225;
  const tCtx = thumb.getContext('2d')!;
  tCtx.drawImage(l1Canvas, 0, 0, 300, 225);
  tCtx.drawImage(l2Canvas, 0, 0, 300, 225);
  tCtx.drawImage(l3Canvas, 0, 0, 300, 225);

  return {
    id: 'demo_artwork_1',
    title: 'Neon Twilight Horizon',
    width,
    height,
    createdAt: Date.now() - 3600000 * 24,
    updatedAt: Date.now(),
    backgroundColor: '#111215',
    thumbnailUrl: thumb.toDataURL(),
    layers: [
      {
        id: 'layer_sky',
        name: 'Sky & Atmosphere',
        visible: true,
        opacity: 1,
        blendMode: 'source-over',
        locked: false,
        alphaLocked: false,
        dataUrl: l1Canvas.toDataURL(),
      },
      {
        id: 'layer_mountains',
        name: 'Mountains',
        visible: true,
        opacity: 1,
        blendMode: 'source-over',
        locked: false,
        alphaLocked: false,
        dataUrl: l2Canvas.toDataURL(),
      },
      {
        id: 'layer_stars',
        name: 'Stars & Accents',
        visible: true,
        opacity: 0.9,
        blendMode: 'screen',
        locked: false,
        alphaLocked: false,
        dataUrl: l3Canvas.toDataURL(),
      },
    ],
    recordedStrokes: [],
  };
}

// 5x5 Quick Menu Action Item Definition
interface QuickGridSlot {
  slotIndex: number;
  actionId: string;
  label: string;
}

const AVAILABLE_QUICK_ACTIONS = [
  { id: 'undo', label: 'Undo', category: 'History' },
  { id: 'redo', label: 'Redo', category: 'History' },
  { id: 'flip_h', label: 'Flip Horizontal', category: 'Canvas' },
  { id: 'flip_v', label: 'Flip Vertical', category: 'Canvas' },
  { id: 'new_layer', label: 'New Raster Layer', category: 'Layers' },
  { id: 'new_vector', label: 'New Vector Layer', category: 'Layers' },
  { id: 'merge_down', label: 'Merge Down (Ctrl+E)', category: 'Layers' },
  { id: 'dup_layer', label: 'Duplicate Layer', category: 'Layers' },
  { id: 'clear_layer', label: 'Clear Layer', category: 'Layers' },
  { id: 'copy_layer', label: 'Copy Layer', category: 'Clipboard' },
  { id: 'paste', label: 'Paste Clipboard', category: 'Clipboard' },
  { id: 'adj_gradient_map', label: 'Gradient Map Layer', category: 'Adjustments' },
  { id: 'adj_curves', label: 'Curves Effect', category: 'Adjustments' },
  { id: 'adj_hue', label: 'Hue & Saturation', category: 'Adjustments' },
  { id: 'adj_glitch', label: 'Glitch & Pixel Sort', category: 'Adjustments' },
  { id: 'tool_brush', label: 'Brush Tool', category: 'Tools' },
  { id: 'tool_smudge', label: 'Smudge / Smush Tool', category: 'Tools' },
  { id: 'tool_eraser', label: 'Eraser Tool', category: 'Tools' },
  { id: 'tool_studio', label: 'Brush Studio (11 Tabs)', category: 'Tools' },
  { id: 'tool_transform', label: 'Transform / Puppet Warp', category: 'Tools' },
  { id: 'toggle_symmetry', label: 'Symmetry Mirror Guide', category: 'Guides' },
  { id: 'toggle_grid', label: 'Toggle 2D Grid', category: 'Guides' },
  { id: 'toggle_touch', label: 'Pen Pressure & Touch Prefs', category: 'Settings' },
  { id: 'zen_mode', label: 'Zen Mode', category: 'Workspace' },
];

const DEFAULT_5X5_SLOTS: QuickGridSlot[] = Array.from({ length: 25 }, (_, idx) => {
  if (idx === 12) return { slotIndex: 12, actionId: 'PLUS_CENTER', label: '+ Add Action' };
  const presets: Record<number, { id: string; label: string }> = {
    0: { id: 'undo', label: 'Undo' },
    1: { id: 'redo', label: 'Redo' },
    2: { id: 'flip_h', label: 'Flip H' },
    3: { id: 'flip_v', label: 'Flip V' },
    4: { id: 'new_layer', label: 'New Layer' },
    5: { id: 'merge_down', label: 'Merge Down' },
    6: { id: 'new_vector', label: 'Vector Layer' },
    7: { id: 'adj_gradient_map', label: 'Gradient Map' },
    8: { id: 'adj_curves', label: 'Curves' },
    9: { id: 'tool_transform', label: 'Puppet/Transform' },
    10: { id: 'copy_layer', label: 'Copy Layer' },
    11: { id: 'paste', label: 'Paste' },
    13: { id: 'clear_layer', label: 'Clear Layer' },
    14: { id: 'dup_layer', label: 'Dup Layer' },
    15: { id: 'toggle_symmetry', label: 'Symmetry' },
    16: { id: 'toggle_touch', label: 'Pressure & Touch' },
  };
  return {
    slotIndex: idx,
    actionId: presets[idx]?.id || 'empty',
    label: presets[idx]?.label || 'Empty Slot',
  };
});

function detectDefaultDeviceMode(): 'pc' | 'tablet' | 'phone' {
  if (typeof window === 'undefined') return 'pc';
  const width = window.innerWidth;
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (width < 640) return 'phone';
  if (width < 1024 || (isTouch && width < 1366)) return 'tablet';
  return 'pc';
}

function getDefaultScaleForMode(mode: string): number {
  if (mode === 'phone') return 0.75;
  if (mode === 'tablet') return 0.90;
  return 1.0;
}

export default function App() {
  // Device Mode, UI Adaptability Scale & Hardware Acceleration State
  const [deviceMode, setDeviceMode] = useState<'auto' | 'pc' | 'tablet' | 'phone'>(() => {
    try {
      const saved = localStorage.getItem('hunbatz_device_mode');
      if (saved === 'auto' || saved === 'pc' || saved === 'tablet' || saved === 'phone') {
        return saved;
      }
    } catch {}
    return 'auto';
  });

  const effectiveDeviceMode = deviceMode === 'auto' ? detectDefaultDeviceMode() : deviceMode;

  const [uiScale, setUiScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('hunbatz_ui_scale');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 0.65 && val <= 1.35) {
          return val;
        }
      }
    } catch {}
    return getDefaultScaleForMode(deviceMode === 'auto' ? detectDefaultDeviceMode() : deviceMode);
  });

  const [hwAcceleration, setHwAcceleration] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('hunbatz_hw_acceleration');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('hunbatz_device_mode', deviceMode);
    } catch {}
  }, [deviceMode]);

  useEffect(() => {
    try {
      localStorage.setItem('hunbatz_ui_scale', uiScale.toString());
    } catch {}
  }, [uiScale]);

  useEffect(() => {
    try {
      localStorage.setItem('hunbatz_hw_acceleration', hwAcceleration ? 'true' : 'false');
    } catch {}
  }, [hwAcceleration]);

  // Gallery & Artwork state (Deduplicates any projects that received identical IDs from previous .hbatz imports)
  const [artworks, setArtworks] = useState<ArtworkProject[]>(() => {
    try {
      const saved = localStorage.getItem('procreate_pc_projects');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const seenIds = new Set<string>();
          return parsed.map((art: ArtworkProject, idx: number) => {
            if (!art.id || seenIds.has(art.id)) {
              const newId = `art_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`;
              seenIds.add(newId);
              return { ...art, id: newId };
            }
            seenIds.add(art.id);
            return art;
          });
        }
      }
    } catch {}
    return [generateInitialArtwork()];
  });
  const [currentArtworkId, setCurrentArtworkId] = useState<string | null>(artworks[0]?.id || null);
  const [inGallery, setInGallery] = useState(false);

  // Refs to prevent .HBATZ imports and Gallery switches from flattening Smart Layers & 3D Relight layers
  const skipNextArtworkLoadRef = useRef<boolean>(false);
  const artworkLayersCacheRef = useRef<Map<string, Layer[]>>(new Map());
  const lastDeleteTimeRef = useRef<number>(0);
  const isSavingToDiskRef = useRef<boolean>(false);

  // Active Artwork Workspace state
  const activeArtwork = artworks.find((a) => a.id === currentArtworkId) || artworks[0];
  const [layers, setLayers] = useState<Layer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string>('');
  const [backgroundColor, setBackgroundColor] = useState<string>('#ffffff');

  // Tools & Brushes state
  const [activeTool, setActiveTool] = useState<ToolType>('brush');
  const [initialTransformMode, setInitialTransformMode] = useState<TransformMode | null>(null);
  const [brushes, setBrushes] = useState<Brush[]>(() => {
    try {
      const saved = localStorage.getItem('hunbatz_base_brushes_v15');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hydrated = parsed
            .filter((b: any) =>
              b &&
              !b.category?.toLowerCase().includes('velvetcat') &&
              !b.category?.toLowerCase().includes('custom') &&
              b.category !== 'Placeholder' &&
              b.category !== 'Hunbatz Base Brushes'
            )
            .map((b: Brush) => hydrateBrush(b));
          if (hydrated.length > 0) return hydrated;
        }
      }
    } catch {}
    const inkingDefaults = DEFAULT_BRUSHES.filter((b) => b.category === 'Inking');
    return inkingDefaults.length > 0 ? inkingDefaults : DEFAULT_BRUSHES;
  });
  const [activeBrush, setActiveBrush] = useState<Brush>(() => {
    if (brushes.length > 0) return brushes[0];
    const defaultInking = DEFAULT_BRUSHES.find((b) => b.category === 'Inking');
    return defaultInking || DEFAULT_BRUSHES[0];
  });
  const [recentBrushIds, setRecentBrushIds] = useState<string[]>([]);
  const [personalFavBrushIds, setPersonalFavBrushIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('hunbatz_personal_fav_brushes_v6');
      return saved ? JSON.parse(saved) : [DEFAULT_BRUSHES[0]?.id].filter(Boolean);
    } catch {
      return [];
    }
  });
  const [projectFavBrushIds, setProjectFavBrushIds] = useState<string[]>([]);

  const [currentColor, setCurrentColor] = useState<string>('#cf4a30');
  const [previousColor, setPreviousColor] = useState<string>('#fae17d');
  const [brushSize, setBrushSize] = useState<number>(() => {
    return Number(DEFAULT_BRUSHES[0]?.size) || 24;
  });
  const [brushOpacity, setBrushOpacity] = useState<number>(1.0);

  // RAM Management Profile ('low' ~1GB, 'medium' ~1.5-2GB, 'power' uncapped)
  const [ramProfile, setRamProfile] = useState<'low' | 'medium' | 'power'>(() => {
    try {
      const saved = localStorage.getItem('hunbatz_ram_profile');
      if (saved === 'low' || saved === 'medium' || saved === 'power') return saved;
    } catch {}
    return 'medium';
  });

  useEffect(() => {
    try {
      localStorage.setItem('hunbatz_ram_profile', ramProfile);
    } catch {}
  }, [ramProfile]);

  // Pen Pressure & Touch Settings
  const [isPrefsTabActive, setIsPrefsTabActive] = useState<boolean>(false);
  const [touchPaintingEnabled, setTouchPaintingEnabled] = useState<boolean>(true);
  const [pressureCurvePoint, setPressureCurvePoint] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem('hunbatz_pressure_curve_pt');
      return saved ? JSON.parse(saved) : { x: 0.5, y: 0.5 };
    } catch {
      return { x: 0.5, y: 0.5 };
    }
  });

  // Track active selection marquee for instant selection-to-mask conversion
  const [currentSelection, setCurrentSelection] = useState<{ isActive: boolean; maskCanvas: HTMLCanvasElement | null } | null>(null);
  const [clearSelectionSignal, setClearSelectionSignal] = useState<number>(0);

  useEffect(() => {
    try {
      localStorage.setItem('hunbatz_pressure_curve_pt', JSON.stringify(pressureCurvePoint));
    } catch {}
  }, [pressureCurvePoint]);

  // 5x5 Pop-Up Quick Menu State
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState<boolean>(false);
  const [quickMenuTab, setQuickMenuTab] = useState<'actions' | 'brushes'>('actions');
  const [quickMenuFavCategory, setQuickMenuFavCategory] = useState<'project' | 'personal' | 'recent'>('personal');
  const [quickGridSlots, setQuickGridSlots] = useState<QuickGridSlot[]>(() => {
    try {
      const saved = localStorage.getItem('hunbatz_5x5_quick_slots');
      return saved ? JSON.parse(saved) : DEFAULT_5X5_SLOTS;
    } catch {
      return DEFAULT_5X5_SLOTS;
    }
  });
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [commandSearchQuery, setCommandSearchQuery] = useState<string>('');
  const [targetSlotForBinding, setTargetSlotForBinding] = useState<number | null>(null);
  const [isJiggleEditMode, setIsJiggleEditMode] = useState<boolean>(false);
  const [draggedSlotIndex, setDraggedSlotIndex] = useState<number | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('hunbatz_5x5_quick_slots', JSON.stringify(quickGridSlots));
    } catch {}
  }, [quickGridSlots]);

  useEffect(() => {
    try {
      localStorage.setItem('hunbatz_personal_fav_brushes_v6', JSON.stringify(personalFavBrushIds));
    } catch {}
  }, [personalFavBrushIds]);

  useEffect(() => {
    try {
      localStorage.setItem('hunbatz_base_brushes_v15', JSON.stringify(brushes));
    } catch {}
  }, [brushes]);

  useEffect(() => {
    fetchLocalBrushes().then(({ folders, brushes: localBrushes }) => {
      if (localBrushes && localBrushes.length > 0) {
        setBrushes(localBrushes);
        saveBrushFolders(folders);
        setActiveBrush((current) => {
          const exists = localBrushes.some((b) => b.id === current.id || b.name === current.name);
          return exists ? current : localBrushes[0];
        });
      }
    });
  }, []);

  // Synchronize and load all artworks from Hunbatz local content/Projects/
  useEffect(() => {
    fetchLocalProjects()
      .then(async (diskProjects) => {
        if (diskProjects && diskProjects.length > 0) {
          const loadedArtworks: ArtworkProject[] = diskProjects.map((dp) => ({
            ...dp.artwork,
            id: dp.artwork.id || `art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            fileName: dp.fileName,
            fileSize: dp.fileSize,
            updatedAt: dp.updatedAt,
            createdAt: dp.createdAt,
          }));
          setArtworks(loadedArtworks);
          setCurrentArtworkId((curr) => {
            if (curr && loadedArtworks.some((a) => a.id === curr)) return curr;
            return loadedArtworks[0]?.id || null;
          });
        } else {
          // If Projects/ directory on disk is currently empty, initialize demo artwork and write .hbatz to disk
          const demo = generateInitialArtwork();
          const demoFileName = 'Neon_Twilight_Horizon.hbatz';
          demo.fileName = demoFileName;

          const demoLayers: Layer[] = demo.layers.map((lData) => {
            const layer = createLayer(lData.id, lData.name, demo.width, demo.height, {
              visible: lData.visible,
              opacity: lData.opacity,
              blendMode: lData.blendMode,
              locked: lData.locked,
            });
            if (lData.dataUrl) {
              const img = new Image();
              img.src = lData.dataUrl;
              img.onload = () => {
                layer.ctx.drawImage(img, 0, 0);
              };
            }
            return layer;
          });

          artworkLayersCacheRef.current.set(demo.id, demoLayers.map(cloneLayerSnapshot));
          setArtworks([demo]);
          setCurrentArtworkId(demo.id);

          saveProjectToLocalContent(demo, demoLayers, demoFileName)
            .then((res) => {
              setArtworks((prev) =>
                prev.map((a) => (a.id === demo.id ? { ...a, fileSize: res.size } : a))
              );
            })
            .catch((e) => console.error('Failed to initialize demo .hbatz on disk:', e));
        }
      })
      .catch((err) => {
        console.warn('Could not read projects from local content folder:', err);
      });
  }, []);

  // Toast feedback message
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  }, []);

  const handleSyncAllToLocalContent = useCallback(async () => {
    try {
      const currentFolders = Array.from(new Set(brushes.map((b) => b.category).filter(Boolean)));
      const success = await syncAllToLocalContent(brushes, currentFolders);
      if (success) {
        showToast(`Saved all ${brushes.length} brushes to Hunbatz local content`);
      } else {
        showToast('Sync to Hunbatz local content failed');
      }
    } catch {
      showToast('Error syncing to local content');
    }
  }, [brushes, showToast]);

  // Full-State Undo / Redo History Stack
  const historyStackRef = useRef<{ layersSnapshot: Layer[]; activeLayerId: string }[]>([]);
  const redoStackRef = useRef<{ layersSnapshot: Layer[]; activeLayerId: string }[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);

  // Time-Lapse recorded strokes
  const [recordedStrokes, setRecordedStrokes] = useState<CanvasStrokeRecord[]>([]);

  // Modals & Panels toggle state
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isBrushLibraryOpen, setIsBrushLibraryOpen] = useState(false);
  const [isBrushStudioOpen, setIsBrushStudioOpen] = useState(false);
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const [isColorStudioOpen, setIsColorStudioOpen] = useState(false);
  const [isTimeLapseOpen, setIsTimeLapseOpen] = useState(false);
  const [isDrawingGuideSettingsOpen, setIsDrawingGuideSettingsOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [activeAdjustment, setActiveAdjustment] = useState<ActiveAdjustment>(null);
  const [isZenMode, setIsZenMode] = useState(false);
  const [isEyedropperActive, setIsEyedropperActive] = useState(false);
  const [isShapesOpen, setIsShapesOpen] = useState(false);
  const [isAdjustingBrushSize, setIsAdjustingBrushSize] = useState(false);
  const [activeMaskLayerId, setActiveMaskLayerId] = useState<string | null>(null);
  const [dismissedAdjustmentBarLayerIds, setDismissedAdjustmentBarLayerIds] = useState<Set<string>>(new Set());
  const [isEditingAdjLayerGradientMap, setIsEditingAdjLayerGradientMap] = useState<string | null>(null);
  const effectBackupCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Cutout Filter State (Intercepted for Photopea-Parity Triangular/Polygonal Cutout)
  const [cutoutParams, setCutoutParams] = useState<{ levels: number; simplicity: number; fidelity: number }>({
    levels: 6,
    simplicity: 4,
    fidelity: 2,
  });

  // Backup active layer pixels when starting modal adjustments (Gradient Map / Dither Suite / Cutout)
  useEffect(() => {
    if (
      activeAdjustment === 'gradient_map' ||
      activeAdjustment === 'dither_suite' ||
      activeAdjustment === 'cutout'
    ) {
      const activeL = layers.find((l) => l.id === activeLayerId);
      if (activeL) {
        const backup = document.createElement('canvas');
        backup.width = activeArtwork.width;
        backup.height = activeArtwork.height;
        const bCtx = backup.getContext('2d')!;
        bCtx.drawImage(activeL.canvas, 0, 0);
        effectBackupCanvasRef.current = backup;

        if (activeAdjustment === 'cutout') {
          const initialLevels = editingSmartFilter?.filter.params.val1 ?? 6;
          const initialSimplicity = editingSmartFilter?.filter.params.val2 ?? 4;
          const initialFidelity = editingSmartFilter?.filter.params.val3 ?? 2;
          setCutoutParams({
            levels: initialLevels,
            simplicity: initialSimplicity,
            fidelity: initialFidelity,
          });
          const preview = renderSharpTriangularCutout(backup, initialLevels, initialSimplicity, initialFidelity);
          activeL.ctx.clearRect(0, 0, activeArtwork.width, activeArtwork.height);
          activeL.ctx.drawImage(preview, 0, 0);
          setLayers([...layers]);
        }
      }
    } else if (!activeAdjustment) {
      effectBackupCanvasRef.current = null;
    }
  }, [activeAdjustment, activeLayerId, activeArtwork.width, activeArtwork.height]);

  // Close Prefs sub-panel whenever Actions Modal closes
  useEffect(() => {
    if (!isActionsOpen) {
      setIsPrefsTabActive(false);
    }
  }, [isActionsOpen]);

  // 2D Vector Layer Lineart configuration
  const [vectorLayerConfig, setVectorLayerConfig] = useState({
    editMode: 'pen' as VectorToolSubMode,
    strokeWidth: 4,
    strokeColor: '#000000',
    hasFill: false,
    fillColor: '#ffffff',
    isClosed: false,
    brushTexture: 'smooth_ink' as BrushTexture,
    lineCorrection: 35,
    thickenFactor: 2,
    radialRadius: 40,
  });

  // Vector Shape Configuration State
  const [vectorShapeConfig, setVectorShapeConfig] = useState<VectorShapeConfig>({
    type: 'rectangle',
    x: 200,
    y: 180,
    width: 320,
    height: 220,
    strokeWidth: 4,
    strokeColor: '#000000',
    hasFill: false,
    fillColor: '#ffffff',
    strokeStyle: 'solid',
    opacity: 1,
    cornerRadius: 16,
    starPoints: 5,
    starInnerRatio: 0.45,
    gridRows: 4,
    gridCols: 4,
    spikesCount: 16,
    spikeAmplitude: 0.35,
    vignetteLayout: 'single',
    vignetteGutter: 12,
    mimicBrush: false,
    pathPoints: [
      { x: 200, y: 320 },
      { x: 300, y: 190 },
      { x: 440, y: 360 },
      { x: 560, y: 220 },
    ],
  });

  // Push full layer array snapshot to Undo history (scaled by ramProfile)
  const handlePushHistory = useCallback(() => {
    if (layers.length === 0) return;
    const snapshot = {
      layersSnapshot: layers.map(cloneLayerSnapshot),
      activeLayerId,
    };
    historyStackRef.current.push(snapshot);
    const maxHistory = ramProfile === 'low' ? 10 : ramProfile === 'power' ? 60 : 25;
    while (historyStackRef.current.length > maxHistory) {
      historyStackRef.current.shift();
    }
    redoStackRef.current = [];
    setHistoryVersion((v) => v + 1);
  }, [layers, activeLayerId, ramProfile]);

  // Undo Handler
  const handleUndo = useCallback(() => {
    if (historyStackRef.current.length === 0) return;
    const currentSnapshot = {
      layersSnapshot: layers.map(cloneLayerSnapshot),
      activeLayerId,
    };
    redoStackRef.current.push(currentSnapshot);
    const maxRedo = ramProfile === 'low' ? 5 : ramProfile === 'power' ? 30 : 15;
    while (redoStackRef.current.length > maxRedo) {
      redoStackRef.current.shift();
    }

    const prevSnapshot = historyStackRef.current.pop()!;
    const restoredLayers = prevSnapshot.layersSnapshot.map(cloneLayerSnapshot);
    setLayers(restoredLayers);

    if (
      prevSnapshot.activeLayerId &&
      restoredLayers.some((l) => l.id === prevSnapshot.activeLayerId)
    ) {
      setActiveLayerId(prevSnapshot.activeLayerId);
    } else if (restoredLayers.length > 0) {
      setActiveLayerId(restoredLayers[restoredLayers.length - 1].id);
    }

    setHistoryVersion((v) => v + 1);
    showToast('Undo');
  }, [layers, activeLayerId, ramProfile, showToast]);

  // Redo Handler
  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const currentSnapshot = {
      layersSnapshot: layers.map(cloneLayerSnapshot),
      activeLayerId,
    };
    historyStackRef.current.push(currentSnapshot);
    const maxHistory = ramProfile === 'low' ? 10 : ramProfile === 'power' ? 60 : 25;
    while (historyStackRef.current.length > maxHistory) {
      historyStackRef.current.shift();
    }

    const nextSnapshot = redoStackRef.current.pop()!;
    const restoredLayers = nextSnapshot.layersSnapshot.map(cloneLayerSnapshot);
    setLayers(restoredLayers);

    if (
      nextSnapshot.activeLayerId &&
      restoredLayers.some((l) => l.id === nextSnapshot.activeLayerId)
    ) {
      setActiveLayerId(nextSnapshot.activeLayerId);
    } else if (restoredLayers.length > 0) {
      setActiveLayerId(restoredLayers[restoredLayers.length - 1].id);
    }

    setHistoryVersion((v) => v + 1);
    showToast('Redo');
  }, [layers, activeLayerId, showToast]);

  // Convert active Shape into an editable Vector Layer with plotted nodes
  const handleConvertShapeToVectorLayer = useCallback(() => {
    handlePushHistory();
    const { x, y, width, height, type, strokeColor, strokeWidth, hasFill, fillColor } =
      vectorShapeConfig;
    let points: { x: number; y: number }[] = [];

    if (type === 'circle') {
      const cx = x + width / 2;
      const cy = y + height / 2;
      const rx = width / 2;
      const ry = height / 2;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        points.push({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry });
      }
    } else if (type === 'triangle') {
      points = [
        { x: x + width / 2, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ];
    } else if (type === 'line' || (type as string) === 'curve_line') {
      points = vectorShapeConfig.pathPoints?.length
        ? [...vectorShapeConfig.pathPoints]
        : [
            { x, y: y + height / 2 },
            { x: x + width, y: y + height / 2 },
          ];
    } else {
      points = [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ];
    }

    const newId = `layer_vec_shape_${Date.now()}`;
    const newVectorLayer = createLayer(
      newId,
      `Vector ${type.replace('_', ' ')}`,
      activeArtwork.width,
      activeArtwork.height,
      {
        type: 'vector',
        isVector: true,
        vectorPaths: [
          {
            id: `vpath_${Date.now()}`,
            points: points.map((pt, idx) => ({
              id: `pt_${idx}_${Date.now()}`,
              x: pt.x,
              y: pt.y,
              width: strokeWidth,
            })),
            strokeColor,
            strokeWidth,
            fillColor: hasFill ? fillColor : undefined,
            closed: type !== 'line' && (type as string) !== 'curve_line',
            brushTexture: vectorLayerConfig.brushTexture,
          },
        ],
      }
    );

    renderVectorShape(newVectorLayer.ctx, vectorShapeConfig, activeBrush);
    const thumb = document.createElement('canvas');
    thumb.width = 64;
    thumb.height = 64;
    thumb.getContext('2d')?.drawImage(newVectorLayer.canvas, 0, 0, 64, 64);
    newVectorLayer.thumbnailUrl = thumb.toDataURL();

    setLayers((prev) => [...prev, newVectorLayer]);
    setActiveLayerId(newId);
    setIsShapesOpen(false);
    setVectorLayerConfig((prev) => ({ ...prev, editMode: 'select_node' as VectorToolSubMode }));
    showToast(`Converted ${type} to editable Vector Layer! Click nodes to edit.`);
  }, [
    vectorShapeConfig,
    activeArtwork,
    vectorLayerConfig.brushTexture,
    activeBrush,
    handlePushHistory,
    showToast,
  ]);

  // Rasterize Vector Shape to active layer
  const handleRasterizeVectorShape = () => {
    const activeLayer = layers.find((l) => l.id === activeLayerId);
    if (!activeLayer) return;
    handlePushHistory();
    renderVectorShape(activeLayer.ctx, vectorShapeConfig, activeBrush);

    const thumb = document.createElement('canvas');
    thumb.width = 64;
    thumb.height = 64;
    thumb.getContext('2d')?.drawImage(activeLayer.canvas, 0, 0, 64, 64);
    activeLayer.thumbnailUrl = thumb.toDataURL();

    setLayers([...layers]);
    showToast(`Rasterized ${vectorShapeConfig.type.replace('_', ' ')} to layer`);
  };

  const handleAddPathPoint = () => {
    setVectorShapeConfig((prev) => {
      const currentPts = prev.pathPoints || [];
      const lastPt = currentPts[currentPts.length - 1] || { x: prev.x, y: prev.y };
      const newPt = { x: lastPt.x + 60, y: lastPt.y + (Math.random() * 60 - 30) };
      return { ...prev, pathPoints: [...currentPts, newPt] };
    });
  };

  const handleResetPathPoints = () => {
    setVectorShapeConfig((prev) => ({
      ...prev,
      pathPoints: [
        { x: prev.x, y: prev.y + prev.height / 2 },
        { x: prev.x + prev.width * 0.33, y: prev.y },
        { x: prev.x + prev.width * 0.66, y: prev.y + prev.height },
        { x: prev.x + prev.width, y: prev.y + prev.height / 2 },
      ],
    }));
  };

  // Canvas feature waves: Crop & Resize, Animation Assist, Page Assist
  const [isCropResizeOpen, setIsCropResizeOpen] = useState(false);
  const [isAnimationAssistActive, setIsAnimationAssistActive] = useState(false);
  const [isPageAssistActive, setIsPageAssistActive] = useState(false);
  const [isReferenceActive, setIsReferenceActive] = useState(false);
  const [layerEffectsTargetId, setLayerEffectsTargetId] = useState<string | null>(null);
  const [editingSmartLayerId, setEditingSmartLayerId] = useState<string | null>(null);
  const [editingSmartFilter, setEditingSmartFilter] = useState<{
    layerId: string;
    filterId: string;
    filter: SmartFilter;
  } | null>(null);
  const [selectLayerPixelsId, setSelectLayerPixelsId] = useState<string | null>(null);
  const [animationConfig, setAnimationConfig] = useState<AnimationConfig>({
    fps: 12,
    loopMode: 'loop',
    onionSkinFrames: 2,
    onionSkinOpacity: 0.35,
    onionSkinPrevColor: '#ef4444',
    onionSkinNextColor: '#10b981',
    isPlaying: false,
  });

  // Handle Crop and Resize
  const handleApplyCropResize = (params: {
    width: number;
    height: number;
    cropX: number;
    cropY: number;
    resample: boolean;
    dpi: number;
  }) => {
    handlePushHistory();
    const { width, height, cropX, cropY, resample } = params;

    const updatedLayers = layers.map((layer) => {
      const newCanvas = document.createElement('canvas');
      newCanvas.width = width;
      newCanvas.height = height;
      const newCtx = newCanvas.getContext('2d');
      if (!newCtx) return layer;
      newCtx.imageSmoothingEnabled = true;
      newCtx.imageSmoothingQuality = 'high';

      if (resample) {
        newCtx.drawImage(layer.canvas, 0, 0, width, height);
      } else {
        newCtx.drawImage(layer.canvas, -cropX, -cropY);
      }

      const thumb = document.createElement('canvas');
      thumb.width = 64;
      thumb.height = 64;
      thumb.getContext('2d')?.drawImage(newCanvas, 0, 0, 64, 64);

      return {
        ...layer,
        canvas: newCanvas,
        ctx: newCtx,
        thumbnailUrl: thumb.toDataURL(),
      };
    });

    setLayers(updatedLayers);
    if (activeArtwork) {
      artworkLayersCacheRef.current.set(activeArtwork.id, updatedLayers.map(cloneLayerSnapshot));
    }
    setArtworks((prev) =>
      prev.map((a) =>
        a.id === activeArtwork.id
          ? {
              ...a,
              width,
              height,
              layers: updatedLayers.map((l) => ({
                id: l.id,
                name: l.name,
                visible: l.visible,
                opacity: l.opacity,
                blendMode: l.blendMode,
                locked: l.locked,
                alphaLocked: l.alphaLocked,
                dataUrl: l.canvas.toDataURL(),
              })),
            }
          : a
      )
    );
    setIsCropResizeOpen(false);
    showToast(`Canvas resized to ${width} × ${height} px`);
  };

  // Canvas Settings - Mayan Jade Green (#10b981)
  const [drawingGuide, setDrawingGuide] = useState<DrawingGuideConfig>({
    type: 'none',
    opacity: 0.35,
    thickness: 1.5,
    gridSize: 50,
    color: '#10b981',
    assisted: false,
  });
  const [sidebarPosition, setSidebarPosition] = useState<'left' | 'right'>('left');
  const [showBrushCursor, setShowBrushCursor] = useState(true);
  const [zoomScale, setZoomScale] = useState(1);

  // Select Brush & Track Recently Used Brushes (syncing brushSize)
  const handleSelectBrushWithRecent = useCallback((brush: Brush) => {
    const targetSize = Number(brush.size) || Number((brush as any).baseSize) || 24;
    setActiveBrush(brush);
    setBrushSize(targetSize);
    setRecentBrushIds((prev) => {
      const filtered = prev.filter((id) => id !== brush.id);
      return [brush.id, ...filtered].slice(0, 18);
    });
  }, []);

  // Low RAM mode: prune inactive artwork layers from memory cache
  useEffect(() => {
    if (ramProfile === 'low' && activeArtwork) {
      for (const key of Array.from(artworkLayersCacheRef.current.keys())) {
        if (key !== activeArtwork.id) {
          artworkLayersCacheRef.current.delete(key);
        }
      }
    }
  }, [ramProfile, activeArtwork]);

  // Initialize Layers from current artwork without overwriting rich .HBATZ or cached layers
  useEffect(() => {
    if (!activeArtwork) return;

    if (skipNextArtworkLoadRef.current) {
      skipNextArtworkLoadRef.current = false;
      historyStackRef.current = [];
      redoStackRef.current = [];
      return;
    }

    setBackgroundColor(activeArtwork.backgroundColor || '#ffffff');
    setRecordedStrokes(activeArtwork.recordedStrokes || []);

    const cachedLayers = artworkLayersCacheRef.current.get(activeArtwork.id);
    if (cachedLayers && cachedLayers.length > 0) {
      const cloned = cachedLayers.map(cloneLayerSnapshot);
      setLayers(cloned);
      setActiveLayerId(cloned[cloned.length - 1]?.id || '');
      historyStackRef.current = [];
      redoStackRef.current = [];
      return;
    }

    let cancelled = false;

    const loadFallbackLayers = () => {
      const loadedLayers: Layer[] = [];
      let pendingCount = activeArtwork.layers.length;

      if (pendingCount === 0) {
        const defaultLayer = createLayer(`layer_${Date.now()}`, 'Layer 1', activeArtwork.width, activeArtwork.height);
        setLayers([defaultLayer]);
        setActiveLayerId(defaultLayer.id);
        return;
      }

      activeArtwork.layers.forEach((lData: any) => {
        const layer = createLayer(
          lData.id,
          lData.name,
          activeArtwork.width,
          activeArtwork.height,
          {
            visible: lData.visible,
            opacity: lData.opacity,
            blendMode: lData.blendMode,
            locked: lData.locked,
            alphaLocked: lData.alphaLocked,
            type: lData.type || 'raster',
            parentId: lData.parentId,
            isExpanded: lData.isExpanded,
            isVector: lData.isVector,
            vectorPaths: lData.vectorPaths,
            adjustmentConfig: lData.adjustmentConfig,
            effects: lData.effects,
            smartFilters: lData.smartFilters,
          }
        );

        if (lData.dataUrl) {
          const img = new Image();
          img.onload = () => {
            if (cancelled) return;
            layer.ctx.imageSmoothingEnabled = true;
            layer.ctx.imageSmoothingQuality = 'high';
            layer.ctx.drawImage(img, 0, 0);
            layer.thumbnailUrl = lData.dataUrl;
            pendingCount--;
            if (pendingCount === 0) {
              setLayers([...loadedLayers]);
              setActiveLayerId(loadedLayers[loadedLayers.length - 1]?.id || '');
            }
          };
          img.onerror = () => {
            if (cancelled) return;
            pendingCount--;
            if (pendingCount === 0) {
              setLayers([...loadedLayers]);
              setActiveLayerId(loadedLayers[loadedLayers.length - 1]?.id || '');
            }
          };
          img.src = lData.dataUrl;
        } else {
          pendingCount--;
          if (pendingCount === 0) {
            setLayers([...loadedLayers]);
            setActiveLayerId(loadedLayers[loadedLayers.length - 1]?.id || '');
          }
        }

        loadedLayers.push(layer);
      });

      historyStackRef.current = [];
      redoStackRef.current = [];
    };

    // If project exists on disk in Hunbatz local content/Projects/, load full .hbatz archive
    if (activeArtwork.fileName) {
      fetch(`/hunbatz-content/Projects/${encodeURIComponent(activeArtwork.fileName)}`)
        .then((res) => {
          if (!res.ok) throw new Error('File not found');
          return res.blob();
        })
        .then(async (blob) => {
          if (cancelled) return;
          if (blob.size > 0) {
            const { layers: unpackedLayers } = await importHbatzFile(blob);
            if (cancelled) return;
            if (unpackedLayers && unpackedLayers.length > 0) {
              artworkLayersCacheRef.current.set(
                activeArtwork.id,
                unpackedLayers.map(cloneLayerSnapshot)
              );
              setLayers(unpackedLayers);
              setActiveLayerId(unpackedLayers[unpackedLayers.length - 1]?.id || '');
              historyStackRef.current = [];
              redoStackRef.current = [];
              return;
            }
          }
          throw new Error('Empty archive');
        })
        .catch(() => {
          if (cancelled) return;
          loadFallbackLayers();
        });

      return () => {
        cancelled = true;
      };
    }

    loadFallbackLayers();
  }, [currentArtworkId]);

  // Persist current project to storage, memory cache, and Hunbatz local content/Projects/ as .HBATZ
  const saveCurrentArtwork = useCallback(() => {
    if (!activeArtwork || layers.length === 0) return;

    artworkLayersCacheRef.current.set(activeArtwork.id, layers.map(cloneLayerSnapshot));

    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 320;
    thumbCanvas.height = Math.round((320 * activeArtwork.height) / activeArtwork.width);
    const tCtx = thumbCanvas.getContext('2d');
    if (tCtx) {
      tCtx.imageSmoothingEnabled = true;
      tCtx.imageSmoothingQuality = 'high';
      const fullComp = renderFullArtworkCanvas(
        layers,
        activeArtwork.width,
        activeArtwork.height,
        backgroundColor
      );
      tCtx.drawImage(fullComp, 0, 0, thumbCanvas.width, thumbCanvas.height);
    }

    const updatedLayers = layers.map((l) => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      opacity: l.opacity,
      blendMode: l.blendMode,
      locked: l.locked,
      alphaLocked: l.alphaLocked,
      type: l.type,
      parentId: l.parentId,
      isExpanded: l.isExpanded,
      isVector: l.isVector,
      vectorPaths: l.vectorPaths,
      adjustmentConfig: l.adjustmentConfig,
      effects: l.effects,
      dataUrl: l.canvas.toDataURL(),
    }));

    const safeTitle = (activeArtwork.title || 'Artwork').replace(/[/\\?%*:|"<>]/g, '_').trim() || 'Artwork';
    const targetFileName = activeArtwork.fileName || `${safeTitle}.hbatz`;
    const cleanFileName = targetFileName.endsWith('.hbatz') ? targetFileName : `${targetFileName}.hbatz`;

    const updatedArtwork: ArtworkProject = {
      ...activeArtwork,
      fileName: cleanFileName,
      updatedAt: Date.now(),
      backgroundColor,
      thumbnailUrl: thumbCanvas.toDataURL('image/jpeg', 0.92),
      layers: updatedLayers,
      recordedStrokes,
    };

    setArtworks((prev) => {
      const next = prev.map((a) => (a.id === updatedArtwork.id ? updatedArtwork : a));
      try {
        localStorage.setItem('procreate_pc_projects', JSON.stringify(next));
      } catch {}
      return next;
    });

    if (!isSavingToDiskRef.current) {
      isSavingToDiskRef.current = true;
      saveProjectToLocalContent(updatedArtwork, layers, cleanFileName)
        .then((res) => {
          setArtworks((prev) =>
            prev.map((a) => (a.id === updatedArtwork.id ? { ...a, fileSize: res.size } : a))
          );
        })
        .catch((err) => {
          console.warn('Auto-save to Projects/ skipped or failed:', err);
        })
        .finally(() => {
          isSavingToDiskRef.current = false;
        });
    }
  }, [activeArtwork, layers, backgroundColor, recordedStrokes]);

  // Auto-save debounced
  useEffect(() => {
    const timer = setTimeout(() => {
      saveCurrentArtwork();
    }, 2000);
    return () => clearTimeout(timer);
  }, [saveCurrentArtwork]);

  // PASTE OBJECT ENGINE (Full Native Resolution & High-Quality Smoothing)
  const pasteImageAsLayer = useCallback(
    (
      imageInput: Blob | File | HTMLImageElement | HTMLCanvasElement | string,
      title?: string,
      customPosition?: { x: number; y: number }
    ) => {
      const processImage = (img: HTMLImageElement | HTMLCanvasElement) => {
        handlePushHistory();
        const canvasW = activeArtwork.width;
        const canvasH = activeArtwork.height;

        // Use exact native pixel dimensions for HTMLImageElement so pasted images stay 100% sharp
        const rawW = img instanceof HTMLImageElement ? (img.naturalWidth || img.width) : img.width;
        const rawH = img instanceof HTMLImageElement ? (img.naturalHeight || img.height) : img.height;

        let targetW = rawW;
        let targetH = rawH;
        let posX = 0;
        let posY = 0;

        if (customPosition) {
          posX = Math.round(customPosition.x);
          posY = Math.round(customPosition.y);
        } else {
          // Only scale down if the image is literally larger than the entire canvas itself (100% bounds)
          if (targetW > canvasW || targetH > canvasH) {
            const ratio = Math.min(canvasW / targetW, canvasH / targetH);
            targetW = Math.round(targetW * ratio);
            targetH = Math.round(targetH * ratio);
          }
          posX = Math.round((canvasW - targetW) / 2);
          posY = Math.round((canvasH - targetH) / 2);
        }

        const newId = `layer_pasted_${Date.now()}`;
        const layerName = title || `Pasted Object ${layers.length + 1}`;
        const newLayer = createLayer(newId, layerName, canvasW, canvasH);
        newLayer.ctx.imageSmoothingEnabled = true;
        newLayer.ctx.imageSmoothingQuality = 'high';
        newLayer.ctx.drawImage(img, posX, posY, targetW, targetH);

        const thumb = document.createElement('canvas');
        thumb.width = 64;
        thumb.height = 64;
        const thumbCtx = thumb.getContext('2d');
        if (thumbCtx) {
          thumbCtx.imageSmoothingEnabled = true;
          thumbCtx.imageSmoothingQuality = 'high';
          thumbCtx.drawImage(newLayer.canvas, 0, 0, 64, 64);
        }
        newLayer.thumbnailUrl = thumb.toDataURL();

        setLayers((prev) => {
          const activeIdx = prev.findIndex((l) => l.id === activeLayerId);
          if (activeIdx !== -1) {
            const copy = [...prev];
            copy.splice(activeIdx + 1, 0, newLayer);
            return copy;
          }
          return [...prev, newLayer];
        });
        setActiveLayerId(newId);
        setActiveTool('transform');
        showToast(
          title?.includes('Selection')
            ? 'Selection copied to new layer! Transform handles ready.'
            : `Image pasted at crisp ${targetW}×${targetH}px resolution!`
        );
      };

      if (typeof imageInput === 'string') {
        const img = new Image();
        img.onload = () => processImage(img);
        img.src = imageInput;
      } else if (imageInput instanceof HTMLCanvasElement) {
        processImage(imageInput);
      } else if (imageInput instanceof HTMLImageElement) {
        processImage(imageInput);
      } else if (imageInput instanceof Blob) {
        const url = URL.createObjectURL(imageInput);
        const img = new Image();
        img.onload = () => {
          processImage(img);
          URL.revokeObjectURL(url);
        };
        img.src = url;
      }
    },
    [activeArtwork, layers.length, activeLayerId, handlePushHistory, showToast]
  );

  // Global Clipboard Paste Listener (Ctrl+V with deduplication guard)
  useEffect(() => {
    let lastPasteTime = 0;
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const now = Date.now();
      if (now - lastPasteTime < 500) {
        e.preventDefault();
        return;
      }
      lastPasteTime = now;

      e.preventDefault();
      const items = e.clipboardData?.items;
      if (!items) return;

      let foundImage = false;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            foundImage = true;
            pasteImageAsLayer(file, 'Pasted Image');
            break;
          }
        }
      }

      if (!foundImage) {
        const text = e.clipboardData?.getData('text/plain');
        if (text && (text.startsWith('data:image/') || text.startsWith('<svg'))) {
          pasteImageAsLayer(text, 'Pasted Graphic');
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [pasteImageAsLayer]);

  // Copy Active Layer to Clipboard
  const handleCopyLayer = useCallback(() => {
    const activeLayer = layers.find((l) => l.id === activeLayerId);
    if (!activeLayer) return;
    activeLayer.canvas.toBlob((blob) => {
      if (blob && navigator.clipboard && window.ClipboardItem) {
        navigator.clipboard
          .write([new ClipboardItem({ 'image/png': blob })])
          .then(() => showToast('Layer copied to clipboard!'))
          .catch(() => showToast('Layer copied.'));
      } else {
        showToast('Layer copied.');
      }
    });
  }, [layers, activeLayerId, showToast]);

  // Copy Flattened Visible Canvas to Clipboard
  const handleCopyCanvas = useCallback(() => {
    const compCanvas = document.createElement('canvas');
    compCanvas.width = activeArtwork.width;
    compCanvas.height = activeArtwork.height;
    const ctx = compCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, compCanvas.width, compCanvas.height);
    layers.forEach((l) => {
      if (l.visible) {
        ctx.save();
        ctx.globalAlpha = l.opacity;
        ctx.globalCompositeOperation = getCanvasCompositeOperation(l.blendMode);
        ctx.drawImage(l.canvas, 0, 0);
        ctx.restore();
      }
    });

    compCanvas.toBlob((blob) => {
      if (blob && navigator.clipboard && window.ClipboardItem) {
        navigator.clipboard
          .write([new ClipboardItem({ 'image/png': blob })])
          .then(() => showToast('Canvas copied to clipboard!'))
          .catch(() => showToast('Canvas copied.'));
      } else {
        showToast('Canvas copied.');
      }
    });
  }, [activeArtwork, layers, backgroundColor, showToast]);

  // Cut Active Layer
  const handleCutLayer = useCallback(() => {
    handleCopyLayer();
    const activeLayer = layers.find((l) => l.id === activeLayerId);
    if (activeLayer) {
      handlePushHistory();
      activeLayer.ctx.clearRect(0, 0, activeArtwork.width, activeArtwork.height);
      activeLayer.thumbnailUrl = undefined;
      setLayers([...layers]);
      showToast('Layer cut to clipboard.');
    }
  }, [handleCopyLayer, layers, activeLayerId, activeArtwork, handlePushHistory, showToast]);

  // Paste from Clipboard via Button
  const handlePasteClipboard = useCallback(async () => {
    try {
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            pasteImageAsLayer(blob, 'Pasted Clipboard');
            return;
          }
        }
      }
      showToast('No image found in clipboard. Use Ctrl+V or copy an image first.');
    } catch {
      showToast('Use Ctrl+V to paste from your clipboard.');
    }
  }, [pasteImageAsLayer, showToast]);

  // Insert Photo file picker
  const handleInsertPhoto = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        pasteImageAsLayer(file, file.name.replace(/\.[^/.]+$/, ''));
      }
    },
    [pasteImageAsLayer]
  );

  const handleDeleteLayer = useCallback(
    (id: string) => {
      if (layers.length <= 1) return;
      handlePushHistory();
      const filtered = layers.filter((l) => l.id !== id);
      setLayers(filtered);
      if (editingSmartLayerId === id) {
        setEditingSmartLayerId(null);
      }
      if (activeLayerId === id) {
        setActiveLayerId(filtered[filtered.length - 1].id);
      }
    },
    [layers, activeLayerId, editingSmartLayerId, handlePushHistory]
  );

  const handleMergeDown = useCallback(
    (id: string) => {
      const idx = layers.findIndex((l) => l.id === id);
      if (idx <= 0) {
        showToast('No layer below to merge into');
        return;
      }
      handlePushHistory();
      const top = layers[idx];
      const bottom = layers[idx - 1];

      if (top.type === 'group') {
        const groupChildren = layers.filter((l) => l.parentId === top.id && l.visible);
        const groupBuf = document.createElement('canvas');
        groupBuf.width = activeArtwork.width;
        groupBuf.height = activeArtwork.height;
        const gCtx = groupBuf.getContext('2d')!;

        groupChildren.forEach((cl) => {
          const clCanvas =
            cl.effects && hasActiveEffects(cl.effects)
              ? renderLayerEffectsToCanvas(cl.canvas, cl.effects)
              : cl.canvas;
          const tempCl = document.createElement('canvas');
          tempCl.width = activeArtwork.width;
          tempCl.height = activeArtwork.height;
          const tCtx = tempCl.getContext('2d')!;
          tCtx.drawImage(clCanvas, 0, 0);
          if (cl.mask && cl.mask.visible) {
            applyProcessedMask(tCtx, cl.mask, activeArtwork.width, activeArtwork.height);
          }
          gCtx.save();
          gCtx.globalAlpha = cl.opacity;
          gCtx.globalCompositeOperation = getCanvasCompositeOperation(cl.blendMode);
          gCtx.drawImage(tempCl, 0, 0);
          gCtx.restore();
        });

        let finalGroupCanvas = groupBuf;
        if (top.effects && hasActiveEffects(top.effects)) {
          finalGroupCanvas = renderLayerEffectsToCanvas(groupBuf, top.effects);
        }

        if (top.mask && top.mask.visible) {
          const resCtx = finalGroupCanvas.getContext('2d')!;
          applyProcessedMask(resCtx, top.mask, activeArtwork.width, activeArtwork.height);
        }

        bottom.ctx.save();
        bottom.ctx.globalAlpha = top.opacity;
        bottom.ctx.globalCompositeOperation = getCanvasCompositeOperation(top.blendMode);
        bottom.ctx.drawImage(finalGroupCanvas, 0, 0);
        bottom.ctx.restore();

        const childIds = new Set(groupChildren.map((c) => c.id));
        const nextLayers = layers.filter((l) => l.id !== top.id && !childIds.has(l.id));
        setLayers(nextLayers);
      } else if (top.type === 'adjustment' && top.adjustmentConfig) {
        const processed = renderFastAdjustmentLayer(bottom.canvas, top.adjustmentConfig);
        const temp = document.createElement('canvas');
        temp.width = activeArtwork.width;
        temp.height = activeArtwork.height;
        const tCtx = temp.getContext('2d')!;
        tCtx.drawImage(processed, 0, 0);
        if (top.mask && top.mask.visible) {
          applyProcessedMask(tCtx, top.mask, activeArtwork.width, activeArtwork.height);
        }
        bottom.ctx.save();
        bottom.ctx.globalAlpha = top.opacity;
        bottom.ctx.globalCompositeOperation = getCanvasCompositeOperation(top.blendMode);
        bottom.ctx.drawImage(temp, 0, 0);
        bottom.ctx.restore();

        const nextLayers = layers.filter((_, i) => i !== idx);
        setLayers(nextLayers);
      } else {
        const topCanvas =
          top.effects && hasActiveEffects(top.effects)
            ? renderLayerEffectsToCanvas(top.canvas, top.effects)
            : top.canvas;
        const temp = document.createElement('canvas');
        temp.width = activeArtwork.width;
        temp.height = activeArtwork.height;
        const tCtx = temp.getContext('2d')!;
        tCtx.drawImage(topCanvas, 0, 0);
        if (top.mask && top.mask.visible) {
          applyProcessedMask(tCtx, top.mask, activeArtwork.width, activeArtwork.height);
        }
        bottom.ctx.save();
        bottom.ctx.globalAlpha = top.opacity;
        bottom.ctx.globalCompositeOperation = getCanvasCompositeOperation(top.blendMode);
        bottom.ctx.drawImage(temp, 0, 0);
        bottom.ctx.restore();

        const nextLayers = layers.filter((_, i) => i !== idx);
        setLayers(nextLayers);
      }

      const thumb = document.createElement('canvas');
      thumb.width = 64;
      thumb.height = 64;
      thumb.getContext('2d')?.drawImage(bottom.canvas, 0, 0, 64, 64);
      bottom.thumbnailUrl = thumb.toDataURL();

      setActiveLayerId(bottom.id);
      showToast(`Merged "${top.name}" into "${bottom.name}"`);
    },
    [layers, activeArtwork.width, activeArtwork.height, handlePushHistory, showToast]
  );

  const handleDuplicateLayer = useCallback(
    (id: string) => {
      const target = layers.find((l) => l.id === id);
      if (!target) return;
      handlePushHistory();
      const newId = `layer_${Date.now()}`;
      const dup = createLayer(
        newId,
        `${target.name} Copy`,
        activeArtwork.width,
        activeArtwork.height,
        {
          visible: target.visible,
          opacity: target.opacity,
          blendMode: target.blendMode,
          locked: false,
          alphaLocked: target.alphaLocked,
          type: target.type,
          isVector: target.isVector,
          vectorPaths: target.vectorPaths
            ? JSON.parse(JSON.stringify(target.vectorPaths))
            : undefined,
          effects: target.effects ? JSON.parse(JSON.stringify(target.effects)) : undefined,
          adjustmentConfig: target.adjustmentConfig
            ? JSON.parse(JSON.stringify(target.adjustmentConfig))
            : undefined,
        }
      );
      dup.ctx.drawImage(target.canvas, 0, 0);
      dup.thumbnailUrl = target.thumbnailUrl;

      if (target.mask) {
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = activeArtwork.width;
        maskCanvas.height = activeArtwork.height;
        const mCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
        if (mCtx) {
          mCtx.drawImage(target.mask.canvas, 0, 0);
          dup.mask = {
            id: `mask_${Date.now()}`,
            canvas: maskCanvas,
            ctx: mCtx,
            visible: target.mask.visible,
            locked: target.mask.locked,
            density: target.mask.density,
            feather: target.mask.feather,
            thumbnailUrl: target.mask.thumbnailUrl,
          };
        }
      }

      if (target.type === 'group') {
        const groupChildren = layers.filter((l) => l.parentId === id);
        const dupChildren = groupChildren.map((c, i) => {
          const cId = `layer_${Date.now()}_child_${i}`;
          const cDup = createLayer(
            cId,
            `${c.name} Copy`,
            activeArtwork.width,
            activeArtwork.height,
            {
              visible: c.visible,
              opacity: c.opacity,
              blendMode: c.blendMode,
              locked: false,
              alphaLocked: c.alphaLocked,
              type: c.type,
              parentId: newId,
              isVector: c.isVector,
              vectorPaths: c.vectorPaths ? JSON.parse(JSON.stringify(c.vectorPaths)) : undefined,
              effects: c.effects ? JSON.parse(JSON.stringify(c.effects)) : undefined,
              adjustmentConfig: c.adjustmentConfig ? JSON.parse(JSON.stringify(c.adjustmentConfig)) : undefined,
            }
          );
          cDup.ctx.drawImage(c.canvas, 0, 0);
          cDup.thumbnailUrl = c.thumbnailUrl;
          if (c.mask) {
            const mC = document.createElement('canvas');
            mC.width = activeArtwork.width;
            mC.height = activeArtwork.height;
            const mCtx = mC.getContext('2d');
            if (mCtx) {
              mCtx.drawImage(c.mask.canvas, 0, 0);
              cDup.mask = {
                id: `mask_${Date.now()}_child_${i}`,
                canvas: mC,
                ctx: mCtx,
                visible: c.mask.visible,
                locked: c.mask.locked,
                density: c.mask.density,
                feather: c.mask.feather,
                thumbnailUrl: c.mask.thumbnailUrl,
              };
            }
          }
          return cDup;
        });

        const idx = layers.findIndex((l) => l.id === id);
        const newLayers = [...layers];
        newLayers.splice(idx + 1, 0, ...dupChildren, dup);
        setLayers(newLayers);
        setActiveLayerId(newId);
        showToast(`Duplicated group "${target.name}" and contents`);
        return;
      }

      if (target.type === 'smart' && target.smartLayers) {
        dup.type = 'smart';
        dup.smartLayers = target.smartLayers.map((sl) => cloneSubLayer(sl));
        if (target.smartFilters) {
          dup.smartFilters = target.smartFilters.map((sf) => ({
            ...sf,
            id: `sf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            params: {
              ...sf.params,
              customLut: sf.params.customLut ? new Uint8Array(sf.params.customLut) : undefined,
              extraConfig: sf.params.extraConfig ? JSON.parse(JSON.stringify(sf.params.extraConfig)) : undefined,
            },
          }));
        }
        renderSmartLayerCanvas(dup, activeArtwork.width, activeArtwork.height);
      }

      const idx = layers.findIndex((l) => l.id === id);
      const newLayers = [...layers];
      newLayers.splice(idx + 1, 0, dup);
      setLayers(newLayers);
      setActiveLayerId(newId);
    },
    [layers, activeArtwork.width, activeArtwork.height, handlePushHistory, showToast]
  );

  // Keyboard Shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        if (activeLayerId) {
          const target = layers.find((l) => l.id === activeLayerId);
          handleDuplicateLayer(activeLayerId);
          if (target) {
            showToast(`Duplicated layer "${target.name}"`);
          }
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        if (activeLayerId) {
          handleMergeDown(activeLayerId);
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (activeLayerId) {
          handleGroupSelectedLayers([activeLayerId]);
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        if (e.shiftKey) {
          handleCopyCanvas();
        } else {
          handleCopyLayer();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        handleCutLayer();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Del') {
        if (layers.length > 1 && activeLayerId) {
          e.preventDefault();
          const target = layers.find((l) => l.id === activeLayerId);
          handleDeleteLayer(activeLayerId);
          if (target) {
            showToast(`Deleted layer "${target.name}"`);
          }
        } else if (layers.length <= 1) {
          showToast('Cannot delete the only remaining layer');
        }
        return;
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            setActiveTool('brush');
            break;
          case 'e':
            setActiveTool('eraser');
            if (activeLayerId) {
              const activeL = layers.find((l) => l.id === activeLayerId);
              if (activeL?.type === 'vector') {
                setVectorLayerConfig((prev) => ({ ...prev, editMode: 'eraser_intersect' }));
              }
            }
            break;
          case 's':
            setActiveTool('smudge');
            break;
          case 'v':
            setActiveTool('transform');
            break;
          case 'q':
            setIsQuickMenuOpen((prev) => !prev);
            break;
          case 'i':
            setIsEyedropperActive((prev) => !prev);
            break;
          case 'l':
            setIsLayersOpen((prev) => !prev);
            break;
          case 'c':
            setIsColorStudioOpen((prev) => !prev);
            break;
          case '[':
            setBrushSize((s) => {
              const next = Math.max(1, Math.min(400, s - 5));
              setActiveBrush((prev) => ({ ...prev, size: next, baseSize: next }));
              return next;
            });
            break;
          case ']':
            setBrushSize((s) => {
              const next = Math.max(1, Math.min(400, s + 5));
              setActiveBrush((prev) => ({ ...prev, size: next, baseSize: next }));
              return next;
            });
            break;
          case 'tab':
            e.preventDefault();
            setIsZenMode((prev) => !prev);
            break;
          case 'enter':
            if (activeTool === 'transform' || activeTool === 'select') {
              setActiveTool('brush');
            }
            break;
          case 'escape':
            setLayerEffectsTargetId(null);
            setActiveAdjustment(null);
            setIsShapesOpen(false);
            setIsQuickMenuOpen(false);
            setIsJiggleEditMode(false);
            setIsCommandPaletteOpen(false);
            setIsActionsOpen(false);
            setIsPrefsTabActive(false);
            setIsBrushLibraryOpen(false);
            setIsLayersOpen(false);
            setIsColorStudioOpen(false);
            setIsEyedropperActive(false);
            if (activeTool === 'transform' || activeTool === 'select') {
              setActiveTool('brush');
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleUndo,
    handleRedo,
    handleMergeDown,
    handleCopyLayer,
    handleCopyCanvas,
    handleCutLayer,
    handleDeleteLayer,
    handleDuplicateLayer,
    layers,
    activeLayerId,
    showToast,
    activeTool,
  ]);

  // Color change with previous color memory
  const handleColorChange = (hex: string) => {
    if (hex !== currentColor) {
      setPreviousColor(currentColor);
      setCurrentColor(hex);
      setVectorShapeConfig((prev) => ({ ...prev, strokeColor: hex }));
    }
  };

  // Layer Operations
  const handleAddLayer = () => {
    handlePushHistory();
    const newId = `layer_${Date.now()}`;
    const newL = createLayer(
      newId,
      `Layer ${layers.length + 1}`,
      activeArtwork.width,
      activeArtwork.height
    );
    setLayers((prev) => [...prev, newL]);
    setActiveLayerId(newId);
  };

  const handleAddVectorLayer = () => {
    handlePushHistory();
    const newId = `layer_vec_${Date.now()}`;
    const newL = createLayer(
      newId,
      `Vector ${layers.filter((l) => l.isVector || l.type === 'vector').length + 1}`,
      activeArtwork.width,
      activeArtwork.height,
      {
        type: 'vector',
        isVector: true,
        vectorPaths: [],
      }
    );
    setLayers((prev) => [...prev, newL]);
    setActiveLayerId(newId);
    setActiveMaskLayerId(null);
    showToast('Created Vector Layer for Lineart (Draw & Sculpt Paths)');
  };

  const handleAddGroup = () => {
    handlePushHistory();
    const groupCount = layers.filter((l) => l.type === 'group').length + 1;
    const newId = `group_${Date.now()}`;
    const newG = createLayer(
      newId,
      `Group ${groupCount}`,
      activeArtwork.width,
      activeArtwork.height,
      {
        type: 'group',
        isExpanded: true,
      }
    );
    setLayers((prev) => [...prev, newG]);
    setActiveLayerId(newId);
    showToast(`Created Layer Group: ${newG.name}`);
  };

  const handleToggleExpandGroup = (groupId: string) => {
    setLayers((prev) =>
      prev.map((l) =>
        l.id === groupId
          ? { ...l, isExpanded: l.isExpanded === false ? true : false }
          : l
      )
    );
  };

  // Layer Mask handlers
  const handleSelectLayerMask = (layerId: string) => {
    setActiveMaskLayerId(layerId);
    showToast('Editing Layer Mask: Paint with black/eraser to hide, white to reveal');
  };

  const handleAddLayerMask = (layerId: string) => {
    const target = layers.find((l) => l.id === layerId);
    if (!target) return;
    handlePushHistory();
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = activeArtwork.width;
    maskCanvas.height = activeArtwork.height;
    const mCtx = maskCanvas.getContext('2d', { willReadFrequently: true })!;

    if (currentSelection?.isActive && currentSelection.maskCanvas) {
      mCtx.fillStyle = '#000000';
      mCtx.fillRect(0, 0, activeArtwork.width, activeArtwork.height);
      mCtx.drawImage(currentSelection.maskCanvas, 0, 0);
      setClearSelectionSignal((s) => s + 1);
      setCurrentSelection(null);
      showToast(`Created Layer Mask from selection for "${target.name}"`);
    } else {
      mCtx.fillStyle = '#ffffff';
      mCtx.fillRect(0, 0, activeArtwork.width, activeArtwork.height);
      showToast(`Added Layer Mask to "${target.name}"`);
    }

    const thumb = document.createElement('canvas');
    thumb.width = 64;
    thumb.height = 64;
    thumb.getContext('2d')?.drawImage(maskCanvas, 0, 0, 64, 64);

    target.mask = {
      id: `mask_${Date.now()}`,
      canvas: maskCanvas,
      ctx: mCtx,
      visible: true,
      locked: false,
      thumbnailUrl: thumb.toDataURL(),
      density: 100,
      feather: 0,
    };

    setLayers([...layers]);
    setActiveMaskLayerId(layerId);
  };

  const handleChangeMaskProperties = (
    layerId: string,
    properties: { density?: number; feather?: number }
  ) => {
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id === layerId && l.mask) {
          return {
            ...l,
            mask: {
              ...l.mask,
              ...(properties.density !== undefined ? { density: properties.density } : {}),
              ...(properties.feather !== undefined ? { feather: properties.feather } : {}),
            },
          };
        }
        return l;
      })
    );
  };

  const handleInvertMask = (layerId: string) => {
    const target = layers.find((l) => l.id === layerId);
    if (!target || !target.mask) return;
    handlePushHistory();
    const maskCanvas = target.mask.canvas;
    const mCtx = maskCanvas.getContext('2d');
    if (mCtx) {
      const imgData = mCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = 255 - d[i];
        d[i + 1] = 255 - d[i + 1];
        d[i + 2] = 255 - d[i + 2];
      }
      mCtx.putImageData(imgData, 0, 0);

      const thumb = document.createElement('canvas');
      thumb.width = 64;
      thumb.height = 64;
      thumb.getContext('2d')?.drawImage(maskCanvas, 0, 0, 64, 64);
      target.mask.thumbnailUrl = thumb.toDataURL();
    }
    setLayers([...layers]);
    showToast(`Inverted mask for "${target.name}"`);
  };

  const handleResetMask = (layerId: string) => {
    const target = layers.find((l) => l.id === layerId);
    if (!target || !target.mask) return;
    handlePushHistory();
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id === layerId && l.mask) {
          return {
            ...l,
            mask: {
              ...l.mask,
              density: 100,
              feather: 0,
            },
          };
        }
        return l;
      })
    );
    showToast(`Reset mask properties for "${target.name}"`);
  };

  const handleDeleteLayerMask = (layerId: string) => {
    const target = layers.find((l) => l.id === layerId);
    if (!target || !target.mask) return;
    handlePushHistory();
    target.mask = undefined;
    if (activeMaskLayerId === layerId) {
      setActiveMaskLayerId(null);
    }
    setLayers([...layers]);
    showToast(`Removed mask from "${target.name}"`);
  };

  const handleToggleMaskVisibility = (layerId: string) => {
    const target = layers.find((l) => l.id === layerId);
    if (!target || !target.mask) return;
    handlePushHistory();
    target.mask.visible = !target.mask.visible;
    setLayers([...layers]);
  };

  const handleGroupSelectedLayers = (selectedIds: string[]) => {
    const validIds = selectedIds.filter((id) => layers.some((l) => l.id === id));
    if (validIds.length === 0) return;
    handlePushHistory();

    const groupCount = layers.filter((l) => l.type === 'group').length + 1;
    const newId = `group_${Date.now()}`;
    const newGroup = createLayer(
      newId,
      `Group ${groupCount}`,
      activeArtwork.width,
      activeArtwork.height,
      {
        type: 'group',
        isExpanded: true,
      }
    );

    const indices = validIds.map((id) => layers.findIndex((l) => l.id === id)).sort((a, b) => a - b);
    const highestIdx = indices[indices.length - 1];

    const selectedLayers = validIds.map((id) => {
      const found = layers.find((l) => l.id === id)!;
      return { ...found, parentId: newId };
    });

    const remaining = layers.filter((l) => !validIds.includes(l.id));
    const insertIdx = remaining.findIndex((l) => layers.indexOf(l) > highestIdx);
    const targetPos = insertIdx === -1 ? remaining.length : insertIdx;

    const newLayers = [...remaining];
    newLayers.splice(targetPos, 0, ...selectedLayers, newGroup);

    setLayers(newLayers);
    setActiveLayerId(newId);
    showToast(`Grouped ${validIds.length} layers into ${newGroup.name}`);
  };

  // Photoshop-Parity Smart Layers & Flattening Handlers
  const handleConvertToSmartLayer = (targetId: string) => {
    handlePushHistory();
    const target = layers.find((l) => l.id === targetId);
    if (!target) return;

    if (target.type === 'group') {
      const groupChildren = layers.filter((l) => l.parentId === target.id);
      const smartLayer = convertGroupToSmartLayer(
        target,
        groupChildren,
        activeArtwork.width,
        activeArtwork.height
      );
      const childIds = new Set(groupChildren.map((c) => c.id));
      const targetIdx = layers.findIndex((l) => l.id === target.id);
      const nextLayers = layers.filter((l) => l.id !== target.id && !childIds.has(l.id));
      nextLayers.splice(targetIdx, 0, smartLayer);
      setLayers(nextLayers);
      setActiveLayerId(smartLayer.id);
      showToast(`Converted Group "${target.name}" into Smart Layer (Photoshop-style)`);
    } else {
      const smartLayer = convertLayersToSmartLayer(
        [target],
        activeArtwork.width,
        activeArtwork.height
      );
      const targetIdx = layers.findIndex((l) => l.id === target.id);
      const nextLayers = [...layers];
      nextLayers.splice(targetIdx, 1, smartLayer);
      setLayers(nextLayers);
      setActiveLayerId(smartLayer.id);
      showToast(`Converted "${target.name}" into Smart Layer`);
    }
  };

  const handleUnpackSmartLayer = (smartLayerId: string) => {
    const smartLayer = layers.find((l) => l.id === smartLayerId);
    if (!smartLayer || smartLayer.type !== 'smart') return;
    handlePushHistory();

    const { group, childLayers } = unpackSmartLayerToGroup(
      smartLayer,
      activeArtwork.width,
      activeArtwork.height
    );
    const targetIdx = layers.findIndex((l) => l.id === smartLayerId);
    const nextLayers = [...layers];
    nextLayers.splice(targetIdx, 1, ...childLayers, group);

    if (editingSmartLayerId === smartLayerId) {
      setEditingSmartLayerId(null);
    }
    setLayers(nextLayers);
    setActiveLayerId(group.id);
    showToast(`Unpacked Smart Layer into Group "${group.name}"`);
  };

  const handleFlattenGroup = (groupId: string) => {
    const group = layers.find((l) => l.id === groupId);
    if (!group) return;
    handlePushHistory();

    const groupChildren = layers.filter((l) => l.parentId === groupId);
    const flatLayer = flattenGroupToRasterLayer(
      group,
      groupChildren,
      activeArtwork.width,
      activeArtwork.height
    );
    const childIds = new Set(groupChildren.map((c) => c.id));
    const targetIdx = layers.findIndex((l) => l.id === groupId);
    const nextLayers = layers.filter((l) => l.id !== groupId && !childIds.has(l.id));
    nextLayers.splice(targetIdx, 0, flatLayer);

    setLayers(nextLayers);
    setActiveLayerId(flatLayer.id);
    showToast(`Flattened Group "${group.name}" to single image layer`);
  };

  const handleFlattenSmartLayer = (smartLayerId: string) => {
    const smartLayer = layers.find((l) => l.id === smartLayerId);
    if (!smartLayer) return;
    handlePushHistory();

    const flatLayer = flattenSmartLayerToRasterLayer(
      smartLayer,
      activeArtwork.width,
      activeArtwork.height
    );
    const targetIdx = layers.findIndex((l) => l.id === smartLayerId);
    const nextLayers = [...layers];
    nextLayers.splice(targetIdx, 1, flatLayer);

    if (editingSmartLayerId === smartLayerId) {
      setEditingSmartLayerId(null);
    }
    setLayers(nextLayers);
    setActiveLayerId(flatLayer.id);
    showToast(`Flattened Smart Layer "${smartLayer.name}" to single image layer`);
  };

  const handleFlattenAllLayers = () => {
    if (layers.length === 0) return;
    handlePushHistory();

    const flatLayer = flattenAllLayersToRasterLayer(
      layers,
      activeArtwork.width,
      activeArtwork.height,
      backgroundColor
    );
    setEditingSmartLayerId(null);
    setLayers([flatLayer]);
    setActiveLayerId(flatLayer.id);
    showToast('Flattened entire image (all visible layers) into a single layer');
  };

  const handleEditSmartLayerContents = (smartLayerId: string) => {
    const target = layers.find((l) => l.id === smartLayerId);
    if (!target) return;
    if (!target.smartLayers || target.smartLayers.length === 0) {
      const sub = createLayer(
        `sub_${Date.now()}_flats`,
        'Color Flats 1',
        activeArtwork.width,
        activeArtwork.height
      );
      sub.ctx.drawImage(target.canvas, 0, 0);
      target.smartLayers = [sub];
      target.activeSmartSubLayerId = sub.id;
    }
    setEditingSmartLayerId(smartLayerId);
    setActiveLayerId(smartLayerId);
    showToast(`Opened Smart Layer "${target.name}" for coloring & animation`);
  };

  const handleSelectSmartSubLayer = (smartLayerId: string, subLayerId: string) => {
    setLayers((prev) =>
      prev.map((l) =>
        l.id === smartLayerId
          ? { ...l, activeSmartSubLayerId: subLayerId }
          : l
      )
    );
  };

  const handleAddSmartSubLayer = (smartLayerId: string, name: string, isVector = false) => {
    handlePushHistory();
    const target = layers.find((l) => l.id === smartLayerId);
    if (!target) return;

    const newSub = createLayer(
      `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      activeArtwork.width,
      activeArtwork.height,
      {
        type: isVector ? 'vector' : 'raster',
        isVector,
        vectorPaths: isVector ? [] : undefined,
      }
    );

    const subList = [...(target.smartLayers || []), newSub];
    target.smartLayers = subList;
    target.activeSmartSubLayerId = newSub.id;
    renderSmartLayerCanvas(target, activeArtwork.width, activeArtwork.height);
    setLayers([...layers]);
    showToast(`Added sub-layer "${name}" to ${target.name}`);
  };

  const handleDuplicateSmartSubLayer = (smartLayerId: string, subLayerId: string) => {
    handlePushHistory();
    const target = layers.find((l) => l.id === smartLayerId);
    if (!target || !target.smartLayers) return;
    const sub = target.smartLayers.find((s) => s.id === subLayerId);
    if (!sub) return;

    const dup = cloneSubLayer(sub);
    dup.name = `${sub.name} Copy`;
    const idx = target.smartLayers.findIndex((s) => s.id === subLayerId);
    target.smartLayers.splice(idx + 1, 0, dup);
    target.activeSmartSubLayerId = dup.id;
    renderSmartLayerCanvas(target, activeArtwork.width, activeArtwork.height);
    setLayers([...layers]);
    showToast(`Duplicated sub-layer "${sub.name}"`);
  };

  const handleDeleteSmartSubLayer = (smartLayerId: string, subLayerId: string) => {
    handlePushHistory();
    const target = layers.find((l) => l.id === smartLayerId);
    if (!target || !target.smartLayers || target.smartLayers.length <= 1) {
      showToast('Smart Layer must have at least one sub-layer');
      return;
    }
    target.smartLayers = target.smartLayers.filter((s) => s.id !== subLayerId);
    if (target.activeSmartSubLayerId === subLayerId) {
      target.activeSmartSubLayerId = target.smartLayers[0]?.id;
    }
    renderSmartLayerCanvas(target, activeArtwork.width, activeArtwork.height);
    setLayers([...layers]);
    showToast('Deleted sub-layer');
  };

  const handleMoveSmartSubLayer = (
    smartLayerId: string,
    subLayerId: string,
    direction: 'up' | 'down'
  ) => {
    const target = layers.find((l) => l.id === smartLayerId);
    if (!target || !target.smartLayers) return;
    const idx = target.smartLayers.findIndex((s) => s.id === subLayerId);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx + 1 : idx - 1;
    if (targetIdx < 0 || targetIdx >= target.smartLayers.length) return;
    handlePushHistory();

    const [moved] = target.smartLayers.splice(idx, 1);
    target.smartLayers.splice(targetIdx, 0, moved);
    renderSmartLayerCanvas(target, activeArtwork.width, activeArtwork.height);
    setLayers([...layers]);
  };

  const handleToggleSmartSubLayerVisibility = (smartLayerId: string, subLayerId: string) => {
    const target = layers.find((l) => l.id === smartLayerId);
    if (!target || !target.smartLayers) return;
    handlePushHistory();
    const sub = target.smartLayers.find((s) => s.id === subLayerId);
    if (sub) {
      sub.visible = !sub.visible;
      renderSmartLayerCanvas(target, activeArtwork.width, activeArtwork.height);
      setLayers([...layers]);
    }
  };

  const handleChangeSmartSubLayerOpacity = (
    smartLayerId: string,
    subLayerId: string,
    opacity: number
  ) => {
    const target = layers.find((l) => l.id === smartLayerId);
    if (!target || !target.smartLayers) return;
    const sub = target.smartLayers.find((s) => s.id === subLayerId);
    if (sub) {
      sub.opacity = opacity;
      renderSmartLayerCanvas(target, activeArtwork.width, activeArtwork.height);
      setLayers([...layers]);
    }
  };

  const handleChangeSmartSubLayerBlendMode = (
    smartLayerId: string,
    subLayerId: string,
    mode: BlendMode
  ) => {
    handlePushHistory();
    const target = layers.find((l) => l.id === smartLayerId);
    if (!target || !target.smartLayers) return;
    const sub = target.smartLayers.find((s) => s.id === subLayerId);
    if (sub) {
      sub.blendMode = mode;
      renderSmartLayerCanvas(target, activeArtwork.width, activeArtwork.height);
      setLayers([...layers]);
    }
  };

  const handleFillSmartSubLayer = (smartLayerId: string, subLayerId: string, color: string) => {
    handlePushHistory();
    const target = layers.find((l) => l.id === smartLayerId);
    if (!target || !target.smartLayers) return;
    const sub = target.smartLayers.find((s) => s.id === subLayerId);
    if (sub) {
      sub.ctx.fillStyle = color;
      sub.ctx.fillRect(0, 0, activeArtwork.width, activeArtwork.height);
      renderSmartLayerCanvas(target, activeArtwork.width, activeArtwork.height);
      setLayers([...layers]);
      showToast(`Filled sub-layer "${sub.name}" with ${color}`);
    }
  };

  const handleClearSmartSubLayer = (smartLayerId: string, subLayerId: string) => {
    handlePushHistory();
    const target = layers.find((l) => l.id === smartLayerId);
    if (!target || !target.smartLayers) return;
    const sub = target.smartLayers.find((s) => s.id === subLayerId);
    if (sub) {
      sub.ctx.clearRect(0, 0, activeArtwork.width, activeArtwork.height);
      renderSmartLayerCanvas(target, activeArtwork.width, activeArtwork.height);
      setLayers([...layers]);
      showToast(`Cleared sub-layer "${sub.name}"`);
    }
  };

  const handleRenameSmartSubLayer = (smartLayerId: string, subLayerId: string, newName: string) => {
    const target = layers.find((l) => l.id === smartLayerId);
    if (!target || !target.smartLayers) return;
    const sub = target.smartLayers.find((s) => s.id === subLayerId);
    if (sub) {
      sub.name = newName;
      setLayers([...layers]);
    }
  };

  const handleToggleSmartSubLayerLock = (smartLayerId: string, subLayerId: string) => {
    const target = layers.find((l) => l.id === smartLayerId);
    if (!target || !target.smartLayers) return;
    const sub = target.smartLayers.find((s) => s.id === subLayerId);
    if (sub) {
      sub.locked = !sub.locked;
      setLayers([...layers]);
    }
  };

  const handleMergeDownSmartSubLayer = (smartLayerId: string, subLayerId: string) => {
    const target = layers.find((l) => l.id === smartLayerId);
    if (!target || !target.smartLayers || target.smartLayers.length <= 1) return;
    const idx = target.smartLayers.findIndex((s) => s.id === subLayerId);
    if (idx <= 0) return;
    handlePushHistory();

    const topSub = target.smartLayers[idx];
    const bottomSub = target.smartLayers[idx - 1];
    bottomSub.ctx.save();
    bottomSub.ctx.globalAlpha = topSub.opacity;
    bottomSub.ctx.globalCompositeOperation = getCanvasCompositeOperation(topSub.blendMode);
    bottomSub.ctx.drawImage(topSub.canvas, 0, 0);
    bottomSub.ctx.restore();

    target.smartLayers.splice(idx, 1);
    target.activeSmartSubLayerId = bottomSub.id;
    renderSmartLayerCanvas(target, activeArtwork.width, activeArtwork.height);
    setLayers([...layers]);
    showToast(`Merged down "${topSub.name}"`);
  };

  const handleRasterizeSmartSubLayer = (smartLayerId: string, subLayerId: string) => {
    const target = layers.find((l) => l.id === smartLayerId);
    if (!target || !target.smartLayers) return;
    const sub = target.smartLayers.find((s) => s.id === subLayerId);
    if (sub && sub.type === 'vector') {
      handlePushHistory();
      sub.type = 'raster';
      sub.isVector = false;
      delete sub.vectorPaths;
      renderSmartLayerCanvas(target, activeArtwork.width, activeArtwork.height);
      setLayers([...layers]);
      showToast(`Rasterized sub-layer "${sub.name}"`);
    }
  };

  const handleToggleSmartFilter = (layerId: string, filterId: string) => {
    const target = layers.find((l) => l.id === layerId);
    if (!target) return;
    handlePushHistory();
    toggleSmartFilterInLayer(target, filterId, activeArtwork.width, activeArtwork.height);
    setLayers([...layers]);
  };

  const handleToggleAllSmartFilters = (layerId: string) => {
    const target = layers.find((l) => l.id === layerId);
    if (!target) return;
    handlePushHistory();
    toggleAllSmartFiltersInLayer(target, activeArtwork.width, activeArtwork.height);
    setLayers([...layers]);
  };

  const handleReorderSmartFilter = (layerId: string, filterId: string, direction: 'up' | 'down') => {
    const target = layers.find((l) => l.id === layerId);
    if (!target) return;
    handlePushHistory();
    reorderSmartFilterInLayer(target, filterId, direction, activeArtwork.width, activeArtwork.height);
    setLayers([...layers]);
  };

  const handleDeleteSmartFilter = (layerId: string, filterId: string) => {
    const target = layers.find((l) => l.id === layerId);
    if (!target) return;
    handlePushHistory();
    removeSmartFilterFromLayer(target, filterId, activeArtwork.width, activeArtwork.height);
    setLayers([...layers]);
    showToast('Deleted Smart Filter');
  };

  const handleEditSmartFilter = (layerId: string, filter: SmartFilter) => {
    setActiveLayerId(layerId);
    setEditingSmartFilter({ layerId, filterId: filter.id, filter });
    setActiveAdjustment(filter.type);
  };

  const handleAddSmartFilter = (layerId: string, type: ActiveAdjustment) => {
    setActiveLayerId(layerId);
    setEditingSmartFilter(null);
    setActiveAdjustment(type);
  };

  const handleToggleExpandSmartFilters = (layerId: string) => {
    setLayers((prev) =>
      prev.map((l) =>
        l.id === layerId ? { ...l, smartFiltersExpanded: l.smartFiltersExpanded === false ? true : false } : l
      )
    );
  };

  // All new Adjustment Layers initialized with rich sensible defaults
  const handleAddAdjustmentLayer = (type: AdjustmentLayerConfig['type']) => {
    handlePushHistory();
    const newId = `adj_${Date.now()}`;
    const name = type.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    let initialSettings: Record<string, any> = { amount: 0, val2: 0, val3: 0 };
    switch (type) {
      case 'gradient_map':
        initialSettings = {
          stops: GRADIENT_MAP_PRESETS[0].stops,
          shift: 0,
          repeat: 1,
          reverse: false,
          opacity: 1,
        };
        break;
      case 'selective_color':
        initialSettings = {
          channel: 'reds',
          method: 'relative',
          tolerance: 25,
          channels: {
            reds: { cyan: 0, magenta: 0, yellow: 0, black: 0 },
            yellows: { cyan: 0, magenta: 0, yellow: 0, black: 0 },
            greens: { cyan: 0, magenta: 0, yellow: 0, black: 0 },
            cyans: { cyan: 0, magenta: 0, yellow: 0, black: 0 },
            blues: { cyan: 0, magenta: 0, yellow: 0, black: 0 },
            magentas: { cyan: 0, magenta: 0, yellow: 0, black: 0 },
            whites: { cyan: 0, magenta: 0, yellow: 0, black: 0 },
            neutrals: { cyan: 0, magenta: 0, yellow: 0, black: 0 },
            blacks: { cyan: 0, magenta: 0, yellow: 0, black: 0 },
            custom: { cyan: 0, magenta: 0, yellow: 0, black: 0 },
          },
        };
        break;
      case 'color_lookup':
        initialSettings = {
          presetId: 'teal_orange',
          strength: 100,
        };
        break;
      case 'photo_filter':
        initialSettings = {
          color: '#ec8a00',
          density: 25,
          preserveLuminosity: true,
        };
        break;
      case 'style_filters':
        initialSettings = {
          filterId: 'clarendon',
          intensity: 100,
          vignette: 0,
        };
        break;
      case 'exposure':
        initialSettings = {
          exposure: 0,
          offset: 0,
          gamma: 1.0,
        };
        break;
      case 'thermal':
        initialSettings = {
          invert: false,
          shadows: -0.45,
          midtones: -0.11,
          highlights: -0.05,
          gradientType: 3,
          gradientShift: 0.0,
          gradientRepeat: 0.7,
          showEdges: false,
          edgeRange: 0.50,
        };
        break;
      case 'gradient_fill':
        initialSettings = {
          style: 'linear',
          angle: 90,
          color1: '#164435',
          color2: '#5fd3ad',
          reverse: false,
          opacity: 1,
          blendMode: 'source-over',
        };
        break;
    }

    const newL = createLayer(
      newId,
      `${name} Adjustment`,
      activeArtwork.width,
      activeArtwork.height,
      {
        type: 'adjustment',
        adjustmentConfig: {
          type,
          settings: initialSettings,
        },
      }
    );
    const activeIdx = layers.findIndex((l) => l.id === activeLayerId);
    const updated = [...layers];
    updated.splice(activeIdx + 1, 0, newL);
    setLayers(updated);
    setActiveLayerId(newId);
    setActiveMaskLayerId(null);
    showToast(`Created non-destructive ${name} adjustment layer (Controls at bottom)`);
  };

  const handleRasterizeLayer = (id: string) => {
    const target = layers.find((l) => l.id === id);
    if (!target) return;
    handlePushHistory();

    if (target.type === 'adjustment' && target.adjustmentConfig) {
      const compBelow = document.createElement('canvas');
      compBelow.width = activeArtwork.width;
      compBelow.height = activeArtwork.height;
      const cbCtx = compBelow.getContext('2d')!;
      cbCtx.fillStyle = backgroundColor;
      cbCtx.fillRect(0, 0, activeArtwork.width, activeArtwork.height);

      const targetIdx = layers.findIndex((l) => l.id === id);
      for (let i = 0; i < targetIdx; i++) {
        const lyr = layers[i];
        if (lyr.visible) {
          cbCtx.save();
          cbCtx.globalAlpha = lyr.opacity;
          cbCtx.globalCompositeOperation = getCanvasCompositeOperation(lyr.blendMode);
          cbCtx.drawImage(lyr.canvas, 0, 0);
          cbCtx.restore();
        }
      }

      const processed = renderFastAdjustmentLayer(compBelow, target.adjustmentConfig);
      target.ctx.clearRect(0, 0, activeArtwork.width, activeArtwork.height);
      target.ctx.drawImage(processed, 0, 0);

      target.type = 'raster';
      delete target.adjustmentConfig;

      setDismissedAdjustmentBarLayerIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } else if (target.type === 'vector' || target.isVector) {
      if (isShapesOpen && id === activeLayerId) {
        renderVectorShape(target.ctx, vectorShapeConfig, activeBrush);
      }
      target.type = 'raster';
      target.isVector = false;
      target.vectorPaths = undefined;
    } else if (isShapesOpen && id === activeLayerId) {
      renderVectorShape(target.ctx, vectorShapeConfig, activeBrush);
    }

    const thumb = document.createElement('canvas');
    thumb.width = 64;
    thumb.height = 64;
    thumb.getContext('2d')?.drawImage(target.canvas, 0, 0, 64, 64);
    target.thumbnailUrl = thumb.toDataURL();

    setLayers([...layers]);
    showToast(`Rasterized "${target.name}" to pixels`);
  };

  const handleClearLayer = (id: string) => {
    const target = layers.find((l) => l.id === id);
    if (!target) return;
    handlePushHistory();
    if (target.type === 'group') {
      const childs = layers.filter((l) => l.parentId === id);
      childs.forEach((c) => {
        c.ctx.clearRect(0, 0, c.canvas.width, c.canvas.height);
        c.thumbnailUrl = undefined;
      });
      showToast(`Cleared contents of group "${target.name}"`);
    } else if (target.type === 'smart' && target.smartLayers) {
      target.smartLayers.forEach((c) => {
        c.ctx.clearRect(0, 0, c.canvas.width, c.canvas.height);
        c.thumbnailUrl = undefined;
      });
      target.ctx.clearRect(0, 0, target.canvas.width, target.canvas.height);
      target.thumbnailUrl = undefined;
      showToast(`Cleared contents of Smart Layer "${target.name}"`);
    } else {
      target.ctx.clearRect(0, 0, target.canvas.width, target.canvas.height);
      target.thumbnailUrl = undefined;
    }
    setLayers([...layers]);
  };

  const handleMoveLayer = (id: string, direction: 'up' | 'down') => {
    const idx = layers.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx + 1 : idx - 1;
    if (targetIdx < 0 || targetIdx >= layers.length) return;
    handlePushHistory();
    const newLayers = [...layers];
    const [moved] = newLayers.splice(idx, 1);
    newLayers.splice(targetIdx, 0, moved);
    setLayers(newLayers);
  };

  // Flip Canvas Operations
  const handleFlipCanvas = (dir: 'h' | 'v') => {
    handlePushHistory();
    layers.forEach((l) => {
      const temp = document.createElement('canvas');
      temp.width = l.canvas.width;
      temp.height = l.canvas.height;
      temp.getContext('2d')?.drawImage(l.canvas, 0, 0);

      l.ctx.clearRect(0, 0, l.canvas.width, l.canvas.height);
      l.ctx.save();
      if (dir === 'h') {
        l.ctx.translate(l.canvas.width, 0);
        l.ctx.scale(-1, 1);
      } else {
        l.ctx.translate(0, l.canvas.height);
        l.ctx.scale(1, -1);
      }
      l.ctx.drawImage(temp, 0, 0);
      l.ctx.restore();
    });
    setLayers([...layers]);
  };

  // Execute a Quick Action from the 5x5 Pop-Up Menu
  const executeQuickAction = (actionId: string) => {
    if (actionId === 'PLUS_CENTER' || actionId === 'empty') {
      setTargetSlotForBinding(null);
      setIsCommandPaletteOpen(true);
      return;
    }
    switch (actionId) {
      case 'undo':
        handleUndo();
        break;
      case 'redo':
        handleRedo();
        break;
      case 'flip_h':
        handleFlipCanvas('h');
        showToast('Flipped Canvas Horizontally');
        break;
      case 'flip_v':
        handleFlipCanvas('v');
        showToast('Flipped Canvas Vertically');
        break;
      case 'new_layer':
        handleAddLayer();
        showToast('Created New Raster Layer');
        break;
      case 'new_vector':
        handleAddVectorLayer();
        break;
      case 'merge_down':
        if (activeLayerId) handleMergeDown(activeLayerId);
        break;
      case 'dup_layer':
        if (activeLayerId) handleDuplicateLayer(activeLayerId);
        break;
      case 'clear_layer':
        if (activeLayerId) handleClearLayer(activeLayerId);
        break;
      case 'copy_layer':
        handleCopyLayer();
        break;
      case 'paste':
        handlePasteClipboard();
        break;
      case 'adj_gradient_map':
        handleAddAdjustmentLayer('gradient_map' as AdjustmentLayerConfig['type']);
        break;
      case 'adj_curves':
        setActiveAdjustment('curves' as ActiveAdjustment);
        break;
      case 'adj_hue':
        setActiveAdjustment('hue_saturation_brightness' as ActiveAdjustment);
        break;
      case 'adj_glitch':
        setActiveAdjustment('glitch' as ActiveAdjustment);
        break;
      case 'tool_brush':
        setActiveTool('brush');
        break;
      case 'tool_smudge':
        setActiveTool('smudge');
        break;
      case 'tool_eraser':
        setActiveTool('eraser');
        break;
      case 'tool_studio':
        setIsBrushStudioOpen(true);
        break;
      case 'tool_transform':
        setInitialTransformMode('puppet');
        setActiveTool('transform');
        break;
      case 'toggle_symmetry':
        setDrawingGuide((prev) => ({
          ...prev,
          type: prev.type === 'symmetry_vertical' ? 'none' : 'symmetry_vertical',
          assisted: true,
        }));
        showToast('Toggled Symmetry Mirror Guide');
        break;
      case 'toggle_grid':
        setDrawingGuide((prev) => ({
          ...prev,
          type: prev.type === '2d_grid' ? 'none' : '2d_grid',
        }));
        showToast('Toggled 2D Grid');
        break;
      case 'toggle_touch':
        setIsActionsOpen(true);
        setIsPrefsTabActive(true);
        break;
      case 'zen_mode':
        setIsZenMode((prev) => !prev);
        break;
    }
    setIsQuickMenuOpen(false);
  };

  // Export File Formats
  const handleExport = (
    format: 'png' | 'jpeg' | 'webp' | 'json' | 'pdf' | 'psd' | 'procreate' | 'tiff' | 'hbatz'
  ) => {
    const filename = activeArtwork.title.replace(/\s+/g, '_');

    if (format === 'hbatz') {
      exportAsHbatz(activeArtwork, layers, `${filename}.hbatz`)
        .then(() => showToast(`Exported "${activeArtwork.title}.hbatz" project archive`))
        .catch((err) => showToast(`Failed to export .hbatz: ${err.message}`));
      return;
    }

    if (format === 'json') {
      const projectData = {
        title: activeArtwork.title,
        width: activeArtwork.width,
        height: activeArtwork.height,
        backgroundColor,
        layers: layers.map((l) => ({
          name: l.name,
          visible: l.visible,
          opacity: l.opacity,
          blendMode: l.blendMode,
          dataUrl: l.canvas.toDataURL(),
        })),
      };
      const blob = new Blob([JSON.stringify(projectData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.procreate.json`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (format === 'psd') {
      exportAsPsd(layers, activeArtwork.width, activeArtwork.height, `${filename}.psd`);
      return;
    }

    if (format === 'procreate') {
      exportAsProcreate(activeArtwork, `${filename}.procreate`);
      return;
    }

    const exportCanvas = renderFullArtworkCanvas(
      layers,
      activeArtwork.width,
      activeArtwork.height,
      backgroundColor
    );

    if (format === 'pdf') {
      exportAsPdf(exportCanvas, `${filename}.pdf`);
      return;
    }

    if (format === 'tiff') {
      exportAsTiff(exportCanvas, `${filename}.tiff`);
      return;
    }

    if (format === 'jpeg') {
      exportAsJpeg(exportCanvas, `${filename}.jpg`);
      return;
    }

    if (format === 'webp') {
      const dataUrl = exportCanvas.toDataURL('image/webp', 0.95);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${filename}.webp`;
      a.click();
      return;
    }

    exportAsPng(exportCanvas, `${filename}.png`);
  };

  // Gallery Navigation & Artwork creation
  const handleCreateNewArtwork = (width: number, height: number, title?: string) => {
    saveCurrentArtwork();
    const newId = `art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const firstLayer = createLayer(`layer_${Date.now()}`, 'Layer 1', width, height);
    artworkLayersCacheRef.current.set(newId, [cloneLayerSnapshot(firstLayer)]);
    skipNextArtworkLoadRef.current = true;

    const chosenTitle = title || `Untitled Artwork ${artworks.length + 1}`;
    const safeTitle = chosenTitle.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'Artwork';
    const targetFileName = `${safeTitle}.hbatz`;

    const newArt: ArtworkProject = {
      id: newId,
      title: chosenTitle,
      fileName: targetFileName,
      width,
      height,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      backgroundColor: '#ffffff',
      thumbnailUrl: '',
      layers: [
        {
          id: firstLayer.id,
          name: 'Layer 1',
          visible: true,
          opacity: 1,
          blendMode: 'source-over',
          locked: false,
          alphaLocked: false,
          dataUrl: '',
        },
      ],
      recordedStrokes: [],
    };

    setArtworks((prev) => [newArt, ...prev]);
    setCurrentArtworkId(newId);
    setLayers([firstLayer]);
    setActiveLayerId(firstLayer.id);
    setBackgroundColor('#ffffff');
    setInGallery(false);

    // Save project directly into Hunbatz local content/Projects/ as .HBATZ file
    saveProjectToLocalContent(newArt, [firstLayer], targetFileName)
      .then((res) => {
        setArtworks((prev) =>
          prev.map((a) => (a.id === newId ? { ...a, fileSize: res.size } : a))
        );
      })
      .catch((err) => console.error('Failed to create local .hbatz project file:', err));
  };

  const handleDuplicateArtwork = async (id: string) => {
    const art = artworks.find((a) => a.id === id);
    if (!art) return;
    const newId = `art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Retrieve full layers from memory cache or directly from disk .hbatz
    let dupLayers = artworkLayersCacheRef.current.get(id);
    if (!dupLayers && art.fileName) {
      try {
        const res = await fetch(`/hunbatz-content/Projects/${encodeURIComponent(art.fileName)}`);
        if (res.ok) {
          const blob = await res.blob();
          const unpacked = await importHbatzFile(blob);
          dupLayers = unpacked.layers;
        }
      } catch (e) {
        console.warn('Failed to load layers from disk for duplication:', e);
      }
    }

    if (!dupLayers || dupLayers.length === 0) {
      dupLayers = [createLayer(`layer_${Date.now()}`, 'Layer 1', art.width, art.height)];
    }

    const clonedLayers = dupLayers.map(cloneLayerSnapshot);
    artworkLayersCacheRef.current.set(newId, clonedLayers);

    const dupTitle = `${art.title} Copy`;
    const safeDup = dupTitle.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'Artwork_Copy';
    const dupFileName = `${safeDup}.hbatz`;

    const dup: ArtworkProject = {
      ...art,
      id: newId,
      title: dupTitle,
      fileName: dupFileName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setArtworks((prev) => {
      const next = [dup, ...prev];
      try {
        localStorage.setItem('procreate_pc_projects', JSON.stringify(next));
      } catch {}
      return next;
    });

    saveProjectToLocalContent(dup, clonedLayers, dupFileName)
      .then((res) => {
        setArtworks((prev) =>
          prev.map((a) => (a.id === newId ? { ...a, fileSize: res.size } : a))
        );
      })
      .catch((e) => console.error('Failed to save duplicate to local content:', e));

    showToast(`Duplicated "${art.title}" to Projects/`);
  };

  const handleDeleteArtwork = useCallback((id: string) => {
    const now = Date.now();
    if (now - lastDeleteTimeRef.current < 350) return;
    lastDeleteTimeRef.current = now;

    setArtworks((prev) => {
      if (prev.length <= 1) {
        showToast('Cannot delete the only remaining artwork in gallery');
        return prev;
      }
      const targetIndex = prev.findIndex((a) => a.id === id);
      if (targetIndex === -1) return prev;

      const deletedArt = prev[targetIndex];
      const next = prev.filter((_, idx) => idx !== targetIndex);
      artworkLayersCacheRef.current.delete(id);

      try {
        localStorage.setItem('procreate_pc_projects', JSON.stringify(next));
      } catch {}

      if (currentArtworkId === id && next.length > 0) {
        setCurrentArtworkId(next[0].id);
      }

      // Delete .HBATZ file from Hunbatz local content/Projects/
      const fileNameToDelete = deletedArt.fileName || `${deletedArt.title.replace(/[/\\?%*:|"<>]/g, '_')}.hbatz`;
      deleteLocalProject(fileNameToDelete)
        .then(() => console.log(`Deleted project from disk: ${fileNameToDelete}`))
        .catch((e) => console.error('Failed to delete .hbatz from disk:', e));

      showToast(`Deleted "${deletedArt.title}"`);
      return next;
    });
  }, [currentArtworkId, showToast]);

  const handleImportHbatz = async (file: File) => {
    try {
      showToast('Opening .HBATZ project archive...');
      const { artwork, layers: restoredLayers } = await importHbatzFile(file);

      const uniqueArtworkId = `art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const safeName = file.name.replace(/[/\\?%*:|"<>]/g, '_');
      const targetFileName = safeName.endsWith('.hbatz') ? safeName : `${safeName}.hbatz`;

      const uniqueArtwork: ArtworkProject = {
        ...artwork,
        id: uniqueArtworkId,
        fileName: targetFileName,
        updatedAt: Date.now(),
      };

      artworkLayersCacheRef.current.set(
        uniqueArtworkId,
        restoredLayers.map(cloneLayerSnapshot)
      );

      skipNextArtworkLoadRef.current = true;

      // Copy imported .HBATZ file directly to Hunbatz local content/Projects/
      saveProjectToLocalContent(uniqueArtwork, restoredLayers, targetFileName)
        .then((res) => {
          setArtworks((prev) =>
            prev.map((a) => (a.id === uniqueArtworkId ? { ...a, fileSize: res.size } : a))
          );
        })
        .catch((e) => console.error('Failed to copy imported .hbatz to local content:', e));

      setArtworks((prev) => {
        const next = [uniqueArtwork, ...prev];
        try {
          localStorage.setItem('procreate_pc_projects', JSON.stringify(next));
        } catch {}
        return next;
      });
      setCurrentArtworkId(uniqueArtworkId);
      setLayers(restoredLayers);
      setActiveLayerId(restoredLayers[restoredLayers.length - 1]?.id || '');
      setBackgroundColor(uniqueArtwork.backgroundColor || '#ffffff');
      setRecordedStrokes(uniqueArtwork.recordedStrokes || []);
      historyStackRef.current = [];
      redoStackRef.current = [];
      setInGallery(false);
      showToast(`Copied & opened "${targetFileName}" in Projects/!`);
    } catch (err: any) {
      console.error(err);
      showToast(`Failed to open .hbatz: ${err.message}`);
    }
  };

  const handleImportImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.hbatz')) {
      handleImportHbatz(file);
      e.target.value = '';
      return;
    }

    if (file.name.toLowerCase().endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = async (re) => {
        try {
          const parsed = JSON.parse(re.target?.result as string);
          const baseName = file.name.replace(/\.json$/i, '');
          const safeName = baseName.replace(/[/\\?%*:|"<>]/g, '_');
          const targetFileName = `${safeName}.hbatz`;
          const newId = `art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

          const newArt: ArtworkProject = {
            id: newId,
            title: parsed.title || baseName,
            fileName: targetFileName,
            width: parsed.width || 1920,
            height: parsed.height || 1080,
            backgroundColor: parsed.backgroundColor || '#ffffff',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            thumbnailUrl: parsed.thumbnailUrl || '',
            layers: parsed.layers || [],
          };

          const reconstitutedLayers: Layer[] = [];
          if (Array.isArray(parsed.layers) && parsed.layers.length > 0) {
            for (const lData of parsed.layers) {
              const layer = createLayer(lData.id, lData.name, newArt.width, newArt.height, {
                visible: lData.visible,
                opacity: lData.opacity,
                blendMode: lData.blendMode,
                locked: lData.locked,
                alphaLocked: lData.alphaLocked,
                effects: lData.effects,
                adjustmentConfig: lData.adjustmentConfig,
              });
              if (lData.dataUrl) {
                const img = new Image();
                img.src = lData.dataUrl;
                await new Promise((resolve) => {
                  img.onload = () => {
                    layer.ctx.drawImage(img, 0, 0);
                    resolve(true);
                  };
                  img.onerror = () => resolve(false);
                });
              }
              reconstitutedLayers.push(layer);
            }
          } else {
            reconstitutedLayers.push(createLayer(`layer_${Date.now()}`, 'Layer 1', newArt.width, newArt.height));
          }

          artworkLayersCacheRef.current.set(newId, reconstitutedLayers.map(cloneLayerSnapshot));
          skipNextArtworkLoadRef.current = true;

          setArtworks((prev) => [newArt, ...prev]);
          setCurrentArtworkId(newArt.id);
          setLayers(reconstitutedLayers);
          setActiveLayerId(reconstitutedLayers[reconstitutedLayers.length - 1]?.id || '');
          setBackgroundColor(newArt.backgroundColor || '#ffffff');
          setInGallery(false);

          // Copy imported JSON project directly into Hunbatz local content/Projects/ as .HBATZ file
          saveProjectToLocalContent(newArt, reconstitutedLayers, targetFileName)
            .then((res) => {
              setArtworks((prev) =>
                prev.map((a) => (a.id === newId ? { ...a, fileSize: res.size } : a))
              );
            })
            .catch((e) => console.error('Failed to copy imported JSON project to local content:', e));

          showToast(`Imported & copied "${targetFileName}" to Projects/!`);
        } catch {
          showToast('Could not parse project file.');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    } else {
      const reader = new FileReader();
      reader.onload = (re) => {
        const img = new Image();
        img.onload = () => {
          const newId = `art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          const firstLayer = createLayer(`layer_${Date.now()}`, 'Imported Image', w, h);
          firstLayer.ctx.imageSmoothingEnabled = true;
          firstLayer.ctx.imageSmoothingQuality = 'high';
          firstLayer.ctx.drawImage(img, 0, 0, w, h);
          firstLayer.thumbnailUrl = img.src;

          artworkLayersCacheRef.current.set(newId, [cloneLayerSnapshot(firstLayer)]);
          skipNextArtworkLoadRef.current = true;

          const baseName = file.name.replace(/\.[^/.]+$/, '');
          const safeName = baseName.replace(/[/\\?%*:|"<>]/g, '_');
          const targetFileName = `${safeName}.hbatz`;

          const newArt: ArtworkProject = {
            id: newId,
            title: file.name.replace(/\.[^/.]+$/, ''),
            fileName: targetFileName,
            width: w,
            height: h,
            backgroundColor: '#ffffff',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            thumbnailUrl: img.src,
            layers: [
              {
                id: firstLayer.id,
                name: 'Imported Image',
                visible: true,
                opacity: 1,
                blendMode: 'source-over',
                locked: false,
                alphaLocked: false,
                dataUrl: img.src,
              },
            ],
          };

          setArtworks((prev) => [newArt, ...prev]);
          setCurrentArtworkId(newId);
          setLayers([firstLayer]);
          setActiveLayerId(firstLayer.id);
          setBackgroundColor('#ffffff');
          setInGallery(false);

          // Copy imported image directly into Hunbatz local content/Projects/ as .HBATZ file
          saveProjectToLocalContent(newArt, [firstLayer], targetFileName)
            .then((res) => {
              setArtworks((prev) =>
                prev.map((a) => (a.id === newId ? { ...a, fileSize: res.size } : a))
              );
            })
            .catch((e) => console.error('Failed to copy imported image to local content:', e));

          showToast(`Imported & copied "${targetFileName}" to Projects/!`);
        };
        img.src = re.target?.result as string;
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-[#0e1110] text-[#e6c699] font-sans"
      onClickCapture={(e) => {
        if (isActionsOpen) {
          const target = e.target as HTMLElement;
          const btnText = target?.closest('button')?.textContent?.trim();
          if (btnText === 'Prefs') {
            setIsPrefsTabActive(true);
          } else if (
            btnText === 'Add' ||
            btnText === 'Canvas' ||
            btnText === 'Share' ||
            btnText === 'Video' ||
            btnText === 'Help'
          ) {
            setIsPrefsTabActive(false);
          }
        }
      }}
      onPointerDownCapture={(e) => {
        if (!touchPaintingEnabled && e.pointerType === 'touch') {
          const target = e.target as HTMLElement;
          if (target?.tagName === 'CANVAS') {
            e.stopPropagation();
          }
        }
      }}
      style={{
        backgroundImage:
          "radial-gradient(ellipse at center, rgba(14, 18, 16, 0.35) 0%, rgba(10, 12, 11, 0.94) 100%), url('/assets/aistudio/image_51228c80.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <style>{`
        @keyframes hunbatzJiggle {
          0% { transform: rotate(-2.2deg) scale(0.98); }
          50% { transform: rotate(2.2deg) scale(1.02); }
          100% { transform: rotate(-2.2deg) scale(0.98); }
        }
        .jiggle-active {
          animation: hunbatzJiggle 0.26s infinite ease-in-out;
        }
      `}</style>

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 mayan-panel border-2 border-[#b89058]/80 text-[#f2fbf7] text-xs px-5 py-2.5 rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-1 duration-150 flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-[#5fd3ad] shadow-[0_0_8px_#5fd3ad]" />
          <span className="font-medium tracking-wide">{toastMessage}</span>
        </div>
      )}

      {/* GALLERY VIEW */}
      {inGallery ? (
        <GalleryView
          artworks={artworks}
          onOpenArtwork={(id) => {
            setCurrentArtworkId(id);
            setInGallery(false);
          }}
          onCreateNewArtwork={handleCreateNewArtwork}
          onDuplicateArtwork={handleDuplicateArtwork}
          onDeleteArtwork={handleDeleteArtwork}
          onImportImage={handleImportImage}
          onImportHbatz={handleImportHbatz}
        />
      ) : (
        /* CANVAS STUDIO WORKSPACE */
        <div
          className="relative w-full h-full"
          style={{ '--app-ui-scale': uiScale } as React.CSSProperties}
          data-device-mode={effectiveDeviceMode}
        >
          {/* Main Drawing Canvas Workspace (Cutout intercepted by our Sharp Triangular Cutout Studio) */}
          <CanvasWorkspace
            canvasWidth={activeArtwork.width}
            canvasHeight={activeArtwork.height}
            backgroundColor={backgroundColor}
            layers={layers}
            activeLayerId={activeLayerId}
            activeMaskLayerId={activeMaskLayerId}
            vectorLayerConfig={vectorLayerConfig}
            activeTool={activeTool}
            activeBrush={activeBrush}
            currentColor={currentColor}
            brushSize={brushSize}
            brushOpacity={brushOpacity}
            drawingGuide={drawingGuide}
            showBrushCursor={showBrushCursor}
            activeAdjustment={activeAdjustment === 'cutout' ? null : activeAdjustment}
            isEyedropperActive={isEyedropperActive}
            isShapesActive={isShapesOpen}
            shapeConfig={vectorShapeConfig}
            onChangeShapeConfig={(up) => setVectorShapeConfig((prev) => ({ ...prev, ...up }))}
            onToggleEyedropper={() => setIsEyedropperActive(!isEyedropperActive)}
            isAdjustingBrushSize={isAdjustingBrushSize}
            isCropResizeActive={isCropResizeOpen}
            onApplyCropResize={handleApplyCropResize}
            onCloseCropResize={() => setIsCropResizeOpen(false)}
            isAnimationAssistActive={isAnimationAssistActive}
            animationConfig={animationConfig}
            isPageAssistActive={isPageAssistActive}
            initialTransformMode={initialTransformMode}
            onClearInitialTransformMode={() => setInitialTransformMode(null)}
            onChangeTool={(tool) => setActiveTool(tool)}
            onColorSampled={(hex) => {
              handleColorChange(hex);
              setIsEyedropperActive(false);
            }}
            onUpdateLayers={(updated) => setLayers(updated)}
            onPushHistory={handlePushHistory}
            onRecordStroke={(stroke) =>
              setRecordedStrokes((prev) => [...prev, stroke])
            }
            onCloseAdjustment={() => setActiveAdjustment(null)}
            onPasteImageFile={(file) => pasteImageAsLayer(file, file.name)}
            onCopyPasteSelection={(extracted, bounds) =>
              pasteImageAsLayer(
                extracted,
                'From Selection',
                bounds ? { x: bounds.x, y: bounds.y } : undefined
              )
            }
            onSelectLayer={(id) => {
              setActiveLayerId(id);
              setActiveMaskLayerId(null);
              setDismissedAdjustmentBarLayerIds((prev) => {
                if (prev.has(id)) {
                  const next = new Set(prev);
                  next.delete(id);
                  return next;
                }
                return prev;
              });
            }}
            selectLayerPixelsId={selectLayerPixelsId}
            onClearSelectLayerPixelsId={() => setSelectLayerPixelsId(null)}
            onDrawingStart={() => setIsBrushLibraryOpen(false)}
            onSelectionChange={setCurrentSelection}
            clearSelectionSignal={clearSelectionSignal}
            hwAcceleration={hwAcceleration}
            uiScale={uiScale}
            deviceMode={effectiveDeviceMode}
            editingSmartLayerId={editingSmartLayerId}
            onCloseSmartLayerEdit={() => setEditingSmartLayerId(null)}
            editingSmartFilter={editingSmartFilter}
            onClearEditingSmartFilter={() => setEditingSmartFilter(null)}
            ramProfile={ramProfile}
          />

          {/* PHOTOPEA-PARITY SHARP TRIANGULAR / POLYGON CUTOUT STUDIO BAR */}
          {activeAdjustment === 'cutout' && (() => {
            const activeLayer = layers.find((l) => l.id === activeLayerId);
            if (!activeLayer) return null;

            const updateCutoutPreview = (lv: number, simp: number, fid: number) => {
              setCutoutParams({ levels: lv, simplicity: simp, fidelity: fid });
              if (effectBackupCanvasRef.current) {
                const rendered = renderSharpTriangularCutout(
                  effectBackupCanvasRef.current,
                  lv,
                  simp,
                  fid
                );
                activeLayer.ctx.clearRect(0, 0, activeArtwork.width, activeArtwork.height);
                activeLayer.ctx.drawImage(rendered, 0, 0);
                setLayers([...layers]);
              }
            };

            return (
              <div
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-xl w-[92vw] mayan-panel p-3.5 text-[#E6C699] flex flex-col gap-2.5 select-none shadow-[0_16px_50px_rgba(0,0,0,0.95)] border-2 border-[#b89058]"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-2 border-b border-[#2c3532]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#5fd3ad] shadow-[0_0_8px_#5fd3ad]" />
                    <span className="text-xs font-mayan font-bold tracking-wider uppercase text-[#E6C699]">
                      Triangular Cutout Studio: Levels {cutoutParams.levels} · Simplicity {cutoutParams.simplicity} · Fidelity {cutoutParams.fidelity}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (effectBackupCanvasRef.current) {
                          activeLayer.ctx.clearRect(0, 0, activeArtwork.width, activeArtwork.height);
                          activeLayer.ctx.drawImage(effectBackupCanvasRef.current, 0, 0);
                          setLayers([...layers]);
                        }
                        setEditingSmartFilter(null);
                        setActiveAdjustment(null);
                      }}
                      className="px-2.5 py-1 rounded-lg mayan-btn-stone text-xs text-[#9E9484] hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        handlePushHistory();
                        if (effectBackupCanvasRef.current) {
                          const rendered = renderSharpTriangularCutout(
                            effectBackupCanvasRef.current,
                            cutoutParams.levels,
                            cutoutParams.simplicity,
                            cutoutParams.fidelity
                          );
                          activeLayer.ctx.clearRect(0, 0, activeArtwork.width, activeArtwork.height);
                          activeLayer.ctx.drawImage(rendered, 0, 0);
                          const thumb = document.createElement('canvas');
                          thumb.width = 64;
                          thumb.height = 64;
                          thumb.getContext('2d')?.drawImage(rendered, 0, 0, 64, 64);
                          activeLayer.thumbnailUrl = thumb.toDataURL();
                        }
                        setLayers([...layers]);
                        setEditingSmartFilter(null);
                        setActiveAdjustment(null);
                        showToast('Applied Sharp Triangular Cutout');
                      }}
                      className="px-3.5 py-1 rounded-lg mayan-btn-cta text-xs font-bold shadow-md cursor-pointer"
                    >
                      ✓ Apply Cutout
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 bg-[#141a18] p-3 rounded-xl border border-[#2c3532] text-xs">
                  <div className="flex items-center justify-between text-[11px] text-[#5fd3ad]">
                    <span>Photopea-Style Angular Facet Triangulation</span>
                    <span className="font-mono">Crisp Straight Edges</span>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
                    <span className="text-white/70 font-mono text-[11px] w-32">Number of Levels</span>
                    <input
                      type="range"
                      min="2"
                      max="12"
                      value={cutoutParams.levels}
                      onChange={(e) =>
                        updateCutoutPreview(
                          parseInt(e.target.value),
                          cutoutParams.simplicity,
                          cutoutParams.fidelity
                        )
                      }
                      className="flex-1 h-2 bg-white/10 accent-[#5fd3ad] rounded-lg cursor-pointer"
                    />
                    <span className="text-[#5fd3ad] font-mono text-xs w-8 text-right font-bold">
                      {cutoutParams.levels}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
                    <span className="text-white/70 font-mono text-[11px] w-32">Edge Simplicity</span>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={cutoutParams.simplicity}
                      onChange={(e) =>
                        updateCutoutPreview(
                          cutoutParams.levels,
                          parseInt(e.target.value),
                          cutoutParams.fidelity
                        )
                      }
                      className="flex-1 h-1.5 bg-white/10 accent-pink-500 rounded-lg cursor-pointer"
                    />
                    <span className="text-pink-400 font-mono text-xs w-8 text-right font-bold">
                      {cutoutParams.simplicity}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
                    <span className="text-white/70 font-mono text-[11px] w-32">Edge Fidelity</span>
                    <input
                      type="range"
                      min="1"
                      max="3"
                      value={cutoutParams.fidelity}
                      onChange={(e) =>
                        updateCutoutPreview(
                          cutoutParams.levels,
                          cutoutParams.simplicity,
                          parseInt(e.target.value)
                        )
                      }
                      className="flex-1 h-1.5 bg-white/10 accent-cyan-400 rounded-lg cursor-pointer"
                    />
                    <span className="text-cyan-400 font-mono text-xs w-8 text-right font-bold">
                      {cutoutParams.fidelity}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Header Bar */}
          {!isZenMode && (
            <HeaderBar
              projectTitle={activeArtwork.title}
              zoomScale={zoomScale}
              activeTool={activeTool}
              currentColor={currentColor}
              layerCount={layers.length}
              isActionsOpen={isActionsOpen}
              isBrushLibraryOpen={isBrushLibraryOpen}
              isLayersOpen={isLayersOpen}
              isColorStudioOpen={isColorStudioOpen}
              isZenMode={isZenMode}
              isShapesOpen={isShapesOpen}
              uiScale={uiScale}
              deviceMode={effectiveDeviceMode}
              onUpdateTitle={(title) => {
                setArtworks((prev) =>
                  prev.map((a) => (a.id === activeArtwork.id ? { ...a, title } : a))
                );
              }}
              onSelectTool={(tool) => {
                setActiveTool(tool);
                if (tool === 'brush') setIsBrushLibraryOpen(false);
              }}
              onToggleActions={() => {
                setIsActionsOpen(!isActionsOpen);
                setIsBrushLibraryOpen(false);
                setIsLayersOpen(false);
                setIsColorStudioOpen(false);
                setIsShapesOpen(false);
              }}
              onToggleShapes={() => {
                setIsShapesOpen(!isShapesOpen);
                setIsActionsOpen(false);
                setIsBrushLibraryOpen(false);
                setIsLayersOpen(false);
                setIsColorStudioOpen(false);
              }}
              onToggleBrushLibrary={() => {
                setIsBrushLibraryOpen(!isBrushLibraryOpen);
                setIsActionsOpen(false);
                setIsLayersOpen(false);
                setIsColorStudioOpen(false);
              }}
              onToggleLayers={() => {
                setIsLayersOpen(!isLayersOpen);
                setIsActionsOpen(false);
                setIsBrushLibraryOpen(false);
                setIsColorStudioOpen(false);
              }}
              onToggleColorStudio={() => {
                setIsColorStudioOpen(!isColorStudioOpen);
                setIsActionsOpen(false);
                setIsBrushLibraryOpen(false);
                setIsLayersOpen(false);
              }}
              onToggleZenMode={() => setIsZenMode(true)}
              onResetZoom={() => setZoomScale(1)}
              onNavigateGallery={() => {
                saveCurrentArtwork();
                setInGallery(true);
              }}
              onTriggerAdjustment={(adj) => setActiveAdjustment(adj)}
              onColorDropDragStart={(e) => {
                e.dataTransfer.setData('text/plain', currentColor);
              }}
            />
          )}

          {/* Dual Slider Sidebar (Brush Size & Opacity) */}
          {!isZenMode && (
            <SidebarControls
              brushSize={brushSize}
              brushOpacity={brushOpacity}
              isEyedropperActive={isEyedropperActive}
              canUndo={historyStackRef.current.length > 0}
              canRedo={redoStackRef.current.length > 0}
              onChangeSize={(newSize) => {
                setBrushSize(newSize);
                setActiveBrush((prev) => ({
                  ...prev,
                  size: newSize,
                  baseSize: newSize,
                }));
              }}
              onChangeOpacity={setBrushOpacity}
              onToggleEyedropper={() => setIsEyedropperActive(!isEyedropperActive)}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onSizeAdjusting={setIsAdjustingBrushSize}
              position={sidebarPosition}
              uiScale={uiScale}
              deviceMode={effectiveDeviceMode}
            />
          )}

          {/* Floating Quick Menu Trigger Pill */}
          {!isZenMode && (
            <button
              onClick={() => setIsQuickMenuOpen(true)}
              title="Open 5x5 Quick Menu (Shortcut: Q or Ctrl+Click)"
              className="fixed bottom-4 left-4 z-40 mayan-btn-jade px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xl cursor-pointer hover:scale-105 transition-transform"
            >
              <span className="w-2 h-2 rounded-full bg-[#e6c699]" />
              <span>5×5 Quick Menu</span>
            </button>
          )}

          {/* Vector & Comic Shapes Studio Toolbar */}
          {isShapesOpen && !isZenMode && (
            <>
              <ShapeToolbar
                config={vectorShapeConfig}
                onChangeConfig={(up) => setVectorShapeConfig((prev) => ({ ...prev, ...up }))}
                onRasterize={handleRasterizeVectorShape}
                onClose={() => setIsShapesOpen(false)}
                onAddPathPoint={handleAddPathPoint}
                onResetPathPoints={handleResetPathPoints}
              />
              <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 mayan-panel px-3 py-1.5 rounded-xl border border-[#5fd3ad]">
                <button
                  onClick={handleConvertShapeToVectorLayer}
                  className="mayan-btn-cta px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer hover:brightness-110 transition"
                >
                  Convert Shape to Editable Vector Layer
                </button>
              </div>
            </>
          )}

          {/* Color Studio Popover */}
          {isColorStudioOpen && !isZenMode && (
            <ColorStudio
              currentColor={currentColor}
              previousColor={previousColor}
              onChangeColor={handleColorChange}
              onClose={() => setIsColorStudioOpen(false)}
              onToggleEyedropper={() => setIsEyedropperActive(!isEyedropperActive)}
            />
          )}

          {/* Layers Panel Popover */}
          {isLayersOpen && !isZenMode && (
            <LayersPanel
              layers={layers}
              activeLayerId={activeLayerId}
              activeMaskLayerId={activeMaskLayerId}
              backgroundColor={backgroundColor}
              onSelectLayer={(id) => {
                setActiveLayerId(id);
                setActiveMaskLayerId(null);
                setDismissedAdjustmentBarLayerIds((prev) => {
                  if (prev.has(id)) {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                  }
                  return prev;
                });
              }}
              onSelectLayerMask={handleSelectLayerMask}
              onAddLayerMask={handleAddLayerMask}
              onDeleteLayerMask={handleDeleteLayerMask}
              onToggleMaskVisibility={handleToggleMaskVisibility}
              onChangeMaskProperties={handleChangeMaskProperties}
              onInvertMask={handleInvertMask}
              onResetMask={handleResetMask}
              onGroupSelectedLayers={handleGroupSelectedLayers}
              onAddLayer={handleAddLayer}
              onAddVectorLayer={handleAddVectorLayer}
              onAddAdjustmentLayer={handleAddAdjustmentLayer}
              onRasterizeLayer={handleRasterizeLayer}
              onDeleteLayer={handleDeleteLayer}
              onDuplicateLayer={handleDuplicateLayer}
              onClearLayer={handleClearLayer}
              onMergeDown={handleMergeDown}
              onToggleVisibility={(id) => {
                handlePushHistory();
                setLayers((prev) =>
                  prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
                );
              }}
              onToggleLock={(id) => {
                setLayers((prev) =>
                  prev.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l))
                );
              }}
              onChangeOpacity={(id, op) => {
                setLayers((prev) =>
                  prev.map((l) => (l.id === id ? { ...l, opacity: op } : l))
                );
              }}
              onChangeBlendMode={(id, mode) => {
                handlePushHistory();
                setLayers((prev) =>
                  prev.map((l) => (l.id === id ? { ...l, blendMode: mode } : l))
                );
              }}
              onMoveLayer={handleMoveLayer}
              onAddGroup={handleAddGroup}
              onReorderLayers={(newLayers) => {
                handlePushHistory();
                setLayers(newLayers);
              }}
              onToggleExpandGroup={handleToggleExpandGroup}
              onChangeBackgroundColor={(col) => {
                handlePushHistory();
                setBackgroundColor(col);
              }}
              onOpenLayerEffects={(id) => setLayerEffectsTargetId(id)}
              onSelectLayerPixels={(id) => setSelectLayerPixelsId(id)}
              onConvertToSmartLayer={handleConvertToSmartLayer}
              onUnpackSmartLayer={handleUnpackSmartLayer}
              onFlattenGroup={handleFlattenGroup}
              onFlattenSmartLayer={handleFlattenSmartLayer}
              onFlattenAllLayers={handleFlattenAllLayers}
              onEditSmartLayerContents={handleEditSmartLayerContents}
              editingSmartLayerId={editingSmartLayerId}
              onToggleSmartFilter={handleToggleSmartFilter}
              onToggleAllSmartFilters={handleToggleAllSmartFilters}
              onReorderSmartFilter={handleReorderSmartFilter}
              onDeleteSmartFilter={handleDeleteSmartFilter}
              onEditSmartFilter={handleEditSmartFilter}
              onAddSmartFilter={handleAddSmartFilter}
              onToggleExpandSmartFilters={handleToggleExpandSmartFilters}
              onClose={() => setIsLayersOpen(false)}
            />
          )}

          {/* Brush Library Popover */}
          {isBrushLibraryOpen && !isZenMode && (
            <BrushLibrary
              brushes={brushes}
              activeBrush={activeBrush}
              activeTool={activeTool}
              currentColor={currentColor}
              brushSize={brushSize}
              brushOpacity={brushOpacity}
              onSelectBrush={(b) => {
                handleSelectBrushWithRecent(b);
              }}
              onBatchUpdateBrushes={(updated) => {
                setBrushes(updated);
              }}
              onUpdateBrush={(updated) => {
                const targetSize = Number(updated.size) || Number((updated as any).baseSize) || 24;
                setBrushSize(targetSize);
                setBrushes((prev) => {
                  const exists = prev.some((b) => b.id === updated.id);
                  if (exists) {
                    return prev.map((b) => (b.id === updated.id ? updated : b));
                  } else {
                    return [updated, ...prev];
                  }
                });
                saveLocalBrush(updated, updated.category || 'Inking').catch(() => {});
                if (activeBrush.id === updated.id || !brushes.some((b) => b.id === updated.id)) {
                  handleSelectBrushWithRecent(updated);
                }
                showToast(`Saved brush: ${updated.name}`);
              }}
              onDuplicateBrush={(duplicated) => {
                setBrushes((prev) => [duplicated, ...prev]);
                saveLocalBrush(duplicated, duplicated.category || 'Inking').catch(() => {});
                handleSelectBrushWithRecent(duplicated);
                showToast(`Duplicated "${duplicated.name}" to Library`);
              }}
              onImportBrushes={(imported) => {
                setBrushes((prev) => [...imported, ...prev]);
                imported.forEach((b) => saveLocalBrush(b, b.category || 'Inking').catch(() => {}));
                if (imported.length > 0) {
                  handleSelectBrushWithRecent(imported[0]);
                }
                showToast(
                  `Imported ${imported.length} brush${imported.length === 1 ? '' : 'es'} to Library!`
                );
              }}
              onSyncAllToLocalContent={handleSyncAllToLocalContent}
              onClose={() => setIsBrushLibraryOpen(false)}
            />
          )}

          {/* Actions Wrench Modal */}
          {isActionsOpen && !isZenMode && (
            <>
              <ActionsModal
                canvasWidth={activeArtwork.width}
                canvasHeight={activeArtwork.height}
                layerCount={layers.length}
                drawingGuide={drawingGuide}
                sidebarPosition={sidebarPosition}
                showBrushCursor={showBrushCursor}
                isAnimationAssistActive={isAnimationAssistActive}
                isPageAssistActive={isPageAssistActive}
                isReferenceActive={isReferenceActive}
                onToggleReference={() => setIsReferenceActive((prev) => !prev)}
                onOpenCropResize={() => setIsCropResizeOpen(true)}
                onToggleAnimationAssist={() => {
                  setIsAnimationAssistActive((prev) => {
                    const next = !prev;
                    if (next) setIsPageAssistActive(false);
                    return next;
                  });
                }}
                onTogglePageAssist={() => {
                  setIsPageAssistActive((prev) => {
                    const next = !prev;
                    if (next) setIsAnimationAssistActive(false);
                    return next;
                  });
                }}
                onFlipHorizontal={() => handleFlipCanvas('h')}
                onFlipVertical={() => handleFlipCanvas('v')}
                onToggleDrawingGuide={() =>
                  setDrawingGuide((prev) => ({
                    ...prev,
                    type: prev.type === 'none' ? '2d_grid' : 'none',
                  }))
                }
                onOpenDrawingGuideSettings={() => setIsDrawingGuideSettingsOpen(true)}
                onExport={handleExport}
                onOpenTimeLapse={() => setIsTimeLapseOpen(true)}
                onToggleSidebarPosition={() =>
                  setSidebarPosition((prev) => (prev === 'left' ? 'right' : 'left'))
                }
                onToggleBrushCursor={() => setShowBrushCursor((prev) => !prev)}
                onOpenShortcuts={() => setIsShortcutsHelpOpen(true)}
                onInsertPhoto={handleInsertPhoto}
                onPasteClipboard={handlePasteClipboard}
                onCopyLayer={handleCopyLayer}
                onCopyCanvas={handleCopyCanvas}
                onCutLayer={handleCutLayer}
                touchPaintingEnabled={touchPaintingEnabled}
                onToggleTouchPainting={() => setTouchPaintingEnabled((p) => !p)}
                pressureCurvePoint={pressureCurvePoint}
                onChangePressureCurvePoint={(pt) => setPressureCurvePoint(pt)}
                onResetPressureCurve={() => {
                  setPressureCurvePoint({ x: 0.5, y: 0.5 });
                  showToast('Pen Pressure Curve reset to default linear (1.0x)');
                }}
                deviceMode={deviceMode}
                onChangeDeviceMode={(mode) => {
                  setDeviceMode(mode);
                  if (mode !== 'auto') {
                    setUiScale(getDefaultScaleForMode(mode));
                  } else {
                    setUiScale(getDefaultScaleForMode(detectDefaultDeviceMode()));
                  }
                }}
                uiScale={uiScale}
                onChangeUiScale={setUiScale}
                onResetUiScale={() => {
                  setUiScale(getDefaultScaleForMode(effectiveDeviceMode));
                  showToast(`UI size reset to default for ${effectiveDeviceMode}`);
                }}
                hwAcceleration={hwAcceleration}
                onToggleHwAcceleration={() => {
                  setHwAcceleration((prev) => {
                    const next = !prev;
                    showToast(next ? 'Hardware canvas acceleration enabled' : 'Hardware canvas acceleration disabled');
                    return next;
                  });
                }}
                ramProfile={ramProfile}
                onChangeRamProfile={(prof) => {
                  setRamProfile(prof);
                  showToast(`RAM Engine Profile set to ${prof.toUpperCase()}`);
                }}
                onClose={() => {
                  setIsActionsOpen(false);
                  setIsPrefsTabActive(false);
                }}
              />
            </>
          )}

          {/* Animation Assist Timeline Bar */}
          {isAnimationAssistActive && !isZenMode && (
            <AnimationAssistBar
              layers={layers}
              activeLayerId={activeLayerId}
              config={animationConfig}
              onSelectFrame={setActiveLayerId}
              onAddFrame={handleAddLayer}
              onDuplicateFrame={handleDuplicateLayer}
              onDeleteFrame={handleDeleteLayer}
              onChangeConfig={(up) => setAnimationConfig((prev) => ({ ...prev, ...up }))}
              onClose={() => setIsAnimationAssistActive(false)}
            />
          )}

          {/* Reference Window */}
          <ReferenceWindow
            isOpen={isReferenceActive && !isZenMode}
            onClose={() => setIsReferenceActive(false)}
            layers={layers}
            canvasWidth={activeArtwork.width}
            canvasHeight={activeArtwork.height}
            backgroundColor={backgroundColor}
            onSampleColor={(col) => {
              setCurrentColor(col);
              showToast(`Sampled color ${col}`);
            }}
          />

          {/* Page Assist Comic / Document Bar */}
          {isPageAssistActive && !isZenMode && (
            <PageAssistBar
              layers={layers}
              activeLayerId={activeLayerId}
              onSelectPage={setActiveLayerId}
              onNewPage={handleAddLayer}
              onClose={() => setIsPageAssistActive(false)}
            />
          )}

          {/* Drawing Guide Settings Modal */}
          {isDrawingGuideSettingsOpen && (
            <DrawingGuideSettingsModal
              guide={drawingGuide}
              canvasWidth={activeArtwork.width}
              canvasHeight={activeArtwork.height}
              canvasThumbnailUrl={activeArtwork.thumbnailUrl || layers[0]?.thumbnailUrl}
              onChangeGuide={setDrawingGuide}
              onClose={() => setIsDrawingGuideSettingsOpen(false)}
            />
          )}

          {/* Bottom-Center Docked Adjustment Layer Controls */}
          {!isZenMode && (() => {
            const activeLayer = layers.find((l) => l.id === activeLayerId);
            if (
              !activeLayer ||
              activeLayer.type !== 'adjustment' ||
              !activeLayer.adjustmentConfig ||
              dismissedAdjustmentBarLayerIds.has(activeLayer.id)
            ) {
              return null;
            }
            return (
              <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
                <AdjustmentControlBar
                  layer={activeLayer}
                  onUpdateSettings={(updatedSettings) => {
                    setLayers((prev) =>
                      prev.map((l) =>
                        l.id === activeLayer.id
                          ? {
                              ...l,
                              adjustmentConfig: {
                                ...l.adjustmentConfig!,
                                settings: updatedSettings,
                              },
                            }
                          : l
                      )
                    );
                  }}
                  onRasterize={() => handleRasterizeLayer(activeLayer.id)}
                  onReset={() => {
                    handlePushHistory();
                    setLayers((prev) =>
                      prev.map((l) =>
                        l.id === activeLayer.id
                          ? {
                              ...l,
                              adjustmentConfig: {
                                ...l.adjustmentConfig!,
                                settings: { amount: 0, val2: 0, val3: 0 },
                              },
                            }
                          : l
                      )
                    );
                    showToast(`Reset settings for ${activeLayer.name}`);
                  }}
                  onClose={() => {
                    setDismissedAdjustmentBarLayerIds((prev) => new Set(prev).add(activeLayer.id));
                  }}
                  onOpenGradientEditor={() => {
                    if (activeLayer.adjustmentConfig?.type === 'gradient_map') {
                      setIsEditingAdjLayerGradientMap(activeLayer.id);
                    }
                  }}
                />
              </div>
            );
          })()}

          {/* 2D Vector Pen & Lineart Toolbar */}
          {!isZenMode && (() => {
            const activeLayer = layers.find((l) => l.id === activeLayerId);
            if (!activeLayer || activeLayer.type !== 'vector') return null;
            return (
              <VectorPenToolbar
                editMode={vectorLayerConfig.editMode}
                onChangeEditMode={(mode) =>
                  setVectorLayerConfig((prev) => ({ ...prev, editMode: mode }))
                }
                strokeWidth={vectorLayerConfig.strokeWidth}
                onChangeStrokeWidth={(w) =>
                  setVectorLayerConfig((prev) => ({ ...prev, strokeWidth: w }))
                }
                strokeColor={vectorLayerConfig.strokeColor}
                onChangeStrokeColor={(color) => {
                  setVectorLayerConfig((prev) => ({ ...prev, strokeColor: color }));
                  setCurrentColor(color);
                }}
                hasFill={vectorLayerConfig.hasFill}
                onToggleFill={(hasFill) =>
                  setVectorLayerConfig((prev) => ({ ...prev, hasFill }))
                }
                fillColor={vectorLayerConfig.fillColor}
                onChangeFillColor={(color) =>
                  setVectorLayerConfig((prev) => ({ ...prev, fillColor: color }))
                }
                isClosed={vectorLayerConfig.isClosed}
                onToggleClosed={() =>
                  setVectorLayerConfig((prev) => ({ ...prev, isClosed: !prev.isClosed }))
                }
                brushTexture={vectorLayerConfig.brushTexture}
                onChangeBrushTexture={(tex) =>
                  setVectorLayerConfig((prev) => ({ ...prev, brushTexture: tex }))
                }
                lineCorrection={vectorLayerConfig.lineCorrection}
                onChangeLineCorrection={(intensity) =>
                  setVectorLayerConfig((prev) => ({ ...prev, lineCorrection: intensity }))
                }
                thickenFactor={vectorLayerConfig.thickenFactor}
                onChangeThickenFactor={(factor) =>
                  setVectorLayerConfig((prev) => ({ ...prev, thickenFactor: factor }))
                }
                radialRadius={vectorLayerConfig.radialRadius}
                onChangeRadialRadius={(radius) =>
                  setVectorLayerConfig((prev) => ({ ...prev, radialRadius: radius }))
                }
                onClearPoints={() => {
                  if (activeLayer) {
                    handlePushHistory();
                    activeLayer.vectorPaths = [];
                    activeLayer.ctx.clearRect(0, 0, activeArtwork.width, activeArtwork.height);
                    activeLayer.thumbnailUrl = undefined;
                    setLayers([...layers]);
                    showToast('Cleared vector lineart paths');
                  }
                }}
                onRasterize={() => handleRasterizeLayer(activeLayer.id)}
                onClose={() => {
                  setActiveTool('brush');
                }}
              />
            );
          })()}

          {/* Shortcuts & Help Modal */}
          {isShortcutsHelpOpen && (
            <ShortcutsHelpModal onClose={() => setIsShortcutsHelpOpen(false)} />
          )}

          {/* Time-Lapse Replay Modal */}
          {isTimeLapseOpen && (
            <TimeLapseModal
              canvasWidth={activeArtwork.width}
              canvasHeight={activeArtwork.height}
              backgroundColor={backgroundColor}
              strokes={recordedStrokes}
              onClose={() => setIsTimeLapseOpen(false)}
            />
          )}

          {/* Layer Effects Studio Popover */}
          {(() => {
            if (!layerEffectsTargetId) return null;
            let targetLayer = layers.find((l) => l.id === layerEffectsTargetId);
            let parentSmartLayer: Layer | undefined;
            if (!targetLayer) {
              for (const l of layers) {
                if (l.type === 'smart' && l.smartLayers) {
                  const sub = l.smartLayers.find((s) => s.id === layerEffectsTargetId);
                  if (sub) {
                    targetLayer = sub;
                    parentSmartLayer = l;
                    break;
                  }
                }
              }
            }
            if (!targetLayer) return null;
            const currentEffects = targetLayer.effects || createDefaultLayerEffects();
            return (
              <LayerEffectsModal
                layer={targetLayer}
                effects={currentEffects}
                onChangeEffects={(updated) => {
                  handlePushHistory();
                  if (parentSmartLayer) {
                    setLayers((prev) =>
                      prev.map((l) => {
                        if (l.id === parentSmartLayer!.id && l.smartLayers) {
                          const updatedSubs = l.smartLayers.map((s) =>
                            s.id === layerEffectsTargetId ? { ...s, effects: updated } : s
                          );
                          const updatedParent = { ...l, smartLayers: updatedSubs };
                          renderSmartLayerCanvas(updatedParent, activeArtwork.width, activeArtwork.height);
                          return updatedParent;
                        }
                        return l;
                      })
                    );
                  } else {
                    setLayers((prev) =>
                      prev.map((l) =>
                        l.id === layerEffectsTargetId ? { ...l, effects: updated } : l
                      )
                    );
                  }
                }}
                onRasterize={() => {
                  handlePushHistory();
                  rasterizeLayerEffects(targetLayer!);
                  if (parentSmartLayer) {
                    renderSmartLayerCanvas(parentSmartLayer, activeArtwork.width, activeArtwork.height);
                  }
                  setLayers([...layers]);
                  setLayerEffectsTargetId(null);
                  showToast(`Rasterized effects onto "${targetLayer!.name}"`);
                }}
                onClose={() => setLayerEffectsTargetId(null)}
              />
            );
          })()}

          {/* Smart Layer Contents & Sub-Layers Studio Modal */}
          {editingSmartLayerId && (() => {
            const targetSmartLayer = layers.find((l) => l.id === editingSmartLayerId);
            if (!targetSmartLayer || targetSmartLayer.type !== 'smart') return null;
            return (
              <SmartLayerEditorModal
                smartLayer={targetSmartLayer}
                activeSubLayerId={targetSmartLayer.activeSmartSubLayerId}
                currentColor={currentColor}
                canvasWidth={activeArtwork.width}
                canvasHeight={activeArtwork.height}
                onSelectSubLayer={(subId) => handleSelectSmartSubLayer(editingSmartLayerId, subId)}
                onAddSubLayer={(name, isVector) => handleAddSmartSubLayer(editingSmartLayerId, name, isVector)}
                onDuplicateSubLayer={(subId) => handleDuplicateSmartSubLayer(editingSmartLayerId, subId)}
                onDeleteSubLayer={(subId) => handleDeleteSmartSubLayer(editingSmartLayerId, subId)}
                onMoveSubLayer={(subId, dir) => handleMoveSmartSubLayer(editingSmartLayerId, subId, dir)}
                onToggleSubLayerVisibility={(subId) => handleToggleSmartSubLayerVisibility(editingSmartLayerId, subId)}
                onChangeSubLayerOpacity={(subId, op) => handleChangeSmartSubLayerOpacity(editingSmartLayerId, subId, op)}
                onChangeSubLayerBlendMode={(subId, mode) => handleChangeSmartSubLayerBlendMode(editingSmartLayerId, subId, mode)}
                onFillSubLayer={(subId, col) => handleFillSmartSubLayer(editingSmartLayerId, subId, col)}
                onClearSubLayer={(subId) => handleClearSmartSubLayer(editingSmartLayerId, subId)}
                onRenameSubLayer={(subId, name) => handleRenameSmartSubLayer(editingSmartLayerId, subId, name)}
                onToggleSubLayerLock={(subId) => handleToggleSmartSubLayerLock(editingSmartLayerId, subId)}
                onMergeDownSubLayer={(subId) => handleMergeDownSmartSubLayer(editingSmartLayerId, subId)}
                onRasterizeSubLayer={(subId) => handleRasterizeSmartSubLayer(editingSmartLayerId, subId)}
                onOpenSubLayerEffects={(subId) => setLayerEffectsTargetId(subId)}
                onUnpackSmartLayer={() => handleUnpackSmartLayer(editingSmartLayerId)}
                onClose={() => setEditingSmartLayerId(null)}
              />
            );
          })()}

          {/* Dither Suite Studio Modal */}
          {activeAdjustment === 'dither_suite' && (() => {
            const activeLayer = layers.find((l) => l.id === activeLayerId);
            if (!activeLayer) return null;
            const sourceCanvas = effectBackupCanvasRef.current || activeLayer.canvas;
            return (
              <DitherSuiteModal
                sourceCanvas={sourceCanvas}
                onPreview={(previewCanvas) => {
                  activeLayer.ctx.clearRect(0, 0, activeArtwork.width, activeArtwork.height);
                  activeLayer.ctx.drawImage(previewCanvas, 0, 0);
                  setLayers([...layers]);
                }}
                onApply={(finalCanvas, ditherConfig) => {
                  handlePushHistory();
                  if (activeLayer.type === 'smart') {
                    addSmartFilterToLayer(
                      activeLayer,
                      'Dither Suite',
                      'dither_suite',
                      {
                        val1: 0,
                        val2: 0,
                        val3: 0,
                        extraConfig: ditherConfig,
                      },
                      activeArtwork.width,
                      activeArtwork.height
                    );
                    setLayers([...layers]);
                    setActiveAdjustment(null);
                    showToast('Added Dither Suite smart filter to Smart Layer');
                    return;
                  }
                  activeLayer.ctx.clearRect(0, 0, activeArtwork.width, activeArtwork.height);
                  activeLayer.ctx.drawImage(finalCanvas, 0, 0);
                  const thumb = document.createElement('canvas');
                  thumb.width = 64;
                  thumb.height = 64;
                  thumb.getContext('2d')?.drawImage(finalCanvas, 0, 0, 64, 64);
                  activeLayer.thumbnailUrl = thumb.toDataURL();
                  setLayers([...layers]);
                  setActiveAdjustment(null);
                  showToast('Applied Dither Suite effect to layer');
                }}
                onCancel={() => {
                  if (effectBackupCanvasRef.current) {
                    activeLayer.ctx.clearRect(0, 0, activeArtwork.width, activeArtwork.height);
                    activeLayer.ctx.drawImage(effectBackupCanvasRef.current, 0, 0);
                    setLayers([...layers]);
                  }
                  setActiveAdjustment(null);
                }}
              />
            );
          })()}

          {/* Interactive Gradient Map Editor Modal */}
          {activeAdjustment === 'gradient_map' && (() => {
            const activeLayer = layers.find((l) => l.id === activeLayerId);
            if (!activeLayer) return null;
            return (
              <GradientEditorModal
                onPreview={(lut) => {
                  if (effectBackupCanvasRef.current) {
                    const temp = document.createElement('canvas');
                    temp.width = activeArtwork.width;
                    temp.height = activeArtwork.height;
                    const tCtx = temp.getContext('2d')!;
                    tCtx.drawImage(effectBackupCanvasRef.current, 0, 0);
                    const imgData = tCtx.getImageData(0, 0, activeArtwork.width, activeArtwork.height);
                    applyGradientMapToImageData(imgData, lut);
                    tCtx.putImageData(imgData, 0, 0);
                    activeLayer.ctx.clearRect(0, 0, activeArtwork.width, activeArtwork.height);
                    activeLayer.ctx.drawImage(temp, 0, 0);
                    setLayers([...layers]);
                  }
                }}
                onApply={(lut) => {
                  handlePushHistory();
                  if (effectBackupCanvasRef.current) {
                    const temp = document.createElement('canvas');
                    temp.width = activeArtwork.width;
                    temp.height = activeArtwork.height;
                    const tCtx = temp.getContext('2d')!;
                    tCtx.drawImage(effectBackupCanvasRef.current, 0, 0);
                    const imgData = tCtx.getImageData(0, 0, activeArtwork.width, activeArtwork.height);
                    applyGradientMapToImageData(imgData, lut);
                    tCtx.putImageData(imgData, 0, 0);
                    activeLayer.ctx.clearRect(0, 0, activeArtwork.width, activeArtwork.height);
                    activeLayer.ctx.drawImage(temp, 0, 0);

                    const thumb = document.createElement('canvas');
                    thumb.width = 64;
                    thumb.height = 64;
                    thumb.getContext('2d')?.drawImage(temp, 0, 0, 64, 64);
                    activeLayer.thumbnailUrl = thumb.toDataURL();
                  }
                  setLayers([...layers]);
                  setActiveAdjustment(null);
                  showToast('Applied Gradient Map effect to layer');
                }}
                onCancel={() => {
                  if (effectBackupCanvasRef.current) {
                    activeLayer.ctx.clearRect(0, 0, activeArtwork.width, activeArtwork.height);
                    activeLayer.ctx.drawImage(effectBackupCanvasRef.current, 0, 0);
                    setLayers([...layers]);
                  }
                  setActiveAdjustment(null);
                }}
              />
            );
          })()}

          {/* Interactive Gradient Map Editor Modal (For Non-Destructive Adjustment Layer) */}
          {isEditingAdjLayerGradientMap && (() => {
            const adjLayer = layers.find((l) => l.id === isEditingAdjLayerGradientMap);
            if (!adjLayer || adjLayer.type !== 'adjustment' || !adjLayer.adjustmentConfig) return null;
            const curSettings = adjLayer.adjustmentConfig.settings || {};
            return (
              <GradientEditorModal
                initialStops={curSettings.stops}
                initialShift={curSettings.shift}
                initialRepeat={curSettings.repeat}
                initialReverse={curSettings.reverse}
                onPreview={() => {}}
                onApply={(_lut, config) => {
                  handlePushHistory();
                  setLayers((prev) =>
                    prev.map((l) =>
                      l.id === adjLayer.id
                        ? {
                            ...l,
                            adjustmentConfig: {
                              ...l.adjustmentConfig!,
                              settings: {
                                ...l.adjustmentConfig!.settings,
                                stops: config.stops,
                                shift: config.shift,
                                repeat: config.repeat,
                                reverse: config.reverse,
                                opacityStops: config.opacityStops,
                                midpoints: config.midpoints,
                              },
                            },
                          }
                        : l
                    )
                  );
                  setIsEditingAdjLayerGradientMap(null);
                  showToast('Updated Gradient Map Adjustment Layer');
                }}
                onCancel={() => {
                  setIsEditingAdjLayerGradientMap(null);
                }}
              />
            );
          })()}

          {/* 5x5 POP-UP QUICK MENU */}
          {isQuickMenuOpen && (
            <div
              className="fixed inset-0 z-50 bg-neutral-950/75 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => {
                setIsQuickMenuOpen(false);
                setIsJiggleEditMode(false);
                setIsCommandPaletteOpen(false);
              }}
            >
              <div
                className="relative w-[440px] max-w-full mayan-panel p-4 rounded-2xl border-2 border-[#b89058] shadow-2xl select-none"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-[#2c3532]">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setQuickMenuTab('actions')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                        quickMenuTab === 'actions' ? 'mayan-btn-jade' : 'mayan-btn-stone'
                      }`}
                    >
                      5×5 Quick Actions
                    </button>
                    <button
                      onClick={() => setQuickMenuTab('brushes')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                        quickMenuTab === 'brushes' ? 'mayan-btn-jade' : 'mayan-btn-stone'
                      }`}
                    >
                      Quick Brushes
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {quickMenuTab === 'actions' && (
                      <button
                        onClick={() => {
                          setQuickGridSlots(DEFAULT_5X5_SLOTS);
                          try {
                            localStorage.removeItem('hunbatz_5x5_quick_slots');
                          } catch {}
                          showToast('5×5 Quick Actions Grid reset to defaults');
                        }}
                        className="mayan-btn-stone hover:border-[#5fd3ad] px-2.5 py-1 rounded-lg text-[11px] text-[#e6c699] font-medium cursor-pointer"
                        title="Reset 5×5 grid back to default preset layout"
                      >
                        Reset Grid
                      </button>
                    )}
                    {isJiggleEditMode && (
                      <button
                        onClick={() => setIsJiggleEditMode(false)}
                        className="mayan-btn-cta px-2.5 py-1 rounded-lg text-[11px] cursor-pointer"
                      >
                        Done Ordering
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setIsQuickMenuOpen(false);
                        setIsJiggleEditMode(false);
                        setIsCommandPaletteOpen(false);
                      }}
                      className="w-7 h-7 rounded-lg mayan-btn-terracotta flex items-center justify-center text-xs font-bold cursor-pointer"
                      title="Close Menu"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* TAB 1: 5x5 QUICK ACTIONS GRID */}
                {quickMenuTab === 'actions' && (
                  <div>
                    <div className="grid grid-cols-5 gap-2">
                      {quickGridSlots.map((slot, index) => {
                        const isCenterPlus = index === 12 || slot.actionId === 'PLUS_CENTER';
                        return (
                          <div key={slot.slotIndex} className="relative group w-full h-16">
                            <button
                              draggable={isJiggleEditMode && !isCenterPlus}
                              onDragStart={() => setDraggedSlotIndex(index)}
                              onDragOver={(e) => {
                                if (isJiggleEditMode && !isCenterPlus) e.preventDefault();
                              }}
                              onDrop={() => {
                                if (
                                  isJiggleEditMode &&
                                  draggedSlotIndex !== null &&
                                  draggedSlotIndex !== index &&
                                  !isCenterPlus &&
                                  draggedSlotIndex !== 12
                                ) {
                                  const updated = [...quickGridSlots];
                                  const temp = updated[draggedSlotIndex];
                                  updated[draggedSlotIndex] = updated[index];
                                  updated[index] = temp;
                                  setQuickGridSlots(updated);
                                  setDraggedSlotIndex(null);
                                }
                              }}
                              onPointerDown={() => {
                                if (isCenterPlus) return;
                                longPressTimerRef.current = setTimeout(() => {
                                  setIsJiggleEditMode(true);
                                }, 800);
                              }}
                              onPointerUp={() => {
                                if (longPressTimerRef.current) {
                                  clearTimeout(longPressTimerRef.current);
                                }
                              }}
                              onPointerLeave={() => {
                                if (longPressTimerRef.current) {
                                  clearTimeout(longPressTimerRef.current);
                                }
                              }}
                              onClick={() => {
                                if (isJiggleEditMode && !isCenterPlus) {
                                  setTargetSlotForBinding(index);
                                  setIsCommandPaletteOpen(true);
                                  return;
                                }
                                if (isCenterPlus) {
                                  setTargetSlotForBinding(null);
                                  setIsCommandPaletteOpen(true);
                                } else {
                                  executeQuickAction(slot.actionId);
                                }
                              }}
                              className={`w-full h-full rounded-xl p-1.5 flex flex-col items-center justify-center text-center transition cursor-pointer ${
                                isCenterPlus
                                  ? 'mayan-btn-cta text-base font-bold'
                                  : slot.actionId === 'empty'
                                  ? 'mayan-well opacity-60 hover:opacity-100 text-[10px]'
                                  : 'mayan-btn-stone hover:border-[#5fd3ad] text-[11px] font-medium'
                              } ${isJiggleEditMode && !isCenterPlus ? 'jiggle-active ring-1 ring-[#5fd3ad]' : ''}`}
                            >
                              {isCenterPlus ? (
                                <>
                                  <span className="text-lg leading-none">+</span>
                                  <span className="text-[9px] mt-0.5">Library</span>
                                </>
                              ) : (
                                <span className="line-clamp-2 leading-tight">{slot.label}</span>
                              )}
                            </button>

                            {!isCenterPlus && slot.actionId !== 'empty' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setQuickGridSlots((prev) =>
                                    prev.map((s, sIdx) =>
                                      sIdx === index ? { ...s, actionId: 'empty', label: '+ Empty' } : s
                                    )
                                  );
                                  showToast(`Cleared slot (${slot.label})`);
                                }}
                                className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/80 hover:bg-red-800 text-[#9e9484] hover:text-white flex items-center justify-center text-[9px] font-bold border border-[#2c3532] shadow-sm transition-opacity opacity-70 group-hover:opacity-100 cursor-pointer z-10"
                                title="Remove action from slot"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-[#e6c699]/60 mt-2.5 text-center">
                      Tip: Click X to clear a slot, hold 1s to drag order, or click Center [+] to search & bind actions.
                    </p>
                  </div>
                )}

                {/* TAB 2: FAVORITE BRUSHES */}
                {quickMenuTab === 'brushes' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setQuickMenuFavCategory('personal')}
                          className={`px-2.5 py-1 rounded text-xs cursor-pointer ${
                            quickMenuFavCategory === 'personal' ? 'mayan-btn-jade' : 'mayan-btn-stone'
                          }`}
                        >
                          Personal Favorites ({personalFavBrushIds.length})
                        </button>
                        <button
                          onClick={() => setQuickMenuFavCategory('project')}
                          className={`px-2.5 py-1 rounded text-xs cursor-pointer ${
                            quickMenuFavCategory === 'project' ? 'mayan-btn-jade' : 'mayan-btn-stone'
                          }`}
                        >
                          Project Favorites ({projectFavBrushIds.length})
                        </button>
                        <button
                          onClick={() => setQuickMenuFavCategory('recent')}
                          className={`px-2.5 py-1 rounded text-xs cursor-pointer ${
                            quickMenuFavCategory === 'recent' ? 'mayan-btn-jade' : 'mayan-btn-stone'
                          }`}
                        >
                          Recent ({recentBrushIds.length})
                        </button>
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto grid grid-cols-2 gap-2 pr-1">
                      {brushes.map((b) => {
                        const isPersonalFav = personalFavBrushIds.includes(b.id);
                        const isProjectFav = projectFavBrushIds.includes(b.id);
                        const isRecent = recentBrushIds.includes(b.id);

                        if (quickMenuFavCategory === 'personal' && !isPersonalFav) return null;
                        if (quickMenuFavCategory === 'project' && !isProjectFav) return null;
                        if (quickMenuFavCategory === 'recent' && !isRecent) return null;

                        return (
                          <div
                            key={b.id}
                            onClick={() => {
                              handleSelectBrushWithRecent(b);
                              setIsQuickMenuOpen(false);
                              showToast(`Selected Brush: ${b.name}`);
                            }}
                            className={`p-2.5 rounded-xl flex items-center justify-between cursor-pointer transition ${
                              activeBrush.id === b.id ? 'mayan-btn-jade' : 'mayan-btn-stone'
                            }`}
                          >
                            <span className="text-xs font-medium truncate">{b.name}</span>
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                title="Toggle Personal Favorite"
                                onClick={() =>
                                  setPersonalFavBrushIds((prev) =>
                                    prev.includes(b.id)
                                      ? prev.filter((id) => id !== b.id)
                                      : [...prev, b.id]
                                  )
                                }
                                className="text-xs px-1 opacity-80 hover:opacity-100"
                              >
                                {isPersonalFav ? '★' : '☆'}
                              </button>
                              <button
                                title="Toggle Project Favorite"
                                onClick={() =>
                                  setProjectFavBrushIds((prev) =>
                                    prev.includes(b.id)
                                      ? prev.filter((id) => id !== b.id)
                                      : [...prev, b.id]
                                  )
                                }
                                className="text-[10px] px-1 rounded bg-black/30"
                              >
                                {isProjectFav ? '📌' : '+Proj'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-2 border-t border-[#2c3532] flex justify-between items-center">
                      <span className="text-[11px] text-[#e6c699]/70">
                        Active: <strong>{activeBrush.name}</strong>
                      </span>
                      <button
                        onClick={() => {
                          const exists = personalFavBrushIds.includes(activeBrush.id);
                          setPersonalFavBrushIds((prev) =>
                            exists ? prev.filter((id) => id !== activeBrush.id) : [...prev, activeBrush.id]
                          );
                          setProjectFavBrushIds((prev) =>
                            prev.includes(activeBrush.id) ? prev : [...prev, activeBrush.id]
                          );
                          showToast(`Pinned "${activeBrush.name}" to Favorites!`);
                        }}
                        className="mayan-btn-cta px-2.5 py-1 rounded text-xs cursor-pointer"
                      >
                        + Pin Active Brush to Favorites
                      </button>
                    </div>
                  </div>
                )}

                {/* SEARCHABLE COMMAND PALETTE OVERLAY */}
                {isCommandPaletteOpen && (
                  <div className="absolute inset-0 z-50 bg-[#0d100f]/95 rounded-2xl p-4 flex flex-col border-2 border-[#5fd3ad]">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#2c3532]">
                      <span className="text-xs font-bold text-[#5fd3ad]">
                        Search Actions, Tools & Effects Library
                      </span>
                      <button
                        onClick={() => setIsCommandPaletteOpen(false)}
                        className="w-6 h-6 rounded mayan-btn-terracotta text-xs font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Search keywords (e.g., merge, flip, gradient, vector)..."
                      value={commandSearchQuery}
                      onChange={(e) => setCommandSearchQuery(e.target.value)}
                      autoFocus
                      className="w-full mayan-well px-3 py-2 rounded-lg text-xs mb-2.5 outline-none border border-[#5fd3ad]/50"
                    />
                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                      {AVAILABLE_QUICK_ACTIONS.filter(
                        (a) =>
                          a.label.toLowerCase().includes(commandSearchQuery.toLowerCase()) ||
                          a.category.toLowerCase().includes(commandSearchQuery.toLowerCase())
                      ).map((action) => (
                        <div
                          key={action.id}
                          onClick={() => {
                            const slotToUpdate =
                              targetSlotForBinding !== null
                                ? targetSlotForBinding
                                : quickGridSlots.findIndex(
                                    (s, idx) => idx !== 12 && s.actionId === 'empty'
                                  );
                            const validSlot = slotToUpdate !== -1 ? slotToUpdate : 0;
                            setQuickGridSlots((prev) =>
                              prev.map((s, idx) =>
                                idx === validSlot
                                  ? { ...s, actionId: action.id, label: action.label }
                                  : s
                              )
                            );
                            setIsCommandPaletteOpen(false);
                            showToast(`Added "${action.label}" to 5×5 Grid!`);
                          }}
                          className="p-2 rounded-lg mayan-btn-stone flex items-center justify-between cursor-pointer hover:border-[#5fd3ad]"
                        >
                          <span className="text-xs font-medium">{action.label}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-black/40 text-[#5fd3ad]">
                            {action.category}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Floating Tip Angle, Roundness & Pen Controls Widget */}
          {!isZenMode && (activeTool === 'brush' || activeTool === 'smudge' || activeTool === 'eraser') && layers.find((l) => l.id === activeLayerId)?.type !== 'vector' && (
            <div
              className="fixed bottom-4 right-4 z-40 mayan-panel p-2.5 rounded-2xl border-2 border-[#b89058] shadow-2xl flex flex-col items-center gap-2 select-none backdrop-blur-md animate-in slide-in-from-bottom-2 duration-150"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between w-full px-1 gap-2">
                <span className="text-[10px] font-mayan font-bold uppercase tracking-wider text-[#b89058]">
                  Tip & Pen
                </span>
                <button
                  onClick={() => setIsBrushStudioOpen(true)}
                  className="text-[10px] font-semibold text-[#5fd3ad] hover:text-white flex items-center gap-1 cursor-pointer bg-white/5 hover:bg-white/10 px-1.5 py-0.5 rounded transition"
                  title="Open Brush Studio"
                >
                  <Settings2 size={11} />
                  Studio
                </button>
              </div>
              <BrushTipGizmo
                angle={
                  activeBrush.shape?.rotation ??
                  (activeBrush.shape as any)?.angle ??
                  (activeBrush as any).angle ??
                  0
                }
                roundness={
                  activeBrush.shape?.roundness ??
                  (activeBrush as any).roundness ??
                  1
                }
                penTiltControl={Boolean((activeBrush.shape as any)?.penTiltControl)}
                onChange={(ang, rnd, tiltCtrl) => {
                  const updated: Brush = {
                    ...activeBrush,
                    shape: {
                      ...(activeBrush.shape || {
                        texture: activeBrush.texture || 'hard_round',
                        scatter: 0,
                        rotation: 0,
                        followStroke: false,
                        count: 1,
                        countJitter: 0,
                        roundness: 1,
                      }),
                      rotation: ang,
                      roundness: rnd,
                      ...({ angle: ang, penTiltControl: Boolean(tiltCtrl) } as any),
                    },
                  };
                  setBrushes((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
                  setActiveBrush(updated);
                }}
                size={94}
                showNumericInputs={true}
                showTiltButton={true}
              />
            </div>
          )}

          {/* Full-Screen Brush Studio Modal */}
          {isBrushStudioOpen && (
            <BrushStudioModal
              brush={activeBrush}
              allBrushes={brushes}
              onSelectPreset={(b) => {
                const targetSize = Number(b.size) || Number((b as any).baseSize) || 24;
                const pct = Math.max(1, Math.min(100, Math.round((targetSize / 400) * 100)));
                setBrushSize(pct);
                setActiveBrush(b);
              }}
              onSave={(updated) => {
                const asBrush = universalToBrush(updated);
                asBrush.size = updated.baseSize;
                (asBrush as any).baseSize = updated.baseSize;
                setBrushes((prev) => {
                  const exists = prev.some((b) => b.id === asBrush.id);
                  if (exists) {
                    return prev.map((b) => (b.id === asBrush.id ? asBrush : b));
                  } else {
                    return [asBrush, ...prev];
                  }
                });
                saveLocalBrush(asBrush, asBrush.category || 'Inking').catch(() => {});
                const pct = Math.max(1, Math.min(100, Math.round((updated.baseSize / 400) * 100)));
                setBrushSize(pct);
                setActiveBrush(asBrush);
                setIsBrushStudioOpen(false);
                showToast(`Saved brush: ${asBrush.name}`);
              }}
              onUpdateBrush={(updated) => {
                const targetSize = Number(updated.size) || Number((updated as any).baseSize) || 24;
                const pct = Math.max(1, Math.min(100, Math.round((targetSize / 400) * 100)));
                setBrushSize(pct);
                setBrushes((prev) => {
                  const exists = prev.some((b) => b.id === updated.id);
                  if (exists) {
                    return prev.map((b) => (b.id === updated.id ? updated : b));
                  } else {
                    return [updated, ...prev];
                  }
                });
                saveLocalBrush(updated, updated.category || 'Inking').catch(() => {});
                setActiveBrush(updated);
                showToast(`Updated brush: ${updated.name}`);
              }}
              onImportBrushes={(imported) => {
                const asBrushes = imported.map((u) => universalToBrush(u));
                setBrushes((prev) => [...asBrushes, ...prev]);
                asBrushes.forEach((b) => saveLocalBrush(b, b.category || 'Inking').catch(() => {}));
                if (asBrushes[0]) setActiveBrush(asBrushes[0]);
                showToast(
                  `Imported ${asBrushes.length} brush${asBrushes.length === 1 ? '' : 'es'} to Studio!`
                );
              }}
              onDuplicateBrush={(cloned) => {
                setBrushes((prev) => [cloned, ...prev]);
                saveLocalBrush(cloned, cloned.category || 'Inking').catch(() => {});
                setActiveBrush(cloned);
                showToast(`Duplicated "${cloned.name}" to Library`);
              }}
              onDeleteBrush={(idToDelete) => {
                if (brushes.length <= 1) {
                  showToast('Cannot delete the only remaining brush');
                  return;
                }
                const target = brushes.find((b) => b.id === idToDelete);
                if (target) {
                  deleteLocalBrush(target.category || 'Inking', (target as any).localFileName, target.name).catch(() => {});
                }
                const remaining = brushes.filter((b) => b.id !== idToDelete);
                setBrushes(remaining);
                if (activeBrush.id === idToDelete && remaining[0]) {
                  setActiveBrush(remaining[0]);
                }
                setIsBrushStudioOpen(false);
                showToast('Deleted brush from library');
              }}
              onClose={() => setIsBrushStudioOpen(false)}
            />
          )}

          {/* Zen Mode Exit Button */}
          {isZenMode && (
            <button
              onClick={() => setIsZenMode(false)}
              className="fixed top-4 right-4 z-50 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/20 text-xs text-white/80 hover:text-white transition-all shadow-xl cursor-pointer"
            >
              Exit Zen Mode (Tab)
            </button>
          )}
        </div>
      )}
    </div>
  );
}