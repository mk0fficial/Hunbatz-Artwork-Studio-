import React, { useRef, useEffect, useState } from 'react';
import { Brush, ToolType } from '../types/canvas';
import { renderStrokeSegment } from '../utils/brushEngine';
import { ChevronDown, ChevronUp, Eye, Sparkles } from 'lucide-react';

interface LiveStrokePreviewDockProps {
  activeTool: ToolType;
  activeBrush: Brush;
  currentColor: string;
  brushSize: number;
  brushOpacity: number;
}

export const LiveStrokePreviewDock: React.FC<LiveStrokePreviewDockProps> = ({
  activeTool,
  activeBrush,
  currentColor,
  brushSize,
  brushOpacity,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Render a lively undulating S-curve stroke simulating real tablet pressure
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || isCollapsed) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const isEraser = activeTool === 'eraser';
    const isSmudge = activeTool === 'smudge';
    const drawColor = isEraser ? '#94a3b8' : isSmudge ? '#38bdf8' : currentColor;

    // Draw background grid checker for opacity
    const w = canvas.width;
    const h = canvas.height;

    // Generate dynamic preview curve points
    const pointsCount = 36;
    const pts: { x: number; y: number; pressure: number; time: number }[] = [];

    for (let i = 0; i <= pointsCount; i++) {
      const t = i / pointsCount;
      const x = 16 + t * (w - 32);
      const y = h / 2 + Math.sin(t * Math.PI * 2) * (h * 0.26);
      // Realistic pressure curve: starts light, peaks in middle, tapers at end
      const pressure = Math.sin(t * Math.PI) * 0.9 + 0.1;
      pts.push({ x, y, pressure, time: Date.now() });
    }

    // Render stroke segments
    for (let i = 0; i < pts.length - 1; i++) {
      renderStrokeSegment(
        ctx,
        pts[i],
        pts[i + 1],
        activeBrush,
        drawColor,
        Math.max(2, brushSize * 0.6),
        brushOpacity,
        false
      );
    }
  }, [activeTool, activeBrush, currentColor, brushSize, brushOpacity, isCollapsed]);

  return (
    <div
      className="fixed bottom-4 left-20 z-30 select-none animate-in fade-in slide-in-from-bottom-2 duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mayan-panel border-2 border-[#2c3532] shadow-[0_12px_32px_rgba(0,0,0,0.9)] rounded-xl p-2.5 flex flex-col gap-1 text-[#e6c699]">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-3 px-1.5 py-0.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#f2fbf7]">
            <span className="w-2.5 h-2.5 rounded-full border border-[#b89058]" style={{ backgroundColor: currentColor }} />
            <span className="truncate max-w-[120px] font-mayan tracking-wide">{activeBrush.name}</span>
            <span className="text-[10px] font-mono text-[#b89058]">
              ({activeTool.toUpperCase()})
            </span>
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded mayan-btn-stone text-[#9e9484] hover:text-[#e6c699] transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand Preview' : 'Collapse Preview'}
          >
            {isCollapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {/* Live Ribbon Canvas Preview */}
        {!isCollapsed && (
          <div className="relative rounded-lg overflow-hidden mayan-well border border-[#b89058]/30 flex items-center justify-center p-1 shadow-inner">
            <canvas ref={canvasRef} width={180} height={46} className="block" />
            <div className="absolute bottom-1 right-2 text-[9px] font-mono text-[#b89058] pointer-events-none">
              {Math.round((brushSize / 100) * (activeBrush.maxSize || 120))}px ·{' '}
              {Math.round(brushOpacity * 100)}%
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
