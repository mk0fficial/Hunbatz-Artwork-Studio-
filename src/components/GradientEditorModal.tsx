import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, Trash2, RotateCcw, Palette } from 'lucide-react';
import {
  GradientMapStop,
  GradientOpacityStop,
  GRADIENT_MAP_PRESETS,
  buildGradientMapLut,
  hexToRgb,
} from '../utils/canvasAdjustments';
import { MayanCornerBrackets } from './MayanDecorations';

export interface GradientEditorModalProps {
  initialStops?: GradientMapStop[];
  initialShift?: number;
  initialRepeat?: number;
  initialReverse?: boolean;
  onPreview: (lut: Uint8Array) => void;
  onApply: (lut: Uint8Array, config: { stops: GradientMapStop[]; shift: number; repeat: number; reverse: boolean; opacityStops: GradientOpacityStop[]; midpoints: number[] }) => void;
  onCancel: () => void;
}

export const GradientEditorModal: React.FC<GradientEditorModalProps> = ({
  initialStops,
  initialShift = 0,
  initialRepeat = 1,
  initialReverse = false,
  onPreview,
  onApply,
  onCancel,
}) => {
  // Color stops (bottom handles)
  const [stops, setStops] = useState<GradientMapStop[]>(
    initialStops && initialStops.length >= 2
      ? initialStops
      : GRADIENT_MAP_PRESETS[0].stops
  );

  // Opacity stops (top handles)
  const [opacityStops, setOpacityStops] = useState<GradientOpacityStop[]>([
    { id: 'op_start', offset: 0, opacity: 1 },
    { id: 'op_end', offset: 1, opacity: 1 },
  ]);

  // Midpoints between adjacent sorted color stops (ratio 0.1 to 0.9, default 0.5)
  const [midpoints, setMidpoints] = useState<number[]>([0.5, 0.5, 0.5, 0.5]);

  // Transform controls
  const [shift, setShift] = useState<number>(initialShift);
  const [repeat, setRepeat] = useState<number>(initialRepeat);
  const [reverse, setReverse] = useState<boolean>(initialReverse);

  // Editor dropdowns
  const [gradientType, setGradientType] = useState<'normal' | 'smooth'>('normal');
  const [smoothness, setSmoothness] = useState<number>(100);

  // Selected stop IDs
  const [selectedColorStopId, setSelectedColorStopId] = useState<string>(
    stops[0]?.id || 's0'
  );
  const [selectedOpacityStopId, setSelectedOpacityStopId] = useState<string>(
    opacityStops[0]?.id || 'op_start'
  );

  const trackRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Dragging interaction state
  const dragTargetRef = useRef<{
    type: 'color' | 'opacity' | 'midpoint';
    id: string;
    index?: number;
    startY: number;
  } | null>(null);

  // Sorted color stops
  const sortedStops = [...stops].sort((a, b) => a.offset - b.offset);

  // Ensure midpoints length matches sortedStops.length - 1
  useEffect(() => {
    setMidpoints((prev) => {
      const needed = Math.max(0, sortedStops.length - 1);
      const next = [...prev];
      while (next.length < needed) next.push(0.5);
      return next.slice(0, needed);
    });
  }, [sortedStops.length]);

  // Currently selected stop objects
  const activeColorStop =
    stops.find((s) => s.id === selectedColorStopId) || sortedStops[0] || stops[0];
  const activeOpacityStop =
    opacityStops.find((o) => o.id === selectedOpacityStopId) || opacityStops[0];

  // Rebuild LUT and fire preview
  const updateLutAndPreview = useCallback(() => {
    const lut = buildGradientMapLut(
      stops,
      shift,
      repeat,
      reverse,
      midpoints,
      opacityStops
    );
    onPreview(lut);
  }, [stops, shift, repeat, reverse, midpoints, opacityStops, onPreview]);

  useEffect(() => {
    updateLutAndPreview();
  }, [updateLutAndPreview]);

  // CSS gradient representation for track bar display
  const cssStops = sortedStops
    .map((s) => `${s.color} ${(s.offset * 100).toFixed(1)}%`)
    .join(', ');
  const trackGradientCss = `linear-gradient(to right, ${cssStops})`;

  // Pointer dragging handler for stops and midpoints
  const handlePointerDownTrack = (e: React.PointerEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickOffset = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const clickY = e.clientY - rect.top;

    // Check if clicked near an existing color stop (bottom half)
    const existingColor = stops.find((s) => Math.abs(s.offset - clickOffset) < 0.04);

    if (clickY > rect.height * 0.45) {
      if (existingColor) {
        setSelectedColorStopId(existingColor.id);
        dragTargetRef.current = { type: 'color', id: existingColor.id, startY: e.clientY };
      } else {
        // Add new color stop
        const newStop: GradientMapStop = {
          id: `stop_${Date.now()}`,
          offset: Number(clickOffset.toFixed(3)),
          color: activeColorStop ? activeColorStop.color : '#ffffff',
        };
        const next = [...stops, newStop];
        setStops(next);
        setSelectedColorStopId(newStop.id);
        dragTargetRef.current = { type: 'color', id: newStop.id, startY: e.clientY };
      }
    } else {
      // Top half: Opacity stop
      const existingOp = opacityStops.find((o) => Math.abs(o.offset - clickOffset) < 0.04);
      if (existingOp) {
        setSelectedOpacityStopId(existingOp.id);
        dragTargetRef.current = { type: 'opacity', id: existingOp.id, startY: e.clientY };
      } else {
        const newOp: GradientOpacityStop = {
          id: `op_${Date.now()}`,
          offset: Number(clickOffset.toFixed(3)),
          opacity: activeOpacityStop ? activeOpacityStop.opacity : 1,
        };
        setOpacityStops((prev) => [...prev, newOp]);
        setSelectedOpacityStopId(newOp.id);
        dragTargetRef.current = { type: 'opacity', id: newOp.id, startY: e.clientY };
      }
    }
  };

  // Global window pointer move & up listeners while dragging
  useEffect(() => {
    const handleWindowPointerMove = (e: PointerEvent) => {
      if (!dragTargetRef.current || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const currOffset = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const target = dragTargetRef.current;

      // Vertical drag-off deletion threshold (> 35px away from track)
      const dy = Math.abs(e.clientY - target.startY);
      if (dy > 42 && target.type === 'color' && stops.length > 2) {
        // Remove stop
        setStops((prev) => prev.filter((s) => s.id !== target.id));
        dragTargetRef.current = null;
        return;
      }

      if (target.type === 'color') {
        setStops((prev) =>
          prev.map((s) =>
            s.id === target.id ? { ...s, offset: Number(currOffset.toFixed(3)) } : s
          )
        );
      } else if (target.type === 'opacity') {
        setOpacityStops((prev) =>
          prev.map((o) =>
            o.id === target.id ? { ...o, offset: Number(currOffset.toFixed(3)) } : o
          )
        );
      } else if (target.type === 'midpoint' && target.index !== undefined) {
        const idx = target.index;
        const leftStop = sortedStops[idx];
        const rightStop = sortedStops[idx + 1];
        if (leftStop && rightStop) {
          const span = rightStop.offset - leftStop.offset;
          if (span > 0.01) {
            const ratio = (currOffset - leftStop.offset) / span;
            const clamped = Math.max(0.1, Math.min(0.9, Number(ratio.toFixed(2))));
            setMidpoints((prev) => {
              const next = [...prev];
              next[idx] = clamped;
              return next;
            });
          }
        }
      }
    };

    const handleWindowPointerUp = () => {
      dragTargetRef.current = null;
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
    };
  }, [stops.length, sortedStops]);

  // Delete handlers
  const handleDeleteActiveColorStop = () => {
    if (stops.length <= 2) return;
    const next = stops.filter((s) => s.id !== activeColorStop.id);
    setStops(next);
    setSelectedColorStopId(next[0].id);
  };

  const handleDeleteActiveOpacityStop = () => {
    if (opacityStops.length <= 2) return;
    const next = opacityStops.filter((o) => o.id !== activeOpacityStop.id);
    setOpacityStops(next);
    setSelectedOpacityStopId(next[0].id);
  };

  // Keyboard shortcut for Delete stop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteActiveColorStop();
      } else if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        handleCommit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stops, onCancel]);

  const handleCommit = () => {
    const lut = buildGradientMapLut(stops, shift, repeat, reverse, midpoints, opacityStops);
    onApply(lut, {
      stops,
      shift,
      repeat,
      reverse,
      opacityStops,
      midpoints,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none"
      onClick={onCancel}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="relative w-[480px] max-w-[95vw] mayan-panel rounded-2xl border-2 border-[#b89058] shadow-[0_24px_70px_rgba(0,0,0,0.9)] p-4 text-[#e6c699] flex flex-col gap-3 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <MayanCornerBrackets size={16} color="#b89058" />

        {/* 1. Header Bar: Title + Close Button */}
        <div className="flex items-center justify-between pb-2.5 border-b border-[#2c3532]">
          <div className="flex items-center gap-2">
            <Palette size={16} className="text-[#5fd3ad]" />
            <h2 className="font-mayan font-bold text-sm tracking-wider uppercase text-[#e6c699]">
              Gradient Editor
            </h2>
          </div>
          <button
            onClick={onCancel}
            title="Close Gradient Editor (Esc)"
            className="w-7 h-7 rounded-lg mayan-btn-stone flex items-center justify-center text-xs text-[#9e9484] hover:text-white transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* 2. Presets Ribbon: 5 Built-in Presets */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#b89058] font-mayan">
            Built-in Presets:
          </span>
          <div className="grid grid-cols-5 gap-1.5">
            {GRADIENT_MAP_PRESETS.map((preset) => {
              const presetCss = `linear-gradient(to right, ${preset.stops
                .map((s) => `${s.color} ${(s.offset * 100).toFixed(0)}%`)
                .join(', ')})`;
              return (
                <button
                  key={preset.name}
                  onClick={() => {
                    const cloned = preset.stops.map((s, i) => ({
                      ...s,
                      id: `pr_${Date.now()}_${i}`,
                    }));
                    setStops(cloned);
                    setSelectedColorStopId(cloned[0].id);
                  }}
                  className="flex flex-col gap-1 p-1 rounded-lg mayan-btn-stone hover:border-[#5fd3ad] transition-all cursor-pointer text-left group"
                  title={`Load preset: ${preset.name}`}
                >
                  <div
                    className="w-full h-3 rounded shadow-inner border border-black/40 group-hover:scale-105 transition-transform"
                    style={{ background: presetCss }}
                  />
                  <span className="text-[9px] truncate text-center w-full font-medium text-[#e6c699] group-hover:text-[#5fd3ad]">
                    {preset.name.replace('&', '+')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Type & Smoothness Row (from Photoshop image reference) */}
        <div className="grid grid-cols-2 gap-3 py-1 border-t border-[#2c3532]/60 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/60">Type:</span>
            <select
              value={gradientType}
              onChange={(e) => setGradientType(e.target.value as 'normal' | 'smooth')}
              className="flex-1 bg-[#121615] border border-[#2c3532] rounded-lg px-2 py-1 text-xs text-[#e6c699] focus:outline-none focus:border-[#5fd3ad] cursor-pointer"
            >
              <option value="normal">Normal</option>
              <option value="smooth">Smooth</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/60">Smoothness:</span>
            <select
              value={smoothness}
              onChange={(e) => setSmoothness(Number(e.target.value))}
              className="flex-1 bg-[#121615] border border-[#2c3532] rounded-lg px-2 py-1 text-xs text-[#e6c699] focus:outline-none focus:border-[#5fd3ad] cursor-pointer"
            >
              <option value={100}>100%</option>
              <option value={80}>80%</option>
              <option value={50}>50%</option>
              <option value={0}>0% (Linear)</option>
            </select>
          </div>
        </div>

        {/* 4. Opacity Controls Section (Top Stops) */}
        <div className="flex flex-col gap-1 p-2 rounded-xl bg-[#121615] border border-[#2c3532]">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-white/70">Opacity Stop:</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-white/50">Opacity:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={Math.round((activeOpacityStop?.opacity ?? 1) * 100)}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(100, Number(e.target.value))) / 100;
                    setOpacityStops((prev) =>
                      prev.map((o) =>
                        o.id === activeOpacityStop?.id ? { ...o, opacity: val } : o
                      )
                    );
                  }}
                  className="w-14 bg-[#181d1b] border border-[#2c3532] rounded px-1.5 py-0.5 text-right font-mono text-xs text-[#5fd3ad] focus:outline-none focus:border-[#5fd3ad]"
                />
                <span className="text-white/40">%</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-white/50">Position:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={Math.round((activeOpacityStop?.offset ?? 0) * 100)}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(100, Number(e.target.value))) / 100;
                    setOpacityStops((prev) =>
                      prev.map((o) =>
                        o.id === activeOpacityStop?.id ? { ...o, offset: val } : o
                      )
                    );
                  }}
                  className="w-14 bg-[#181d1b] border border-[#2c3532] rounded px-1.5 py-0.5 text-right font-mono text-xs text-[#e6c699] focus:outline-none focus:border-[#5fd3ad]"
                />
                <span className="text-white/40">%</span>
              </div>

              <button
                onClick={handleDeleteActiveOpacityStop}
                disabled={opacityStops.length <= 2}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition ${
                  opacityStops.length > 2
                    ? 'mayan-btn-stone hover:text-red-400 cursor-pointer'
                    : 'opacity-40 cursor-not-allowed text-white/30'
                }`}
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* 5. INTERACTIVE HORIZONTAL GRADIENT TRACK BAR WITH TOP/BOTTOM HANDLES & MIDPOINTS */}
        <div className="relative py-6 px-3 select-none">
          {/* Top Row: Opacity Stop Handles (Downwards Triangles) */}
          <div className="relative h-4 mb-1">
            {opacityStops.map((op) => {
              const isSelected = op.id === activeOpacityStop?.id;
              return (
                <div
                  key={op.id}
                  style={{ left: `${(op.offset * 100).toFixed(2)}%` }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelectedOpacityStopId(op.id);
                    dragTargetRef.current = { type: 'opacity', id: op.id, startY: e.clientY };
                  }}
                  className={`absolute -translate-x-1/2 top-0 flex flex-col items-center cursor-pointer group z-20`}
                  title={`Opacity stop: ${Math.round(op.opacity * 100)}% at ${(op.offset * 100).toFixed(0)}% (Drag off or press Delete to remove)`}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-sm border shadow-sm transition-all ${
                      isSelected
                        ? 'border-[#5fd3ad] ring-2 ring-[#5fd3ad]/60 bg-white'
                        : 'border-[#2c3532] bg-[#1d2422] hover:border-white/60'
                    }`}
                  />
                  {/* Downward triangle arrow */}
                  <div
                    className={`w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-t-[4px] ${
                      isSelected ? 'border-t-[#5fd3ad]' : 'border-t-[#1d2422]'
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* Gradient Display Track Bar */}
          <div
            ref={trackRef}
            onPointerDown={handlePointerDownTrack}
            className="relative h-8 w-full rounded-md border-2 border-[#2c3532] shadow-inner cursor-crosshair overflow-visible touch-none"
            style={{
              backgroundColor: '#1b1f1e',
              backgroundImage: `linear-gradient(45deg, #242928 25%, transparent 25%),
                               linear-gradient(-45deg, #242928 25%, transparent 25%),
                               linear-gradient(45deg, transparent 75%, #242928 75%),
                               linear-gradient(-45deg, transparent 75%, #242928 75%)`,
              backgroundSize: '12px 12px',
              backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
            }}
          >
            {/* Gradient Fill Overlay */}
            <div
              className="absolute inset-0 rounded-[4px] pointer-events-none"
              style={{ background: trackGradientCss }}
            />

            {/* Midpoint Diamonds between adjacent color stops */}
            {sortedStops.slice(0, -1).map((s1, idx) => {
              const s2 = sortedStops[idx + 1];
              const mRatio = midpoints[idx] !== undefined ? midpoints[idx] : 0.5;
              const midOffset = s1.offset + (s2.offset - s1.offset) * mRatio;

              return (
                <div
                  key={`mid_${s1.id}_${s2.id}`}
                  style={{ left: `${(midOffset * 100).toFixed(2)}%` }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    dragTargetRef.current = { type: 'midpoint', id: `mid_${idx}`, index: idx, startY: e.clientY };
                  }}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-[#b89058] border border-black shadow-md cursor-ew-resize hover:scale-125 hover:bg-[#5fd3ad] transition-transform z-15"
                  title={`Midpoint interpolation bias: ${Math.round(mRatio * 100)}% (Drag left/right to skew gradient ramp)`}
                />
              );
            })}
          </div>

          {/* Bottom Row: Color Stop Handles (Upwards Triangles) */}
          <div className="relative h-5 mt-1">
            {sortedStops.map((stop) => {
              const isSelected = stop.id === activeColorStop?.id;
              return (
                <div
                  key={stop.id}
                  style={{ left: `${(stop.offset * 100).toFixed(2)}%` }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelectedColorStopId(stop.id);
                    dragTargetRef.current = { type: 'color', id: stop.id, startY: e.clientY };
                  }}
                  className={`absolute -translate-x-1/2 top-0 flex flex-col items-center cursor-pointer group z-20`}
                  title={`Color stop: ${stop.color} at ${(stop.offset * 100).toFixed(0)}% (Drag off or press Delete to remove)`}
                >
                  {/* Upward triangle arrow */}
                  <div
                    className={`w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[5px] ${
                      isSelected ? 'border-b-[#5fd3ad]' : 'border-b-[#2c3532]'
                    }`}
                  />
                  {/* Square color swatch handle */}
                  <div
                    className={`w-4 h-4 rounded-sm border shadow-md transition-transform ${
                      isSelected
                        ? 'border-white ring-2 ring-[#5fd3ad] scale-110'
                        : 'border-[#2c3532] hover:scale-105'
                    }`}
                    style={{ backgroundColor: stop.color }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* 6. Color Controls Section (Bottom Stops) */}
        <div className="flex flex-col gap-1 p-2 rounded-xl bg-[#121615] border border-[#2c3532]">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white/70">Color Stop:</span>
              {/* Color Swatch trigger with hidden native picker */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => colorInputRef.current?.click()}
                  className="w-6 h-6 rounded-md border border-[#2c3532] shadow-sm cursor-pointer hover:scale-105 transition-transform"
                  style={{ backgroundColor: activeColorStop?.color || '#ffffff' }}
                  title="Click to open color picker"
                />
                <input
                  ref={colorInputRef}
                  type="color"
                  value={activeColorStop?.color || '#ffffff'}
                  onChange={(e) => {
                    const newHex = e.target.value;
                    setStops((prev) =>
                      prev.map((s) =>
                        s.id === activeColorStop?.id ? { ...s, color: newHex } : s
                      )
                    );
                  }}
                  className="sr-only"
                />
                <input
                  type="text"
                  value={activeColorStop?.color || '#ffffff'}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStops((prev) =>
                      prev.map((s) =>
                        s.id === activeColorStop?.id ? { ...s, color: val } : s
                      )
                    );
                  }}
                  className="w-20 bg-[#181d1b] border border-[#2c3532] rounded px-1.5 py-0.5 font-mono text-xs text-[#5fd3ad] uppercase focus:outline-none focus:border-[#5fd3ad]"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-white/50">Position:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={Math.round((activeColorStop?.offset ?? 0) * 100)}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(100, Number(e.target.value))) / 100;
                    setStops((prev) =>
                      prev.map((s) =>
                        s.id === activeColorStop?.id ? { ...s, offset: val } : s
                      )
                    );
                  }}
                  className="w-14 bg-[#181d1b] border border-[#2c3532] rounded px-1.5 py-0.5 text-right font-mono text-xs text-[#e6c699] focus:outline-none focus:border-[#5fd3ad]"
                />
                <span className="text-white/40">%</span>
              </div>

              <button
                onClick={handleDeleteActiveColorStop}
                disabled={stops.length <= 2}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition ${
                  stops.length > 2
                    ? 'mayan-btn-stone hover:text-red-400 cursor-pointer'
                    : 'opacity-40 cursor-not-allowed text-white/30'
                }`}
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* 7. Gradient Transform Options: Shift, Repeat, Reverse */}
        <div className="grid grid-cols-3 gap-2.5 p-2 rounded-xl bg-[#121615] border border-[#2c3532] text-xs">
          {/* Shift Slider */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-white/60">Shift:</span>
              <span className="font-mono text-[#5fd3ad]">
                {shift > 0 ? `+${shift.toFixed(2)}` : shift.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={-100}
              max={100}
              value={Math.round(shift * 100)}
              onChange={(e) => setShift(Number(e.target.value) / 100)}
              className="w-full h-1.5 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
            />
          </div>

          {/* Repeat Slider */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-white/60">Repeat:</span>
              <span className="font-mono text-[#5fd3ad]">{repeat}×</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={repeat}
              onChange={(e) => setRepeat(Number(e.target.value))}
              className="w-full h-1.5 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
            />
          </div>

          {/* Reverse Toggle */}
          <div className="flex flex-col justify-end">
            <button
              onClick={() => setReverse((prev) => !prev)}
              className={`w-full py-1 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center justify-center gap-1.5 ${
                reverse ? 'mayan-btn-jade' : 'mayan-btn-stone'
              }`}
            >
              <RotateCcw size={12} className={reverse ? 'rotate-180 transition-transform' : ''} />
              <span>Reverse Ramp</span>
            </button>
          </div>
        </div>

        {/* 8. Modal Action Bar: Cancel & OK */}
        <div className="flex items-center justify-between pt-2 border-t border-[#2c3532]">
          <span className="text-[10px] text-white/40 italic">
            Maps pixel luminance (0.299R + 0.587G + 0.114B) across 256-entry RGBA LUT
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-3.5 py-1.5 rounded-xl mayan-btn-stone text-xs font-semibold text-[#e6c699] hover:text-white cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCommit}
              className="px-4 py-1.5 rounded-xl mayan-btn-jade text-xs font-semibold text-white flex items-center gap-1.5 shadow-md hover:brightness-110 cursor-pointer transition active:scale-95"
            >
              <Check size={14} />
              <span>OK</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
