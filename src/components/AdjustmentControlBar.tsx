import React, { useState, useRef, useEffect } from 'react';
import { Layer } from '../types/canvas';
import {
  SlidersHorizontal,
  RotateCcw,
  Sparkles,
  X,
  Check,
  Maximize2,
  SunMedium,
  Contrast,
  Sliders,
  Palette,
  Pipette,
  Flame,
  Camera,
  Film,
  Upload,
  Layers,
  Lightbulb,
  Plus,
  Trash2,
  Brush as BrushIcon,
  Wand2,
  Undo2,
  Redo2,
  GripHorizontal,
  Shuffle,
} from 'lucide-react';
import { MayanCornerBrackets } from './MayanDecorations';
import {
  GRADIENT_MAP_PRESETS,
  GradientMapStop,
  PHOTO_FILTER_PRESETS,
  CINEMATIC_3D_LUTS,
  STYLE_FILTERS_24,
  THERMAL_GRADIENT_TYPES,
  SelectiveColorChannel,
  parseCubeLut,
} from '../utils/canvasAdjustments';
import {
  createDefaultRelightSettings,
  RELIGHT_STUDIO_PRESETS,
  RelightSettings,
  RelightLightSource,
  undoRelightDepth,
  redoRelightDepth,
  canUndoRelightDepth,
  canRedoRelightDepth,
  getOrCreateRelightDepthCanvas,
  resetRelightDepthCanvas,
  randomizeRelightDepth,
} from '../utils/relightEngine';

interface AdjustmentControlBarProps {
  layer: Layer;
  onUpdateSettings: (settings: Record<string, any>) => void;
  onRasterize?: () => void;
  onReset?: () => void;
  onClose?: () => void;
  onOpenGradientEditor?: () => void;
}

export const AdjustmentControlBar: React.FC<AdjustmentControlBarProps> = ({
  layer,
  onUpdateSettings,
  onRasterize,
  onReset,
  onClose,
  onOpenGradientEditor,
}) => {
  const config = layer.adjustmentConfig;
  if (!config) return null;

  const type = config.type;
  const settings = config.settings || {};

  // Curves Channel Selector
  const [activeChannel, setActiveChannel] = useState<'rgb' | 'r' | 'g' | 'b'>('rgb');

  // Selective Color Active Channel
  const [activeSelChannel, setActiveSelChannel] = useState<SelectiveColorChannel>('reds');

  // Relight Studio active sub-tab ('presets' | 'ambient' | 'depth_sculpt' | lightId)
  const [relightTab, setRelightTab] = useState<string>('light_1');

  // Gradient Map Stop Selection
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingStopIdRef = useRef<string | null>(null);

  const handleSliderChange = (key: string, val: any) => {
    onUpdateSettings({
      ...settings,
      layerId: layer.id,
      [key]: val,
    });
  };

  const getAdjustmentIcon = () => {
    switch (type) {
      case 'relight':
        return <Lightbulb size={15} className="text-[#5fd3ad]" />;
      case 'curves':
        return <Sliders size={15} className="text-blue-400" />;
      case 'hue_saturation':
        return <Palette size={15} className="text-pink-400" />;
      case 'brightness_contrast':
        return <SunMedium size={15} className="text-amber-400" />;
      case 'black_and_white':
        return <Contrast size={15} className="text-gray-300" />;
      case 'gradient_fill':
        return <Sparkles size={15} className="text-teal-400" />;
      case 'gradient_map':
        return <Palette size={15} className="text-[#5fd3ad]" />;
      case 'selective_color':
        return <Pipette size={15} className="text-cyan-400" />;
      case 'color_lookup':
        return <Film size={15} className="text-purple-400" />;
      case 'photo_filter':
        return <Camera size={15} className="text-amber-400" />;
      case 'style_filters':
        return <Layers size={15} className="text-pink-400" />;
      case 'exposure':
        return <SunMedium size={15} className="text-yellow-400" />;
      case 'thermal':
        return <Flame size={15} className="text-red-400" />;
      default:
        return <SlidersHorizontal size={15} className="text-purple-400" />;
    }
  };

  const getAdjustmentLabel = () => {
    switch (type) {
      case 'relight':
        return '3D Relight & Depth Studio';
      case 'curves':
        return 'Curves Adjustment';
      case 'hue_saturation':
        return 'Hue / Saturation';
      case 'brightness_contrast':
        return 'Brightness / Contrast';
      case 'black_and_white':
        return 'Black & White';
      case 'invert':
        return 'Invert Colors';
      case 'threshold':
        return 'Threshold Level';
      case 'posterize':
        return 'Posterize';
      case 'gradient_fill':
        return 'Gradient Fill';
      case 'gradient_map':
        return 'Gradient Map Studio';
      case 'selective_color':
        return 'Selective Color';
      case 'color_lookup':
        return 'Color Lookup (3D LUT)';
      case 'photo_filter':
        return 'Photo Filter';
      case 'style_filters':
        return 'Style Filters (24 Presets)';
      case 'exposure':
        return 'Photometric Exposure';
      case 'thermal':
        return 'Thermal Infrared Effect';
      default:
        return `${layer.name}`;
    }
  };

  // Gradient Map Helpers
  const stops: GradientMapStop[] = settings.stops || GRADIENT_MAP_PRESETS[0].stops;
  const gradientShift = settings.shift !== undefined ? Number(settings.shift) : 0;
  const gradientRepeat = settings.repeat !== undefined ? Number(settings.repeat) : 1;
  const isReverse = !!settings.reverse;

  const sortedStops = [...stops].sort((a, b) => a.offset - b.offset);
  const trackGradientCss = `linear-gradient(to right, ${sortedStops
    .map((s) => `${s.color} ${(s.offset * 100).toFixed(1)}%`)
    .join(', ')})`;

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const offset = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    const existing = stops.find((s) => Math.abs(s.offset - offset) < 0.04);
    if (existing) {
      setActiveStopId(existing.id);
      draggingStopIdRef.current = existing.id;
    } else {
      const newStop: GradientMapStop = {
        id: `stop_${Date.now()}`,
        offset: Number(offset.toFixed(2)),
        color: '#ffffff',
      };
      const updated = [...stops, newStop];
      handleSliderChange('stops', updated);
      setActiveStopId(newStop.id);
      draggingStopIdRef.current = newStop.id;
    }

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!draggingStopIdRef.current || !trackRef.current) return;
      const moveRect = trackRef.current.getBoundingClientRect();
      const moveOffset = Math.max(0, Math.min(1, (moveEvent.clientX - moveRect.left) / moveRect.width));
      const targetId = draggingStopIdRef.current;
      const newStops = (settings.stops || stops).map((s: GradientMapStop) =>
        s.id === targetId ? { ...s, offset: Number(moveOffset.toFixed(3)) } : s
      );
      handleSliderChange('stops', newStops);
    };

    const onPointerUp = () => {
      draggingStopIdRef.current = null;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleCubeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCubeLut(text);
      if (parsed) {
        handleSliderChange('customLutName', file.name);
        handleSliderChange('presetId', 'custom');
      }
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        if (e.key === 'Escape' && onClose) {
          e.preventDefault();
          onClose();
        }
        return;
      }
      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && onClose) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const [panelPos, setPanelPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingHeaderRef = useRef(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number }>({
    clientX: 0,
    clientY: 0,
    startX: 0,
    startY: 0,
  });

  const handleHeaderPointerDown = (e: React.PointerEvent) => {
    isDraggingHeaderRef.current = true;
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startX: panelPos.x,
      startY: panelPos.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handleHeaderPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingHeaderRef.current) return;
    const dx = e.clientX - dragStartRef.current.clientX;
    const dy = e.clientY - dragStartRef.current.clientY;
    setPanelPos({
      x: dragStartRef.current.startX + dx,
      y: dragStartRef.current.startY + dy,
    });
  };

  const handleHeaderPointerUp = (e: React.PointerEvent) => {
    isDraggingHeaderRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}
  };

  return (
    <div
      className={
        type === 'relight'
          ? 'fixed bottom-6 inset-x-0 mx-auto z-40 max-w-3xl w-[94vw] md:w-[720px] mayan-panel p-3.5 text-[#e6c699] flex flex-col gap-2.5 select-none animate-in slide-in-from-bottom-3 duration-150 relative shadow-[0_16px_50px_rgba(0,0,0,0.95)] max-h-[82vh] overflow-y-auto'
          : 'fixed bottom-6 inset-x-0 mx-auto z-40 max-w-xl w-[92vw] mayan-panel p-3.5 text-[#e6c699] flex flex-col gap-2.5 select-none animate-in slide-in-from-bottom-3 duration-150 relative shadow-[0_16px_50px_rgba(0,0,0,0.95)] max-h-[78vh] overflow-y-auto'
      }
      style={{
        transform: `translate(${panelPos.x}px, ${panelPos.y}px)`,
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <MayanCornerBrackets size={16} color="#b89058" />

      {/* Top Bar: Title, Drag Handle, Type Badge, Reset, Rasterize, Done / Close */}
      <div
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        className="flex items-center justify-between pb-2 border-b border-[#2c3532] text-xs shrink-0 cursor-grab active:cursor-grabbing select-none"
        title="Drag header to move control panel"
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripHorizontal size={14} className="text-[#9e9484] shrink-0" />
          <div className="w-6 h-6 rounded-lg mayan-well border border-[#b89058]/50 flex items-center justify-center shrink-0">
            {getAdjustmentIcon()}
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mayan font-bold text-[#e6c699] tracking-wider truncate">
              {getAdjustmentLabel()}
            </span>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#164435] text-[#5fd3ad] border border-[#5fd3ad]/40 font-bold shrink-0">
              NON-DESTRUCTIVE
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
          {onReset && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (type === 'relight') {
                  resetRelightDepthCanvas(layer.id, layer.canvas.width, layer.canvas.height);
                  onUpdateSettings({
                    ...createDefaultRelightSettings(),
                    layerId: layer.id,
                    regenerateSignal: Date.now(),
                  });
                } else {
                  onReset();
                }
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Reset Settings to Defaults"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs mayan-btn-stone hover:text-white transition-colors cursor-pointer"
            >
              <RotateCcw size={12} className="text-[#b89058]" />
              <span>Reset</span>
            </button>
          )}
          {onRasterize && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRasterize();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Bake adjustment into regular pixel layer"
              className="mayan-btn-cta flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold shadow-md transition-transform cursor-pointer active:scale-95"
            >
              <Sparkles size={12} />
              <span>Rasterize</span>
            </button>
          )}
          {onClose && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Apply & Close Adjustment Controls (Enter)"
              className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold mayan-btn-jade text-white shadow transition-all cursor-pointer hover:brightness-110 active:scale-95"
            >
              <Check size={13} />
              <span>Apply / Done</span>
            </button>
          )}
          {onClose && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Close Controls (Esc)"
              className="w-7 h-7 rounded-lg mayan-btn-stone flex items-center justify-center text-xs text-[#9e9484] hover:text-white transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Adjustment Specific Controls */}
      <div className="flex flex-col gap-2.5">
        {/* 0. 3D RELIGHT & DEPTH SCULPTOR STUDIO */}
        {type === 'relight' && (() => {
          const relightCfg: RelightSettings = {
            ...createDefaultRelightSettings(),
            ...settings,
          };
          const lights = relightCfg.lights || [];
          const updateRelight = (updates: Partial<RelightSettings> & Record<string, any>) => {
            onUpdateSettings({
              ...relightCfg,
              ...updates,
              layerId: layer.id,
            });
          };

          const activeLight = lights.find((l) => l.id === relightTab) || lights[0];
          const targetDepthPct = Math.round((relightCfg.sculptTargetDepth ?? 0.85) * 100);
          const gray255 = Math.round((relightCfg.sculptTargetDepth ?? 0.85) * 255);

          return (
            <div className="flex flex-col gap-2.5">
              {/* View Mode & Depth Sculptor Quick Bar */}
              <div className="flex items-center justify-between gap-2 bg-[#0b0e0d] p-1.5 rounded-xl border border-[#2c3532]">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[#9e9484] px-1.5 font-semibold uppercase">View:</span>
                  {(
                    [
                      { id: 'lit', label: '3D Relit' },
                      { id: 'unlit', label: 'Original Color' },
                      { id: 'depth', label: 'Depth Map' },
                      { id: 'normals', label: '3D Normals' },
                    ] as const
                  ).map((vm) => (
                    <button
                      key={vm.id}
                      onClick={() => updateRelight({ viewMode: vm.id })}
                      className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                        relightCfg.viewMode === vm.id
                          ? 'mayan-btn-jade text-white shadow'
                          : 'text-[#e6c699]/70 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {vm.label}
                    </button>
                  ))}
                </div>

                {/* Toggle between Moving Lights vs. Painting Depth Map */}
                <button
                  onClick={() => {
                    const nextMode = relightCfg.editSubMode === 'depth_sculpt' ? 'lighting' : 'depth_sculpt';
                    updateRelight({ editSubMode: nextMode });
                    if (nextMode === 'depth_sculpt') {
                      setRelightTab('depth_sculpt');
                    } else if (relightTab === 'depth_sculpt') {
                      setRelightTab(lights[0]?.id || 'ambient');
                    }
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                    relightCfg.editSubMode === 'depth_sculpt'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                      : 'mayan-btn-stone text-[#e6c699] hover:border-[#5fd3ad]'
                  }`}
                  title="Paint directly on the canvas to sculpt 3D depth"
                >
                  <BrushIcon size={11} />
                  <span>
                    {relightCfg.editSubMode === 'depth_sculpt' ? 'Sculpting Depth (Active)' : 'Sculpt Depth Map'}
                  </span>
                </button>
              </div>

              {/* Navigation Pills: Presets | Ambient | Depth Studio | Light 1 | Light 2 | + Light */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                <button
                  onClick={() => {
                    setRelightTab('presets');
                    updateRelight({ editSubMode: 'lighting' });
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer transition ${
                    relightTab === 'presets' ? 'mayan-btn-jade text-white' : 'mayan-btn-stone text-[#e6c699]/80'
                  }`}
                >
                  <Sparkles size={12} />
                  <span>Presets</span>
                </button>

                <button
                  onClick={() => {
                    setRelightTab('ambient');
                    updateRelight({ editSubMode: 'lighting' });
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer transition ${
                    relightTab === 'ambient' ? 'mayan-btn-jade text-white' : 'mayan-btn-stone text-[#e6c699]/80'
                  }`}
                >
                  <SunMedium size={12} />
                  <span>Ambient & Relief</span>
                </button>

                <button
                  onClick={() => {
                    setRelightTab('depth_sculpt');
                    updateRelight({ editSubMode: 'depth_sculpt' });
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer transition ${
                    relightTab === 'depth_sculpt' ? 'mayan-btn-jade text-white' : 'mayan-btn-stone text-[#e6c699]/80'
                  }`}
                >
                  <Wand2 size={12} />
                  <span>Depth Studio</span>
                </button>

                {lights.map((l, idx) => {
                  const isSelected = relightTab === l.id;
                  return (
                    <button
                      key={l.id}
                      onClick={() => {
                        setRelightTab(l.id);
                        updateRelight({ activeLightId: l.id, editSubMode: 'lighting' });
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer transition ${
                        isSelected
                          ? 'bg-[#164435] border-2 border-[#5fd3ad] text-white shadow'
                          : 'mayan-btn-stone text-[#e6c699]/80'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-white/60 shrink-0"
                        style={{ backgroundColor: l.color }}
                      />
                      <span>{l.name || `Light ${idx + 1}`}</span>
                    </button>
                  );
                })}

                {lights.length < 5 && (
                  <button
                    onClick={() => {
                      const newId = `light_${Date.now()}`;
                      const newLight: RelightLightSource = {
                        id: newId,
                        name: `Light ${lights.length + 1}`,
                        x: 0.3 + Math.random() * 0.4,
                        y: 0.3 + Math.random() * 0.4,
                        z: 0.22,
                        color: '#60a5fa',
                        power: 1.3,
                        radius: 0.55,
                        diffusion: 0.4,
                        specular: 0.35,
                      };
                      const nextLights = [...lights, newLight];
                      updateRelight({
                        lights: nextLights,
                        activeLightId: newId,
                        editSubMode: 'lighting',
                      });
                      setRelightTab(newId);
                    }}
                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold mayan-btn-cta flex items-center gap-1 shrink-0 cursor-pointer"
                    title="Add Point Light Source"
                  >
                    <Plus size={12} />
                    <span>+ Light</span>
                  </button>
                )}
              </div>

              {/* TAB A: STUDIO PRESETS */}
              {relightTab === 'presets' && (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {RELIGHT_STUDIO_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        const mappedLights: RelightLightSource[] = preset.lights.map((pl, idx) => ({
                          ...pl,
                          id: `light_${idx + 1}_${Date.now()}`,
                        }));
                        updateRelight({
                          ambientColor: preset.ambientColor,
                          ambientPower: preset.ambientPower,
                          originalLighting: preset.originalLighting,
                          lights: mappedLights,
                          activeLightId: mappedLights[0]?.id || '',
                        });
                        if (mappedLights[0]) setRelightTab(mappedLights[0].id);
                      }}
                      className="p-2 rounded-xl mayan-btn-stone hover:border-[#5fd3ad] flex flex-col items-start gap-1 text-left transition cursor-pointer"
                    >
                      <div className="flex items-center gap-1">
                        {preset.lights.map((pl, i) => (
                          <span
                            key={i}
                            className="w-3 h-3 rounded-full border border-white/40 shadow"
                            style={{ backgroundColor: pl.color }}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] font-semibold text-[#f2fbf7]">{preset.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* TAB B: AMBIENT & 3D RELIEF SETTINGS */}
              {relightTab === 'ambient' && (
                <div className="flex flex-col gap-2.5 bg-[#0c100f] p-3 rounded-xl border border-[#2c3532]">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#e6c699]/80">Ambient Color:</span>
                      <input
                        type="color"
                        value={relightCfg.ambientColor || '#ffffff'}
                        onChange={(e) => updateRelight({ ambientColor: e.target.value })}
                        className="w-6 h-6 rounded border border-white/20 bg-transparent cursor-pointer"
                      />
                    </div>
                    <label className="flex items-center gap-1.5 text-[11px] text-[#e6c699] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={relightCfg.respectSubjectAlpha !== false}
                        onChange={(e) => updateRelight({ respectSubjectAlpha: e.target.checked })}
                        className="accent-[#5fd3ad] rounded cursor-pointer"
                      />
                      <span>Clip to Subject Alpha</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[10px] text-white/60">
                        <span>Ambient Power (0% = Black)</span>
                        <span className="font-mono text-[#5fd3ad]">
                          {Math.round((relightCfg.ambientPower ?? 0.15) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round((relightCfg.ambientPower ?? 0.15) * 100)}
                        onChange={(e) => updateRelight({ ambientPower: Number(e.target.value) / 100 })}
                        className="w-full h-1.5 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[10px] text-white/60">
                        <span>Original Lighting Blend</span>
                        <span className="font-mono text-[#5fd3ad]">
                          {Math.round((relightCfg.originalLighting ?? 0.15) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round((relightCfg.originalLighting ?? 0.15) * 100)}
                        onChange={(e) => updateRelight({ originalLighting: Number(e.target.value) / 100 })}
                        className="w-full h-1.5 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[#2c3532]">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[10px] text-white/60">
                        <span>3D Relief Depth</span>
                        <span className="font-mono text-[#5fd3ad]">
                          {Math.round((relightCfg.surfaceRelief ?? 1.15) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={300}
                        value={Math.round((relightCfg.surfaceRelief ?? 1.15) * 100)}
                        onChange={(e) => updateRelight({ surfaceRelief: Number(e.target.value) / 100 })}
                        className="w-full h-1.5 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[10px] text-white/60">
                        <span>Surface Smoothness</span>
                        <span className="font-mono text-[#5fd3ad]">{relightCfg.surfaceSmoothness ?? 3}px</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={6}
                        value={relightCfg.surfaceSmoothness ?? 3}
                        onChange={(e) => updateRelight({ surfaceSmoothness: Number(e.target.value) })}
                        className="w-full h-1.5 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB C: REWORKED DEPTH SCULPTOR STUDIO (Continuous Far↔Close Slider + Softness + Depth Undo/Redo) */}
              {relightTab === 'depth_sculpt' && (
                <div className="flex flex-col gap-2.5 bg-[#0c100f] p-3 rounded-xl border border-amber-500/40">
                  {/* Top Row: Paint Depth vs Smooth + Dedicated Depth Undo / Redo */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateRelight({ sculptSmoothMode: false, editSubMode: 'depth_sculpt' })}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition flex items-center gap-1.5 ${
                          !relightCfg.sculptSmoothMode
                            ? 'bg-amber-500 text-black shadow'
                            : 'mayan-btn-stone text-[#e6c699]/80'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/40"
                          style={{ backgroundColor: `rgb(${gray255}, ${gray255}, ${gray255})` }}
                        />
                        <span>Paint Depth Value</span>
                      </button>

                      <button
                        onClick={() => updateRelight({ sculptSmoothMode: true, editSubMode: 'depth_sculpt' })}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition ${
                          relightCfg.sculptSmoothMode
                            ? 'bg-amber-500 text-black shadow'
                            : 'mayan-btn-stone text-[#e6c699]/80'
                        }`}
                      >
                        Smooth / Blend Transitions
                      </button>
                    </div>

                    {/* Dedicated Depth Map Undo / Redo Buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        disabled={!canUndoRelightDepth(layer.id)}
                        onClick={() => {
                          if (undoRelightDepth(layer.id)) {
                            const dCanvas = getOrCreateRelightDepthCanvas(layer.id, layer.canvas.width, layer.canvas.height);
                            updateRelight({ depthDataUrl: dCanvas.toDataURL() });
                          }
                        }}
                        className="px-2 py-1 rounded-lg mayan-btn-stone hover:border-[#5fd3ad] disabled:opacity-30 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                        title="Undo Depth Stroke (Ctrl+Z while in Depth Studio)"
                      >
                        <Undo2 size={11} />
                        <span>Undo Depth</span>
                      </button>
                      <button
                        disabled={!canRedoRelightDepth(layer.id)}
                        onClick={() => {
                          if (redoRelightDepth(layer.id)) {
                            const dCanvas = getOrCreateRelightDepthCanvas(layer.id, layer.canvas.width, layer.canvas.height);
                            updateRelight({ depthDataUrl: dCanvas.toDataURL() });
                          }
                        }}
                        className="px-2 py-1 rounded-lg mayan-btn-stone hover:border-[#5fd3ad] disabled:opacity-30 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                        title="Redo Depth Stroke (Ctrl+Y while in Depth Studio)"
                      >
                        <Redo2 size={11} />
                        <span>Redo</span>
                      </button>
                    </div>
                  </div>

                  {/* Continuous Target Depth Intensity Slider (Far Black 0% <-> Mid 50% <-> Close White 100%) */}
                  {!relightCfg.sculptSmoothMode && (
                    <div className="flex flex-col gap-1 pt-0.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-white/70 font-medium">
                          Brush Depth Level (0% Far/Deep ↔ 50% Neutral ↔ 100% Close/Raised)
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updateRelight({ sculptTargetDepth: 0.5 })}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/80 cursor-pointer"
                            title="Set to 50% Neutral Mid-Plane"
                          >
                            50% Mid
                          </button>
                          <span className="font-mono font-bold text-amber-400">
                            {targetDepthPct}% ({targetDepthPct < 45 ? 'Far' : targetDepthPct > 55 ? 'Close' : 'Mid'})
                          </span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={targetDepthPct}
                        onChange={(e) =>
                          updateRelight({
                            sculptTargetDepth: Number(e.target.value) / 100,
                            sculptSmoothMode: false,
                            editSubMode: 'depth_sculpt',
                          })
                        }
                        className="w-full h-2.5 rounded-lg cursor-pointer border border-white/20"
                        style={{
                          background: 'linear-gradient(to right, #000000 0%, #808080 50%, #ffffff 100%)',
                        }}
                      />
                    </div>
                  )}

                  {/* Brush Softness & Flow Sliders */}
                  <div className="grid grid-cols-3 gap-2.5 pt-1 border-t border-white/10">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[10px] text-white/60">
                        <span>Brush Softness</span>
                        <span className="font-mono text-amber-400">
                          {Math.round((relightCfg.sculptSoftness ?? 0.75) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round((relightCfg.sculptSoftness ?? 0.75) * 100)}
                        onChange={(e) => updateRelight({ sculptSoftness: Number(e.target.value) / 100 })}
                        className="w-full h-1.5 bg-white/10 accent-amber-400 rounded cursor-pointer"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[10px] text-white/60">
                        <span>Brush Flow</span>
                        <span className="font-mono text-amber-400">
                          {Math.round((relightCfg.sculptStrength ?? 0.35) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={5}
                        max={100}
                        value={Math.round((relightCfg.sculptStrength ?? 0.35) * 100)}
                        onChange={(e) => updateRelight({ sculptStrength: Number(e.target.value) / 100 })}
                        className="w-full h-1.5 bg-white/10 accent-amber-400 rounded cursor-pointer"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[10px] text-white/60">
                        <span>Auto-Puff Base</span>
                        <span className="font-mono text-[#5fd3ad]">
                          {Math.round((relightCfg.autoPuff ?? 0.65) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round((relightCfg.autoPuff ?? 0.65) * 100)}
                        onChange={(e) =>
                          updateRelight({
                            autoPuff: Number(e.target.value) / 100,
                            regenerateSignal: Date.now(),
                          })
                        }
                        className="w-full h-1.5 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-white/10">
                    <label className="flex items-center gap-1.5 text-[10px] text-[#e6c699]/80 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={relightCfg.ignoreInkLines !== false}
                        onChange={(e) =>
                          updateRelight({
                            ignoreInkLines: e.target.checked,
                            regenerateSignal: Date.now(),
                          })
                        }
                        className="accent-[#5fd3ad] rounded cursor-pointer"
                      />
                      <span>Ignore Black Lineart Trenches</span>
                    </label>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          const dCanvas = resetRelightDepthCanvas(
                            layer.id,
                            layer.canvas.width,
                            layer.canvas.height,
                            layer.canvas,
                            relightCfg.autoPuff,
                            relightCfg.ignoreInkLines
                          );
                          updateRelight({
                            depthDataUrl: dCanvas.toDataURL(),
                            regenerateSignal: Date.now(),
                          });
                        }}
                        className="px-2.5 py-1 rounded-lg mayan-btn-cta text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        title="Recalculate base depth map from current canvas art"
                      >
                        <Wand2 size={11} />
                        <span>Recalculate Base Depth</span>
                      </button>

                      <button
                        onClick={() => {
                          const dCanvas = randomizeRelightDepth(
                            layer.id,
                            layer.canvas.width,
                            layer.canvas.height,
                            layer.canvas
                          );
                          updateRelight({
                            depthDataUrl: dCanvas.toDataURL(),
                            regenerateSignal: Date.now(),
                          });
                        }}
                        className="px-2.5 py-1 rounded-lg mayan-btn-stone hover:border-amber-400 text-amber-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        title="Randomize depth with organic 3D surface harmonic relief"
                      >
                        <Shuffle size={11} />
                        <span>Randomize Depth</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB D: INDIVIDUAL POINT LIGHT CONTROLS */}
              {relightTab !== 'presets' &&
                relightTab !== 'ambient' &&
                relightTab !== 'depth_sculpt' &&
                activeLight && (
                  <div className="flex flex-col gap-2.5 bg-[#0c100f] p-3 rounded-xl border border-[#2c3532]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-[#f2fbf7]">
                          {activeLight.name} Color:
                        </span>
                        <input
                          type="color"
                          value={activeLight.color}
                          onChange={(e) => {
                            const updated = lights.map((l) =>
                              l.id === activeLight.id ? { ...l, color: e.target.value } : l
                            );
                            updateRelight({ lights: updated });
                          }}
                          className="w-6 h-6 rounded border border-white/20 bg-transparent cursor-pointer"
                        />
                        <span className="text-[10px] font-mono text-white/50 uppercase">
                          {activeLight.color}
                        </span>
                      </div>

                      {lights.length > 1 && (
                        <button
                          onClick={() => {
                            const remaining = lights.filter((l) => l.id !== activeLight.id);
                            updateRelight({
                              lights: remaining,
                              activeLightId: remaining[0]?.id || '',
                            });
                            setRelightTab(remaining[0]?.id || 'ambient');
                          }}
                          className="px-2 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                          title="Delete this light source"
                        >
                          <Trash2 size={11} />
                          <span>Delete Light</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[10px] text-white/60">
                          <span>Power / Intensity</span>
                          <span className="font-mono text-[#5fd3ad]">
                            {Math.round(activeLight.power * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={250}
                          value={Math.round(activeLight.power * 100)}
                          onChange={(e) => {
                            const val = Number(e.target.value) / 100;
                            updateRelight({
                              lights: lights.map((l) =>
                                l.id === activeLight.id ? { ...l, power: val } : l
                              ),
                            });
                          }}
                          className="w-full h-1.5 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[10px] text-white/60">
                          <span>Distance (Close / Far Rim)</span>
                          <span className="font-mono text-[#5fd3ad]">
                            {activeLight.z < 0
                              ? `Rim (${Math.round(activeLight.z * 100)}%)`
                              : `${Math.round(activeLight.z * 100)}%`}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-50}
                          max={100}
                          value={Math.round(activeLight.z * 100)}
                          onChange={(e) => {
                            const val = Number(e.target.value) / 100;
                            updateRelight({
                              lights: lights.map((l) =>
                                l.id === activeLight.id ? { ...l, z: val } : l
                              ),
                            });
                          }}
                          className="w-full h-1.5 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 pt-1 border-t border-[#2c3532]">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[10px] text-white/60">
                          <span>Radius</span>
                          <span className="font-mono text-[#5fd3ad]">
                            {Math.round(activeLight.radius * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={10}
                          max={150}
                          value={Math.round(activeLight.radius * 100)}
                          onChange={(e) => {
                            const val = Number(e.target.value) / 100;
                            updateRelight({
                              lights: lights.map((l) =>
                                l.id === activeLight.id ? { ...l, radius: val } : l
                              ),
                            });
                          }}
                          className="w-full h-1.5 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[10px] text-white/60">
                          <span>Diffusion</span>
                          <span className="font-mono text-[#5fd3ad]">
                            {Math.round((activeLight.diffusion ?? 0.4) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round((activeLight.diffusion ?? 0.4) * 100)}
                          onChange={(e) => {
                            const val = Number(e.target.value) / 100;
                            updateRelight({
                              lights: lights.map((l) =>
                                l.id === activeLight.id ? { ...l, diffusion: val } : l
                              ),
                            });
                          }}
                          className="w-full h-1.5 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[10px] text-white/60">
                          <span>Specular</span>
                          <span className="font-mono text-[#5fd3ad]">
                            {Math.round((activeLight.specular ?? 0.35) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round((activeLight.specular ?? 0.35) * 100)}
                          onChange={(e) => {
                            const val = Number(e.target.value) / 100;
                            updateRelight({
                              lights: lights.map((l) =>
                                l.id === activeLight.id ? { ...l, specular: val } : l
                              ),
                            });
                          }}
                          className="w-full h-1.5 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}
            </div>
          );
        })()}

        {/* 1. HUE / SATURATION / LIGHTNESS */}
        {type === 'hue_saturation' && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] text-white/60">
                <span>Hue Shift</span>
                <span className="font-mono text-white/80">
                  {settings.hue ?? 0 > 0 ? `+${settings.hue ?? 0}°` : `${settings.hue ?? 0}°`}
                </span>
              </div>
              <input
                type="range"
                min={-180}
                max={180}
                value={settings.hue ?? 0}
                onChange={(e) => handleSliderChange('hue', Number(e.target.value))}
                className="w-full h-2 rounded-lg cursor-pointer"
                style={{
                  background:
                    'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
                }}
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] text-white/60">
                <span>Saturation</span>
                <span className="font-mono text-white/80">
                  {settings.saturation ?? 0 > 0 ? `+${settings.saturation ?? 0}` : settings.saturation ?? 0}%
                </span>
              </div>
              <input
                type="range"
                min={-100}
                max={100}
                value={settings.saturation ?? 0}
                onChange={(e) => handleSliderChange('saturation', Number(e.target.value))}
                className="w-full h-1.5 bg-white/10 accent-blue-500 rounded-lg cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] text-white/60">
                <span>Lightness</span>
                <span className="font-mono text-white/80">
                  {settings.lightness ?? 0 > 0 ? `+${settings.lightness ?? 0}` : settings.lightness ?? 0}%
                </span>
              </div>
              <input
                type="range"
                min={-100}
                max={100}
                value={settings.lightness ?? 0}
                onChange={(e) => handleSliderChange('lightness', Number(e.target.value))}
                className="w-full h-1.5 bg-white/10 accent-blue-500 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* 2. BRIGHTNESS / CONTRAST */}
        {type === 'brightness_contrast' && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] text-white/60">
                <span>Brightness</span>
                <span className="font-mono text-white/80">
                  {settings.brightness ?? 0 > 0 ? `+${settings.brightness ?? 0}` : settings.brightness ?? 0}
                </span>
              </div>
              <input
                type="range"
                min={-100}
                max={100}
                value={settings.brightness ?? 0}
                onChange={(e) => handleSliderChange('brightness', Number(e.target.value))}
                className="w-full h-1.5 bg-white/10 accent-amber-500 rounded-lg cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] text-white/60">
                <span>Contrast</span>
                <span className="font-mono text-white/80">
                  {settings.contrast ?? 0 > 0 ? `+${settings.contrast ?? 0}` : settings.contrast ?? 0}
                </span>
              </div>
              <input
                type="range"
                min={-100}
                max={100}
                value={settings.contrast ?? 0}
                onChange={(e) => handleSliderChange('contrast', Number(e.target.value))}
                className="w-full h-1.5 bg-white/10 accent-amber-500 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* 3. CURVES */}
        {type === 'curves' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 bg-[#101115] p-0.5 rounded-lg border border-white/5 text-[11px]">
                {(['rgb', 'r', 'g', 'b'] as const).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => setActiveChannel(ch)}
                    className={`px-2.5 py-0.5 rounded-md uppercase font-mono font-bold transition-colors cursor-pointer ${
                      activeChannel === ch
                        ? ch === 'r'
                          ? 'bg-red-600 text-white'
                          : ch === 'g'
                          ? 'bg-emerald-600 text-white'
                          : ch === 'b'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/20 text-white'
                        : 'text-white/40 hover:text-white'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-white/40">Adjust Channel Curves</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-white/50">Shadows</span>
                <input
                  type="range"
                  min={-50}
                  max={50}
                  value={settings[`${activeChannel}_shadows`] ?? 0}
                  onChange={(e) =>
                    handleSliderChange(`${activeChannel}_shadows`, Number(e.target.value))
                  }
                  className="w-full h-1.5 bg-white/10 accent-blue-500 rounded cursor-pointer"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-white/50">Midtones</span>
                <input
                  type="range"
                  min={-50}
                  max={50}
                  value={settings[`${activeChannel}_midtones`] ?? 0}
                  onChange={(e) =>
                    handleSliderChange(`${activeChannel}_midtones`, Number(e.target.value))
                  }
                  className="w-full h-1.5 bg-white/10 accent-blue-500 rounded cursor-pointer"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-white/50">Highlights</span>
                <input
                  type="range"
                  min={-50}
                  max={50}
                  value={settings[`${activeChannel}_highlights`] ?? 0}
                  onChange={(e) =>
                    handleSliderChange(`${activeChannel}_highlights`, Number(e.target.value))
                  }
                  className="w-full h-1.5 bg-white/10 accent-blue-500 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* 4. GRADIENT MAP */}
        {type === 'gradient_map' && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <div className="flex items-center gap-1 flex-wrap">
                {GRADIENT_MAP_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => {
                      handleSliderChange('stops', p.stops);
                      setActiveStopId(p.stops[0]?.id || null);
                    }}
                    className="px-2 py-0.5 rounded text-[10px] mayan-btn-stone hover:text-[#5fd3ad] cursor-pointer"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                {onOpenGradientEditor && (
                  <button
                    onClick={onOpenGradientEditor}
                    className="px-2 py-0.5 rounded text-[10px] mayan-btn-jade text-white font-semibold flex items-center gap-1 cursor-pointer transition hover:brightness-110 shadow-sm"
                    title="Open full interactive Gradient Editor with Opacity Stops & Midpoints"
                  >
                    <Maximize2 size={10} />
                    <span>Full Editor</span>
                  </button>
                )}
                <button
                  onClick={() => handleSliderChange('reverse', !isReverse)}
                  className={`px-2 py-0.5 rounded text-[10px] cursor-pointer transition ${
                    isReverse ? 'mayan-btn-jade font-bold' : 'mayan-btn-stone'
                  }`}
                  title="Reverse gradient stops"
                >
                  ⇄ Reverse
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-white/50">Click track to add stop · Drag to position</span>
              <div
                ref={trackRef}
                onPointerDown={handleTrackPointerDown}
                className="relative w-full h-6 rounded-lg cursor-crosshair border border-white/20 shadow-inner"
                style={{ background: trackGradientCss }}
              >
                {stops.map((stop) => {
                  const isSelected = stop.id === activeStopId;
                  return (
                    <div
                      key={stop.id}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setActiveStopId(stop.id);
                        draggingStopIdRef.current = stop.id;
                      }}
                      className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-5 rounded border cursor-ew-resize flex items-center justify-center transition-transform ${
                        isSelected
                          ? 'border-white ring-2 ring-[#5fd3ad] scale-110 z-10'
                          : 'border-black/60 shadow-md'
                      }`}
                      style={{
                        left: `${stop.offset * 100}%`,
                        backgroundColor: stop.color,
                      }}
                      title={`Stop at ${(stop.offset * 100).toFixed(0)}% (${stop.color})`}
                    />
                  );
                })}
              </div>
            </div>

            {activeStopId && (() => {
              const activeStop = stops.find((s) => s.id === activeStopId);
              if (!activeStop) return null;
              return (
                <div className="flex items-center justify-between gap-3 bg-[#0d100f] px-2.5 py-1.5 rounded-lg border border-[#2c3532] text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#e6c699]/70">Stop Color:</span>
                    <input
                      type="color"
                      value={activeStop.color}
                      onChange={(e) => {
                        const updated = stops.map((s) =>
                          s.id === activeStop.id ? { ...s, color: e.target.value } : s
                        );
                        handleSliderChange('stops', updated);
                      }}
                      className="w-5 h-5 rounded border border-white/20 bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={activeStop.color}
                      onChange={(e) => {
                        const updated = stops.map((s) =>
                          s.id === activeStop.id ? { ...s, color: e.target.value } : s
                        );
                        handleSliderChange('stops', updated);
                      }}
                      className="w-16 px-1.5 py-0.5 rounded bg-black/40 text-[10px] font-mono border border-white/10"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/50">
                      Offset: {Math.round(activeStop.offset * 100)}%
                    </span>
                    {stops.length > 2 && (
                      <button
                        onClick={() => {
                          const updated = stops.filter((s) => s.id !== activeStop.id);
                          handleSliderChange('stops', updated);
                          setActiveStopId(updated[0]?.id || null);
                        }}
                        className="px-2 py-0.5 rounded bg-red-900/60 hover:bg-red-800 text-red-200 text-[10px] cursor-pointer"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[#2c3532]">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[10px] text-white/60">
                  <span>Gradient Shift</span>
                  <span className="font-mono text-[#5fd3ad]">{gradientShift.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.01}
                  value={gradientShift}
                  onChange={(e) => handleSliderChange('shift', Number(e.target.value))}
                  className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[10px] text-white/60">
                  <span>Gradient Repeat</span>
                  <span className="font-mono text-[#5fd3ad]">{gradientRepeat}x</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={gradientRepeat}
                  onChange={(e) => handleSliderChange('repeat', Number(e.target.value))}
                  className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* 5. SELECTIVE COLOR */}
        {type === 'selective_color' && (() => {
          const channelsConfig = settings.channels || {};
          const currentChSettings = channelsConfig[activeSelChannel] || { cyan: 0, magenta: 0, yellow: 0, black: 0 };
          const method = settings.method || 'relative';

          const updateCh = (key: 'cyan' | 'magenta' | 'yellow' | 'black', val: number) => {
            handleSliderChange('channels', {
              ...channelsConfig,
              [activeSelChannel]: {
                ...currentChSettings,
                [key]: val,
              },
            });
          };

          return (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <div className="flex items-center gap-1 flex-wrap">
                  {(
                    ['reds', 'yellows', 'greens', 'cyans', 'blues', 'magentas', 'whites', 'neutrals', 'blacks', 'custom'] as SelectiveColorChannel[]
                  ).map((ch) => (
                    <button
                      key={ch}
                      onClick={() => setActiveSelChannel(ch)}
                      className={`px-2 py-0.5 rounded text-[10px] capitalize cursor-pointer transition ${
                        activeSelChannel === ch
                          ? 'mayan-btn-jade font-bold'
                          : 'mayan-btn-stone text-white/70'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    onClick={() => handleSliderChange('method', 'relative')}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      method === 'relative' ? 'mayan-btn-jade font-bold' : 'mayan-btn-stone'
                    }`}
                  >
                    Relative
                  </button>
                  <button
                    onClick={() => handleSliderChange('method', 'absolute')}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      method === 'absolute' ? 'mayan-btn-jade font-bold' : 'mayan-btn-stone'
                    }`}
                  >
                    Absolute
                  </button>
                </div>
              </div>

              {activeSelChannel === 'custom' && (
                <div className="flex items-center justify-between gap-2 bg-[#0c100f] px-2.5 py-1.5 rounded-lg border border-[#2c3532]">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#e6c699]">Target Color:</span>
                    <input
                      type="color"
                      value={settings.targetHex || '#ff0000'}
                      onChange={(e) => handleSliderChange('targetHex', e.target.value)}
                      className="w-5 h-5 rounded border border-white/20 bg-transparent cursor-pointer"
                    />
                    <span className="text-[10px] font-mono text-white/70">
                      {settings.targetHex || '#ff0000'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-1 max-w-xs">
                    <span className="text-[10px] text-white/50 shrink-0">
                      Tolerance: {settings.tolerance ?? 25}%
                    </span>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      value={settings.tolerance ?? 25}
                      onChange={(e) => handleSliderChange('tolerance', Number(e.target.value))}
                      className="flex-1 h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                {(['cyan', 'magenta', 'yellow', 'black'] as const).map((clr) => (
                  <div key={clr} className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between text-[10px] text-white/60">
                      <span className="capitalize">{clr}</span>
                      <span className="font-mono text-[#5fd3ad]">
                        {currentChSettings[clr] > 0 ? `+${currentChSettings[clr]}` : currentChSettings[clr]}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      value={currentChSettings[clr] || 0}
                      onChange={(e) => updateCh(clr, Number(e.target.value))}
                      className="w-full h-1.5 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* 6. COLOR LOOKUP / 3D LUT */}
        {type === 'color_lookup' && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-white/60">Cinematic 3D LUT Preset:</span>
              <label className="flex items-center gap-1 px-2 py-0.5 rounded mayan-btn-stone hover:text-white text-[10px] cursor-pointer">
                <Upload size={11} className="text-[#5fd3ad]" />
                <span>Upload .CUBE</span>
                <input type="file" accept=".cube" onChange={handleCubeUpload} className="hidden" />
              </label>
            </div>
            <select
              value={settings.presetId || 'teal_orange'}
              onChange={(e) => handleSliderChange('presetId', e.target.value)}
              className="bg-[#101413] border border-[#2c3532] text-[#e6c699] text-xs rounded-lg px-2.5 py-1.5 cursor-pointer outline-none w-full"
            >
              {CINEMATIC_3D_LUTS.map((lut) => (
                <option key={lut.id} value={lut.id}>
                  {lut.name} — {lut.description}
                </option>
              ))}
            </select>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] text-white/60">
                <span>Strength / Mix</span>
                <span className="font-mono text-[#5fd3ad]">{settings.strength ?? 100}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={settings.strength ?? 100}
                onChange={(e) => handleSliderChange('strength', Number(e.target.value))}
                className="w-full h-1.5 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* 7. PHOTO FILTER */}
        {type === 'photo_filter' && (
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2 items-center">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-white/60">Filter Preset:</span>
                <select
                  value={settings.color || '#ec8a00'}
                  onChange={(e) => handleSliderChange('color', e.target.value)}
                  className="bg-[#101413] border border-[#2c3532] text-[#e6c699] text-xs rounded-lg px-2 py-1 cursor-pointer outline-none"
                >
                  {PHOTO_FILTER_PRESETS.map((pf) => (
                    <option key={pf.name} value={pf.color}>
                      {pf.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 justify-end pt-3">
                <span className="text-[10px] text-white/60">Custom:</span>
                <input
                  type="color"
                  value={settings.color || '#ec8a00'}
                  onChange={(e) => handleSliderChange('color', e.target.value)}
                  className="w-7 h-7 rounded border border-white/20 bg-transparent cursor-pointer"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] text-white/60">
                <span>Density</span>
                <span className="font-mono text-[#5fd3ad]">{settings.density ?? 25}%</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={settings.density ?? 25}
                onChange={(e) => handleSliderChange('density', Number(e.target.value))}
                className="w-full h-1.5 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-[#e6c699] cursor-pointer pt-0.5">
              <input
                type="checkbox"
                checked={settings.preserveLuminosity !== false}
                onChange={(e) => handleSliderChange('preserveLuminosity', e.target.checked)}
                className="accent-[#5fd3ad] rounded cursor-pointer"
              />
              <span>Preserve Luminosity</span>
            </label>
          </div>
        )}

        {/* 8. STYLE FILTERS */}
        {type === 'style_filters' && (
          <div className="flex flex-col gap-2.5">
            <span className="text-[10px] text-white/50">24 Color-Grading Presets (Scroll horizontally):</span>
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 px-0.5 scrollbar-thin">
              {STYLE_FILTERS_24.map((sf) => {
                const isSelected = (settings.filterId || 'clarendon') === sf.id;
                return (
                  <button
                    key={sf.id}
                    onClick={() => handleSliderChange('filterId', sf.id)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl shrink-0 transition cursor-pointer min-w-[70px] ${
                      isSelected
                        ? 'mayan-panel border-2 border-[#5fd3ad] ring-2 ring-[#5fd3ad]/30'
                        : 'mayan-btn-stone hover:border-white/30'
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-full shadow-inner border border-white/20"
                      style={{
                        background:
                          sf.id === 'moon' || sf.id === 'inkwell' || sf.id === 'willow'
                            ? 'linear-gradient(135deg, #222, #888, #fff)'
                            : sf.id === 'tokyo_cyberpunk'
                            ? 'linear-gradient(135deg, #ff0055, #00ffff)'
                            : 'linear-gradient(135deg, #ffaa00, #38bdf8, #f43f5e)',
                      }}
                    />
                    <span className="text-[10px] font-medium text-center truncate max-w-[62px]">
                      {sf.name}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[#2c3532]">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[10px] text-white/60">
                  <span>Intensity</span>
                  <span className="font-mono text-[#5fd3ad]">{settings.intensity ?? 100}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={settings.intensity ?? 100}
                  onChange={(e) => handleSliderChange('intensity', Number(e.target.value))}
                  className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[10px] text-white/60">
                  <span>Vignette</span>
                  <span className="font-mono text-[#5fd3ad]">{settings.vignette ?? 0}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={settings.vignette ?? 0}
                  onChange={(e) => handleSliderChange('vignette', Number(e.target.value))}
                  className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* 9. EXPOSURE */}
        {type === 'exposure' && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] text-white/60">
                <span>Exposure (EV)</span>
                <span className="font-mono text-[#5fd3ad]">
                  {(settings.exposure ?? 0) > 0 ? `+${(settings.exposure ?? 0).toFixed(2)}` : (settings.exposure ?? 0).toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={-5}
                max={5}
                step={0.05}
                value={settings.exposure ?? 0}
                onChange={(e) => handleSliderChange('exposure', Number(e.target.value))}
                className="w-full h-1.5 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] text-white/60">
                <span>Offset</span>
                <span className="font-mono text-[#5fd3ad]">
                  {(settings.offset ?? 0) > 0 ? `+${(settings.offset ?? 0).toFixed(3)}` : (settings.offset ?? 0).toFixed(3)}
                </span>
              </div>
              <input
                type="range"
                min={-0.5}
                max={0.5}
                step={0.005}
                value={settings.offset ?? 0}
                onChange={(e) => handleSliderChange('offset', Number(e.target.value))}
                className="w-full h-1.5 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] text-white/60">
                <span>Gamma Correction</span>
                <span className="font-mono text-[#5fd3ad]">{(settings.gamma ?? 1.0).toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={9.99}
                step={0.05}
                value={settings.gamma ?? 1.0}
                onChange={(e) => handleSliderChange('gamma', Number(e.target.value))}
                className="w-full h-1.5 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* 10. THERMAL EFFECT */}
        {type === 'thermal' && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-white/60">Gradient:</span>
                <select
                  value={settings.gradientType ?? 3}
                  onChange={(e) => handleSliderChange('gradientType', Number(e.target.value))}
                  className="bg-[#101413] border border-[#2c3532] text-[#e6c699] text-[10px] rounded px-2 py-1 cursor-pointer outline-none"
                >
                  {THERMAL_GRADIENT_TYPES.map((tg) => (
                    <option key={tg.id} value={tg.id}>
                      {tg.id}: {tg.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <button
                  onClick={() => handleSliderChange('invert', !settings.invert)}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    settings.invert ? 'mayan-btn-jade font-bold' : 'mayan-btn-stone'
                  }`}
                >
                  Invert: {settings.invert ? 'On' : 'Off'}
                </button>
                <button
                  onClick={() => handleSliderChange('showEdges', !settings.showEdges)}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    settings.showEdges ? 'mayan-btn-jade font-bold' : 'mayan-btn-stone'
                  }`}
                >
                  Show Edges: {settings.showEdges ? 'On' : 'Off'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[10px] text-white/60">
                  <span>Shadows</span>
                  <span className="font-mono text-[#5fd3ad]">{(settings.shadows ?? -0.45).toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.01}
                  value={settings.shadows ?? -0.45}
                  onChange={(e) => handleSliderChange('shadows', Number(e.target.value))}
                  className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[10px] text-white/60">
                  <span>Midtones</span>
                  <span className="font-mono text-[#5fd3ad]">{(settings.midtones ?? -0.11).toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.01}
                  value={settings.midtones ?? -0.11}
                  onChange={(e) => handleSliderChange('midtones', Number(e.target.value))}
                  className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[10px] text-white/60">
                  <span>Highlights</span>
                  <span className="font-mono text-[#5fd3ad]">{(settings.highlights ?? -0.05).toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.01}
                  value={settings.highlights ?? -0.05}
                  onChange={(e) => handleSliderChange('highlights', Number(e.target.value))}
                  className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#2c3532]">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[10px] text-white/60">
                  <span>Shift</span>
                  <span className="font-mono text-[#5fd3ad]">{(settings.gradientShift ?? 0.0).toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={settings.gradientShift ?? 0.0}
                  onChange={(e) => handleSliderChange('gradientShift', Number(e.target.value))}
                  className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[10px] text-white/60">
                  <span>Repeat</span>
                  <span className="font-mono text-[#5fd3ad]">{(settings.gradientRepeat ?? 0.7).toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={settings.gradientRepeat ?? 0.7}
                  onChange={(e) => handleSliderChange('gradientRepeat', Number(e.target.value))}
                  className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[10px] text-white/60">
                  <span>Edge Range</span>
                  <span className="font-mono text-[#5fd3ad]">{(settings.edgeRange ?? 0.5).toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={settings.edgeRange ?? 0.5}
                  onChange={(e) => handleSliderChange('edgeRange', Number(e.target.value))}
                  className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* 11. THRESHOLD */}
        {type === 'threshold' && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] text-white/60">
              <span>Threshold Cutoff</span>
              <span className="font-mono text-white/80">{settings.threshold ?? 128}</span>
            </div>
            <input
              type="range"
              min={1}
              max={254}
              value={settings.threshold ?? 128}
              onChange={(e) => handleSliderChange('threshold', Number(e.target.value))}
              className="w-full h-1.5 bg-white/10 accent-blue-500 rounded-lg cursor-pointer"
            />
          </div>
        )}

        {/* 12. POSTERIZE */}
        {type === 'posterize' && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] text-white/60">
              <span>Color Levels</span>
              <span className="font-mono text-white/80">{settings.levels ?? 6}</span>
            </div>
            <input
              type="range"
              min={2}
              max={32}
              value={settings.levels ?? 6}
              onChange={(e) => handleSliderChange('levels', Number(e.target.value))}
              className="w-full h-1.5 bg-white/10 accent-purple-500 rounded-lg cursor-pointer"
            />
          </div>
        )}

        {/* 13. BLACK AND WHITE / TINT */}
        {type === 'black_and_white' && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/60">Filter Tint:</span>
            <div className="flex items-center gap-1.5">
              {(['neutral', 'sepia', 'cool', 'warm'] as const).map((tint) => (
                <button
                  key={tint}
                  onClick={() => handleSliderChange('tint', tint as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs capitalize transition-colors cursor-pointer ${
                    (settings.tint ?? 'neutral') === tint
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'bg-white/5 hover:bg-white/10 text-white/70'
                  }`}
                >
                  {tint}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 14. INVERT */}
        {type === 'invert' && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] text-white/60">
              <span>Invert Strength</span>
              <span className="font-mono text-white/80">{settings.amount ?? 100}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.amount ?? 100}
              onChange={(e) => handleSliderChange('amount', Number(e.target.value))}
              className="w-full h-1.5 bg-white/10 accent-blue-500 rounded-lg cursor-pointer"
            />
          </div>
        )}

        {/* 15. GRADIENT FILL */}
        {type === 'gradient_fill' && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[#e6c699]/70">Style:</span>
                {(['linear', 'radial'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => handleSliderChange('style', st as any)}
                    className={`px-2.5 py-0.5 rounded text-[11px] capitalize cursor-pointer transition ${
                      (settings.style || 'linear') === st ? 'mayan-btn-jade font-bold' : 'mayan-btn-stone'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSliderChange('reverse', (!settings.reverse) as any)}
                  className={`px-2 py-0.5 rounded text-[11px] cursor-pointer transition ${
                    settings.reverse ? 'mayan-btn-jade' : 'mayan-btn-stone'
                  }`}
                  title="Reverse color gradient order"
                >
                  Reverse ⇄
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 bg-[#0c100f] px-2.5 py-1.5 rounded-lg border border-[#2c3532]">
                <span className="text-[10px] text-[#e6c699]/70">Color 1:</span>
                <input
                  type="color"
                  value={settings.color1 || '#164435'}
                  onChange={(e) => handleSliderChange('color1', e.target.value as any)}
                  className="w-6 h-6 rounded border border-white/20 bg-transparent cursor-pointer"
                />
                <span className="text-[10px] text-[#e6c699]/70 ml-2">Color 2:</span>
                <input
                  type="color"
                  value={settings.color2 || '#5fd3ad'}
                  onChange={(e) => handleSliderChange('color2', e.target.value as any)}
                  className="w-6 h-6 rounded border border-white/20 bg-transparent cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-0.5 justify-center">
                <div className="flex items-center justify-between text-[10px] text-white/60">
                  <span>Angle</span>
                  <span className="font-mono text-[#5fd3ad]">{settings.angle ?? 90}°</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={settings.angle ?? 90}
                  onChange={(e) => handleSliderChange('angle', Number(e.target.value))}
                  className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-center">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[10px] text-white/60">
                  <span>Fill Opacity</span>
                  <span className="font-mono text-[#5fd3ad]">
                    {Math.round((settings.opacity !== undefined ? settings.opacity : 1) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round((settings.opacity !== undefined ? settings.opacity : 1) * 100)}
                  onChange={(e) => handleSliderChange('opacity', Number(e.target.value) / 100)}
                  className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2 justify-end text-xs">
                <span className="text-[10px] text-[#e6c699]/70">Blend:</span>
                <select
                  value={settings.blendMode || 'source-over'}
                  onChange={(e) => handleSliderChange('blendMode', e.target.value as any)}
                  className="bg-[#101413] border border-[#2c3532] text-[#e6c699] text-[10px] rounded px-2 py-1 cursor-pointer outline-none"
                >
                  <option value="source-over">Normal</option>
                  <option value="multiply">Multiply</option>
                  <option value="screen">Screen</option>
                  <option value="overlay">Overlay</option>
                  <option value="soft-light">Soft Light</option>
                  <option value="hard-light">Hard Light</option>
                  <option value="color-dodge">Color Dodge</option>
                  <option value="color-burn">Color Burn</option>
                  <option value="darken">Darken</option>
                  <option value="lighten">Lighten</option>
                  <option value="difference">Difference</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};