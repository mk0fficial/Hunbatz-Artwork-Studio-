import React, { useState, useRef } from 'react';
import { Pipette } from 'lucide-react';
import { MayanSerpentArrow } from './MayanDecorations';

interface SidebarControlsProps {
  brushSize: number; // 1 to 100
  brushOpacity: number; // 0 to 1
  isEyedropperActive: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onChangeSize: (size: number) => void;
  onChangeOpacity: (opacity: number) => void;
  onToggleEyedropper: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSizeAdjusting?: (isAdjusting: boolean) => void;
  position?: 'left' | 'right';
  uiScale?: number;
  deviceMode?: string;
}

export const SidebarControls: React.FC<SidebarControlsProps> = ({
  brushSize,
  brushOpacity,
  isEyedropperActive,
  canUndo,
  canRedo,
  onChangeSize,
  onChangeOpacity,
  onToggleEyedropper,
  onUndo,
  onRedo,
  onSizeAdjusting,
  position = 'left',
  uiScale = 1.0,
  deviceMode = 'auto',
}) => {
  const [isDraggingSize, setIsDraggingSize] = useState(false);
  const [isDraggingOpacity, setIsDraggingOpacity] = useState(false);

  const sizeTrackRef = useRef<HTMLDivElement | null>(null);
  const opacityTrackRef = useRef<HTMLDivElement | null>(null);

  const isCompact = deviceMode === 'phone' || (uiScale !== undefined && uiScale <= 0.85);

  // Vertical drag calculation for size (bottom = 1%, top = 100%)
  const handleSizePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!sizeTrackRef.current) return;
    const rect = sizeTrackRef.current.getBoundingClientRect();
    const relativeY = Math.max(0, Math.min(rect.height, rect.bottom - e.clientY));
    const percent = Math.max(1, Math.min(100, Math.round((relativeY / rect.height) * 100)));
    onChangeSize(percent);
  };

  // Vertical drag calculation for opacity (bottom = 1%, top = 100%)
  const handleOpacityPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!opacityTrackRef.current) return;
    const rect = opacityTrackRef.current.getBoundingClientRect();
    const relativeY = Math.max(0, Math.min(rect.height, rect.bottom - e.clientY));
    const percent = Math.max(0.01, Math.min(1, relativeY / rect.height));
    onChangeOpacity(percent);
  };

  const posClass = position === 'left' ? (isCompact ? 'left-1.5' : 'left-3 sm:left-4') : (isCompact ? 'right-1.5' : 'right-3 sm:right-4');
  const trackClass = isCompact ? 'w-6 h-24' : 'w-8 h-36';
  const eyedropperBtnClass = isCompact ? 'w-7 h-7' : 'w-9 h-9';
  const undoBtnClass = isCompact ? 'w-7 h-7' : 'w-8 h-8';
  const labelTextClass = isCompact ? 'text-[7.5px]' : 'text-[9px]';
  const gapClass = isCompact ? 'gap-1.5' : 'gap-3';

  return (
    <div
      className={`fixed top-1/2 -translate-y-1/2 ${posClass} z-40 flex flex-col items-center ${gapClass} select-none pointer-events-auto transition-all`}
    >
      {/* Top Slider: Brush Size */}
      <div className="relative flex flex-col items-center group">
        {/* Floating tooltip */}
        {isDraggingSize && (
          <div
            className={`absolute ${
              position === 'left' ? (isCompact ? 'left-9' : 'left-12') : (isCompact ? 'right-9' : 'right-12')
            } top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg mayan-panel border border-[#b89058] text-[#e6c699] font-mayan font-bold text-xs shadow-2xl whitespace-nowrap animate-in fade-in duration-100`}
          >
            Size: {Math.round(brushSize)} px
          </div>
        )}

        <div
          ref={sizeTrackRef}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setIsDraggingSize(true);
            onSizeAdjusting?.(true);
            handleSizePointer(e);
          }}
          onPointerMove={(e) => {
            if (isDraggingSize) handleSizePointer(e);
          }}
          onPointerUp={(e) => {
            setIsDraggingSize(false);
            onSizeAdjusting?.(false);
            e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          title={`Brush Size: ${Math.round(brushSize)} px`}
          className={`relative ${trackClass} mayan-well border-2 border-[#3a3229] rounded-full cursor-ns-resize shadow-2xl flex items-center justify-center p-1 overflow-hidden transition-all`}
        >
          {/* Fill Bar from bottom (glowing jade-to-gold gradient) */}
          <div
            className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-[#164435] via-[#2c7a60] to-[#b89058] rounded-b-full transition-all duration-75 pointer-events-none opacity-85 shadow-[0_0_10px_#5fd3ad]"
            style={{ height: `${Math.min(100, Math.max(1, brushSize))}%` }}
          />

          {/* Sliding Jade Bead Knob */}
          <div
            className="absolute mayan-slider-thumb flex items-center justify-center pointer-events-none transition-all duration-75"
            style={{ bottom: `calc(${Math.min(100, Math.max(1, brushSize))}% - ${isCompact ? '7px' : '9px'})` }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[#f2fbf7] shadow-sm" />
          </div>
        </div>
        <span className={`${labelTextClass} font-mayan font-bold text-[#b89058] mt-0.5 tracking-widest`}>SIZE</span>
      </div>

      {/* Middle Button: Eyedropper button (carved stone plaque / jade active) */}
      <button
        onClick={onToggleEyedropper}
        title="Eyedropper (I or Hold Alt)"
        className={`${eyedropperBtnClass} rounded-xl flex items-center justify-center shadow-lg transition-all cursor-pointer ${
          isEyedropperActive
            ? 'mayan-btn-jade scale-110 shadow-[0_0_12px_#5fd3ad]'
            : 'mayan-btn-stone hover:border-[#b89058]/60 active:scale-95 text-[#e6c699]'
        }`}
      >
        <Pipette size={isCompact ? 13 : 16} />
      </button>

      {/* Bottom Slider: Brush Opacity */}
      <div className="relative flex flex-col items-center group">
        {/* Floating tooltip */}
        {isDraggingOpacity && (
          <div
            className={`absolute ${
              position === 'left' ? (isCompact ? 'left-9' : 'left-12') : (isCompact ? 'right-9' : 'right-12')
            } top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg mayan-panel border border-[#b89058] text-[#e6c699] font-mayan font-bold text-xs shadow-2xl whitespace-nowrap animate-in fade-in duration-100`}
          >
            Opacity: {Math.round(brushOpacity * 100)}%
          </div>
        )}

        <div
          ref={opacityTrackRef}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setIsDraggingOpacity(true);
            handleOpacityPointer(e);
          }}
          onPointerMove={(e) => {
            if (isDraggingOpacity) handleOpacityPointer(e);
          }}
          onPointerUp={(e) => {
            setIsDraggingOpacity(false);
            e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          title={`Brush Opacity: ${Math.round(brushOpacity * 100)}%`}
          className={`relative ${trackClass} mayan-well border-2 border-[#3a3229] rounded-full cursor-ns-resize shadow-2xl flex items-center justify-center p-1 overflow-hidden transition-all`}
        >
          {/* Fill Bar from bottom */}
          <div
            className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-[#164435] via-[#2c7a60] to-[#b89058] rounded-b-full transition-all duration-75 pointer-events-none opacity-85 shadow-[0_0_10px_#5fd3ad]"
            style={{ height: `${brushOpacity * 100}%` }}
          />

          {/* Sliding Jade Bead Knob */}
          <div
            className="absolute mayan-slider-thumb flex items-center justify-center pointer-events-none transition-all duration-75"
            style={{ bottom: `calc(${brushOpacity * 100}% - ${isCompact ? '7px' : '9px'})` }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[#f2fbf7] shadow-sm" />
          </div>
        </div>
        <span className={`${labelTextClass} font-mayan font-bold text-[#b89058] mt-0.5 tracking-widest`}>OPACITY</span>
      </div>

      {/* Undo / Redo Buttons (Mayan stone buttons with serpent arrows) */}
      <div className="flex flex-col gap-1 pt-0.5">
        <button
          disabled={!canUndo}
          onClick={onUndo}
          title="Undo (Ctrl+Z)"
          className={`${undoBtnClass} rounded-lg mayan-btn-stone flex items-center justify-center hover:border-[#b89058]/60 disabled:opacity-30 disabled:pointer-events-none shadow-md transition-all active:scale-95 cursor-pointer`}
        >
          <MayanSerpentArrow direction="left" size={isCompact ? 12 : 15} color={canUndo ? '#e6c699' : '#6b6357'} />
        </button>
        <button
          disabled={!canRedo}
          onClick={onRedo}
          title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
          className={`${undoBtnClass} rounded-lg mayan-btn-stone flex items-center justify-center hover:border-[#b89058]/60 disabled:opacity-30 disabled:pointer-events-none shadow-md transition-all active:scale-95 cursor-pointer`}
        >
          <MayanSerpentArrow direction="right" size={isCompact ? 12 : 15} color={canRedo ? '#e6c699' : '#6b6357'} />
        </button>
      </div>
    </div>
  );
};
