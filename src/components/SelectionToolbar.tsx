import React, { useState, useRef } from 'react';
import {
  Square,
  Circle,
  Lasso,
  FlipHorizontal2,
  Feather as FeatherIcon,
  PaintBucket,
  Copy,
  Trash2,
  Check,
  X,
  MousePointer2,
  Undo2,
  Redo2,
  Wand2,
  Plus,
  Minus,
  Grid,
  Share2,
  Layers,
  GripHorizontal,
} from 'lucide-react';
import { SelectionMode, SelectionCombineMode } from '../utils/selectionEngine';
import { PatternFillModal } from './PatternFillModal';
import {
  MayanCornerBrackets,
  MayanFriezeDivider,
  MayanEagleGlyph,
} from './MayanDecorations';

interface SelectionToolbarProps {
  currentMode: SelectionMode;
  combineMode?: SelectionCombineMode;
  onChangeCombineMode?: (mode: SelectionCombineMode) => void;
  sampleAllLayers?: boolean;
  onToggleSampleAllLayers?: () => void;
  currentColor?: string;
  isInverse: boolean;
  featherRadius: number;
  hasSelection: boolean;
  magicWandTolerance?: number;
  onChangeWandTolerance?: (t: number) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onChangeMode: (mode: SelectionMode) => void;
  onToggleInvert: () => void;
  onChangeFeather: (val: number) => void;
  onFillSelection: () => void;
  onFillPattern?: (patternType: string, scale?: number, customDataUrl?: string) => void;
  onMaskSelection?: () => void;
  onCopyPasteSelection: () => void;
  onCopyPng?: () => void;
  onClearSelection: () => void;
  onDeselect: () => void;
  onCommit: () => void;
  onTransformSelection: () => void;
}

export const SelectionToolbar: React.FC<SelectionToolbarProps> = ({
  currentMode,
  combineMode = 'replace',
  onChangeCombineMode,
  sampleAllLayers = false,
  onToggleSampleAllLayers,
  currentColor = '#3b82f6',
  isInverse,
  featherRadius,
  hasSelection,
  magicWandTolerance = 25,
  onChangeWandTolerance,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onChangeMode,
  onToggleInvert,
  onChangeFeather,
  onFillSelection,
  onMaskSelection,
  onCopyPasteSelection,
  onClearSelection,
  onDeselect,
  onFillPattern,
  onCopyPng,
  onCommit,
  onTransformSelection,
}) => {
  const [showFeatherSlider, setShowFeatherSlider] = useState(false);
  const [isPatternModalOpen, setIsPatternModalOpen] = useState(false);

  // Draggable toolbar state - resets to bottom-center anchor every time opened
  const [positionOffset, setPositionOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);

  const handleDragPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: positionOffset.x,
      initY: positionOffset.y,
    };
  };

  const handleDragPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPositionOffset({
      x: dragRef.current.initX + dx,
      y: dragRef.current.initY + dy,
    });
  };

  const handleDragPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      dragRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  return (
    <div
      data-interactive="true"
      data-floating-ui="true"
      style={{
        transform: `translate(calc(-50% + ${positionOffset.x}px), ${positionOffset.y}px)`,
      }}
      className="fixed bottom-6 left-1/2 z-50 pointer-events-auto max-w-3xl w-[96vw] sm:w-auto min-w-[340px] sm:min-w-[660px] mayan-panel p-3 text-[#e6c699] flex flex-col gap-2.5 select-none animate-in slide-in-from-bottom-3 duration-150 shadow-[0_16px_50px_rgba(0,0,0,0.95)]"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <MayanCornerBrackets size={16} color="#b89058" />

      {/* Top Grab Handle to Drag Anywhere */}
      <div
        onPointerDown={handleDragPointerDown}
        onPointerMove={handleDragPointerMove}
        onPointerUp={handleDragPointerUp}
        className="w-full flex items-center justify-center py-1 cursor-grab active:cursor-grabbing text-[#b89058]/60 hover:text-[#5fd3ad] transition-colors select-none -mt-1 touch-none"
        title="Drag handle: Click and move to reposition Selection toolbar anywhere on canvas"
      >
        <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#18201d] border border-[#2c3532]">
          <GripHorizontal size={12} />
          <span className="text-[9px] font-mayan font-bold uppercase tracking-wider text-[#b89058]">Selection Controls</span>
        </div>
      </div>

      {/* Top Segmented Mode Selector: Freehand, Rectangle, Ellipse, Magic Wand */}
      <div className="grid grid-cols-4 mayan-well p-1 rounded-xl border border-[#2a302d] text-xs font-medium text-[#9e9484]">
        <button
          onClick={() => onChangeMode('freehand')}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            currentMode === 'freehand'
              ? 'mayan-btn-jade font-semibold shadow-sm'
              : 'hover:text-[#e6c699] hover:bg-white/5'
          }`}
        >
          <Lasso size={14} />
          <span>Freehand</span>
        </button>

        <button
          onClick={() => onChangeMode('rectangle')}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            currentMode === 'rectangle'
              ? 'mayan-btn-jade font-semibold shadow-sm'
              : 'hover:text-[#e6c699] hover:bg-white/5'
          }`}
        >
          <Square size={14} />
          <span>Rectangle</span>
        </button>

        <button
          onClick={() => onChangeMode('ellipse')}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            currentMode === 'ellipse'
              ? 'mayan-btn-jade font-semibold shadow-sm'
              : 'hover:text-[#e6c699] hover:bg-white/5'
          }`}
        >
          <Circle size={14} />
          <span>Ellipse</span>
        </button>

        <button
          onClick={() => onChangeMode('magic_wand')}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            currentMode === 'magic_wand'
              ? 'mayan-btn-jade font-semibold shadow-sm'
              : 'hover:text-[#e6c699] hover:bg-white/5'
          }`}
          title="Magic Wand: Tap canvas and drag horizontally to tune tolerance"
        >
          <Wand2 size={14} />
          <span>Magic Wand</span>
        </button>
      </div>

      {/* Plus (+) and Minus (-) Mode Toggle (New = Jade, Add = Terracotta, Remove = Terracotta) */}
      <div className="flex items-center justify-between gap-2 mayan-well px-3 py-1.5 rounded-xl border border-[#2a302d] text-xs">
        <span className="text-[11px] text-[#b89058] font-mayan font-bold uppercase tracking-wider">Mode:</span>
        <div className="flex items-center gap-1.5 p-0.5">
          <button
            onClick={() => onChangeCombineMode?.('replace')}
            title="Replace Selection: Start fresh area"
            className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
              combineMode === 'replace'
                ? 'mayan-btn-jade shadow'
                : 'mayan-btn-stone text-[#9e9484]'
            }`}
          >
            New
          </button>
          <button
            onClick={() => onChangeCombineMode?.('add')}
            title="Add to Selection (+)"
            className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
              combineMode === 'add'
                ? 'mayan-btn-terracotta shadow-[0_0_8px_#9e4b3e]'
                : 'mayan-btn-stone text-[#9e9484]'
            }`}
          >
            <Plus size={12} />
            <span>Add (+)</span>
          </button>
          <button
            onClick={() => onChangeCombineMode?.('subtract')}
            title="Subtract from Selection (-)"
            className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
              combineMode === 'subtract'
                ? 'mayan-btn-terracotta shadow-[0_0_8px_#9e4b3e]'
                : 'mayan-btn-stone text-[#9e9484]'
            }`}
          >
            <Minus size={12} />
            <span>Remove (-)</span>
          </button>
        </div>
      </div>

      {/* Magic Wand Settings */}
      {currentMode === 'magic_wand' && (
        <div className="flex flex-wrap items-center justify-between gap-2 mayan-well px-3 py-1.5 rounded-xl border border-[#2a302d] text-xs">
          <div className="flex items-center gap-1.5 text-[#5fd3ad] font-semibold text-[11px]">
            <Wand2 size={12} />
            <span>Tolerance</span>
          </div>
          <input
            type="range"
            min="1"
            max="100"
            value={magicWandTolerance}
            onChange={(e) => onChangeWandTolerance?.(Number(e.target.value))}
            className="flex-1 min-w-[80px] mayan-range-slider cursor-pointer"
          />
          <span className="font-mono text-[#f2fbf7] font-bold text-[11px] w-8 text-right">
            {magicWandTolerance}%
          </span>

          <button
            onClick={onToggleSampleAllLayers}
            title="Toggle between sampling all visible layers or active layer only"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
              sampleAllLayers
                ? 'mayan-btn-jade'
                : 'mayan-btn-stone'
            }`}
          >
            <Layers size={11} />
            <span>{sampleAllLayers ? 'All Layers' : 'Current Layer'}</span>
          </button>
        </div>
      )}

      {/* Feather Popover Slider */}
      {showFeatherSlider && (
        <div className="flex items-center justify-between gap-3 mayan-panel p-2.5 rounded-xl border border-[#b89058]/50 text-xs animate-in fade-in duration-100">
          <span className="text-[#b89058] font-mayan font-bold text-[11px] w-20">Feather</span>
          <input
            type="range"
            min="0"
            max="40"
            value={featherRadius}
            onChange={(e) => onChangeFeather(parseInt(e.target.value))}
            className="flex-1 mayan-range-slider cursor-pointer"
          />
          <span className="text-[#5fd3ad] font-mono font-bold text-xs w-8 text-right">{featherRadius}px</span>
        </div>
      )}

      <MayanFriezeDivider className="my-0.5" />

      {/* Bottom Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={onToggleInvert}
            title="Invert Selection"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              isInverse
                ? 'mayan-btn-jade font-semibold'
                : 'mayan-btn-stone'
            }`}
          >
            <FlipHorizontal2 size={13} />
            <span>Invert</span>
          </button>

          <button
            onClick={() => setShowFeatherSlider(!showFeatherSlider)}
            title="Feather Edge Softening"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              showFeatherSlider || featherRadius > 0
                ? 'mayan-btn-jade font-semibold'
                : 'mayan-btn-stone'
            }`}
          >
            <FeatherIcon size={13} />
            <span>Feather</span>
            {featherRadius > 0 && (
              <span className="ml-0.5 font-mono text-[10px] text-[#5fd3ad]">({featherRadius}px)</span>
            )}
          </button>

          <button
            disabled={!hasSelection}
            onClick={onFillSelection}
            title="Color Fill Selection"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs mayan-btn-stone disabled:opacity-30 cursor-pointer"
          >
            <PaintBucket size={13} />
            <span>Fill</span>
          </button>

          {/* Pattern Fill Button */}
          <button
            onClick={() => setIsPatternModalOpen(true)}
            title="Pattern Fill: Choose repeating pattern texture"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              isPatternModalOpen
                ? 'mayan-btn-jade'
                : 'mayan-btn-stone'
            }`}
          >
            <Grid size={13} />
            <span>Pattern</span>
          </button>

          <button
            disabled={!hasSelection}
            onClick={onCopyPasteSelection}
            title="Copy & Paste Selection as New Layer"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs mayan-btn-stone disabled:opacity-30 cursor-pointer"
          >
            <Copy size={13} />
            <span>Copy/Paste</span>
          </button>

          {onMaskSelection && (
            <button
              disabled={!hasSelection}
              onClick={onMaskSelection}
              title="Convert Selection into Layer Mask (Reveals selection, masks rest)"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs mayan-btn-stone text-[#5fd3ad] hover:text-[#7ae8c4] disabled:opacity-30 cursor-pointer"
            >
              <Layers size={13} />
              <span>Mask</span>
            </button>
          )}

          {onCopyPng && (
            <button
              disabled={!hasSelection}
              onClick={onCopyPng}
              title="Copy Selection as Transparent PNG with Sacred Eagle Glyph"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs mayan-btn-jade disabled:opacity-30 cursor-pointer shadow-md"
            >
              <MayanEagleGlyph size={14} color="#f2fbf7" />
              <span className="font-semibold">Copy PNG</span>
            </button>
          )}

          <button
            disabled={!hasSelection}
            onClick={onClearSelection}
            title="Clear Pixels Inside Selection"
            className="p-1.5 rounded-lg mayan-btn-stone text-[#f87171] hover:text-[#fca5a5] disabled:opacity-30 cursor-pointer"
          >
            <Trash2 size={14} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeselect();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title="Deselect All (Esc)"
            className="p-1.5 rounded-lg mayan-btn-stone text-[#9e9484] hover:text-[#e6c699] transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onCommit();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title="Commit Selection (Enter)"
            className="flex items-center gap-1 px-3 py-1.5 text-xs mayan-btn-jade font-semibold cursor-pointer shadow-sm active:scale-95 transition-transform"
          >
            <Check size={14} /> Commit
          </button>

          <button
            disabled={!hasSelection}
            onClick={(e) => {
              e.stopPropagation();
              onTransformSelection();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title="Transform Selection (Move, Distort, Warp)"
            className="flex items-center gap-1.5 px-3 py-1.5 mayan-btn-cta disabled:opacity-40 text-xs font-semibold cursor-pointer active:scale-95 transition-transform"
          >
            <MousePointer2 size={13} />
            <span>Transform</span>
          </button>
        </div>
      </div>

      {/* Pattern Fill Modal Popover */}
      {isPatternModalOpen && (
        <PatternFillModal
          currentColor={currentColor}
          onApplyPattern={(patternType, scale, customDataUrl) => {
            onFillPattern?.(patternType, scale, customDataUrl);
            setIsPatternModalOpen(false);
          }}
          onClose={() => setIsPatternModalOpen(false)}
        />
      )}
    </div>
  );
};
