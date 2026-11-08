import React, { useState } from 'react';
import { Layer, BlendMode } from '../types/canvas';
import {
  X,
  Layers,
  Plus,
  Eye,
  EyeOff,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  PaintBucket,
  Eraser,
  Spline,
  Sparkles,
  Check,
  Sliders,
  MoreHorizontal,
  Lock,
  Unlock,
  ArrowDownToLine,
  SlidersHorizontal,
  FolderOpen,
} from 'lucide-react';
import { MayanCornerBrackets } from './MayanDecorations';

interface SmartLayerEditorModalProps {
  smartLayer: Layer;
  activeSubLayerId?: string;
  currentColor: string;
  canvasWidth: number;
  canvasHeight: number;
  onSelectSubLayer: (subLayerId: string) => void;
  onAddSubLayer: (name: string, isVector?: boolean) => void;
  onDuplicateSubLayer: (subLayerId: string) => void;
  onDeleteSubLayer: (subLayerId: string) => void;
  onMoveSubLayer: (subLayerId: string, direction: 'up' | 'down') => void;
  onToggleSubLayerVisibility: (subLayerId: string) => void;
  onToggleSubLayerLock?: (subLayerId: string) => void;
  onChangeSubLayerOpacity: (subLayerId: string, opacity: number) => void;
  onChangeSubLayerBlendMode: (subLayerId: string, mode: BlendMode) => void;
  onFillSubLayer: (subLayerId: string, color: string) => void;
  onClearSubLayer: (subLayerId: string) => void;
  onRenameSubLayer: (subLayerId: string, newName: string) => void;
  onMergeDownSubLayer?: (subLayerId: string) => void;
  onRasterizeSubLayer?: (subLayerId: string) => void;
  onOpenSubLayerEffects?: (subLayerId: string) => void;
  onUnpackSmartLayer?: () => void;
  onClose: () => void;
}

const COMMON_BLEND_MODES: { id: BlendMode; label: string }[] = [
  { id: 'source-over', label: 'Normal' },
  { id: 'multiply', label: 'Multiply' },
  { id: 'screen', label: 'Screen' },
  { id: 'overlay', label: 'Overlay' },
  { id: 'soft-light', label: 'Soft Light' },
  { id: 'hard-light', label: 'Hard Light' },
  { id: 'color-dodge', label: 'Color Dodge' },
  { id: 'color-burn', label: 'Color Burn' },
  { id: 'darken', label: 'Darken' },
  { id: 'lighten', label: 'Lighten' },
  { id: 'difference', label: 'Difference' },
  { id: 'exclusion', label: 'Exclusion' },
];

export const SmartLayerEditorModal: React.FC<SmartLayerEditorModalProps> = ({
  smartLayer,
  activeSubLayerId,
  currentColor,
  canvasWidth,
  canvasHeight,
  onSelectSubLayer,
  onAddSubLayer,
  onDuplicateSubLayer,
  onDeleteSubLayer,
  onMoveSubLayer,
  onToggleSubLayerVisibility,
  onToggleSubLayerLock,
  onChangeSubLayerOpacity,
  onChangeSubLayerBlendMode,
  onFillSubLayer,
  onClearSubLayer,
  onRenameSubLayer,
  onMergeDownSubLayer,
  onRasterizeSubLayer,
  onOpenSubLayerEffects,
  onUnpackSmartLayer,
  onClose,
}) => {
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameText, setEditingNameText] = useState('');
  const [activeBlendSubId, setActiveBlendSubId] = useState<string | null>(null);
  const [activeActionSubId, setActiveActionSubId] = useState<string | null>(null);

  const subLayers = smartLayer.smartLayers || [];
  const activeSubId = activeSubLayerId || subLayers[0]?.id;

  return (
    <div
      className="fixed inset-y-16 right-6 z-50 w-[420px] mayan-panel border-2 border-[#5fd3ad]/70 shadow-[0_20px_60px_rgba(0,0,0,0.95)] p-4 text-[#e6c699] flex flex-col gap-3 select-none animate-in fade-in zoom-in-95 duration-150 max-h-[85vh]"
      onClick={(e) => {
        e.stopPropagation();
        setActiveBlendSubId(null);
        setActiveActionSubId(null);
      }}
    >
      <MayanCornerBrackets size={16} color="#5fd3ad" />

      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#2c3532]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded bg-[#164435] text-[#5fd3ad] flex items-center justify-center shrink-0 border border-[#5fd3ad]/40 shadow">
            <Layers size={14} />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-xs font-mayan font-bold text-[#f2fbf7] truncate">
                {smartLayer.name}
              </span>
              <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-[#164435] text-[#5fd3ad] border border-[#5fd3ad]/40 uppercase tracking-wider shrink-0">
                Smart Object
              </span>
            </div>
            <span className="text-[10px] text-[#9e9484]">
              Independent Canvas Layers ({subLayers.length})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onUnpackSmartLayer && (
            <button
              onClick={onUnpackSmartLayer}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-[#5fd3ad] text-[10px] font-semibold transition-all active:scale-95 cursor-pointer border border-[#5fd3ad]/30 flex items-center gap-1"
              title="Unpack Smart Layer back into a regular layer group"
            >
              <FolderOpen size={12} />
              <span>Unpack to Group</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg mayan-btn-jade text-white text-[11px] font-bold transition-all active:scale-95 cursor-pointer shadow-sm flex items-center gap-1"
            title="Done Editing Smart Object Contents"
          >
            <Check size={13} strokeWidth={2.5} />
            <span>Done</span>
          </button>
        </div>
      </div>

      {/* Independent Canvas Layer Add Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            const nextIdx = subLayers.length + 1;
            onAddSubLayer(`Layer ${nextIdx}`);
          }}
          title="Add New Standard Layer inside Smart Object"
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg mayan-btn-stone hover:border-[#5fd3ad] text-[#5fd3ad] font-semibold text-[11px] cursor-pointer active:scale-95 transition-all shadow-sm"
        >
          <Plus size={13} />
          <span>+ Layer</span>
        </button>

        <button
          onClick={() => {
            const nextIdx = subLayers.length + 1;
            onAddSubLayer(`Vector Layer ${nextIdx}`, true);
          }}
          title="Add New Vector Layer inside Smart Object"
          className="flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg mayan-btn-stone hover:border-[#b89058] text-[#e6c699] font-semibold text-[11px] cursor-pointer active:scale-95 transition-all shadow-sm"
        >
          <Spline size={13} className="text-[#5fd3ad]" />
          <span>+ Vector Layer</span>
        </button>
      </div>

      {/* Info notice */}
      <div className="px-2.5 py-1.5 rounded-lg bg-[#164435]/30 border border-[#5fd3ad]/30 text-[10px] text-[#b4ecd9] flex items-center gap-2">
        <span className="text-[#5fd3ad] text-xs">ℹ️</span>
        <span>
          Independent canvas: paint, draw and erase directly on the active layer while maintaining all layer separations.
        </span>
      </div>

      {/* Sub-Layers Stack List (Top rendered first) */}
      <div className="flex flex-col gap-1.5 overflow-y-auto pr-1 max-h-[390px]">
        {subLayers
          .slice()
          .reverse()
          .map((sub, index) => {
            const isTop = index === 0;
            const isBottom = index === subLayers.length - 1;
            const isActive = sub.id === activeSubId;
            const isVector = sub.type === 'vector';
            const hasEffects = !!sub.effects;

            return (
              <div
                key={sub.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSubLayer(sub.id);
                }}
                className={`flex flex-col p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? 'mayan-panel border-2 border-[#5fd3ad] shadow-[0_0_14px_rgba(95,211,173,0.35)] ring-1 ring-[#5fd3ad]/40 bg-[#164435]/30'
                    : 'mayan-well border-[#2a302d] hover:border-[#b89058]/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {/* Active target check indicator */}
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                        isActive
                          ? 'bg-[#5fd3ad] border-[#5fd3ad] text-black shadow-sm'
                          : 'border-white/20 bg-black/40'
                      }`}
                      title={isActive ? 'Active drawing target' : 'Click to select as target'}
                    >
                      {isActive && <Check size={11} strokeWidth={3} />}
                    </div>

                    {/* Sub-layer Live Canvas Thumbnail */}
                    <div className="w-10 h-10 rounded-lg border border-[#b89058]/40 mini-checkerboard overflow-hidden shrink-0 flex items-center justify-center shadow-inner">
                      {sub.thumbnailUrl ? (
                        <img
                          src={sub.thumbnailUrl}
                          alt={sub.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-[9px] text-[#9e9484]">Empty</span>
                      )}
                    </div>

                    {/* Name & Metadata */}
                    <div className="flex flex-col min-w-0 flex-1">
                      {editingNameId === sub.id ? (
                        <input
                          type="text"
                          autoFocus
                          value={editingNameText}
                          onChange={(e) => setEditingNameText(e.target.value)}
                          onBlur={() => {
                            if (editingNameText.trim()) {
                              onRenameSubLayer(sub.id, editingNameText.trim());
                            }
                            setEditingNameId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (editingNameText.trim()) {
                                onRenameSubLayer(sub.id, editingNameText.trim());
                              }
                              setEditingNameId(null);
                            } else if (e.key === 'Escape') {
                              setEditingNameId(null);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-black/60 border border-[#5fd3ad] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                        />
                      ) : (
                        <div
                          className="flex items-center gap-1.5 truncate"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingNameId(sub.id);
                            setEditingNameText(sub.name);
                          }}
                          title="Double-click to rename layer"
                        >
                          <span
                            className={`text-xs font-semibold truncate ${
                              isActive ? 'text-[#f2fbf7]' : 'text-[#e6c699]'
                            }`}
                          >
                            {sub.name}
                          </span>
                          {isVector && (
                            <span className="px-1 py-0.2 rounded text-[7px] font-bold bg-[#164435] text-[#5fd3ad] uppercase">
                              Vector
                            </span>
                          )}
                          {sub.locked && <Lock size={10} className="text-[#b89058] shrink-0" />}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-[9px] text-[#9e9484] mt-0.5">
                        <span>{Math.round(sub.opacity * 100)}%</span>
                        <span>· {sub.blendMode === 'source-over' ? 'Normal' : sub.blendMode}</span>
                        {hasEffects && <span className="text-[#5fd3ad] font-bold">· fx</span>}
                        {isActive && <span className="text-[#5fd3ad] font-bold">· Active Target</span>}
                      </div>
                    </div>
                  </div>

                  {/* Layer Quick Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Blend Mode Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveBlendSubId(activeBlendSubId === sub.id ? null : sub.id);
                        setActiveActionSubId(null);
                      }}
                      className="px-1.5 h-6 rounded mayan-btn-stone text-[9px] font-bold text-[#e6c699] flex items-center justify-center cursor-pointer"
                      title="Adjust Opacity & Blend Mode"
                    >
                      {sub.blendMode === 'source-over' ? 'Norm' : sub.blendMode.slice(0, 4).toUpperCase()}
                    </button>

                    {/* Direct Layer Effects (fx) Button */}
                    {onOpenSubLayerEffects && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenSubLayerEffects(sub.id);
                        }}
                        className={`px-1.5 h-6 rounded text-[9px] font-bold flex items-center justify-center cursor-pointer transition-colors ${
                          hasEffects
                            ? 'bg-[#164435] text-[#5fd3ad] border border-[#5fd3ad]/50 shadow-sm'
                            : 'mayan-btn-stone text-[#e6c699]/80 hover:text-white'
                        }`}
                        title="Layer Effects (Shadow, Glow, Stroke, Bevel)"
                      >
                        fx
                      </button>
                    )}

                    {/* Visibility Eye */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSubLayerVisibility(sub.id);
                      }}
                      className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
                        sub.visible ? 'text-white hover:text-white/80' : 'text-white/20'
                      }`}
                      title={sub.visible ? 'Hide Layer' : 'Show Layer'}
                    >
                      {sub.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>

                    {/* Move Up / Down */}
                    <button
                      disabled={isTop}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveSubLayer(sub.id, 'up');
                      }}
                      className="w-5 h-6 rounded bg-white/5 hover:bg-white/10 disabled:opacity-20 flex items-center justify-center cursor-pointer text-white/70"
                      title="Move Layer Up"
                    >
                      <ChevronUp size={11} />
                    </button>
                    <button
                      disabled={isBottom}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveSubLayer(sub.id, 'down');
                      }}
                      className="w-5 h-6 rounded bg-white/5 hover:bg-white/10 disabled:opacity-20 flex items-center justify-center cursor-pointer text-white/70"
                      title="Move Layer Down"
                    >
                      <ChevronDown size={11} />
                    </button>

                    {/* Full Layer Actions (...) Drawer */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveActionSubId(activeActionSubId === sub.id ? null : sub.id);
                        setActiveBlendSubId(null);
                      }}
                      className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-colors ${
                        activeActionSubId === sub.id
                          ? 'bg-[#5fd3ad] text-black'
                          : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
                      }`}
                      title="Layer Actions"
                    >
                      <MoreHorizontal size={13} />
                    </button>
                  </div>
                </div>

                {/* Layer Actions (...) Menu */}
                {activeActionSubId === sub.id && (
                  <div
                    className="mt-2 pt-2 border-t border-white/10 grid grid-cols-2 gap-1.5 text-[10px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        onDuplicateSubLayer(sub.id);
                        setActiveActionSubId(null);
                      }}
                      className="flex items-center gap-1.5 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#e6c699] hover:text-[#5fd3ad] cursor-pointer"
                    >
                      <Copy size={11} />
                      <span>Duplicate Layer</span>
                    </button>

                    <button
                      onClick={() => {
                        onFillSubLayer(sub.id, currentColor);
                        setActiveActionSubId(null);
                      }}
                      className="flex items-center gap-1.5 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#5fd3ad] cursor-pointer"
                    >
                      <PaintBucket size={11} />
                      <span>Fill with Color</span>
                    </button>

                    <button
                      onClick={() => {
                        onClearSubLayer(sub.id);
                        setActiveActionSubId(null);
                      }}
                      className="flex items-center gap-1.5 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white cursor-pointer"
                    >
                      <Eraser size={11} />
                      <span>Clear Pixels</span>
                    </button>

                    <button
                      onClick={() => {
                        setEditingNameId(sub.id);
                        setEditingNameText(sub.name);
                        setActiveActionSubId(null);
                      }}
                      className="flex items-center gap-1.5 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white cursor-pointer"
                    >
                      <SlidersHorizontal size={11} />
                      <span>Rename Layer</span>
                    </button>

                    {onToggleSubLayerLock && (
                      <button
                        onClick={() => {
                          onToggleSubLayerLock(sub.id);
                          setActiveActionSubId(null);
                        }}
                        className="flex items-center gap-1.5 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#b89058] cursor-pointer"
                      >
                        {sub.locked ? <Unlock size={11} /> : <Lock size={11} />}
                        <span>{sub.locked ? 'Unlock Layer' : 'Lock Layer'}</span>
                      </button>
                    )}

                    {onOpenSubLayerEffects && (
                      <button
                        onClick={() => {
                          onOpenSubLayerEffects(sub.id);
                          setActiveActionSubId(null);
                        }}
                        className="flex items-center gap-1.5 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-blue-400 cursor-pointer"
                      >
                        <Sparkles size={11} />
                        <span>Layer Effects (fx)</span>
                      </button>
                    )}

                    {onRasterizeSubLayer && isVector && (
                      <button
                        onClick={() => {
                          onRasterizeSubLayer(sub.id);
                          setActiveActionSubId(null);
                        }}
                        className="flex items-center gap-1.5 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#5fd3ad] cursor-pointer"
                      >
                        <Spline size={11} />
                        <span>Rasterize Layer</span>
                      </button>
                    )}

                    {onMergeDownSubLayer && !isBottom && (
                      <button
                        onClick={() => {
                          onMergeDownSubLayer(sub.id);
                          setActiveActionSubId(null);
                        }}
                        className="flex items-center gap-1.5 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-amber-300 cursor-pointer"
                      >
                        <ArrowDownToLine size={11} />
                        <span>Merge Down</span>
                      </button>
                    )}

                    {subLayers.length > 1 && (
                      <button
                        onClick={() => {
                          onDeleteSubLayer(sub.id);
                          setActiveActionSubId(null);
                        }}
                        className="flex items-center gap-1.5 p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 cursor-pointer col-span-2"
                      >
                        <Trash2 size={11} />
                        <span>Delete Layer</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Blend Mode & Opacity Drawer for this sub-layer */}
                {activeBlendSubId === sub.id && (
                  <div
                    className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-white/50">Opacity</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={Math.round(sub.opacity * 100)}
                          onChange={(e) =>
                            onChangeSubLayerOpacity(sub.id, parseInt(e.target.value) / 100)
                          }
                          className="w-28 h-1.5 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                        />
                        <span className="font-mono text-[#5fd3ad] w-8 text-right font-bold">
                          {Math.round(sub.opacity * 100)}%
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1 pt-1">
                      {COMMON_BLEND_MODES.map((b) => (
                        <button
                          key={b.id}
                          onClick={() => {
                            onChangeSubLayerBlendMode(sub.id, b.id);
                            setActiveBlendSubId(null);
                          }}
                          className={`px-1.5 py-1 rounded text-[10px] truncate cursor-pointer ${
                            sub.blendMode === b.id
                              ? 'bg-[#18392b] text-[#5bf5a4] font-bold border border-[#2e684a]'
                              : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Quick Color Fill Bar */}
      <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs">
          <div
            className="w-4 h-4 rounded-full border border-white/30"
            style={{ backgroundColor: currentColor }}
          />
          <span className="text-[10px] text-white/60">Color:</span>
          <span className="text-[10px] font-mono font-bold text-[#5fd3ad]">{currentColor}</span>
        </div>

        <button
          onClick={() => onFillSubLayer(activeSubId, currentColor)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#164435] hover:bg-[#1f5c48] text-[#5fd3ad] border border-[#5fd3ad]/40 text-[10px] font-semibold transition-all cursor-pointer active:scale-95 shadow-sm"
          title="Fill current active sub-layer with selected color"
        >
          <PaintBucket size={11} />
          <span>Fill Active Layer</span>
        </button>
      </div>
    </div>
  );
};
