import React from 'react';
import { ShapeType, VectorShapeConfig, VignetteLayout } from '../types/shapes';
import {
  Minus,
  Square,
  Circle,
  Triangle,
  Star,
  Grid,
  MessageSquare,
  Cloud,
  Zap,
  Columns,
  Spline,
  Sparkles,
  X,
  Plus,
  Trash2,
  Brush as BrushIcon,
  Target,
  Sliders,
  GripHorizontal,
} from 'lucide-react';
import { MayanCornerBrackets, MayanFriezeDivider } from './MayanDecorations';

interface ShapeToolbarProps {
  config: VectorShapeConfig;
  onChangeConfig: (updates: Partial<VectorShapeConfig>) => void;
  onRasterize: () => void;
  onClose: () => void;
  onAddPathPoint?: () => void;
  onResetPathPoints?: () => void;
}

export const ShapeToolbar: React.FC<ShapeToolbarProps> = ({
  config,
  onChangeConfig,
  onRasterize,
  onClose,
  onAddPathPoint,
  onResetPathPoints,
}) => {
  const [showRadialPanel, setShowRadialPanel] = React.useState(false);

  // Draggable toolbar state - resets to bottom-center anchor every time opened
  const [positionOffset, setPositionOffset] = React.useState({ x: 0, y: 0 });
  const dragRef = React.useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);

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

  const shapeOptions: { type: ShapeType; label: string; icon: React.ReactNode; category: 'basic' | 'comic' | 'path' }[] = [
    { type: 'brush_path', label: 'Brush Path', icon: <Spline size={15} />, category: 'path' },
    { type: 'line', label: 'Line', icon: <Minus size={15} />, category: 'basic' },
    { type: 'rectangle', label: 'Rectangle', icon: <Square size={15} />, category: 'basic' },
    { type: 'square', label: 'Square', icon: <Square size={15} className="p-0.5" />, category: 'basic' },
    { type: 'circle', label: 'Circle', icon: <Circle size={15} />, category: 'basic' },
    { type: 'triangle', label: 'Triangle', icon: <Triangle size={15} />, category: 'basic' },
    { type: 'star', label: 'Star', icon: <Star size={15} />, category: 'basic' },
    { type: 'grid', label: 'Grid', icon: <Grid size={15} />, category: 'basic' },
    { type: 'speech_bubble', label: 'Speech Bubble', icon: <MessageSquare size={15} />, category: 'comic' },
    { type: 'thought_bubble', label: 'Thought Bubble', icon: <Cloud size={15} />, category: 'comic' },
    { type: 'spiky_bubble', label: 'Spiky Bubble', icon: <Zap size={15} />, category: 'comic' },
    { type: 'comic_vignette', label: 'Comic Vignette', icon: <Columns size={15} />, category: 'comic' },
  ];

  return (
    <div
      data-interactive="true"
      data-floating-ui="true"
      style={{
        transform: `translate(calc(-50% + ${positionOffset.x}px), ${positionOffset.y}px)`,
      }}
      className="fixed bottom-6 left-1/2 z-40 max-w-4xl w-[94vw] mayan-panel p-3 text-[#e6c699] flex flex-col gap-2.5 select-none animate-in slide-in-from-bottom-3 duration-150 shadow-[0_16px_50px_rgba(0,0,0,0.95)]"
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
        title="Drag handle: Click and move to reposition Shape toolbar anywhere on canvas"
      >
        <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#18201d] border border-[#2c3532]">
          <GripHorizontal size={12} />
          <span className="text-[9px] font-mayan font-bold uppercase tracking-wider text-[#b89058]">Shape & Vector Controls</span>
        </div>
      </div>

      {/* Top Row: Shape Categories & Shape Selector */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
        <div className="flex items-center gap-1 mayan-well p-1 rounded-xl border border-[#2a302d]">
          {shapeOptions.map((opt) => {
            const isSelected = config.type === opt.type;
            return (
              <button
                key={opt.type}
                onClick={() => {
                  onChangeConfig({ type: opt.type });
                }}
                title={opt.label}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'mayan-btn-jade font-semibold shadow-sm text-white'
                    : 'mayan-btn-stone text-[#9e9484] hover:text-[#e6c699]'
                }`}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={onClose}
          title="Exit Vector Shapes"
          className="p-1.5 rounded-lg mayan-btn-stone text-[#9e9484] hover:text-[#e6c699] transition-colors cursor-pointer shrink-0"
        >
          <X size={16} />
        </button>
      </div>

      <MayanFriezeDivider className="my-0.5" />

      {/* Middle Row: Uniform Stroke Controls + Numeric Readout Slider + Color + Fill */}
      <div className="flex flex-wrap items-center justify-between gap-3 mayan-well px-3.5 py-2 rounded-xl border border-[#2a302d] text-xs">
        {/* Stroke Width Slider with Numeric Input */}
        <div className="flex items-center gap-2.5">
          <span className="text-[#b89058] text-[11px] font-mayan font-bold uppercase tracking-wider">Width:</span>
          <input
            type="range"
            min={1}
            max={60}
            step={1}
            value={config.strokeWidth}
            onChange={(e) => onChangeConfig({ strokeWidth: Number(e.target.value) })}
            className="w-28 mayan-range-slider cursor-pointer"
          />
          <div className="flex items-center gap-1 mayan-panel border border-[#b89058]/60 rounded-lg px-2.5 py-0.5 shadow-inner">
            <input
              type="number"
              min={1}
              max={120}
              value={config.strokeWidth}
              onChange={(e) => onChangeConfig({ strokeWidth: Math.max(1, Number(e.target.value)) })}
              className="w-10 bg-transparent text-right font-mono font-bold text-[#f2fbf7] focus:outline-none text-xs"
            />
            <span className="text-[10px] text-[#b89058] font-mono">px</span>
          </div>
        </div>

        {/* Stroke Color */}
        <div className="flex items-center gap-1.5">
          <span className="text-[#b89058] text-[11px] font-mayan font-bold uppercase">Stroke:</span>
          <div className="relative flex items-center gap-1">
            <input
              type="color"
              value={config.strokeColor.startsWith('#') ? config.strokeColor : '#ffffff'}
              onChange={(e) => onChangeConfig({ strokeColor: e.target.value })}
              className="w-6 h-6 rounded border border-[#b89058]/80 bg-transparent cursor-pointer p-0 shadow"
              title="Stroke Color"
            />
          </div>
        </div>

        {/* Fill Toggle & Fill Color */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={config.hasFill}
              onChange={(e) => onChangeConfig({ hasFill: e.target.checked })}
              className="w-3.5 h-3.5 accent-[#2c7a60] rounded cursor-pointer"
            />
            <span className="text-[#e6c699] text-[11px] font-semibold">Fill</span>
          </label>
          {config.hasFill && (
            <input
              type="color"
              value={config.fillColor.startsWith('#') ? config.fillColor : '#000000'}
              onChange={(e) => onChangeConfig({ fillColor: e.target.value })}
              className="w-6 h-6 rounded border border-[#b89058]/80 bg-transparent cursor-pointer p-0 shadow"
              title="Fill Color"
            />
          )}
        </div>

        {/* Stroke Style */}
        <div className="flex items-center gap-1 mayan-well p-0.5 rounded-lg border border-[#2a302d] text-[10px]">
          {(['solid', 'dashed', 'dotted'] as const).map((style) => (
            <button
              key={style}
              onClick={() => onChangeConfig({ strokeStyle: style })}
              className={`px-2.5 py-1 rounded capitalize transition-all cursor-pointer ${
                config.strokeStyle === style
                  ? 'mayan-btn-jade text-white font-semibold shadow-sm'
                  : 'text-[#9e9484] hover:text-[#e6c699]'
              }`}
            >
              {style}
            </button>
          ))}
        </div>

        {/* Action Button: Primary Gold-Rimmed Jade CTA */}
        <button
          onClick={onRasterize}
          title="Rasterize Vector onto Active Layer"
          className="mayan-btn-cta flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg shadow-lg transition-transform cursor-pointer active:scale-95"
        >
          <Sparkles size={14} className="text-[#f2fbf7]" />
          <span>Rasterize to Layer</span>
        </button>
      </div>

      {/* Bottom Context-Specific Controls Row based on selected Shape */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 text-xs text-white/60">
        {/* Star specifics */}
        {config.type === 'star' && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span>Points:</span>
              <input
                type="range"
                min={3}
                max={24}
                value={config.starPoints ?? 5}
                onChange={(e) => onChangeConfig({ starPoints: Number(e.target.value) })}
                className="w-20 accent-[#5fd3ad] cursor-pointer"
              />
              <span className="font-mono text-white font-bold">{config.starPoints ?? 5}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Depth:</span>
              <input
                type="range"
                min={20}
                max={80}
                value={Math.round((config.starInnerRatio ?? 0.45) * 100)}
                onChange={(e) => onChangeConfig({ starInnerRatio: Number(e.target.value) / 100 })}
                className="w-20 accent-[#5fd3ad] cursor-pointer"
              />
              <span className="font-mono text-white">{Math.round((config.starInnerRatio ?? 0.45) * 100)}%</span>
            </div>
          </div>
        )}

        {/* Grid specifics */}
        {config.type === 'grid' && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span>Rows:</span>
              <input
                type="range"
                min={1}
                max={20}
                value={config.gridRows ?? 4}
                onChange={(e) => onChangeConfig({ gridRows: Number(e.target.value) })}
                className="w-20 accent-[#5fd3ad] cursor-pointer"
              />
              <span className="font-mono text-white font-bold">{config.gridRows ?? 4}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Columns:</span>
              <input
                type="range"
                min={1}
                max={20}
                value={config.gridCols ?? 4}
                onChange={(e) => onChangeConfig({ gridCols: Number(e.target.value) })}
                className="w-20 accent-[#5fd3ad] cursor-pointer"
              />
              <span className="font-mono text-white font-bold">{config.gridCols ?? 4}</span>
            </div>
          </div>
        )}

        {/* Spiky Bubble specifics */}
        {config.type === 'spiky_bubble' && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span>Spikes:</span>
              <input
                type="range"
                min={8}
                max={32}
                value={config.spikesCount ?? 16}
                onChange={(e) => onChangeConfig({ spikesCount: Number(e.target.value) })}
                className="w-20 accent-[#5fd3ad] cursor-pointer"
              />
              <span className="font-mono text-white font-bold">{config.spikesCount ?? 16}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Burst Height:</span>
              <input
                type="range"
                min={15}
                max={60}
                value={Math.round((config.spikeAmplitude ?? 0.35) * 100)}
                onChange={(e) => onChangeConfig({ spikeAmplitude: Number(e.target.value) / 100 })}
                className="w-20 accent-[#5fd3ad] cursor-pointer"
              />
              <span className="font-mono text-white">{Math.round((config.spikeAmplitude ?? 0.35) * 100)}%</span>
            </div>
          </div>
        )}

        {/* Comic Vignette Layout */}
        {config.type === 'comic_vignette' && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span>Layout:</span>
              {(['single', 'two_horizontal', 'two_vertical', 'four_grid', 'three_strip'] as VignetteLayout[]).map(
                (layout) => (
                  <button
                    key={layout}
                    onClick={() => onChangeConfig({ vignetteLayout: layout })}
                    className={`px-2 py-1 rounded-md text-[11px] capitalize cursor-pointer transition-colors ${
                      (config.vignetteLayout ?? 'single') === layout
                        ? 'bg-[#2b2e3a] text-white font-semibold'
                        : 'bg-[#15171e] text-white/50 hover:text-white'
                    }`}
                  >
                    {layout.replace('_', ' ')}
                  </button>
                )
              )}
            </div>
            <div className="flex items-center gap-2">
              <span>Gutter:</span>
              <input
                type="range"
                min={4}
                max={40}
                value={config.vignetteGutter ?? 12}
                onChange={(e) => onChangeConfig({ vignetteGutter: Number(e.target.value) })}
                className="w-16 accent-[#5fd3ad] cursor-pointer"
              />
              <span className="font-mono text-white">{config.vignetteGutter ?? 12}px</span>
            </div>
          </div>
        )}

        {/* Rectangle / Speech Bubble Corner Radius */}
        {(config.type === 'rectangle' || config.type === 'speech_bubble' || config.type === 'comic_vignette') && (
          <div className="flex items-center gap-2">
            <span>Corner Radius:</span>
            <input
              type="range"
              min={0}
              max={60}
              value={config.cornerRadius ?? 16}
              onChange={(e) => onChangeConfig({ cornerRadius: Number(e.target.value) })}
              className="w-20 accent-[#5fd3ad] cursor-pointer"
            />
            <span className="font-mono text-white">{config.cornerRadius ?? 16}px</span>
          </div>
        )}

        {/* Line Options: Arrowhead & Stroke Ends */}
        {config.type === 'line' && (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(config.arrowHead)}
                onChange={(e) => onChangeConfig({ arrowHead: e.target.checked })}
                className="accent-[#5fd3ad] rounded cursor-pointer"
              />
              <span>Arrowhead</span>
            </label>
            <div className="flex items-center gap-1 bg-[#181a22] p-0.5 rounded-lg border border-white/10 text-[11px]">
              <span className="text-white/50 px-1.5 text-[10px]">Ends:</span>
              {(['round', 'butt', 'square', 'tapered'] as const).map((cap) => (
                <button
                  key={cap}
                  onClick={() => onChangeConfig({ strokeCap: cap })}
                  className={`px-2 py-0.5 rounded capitalize transition-colors cursor-pointer ${
                    (config.strokeCap ?? 'round') === cap
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  {cap === 'butt' ? 'Flat' : cap}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Brush Path controls */}
        {config.type === 'brush_path' && (
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Draw Trail on Canvas Toggle */}
            <button
              onClick={() => onChangeConfig({ isDrawingTrail: !config.isDrawingTrail })}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
                config.isDrawingTrail
                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-md animate-pulse'
                  : 'bg-[#1c1e27] text-emerald-400 border-white/10 hover:bg-white/10'
              }`}
              title="Click and draw freely on canvas to create path trail"
            >
              <Spline size={14} />
              <span>{config.isDrawingTrail ? 'Drawing Trail... (Draw on Canvas)' : 'Draw Trail on Canvas'}</span>
            </button>

            {/* Stroke Ends (Cap type) */}
            <div className="flex items-center gap-1 bg-[#181a22] p-0.5 rounded-lg border border-white/10 text-[11px]">
              <span className="text-white/50 px-1.5 text-[10px]">Ends:</span>
              {(['round', 'butt', 'square', 'tapered'] as const).map((cap) => (
                <button
                  key={cap}
                  onClick={() => onChangeConfig({ strokeCap: cap })}
                  className={`px-2 py-0.5 rounded capitalize transition-colors cursor-pointer ${
                    (config.strokeCap ?? 'round') === cap
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  {cap === 'butt' ? 'Flat' : cap}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer bg-[#1c1e27] px-2.5 py-1 rounded-lg border border-white/10">
              <input
                type="checkbox"
                checked={Boolean(config.mimicBrush)}
                onChange={(e) => onChangeConfig({ mimicBrush: e.target.checked })}
                className="accent-[#5fd3ad] rounded cursor-pointer"
              />
              <BrushIcon size={13} className="text-blue-400" />
              <span className="text-white font-medium text-[11px]">Mimic Active Brush Texture</span>
            </label>

            {/* Radial Area of Effect Control Toggle */}
            <button
              onClick={() => setShowRadialPanel(!showRadialPanel)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
                showRadialPanel
                  ? 'bg-cyan-600 text-white border-cyan-400 shadow-md'
                  : 'bg-[#1c1e27] text-cyan-400 border-white/10 hover:bg-white/10'
              }`}
              title="Radial Area Control for line thickness sculpting"
            >
              <Target size={13} />
              <span>Radial Area Control</span>
            </button>

            {onAddPathPoint && (
              <button
                onClick={onAddPathPoint}
                className="flex items-center gap-1 px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg cursor-pointer text-xs"
              >
                <Plus size={13} /> Add Point
              </button>
            )}
            {onResetPathPoints && (
              <button
                onClick={onResetPathPoints}
                className="flex items-center gap-1 px-2 py-1 text-white/50 hover:text-white/80 cursor-pointer text-xs"
              >
                <Trash2 size={13} /> Clear Points
              </button>
            )}
          </div>
        )}

        {/* Radial Area Control Panel */}
        {config.type === 'brush_path' && showRadialPanel && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#11131a] px-3 py-2 rounded-xl border border-cyan-500/30 text-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <span className="text-cyan-300 font-semibold flex items-center gap-1">
                <Target size={13} /> Radial Radius:
              </span>
              <input
                type="range"
                min={10}
                max={150}
                value={config.radialRadius ?? 45}
                onChange={(e) => onChangeConfig({ radialRadius: Number(e.target.value) })}
                className="w-24 accent-cyan-400 cursor-pointer"
              />
              <span className="font-mono text-cyan-200 font-bold">{config.radialRadius ?? 45}px</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-white/60">Intensity:</span>
              <input
                type="range"
                min={1}
                max={20}
                value={config.radialIntensity ?? 3}
                onChange={(e) => onChangeConfig({ radialIntensity: Number(e.target.value) })}
                className="w-20 accent-cyan-400 cursor-pointer"
              />
              <span className="font-mono text-white font-bold">±{config.radialIntensity ?? 3}px</span>
            </div>

            <div className="flex items-center gap-1 bg-[#1a1c24] p-0.5 rounded-lg border border-white/10">
              <button
                onClick={() => onChangeConfig({ radialMode: 'thicken' })}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                  (config.radialMode ?? 'thicken') === 'thicken'
                    ? 'bg-cyan-600 text-white'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                + Thicken
              </button>
              <button
                onClick={() => onChangeConfig({ radialMode: 'thin' })}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                  config.radialMode === 'thin'
                    ? 'bg-cyan-600 text-white'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                - Thin
              </button>
            </div>

            <span className="text-[10px] text-cyan-300/80 italic">
              Hold cursor anywhere along stroke to grow thickening circle! · Shift+Click point to remove
            </span>
          </div>
        )}

        <span className="text-[10px] text-white/40 italic">
          {config.type === 'brush_path'
            ? 'Hold cursor to grow radial circle & thicken line · Shift+Click point to remove · Click line to add point'
            : 'Drag handles on canvas to reposition, scale, and bend points'}
        </span>
      </div>
    </div>
  );
};
