import React, { useState, useRef } from 'react';
import { Trash2, Plus, Sparkles } from 'lucide-react';
import { GradientColorStop, GradientOpacityStop } from '../utils/filterEffectsEngine';

interface GradientMapEditorProps {
  intensity: number;
  smoothness: number;
  gradientType: 'normal' | 'noise';
  colorStops: GradientColorStop[];
  opacityStops: GradientOpacityStop[];
  currentColor: string;
  onChange: (updates: {
    intensity?: number;
    smoothness?: number;
    gradientType?: 'normal' | 'noise';
    colorStops?: GradientColorStop[];
    opacityStops?: GradientOpacityStop[];
  }) => void;
}

export const GradientMapEditor: React.FC<GradientMapEditorProps> = ({
  intensity,
  smoothness,
  gradientType,
  colorStops,
  opacityStops,
  currentColor,
  onChange,
}) => {
  const [selectedOpacityStopId, setSelectedOpacityStopId] = useState<string | null>(opacityStops[0]?.id || null);
  const [selectedColorStopId, setSelectedColorStopId] = useState<string | null>(colorStops[0]?.id || null);
  const barRef = useRef<HTMLDivElement | null>(null);

  const selectedOpacityStop = opacityStops.find((s) => s.id === selectedOpacityStopId);
  const selectedColorStop = colorStops.find((s) => s.id === selectedColorStopId);

  // Gradient CSS preview for the bar
  const sortedColorStops = [...colorStops].sort((a, b) => a.position - b.position);
  const cssGradient = `linear-gradient(to right, ${sortedColorStops
    .map((s) => `${s.color} ${Math.round(s.position * 100)}%`)
    .join(', ')})`;

  // Handle click on top edge (add opacity stop)
  const handleTopEdgeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newStop: GradientOpacityStop = {
      id: `op_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      position: Number(pos.toFixed(3)),
      opacity: 1.0,
    };
    const next = [...opacityStops, newStop];
    setSelectedOpacityStopId(newStop.id);
    onChange({ opacityStops: next });
  };

  // Handle click on bottom edge (add color stop)
  const handleBottomEdgeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newStop: GradientColorStop = {
      id: `col_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      position: Number(pos.toFixed(3)),
      color: currentColor || '#3b82f6',
      type: 'custom',
    };
    const next = [...colorStops, newStop];
    setSelectedColorStopId(newStop.id);
    onChange({ colorStops: next });
  };

  const handleUpdateOpacityStop = (up: Partial<GradientOpacityStop>) => {
    if (!selectedOpacityStopId) return;
    const next = opacityStops.map((s) => (s.id === selectedOpacityStopId ? { ...s, ...up } : s));
    onChange({ opacityStops: next });
  };

  const handleDeleteOpacityStop = () => {
    if (opacityStops.length <= 2 || !selectedOpacityStopId) return;
    const next = opacityStops.filter((s) => s.id !== selectedOpacityStopId);
    setSelectedOpacityStopId(next[0]?.id || null);
    onChange({ opacityStops: next });
  };

  const handleUpdateColorStop = (up: Partial<GradientColorStop>) => {
    if (!selectedColorStopId) return;
    const next = colorStops.map((s) => (s.id === selectedColorStopId ? { ...s, ...up } : s));
    onChange({ colorStops: next });
  };

  const handleDeleteColorStop = () => {
    if (colorStops.length <= 2 || !selectedColorStopId) return;
    const next = colorStops.filter((s) => s.id !== selectedColorStopId);
    setSelectedColorStopId(next[0]?.id || null);
    onChange({ colorStops: next });
  };

  return (
    <div className="flex flex-col gap-3 bg-[#181a22] p-3 rounded-xl border border-white/10 select-none text-xs text-white">
      {/* Header Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-white/50 font-medium">Type:</span>
          <select
            value={gradientType}
            onChange={(e) => onChange({ gradientType: e.target.value as 'normal' | 'noise' })}
            className="bg-[#101115] border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none cursor-pointer"
          >
            <option value="normal">Normal / Solid</option>
            <option value="noise">Noise / Dispersion</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-white/50 font-medium">Smoothness:</span>
          <input
            type="number"
            min={0}
            max={100}
            value={smoothness}
            onChange={(e) => onChange({ smoothness: Math.max(0, Math.min(100, Number(e.target.value))) })}
            className="w-12 bg-[#101115] border border-white/10 rounded-lg px-1.5 py-0.5 text-center text-xs text-white font-mono"
          />
          <span className="text-[10px] text-white/40 font-mono">%</span>
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-[140px]">
          <span className="text-[11px] text-white/50 font-medium">Blend:</span>
          <input
            type="range"
            min={0}
            max={100}
            value={intensity}
            onChange={(e) => onChange({ intensity: Number(e.target.value) })}
            className="flex-1 h-1.5 bg-white/10 accent-blue-500 rounded-lg cursor-pointer"
          />
          <span className="text-blue-400 font-mono text-[11px] w-8 text-right">{intensity}%</span>
        </div>
      </div>

      {/* Interactive Dual-Stop Gradient Bar */}
      <div className="relative pt-6 pb-6 px-3">
        {/* Top Edge: Opacity Stops Track */}
        <div
          onClick={handleTopEdgeClick}
          className="absolute top-0 inset-x-3 h-5 cursor-crosshair flex items-center"
          title="Click top edge to add an Opacity Stop"
        >
          {opacityStops.map((stop) => {
            const isSelected = stop.id === selectedOpacityStopId;
            return (
              <div
                key={stop.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedOpacityStopId(stop.id);
                }}
                style={{ left: `${stop.position * 100}%` }}
                className={`absolute -translate-x-1/2 w-3.5 h-3.5 rounded-sm border cursor-pointer transition-transform ${
                  isSelected
                    ? 'border-white bg-blue-500 ring-2 ring-blue-400 scale-125 z-20'
                    : 'border-white/60 bg-zinc-800 hover:border-white z-10'
                }`}
                title={`Opacity Stop: ${Math.round(stop.opacity * 100)}% at ${Math.round(stop.position * 100)}%`}
              />
            );
          })}
        </div>

        {/* Center Gradient Ramp Bar */}
        <div
          ref={barRef}
          className="w-full h-8 rounded-md border border-white/20 shadow-inner relative overflow-hidden"
          style={{ background: cssGradient }}
        />

        {/* Bottom Edge: Color Stops Track */}
        <div
          onClick={handleBottomEdgeClick}
          className="absolute bottom-0 inset-x-3 h-5 cursor-crosshair flex items-center"
          title="Click bottom edge to add a Color Stop"
        >
          {colorStops.map((stop) => {
            const isSelected = stop.id === selectedColorStopId;
            return (
              <div
                key={stop.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedColorStopId(stop.id);
                }}
                style={{ left: `${stop.position * 100}%` }}
                className={`absolute -translate-x-1/2 w-4 h-4 rounded-sm border cursor-pointer transition-transform ${
                  isSelected
                    ? 'border-white ring-2 ring-blue-400 scale-125 z-20'
                    : 'border-white/60 hover:border-white z-10'
                }`}
                title={`Color Stop: ${stop.color} at ${Math.round(stop.position * 100)}%`}
              >
                <div className="w-full h-full rounded-sm" style={{ backgroundColor: stop.color }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Stop Inspectors (Dual Sections: Opacity and Color) */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10 text-[11px]">
        {/* Opacity Stop Inspector */}
        <div className="flex flex-col gap-1.5 bg-[#121319] p-2 rounded-lg border border-white/5">
          <div className="flex items-center justify-between text-white/50 font-semibold text-[10px] uppercase tracking-wider">
            <span>Opacity Stop</span>
            {selectedOpacityStop && opacityStops.length > 2 && (
              <button
                onClick={handleDeleteOpacityStop}
                className="text-red-400 hover:text-red-300 p-0.5 cursor-pointer"
                title="Delete Opacity Stop"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
          {selectedOpacityStop ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-white/60">Opacity:</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(selectedOpacityStop.opacity * 100)}
                  onChange={(e) => handleUpdateOpacityStop({ opacity: Number(e.target.value) / 100 })}
                  className="flex-1 h-1.5 bg-white/10 accent-blue-500 rounded-lg cursor-pointer"
                />
                <span className="font-mono text-white/80 w-8 text-right">
                  {Math.round(selectedOpacityStop.opacity * 100)}%
                </span>
              </div>
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-white/60">Location:</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(selectedOpacityStop.position * 100)}
                  onChange={(e) => handleUpdateOpacityStop({ position: Number(e.target.value) / 100 })}
                  className="flex-1 h-1.5 bg-white/10 accent-blue-500 rounded-lg cursor-pointer"
                />
                <span className="font-mono text-white/80 w-8 text-right">
                  {Math.round(selectedOpacityStop.position * 100)}%
                </span>
              </div>
            </div>
          ) : (
            <span className="text-white/30 text-[10px] italic">Click a top stop to edit</span>
          )}
        </div>

        {/* Color Stop Inspector */}
        <div className="flex flex-col gap-1.5 bg-[#121319] p-2 rounded-lg border border-white/5">
          <div className="flex items-center justify-between text-white/50 font-semibold text-[10px] uppercase tracking-wider">
            <span>Color Stop</span>
            {selectedColorStop && colorStops.length > 2 && (
              <button
                onClick={handleDeleteColorStop}
                className="text-red-400 hover:text-red-300 p-0.5 cursor-pointer"
                title="Delete Color Stop"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
          {selectedColorStop ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-white/60">Color:</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={selectedColorStop.color}
                    onChange={(e) => handleUpdateColorStop({ color: e.target.value })}
                    className="w-5 h-5 rounded border border-white/20 bg-transparent cursor-pointer p-0"
                  />
                  <select
                    value={selectedColorStop.type || 'custom'}
                    onChange={(e) => {
                      const t = e.target.value as 'custom' | 'foreground' | 'background';
                      handleUpdateColorStop({
                        type: t,
                        color: t === 'foreground' ? currentColor : t === 'background' ? '#ffffff' : selectedColorStop.color,
                      });
                    }}
                    className="bg-[#181a22] border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white focus:outline-none"
                  >
                    <option value="custom">Custom</option>
                    <option value="foreground">Foreground</option>
                    <option value="background">Background</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-white/60">Location:</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(selectedColorStop.position * 100)}
                  onChange={(e) => handleUpdateColorStop({ position: Number(e.target.value) / 100 })}
                  className="flex-1 h-1.5 bg-white/10 accent-blue-500 rounded-lg cursor-pointer"
                />
                <span className="font-mono text-white/80 w-8 text-right">
                  {Math.round(selectedColorStop.position * 100)}%
                </span>
              </div>
            </div>
          ) : (
            <span className="text-white/30 text-[10px] italic">Click a bottom stop to edit</span>
          )}
        </div>
      </div>
    </div>
  );
};
