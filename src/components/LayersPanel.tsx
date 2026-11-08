import React, { useState, useRef, useEffect } from 'react';
import { Layer, BlendMode, AdjustmentLayerConfig, SmartFilter, ActiveAdjustment } from '../types/canvas';
import {
  BLEND_MODE_LABELS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  KRITA_BLEND_MODE_GROUPS,
  getStoredFavoriteBlendModes,
  type KritaBlendMode,
  type BlendModeCategory,
} from '../utils/blendModes';
import {
  Plus,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Layers as LayersIcon,
  Check,
  MoreHorizontal,
  Eraser,
  ArrowDownToLine,
  Sliders,
  Sparkles,
  Spline,
  CornerDownRight,
  SunMedium,
  Contrast,
  SlidersHorizontal,
  FolderPlus,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  Wand2,
  Flame,
  Camera,
  Film,
  Pipette,
  Search,
  RotateCcw,
  RefreshCw,
  Boxes,
} from 'lucide-react';
import { hasActiveEffects } from '../utils/layerEffectsEngine';
import { MayanCornerBrackets } from './MayanDecorations';

interface LayersPanelProps {
  layers: Layer[];
  activeLayerId: string;
  activeMaskLayerId?: string | null;
  backgroundColor: string;
  // Selection & Masks
  onSelectLayer: (id: string) => void;
  onSelectLayerMask?: (id: string) => void;
  onAddLayerMask?: (id: string) => void;
  onDeleteLayerMask?: (id: string) => void;
  onToggleMaskVisibility?: (id: string) => void;
  onChangeMaskProperties?: (id: string, properties: { density?: number; feather?: number }) => void;
  onInvertMask?: (id: string) => void;
  onResetMask?: (id: string) => void;
  onToggleClippingMask?: (id: string) => void;
  onGroupSelectedLayers?: (ids: string[]) => void;
  // Creation
  onAddLayer: () => void;
  onAddGroup?: () => void;
  onAddVectorLayer?: () => void;
  onAddAdjustmentLayer?: (type: AdjustmentLayerConfig['type']) => void;
  onRasterizeLayer?: (id: string) => void;
  // Actions
  onDeleteLayer: (id: string) => void;
  onDuplicateLayer: (id: string) => void;
  onClearLayer: (id: string) => void;
  onMergeDown: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleAlphaLock?: (id: string) => void;
  onToggleLock: (id: string) => void;
  onChangeOpacity: (id: string, opacity: number) => void;
  onChangeBlendMode: (id: string, mode: BlendMode) => void;
  onMoveLayer: (id: string, direction: 'up' | 'down') => void;
  onReorderLayers?: (newLayers: Layer[]) => void;
  onToggleExpandGroup?: (groupId: string) => void;
  onChangeBackgroundColor: (color: string) => void;
  onOpenLayerEffects?: (id: string) => void;
  onSelectLayerPixels?: (id: string) => void;
  // Photoshop-Parity Smart Layer & Flatten Actions
  onConvertToSmartLayer?: (id: string) => void;
  onUnpackSmartLayer?: (id: string) => void;
  onFlattenGroup?: (id: string) => void;
  onFlattenSmartLayer?: (id: string) => void;
  onFlattenAllLayers?: () => void;
  onEditSmartLayerContents?: (id: string) => void;
  editingSmartLayerId?: string | null;
  // Photoshop-Parity Smart Filters Non-Destructive Actions
  onToggleSmartFilter?: (layerId: string, filterId: string) => void;
  onToggleAllSmartFilters?: (layerId: string) => void;
  onReorderSmartFilter?: (layerId: string, filterId: string, direction: 'up' | 'down') => void;
  onDeleteSmartFilter?: (layerId: string, filterId: string) => void;
  onEditSmartFilter?: (layerId: string, filter: SmartFilter) => void;
  onAddSmartFilter?: (layerId: string, type: ActiveAdjustment) => void;
  onToggleExpandSmartFilters?: (layerId: string) => void;
  onClose: () => void;
}

const BLEND_MODES: { label: string; mode: BlendMode; letter: string }[] = [
  { label: 'Normal', mode: 'source-over', letter: 'N' },
  { label: 'Multiply', mode: 'multiply', letter: 'M' },
  { label: 'Screen', mode: 'screen', letter: 'S' },
  { label: 'Overlay', mode: 'overlay', letter: 'O' },
  { label: 'Darken', mode: 'darken', letter: 'D' },
  { label: 'Lighten', mode: 'lighten', letter: 'L' },
  { label: 'Color Dodge', mode: 'color-dodge', letter: 'CD' },
  { label: 'Color Burn', mode: 'color-burn', letter: 'CB' },
  { label: 'Soft Light', mode: 'soft-light', letter: 'SL' },
  { label: 'Hard Light', mode: 'hard-light', letter: 'HL' },
  { label: 'Difference', mode: 'difference', letter: 'DF' },
  { label: 'Exclusion', mode: 'exclusion', letter: 'EX' },
];

export const LayersPanel: React.FC<LayersPanelProps> = ({
  layers,
  activeLayerId,
  activeMaskLayerId,
  backgroundColor,
  onSelectLayer,
  onSelectLayerMask,
  onAddLayerMask,
  onDeleteLayerMask,
  onToggleMaskVisibility,
  onChangeMaskProperties,
  onInvertMask,
  onResetMask,
  onToggleClippingMask,
  onGroupSelectedLayers,
  onAddLayer,
  onAddGroup,
  onAddVectorLayer,
  onAddAdjustmentLayer,
  onRasterizeLayer,
  onDeleteLayer,
  onDuplicateLayer,
  onClearLayer,
  onMergeDown,
  onToggleVisibility,
  onToggleAlphaLock,
  onToggleLock,
  onChangeOpacity,
  onChangeBlendMode,
  onMoveLayer,
  onReorderLayers,
  onToggleExpandGroup,
  onChangeBackgroundColor,
  onOpenLayerEffects,
  onSelectLayerPixels,
  onConvertToSmartLayer,
  onUnpackSmartLayer,
  onFlattenGroup,
  onFlattenSmartLayer,
  onFlattenAllLayers,
  onEditSmartLayerContents,
  editingSmartLayerId,
  onToggleSmartFilter,
  onToggleAllSmartFilters,
  onReorderSmartFilter,
  onDeleteSmartFilter,
  onEditSmartFilter,
  onAddSmartFilter,
  onToggleExpandSmartFilters,
  onClose,
}) => {
  const [blendMenuLayerId, setBlendMenuLayerId] = useState<string | null>(null);
  const [contextMenuLayerId, setContextMenuLayerId] = useState<string | null>(null);
  const [isAdjustmentMenuOpen, setIsAdjustmentMenuOpen] = useState(false);
  const [addFilterMenuLayerId, setAddFilterMenuLayerId] = useState<string | null>(null);

  // Multi-Selection State (Desktop Shift/Ctrl + Touch Swipe right-to-left)
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([activeLayerId]);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    if (activeLayerId && !selectedLayerIds.includes(activeLayerId)) {
      setSelectedLayerIds([activeLayerId]);
    }
  }, [activeLayerId]);

  // Drag and Drop State
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null);
  const [dropZone, setDropZone] = useState<'above' | 'below' | 'inside' | 'out_to_root' | null>(null);

  const [layerBlendCategory, setLayerBlendCategory] = useState<BlendModeCategory>('favorites');
  const [layerBlendSearch, setLayerBlendSearch] = useState('');
  const [favoriteModes] = useState<KritaBlendMode[]>(() => getStoredFavoriteBlendModes());

  const getBlendModeLetter = (mode: BlendMode | string) => {
    const found = BLEND_MODES.find((b) => b.mode === mode);
    if (found) return found.letter;
    const label = BLEND_MODE_LABELS[mode as KritaBlendMode];
    if (label) {
      const words = label.split(' ');
      if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
      return label.slice(0, 2).toUpperCase();
    }
    return 'N';
  };

  const bottomLayer = layers[0];
  const isBottomLayerOpaque =
    bottomLayer &&
    bottomLayer.visible &&
    bottomLayer.opacity >= 0.98 &&
    bottomLayer.blendMode === 'source-over';

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, layerId: string) => {
    e.dataTransfer.setData('text/plain', layerId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedLayerId(layerId);
  };

  const handleDragOverRow = (
    e: React.DragEvent<HTMLDivElement>,
    targetLayer: Layer
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedLayerId || draggedLayerId === targetLayer.id) {
      setDragOverTargetId(null);
      setDropZone(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const offsetX = e.clientX - rect.left;

    // Pull out to root gutter check (dragging to left edge or gutter)
    if (offsetX < 24) {
      setDragOverTargetId(targetLayer.id);
      setDropZone('out_to_root');
      return;
    }

    if (targetLayer.type === 'group') {
      // Over a group row: top 25% = above, bottom 25% = below, middle 50% = inside folder
      if (offsetY < rect.height * 0.25) {
        setDragOverTargetId(targetLayer.id);
        setDropZone('above');
      } else if (offsetY > rect.height * 0.75) {
        setDragOverTargetId(targetLayer.id);
        setDropZone('below');
      } else {
        setDragOverTargetId(targetLayer.id);
        setDropZone('inside');
      }
    } else {
      // Normal layer: top 50% = above, bottom 50% = below
      if (offsetY < rect.height * 0.5) {
        setDragOverTargetId(targetLayer.id);
        setDropZone('above');
      } else {
        setDragOverTargetId(targetLayer.id);
        setDropZone('below');
      }
    }
  };

  const handleDropOnRow = (
    e: React.DragEvent<HTMLDivElement>,
    targetLayer: Layer
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const movingId = draggedLayerId || e.dataTransfer.getData('text/plain');
    if (!movingId || movingId === targetLayer.id) {
      setDraggedLayerId(null);
      setDragOverTargetId(null);
      setDropZone(null);
      return;
    }

    const movingIndex = layers.findIndex((l) => l.id === movingId);
    const targetIndex = layers.findIndex((l) => l.id === targetLayer.id);
    if (movingIndex < 0 || targetIndex < 0) return;

    const newLayers = [...layers];
    const [movedLayer] = newLayers.splice(movingIndex, 1);

    if (dropZone === 'inside' && targetLayer.type === 'group') {
      // Drop inside group
      movedLayer.parentId = targetLayer.id;
      // Insert right after the group in reverse array (which is right below it in UI)
      const newTargetIndex = newLayers.findIndex((l) => l.id === targetLayer.id);
      newLayers.splice(newTargetIndex, 0, movedLayer);
    } else if (dropZone === 'above') {
      // Insert above target layer in visual stack (which is after target in ascending array)
      const newTargetIndex = newLayers.findIndex((l) => l.id === targetLayer.id);
      movedLayer.parentId = targetLayer.parentId;
      newLayers.splice(newTargetIndex + 1, 0, movedLayer);
    } else if (dropZone === 'below') {
      // Insert below target layer in visual stack (which is before target in ascending array)
      const newTargetIndex = newLayers.findIndex((l) => l.id === targetLayer.id);
      movedLayer.parentId = targetLayer.parentId;
      newLayers.splice(newTargetIndex, 0, movedLayer);
    } else if (dropZone === 'out_to_root') {
      // Pull out of group cleanly to root stack
      movedLayer.parentId = null;
      const newTargetIndex = newLayers.findIndex((l) => l.id === targetLayer.id);
      newLayers.splice(newTargetIndex + 1, 0, movedLayer);
    }

    onReorderLayers?.(newLayers);
    setDraggedLayerId(null);
    setDragOverTargetId(null);
    setDropZone(null);
  };

  const handleDropOnRootArea = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedLayerId) return;
    const movingIndex = layers.findIndex((l) => l.id === draggedLayerId);
    if (movingIndex < 0) return;

    const newLayers = [...layers];
    const [moved] = newLayers.splice(movingIndex, 1);
    moved.parentId = null; // Un-nest to root
    newLayers.push(moved); // Put at top of stack

    onReorderLayers?.(newLayers);
    setDraggedLayerId(null);
    setDragOverTargetId(null);
    setDropZone(null);
  };

  return (
    <div
      className="absolute top-14 right-16 z-50 w-96 mayan-panel border-2 border-[#2c3532] shadow-[0_16px_50px_rgba(0,0,0,0.95)] p-4 text-[#e6c699] flex flex-col gap-2.5 select-none animate-in fade-in zoom-in-95 duration-150 max-h-[84vh]"
      onClick={(e) => {
        e.stopPropagation();
        setContextMenuLayerId(null);
        setIsAdjustmentMenuOpen(false);
      }}
    >
      <MayanCornerBrackets size={16} color="#b89058" />

      {/* Header Actions Strip */}
      <div className="flex items-center justify-between pb-2 border-b border-[#2c3532]">
        <div className="flex items-center gap-1.5">
          <LayersIcon size={16} className="text-[#b89058]" />
          <span className="text-xs font-mayan font-bold uppercase tracking-wider text-[#b89058]">
            Layers ({layers.length})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* + Group Folder Button / Group Selected */}
          {(onAddGroup || onGroupSelectedLayers) && (
            <button
              onClick={() => {
                if (selectedLayerIds.length > 1 && onGroupSelectedLayers) {
                  onGroupSelectedLayers(selectedLayerIds);
                  setSelectedLayerIds([]);
                } else if (onAddGroup) {
                  onAddGroup();
                }
              }}
              title={
                selectedLayerIds.length > 1
                  ? `Group ${selectedLayerIds.length} Selected Layers simultaneously`
                  : 'Create Layer Group Folder'
              }
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold text-[11px] shadow-sm transition-all cursor-pointer active:scale-95 ${
                selectedLayerIds.length > 1
                  ? 'mayan-btn-jade ring-2 ring-[#5fd3ad] text-white shadow-[0_0_12px_rgba(95,211,173,0.5)]'
                  : 'mayan-btn-stone hover:border-[#b89058] text-[#e6c699]'
              }`}
            >
              <FolderPlus size={12} className={selectedLayerIds.length > 1 ? 'text-[#5fd3ad]' : 'text-[#b89058]'} />
              <span>{selectedLayerIds.length > 1 ? `Group (${selectedLayerIds.length})` : '+ Group'}</span>
            </button>
          )}

          {/* + Vector Layer Button */}
          {onAddVectorLayer && (
            <button
              onClick={onAddVectorLayer}
              title="Add New Vector Layer for Lineart & Paths"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg mayan-btn-stone hover:border-[#b89058] text-[#e6c699] font-semibold text-[11px] shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <Spline size={12} className="text-[#5fd3ad]" />
              <span>+ Vector</span>
            </button>
          )}

          {/* + Adjustment Layer Dropdown Button */}
          {onAddAdjustmentLayer && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAdjustmentMenuOpen(!isAdjustmentMenuOpen);
                }}
                title="Add Non-Destructive Adjustment Layer"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg mayan-btn-stone hover:border-[#b89058] text-[#e6c699] font-semibold text-[11px] shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <SlidersHorizontal size={12} className="text-[#b89058]" />
                <span>+ Adjust</span>
              </button>

              {/* Adjustment Layer Picker Dropdown */}
              {isAdjustmentMenuOpen && (
                <div
                  className="absolute right-0 top-8 z-50 w-60 mayan-panel border-2 border-[#b89058]/70 rounded-xl shadow-2xl p-1.5 text-xs text-[#e6c699] flex flex-col gap-0.5 animate-in fade-in duration-100 max-h-80 overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[10px] font-mayan font-bold uppercase tracking-wider text-[#b89058] px-2 py-1">
                    New Adjustment Layer
                  </span>
                  {[
                    { id: 'relight', label: '✨ 3D Relight Studio' },
                    { id: 'gradient_map', label: 'Gradient Map' },
                    { id: 'selective_color', label: 'Selective Color' },
                    { id: 'color_lookup', label: 'Color Lookup (3D LUT)' },
                    { id: 'photo_filter', label: 'Photo Filter' },
                    { id: 'style_filters', label: 'Style Filters (24 Styles)' },
                    { id: 'exposure', label: 'Exposure' },
                    { id: 'thermal', label: 'Thermal Effect' },
                    { id: 'curves', label: 'Curves' },
                    { id: 'hue_saturation', label: 'Hue / Saturation' },
                    { id: 'gradient_fill', label: 'Gradient Fill' },
                    { id: 'black_and_white', label: 'Black & White' },
                    { id: 'brightness_contrast', label: 'Brightness & Contrast' },
                    { id: 'invert', label: 'Invert' },
                    { id: 'threshold', label: 'Threshold' },
                    { id: 'posterize', label: 'Posterize' },
                  ].map((adj) => (
                    <button
                      key={adj.id}
                      onClick={() => {
                        onAddAdjustmentLayer(adj.id as AdjustmentLayerConfig['type']);
                        setIsAdjustmentMenuOpen(false);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-left hover:bg-white/10 text-[#e6c699] hover:text-[#fff6e5] transition-colors cursor-pointer text-[11px] flex items-center justify-between"
                    >
                      <span>{adj.label}</span>
                      <span className="text-[9px] font-mono text-[#5fd3ad]">Live</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* + Standard Raster Layer Button */}
          <button
            onClick={onAddLayer}
            title="Add New Painting Layer"
            className="p-1 rounded-lg mayan-btn-jade text-white transition-transform active:scale-95 cursor-pointer shadow-sm"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Layers List (Top of stack rendered first, with full group hierarchy) */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={handleDropOnRootArea}
        className="flex flex-col gap-1.5 overflow-y-auto pr-1 max-h-[500px]"
      >
        {layers
          .slice()
          .reverse()
          .map((layer, index) => {
            const isTop = index === 0;
            const isBottom = index === layers.length - 1;
            const isLayerActive = layer.id === activeLayerId && !activeMaskLayerId;
            const isMaskActive = activeMaskLayerId === layer.id;
            const hasEffects = layer.effects && hasActiveEffects(layer.effects);
            const isAdjustment = layer.type === 'adjustment';
            const isGroup = layer.type === 'group';

            // Check if this layer is inside a collapsed parent group
            if (layer.parentId) {
              const parentGroup = layers.find((l) => l.id === layer.parentId && l.type === 'group');
              if (parentGroup && parentGroup.isExpanded === false) {
                return null; // Group is collapsed, hide child row
              }
            }

            const childLayers = isGroup ? layers.filter((l) => l.parentId === layer.id) : [];
            const isDraggingOver = dragOverTargetId === layer.id;
            const isThisDragged = draggedLayerId === layer.id;

            // GROUP HEADER ROW
            if (isGroup) {
              const isExpanded = layer.isExpanded !== false;
              return (
                <div key={layer.id} className="flex flex-col">
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, layer.id)}
                    onDragOver={(e) => handleDragOverRow(e, layer)}
                    onDrop={(e) => handleDropOnRow(e, layer)}
                    onDragEnd={() => {
                      setDraggedLayerId(null);
                      setDragOverTargetId(null);
                      setDropZone(null);
                    }}
                    onTouchStart={(e) => {
                      touchStartXRef.current = e.touches[0].clientX;
                      touchStartYRef.current = e.touches[0].clientY;
                    }}
                    onTouchEnd={(e) => {
                      if (touchStartXRef.current !== null && touchStartYRef.current !== null) {
                        const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
                        const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
                        if (deltaX < -35 && Math.abs(deltaY) < 40) {
                          setSelectedLayerIds((prev) =>
                            prev.includes(layer.id)
                              ? (prev.length > 1 ? prev.filter((id) => id !== layer.id) : prev)
                              : [...prev, layer.id]
                          );
                          onSelectLayer(layer.id);
                        }
                      }
                      touchStartXRef.current = null;
                      touchStartYRef.current = null;
                    }}
                    onClick={(e) => {
                      if (e.shiftKey) {
                        e.stopPropagation();
                        const fromIdx = layers.findIndex((l) => l.id === activeLayerId);
                        const toIdx = layers.findIndex((l) => l.id === layer.id);
                        if (fromIdx !== -1 && toIdx !== -1) {
                          const minI = Math.min(fromIdx, toIdx);
                          const maxI = Math.max(fromIdx, toIdx);
                          const rangeIds = layers.slice(minI, maxI + 1).map((l) => l.id);
                          setSelectedLayerIds(Array.from(new Set([...selectedLayerIds, ...rangeIds])));
                        } else {
                          setSelectedLayerIds([layer.id]);
                          onSelectLayer(layer.id);
                        }
                      } else if (e.ctrlKey || e.metaKey) {
                        e.stopPropagation();
                        setSelectedLayerIds((prev) =>
                          prev.includes(layer.id)
                            ? (prev.length > 1 ? prev.filter((id) => id !== layer.id) : prev)
                            : [...prev, layer.id]
                        );
                        onSelectLayer(layer.id);
                      } else {
                        setSelectedLayerIds([layer.id]);
                        onSelectLayer(layer.id);
                      }
                    }}
                    className={`group relative flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isThisDragged ? 'opacity-40 border-dashed' : ''
                    } ${
                      isDraggingOver && dropZone === 'inside'
                        ? 'ring-2 ring-[#5fd3ad] bg-[#5fd3ad]/15 border-[#5fd3ad]'
                        : isDraggingOver && dropZone === 'above'
                        ? 'border-t-2 border-t-[#5fd3ad]'
                        : isDraggingOver && dropZone === 'below'
                        ? 'border-b-2 border-b-[#5fd3ad]'
                        : selectedLayerIds.includes(layer.id) && selectedLayerIds.length > 1
                        ? 'ring-2 ring-[#5fd3ad] bg-[#164435]/40 border-[#5fd3ad] shadow-[0_0_12px_rgba(95,211,173,0.35)]'
                        : isLayerActive
                        ? 'mayan-panel border-2 border-[#b89058] shadow-[0_0_12px_rgba(184,144,88,0.3)] ring-1 ring-[#b89058]/40'
                        : 'mayan-well border-[#2c3532] hover:border-[#b89058]/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleExpandGroup?.(layer.id);
                        }}
                        className="text-[#b89058] hover:text-white cursor-pointer"
                        title={isExpanded ? 'Collapse folder' : 'Expand folder'}
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      {isExpanded ? (
                        <FolderOpen size={16} className="text-[#5fd3ad] shrink-0" />
                      ) : (
                        <Folder size={16} className="text-[#b89058] shrink-0" />
                      )}
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-xs font-bold text-[#f2fbf7] truncate">
                            {layer.name}
                          </span>
                          <span className="text-[10px] font-mono text-white/40 shrink-0">
                            ({childLayers.length})
                          </span>
                          {layer.locked && <Lock size={12} className="text-[#b89058] shrink-0 ml-1" />}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-[#9e9484]">
                          <span>{Math.round(layer.opacity * 100)}%</span>
                          {hasEffects && <span className="text-[#5fd3ad] font-bold">fx</span>}
                          {layer.mask && <span className="text-[#5fd3ad]">· Masked</span>}
                          {layer.locked && <span className="text-[#b89058]">· Locked</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setBlendMenuLayerId(blendMenuLayerId === layer.id ? null : layer.id);
                          if (contextMenuLayerId === layer.id) setContextMenuLayerId(null);
                        }}
                        title="Change Group Blend Mode & Opacity"
                        className="w-6 h-6 rounded-md mayan-btn-stone flex items-center justify-center text-[10px] font-bold text-[#e6c699] transition-colors cursor-pointer shrink-0"
                      >
                        {getBlendModeLetter(layer.blendMode)}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenLayerEffects?.(layer.id);
                        }}
                        title="Group Layer Effects (FX)"
                        className={`px-1.5 h-6 rounded-md border flex items-center justify-center text-[10px] font-mono font-bold transition-all cursor-pointer shrink-0 ${
                          hasEffects
                            ? 'bg-blue-600 border-blue-400 text-white shadow-sm ring-1 ring-blue-400/50'
                            : 'bg-white/5 hover:bg-white/15 border-white/10 text-white/60 hover:text-white'
                        }`}
                      >
                        fx
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleVisibility(layer.id);
                        }}
                        title={layer.visible ? 'Hide Group' : 'Show Group'}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-white/50 hover:text-white transition-colors cursor-pointer shrink-0"
                      >
                        {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setContextMenuLayerId(contextMenuLayerId === layer.id ? null : layer.id);
                          if (blendMenuLayerId === layer.id) setBlendMenuLayerId(null);
                        }}
                        title="Group Actions"
                        className={`p-1 rounded-md transition-colors cursor-pointer ${
                          contextMenuLayerId === layer.id
                            ? 'text-white bg-white/20'
                            : 'text-white/40 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <MoreHorizontal size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Group Blend Mode & Opacity Drawer */}
                  {blendMenuLayerId === layer.id && (
                    <div
                      className="mt-2 p-2.5 rounded-xl bg-[#14151b] border border-white/10 flex flex-col gap-2 animate-in slide-in-from-top-1 duration-150"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-white/50 uppercase tracking-wider">
                          Group Opacity
                        </span>
                        <div className="flex items-center gap-2 flex-1 max-w-[170px]">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={Math.round(layer.opacity * 100)}
                            onChange={(e) =>
                              onChangeOpacity(layer.id, parseInt(e.target.value) / 100)
                            }
                            className="w-full h-1.5 bg-white/10 accent-[#5fd3ad] rounded-lg cursor-pointer"
                          />
                          <span className="text-[10px] font-mono text-[#5fd3ad] w-8 text-right font-bold">
                            {Math.round(layer.opacity * 100)}%
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 pt-1 border-t border-white/5">
                        <span className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Group Blend Mode</span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 max-h-36 overflow-y-auto pr-1">
                          {KRITA_BLEND_MODE_GROUPS.favorites.map((b) => (
                            <button
                              key={b.id}
                              title={b.name}
                              onClick={() => onChangeBlendMode(layer.id, b.id as BlendMode)}
                              className={`px-1.5 py-1 rounded text-[10px] font-medium text-left truncate transition-colors cursor-pointer flex items-center justify-between ${
                                layer.blendMode === b.id
                                  ? 'bg-[#18392b] text-[#5bf5a4] font-semibold border border-[#2e684a]'
                                  : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              <span className="truncate">{b.name}</span>
                              {layer.blendMode === b.id && <Check size={10} className="shrink-0 text-[#5bf5a4] ml-1" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Group Context Menu Actions Drawer */}
                  {contextMenuLayerId === layer.id && (
                    <div
                      className="mt-2 p-2.5 rounded-xl bg-[#14151b] border border-white/10 flex flex-col gap-1.5 animate-in slide-in-from-top-1 duration-150 text-xs text-white"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between pb-1 border-b border-white/5 text-[10px] text-white/50 uppercase tracking-wider font-semibold">
                        <span>Group Actions</span>
                        <button
                          onClick={() => setContextMenuLayerId(null)}
                          className="hover:text-white cursor-pointer text-xs"
                          title="Close Actions"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-1">
                        {onConvertToSmartLayer && (
                          <button
                            onClick={() => {
                              onConvertToSmartLayer(layer.id);
                              setContextMenuLayerId(null);
                            }}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#164435]/70 hover:bg-[#1f5c48] text-[#5fd3ad] text-left cursor-pointer border border-[#5fd3ad]/40 font-semibold col-span-2 shadow-sm transition-all active:scale-95"
                            title="Convert Group into Photoshop-parity Smart Layer (encapsulates child layers non-destructively)"
                          >
                            <Boxes size={14} className="text-[#5fd3ad]" />
                            <span>Convert to Smart Layer</span>
                          </button>
                        )}

                        {onFlattenGroup && (
                          <button
                            onClick={() => {
                              onFlattenGroup(layer.id);
                              setContextMenuLayerId(null);
                            }}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-[#f2fbf7] text-left cursor-pointer font-medium"
                            title="Flatten group and all its child layers into a single raster image layer"
                          >
                            <ArrowDownToLine size={13} className="text-[#5fd3ad]" />
                            <span>Flatten to Image</span>
                          </button>
                        )}

                        {onFlattenAllLayers && (
                          <button
                            onClick={() => {
                              onFlattenAllLayers();
                              setContextMenuLayerId(null);
                            }}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-[#e6c699] text-left cursor-pointer font-medium"
                            title="Flatten entire image (all visible layers) into a single flat background image"
                          >
                            <ImageIcon size={13} className="text-[#b89058]" />
                            <span>Flatten Image</span>
                          </button>
                        )}

                        {!layer.mask && onAddLayerMask && (
                          <button
                            onClick={() => {
                              onAddLayerMask(layer.id);
                              setContextMenuLayerId(null);
                            }}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-left cursor-pointer text-blue-300 font-medium"
                          >
                            <Plus size={13} />
                            <span>Add Group Mask</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            onDuplicateLayer(layer.id);
                            setContextMenuLayerId(null);
                          }}
                          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/80 text-left cursor-pointer"
                        >
                          <Copy size={13} />
                          <span>Duplicate Group</span>
                        </button>

                        {!isBottom && (
                          <button
                            onClick={() => {
                              onMergeDown(layer.id);
                              setContextMenuLayerId(null);
                            }}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/80 text-left cursor-pointer"
                          >
                            <LayersIcon size={13} />
                            <span>Merge Down Group</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            onClearLayer(layer.id);
                            setContextMenuLayerId(null);
                          }}
                          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/80 text-left cursor-pointer"
                        >
                          <Eraser size={13} />
                          <span>Clear Group</span>
                        </button>

                        <button
                          onClick={() => {
                            onToggleLock(layer.id);
                            setContextMenuLayerId(null);
                          }}
                          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/80 text-left cursor-pointer"
                        >
                          <Lock size={13} />
                          <span>{layer.locked ? 'Unlock Group' : 'Lock Group'}</span>
                        </button>

                        <button
                          onClick={() => {
                            onDeleteLayer(layer.id);
                            setContextMenuLayerId(null);
                          }}
                          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-left cursor-pointer"
                        >
                          <Trash2 size={13} />
                          <span>Delete Group</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Group Mask Thumbnail & Controls Drawer if mask attached */}
                  {layer.mask && (
                    <div className="mt-1.5 pl-4 pr-1 py-1.5 rounded-lg bg-white/5 border border-white/10 flex flex-col gap-1.5">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectLayerMask?.(layer.id);
                        }}
                        className={`flex items-center justify-between rounded-lg p-1 transition-all cursor-pointer ${
                          isMaskActive
                            ? 'bg-[#1e2333] border border-blue-400/80 shadow-md ring-1 ring-blue-400/40'
                            : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-white/40 text-[11px] font-mono shrink-0">↳</span>
                          <div className="w-7 h-7 rounded-md border border-white/10 bg-black flex items-center justify-center overflow-hidden shrink-0">
                            {layer.mask.thumbnailUrl ? (
                              <img
                                src={layer.mask.thumbnailUrl}
                                alt="Mask"
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <div className="w-full h-full bg-white" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[11px] font-semibold text-white/90 truncate">
                              Group Mask
                            </span>
                            <span className="text-[9px] text-[#5fd3ad] font-mono">
                              {isMaskActive ? 'Active Target (B&W)' : 'Click to edit mask'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleMaskVisibility?.(layer.id);
                            }}
                            className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
                              layer.mask.visible ? 'text-white' : 'text-white/20'
                            }`}
                          >
                            {layer.mask.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteLayerMask?.(layer.id);
                            }}
                            className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <div
                        className="flex flex-col gap-1.5 pt-1.5 border-t border-white/5 px-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-[#e6c699]/70 font-medium">Density</span>
                          <div className="flex items-center gap-2 flex-1 max-w-[140px] justify-end">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={layer.mask.density !== undefined ? layer.mask.density : 100}
                              onChange={(e) =>
                                onChangeMaskProperties?.(layer.id, { density: Number(e.target.value) })
                              }
                              className="w-20 h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                            />
                            <span className="font-mono text-[#5fd3ad] w-8 text-right font-bold">
                              {layer.mask.density !== undefined ? layer.mask.density : 100}%
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-[#e6c699]/70 font-medium">Feather</span>
                          <div className="flex items-center gap-2 flex-1 max-w-[140px] justify-end">
                            <input
                              type="range"
                              min="0"
                              max="30"
                              value={layer.mask.feather || 0}
                              onChange={(e) =>
                                onChangeMaskProperties?.(layer.id, { feather: Number(e.target.value) })
                              }
                              className="w-20 h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                            />
                            <span className="font-mono text-[#5fd3ad] w-8 text-right font-bold">
                              {layer.mask.feather || 0}px
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onInvertMask?.(layer.id);
                            }}
                            className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-[#e6c699] text-[10px] font-semibold transition cursor-pointer"
                          >
                            [Invert]
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onResetMask?.(layer.id);
                            }}
                            className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-[10px] font-semibold transition cursor-pointer"
                          >
                            [Reset]
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // STANDARD LAYER ROW (Indented if inside a group)
            const isChild = !!layer.parentId;
            const isMultiSelected = selectedLayerIds.includes(layer.id);

            return (
              <div key={layer.id} className="flex flex-col">
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, layer.id)}
                  onDragOver={(e) => handleDragOverRow(e, layer)}
                  onDrop={(e) => handleDropOnRow(e, layer)}
                  onDragEnd={() => {
                    setDraggedLayerId(null);
                    setDragOverTargetId(null);
                    setDropZone(null);
                  }}
                  onTouchStart={(e) => {
                    touchStartXRef.current = e.touches[0].clientX;
                    touchStartYRef.current = e.touches[0].clientY;
                  }}
                  onTouchEnd={(e) => {
                    if (touchStartXRef.current !== null && touchStartYRef.current !== null) {
                      const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
                      const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
                      if (deltaX < -35 && Math.abs(deltaY) < 40) {
                        setSelectedLayerIds((prev) =>
                          prev.includes(layer.id)
                            ? (prev.length > 1 ? prev.filter((id) => id !== layer.id) : prev)
                            : [...prev, layer.id]
                        );
                        onSelectLayer(layer.id);
                      }
                    }
                    touchStartXRef.current = null;
                    touchStartYRef.current = null;
                  }}
                  onClick={(e) => {
                    if (e.shiftKey) {
                      e.stopPropagation();
                      const fromIdx = layers.findIndex((l) => l.id === activeLayerId);
                      const toIdx = layers.findIndex((l) => l.id === layer.id);
                      if (fromIdx !== -1 && toIdx !== -1) {
                        const minI = Math.min(fromIdx, toIdx);
                        const maxI = Math.max(fromIdx, toIdx);
                        const rangeIds = layers.slice(minI, maxI + 1).map((l) => l.id);
                        setSelectedLayerIds(Array.from(new Set([...selectedLayerIds, ...rangeIds])));
                      } else {
                        setSelectedLayerIds([layer.id]);
                        onSelectLayer(layer.id);
                      }
                    } else if (e.ctrlKey || e.metaKey) {
                      e.stopPropagation();
                      setSelectedLayerIds((prev) =>
                        prev.includes(layer.id)
                          ? (prev.length > 1 ? prev.filter((id) => id !== layer.id) : prev)
                          : [...prev, layer.id]
                      );
                      onSelectLayer(layer.id);
                    } else {
                      setSelectedLayerIds([layer.id]);
                      onSelectLayer(layer.id);
                    }
                  }}
                  title={
                    isLayerActive
                      ? 'Shift+Click to multi-select range • Swipe left to select'
                      : 'Click to select layer • Shift+Click or swipe left to multi-select'
                  }
                  className={`group relative flex flex-col rounded-xl p-2.5 transition-all cursor-pointer ${
                    isChild ? 'ml-5 border-l-2 border-l-[#5fd3ad]/50' : ''
                  } ${
                    isThisDragged ? 'opacity-40 border-dashed' : ''
                  } ${
                    isDraggingOver && dropZone === 'above'
                      ? 'border-t-2 border-t-[#5fd3ad]'
                      : isDraggingOver && dropZone === 'below'
                      ? 'border-b-2 border-b-[#5fd3ad]'
                      : isDraggingOver && dropZone === 'out_to_root'
                      ? 'ring-2 ring-amber-400 bg-amber-400/10'
                      : isMultiSelected && selectedLayerIds.length > 1
                      ? 'ring-2 ring-[#5fd3ad] bg-[#164435]/40 border-[#5fd3ad] shadow-[0_0_12px_rgba(95,211,173,0.35)]'
                      : isLayerActive
                      ? 'mayan-panel border-2 border-[#5fd3ad]/70 shadow-[0_0_14px_rgba(95,211,173,0.35)] ring-1 ring-[#5fd3ad]/40'
                      : 'mayan-well border border-[#2a302d] hover:border-[#b89058]/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {isMultiSelected && selectedLayerIds.length > 1 && (
                      <div className="w-4 h-4 rounded bg-[#5fd3ad] text-black flex items-center justify-center shrink-0 shadow">
                        <Check size={11} strokeWidth={3} />
                      </div>
                    )}

                    {/* Layer Thumbnail */}
                    <div
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) {
                          e.stopPropagation();
                          onSelectLayerPixels?.(layer.id);
                        }
                      }}
                      className="relative w-11 h-11 rounded-lg border border-[#b89058]/40 mini-checkerboard overflow-hidden shrink-0 flex items-center justify-center hover:border-[#5fd3ad] transition-colors shadow-inner"
                    >
                      {layer.thumbnailUrl ? (
                        <img
                          src={layer.thumbnailUrl}
                          alt={layer.name}
                          className="w-full h-full object-contain"
                        />
                      ) : isAdjustment ? (
                        <SlidersHorizontal size={18} className="text-[#b89058]" />
                      ) : layer.type === 'smart' ? (
                        <Boxes size={18} className="text-[#5fd3ad]" />
                      ) : (
                        <span className="text-[10px] text-[#9e9484]">Empty</span>
                      )}
                      {layer.type === 'smart' && (
                        <div
                          className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-black/90 rounded-tl border-t border-l border-white/40 flex items-center justify-center pointer-events-none shadow"
                          title="Smart Object"
                        >
                          <Boxes size={9} className="text-[#5fd3ad]" />
                        </div>
                      )}
                    </div>

                    {/* Layer Info */}
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="flex items-center gap-1.5 justify-between">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-xs font-semibold truncate text-[#f2fbf7]">
                            {layer.name}
                          </span>
                          {layer.type === 'vector' && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#164435] text-[#5fd3ad] border border-[#5fd3ad]/40 uppercase tracking-wider shrink-0 flex items-center gap-0.5">
                              <Spline size={9} />
                              Vector
                            </span>
                          )}
                          {layer.type === 'smart' && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#164435] text-[#5fd3ad] border border-[#5fd3ad]/40 uppercase tracking-wider shrink-0 flex items-center gap-0.5">
                              <Boxes size={9} />
                              Smart
                            </span>
                          )}
                          {layer.type === 'smart' && layer.smartFilters && layer.smartFilters.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleExpandSmartFilters?.(layer.id);
                              }}
                              className="w-4 h-4 rounded hover:bg-white/10 text-[#5fd3ad] flex items-center justify-center cursor-pointer ml-0.5"
                              title={layer.smartFiltersExpanded !== false ? 'Collapse Smart Filters' : 'Expand Smart Filters'}
                            >
                              {layer.smartFiltersExpanded !== false ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                            </button>
                          )}
                          {isAdjustment && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#3b2e25] text-[#e6c699] border border-[#b89058]/40 uppercase tracking-wider shrink-0">
                              Adj
                            </span>
                          )}
                        </div>
                        {layer.locked && <Lock size={12} className="text-[#b89058] shrink-0 ml-1" />}
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-[#9e9484]">
                        <span>{Math.round(layer.opacity * 100)}%</span>
                        {hasEffects && <span className="text-[#5fd3ad] font-bold">fx</span>}
                        {isChild && <span className="text-[#b89058]">· Grouped</span>}
                        {layer.type === 'smart' && (
                          <span className="text-[#5fd3ad]">· {layer.smartLayers?.length || 0} sub-layers</span>
                        )}
                        {layer.type === 'smart' && editingSmartLayerId === layer.id && (
                          <span className="text-[#5fd3ad] font-bold animate-pulse">· Editing</span>
                        )}
                      </div>
                    </div>

                    {layer.type === 'smart' && onEditSmartLayerContents && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditSmartLayerContents(layer.id);
                        }}
                        title="Open & edit sub-layers for coloring & animation"
                        className="px-1.5 h-6 rounded-md bg-[#164435] hover:bg-[#1f5c48] text-[#5fd3ad] border border-[#5fd3ad]/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm shrink-0"
                      >
                        <Sliders size={10} />
                        <span>Edit</span>
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setBlendMenuLayerId(blendMenuLayerId === layer.id ? null : layer.id);
                      }}
                      title="Change Blend Mode & Opacity"
                      className="w-6 h-6 rounded-md mayan-btn-stone flex items-center justify-center text-[10px] font-bold text-[#e6c699] transition-colors cursor-pointer shrink-0"
                    >
                      {getBlendModeLetter(layer.blendMode)}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenLayerEffects?.(layer.id);
                      }}
                      title="Layer Effects"
                      className={`px-1.5 h-6 rounded-md border flex items-center justify-center text-[10px] font-mono font-bold transition-all cursor-pointer shrink-0 ${
                        hasEffects
                          ? 'bg-blue-600 border-blue-400 text-white shadow-sm ring-1 ring-blue-400/50'
                          : 'bg-white/5 hover:bg-white/15 border-white/10 text-white/60 hover:text-white'
                      }`}
                    >
                      fx
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleVisibility(layer.id);
                      }}
                      title={layer.visible ? 'Hide Layer' : 'Show Layer'}
                      className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                        layer.visible
                          ? 'text-white hover:text-white/80'
                          : 'text-white/20 hover:text-white/40'
                      }`}
                    >
                      {layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setContextMenuLayerId(contextMenuLayerId === layer.id ? null : layer.id);
                        if (blendMenuLayerId === layer.id) setBlendMenuLayerId(null);
                      }}
                      title="Layer Actions"
                      className={`p-1 rounded-md transition-colors cursor-pointer ${
                        contextMenuLayerId === layer.id
                          ? 'text-white bg-white/20'
                          : 'text-white/40 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <MoreHorizontal size={15} />
                    </button>
                  </div>

                  {/* Blend Mode & Opacity Drawer */}
                  {blendMenuLayerId === layer.id && (
                    <div
                      className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-2 animate-in slide-in-from-top-1 duration-150"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-white/50 uppercase tracking-wider">
                          Opacity
                        </span>
                        <div className="flex items-center gap-2 flex-1 max-w-[170px]">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={Math.round(layer.opacity * 100)}
                            onChange={(e) =>
                              onChangeOpacity(layer.id, parseInt(e.target.value) / 100)
                            }
                            className="w-full h-1.5 bg-white/10 accent-blue-500 rounded-lg cursor-pointer"
                          />
                          <span className="text-[10px] font-mono text-white/70 w-8 text-right">
                            {Math.round(layer.opacity * 100)}%
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 pt-1 border-t border-white/5">
                        <div className="flex items-center gap-1.5 bg-white/5 rounded px-2 py-1 border border-white/10">
                          <Search size={11} className="text-white/40 shrink-0" />
                          <input
                            type="text"
                            value={layerBlendSearch}
                            onChange={(e) => setLayerBlendSearch(e.target.value)}
                            placeholder="Search blend modes..."
                            className="w-full bg-transparent text-[10px] text-white placeholder-white/30 focus:outline-none"
                          />
                          {layerBlendSearch && (
                            <button
                              onClick={() => setLayerBlendSearch('')}
                              className="text-white/40 hover:text-white text-[10px] cursor-pointer"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {!layerBlendSearch && (
                          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/10">
                            {CATEGORY_ORDER.map((cat) => (
                              <button
                                key={cat}
                                onClick={() => setLayerBlendCategory(cat)}
                                className={`px-1.5 py-0.5 rounded text-[9px] whitespace-nowrap uppercase tracking-wider font-semibold transition-colors cursor-pointer ${
                                  layerBlendCategory === cat
                                    ? 'bg-[#18392b] text-[#5bf5a4] border border-[#2e684a]'
                                    : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                {CATEGORY_LABELS[cat]}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 max-h-44 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-white/10">
                        {(() => {
                          let modesToDisplay: { id: string; name: string }[] = [];
                          if (layerBlendSearch.trim()) {
                            const q = layerBlendSearch.toLowerCase().trim();
                            const seen = new Set<string>();
                            Object.values(KRITA_BLEND_MODE_GROUPS).flat().forEach((m) => {
                              if (!seen.has(m.id) && m.name.toLowerCase().includes(q)) {
                                seen.add(m.id);
                                modesToDisplay.push(m);
                              }
                            });
                          } else if (layerBlendCategory === 'favorites') {
                            const favIds = favoriteModes.length > 0 ? favoriteModes : KRITA_BLEND_MODE_GROUPS.favorites.map((m) => m.id);
                            modesToDisplay = favIds.map((id) => ({
                              id,
                              name: BLEND_MODE_LABELS[id as KritaBlendMode] || id,
                            }));
                          } else {
                            modesToDisplay = KRITA_BLEND_MODE_GROUPS[layerBlendCategory] || [];
                          }

                          if (modesToDisplay.length === 0) {
                            return (
                              <div className="col-span-3 py-3 text-center text-white/40 text-[10px]">
                                No modes found
                              </div>
                            );
                          }

                          return modesToDisplay.map((b) => (
                            <button
                              key={b.id}
                              title={b.name}
                              onClick={() => onChangeBlendMode(layer.id, b.id as BlendMode)}
                              className={`px-1.5 py-1 rounded text-[10px] font-medium text-left truncate transition-colors cursor-pointer flex items-center justify-between ${
                                layer.blendMode === b.id
                                  ? 'bg-[#18392b] text-[#5bf5a4] font-semibold border border-[#2e684a]'
                                  : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              <span className="truncate">{b.name}</span>
                              {layer.blendMode === b.id && <Check size={10} className="shrink-0 text-[#5bf5a4] ml-1" />}
                            </button>
                          ));
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Context Menu Actions */}
                  {contextMenuLayerId === layer.id && (
                    <div
                      className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1.5 animate-in slide-in-from-top-1 duration-150 text-xs text-white"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between pb-1 border-b border-white/5 text-[10px] text-white/50 uppercase tracking-wider font-semibold">
                        <span>Layer Actions</span>
                        <button
                          onClick={() => setContextMenuLayerId(null)}
                          className="hover:text-white cursor-pointer text-xs"
                          title="Close Actions"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-1">
                        {layer.type === 'smart' ? (
                          <>
                            {onEditSmartLayerContents && (
                              <button
                                onClick={() => {
                                  onEditSmartLayerContents(layer.id);
                                  setContextMenuLayerId(null);
                                }}
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#164435]/70 hover:bg-[#1f5c48] text-[#5fd3ad] text-left cursor-pointer border border-[#5fd3ad]/40 font-semibold col-span-2 shadow-sm transition-all active:scale-95"
                                title="Open & edit sub-layers for coloring & animation"
                              >
                                <Sliders size={13} className="text-[#5fd3ad]" />
                                <span>Edit Contents (Sub-Layers)</span>
                              </button>
                            )}

                            {onUnpackSmartLayer && (
                              <button
                                onClick={() => {
                                  onUnpackSmartLayer(layer.id);
                                  setContextMenuLayerId(null);
                                }}
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/90 text-left cursor-pointer font-medium"
                                title="Unpack Smart Layer back into a standard Group folder"
                              >
                                <FolderOpen size={13} className="text-[#5fd3ad]" />
                                <span>Convert to Group</span>
                              </button>
                            )}

                            {onFlattenSmartLayer && (
                              <button
                                onClick={() => {
                                  onFlattenSmartLayer(layer.id);
                                  setContextMenuLayerId(null);
                                }}
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-[#f2fbf7] text-left cursor-pointer font-medium"
                                title="Flatten Smart Layer to a single raster image layer"
                              >
                                <ArrowDownToLine size={13} className="text-[#5fd3ad]" />
                                <span>Flatten to Image</span>
                              </button>
                            )}

                            {onFlattenAllLayers && (
                              <button
                                onClick={() => {
                                  onFlattenAllLayers();
                                  setContextMenuLayerId(null);
                                }}
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-[#e6c699] text-left cursor-pointer font-medium"
                                title="Flatten entire image (all visible layers) into a single flat background image"
                              >
                                <ImageIcon size={13} className="text-[#b89058]" />
                                <span>Flatten Image</span>
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {onConvertToSmartLayer && (
                              <button
                                onClick={() => {
                                  onConvertToSmartLayer(layer.id);
                                  setContextMenuLayerId(null);
                                }}
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#164435]/70 hover:bg-[#1f5c48] text-[#5fd3ad] text-left cursor-pointer border border-[#5fd3ad]/40 font-semibold col-span-2 shadow-sm transition-all active:scale-95"
                                title="Convert layer (or multi-selected layers) into Photoshop-parity Smart Layer"
                              >
                                <Boxes size={13} className="text-[#5fd3ad]" />
                                <span>
                                  {selectedLayerIds.length > 1
                                    ? `Convert (${selectedLayerIds.length}) to Smart Layer`
                                    : 'Convert to Smart Layer'}
                                </span>
                              </button>
                            )}

                            {onFlattenAllLayers && (
                              <button
                                onClick={() => {
                                  onFlattenAllLayers();
                                  setContextMenuLayerId(null);
                                }}
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-[#e6c699] text-left cursor-pointer font-medium col-span-2"
                                title="Flatten entire image (all visible layers) into a single flat background image"
                              >
                                <ImageIcon size={13} className="text-[#b89058]" />
                                <span>Flatten Image</span>
                              </button>
                            )}
                          </>
                        )}

                        {!layer.mask && onAddLayerMask && (
                          <button
                            onClick={() => {
                              onAddLayerMask(layer.id);
                              setContextMenuLayerId(null);
                            }}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-left cursor-pointer text-blue-300 font-medium"
                          >
                            <Plus size={13} />
                            <span>Add Mask</span>
                          </button>
                        )}

                        {layer.type === 'vector' && onRasterizeLayer && (
                          <button
                            onClick={() => {
                              onRasterizeLayer(layer.id);
                              setContextMenuLayerId(null);
                            }}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 text-left cursor-pointer font-medium col-span-2"
                          >
                            <Sparkles size={13} />
                            <span>Rasterize Vector</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            onDuplicateLayer(layer.id);
                            setContextMenuLayerId(null);
                          }}
                          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/80 text-left cursor-pointer"
                        >
                          <Copy size={13} />
                          <span>Duplicate</span>
                        </button>

                        <button
                          onClick={() => {
                            onClearLayer(layer.id);
                            setContextMenuLayerId(null);
                          }}
                          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/80 text-left cursor-pointer"
                        >
                          <Eraser size={13} />
                          <span>Clear</span>
                        </button>

                        {!isBottom && (
                          <button
                            onClick={() => {
                              onMergeDown(layer.id);
                              setContextMenuLayerId(null);
                            }}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/80 text-left cursor-pointer"
                          >
                            <ArrowDownToLine size={13} />
                            <span>Merge Down</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            onToggleLock(layer.id);
                            setContextMenuLayerId(null);
                          }}
                          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/80 text-left cursor-pointer"
                        >
                          {layer.locked ? <Unlock size={13} /> : <Lock size={13} />}
                          <span>{layer.locked ? 'Unlock' : 'Lock'}</span>
                        </button>

                        {onSelectLayerPixels && (
                          <button
                            onClick={() => {
                              onSelectLayerPixels(layer.id);
                              setContextMenuLayerId(null);
                            }}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/80 text-left cursor-pointer"
                          >
                            <Wand2 size={13} />
                            <span>Select Pixels</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-white/5 px-0.5">
                        <div className="flex items-center gap-1">
                          <button
                            disabled={isTop}
                            onClick={() => onMoveLayer(layer.id, 'up')}
                            title="Move Up"
                            className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/15 disabled:opacity-30 cursor-pointer text-[10px]"
                          >
                            <ChevronUp size={12} />
                            <span>Up</span>
                          </button>
                          <button
                            disabled={isBottom}
                            onClick={() => onMoveLayer(layer.id, 'down')}
                            title="Move Down"
                            className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/15 disabled:opacity-30 cursor-pointer text-[10px]"
                          >
                            <ChevronDown size={12} />
                            <span>Down</span>
                          </button>
                        </div>

                        <button
                          disabled={layers.length <= 1}
                          onClick={() => {
                            onDeleteLayer(layer.id);
                            setContextMenuLayerId(null);
                          }}
                          title="Delete Layer"
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 disabled:opacity-30 cursor-pointer text-[10px] font-semibold"
                        >
                          <Trash2 size={12} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Attached Layer Mask Sub-Row */}
                {layer.mask && (
                  <div className="ml-5 mt-1 flex flex-col gap-1.5 rounded-xl border border-white/5 bg-[#14151b] p-2">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectLayerMask?.(layer.id);
                      }}
                      className={`flex items-center justify-between rounded-lg p-1 transition-all cursor-pointer ${
                        isMaskActive
                          ? 'bg-[#1e2333] border border-blue-400/80 shadow-md ring-1 ring-blue-400/40'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-white/40 text-[11px] font-mono shrink-0">↳</span>
                        <div className="w-8 h-8 rounded-md border border-white/10 bg-black flex items-center justify-center overflow-hidden shrink-0">
                          {layer.mask.thumbnailUrl ? (
                            <img
                              src={layer.mask.thumbnailUrl}
                              alt="Mask"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="w-full h-full bg-white" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11px] font-semibold text-white/90 truncate">
                            Layer Mask
                          </span>
                          <span className="text-[9px] text-[#5fd3ad] font-mono">
                            {isMaskActive ? 'Active Target (B&W)' : 'Click to edit mask'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleMaskVisibility?.(layer.id);
                          }}
                          className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
                            layer.mask.visible ? 'text-white' : 'text-white/20'
                          }`}
                        >
                          {layer.mask.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteLayerMask?.(layer.id);
                          }}
                          className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div
                      className="flex flex-col gap-1.5 pt-1.5 border-t border-white/5 px-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-[#e6c699]/70 font-medium">Density</span>
                        <div className="flex items-center gap-2 flex-1 max-w-[140px] justify-end">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={layer.mask.density !== undefined ? layer.mask.density : 100}
                            onChange={(e) =>
                              onChangeMaskProperties?.(layer.id, { density: Number(e.target.value) })
                            }
                            className="w-20 h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                          />
                          <span className="font-mono text-[#5fd3ad] w-8 text-right font-bold">
                            {layer.mask.density !== undefined ? layer.mask.density : 100}%
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-[#e6c699]/70 font-medium">Feather</span>
                        <div className="flex items-center gap-2 flex-1 max-w-[140px] justify-end">
                          <input
                            type="range"
                            min="0"
                            max="50"
                            value={layer.mask.feather || 0}
                            onChange={(e) =>
                              onChangeMaskProperties?.(layer.id, { feather: Number(e.target.value) })
                            }
                            className="w-20 h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                          />
                          <span className="font-mono text-[#5fd3ad] w-8 text-right font-bold">
                            {layer.mask.feather || 0}px
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-white/5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onInvertMask?.(layer.id);
                          }}
                          className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-[#1a201c] hover:bg-[#232d27] text-[#e6c699] hover:text-[#5fd3ad] border border-[#2c3532] hover:border-[#5fd3ad]/50 transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-sm"
                          title="Invert Mask: Inverts black and white pixel values of the mask"
                        >
                          <RefreshCw size={11} className="text-[#5fd3ad]" />
                          Invert
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onResetMask?.(layer.id);
                          }}
                          className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-[#1a201c] hover:bg-[#232d27] text-[#9e9484] hover:text-[#f2fbf7] border border-[#2c3532] hover:border-[#b89058]/50 transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-sm"
                          title="Reset Mask: Resets Density to 100% and Feather to 0px"
                        >
                          <RotateCcw size={11} className="text-[#b89058]" />
                          Reset
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Photoshop-Parity Non-Destructive Smart Filters Branch */}
                {layer.type === 'smart' &&
                  layer.smartFilters &&
                  layer.smartFilters.length > 0 &&
                  layer.smartFiltersExpanded !== false && (
                    <div
                      className="ml-5 mt-1 flex flex-col gap-1 border-l-2 border-white/20 pl-2.5 select-none animate-in fade-in duration-150"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between p-1.5 rounded-lg bg-black/40 border border-white/10 hover:border-white/20 transition-all">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleAllSmartFilters?.(layer.id);
                            }}
                            title={
                              layer.smartFiltersEnabled !== false
                                ? 'Disable all Smart Filters'
                                : 'Enable all Smart Filters'
                            }
                            className={`w-5 h-5 rounded flex items-center justify-center cursor-pointer transition-colors ${
                              layer.smartFiltersEnabled !== false
                                ? 'text-white hover:text-white/80'
                                : 'text-white/20'
                            }`}
                          >
                            {layer.smartFiltersEnabled !== false ? (
                              <Eye size={12} />
                            ) : (
                              <EyeOff size={12} />
                            )}
                          </button>

                          <div
                            className="w-4 h-5 rounded-xs bg-white border border-black/40 shadow-sm shrink-0"
                            title="Smart Filters Mask"
                          />

                          <span className="text-[11px] font-semibold text-[#f2fbf7] truncate">
                            Smart Filters
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAddFilterMenuLayerId(
                                addFilterMenuLayerId === layer.id ? null : layer.id
                              );
                            }}
                            className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#164435] hover:bg-[#1f5c48] text-[#5fd3ad] border border-[#5fd3ad]/40 flex items-center gap-0.5 cursor-pointer shadow-sm"
                            title="Add another non-destructive Smart Filter"
                          >
                            <Plus size={10} />
                            <span>Filter</span>
                          </button>
                        </div>
                      </div>

                      {addFilterMenuLayerId === layer.id && (
                        <div
                          className="p-2 rounded-xl bg-[#141816] border border-[#5fd3ad]/60 shadow-2xl flex flex-col gap-1 z-30"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[9px] font-bold text-[#5fd3ad] uppercase tracking-wider px-1">
                            Add Smart Filter
                          </span>
                          <div className="grid grid-cols-2 gap-1 text-[10px]">
                            {[
                              { id: 'gaussian_blur', label: 'Gaussian Blur' },
                              { id: 'cutout', label: 'Cutout' },
                              { id: 'halftone', label: 'Halftone' },
                              { id: 'pixelate', label: 'Pixelate' },
                              { id: 'noise', label: 'Noise' },
                              { id: 'bloom', label: 'Bloom' },
                              { id: 'motion_blur', label: 'Motion Blur' },
                              { id: 'surface_blur', label: 'Surface Blur' },
                              { id: 'sharpen', label: 'Sharpen' },
                              { id: 'invert', label: 'Invert' },
                              { id: 'grayscale', label: 'Grayscale' },
                              { id: 'glitch_rgb_offset', label: 'RGB Offset' },
                            ].map((f) => (
                              <button
                                key={f.id}
                                onClick={() => {
                                  onAddSmartFilter?.(layer.id, f.id as ActiveAdjustment);
                                  setAddFilterMenuLayerId(null);
                                }}
                                className="px-2 py-1 rounded bg-white/5 hover:bg-[#164435] text-left text-white/90 hover:text-[#5fd3ad] cursor-pointer truncate"
                              >
                                {f.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {layer.smartFilters.map((filter, fIdx) => {
                        const isFilterTop = fIdx === 0;
                        const isFilterBottom = fIdx === layer.smartFilters!.length - 1;
                        return (
                          <div
                            key={filter.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditSmartFilter?.(layer.id, filter);
                            }}
                            className="ml-3 flex items-center justify-between p-1.5 rounded-lg bg-black/25 hover:bg-black/50 border border-white/5 hover:border-[#5fd3ad]/50 transition-colors cursor-pointer group/filter"
                            title="Click or click gear icon to edit filter settings"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleSmartFilter?.(layer.id, filter.id);
                                }}
                                title={filter.enabled ? 'Hide filter' : 'Show filter'}
                                className={`w-4 h-4 rounded flex items-center justify-center cursor-pointer ${
                                  filter.enabled
                                    ? 'text-white/90 hover:text-white'
                                    : 'text-white/20'
                                }`}
                              >
                                {filter.enabled ? <Eye size={11} /> : <EyeOff size={11} />}
                              </button>

                              <span
                                className={`text-[10px] truncate ${
                                  filter.enabled
                                    ? 'text-[#f2fbf7]'
                                    : 'text-white/40 line-through'
                                }`}
                              >
                                {filter.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                disabled={isFilterTop}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onReorderSmartFilter?.(layer.id, filter.id, 'up');
                                }}
                                className="w-4 h-4 rounded bg-white/5 hover:bg-white/10 disabled:opacity-20 flex items-center justify-center text-white/60 cursor-pointer"
                                title="Move Filter Up"
                              >
                                <ChevronUp size={9} />
                              </button>
                              <button
                                type="button"
                                disabled={isFilterBottom}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onReorderSmartFilter?.(layer.id, filter.id, 'down');
                                }}
                                className="w-4 h-4 rounded bg-white/5 hover:bg-white/10 disabled:opacity-20 flex items-center justify-center text-white/60 cursor-pointer"
                                title="Move Filter Down"
                              >
                                <ChevronDown size={9} />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditSmartFilter?.(layer.id, filter);
                                }}
                                className="w-4 h-4 rounded bg-[#164435] hover:bg-[#1f5c48] text-[#5fd3ad] flex items-center justify-center cursor-pointer shadow-sm"
                                title="Edit Filter Parameters"
                              >
                                <SlidersHorizontal size={9} />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteSmartFilter?.(layer.id, filter.id);
                                }}
                                className="w-4 h-4 rounded text-red-400 hover:text-red-300 hover:bg-red-500/20 flex items-center justify-center cursor-pointer"
                                title="Delete Filter"
                              >
                                <Trash2 size={9} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
              </div>
            );
          })}
      </div>

      {/* Background Color Layer */}
      <div className="pt-2 border-t border-white/5 flex flex-col gap-1">
        <div className="flex items-center justify-between p-2 rounded-xl bg-[#1a1c22] border border-white/5">
          <div className="flex items-center gap-2.5">
            <input
              type="color"
              value={backgroundColor}
              onChange={(e) => onChangeBackgroundColor(e.target.value)}
              className="w-7 h-7 rounded-lg border border-white/20 cursor-pointer bg-transparent"
              title="Change Canvas Background Color"
            />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-white/90">Background Color</span>
              <span className="text-[10px] font-mono text-white/40 uppercase">{backgroundColor}</span>
            </div>
          </div>
        </div>

        {isBottomLayerOpaque && (
          <span className="text-[9px] text-amber-300/70 px-1 italic">
            ℹ️ Bottom layer is opaque ({bottomLayer.name}). Hide it to see background color.
          </span>
        )}
      </div>
    </div>
  );
};