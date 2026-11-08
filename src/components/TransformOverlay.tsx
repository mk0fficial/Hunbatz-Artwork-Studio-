import React, { useState, useRef } from 'react';
import { TransformMode } from '../types/canvas';
import {
  FlipHorizontal,
  FlipVertical,
  RotateCw,
  Maximize2,
  Check,
  X,
  RotateCcw,
  Undo2,
  Redo2,
  GripHorizontal,
} from 'lucide-react';
import { MayanCornerBrackets } from './MayanDecorations';

interface TransformOverlayProps {
  transformMode: TransformMode;
  onChangeMode: (mode: TransformMode) => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onRotate45: () => void;
  onFitCanvas: () => void;
  onResetMesh?: () => void;
  puppetPinCount?: number;
  showPuppetMesh?: boolean;
  onTogglePuppetMesh?: () => void;
  onResetPuppetPins?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onApply: () => void;
  onCancel: () => void;
}

export const TransformOverlay: React.FC<TransformOverlayProps> = ({
  transformMode,
  onChangeMode,
  onFlipH,
  onFlipV,
  onRotate45,
  onFitCanvas,
  onResetMesh,
  puppetPinCount = 0,
  showPuppetMesh = true,
  onTogglePuppetMesh,
  onResetPuppetPins,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onApply,
  onCancel,
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
      data-interactive="true"
      data-floating-ui="true"
      style={{
        transform: `translate(calc(-50% + ${positionOffset.x}px), ${positionOffset.y}px)`,
      }}
      className="fixed bottom-6 left-1/2 z-50 pointer-events-auto max-w-xl w-[92vw] mayan-panel p-3 text-[#e6c699] flex flex-col gap-2 select-none animate-in slide-in-from-bottom-3 duration-150 shadow-[0_16px_50px_rgba(0,0,0,0.95)]"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <MayanCornerBrackets size={14} />

      {/* Top Grab Handle to Drag Anywhere */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-full flex items-center justify-center py-1 cursor-grab active:cursor-grabbing text-[#b89058]/60 hover:text-[#5fd3ad] transition-colors select-none -mt-1 touch-none"
        title="Drag handle: Click and move to reposition Transform toolbar anywhere on canvas"
      >
        <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#18201d] border border-[#2c3532]">
          <GripHorizontal size={12} />
          <span className="text-[9px] font-mayan font-bold uppercase tracking-wider text-[#b89058]">Transform Controls</span>
        </div>
      </div>

      {/* Top Row: Modes (Freeform, Uniform, Distort, Mesh Warp, Puppet Warp) */}
      <div className="grid grid-cols-5 mayan-well p-1 rounded-xl text-xs font-medium text-[#9e9484] gap-1">
        <button
          onClick={() => onChangeMode('freeform')}
          className={`py-1.5 capitalize rounded-lg transition-all cursor-pointer font-mayan text-[10px] sm:text-[11px] ${
            transformMode === 'freeform'
              ? 'mayan-btn-jade text-[#f4fbf7] font-semibold shadow-sm'
              : 'hover:text-[#e6c699]'
          }`}
        >
          Freeform
        </button>
        <button
          onClick={() => onChangeMode('uniform')}
          className={`py-1.5 capitalize rounded-lg transition-all cursor-pointer font-mayan text-[10px] sm:text-[11px] ${
            transformMode === 'uniform'
              ? 'mayan-btn-jade text-[#f4fbf7] font-semibold shadow-sm'
              : 'hover:text-[#e6c699]'
          }`}
        >
          Uniform
        </button>
        <button
          onClick={() => onChangeMode('distort')}
          className={`py-1.5 capitalize rounded-lg transition-all cursor-pointer font-mayan text-[10px] sm:text-[11px] ${
            transformMode === 'distort'
              ? 'mayan-btn-jade text-[#f4fbf7] font-semibold shadow-sm'
              : 'hover:text-[#e6c699]'
          }`}
        >
          Distort
        </button>
        <button
          onClick={() => onChangeMode('warp')}
          className={`py-1.5 capitalize rounded-lg transition-all cursor-pointer font-mayan text-[10px] sm:text-[11px] ${
            transformMode === 'warp'
              ? 'mayan-btn-jade text-[#f4fbf7] font-semibold shadow-sm'
              : 'hover:text-[#e6c699]'
          }`}
        >
          Mesh Warp
        </button>
        <button
          onClick={() => onChangeMode('puppet')}
          className={`py-1.5 capitalize rounded-lg transition-all cursor-pointer font-mayan text-[10px] sm:text-[11px] ${
            transformMode === 'puppet'
              ? 'mayan-btn-jade text-[#f4fbf7] font-semibold shadow-sm'
              : 'hover:text-[#e6c699]'
          }`}
        >
          Puppet Warp
        </button>
      </div>

      {/* Mode hint text */}
      <div className="px-2 text-[10px] text-[#9e9484] flex items-center justify-between min-h-[20px]">
        {transformMode === 'distort' && (
          <span>Drag the 4 corner pins to create perspective distortion</span>
        )}
        {transformMode === 'warp' && (
          <span>Drag the 16 mesh grid nodes to organically warp and bend the surface</span>
        )}
        {transformMode === 'freeform' && (
          <span>Drag bounding box to move, corner handles to scale, green pin to rotate</span>
        )}
        {transformMode === 'uniform' && (
          <span>Drag corner handles to scale uniformly with locked aspect ratio</span>
        )}
        {transformMode === 'puppet' && (
          <div className="flex items-center justify-between w-full gap-2">
            <span>Click layer to add pins. Drag pins to warp. Alt+Click to remove ({puppetPinCount} pins)</span>
            <div className="flex items-center gap-2 shrink-0">
              {onTogglePuppetMesh && (
                <button
                  type="button"
                  onClick={onTogglePuppetMesh}
                  className="text-[10px] text-[#5fd3ad] hover:text-[#7ef8ce] cursor-pointer"
                >
                  {showPuppetMesh ? 'Hide Mesh' : 'Show Mesh'}
                </button>
              )}
              {onResetPuppetPins && (
                <button
                  type="button"
                  onClick={onResetPuppetPins}
                  className="flex items-center gap-1 text-[#e6c699] hover:text-[#fff6e5] cursor-pointer"
                >
                  <RotateCcw size={10} /> Reset Pins
                </button>
              )}
            </div>
          </div>
        )}

        {(transformMode === 'distort' || transformMode === 'warp') && onResetMesh && (
          <button
            onClick={onResetMesh}
            className="flex items-center gap-1 text-[#5fd3ad] hover:text-[#7ef8ce] cursor-pointer font-medium"
          >
            <RotateCcw size={11} /> Reset Grid
          </button>
        )}
      </div>

      {/* Bottom Actions Row */}
      <div className="flex items-center justify-between px-2 pt-0.5">
        <div className="flex items-center gap-1.5">
          <button
            onClick={onFlipH}
            title="Flip Horizontal"
            className="p-1.5 rounded-lg mayan-btn-stone text-[#e6c699] hover:text-[#fff6e5] transition-colors cursor-pointer"
          >
            <FlipHorizontal size={15} />
          </button>
          <button
            onClick={onFlipV}
            title="Flip Vertical"
            className="p-1.5 rounded-lg mayan-btn-stone text-[#e6c699] hover:text-[#fff6e5] transition-colors cursor-pointer"
          >
            <FlipVertical size={15} />
          </button>
          <button
            onClick={onRotate45}
            title="Rotate 45°"
            className="p-1.5 rounded-lg mayan-btn-stone text-[#e6c699] hover:text-[#fff6e5] transition-colors cursor-pointer"
          >
            <RotateCw size={15} />
          </button>
          <button
            onClick={onFitCanvas}
            title="Fit to Canvas"
            className="p-1.5 rounded-lg mayan-btn-stone text-[#e6c699] hover:text-[#fff6e5] transition-colors cursor-pointer"
          >
            <Maximize2 size={15} />
          </button>

          <div className="h-4 w-px bg-[#2c3532] mx-0.5" />

          {/* Transform Undo & Redo */}
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo Transform step (Ctrl+Z)"
            className={`p-1.5 rounded-lg transition-colors ${
              canUndo
                ? 'mayan-btn-stone text-[#e6c699] cursor-pointer'
                : 'text-[#9e9484]/30 cursor-not-allowed'
            }`}
          >
            <Undo2 size={15} />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo Transform step (Ctrl+Shift+Z)"
            className={`p-1.5 rounded-lg transition-colors ${
              canRedo
                ? 'mayan-btn-stone text-[#e6c699] cursor-pointer'
                : 'text-[#9e9484]/30 cursor-not-allowed'
            }`}
          >
            <Redo2 size={15} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title="Cancel Transform (Esc)"
            className="p-1.5 rounded-lg text-[#9e9484] hover:text-[#e6c699] hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={17} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onApply();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title="Commit Transform (Enter)"
            className="flex items-center gap-1.5 px-3.5 py-1.5 mayan-btn-cta text-xs font-semibold shadow-md transition-all active:scale-95 cursor-pointer font-mayan"
          >
            <Check size={14} /> Commit
          </button>
        </div>
      </div>
    </div>
  );
};
