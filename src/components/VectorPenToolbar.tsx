import React, { useState, useRef } from 'react';
import {
  PenTool,
  Move,
  Check,
  Trash2,
  Plus,
  Scissors,
  Eraser,
  Wand2,
  Sparkles,
  Sliders,
  Paintbrush,
  Maximize2,
  Minus,
  Radio,
  GripHorizontal,
} from 'lucide-react';
import { BrushTexture } from '../types/canvas';
import { MayanCornerBrackets } from './MayanDecorations';

export type VectorToolSubMode = 'pen' | 'node' | 'eraser_line' | 'eraser_intersect' | 'thicken';

interface VectorPenToolbarProps {
  editMode: VectorToolSubMode;
  onChangeEditMode: (mode: VectorToolSubMode) => void;
  strokeWidth: number;
  onChangeStrokeWidth: (w: number) => void;
  strokeColor: string;
  onChangeStrokeColor: (color: string) => void;
  hasFill: boolean;
  onToggleFill: (fill: boolean) => void;
  fillColor: string;
  onChangeFillColor: (color: string) => void;
  isClosed: boolean;
  onToggleClosed: () => void;
  brushTexture?: BrushTexture;
  onChangeBrushTexture?: (tex: BrushTexture) => void;
  lineCorrection?: number; // 0 to 100% stabilization
  onChangeLineCorrection?: (intensity: number) => void;
  thickenFactor?: number;
  onChangeThickenFactor?: (factor: number) => void;
  radialRadius?: number;
  onChangeRadialRadius?: (radius: number) => void;
  isShiftLocked?: boolean;
  onToggleShiftLock?: () => void;
  onClearPoints: () => void;
  onRasterize: () => void;
  onClose: () => void;
}

export const VectorPenToolbar: React.FC<VectorPenToolbarProps> = ({
  editMode,
  onChangeEditMode,
  strokeWidth,
  onChangeStrokeWidth,
  strokeColor,
  onChangeStrokeColor,
  hasFill,
  onToggleFill,
  fillColor,
  onChangeFillColor,
  isClosed,
  onToggleClosed,
  brushTexture = 'smooth_ink',
  onChangeBrushTexture,
  lineCorrection = 35,
  onChangeLineCorrection,
  thickenFactor = 1.5,
  onChangeThickenFactor,
  radialRadius = 25,
  onChangeRadialRadius,
  isShiftLocked = false,
  onToggleShiftLock,
  onClearPoints,
  onRasterize,
  onClose,
}) => {
  // Draggable toolbar state
  const [positionOffset, setPositionOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: positionOffset.x,
      initY: positionOffset.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPositionOffset({
      x: dragRef.current.initX + dx,
      y: dragRef.current.initY + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      dragRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  return (
    <div
      style={{
        transform: `translate(calc(-50% + ${positionOffset.x}px), ${positionOffset.y}px)`,
      }}
      className="fixed bottom-6 left-1/2 z-40 max-w-2xl w-[94vw] mayan-panel p-3 text-[#E6C699] flex flex-col gap-2.5 select-none animate-in slide-in-from-bottom-3 duration-150 shadow-[0_16px_50px_rgba(0,0,0,0.95)]"
      onClick={(e) => e.stopPropagation()}
    >
      <MayanCornerBrackets size={14} />

      {/* Top Grab Handle to Drag Anywhere */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-full flex items-center justify-center py-1 cursor-grab active:cursor-grabbing text-[#b89058]/60 hover:text-[#5fd3ad] transition-colors select-none -mt-1 touch-none"
        title="Drag handle: Click and move to reposition Vector Pen toolbar anywhere on canvas"
      >
        <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#18201d] border border-[#2c3532]">
          <GripHorizontal size={12} />
          <span className="text-[9px] font-mayan font-bold uppercase tracking-wider text-[#b89058]">Vector Pen Studio</span>
        </div>
      </div>

      {/* Top Segmented Mode Selector: Pen, Node Edit, Vector Erasers, Thickening */}
      <div className="grid grid-cols-5 mayan-well p-1 rounded-xl text-[11px] font-medium text-[#9E9484]">
        <button
          onClick={() => onChangeEditMode('pen')}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            editMode === 'pen'
              ? 'mayan-btn-jade font-semibold shadow-sm text-[#F4FBF7]'
              : 'hover:text-[#E6C699]'
          }`}
          title="Pen Tool: Smooth ink strokes using ~75% less points for clean vector editing"
        >
          <PenTool size={13} />
          <span>Pen Draw</span>
        </button>

        <button
          onClick={() => onChangeEditMode('node')}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            editMode === 'node'
              ? 'mayan-btn-jade font-semibold shadow-sm text-[#F4FBF7]'
              : 'hover:text-[#E6C699]'
          }`}
          title="Node Control: Click line to Add Node · Shift+Click to Delete Node · Drag to reshape"
        >
          <Move size={13} />
          <span>Node Edit</span>
        </button>

        <button
          onClick={() => onChangeEditMode('eraser_line')}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            editMode === 'eraser_line'
              ? 'mayan-btn-terracotta font-semibold shadow-sm text-[#FFE8E6]'
              : 'hover:text-[#E6C699]'
          }`}
          title="Vector Eraser: Click to erase entire continuous vector line"
        >
          <Eraser size={13} />
          <span>Erase Line</span>
        </button>

        <button
          onClick={() => onChangeEditMode('eraser_intersect')}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            editMode === 'eraser_intersect'
              ? 'mayan-btn-terracotta font-semibold shadow-sm text-[#FFE8E6]'
              : 'hover:text-[#E6C699]'
          }`}
          title="Intersect Eraser: Swipe over overlapping lines to erase up to intersection point"
        >
          <Scissors size={13} />
          <span>Erase Cross</span>
        </button>

        <button
          onClick={() => onChangeEditMode('thicken')}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            editMode === 'thicken'
              ? 'mayan-btn-jade font-semibold shadow-sm text-[#F4FBF7]'
              : 'hover:text-[#E6C699]'
          }`}
          title="Targeted Thickening: Paint or hold to dynamically thicken vector strokes"
        >
          <Sparkles size={13} />
          <span>Thicken</span>
        </button>
      </div>

      {/* Mode-specific Guidance Pill & Touch/Pen Controls */}
      {editMode === 'node' && (
        <div className="bg-[#164435]/40 border border-[#5fd3ad]/30 px-3 py-1.5 rounded-xl text-[11px] text-[#5fd3ad] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span>💡 Click line to <b>Add Point</b>. Drag point to reshape. Hold for <b>Radial Thickening</b>.</span>
          </div>
          {onToggleShiftLock && (
            <button
              onClick={onToggleShiftLock}
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                isShiftLocked
                  ? 'mayan-btn-terracotta text-white shadow-md'
                  : 'mayan-btn-stone text-[#e6c699]'
              }`}
              title="Toggle Shift mode to delete points on touch / stylus devices without keyboard"
            >
              <span>{isShiftLocked ? 'Shift (Delete Point): ON' : 'Shift (Del Point)'}</span>
            </button>
          )}
        </div>
      )}

      {editMode === 'thicken' && (
        <div className="mayan-well border border-[#b89058]/30 px-3 py-1.5 rounded-xl text-[11px] text-[#e6c699] flex flex-wrap items-center justify-between gap-2">
          <span>🖌️ Paint over strokes or hold pointer down in place for growing radial area.</span>
          <div className="flex items-center gap-3">
            {/* Radial Area of Effect Slider */}
            <div className="flex items-center gap-1.5">
              <Radio size={12} className="text-[#5fd3ad]" />
              <span className="text-[#9e9484] text-[10px]">Area:</span>
              <input
                type="range"
                min={10}
                max={80}
                value={radialRadius}
                onChange={(e) => onChangeRadialRadius?.(Number(e.target.value))}
                className="w-16 h-1.5 bg-[#0b0e0d] accent-[#5fd3ad] rounded cursor-pointer"
              />
              <span className="font-mono text-[#5fd3ad] text-[10px]">{radialRadius}px</span>
            </div>

            {/* Thickness Multiplier */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#9e9484] text-[10px]">Multiplier:</span>
              <input
                type="range"
                min={0.3}
                max={3.0}
                step={0.1}
                value={thickenFactor}
                onChange={(e) => onChangeThickenFactor?.(Number(e.target.value))}
                className="w-14 h-1.5 bg-[#0b0e0d] accent-[#5fd3ad] rounded cursor-pointer"
              />
              <span className="font-mono text-[#5fd3ad] text-[10px]">{thickenFactor}x</span>
            </div>
          </div>
        </div>
      )}

      {/* Middle Row: Width, Brush Selector, Stabilization, Stroke Color, Fill */}
      <div className="flex flex-wrap items-center justify-between gap-3 mayan-well px-3 py-1.5 rounded-xl border border-[#2a302d] text-xs">
        {/* Stroke Width */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#9e9484] font-medium">Width:</span>
          <input
            type="range"
            min={1}
            max={60}
            value={strokeWidth}
            onChange={(e) => onChangeStrokeWidth(Number(e.target.value))}
            className="w-20 h-1.5 bg-[#0b0e0d] accent-[#5fd3ad] rounded-lg cursor-pointer"
          />
          <span className="font-mono text-[#5fd3ad] text-[11px] w-6">{strokeWidth}px</span>
        </div>

        {/* Brush Texture Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-[#9e9484]">Texture:</span>
          <select
            value={brushTexture}
            onChange={(e) => onChangeBrushTexture?.(e.target.value as BrushTexture)}
            className="bg-[#141817] border border-[#2c3532] rounded px-2 py-0.5 text-[11px] text-[#e6c699] outline-none cursor-pointer"
          >
            <option value="smooth_ink">Solid Ink</option>
            <option value="pencil_grain">Sketch Pencil</option>
            <option value="charcoal_coarse">Charcoal Grain</option>
            <option value="acrylic_wet">Acrylic Bristle</option>
            <option value="watercolor_wash">Soft Watercolor</option>
            <option value="soft_airbrush">Airbrush Mist</option>
            <option value="calligraphy_nib">Calligraphy Chisel</option>
          </select>
        </div>

        {/* Line Correction Intensity (Stabilization) */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-[#9e9484]">Correction:</span>
          <input
            type="range"
            min={0}
            max={100}
            value={lineCorrection}
            onChange={(e) => onChangeLineCorrection?.(Number(e.target.value))}
            className="w-16 h-1.5 bg-[#0b0e0d] accent-[#5fd3ad] rounded-lg cursor-pointer"
          />
          <span className="font-mono text-[#5fd3ad] text-[11px] w-7 text-right">{lineCorrection}%</span>
        </div>

        {/* Stroke Color */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-[#9e9484]">Color:</span>
          <input
            type="color"
            value={strokeColor.startsWith('#') ? strokeColor : '#ffffff'}
            onChange={(e) => onChangeStrokeColor(e.target.value)}
            className="w-5 h-5 rounded-md border border-[#c8a262]/60 bg-transparent cursor-pointer p-0"
            title="Stroke Color"
          />
        </div>

        {/* Fill Toggle & Color */}
        <div className="flex items-center gap-1.5">
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={hasFill}
              onChange={(e) => onToggleFill(e.target.checked)}
              className="accent-[#5fd3ad] rounded cursor-pointer"
            />
            <span className="text-[11px] text-[#e6c699]">Fill:</span>
          </label>
          {hasFill && (
            <input
              type="color"
              value={fillColor.startsWith('#') ? fillColor : '#5fd3ad'}
              onChange={(e) => onChangeFillColor(e.target.value)}
              className="w-5 h-5 rounded-md border border-[#c8a262]/60 bg-transparent cursor-pointer p-0"
              title="Fill Color"
            />
          )}
        </div>

        {/* Closed Path Toggle */}
        <button
          onClick={onToggleClosed}
          className={`px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
            isClosed
              ? 'mayan-btn-jade text-[#f4fbf7] font-semibold'
              : 'mayan-btn-stone text-[#9e9484]'
          }`}
          title="Close or open vector path loop"
        >
          {isClosed ? 'Closed Loop' : 'Open Path'}
        </button>
      </div>

      {/* Bottom Action Bar: Clear, Permanence Info, Rasterize, Done */}
      <div className="flex items-center justify-between px-1 pt-0.5">
        <button
          onClick={onClearPoints}
          title="Clear all points on current vector layer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#E57373] hover:text-[#FFCDD2] mayan-btn-stone transition-colors cursor-pointer"
        >
          <Trash2 size={13} />
          <span>Clear Vectors</span>
        </button>

        <span className="text-[10px] text-[#9E9484] hidden sm:inline font-sans">
          Vector paths remain permanently editable unless rasterized
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={onRasterize}
            title="Bake vector lines into normal raster paint pixels (permanent)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold mayan-btn-stone text-[#E6C699] transition-colors cursor-pointer"
          >
            <span>Rasterize to Layer</span>
          </button>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg mayan-btn-cta text-xs font-semibold shadow-lg transition-transform active:scale-95 cursor-pointer font-mayan"
          >
            <Check size={14} />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
