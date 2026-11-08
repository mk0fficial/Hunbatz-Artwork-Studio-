import React, { useState, useRef } from 'react';
import { LiquifyConfig, LiquifyMode } from '../utils/liquifyEngine';
import {
  Move,
  RotateCw,
  RotateCcw,
  Minimize2,
  Maximize2,
  RotateCcw as ResetIcon,
  Check,
  X,
  GripHorizontal,
} from 'lucide-react';
import { MayanCornerBrackets } from './MayanDecorations';

interface LiquifyBarProps {
  config: LiquifyConfig;
  onChangeConfig: (updated: Partial<LiquifyConfig>) => void;
  onReset: () => void;
  onApply: () => void;
  onCancel: () => void;
}

export const LiquifyBar: React.FC<LiquifyBarProps> = ({
  config,
  onChangeConfig,
  onReset,
  onApply,
  onCancel,
}) => {
  const modes: { mode: LiquifyMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'push', label: 'Push', icon: <Move size={14} /> },
    { mode: 'twirl_cw', label: 'Twirl CW', icon: <RotateCw size={14} /> },
    { mode: 'twirl_ccw', label: 'Twirl CCW', icon: <RotateCcw size={14} /> },
    { mode: 'pinch', label: 'Pinch', icon: <Minimize2 size={14} /> },
    { mode: 'expand', label: 'Expand', icon: <Maximize2 size={14} /> },
    { mode: 'reconstruct', label: 'Reconstruct', icon: <ResetIcon size={14} /> },
  ];

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
      className="fixed bottom-6 left-1/2 z-40 max-w-2xl w-[94vw] mayan-panel p-3 text-[#E6C699] flex flex-col gap-2 select-none animate-in slide-in-from-bottom-3 duration-150 shadow-[0_16px_50px_rgba(0,0,0,0.95)]"
      onClick={(e) => e.stopPropagation()}
    >
      <MayanCornerBrackets size={14} />

      {/* Top Grab Handle to Drag Anywhere */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-full flex items-center justify-center py-1 cursor-grab active:cursor-grabbing text-[#b89058]/60 hover:text-[#5fd3ad] transition-colors select-none -mt-1 touch-none"
        title="Drag handle: Click and move to reposition Liquify toolbar anywhere on canvas"
      >
        <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#18201d] border border-[#2c3532]">
          <GripHorizontal size={12} />
          <span className="text-[9px] font-mayan font-bold uppercase tracking-wider text-[#b89058]">Liquify Studio</span>
        </div>
      </div>

      {/* Top Segmented Mode Buttons */}
      <div className="grid grid-cols-6 mayan-well p-1 rounded-xl text-xs font-medium text-[#9E9484]">
        {modes.map((m) => (
          <button
            key={m.mode}
            onClick={() => onChangeConfig({ mode: m.mode })}
            className={`flex items-center justify-center gap-1 py-1.5 rounded-lg transition-all cursor-pointer ${
              config.mode === m.mode
                ? 'mayan-btn-jade text-[#F4FBF7] font-semibold shadow-sm'
                : 'hover:text-[#E6C699]'
            }`}
          >
            {m.icon}
            <span className="hidden sm:inline text-[11px] font-mayan">{m.label}</span>
          </button>
        ))}
      </div>

      {/* Sliders: Size, Strength, Momentum */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mayan-well p-2.5 rounded-xl text-xs">
        {/* Size Slider */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[#9E9484] font-mono text-[11px] w-12">Size</span>
          <input
            type="range"
            min="15"
            max="300"
            value={config.size}
            onChange={(e) => onChangeConfig({ size: parseInt(e.target.value) })}
            className="flex-1 h-1.5 bg-[#0B0E0D] accent-[#5fd3ad] rounded-lg cursor-pointer"
          />
          <span className="text-[#5fd3ad] font-mono text-[11px] w-8 text-right">{config.size}px</span>
        </div>

        {/* Strength / Pressure Slider */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[#9E9484] font-mono text-[11px] w-14">Pressure</span>
          <input
            type="range"
            min="5"
            max="100"
            value={Math.round(config.strength * 100)}
            onChange={(e) => onChangeConfig({ strength: parseInt(e.target.value) / 100 })}
            className="flex-1 h-1.5 bg-[#0B0E0D] accent-[#5fd3ad] rounded-lg cursor-pointer"
          />
          <span className="text-[#5fd3ad] font-mono text-[11px] w-8 text-right">
            {Math.round(config.strength * 100)}%
          </span>
        </div>

        {/* Momentum Slider */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[#9E9484] font-mono text-[11px] w-16">Momentum</span>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(config.momentum * 100)}
            onChange={(e) => onChangeConfig({ momentum: parseInt(e.target.value) / 100 })}
            className="flex-1 h-1.5 bg-[#0B0E0D] accent-[#5fd3ad] rounded-lg cursor-pointer"
          />
          <span className="text-[#5fd3ad] font-mono text-[11px] w-8 text-right">
            {Math.round(config.momentum * 100)}%
          </span>
        </div>
      </div>

      {/* Bottom Action Buttons */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={onReset}
          title="Reset All Liquify Strokes"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#E6C699] mayan-btn-stone transition-colors cursor-pointer"
        >
          <ResetIcon size={14} />
          <span>Reset</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            title="Cancel Liquify"
            className="p-1.5 rounded-lg text-[#9E9484] hover:text-[#E6C699] hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={17} />
          </button>
          <button
            onClick={onApply}
            title="Commit Liquify"
            className="flex items-center gap-1.5 px-4 py-1.5 mayan-btn-cta text-xs font-semibold shadow-md transition-all active:scale-95 cursor-pointer font-mayan"
          >
            <Check size={14} /> Commit
          </button>
        </div>
      </div>
    </div>
  );
};
