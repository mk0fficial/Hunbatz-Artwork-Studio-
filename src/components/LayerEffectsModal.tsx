import React, { useState, useRef, useEffect } from 'react';
import { Layer, LayerEffectsConfig, BlendMode } from '../types/canvas';
import {
  Check,
  X,
  RotateCcw,
  Sliders,
  Layers,
  Sparkles,
  Droplet,
  Eye,
  Sun,
  Shield,
  Activity,
  Box,
  Palette,
  GripHorizontal,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';
import { createDefaultLayerEffects, applyLayerEffects } from '../utils/layerEffectsEngine';
import { fetchLocalTextures } from '../services/localContentService';
import { getAllKritaPatterns, KritaPatternDef, getKritaPatternCanvas } from '../utils/brushEngine';
import {
  MayanCornerBrackets,
  MayanFriezeDivider,
  MayanGlyphWatermark,
} from './MayanDecorations';

interface LayerEffectsModalProps {
  layer: Layer;
  effects: LayerEffectsConfig;
  onChangeEffects: (updated: LayerEffectsConfig) => void;
  onRasterize: () => void;
  onClose: () => void;
}

type EffectTab =
  | 'bevel_emboss'
  | 'stroke'
  | 'inner_shadow'
  | 'inner_glow'
  | 'satin'
  | 'color_overlay'
  | 'gradient_overlay'
  | 'pattern_overlay'
  | 'outer_glow'
  | 'drop_shadow';

const BLEND_MODE_OPTIONS: { label: string; mode: BlendMode }[] = [
  { label: 'Normal', mode: 'source-over' },
  { label: 'Multiply', mode: 'multiply' },
  { label: 'Screen', mode: 'screen' },
  { label: 'Overlay', mode: 'overlay' },
  { label: 'Darken', mode: 'darken' },
  { label: 'Lighten', mode: 'lighten' },
  { label: 'Color Dodge', mode: 'color-dodge' },
  { label: 'Color Burn', mode: 'color-burn' },
  { label: 'Hard Light', mode: 'hard-light' },
  { label: 'Soft Light', mode: 'soft-light' },
  { label: 'Difference', mode: 'difference' },
  { label: 'Exclusion', mode: 'exclusion' },
];

const BlendModeSelect: React.FC<{ value?: BlendMode; onChange: (mode: BlendMode) => void }> = ({
  value = 'source-over',
  onChange,
}) => (
  <div>
    <label className="text-[#b89058] font-mayan font-bold text-[11px] block mb-1">Blend Mode</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as BlendMode)}
      className="w-full mayan-well border border-[#2a302d] rounded-lg p-2 text-[#e6c699] outline-none cursor-pointer text-xs shadow-inner"
    >
      {BLEND_MODE_OPTIONS.map((opt) => (
        <option key={opt.mode} value={opt.mode}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

export const LayerEffectsModal: React.FC<LayerEffectsModalProps> = ({
  layer,
  effects,
  onChangeEffects,
  onRasterize,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<EffectTab>('drop_shadow');

  // Floating Window Dragging & Corner Resizing State
  const [position, setPosition] = useState({ x: 140, y: 55 });
  const [size, setSize] = useState({ width: 780, height: 560 });
  const dragRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; initW: number; initH: number } | null>(null);

  // Live Corner Mini Preview with Zoom State
  const [previewZoom, setPreviewZoom] = useState(1);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Hunbatz local content textures for Pattern Overlay
  const [localTextures, setLocalTextures] = useState<KritaPatternDef[]>([]);

  useEffect(() => {
    fetchLocalTextures().then(() => {
      setLocalTextures(getAllKritaPatterns().filter((p) => p.id !== 'none'));
    });
  }, []);

  // Window Drag Handlers
  const handleDragDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, input, label')) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: position.x,
      initY: position.y,
    };
  };

  const handleDragMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const maxX = Math.max(10, window.innerWidth - 120);
    const maxY = Math.max(10, window.innerHeight - 80);
    setPosition({
      x: Math.max(10, Math.min(maxX, dragRef.current.initX + dx)),
      y: Math.max(10, Math.min(maxY, dragRef.current.initY + dy)),
    });
  };

  const handleDragUp = () => {
    dragRef.current = null;
  };

  // Corner Resize Handlers
  const handleResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initW: size.width,
      initH: size.height,
    };
  };

  const handleResizeMove = (e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    const dx = e.clientX - resizeRef.current.startX;
    const dy = e.clientY - resizeRef.current.startY;
    setSize({
      width: Math.max(500, Math.min(window.innerWidth - position.x - 20, resizeRef.current.initW + dx)),
      height: Math.max(380, Math.min(window.innerHeight - position.y - 20, resizeRef.current.initH + dy)),
    });
  };

  const handleResizeUp = () => {
    resizeRef.current = null;
  };

  // Render Live Corner Mini Preview
  useEffect(() => {
    const preview = previewCanvasRef.current;
    if (!preview || !layer.canvas) return;
    const pCtx = preview.getContext('2d');
    if (!pCtx) return;

    pCtx.clearRect(0, 0, preview.width, preview.height);

    const rendered = applyLayerEffects(layer.canvas, effects);
    const baseScale = Math.min(preview.width / layer.canvas.width, preview.height / layer.canvas.height) * 0.9;
    const finalScale = baseScale * previewZoom;

    const drawW = layer.canvas.width * finalScale;
    const drawH = layer.canvas.height * finalScale;
    const drawX = (preview.width - drawW) / 2;
    const drawY = (preview.height - drawH) / 2;

    pCtx.save();
    pCtx.drawImage(rendered, drawX, drawY, drawW, drawH);
    pCtx.restore();
  }, [layer.canvas, effects, previewZoom]);

  const updateBevel = (up: Partial<LayerEffectsConfig['bevelEmboss']>) => {
    onChangeEffects({
      ...effects,
      bevelEmboss: { ...effects.bevelEmboss, ...up },
    });
  };

  const updateStroke = (up: Partial<LayerEffectsConfig['stroke']>) => {
    onChangeEffects({
      ...effects,
      stroke: { ...effects.stroke, ...up },
    });
  };

  const updateInnerShadow = (up: Partial<LayerEffectsConfig['innerShadow']>) => {
    onChangeEffects({
      ...effects,
      innerShadow: { ...effects.innerShadow, ...up },
    });
  };

  const updateInnerGlow = (up: Partial<LayerEffectsConfig['innerGlow']>) => {
    onChangeEffects({
      ...effects,
      innerGlow: { ...effects.innerGlow, ...up },
    });
  };

  const updateSatin = (up: Partial<LayerEffectsConfig['satin']>) => {
    onChangeEffects({
      ...effects,
      satin: { ...effects.satin, ...up },
    });
  };

  const updateColorOverlay = (up: Partial<LayerEffectsConfig['colorOverlay']>) => {
    onChangeEffects({
      ...effects,
      colorOverlay: { ...effects.colorOverlay, ...up },
    });
  };

  const updateGradientOverlay = (up: Partial<LayerEffectsConfig['gradientOverlay']>) => {
    onChangeEffects({
      ...effects,
      gradientOverlay: { ...effects.gradientOverlay, ...up },
    });
  };

  const updatePatternOverlay = (up: Partial<LayerEffectsConfig['patternOverlay']>) => {
    onChangeEffects({
      ...effects,
      patternOverlay: { ...effects.patternOverlay, ...up },
    });
  };

  const updateOuterGlow = (up: Partial<LayerEffectsConfig['outerGlow']>) => {
    onChangeEffects({
      ...effects,
      outerGlow: { ...effects.outerGlow, ...up },
    });
  };

  const updateDropShadow = (up: Partial<LayerEffectsConfig['dropShadow']>) => {
    onChangeEffects({
      ...effects,
      dropShadow: { ...effects.dropShadow, ...up },
    });
  };

  const effectTabs: { id: EffectTab; label: string; enabled: boolean; toggle: (e: boolean) => void }[] = [
    {
      id: 'bevel_emboss',
      label: 'Bevel & Emboss',
      enabled: effects.bevelEmboss.enabled,
      toggle: (val) => updateBevel({ enabled: val }),
    },
    {
      id: 'stroke',
      label: 'Stroke',
      enabled: effects.stroke.enabled,
      toggle: (val) => updateStroke({ enabled: val }),
    },
    {
      id: 'inner_shadow',
      label: 'Inner Shadow',
      enabled: effects.innerShadow.enabled,
      toggle: (val) => updateInnerShadow({ enabled: val }),
    },
    {
      id: 'inner_glow',
      label: 'Inner Glow',
      enabled: effects.innerGlow.enabled,
      toggle: (val) => updateInnerGlow({ enabled: val }),
    },
    {
      id: 'satin',
      label: 'Satin',
      enabled: effects.satin.enabled,
      toggle: (val) => updateSatin({ enabled: val }),
    },
    {
      id: 'color_overlay',
      label: 'Color Overlay',
      enabled: effects.colorOverlay.enabled,
      toggle: (val) => updateColorOverlay({ enabled: val }),
    },
    {
      id: 'gradient_overlay',
      label: 'Gradient Overlay',
      enabled: effects.gradientOverlay.enabled,
      toggle: (val) => updateGradientOverlay({ enabled: val }),
    },
    {
      id: 'pattern_overlay',
      label: 'Pattern Overlay',
      enabled: effects.patternOverlay.enabled,
      toggle: (val) => updatePatternOverlay({ enabled: val }),
    },
    {
      id: 'outer_glow',
      label: 'Outer Glow',
      enabled: effects.outerGlow.enabled,
      toggle: (val) => updateOuterGlow({ enabled: val }),
    },
    {
      id: 'drop_shadow',
      label: 'Drop Shadow',
      enabled: effects.dropShadow.enabled,
      toggle: (val) => updateDropShadow({ enabled: val }),
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        zIndex: 55,
      }}
      className="mayan-panel border-2 border-[#2c3532] shadow-[0_20px_60px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden text-[#e6c699] select-none relative"
      onClick={(e) => e.stopPropagation()}
    >
      <MayanCornerBrackets size={18} color="#b89058" />

      {/* Top Header - Draggable */}
      <header
        onPointerDown={handleDragDown}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragUp}
        className="flex items-center justify-between px-5 py-3 border-b-2 border-[#b89058]/50 bg-gradient-to-r from-[#141817] via-[#1a201e] to-[#141817] cursor-move select-none"
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <GripHorizontal size={16} className="text-[#b89058]" />
          <span className="font-mayan font-bold text-[#e6c699] text-sm tracking-wider">LAYER STYLES (FX)</span>
          <span className="text-[#b89058] text-xs">·</span>
          <span className="text-[#5fd3ad] font-mono text-xs font-semibold">{layer.name}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onChangeEffects(createDefaultLayerEffects())}
            className="px-3 py-1.5 rounded-lg text-xs mayan-btn-stone hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Reset all effects to defaults"
          >
            <RotateCcw size={12} className="text-[#b89058]" /> Reset
          </button>
          <button
            onClick={onRasterize}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold mayan-btn-stone text-[#e6c699] hover:text-[#fff6e5] transition-colors cursor-pointer"
            title="Bake styles permanently into layer pixels"
          >
            Rasterize Style
          </button>
          <button
            onClick={onClose}
            className="mayan-btn-cta flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold shadow-lg cursor-pointer transition-transform active:scale-95"
          >
            <Check size={14} /> Done
          </button>
        </div>
      </header>

      {/* Main Content: Left Nav List + Right Properties */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Column: Styles Checklist & Mini Preview */}
        <div className="w-60 border-r border-[#2c3532] mayan-well p-2.5 flex flex-col gap-1 overflow-y-auto shrink-0 justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-mayan font-bold uppercase tracking-wider text-[#b89058] px-2 py-1">
              Styles
            </span>
            {effectTabs.map((item) => {
              const isSelected = activeTab === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                  }}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                    isSelected
                      ? 'mayan-btn-jade text-[#f2fbf7] font-semibold border border-[#5fd3ad]'
                      : 'text-[#9e9484] hover:text-[#e6c699] hover:bg-white/5'
                  }`}
                >
                  <label
                    className="flex items-center gap-2.5 cursor-pointer w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTab(item.id);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(e) => {
                        item.toggle(e.target.checked);
                        setActiveTab(item.id);
                      }}
                      className="accent-[#2c7a60] w-3.5 h-3.5 rounded cursor-pointer shrink-0"
                    />
                    <span
                      className="flex-1 select-none font-medium"
                      onClick={() => {
                        if (!item.enabled) item.toggle(true);
                        setActiveTab(item.id);
                      }}
                    >
                      {item.label}
                    </span>
                  </label>
                </div>
              );
            })}
          </div>

          {/* Live Corner Mini Preview with Zoom */}
          <div className="mt-auto pt-2 border-t border-[#2c3532] flex flex-col gap-1.5 shrink-0">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-mayan font-bold uppercase tracking-wider text-[#b89058]">
                Live Preview
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPreviewZoom((z) => Math.max(0.25, Number((z - 0.25).toFixed(2))))}
                  title="Zoom Out"
                  className="p-1 rounded mayan-btn-stone text-[#e6c699] cursor-pointer"
                >
                  <ZoomOut size={12} />
                </button>
                <button
                  onClick={() => setPreviewZoom(1)}
                  title="Reset Zoom (100%)"
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded mayan-well text-[#5fd3ad] cursor-pointer"
                >
                  {Math.round(previewZoom * 100)}%
                </button>
                <button
                  onClick={() => setPreviewZoom((z) => Math.min(4, Number((z + 0.25).toFixed(2))))}
                  title="Zoom In"
                  className="p-1 rounded mayan-btn-stone text-[#e6c699] cursor-pointer"
                >
                  <ZoomIn size={12} />
                </button>
              </div>
            </div>
            <div className="w-full h-24 mayan-well rounded-xl border border-[#b89058]/40 overflow-hidden relative checkerboard-pattern flex items-center justify-center">
              <MayanGlyphWatermark size={60} opacity={0.15} className="top-1 left-1" />
              <canvas
                ref={previewCanvasRef}
                width={220}
                height={100}
                className="w-full h-full object-contain relative z-10"
              />
            </div>
          </div>
        </div>

          {/* Right Column: Active Effect Settings */}
          <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4 bg-[#181a24]/50">
            {/* 1. BEVEL & EMBOSS */}
            {activeTab === 'bevel_emboss' && (
              <div className="flex flex-col gap-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Bevel & Emboss</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={effects.bevelEmboss.enabled}
                      onChange={(e) => updateBevel({ enabled: e.target.checked })}
                      className="accent-blue-500 rounded cursor-pointer"
                    />
                    <span className="text-white/70">Enable</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <BlendModeSelect
                    value={effects.bevelEmboss.blendMode}
                    onChange={(bm) => updateBevel({ blendMode: bm })}
                  />
                  <div>
                    <label className="text-white/50 block mb-1">Style</label>
                    <select
                      value={effects.bevelEmboss.style}
                      onChange={(e) => updateBevel({ style: e.target.value as any })}
                      className="w-full bg-[#121418] border border-white/10 rounded-lg p-2 text-white outline-none cursor-pointer"
                    >
                      <option value="inner_bevel">Inner Bevel</option>
                      <option value="outer_bevel">Outer Bevel</option>
                      <option value="emboss">Emboss</option>
                      <option value="pillow_emboss">Pillow Emboss</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/50 block mb-1">Angle ({effects.bevelEmboss.angle}°)</label>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      value={effects.bevelEmboss.angle}
                      onChange={(e) => updateBevel({ angle: Number(e.target.value) })}
                      className="w-full accent-[#5fd3ad] cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-white/50 block mb-1">Depth ({effects.bevelEmboss.depth}%)</label>
                    <input
                      type="range"
                      min={10}
                      max={500}
                      value={effects.bevelEmboss.depth}
                      onChange={(e) => updateBevel({ depth: Number(e.target.value) })}
                      className="w-full accent-[#5fd3ad] cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/50 block mb-1">Size ({effects.bevelEmboss.size}px)</label>
                    <input
                      type="range"
                      min={1}
                      max={40}
                      value={effects.bevelEmboss.size}
                      onChange={(e) => updateBevel({ size: Number(e.target.value) })}
                      className="w-full accent-[#5fd3ad] cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-[#121418] rounded-xl border border-white/5">
                    <span className="text-white/70">Highlight</span>
                    <input
                      type="color"
                      value={effects.bevelEmboss.highlightColor}
                      onChange={(e) => updateBevel({ highlightColor: e.target.value })}
                      className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-2.5 bg-[#121418] rounded-xl border border-white/5">
                    <span className="text-white/70">Shadow</span>
                    <input
                      type="color"
                      value={effects.bevelEmboss.shadowColor}
                      onChange={(e) => updateBevel({ shadowColor: e.target.value })}
                      className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 2. STROKE */}
            {activeTab === 'stroke' && (
              <div className="flex flex-col gap-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Stroke</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={effects.stroke.enabled}
                      onChange={(e) => updateStroke({ enabled: e.target.checked })}
                      className="accent-[#5fd3ad] rounded cursor-pointer"
                    />
                    <span className="text-white/70">Enable</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <BlendModeSelect
                    value={effects.stroke.blendMode}
                    onChange={(bm) => updateStroke({ blendMode: bm })}
                  />
                  <div>
                    <label className="text-white/50 block mb-1">Position</label>
                    <select
                      value={effects.stroke.position}
                      onChange={(e) => updateStroke({ position: e.target.value as any })}
                      className="w-full bg-[#121418] border border-white/10 rounded-lg p-2 text-white outline-none cursor-pointer"
                    >
                      <option value="outside">Outside</option>
                      <option value="inside">Inside</option>
                      <option value="center">Center</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-white/50 block mb-1">Size ({effects.stroke.size}px)</label>
                  <input
                    type="range"
                    min={1}
                    max={40}
                    value={effects.stroke.size}
                    onChange={(e) => updateStroke({ size: Number(e.target.value) })}
                    className="w-full accent-[#5fd3ad] cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-2.5 bg-[#121418] rounded-xl border border-white/5">
                    <span className="text-white/70">Color</span>
                    <input
                      type="color"
                      value={effects.stroke.color}
                      onChange={(e) => updateStroke({ color: e.target.value })}
                      className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-white/50 block mb-1">Opacity ({Math.round(effects.stroke.opacity * 100)}%)</label>
                    <input
                      type="range"
                      min={0.05}
                      max={1}
                      step={0.05}
                      value={effects.stroke.opacity}
                      onChange={(e) => updateStroke({ opacity: Number(e.target.value) })}
                      className="w-full accent-[#5fd3ad] cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 3. INNER SHADOW */}
            {activeTab === 'inner_shadow' && (
              <div className="flex flex-col gap-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Inner Shadow</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={effects.innerShadow.enabled}
                      onChange={(e) => updateInnerShadow({ enabled: e.target.checked })}
                      className="accent-[#5fd3ad] rounded cursor-pointer"
                    />
                    <span className="text-white/70">Enable</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <BlendModeSelect
                    value={effects.innerShadow.blendMode}
                    onChange={(bm) => updateInnerShadow({ blendMode: bm })}
                  />
                  <div className="flex items-center justify-between p-2.5 bg-[#121418] rounded-xl border border-white/5">
                    <span className="text-white/70">Shadow Color</span>
                    <input
                      type="color"
                      value={effects.innerShadow.color}
                      onChange={(e) => updateInnerShadow({ color: e.target.value })}
                      className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/50 block mb-1">Opacity ({Math.round(effects.innerShadow.opacity * 100)}%)</label>
                    <input
                      type="range"
                      min={0.05}
                      max={1}
                      step={0.05}
                      value={effects.innerShadow.opacity}
                      onChange={(e) => updateInnerShadow({ opacity: Number(e.target.value) })}
                      className="w-full accent-[#5fd3ad] cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-white/50 block mb-1">Angle ({effects.innerShadow.angle}°)</label>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      value={effects.innerShadow.angle}
                      onChange={(e) => updateInnerShadow({ angle: Number(e.target.value) })}
                      className="w-full accent-[#5fd3ad] cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/50 block mb-1">Distance ({effects.innerShadow.distance}px)</label>
                    <input
                      type="range"
                      min={0}
                      max={50}
                      value={effects.innerShadow.distance}
                      onChange={(e) => updateInnerShadow({ distance: Number(e.target.value) })}
                      className="w-full accent-[#5fd3ad] cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-white/50 block mb-1">Size / Blur ({effects.innerShadow.size}px)</label>
                    <input
                      type="range"
                      min={0}
                      max={60}
                      value={effects.innerShadow.size}
                      onChange={(e) => updateInnerShadow({ size: Number(e.target.value) })}
                      className="w-full accent-[#5fd3ad] cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 4. INNER GLOW */}
            {activeTab === 'inner_glow' && (
              <div className="flex flex-col gap-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Inner Glow</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={effects.innerGlow.enabled}
                      onChange={(e) => updateInnerGlow({ enabled: e.target.checked })}
                      className="accent-[#5fd3ad] rounded cursor-pointer"
                    />
                    <span className="text-white/70">Enable</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <BlendModeSelect
                    value={effects.innerGlow.blendMode}
                    onChange={(bm) => updateInnerGlow({ blendMode: bm })}
                  />
                  <div className="flex items-center justify-between p-2.5 bg-[#121418] rounded-xl border border-white/5">
                    <span className="text-white/70">Glow Color</span>
                    <input
                      type="color"
                      value={effects.innerGlow.color}
                      onChange={(e) => updateInnerGlow({ color: e.target.value })}
                      className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/50 block mb-1">Opacity ({Math.round(effects.innerGlow.opacity * 100)}%)</label>
                    <input
                      type="range"
                      min={0.05}
                      max={1}
                      step={0.05}
                      value={effects.innerGlow.opacity}
                      onChange={(e) => updateInnerGlow({ opacity: Number(e.target.value) })}
                      className="w-full accent-[#5fd3ad] cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-white/50 block mb-1">Size / Blur ({effects.innerGlow.size}px)</label>
                    <input
                      type="range"
                      min={1}
                      max={60}
                      value={effects.innerGlow.size}
                      onChange={(e) => updateInnerGlow({ size: Number(e.target.value) })}
                      className="w-full accent-[#5fd3ad] cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 5. SATIN */}
            {activeTab === 'satin' && (
              <div className="flex flex-col gap-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Satin</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={effects.satin.enabled}
                      onChange={(e) => updateSatin({ enabled: e.target.checked })}
                      className="accent-[#5fd3ad] rounded cursor-pointer"
                    />
                    <span className="text-white/70">Enable</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <BlendModeSelect
                    value={effects.satin.blendMode}
                    onChange={(bm) => updateSatin({ blendMode: bm })}
                  />
                  <div className="flex items-center justify-between p-2.5 bg-[#121418] rounded-xl border border-white/5">
                    <span className="text-white/70">Satin Color</span>
                    <input
                      type="color"
                      value={effects.satin.color}
                      onChange={(e) => updateSatin({ color: e.target.value })}
                      className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/50 block mb-1">Distance ({effects.satin.distance}px)</label>
                    <input
                      type="range"
                      min={0}
                      max={50}
                      value={effects.satin.distance}
                      onChange={(e) => updateSatin({ distance: Number(e.target.value) })}
                      className="w-full accent-[#5fd3ad] cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-white/50 block mb-1">Angle ({effects.satin.angle}°)</label>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      value={effects.satin.angle}
                      onChange={(e) => updateSatin({ angle: Number(e.target.value) })}
                      className="w-full accent-[#5fd3ad] cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 6. COLOR OVERLAY */}
            {activeTab === 'color_overlay' && (
              <div className="flex flex-col gap-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Color Overlay</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={effects.colorOverlay.enabled}
                      onChange={(e) => updateColorOverlay({ enabled: e.target.checked })}
                      className="accent-[#5fd3ad] rounded cursor-pointer"
                    />
                    <span className="text-white/70">Enable</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <BlendModeSelect
                    value={effects.colorOverlay.blendMode}
                    onChange={(bm) => updateColorOverlay({ blendMode: bm })}
                  />
                  <div className="flex items-center justify-between p-2.5 bg-[#121418] rounded-xl border border-white/5">
                    <span className="text-white/70">Overlay Color</span>
                    <input
                      type="color"
                      value={effects.colorOverlay.color}
                      onChange={(e) => updateColorOverlay({ color: e.target.value })}
                      className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-white/50 block mb-1">Opacity ({Math.round(effects.colorOverlay.opacity * 100)}%)</label>
                  <input
                    type="range"
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={effects.colorOverlay.opacity}
                    onChange={(e) => updateColorOverlay({ opacity: Number(e.target.value) })}
                    className="w-full accent-[#5fd3ad] cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* 7. GRADIENT OVERLAY */}
            {activeTab === 'gradient_overlay' && (
              <div className="flex flex-col gap-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Gradient Overlay</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={effects.gradientOverlay.enabled}
                      onChange={(e) => updateGradientOverlay({ enabled: e.target.checked })}
                      className="accent-[#5fd3ad] rounded cursor-pointer"
                    />
                    <span className="text-white/70">Enable</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <BlendModeSelect
                    value={effects.gradientOverlay.blendMode}
                    onChange={(bm) => updateGradientOverlay({ blendMode: bm })}
                  />
                  <div className="flex items-center justify-between p-2.5 bg-[#121418] rounded-xl border border-white/5">
                    <span className="text-white/70">Reverse</span>
                    <input
                      type="checkbox"
                      checked={effects.gradientOverlay.reverse}
                      onChange={(e) => updateGradientOverlay({ reverse: e.target.checked })}
                      className="accent-[#5fd3ad] rounded cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-2.5 bg-[#121418] rounded-xl border border-white/5">
                    <span className="text-white/70">Color 1</span>
                    <input
                      type="color"
                      value={effects.gradientOverlay.color1}
                      onChange={(e) => updateGradientOverlay({ color1: e.target.value })}
                      className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
                    />
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-[#121418] rounded-xl border border-white/5">
                    <span className="text-white/70">Color 2</span>
                    <input
                      type="color"
                      value={effects.gradientOverlay.color2}
                      onChange={(e) => updateGradientOverlay({ color2: e.target.value })}
                      className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/50 block mb-1">Angle ({effects.gradientOverlay.angle}°)</label>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      value={effects.gradientOverlay.angle}
                      onChange={(e) => updateGradientOverlay({ angle: Number(e.target.value) })}
                      className="w-full accent-[#5fd3ad] cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-white/50 block mb-1">Opacity ({Math.round(effects.gradientOverlay.opacity * 100)}%)</label>
                    <input
                      type="range"
                      min={0.05}
                      max={1}
                      step={0.05}
                      value={effects.gradientOverlay.opacity}
                      onChange={(e) => updateGradientOverlay({ opacity: Number(e.target.value) })}
                      className="w-full accent-[#5fd3ad] cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 8. PATTERN OVERLAY */}
            {activeTab === 'pattern_overlay' && (
              <div className="flex flex-col gap-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Pattern Overlay</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={effects.patternOverlay.enabled}
                      onChange={(e) => updatePatternOverlay({ enabled: e.target.checked })}
                      className="accent-[#5fd3ad] rounded cursor-pointer"
                    />
                    <span className="text-white/70">Enable</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <BlendModeSelect
                    value={effects.patternOverlay.blendMode}
                    onChange={(bm) => updatePatternOverlay({ blendMode: bm })}
                  />
                  <div>
                    <label className="text-white/50 block mb-1">Pattern</label>
                    <select
                      value={effects.patternOverlay.pattern}
                      onChange={(e) => updatePatternOverlay({ pattern: e.target.value as any })}
                      className="w-full bg-[#121418] border border-white/10 rounded-lg p-2 text-white outline-none cursor-pointer"
                    >
                      <optgroup label="Local Content Textures">
                        {localTextures.map((tex) => (
                          <option key={tex.id} value={tex.id}>
                            {tex.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Geometric Patterns">
                        <option value="dots">Halftone Dots</option>
                        <option value="grid">Square Grid</option>
                        <option value="checker">Checkerboard</option>
                        <option value="stripes">Stripes Texture</option>
                        <option value="diagonal">Diagonal Lines</option>
                        <option value="hexagons">Hexagons</option>
                        <option value="carbon">Carbon Fiber</option>
                        <option value="moroccan">Moroccan Tile</option>
                        <option value="noise">Film Grain Noise</option>
                      </optgroup>
                    </select>
                  </div>
                </div>

                {/* Swatch Grid of Local Content Textures */}
                {localTextures.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] text-[#b89058] font-mayan font-bold">
                      Hunbatz Local Content Swatches ({localTextures.length})
                    </span>
                    <div className="grid grid-cols-6 gap-2 max-h-36 overflow-y-auto p-2 rounded-xl bg-[#0e1210] border border-[#2a302d]">
                      {localTextures.map((tex) => {
                        const isCur = effects.patternOverlay.pattern === tex.id;
                        const preview = tex.customUrl || tex.url || '';
                        return (
                          <button
                            key={tex.id}
                            type="button"
                            onClick={() => updatePatternOverlay({ pattern: tex.id as any })}
                            title={tex.name}
                            className={`group relative aspect-square rounded-lg border overflow-hidden p-0.5 cursor-pointer transition ${
                              isCur
                                ? 'border-2 border-[#5fd3ad] bg-[#164435]/60 shadow-[0_0_8px_rgba(95,211,173,0.4)]'
                                : 'border-[#2c3532] bg-[#141a18] hover:border-[#b89058]'
                            }`}
                          >
                            {preview ? (
                              <img src={preview} alt={tex.name} className="w-full h-full object-cover rounded" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[9px] text-[#9e9484] text-center p-0.5">
                                {tex.name.slice(0, 10)}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/50 block mb-1">Scale ({effects.patternOverlay.scale || 100}%)</label>
                    <input
                      type="range"
                      min={10}
                      max={400}
                      step={5}
                      value={effects.patternOverlay.scale || 100}
                      onChange={(e) => updatePatternOverlay({ scale: Number(e.target.value) })}
                      className="w-full accent-[#5fd3ad] cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-white/50 block mb-1">Opacity ({Math.round(effects.patternOverlay.opacity * 100)}%)</label>
                    <input
                      type="range"
                      min={0.05}
                      max={1}
                      step={0.05}
                      value={effects.patternOverlay.opacity}
                      onChange={(e) => updatePatternOverlay({ opacity: Number(e.target.value) })}
                      className="w-full accent-[#5fd3ad] cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 9. OUTER GLOW */}
            {activeTab === 'outer_glow' && (
              <div className="flex flex-col gap-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Outer Glow</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={effects.outerGlow.enabled}
                      onChange={(e) => updateOuterGlow({ enabled: e.target.checked })}
                      className="accent-[#5fd3ad] rounded cursor-pointer"
                    />
                    <span className="text-white/70">Enable</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <BlendModeSelect
                    value={effects.outerGlow.blendMode}
                    onChange={(bm) => updateOuterGlow({ blendMode: bm })}
                  />
                  <div className="flex items-center justify-between p-2.5 bg-[#121418] rounded-xl border border-white/5">
                    <span className="text-white/70">Glow Color</span>
                    <input
                      type="color"
                      value={effects.outerGlow.color}
                      onChange={(e) => updateOuterGlow({ color: e.target.value })}
                      className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/50 block mb-1">Opacity ({Math.round(effects.outerGlow.opacity * 100)}%)</label>
                    <input
                      type="range"
                      min={0.05}
                      max={1}
                      step={0.05}
                      value={effects.outerGlow.opacity}
                      onChange={(e) => updateOuterGlow({ opacity: Number(e.target.value) })}
                      className="w-full accent-[#5fd3ad] cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-white/50 block mb-1">Size ({effects.outerGlow.size}px)</label>
                    <input
                      type="range"
                      min={2}
                      max={80}
                      value={effects.outerGlow.size}
                      onChange={(e) => updateOuterGlow({ size: Number(e.target.value) })}
                      className="w-full accent-[#5fd3ad] cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 10. DROP SHADOW */}
            {activeTab === 'drop_shadow' && (
              <div className="flex flex-col gap-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Drop Shadow</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={effects.dropShadow.enabled}
                      onChange={(e) => updateDropShadow({ enabled: e.target.checked })}
                      className="accent-[#5fd3ad] rounded cursor-pointer"
                    />
                    <span className="text-white/70">Enable</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <BlendModeSelect
                    value={effects.dropShadow.blendMode}
                    onChange={(bm) => updateDropShadow({ blendMode: bm })}
                  />
                  <div className="flex items-center justify-between p-2.5 bg-[#121418] rounded-xl border border-white/5">
                    <span className="text-white/70">Shadow Color</span>
                    <input
                      type="color"
                      value={effects.dropShadow.color}
                      onChange={(e) => updateDropShadow({ color: e.target.value })}
                      className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/50 block mb-1">Opacity ({Math.round(effects.dropShadow.opacity * 100)}%)</label>
                    <input
                      type="range"
                      min={0.05}
                      max={1}
                      step={0.05}
                      value={effects.dropShadow.opacity}
                      onChange={(e) => updateDropShadow({ opacity: Number(e.target.value) })}
                      className="w-full accent-[#5fd3ad] cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-white/50 block mb-1">Angle ({effects.dropShadow.angle}°)</label>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      value={effects.dropShadow.angle}
                      onChange={(e) => updateDropShadow({ angle: Number(e.target.value) })}
                      className="w-full accent-[#5fd3ad] cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/50 block mb-1">Distance ({effects.dropShadow.distance}px)</label>
                    <input
                      type="range"
                      min={0}
                      max={60}
                      value={effects.dropShadow.distance}
                      onChange={(e) => updateDropShadow({ distance: Number(e.target.value) })}
                      className="w-full accent-[#5fd3ad] cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-white/50 block mb-1">Size / Blur ({effects.dropShadow.size}px)</label>
                    <input
                      type="range"
                      min={0}
                      max={80}
                      value={effects.dropShadow.size}
                      onChange={(e) => updateDropShadow({ size: Number(e.target.value) })}
                      className="w-full accent-[#5fd3ad] cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom-right Corner Resize Handle */}
        <div
          onPointerDown={handleResizeDown}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
          className="absolute bottom-1 right-1 w-5 h-5 cursor-nwse-resize flex items-center justify-center text-white/30 hover:text-blue-400 transition-colors z-20 select-none"
          title="Drag to resize window"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" className="stroke-current">
            <line x1="8" y1="2" x2="2" y2="8" strokeWidth="1.5" />
            <line x1="9" y1="5" x2="5" y2="9" strokeWidth="1.5" />
            <line x1="9" y1="8" x2="8" y2="9" strokeWidth="1.5" />
          </svg>
        </div>
      </div>
  );
};
