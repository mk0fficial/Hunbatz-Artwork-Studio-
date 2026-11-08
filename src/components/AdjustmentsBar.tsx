import React, { useState, useEffect, useRef } from 'react';
import { ActiveAdjustment } from '../types/canvas';
import { Check, X, Sparkles, Sliders, Layers, Eye, RefreshCw, GripHorizontal } from 'lucide-react';
import { InteractiveCurveGraph } from './InteractiveCurveGraph';
import { MayanCornerBrackets, MayanFriezeDivider } from './MayanDecorations';
import { HalftoneDotShape } from '../utils/filterEffectsEngine';

interface AdjustmentsBarProps {
  adjustment: ActiveAdjustment;
  initialParams?: { val1?: number; val2?: number; val3?: number; customLut?: Uint8Array; extraConfig?: any };
  onPreviewChange: (params: { val1: number; val2: number; val3: number; customLut?: Uint8Array; extraConfig?: any }) => void;
  onApply: () => void;
  onCancel: () => void;
}

export const AdjustmentsBar: React.FC<AdjustmentsBarProps> = ({
  adjustment,
  initialParams,
  onPreviewChange,
  onApply,
  onCancel,
}) => {
  const [val1, setVal1] = useState(initialParams?.val1 ?? 0);
  const [val2, setVal2] = useState(initialParams?.val2 ?? 0);
  const [val3, setVal3] = useState(initialParams?.val3 ?? 0);

  // Halftone specific state
  const [halftoneShape, setHalftoneShape] = useState<HalftoneDotShape>(
    initialParams?.extraConfig?.dotShape || 'circle'
  );
  const [halftoneYellow, setHalftoneYellow] = useState<number>(
    initialParams?.extraConfig?.yellowAngle ?? 90
  );
  const [halftoneBlack, setHalftoneBlack] = useState<number>(
    initialParams?.extraConfig?.blackAngle ?? 45
  );

  // Cutout specific state
  const [cutoutLevels, setCutoutLevels] = useState<number>(
    initialParams?.extraConfig?.levels ?? 4
  );
  const [cutoutSimplicity, setCutoutSimplicity] = useState<number>(
    initialParams?.extraConfig?.simplicity ?? 4
  );
  const [cutoutFidelity, setCutoutFidelity] = useState<number>(
    initialParams?.extraConfig?.fidelity ?? 2
  );

  // Channel Extractor specific state
  const [extractorSpace, setExtractorSpace] = useState<'rgb' | 'cmyk'>('rgb');
  const [extractorChannels, setExtractorChannels] = useState<string[]>(['r']);
  const [extractorOutputMode, setExtractorOutputMode] = useState<'color' | 'grayscale'>('color');

  // Pixel Sort specific state
  const [pixelSortUpperThresh, setPixelSortUpperThresh] = useState<number>(100);
  const [pixelSortStartX, setPixelSortStartX] = useState<number>(0);
  const [pixelSortStartY, setPixelSortStartY] = useState<number>(0);
  const [pixelSortDirection, setPixelSortDirection] = useState<'horizontal' | 'vertical'>('horizontal');
  const [pixelSortMode, setPixelSortMode] = useState<'luminance' | 'brightness' | 'hue' | 'saturation' | 'intensity'>('luminance');
  const [pixelSortInvert, setPixelSortInvert] = useState<boolean>(false);

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

  // Curves specific state
  const [curveChannel, setCurveChannel] = useState<'rgb' | 'red' | 'green' | 'blue'>('rgb');
  const [curvePreset, setCurvePreset] = useState<number>(0);

  // RGB Offset specific state
  const [rgbOffsetMode, setRgbOffsetMode] = useState<'uniform' | 'individual'>('uniform');

  // Channel swap names - 22 creative modes in a scrollable list
  const CHANNEL_SWAP_MODES = [
    '0: BGR (Swap R & B)',
    '1: GBR (Green Primary)',
    '2: BRG (Blue First)',
    '3: RBG (Swap G & B)',
    '4: Invert Red Channel',
    '5: Chroma Swap',
    '6: Heatmap Gradient',
    '7: Cyberpunk Neon',
    '8: Solarized RGB',
    '9: Acid Glitch',
    '10: Infrared Swap',
    '11: Mono Green Punch',
    '12: High-Contrast Luma',
    '13: Sepia Amber Vintage',
    '14: Invert Green Channel',
    '15: Invert Blue Channel',
    '16: Cyanotype Blue',
    '17: Solarized Magenta',
    '18: Thermal Vision',
    '19: Emerald Forest',
    '20: Golden Hour Sunset',
    '21: Ultraviolet Glow',
  ];

  // Initialize neutral defaults so image is previewed correctly
  useEffect(() => {
    let initial1 = 0;
    let initial2 = 0;
    let initial3 = 0;
    let extra: any = undefined;

    if (adjustment === 'gaussian_blur') { initial1 = 0; initial2 = 0; }
    else if (adjustment === 'noise') { initial1 = 0; initial2 = 1; initial3 = 1; }
    else if (adjustment === 'invert') { initial1 = 0; initial2 = 0; }
    else if (adjustment === 'grayscale') { initial1 = 0; initial2 = 0; }
    else if (adjustment === 'glitch_rgb_offset') { initial1 = 0; initial2 = 0; initial3 = 0; setRgbOffsetMode('uniform'); }
    else if (adjustment === 'glitch_scanlines') { initial1 = 0; initial2 = 4; }
    else if (adjustment === 'bloom') { initial1 = 0; initial2 = 50; }
    else if (adjustment === 'halftone') {
      initial1 = 20;
      initial2 = 108;
      initial3 = 162;
      extra = {
        maxRadius: Math.round((20 / 100) * 96) + 4,
        cyanAngle: 108,
        magentaAngle: 162,
        yellowAngle: halftoneYellow,
        blackAngle: halftoneBlack,
        dotShape: halftoneShape,
      };
    }
    else if (adjustment === 'cutout') {
      initial1 = cutoutLevels;
      initial2 = cutoutSimplicity;
      initial3 = cutoutFidelity;
      extra = {
        levels: cutoutLevels,
        simplicity: cutoutSimplicity,
        fidelity: cutoutFidelity,
      };
    }
    else if (adjustment === 'channel_extractor') {
      initial1 = 100;
      initial2 = 0;
      initial3 = 0;
      extra = { colorSpace: extractorSpace, channels: extractorChannels, outputMode: extractorOutputMode };
    }
    else if (adjustment === 'motion_blur') { initial1 = 0; initial2 = 45; }
    else if (adjustment === 'chromatic_aberration') { initial1 = 0; initial2 = 0; }
    else if (adjustment === 'sharpen') { initial1 = 0; initial2 = 0; }
    else if (adjustment === 'unsharp_mask') { initial1 = 0; initial2 = 20; initial3 = 0; }
    else if (adjustment === 'curves') { initial1 = 0; initial2 = 0; initial3 = 0; setCurvePreset(0); }
    else if (adjustment === 'fisheye') { initial1 = 50; initial2 = 50; initial3 = 50; }
    else if (adjustment === 'perspective_blur') { initial1 = 0; initial2 = 50; initial3 = 50; }
    else if (adjustment === 'poster_edges') { initial1 = 0; initial2 = 0; initial3 = 0; }
    else if (adjustment === 'pixelate') { initial1 = 0; initial2 = 0; }
    else if (adjustment === 'threshold') { initial1 = 0; initial2 = 0; }
    else if (adjustment === 'glitch_channel_swap') { initial1 = 0; initial2 = 0; }
    else if (adjustment === 'glitch_vhs') { initial1 = 45; initial2 = 50; initial3 = 50; }
    else if (adjustment === 'glitch_led_screen') { initial1 = 35; initial2 = 10; initial3 = 0; }
    else if (adjustment === 'glitch_pixel_sort') {
      initial1 = 35;
      initial2 = 0;
      initial3 = 0;
      extra = {
        upperThreshold: pixelSortUpperThresh,
        startXOffset: pixelSortStartX,
        startYOffset: pixelSortStartY,
        direction: pixelSortDirection,
        sortMode: pixelSortMode,
        invert: pixelSortInvert,
      };
    }
    else if (adjustment === 'thermal') { initial1 = 50; initial2 = 3; initial3 = 0; }

    setVal1(initial1);
    setVal2(initial2);
    setVal3(initial3);

    onPreviewChange({ val1: initial1, val2: initial2, val3: initial3, extraConfig: extra });
  }, [adjustment]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        if (e.key === 'Enter') {
          e.preventDefault();
          onApply();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        onApply();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onApply, onCancel]);

  if (!adjustment) return null;

  const handleUpdate = (v1: number, v2: number = val2, v3: number = val3, extra?: any) => {
    setVal1(v1);
    setVal2(v2);
    setVal3(v3);
    const computedExtra = extra !== undefined ? extra : (
      adjustment === 'halftone'
        ? {
            maxRadius: Math.round((v1 / 100) * 96) + 4,
            cyanAngle: v2,
            magentaAngle: v3,
            yellowAngle: halftoneYellow,
            blackAngle: halftoneBlack,
            dotShape: halftoneShape,
          }
        : adjustment === 'cutout'
        ? {
            levels: v1,
            simplicity: v2,
            fidelity: v3,
          }
        : adjustment === 'channel_extractor'
        ? { colorSpace: extractorSpace, channels: extractorChannels, outputMode: extractorOutputMode }
        : adjustment === 'glitch_pixel_sort'
        ? {
            upperThreshold: pixelSortUpperThresh,
            startXOffset: pixelSortStartX,
            startYOffset: pixelSortStartY,
            direction: pixelSortDirection,
            sortMode: pixelSortMode,
            invert: pixelSortInvert,
          }
        : undefined
    );
    onPreviewChange({ val1: v1, val2: v2, val3: v3, extraConfig: computedExtra });
  };

  const getTitle = () => {
    switch (adjustment) {
      case 'gaussian_blur':
        return `Gaussian Blur: ${val1}px`;
      case 'hue_saturation':
        return `Hue: ${val1 > 0 ? '+' : ''}${val1}° · Sat: ${val2 > 0 ? '+' : ''}${val2}% · Bri: ${val3 > 0 ? '+' : ''}${val3}%`;
      case 'noise':
        return `Noise & Film Grain: ${val1}% ${val2 === 1 ? '(Monochromatic)' : '(Color)'} · ${val3 === 1 ? 'Gaussian' : 'Uniform'}`;
      case 'invert':
        return `Invert Colors: ${val1}%`;
      case 'grayscale':
        return `Grayscale: ${val1}%`;
      case 'motion_blur':
        return `Motion Blur: ${val1}px (Angle: ${val2}°)`;
      case 'surface_blur':
        return `Surface Blur: ${val1}px`;
      case 'bloom':
        return `Bloom Glow: ${val1}% (Threshold: ${val2}%)`;
      case 'chromatic_aberration':
        return `Chromatic Aberration: ${val1}%`;
      case 'perspective_blur':
        return `Perspective Radial Blur: ${val1}% (Center: ${val2}%, ${val3}%)`;
      case 'halftone':
        return `Color Halftone (${halftoneShape.toUpperCase()}): Radius ${Math.round((val1 / 100) * 96) + 4}px · C:${val2}° M:${val3}° Y:${halftoneYellow}° K:${halftoneBlack}°`;
      case 'channel_extractor':
        return `Channel Extractor: ${extractorSpace.toUpperCase()} [${extractorChannels.map(c => c.toUpperCase()).join('+')}] (${extractorOutputMode === 'color' ? 'Color Plates' : 'Grayscale Mask'})`;
      case 'sharpen':
        return `Sharpen Filter: ${val1}%`;
      case 'unsharp_mask':
        return `Unsharp Mask: Amount ${val1}% · Radius ${((val2 || 20) / 10).toFixed(1)}px · Threshold ${val3}`;
      case 'curves':
        return `Curves Studio: ${curveChannel.toUpperCase()} (${curvePreset === 0 ? 'Custom / Tension' : ['High Contrast', 'Invert', 'Cross Process', 'Solarize'][curvePreset - 1]})`;
      case 'fisheye':
        return `Fisheye Lens Optical: ${val1 > 50 ? `+${(val1 - 50) * 2}% Barrel` : `${(val1 - 50) * 2}% Pincushion`}`;
      case 'poster_edges':
        return `Poster Edges: Thickness ${Math.max(1, Math.round((val1 / 100) * 6))} · Intensity ${val2}%`;
      case 'pixelate':
        return `Pixelate / Mosaic: ${Math.max(2, Math.round((val1 / 100) * 48))}px cells`;
      case 'threshold':
        return `Threshold: ${Math.round((val1 / 100) * 255)} / 255`;
      case 'cutout':
        return `Cutout Paper Collage: Levels ${val1} · Simplicity ${val2} · Fidelity ${val3}`;
      case 'gradient_map':
        return `Gradient Map: ${val1}%`;
      case 'glitch_rgb_offset':
        return `RGB Offset Glitch: ${val1}% ${rgbOffsetMode === 'individual' ? '(Per Channel)' : '(Uniform)'}`;
      case 'glitch_channel_swap':
        return `Channel Swap Glitch: ${CHANNEL_SWAP_MODES[Math.max(0, Math.min(CHANNEL_SWAP_MODES.length - 1, Math.round((val1 / 100) * (CHANNEL_SWAP_MODES.length - 1))))] || ''}`;
      case 'glitch_random_dispersion':
        return `Random Dispersion Glitch: ${val1}%`;
      case 'glitch_scanlines':
        return `Scanlines Glitch: ${val1}% (Spacing: ${val2}px)`;
      case 'glitch_vhs':
        return `VHS Tape Filter: Distortion ${val1}% · Fringing ${val2}% · Wobble ${val3}%`;
      case 'glitch_led_screen':
        return `LED Screen Glitch: Pixel Size ${Math.max(1, Math.round((val1 / 100) * 8))}px · Gap ${val2}%`;
      case 'glitch_pixel_sort':
        return `Pixel Sort Glitch: Range ${val1}%–${pixelSortUpperThresh}% · ${pixelSortDirection.toUpperCase()} · Mode: ${pixelSortMode.toUpperCase()} · Origin (${pixelSortStartX}%, ${pixelSortStartY}%)`;
      case 'thermal':
        return `Thermal Infrared: Tone ${val1}% · Gradient Type ${Math.max(1, Math.min(6, Math.round(val2 || 3)))}`;
      default:
        return 'Adjustments Studio';
    }
  };

  const channelIndexMap: Record<'rgb' | 'red' | 'green' | 'blue', number> = {
    rgb: 0,
    red: 1,
    green: 2,
    blue: 3,
  };

  const handleCurvePresetChange = (preset: number) => {
    setCurvePreset(preset);
    handleUpdate(val1, channelIndexMap[curveChannel], preset);
  };

  const handleCurveChannelChange = (ch: 'rgb' | 'red' | 'green' | 'blue') => {
    setCurveChannel(ch);
    handleUpdate(val1, channelIndexMap[ch], curvePreset);
  };

  return (
    <div
      style={{
        transform: `translate(calc(-50% + ${positionOffset.x}px), ${positionOffset.y}px)`,
      }}
      className="fixed bottom-6 left-1/2 z-40 max-w-xl w-[92vw] mayan-panel p-3 text-[#E6C699] flex flex-col gap-2 select-none animate-in slide-in-from-bottom-2 duration-150 shadow-[0_16px_50px_rgba(0,0,0,0.95)]"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <MayanCornerBrackets size={14} />

      {/* Top Grab Handle to Drag Anywhere */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-full flex items-center justify-center py-1 cursor-grab active:cursor-grabbing text-[#b89058]/60 hover:text-[#5fd3ad] transition-colors select-none -mt-1 touch-none"
        title="Drag handle: Click and move to reposition Adjustments toolbar anywhere on canvas"
      >
        <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#18201d] border border-[#2c3532]">
          <GripHorizontal size={12} />
          <span className="text-[9px] font-mayan font-bold uppercase tracking-wider text-[#b89058]">Adjustments Bar</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles size={15} className="text-[#5fd3ad] shrink-0" />
          <span className="text-xs font-semibold tracking-wide truncate font-mayan text-[#E6C699]">{getTitle()}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title="Cancel (Esc)"
            className="p-1 rounded-lg text-[#9E9484] hover:text-[#E6C699] hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onApply();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title="Apply Adjustment (Enter)"
            className="flex items-center gap-1.5 px-3 py-1 mayan-btn-cta text-xs font-semibold shadow-md transition-all cursor-pointer active:scale-95"
          >
            <Check size={14} /> Apply
          </button>
        </div>
      </div>

      {/* Dynamic Controls with Instant Live Preview */}
      <div className="flex flex-col gap-2.5 pt-0.5 text-xs max-h-[72vh] overflow-y-auto pr-1">
        {/* 1. CURVES INTERACTIVE STUDIO WIDGET */}
        {adjustment === 'curves' && (
          <div className="flex flex-col gap-3 bg-[#1d1f27] p-3 rounded-xl border border-white/10">
            {/* Channel Selection & Presets */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-[#14151b] p-0.5 rounded-lg border border-white/10">
                {(['rgb', 'red', 'green', 'blue'] as const).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => handleCurveChannelChange(ch)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                      curveChannel === ch
                        ? ch === 'red'
                          ? 'bg-red-500/80 text-white'
                          : ch === 'green'
                          ? 'bg-green-500/80 text-white'
                          : ch === 'blue'
                          ? 'bg-blue-500/80 text-white'
                          : 'bg-white/20 text-white shadow-sm'
                        : 'text-white/40 hover:text-white'
                    }`}
                  >
                    {ch.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Presets */}
              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { label: 'Normal', preset: 0 },
                  { label: 'Contrast', preset: 1 },
                  { label: 'Invert', preset: 2 },
                  { label: 'Cross', preset: 3 },
                  { label: 'Solarize', preset: 4 },
                ].map((p) => (
                  <button
                    key={p.label}
                    onClick={() => handleCurvePresetChange(p.preset)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors cursor-pointer ${
                      curvePreset === p.preset
                        ? 'bg-blue-600/50 border-blue-400 text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Multi-Point Curve Graph (Master RGB Curve with click-to-add control points) */}
            <div className="flex justify-center py-1 bg-[#121318] rounded-xl border border-white/10 p-2">
              <InteractiveCurveGraph
                channel={curveChannel}
                preset={curvePreset}
                onLutChange={(lut) => {
                  onPreviewChange({
                    val1: 50,
                    val2: channelIndexMap[curveChannel],
                    val3: curvePreset,
                    customLut: lut,
                  });
                }}
              />
            </div>
          </div>
        )}

        {/* 2. COLOR HALFTONE MULTI-ANGLE STUDIO (ALPHA TRANSPARENCY) */}
        {adjustment === 'halftone' && (
          <div className="flex flex-col gap-2.5 bg-[#20222a] p-3 rounded-xl border border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/50 font-medium">Halftone Dot Shape</span>
              <span className="text-[10px] text-[#5fd3ad] font-mono">Keyed Alpha (100% Transparent BG)</span>
            </div>
            
            {/* Expanded Shape Library */}
            <div className="flex items-center gap-1 flex-wrap">
              {(
                [
                  { id: 'circle', label: 'Circle' },
                  { id: 'square', label: 'Square' },
                  { id: 'diamond', label: 'Diamond' },
                  { id: 'line', label: 'Line' },
                  { id: 'cross', label: 'Cross (X)' },
                  { id: 'ellipse', label: 'Ellipse' },
                  { id: 'hexagon', label: 'Hexagon' },
                ] as const
              ).map((shapeItem) => (
                <button
                  key={shapeItem.id}
                  onClick={() => {
                    setHalftoneShape(shapeItem.id);
                    handleUpdate(val1, val2, val3, {
                      maxRadius: Math.round((val1 / 100) * 96) + 4,
                      cyanAngle: val2,
                      magentaAngle: val3,
                      yellowAngle: halftoneYellow,
                      blackAngle: halftoneBlack,
                      dotShape: shapeItem.id,
                    });
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                    halftoneShape === shapeItem.id
                      ? 'bg-[#5fd3ad]/20 border-[#5fd3ad] text-[#5fd3ad] shadow-sm'
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {shapeItem.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
              <span className="text-white/60 font-mono text-[11px] w-28">Max Radius ({Math.round((val1 / 100) * 96) + 4}px)</span>
              <input
                type="range"
                min="0"
                max="100"
                value={val1}
                onChange={(e) => handleUpdate(parseInt(e.target.value), val2, val3)}
                className="flex-1 h-2 bg-white/10 accent-[#5fd3ad] rounded-lg cursor-pointer"
              />
              <span className="text-[#5fd3ad] font-mono text-xs w-12 text-right">{Math.round((val1 / 100) * 96) + 4}px</span>
            </div>

            {/* 4 Rotated Screen Angle Sliders for CMYK (Cyan, Magenta, Yellow, Black) */}
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
              <span className="text-cyan-400 font-mono text-[11px] w-28">Cyan Angle (Ch 1)</span>
              <input
                type="range"
                min="0"
                max="180"
                value={val2}
                onChange={(e) => handleUpdate(val1, parseInt(e.target.value), val3)}
                className="flex-1 h-1.5 bg-white/10 accent-cyan-400 rounded-lg cursor-pointer"
              />
              <span className="text-cyan-400 font-mono text-xs w-12 text-right">{val2}°</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-pink-400 font-mono text-[11px] w-28">Magenta Angle (Ch 2)</span>
              <input
                type="range"
                min="0"
                max="180"
                value={val3}
                onChange={(e) => handleUpdate(val1, val2, parseInt(e.target.value))}
                className="flex-1 h-1.5 bg-white/10 accent-pink-500 rounded-lg cursor-pointer"
              />
              <span className="text-pink-400 font-mono text-xs w-12 text-right">{val3}°</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-yellow-400 font-mono text-[11px] w-28">Yellow Angle (Ch 3)</span>
              <input
                type="range"
                min="0"
                max="180"
                value={halftoneYellow}
                onChange={(e) => {
                  const newY = parseInt(e.target.value);
                  setHalftoneYellow(newY);
                  handleUpdate(val1, val2, val3, {
                    maxRadius: Math.round((val1 / 100) * 96) + 4,
                    cyanAngle: val2,
                    magentaAngle: val3,
                    yellowAngle: newY,
                    blackAngle: halftoneBlack,
                    dotShape: halftoneShape,
                  });
                }}
                className="flex-1 h-1.5 bg-white/10 accent-yellow-400 rounded-lg cursor-pointer"
              />
              <span className="text-yellow-400 font-mono text-xs w-12 text-right">{halftoneYellow}°</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-300 font-mono text-[11px] w-28">Black Angle (Ch 4)</span>
              <input
                type="range"
                min="0"
                max="180"
                value={halftoneBlack}
                onChange={(e) => {
                  const newK = parseInt(e.target.value);
                  setHalftoneBlack(newK);
                  handleUpdate(val1, val2, val3, {
                    maxRadius: Math.round((val1 / 100) * 96) + 4,
                    cyanAngle: val2,
                    magentaAngle: val3,
                    yellowAngle: halftoneYellow,
                    blackAngle: newK,
                    dotShape: halftoneShape,
                  });
                }}
                className="flex-1 h-1.5 bg-white/10 accent-gray-400 rounded-lg cursor-pointer"
              />
              <span className="text-gray-300 font-mono text-xs w-12 text-right">{halftoneBlack}°</span>
            </div>
          </div>
        )}

        {/* 2B. CHANNEL EXTRACTOR EFFECT (RGB / CMYK MULTI-CHANNEL) */}
        {adjustment === 'channel_extractor' && (
          <div className="flex flex-col gap-2.5 bg-[#20222a] p-3 rounded-xl border border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/50 font-medium">Color Space</span>
              <div className="flex items-center gap-1 bg-[#14151b] p-0.5 rounded-lg border border-white/10">
                <button
                  onClick={() => {
                    setExtractorSpace('rgb');
                    const newChannels = ['r'];
                    setExtractorChannels(newChannels);
                    handleUpdate(val1, val2, val3, { colorSpace: 'rgb', channels: newChannels, outputMode: extractorOutputMode });
                  }}
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    extractorSpace === 'rgb' ? 'bg-blue-600 text-white shadow' : 'text-white/40 hover:text-white'
                  }`}
                >
                  RGB
                </button>
                <button
                  onClick={() => {
                    setExtractorSpace('cmyk');
                    const newChannels = ['c'];
                    setExtractorChannels(newChannels);
                    handleUpdate(val1, val2, val3, { colorSpace: 'cmyk', channels: newChannels, outputMode: extractorOutputMode });
                  }}
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    extractorSpace === 'cmyk' ? 'bg-blue-600 text-white shadow' : 'text-white/40 hover:text-white'
                  }`}
                >
                  CMYK
                </button>
              </div>
            </div>

            {/* Channel Toggles */}
            <div className="flex flex-col gap-1.5 pt-1 border-t border-white/5">
              <span className="text-[11px] text-white/50 font-medium">Extract Channels (Multi-Select):</span>
              <div className="flex items-center gap-2">
                {extractorSpace === 'rgb' ? (
                  ([
                    { id: 'r', label: 'Red (R)', color: 'text-red-400', activeBg: 'bg-red-500/20 border-red-400' },
                    { id: 'g', label: 'Green (G)', color: 'text-green-400', activeBg: 'bg-green-500/20 border-green-400' },
                    { id: 'b', label: 'Blue (B)', color: 'text-blue-400', activeBg: 'bg-blue-500/20 border-blue-400' },
                  ] as const).map((ch) => {
                    const isSelected = extractorChannels.includes(ch.id);
                    return (
                      <button
                        key={ch.id}
                        onClick={() => {
                          let next: string[];
                          if (isSelected) {
                            next = extractorChannels.filter(c => c !== ch.id);
                            if (next.length === 0) next = [ch.id]; // keep at least 1
                          } else {
                            next = [...extractorChannels, ch.id];
                          }
                          setExtractorChannels(next);
                          handleUpdate(val1, val2, val3, { colorSpace: extractorSpace, channels: next, outputMode: extractorOutputMode });
                        }}
                        className={`flex-1 py-1 px-2 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                          isSelected
                            ? `${ch.activeBg} ${ch.color} shadow-sm`
                            : 'bg-white/5 border-white/10 text-white/40 hover:text-white'
                        }`}
                      >
                        {ch.label}
                      </button>
                    );
                  })
                ) : (
                  ([
                    { id: 'c', label: 'Cyan (C)', color: 'text-cyan-400', activeBg: 'bg-cyan-500/20 border-cyan-400' },
                    { id: 'm', label: 'Magenta (M)', color: 'text-pink-400', activeBg: 'bg-pink-500/20 border-pink-400' },
                    { id: 'y', label: 'Yellow (Y)', color: 'text-yellow-400', activeBg: 'bg-yellow-500/20 border-yellow-400' },
                    { id: 'k', label: 'Key/Black (K)', color: 'text-gray-300', activeBg: 'bg-white/20 border-white/60' },
                  ] as const).map((ch) => {
                    const isSelected = extractorChannels.includes(ch.id);
                    return (
                      <button
                        key={ch.id}
                        onClick={() => {
                          let next: string[];
                          if (isSelected) {
                            next = extractorChannels.filter(c => c !== ch.id);
                            if (next.length === 0) next = [ch.id];
                          } else {
                            next = [...extractorChannels, ch.id];
                          }
                          setExtractorChannels(next);
                          handleUpdate(val1, val2, val3, { colorSpace: extractorSpace, channels: next, outputMode: extractorOutputMode });
                        }}
                        className={`flex-1 py-1 px-2 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                          isSelected
                            ? `${ch.activeBg} ${ch.color} shadow-sm`
                            : 'bg-white/5 border-white/10 text-white/40 hover:text-white'
                        }`}
                      >
                        {ch.label}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Output Mode Switch: Color Plates vs Grayscale Mask */}
            <div className="flex items-center justify-between pt-1 border-t border-white/5">
              <span className="text-[11px] text-white/50 font-medium">Output Mode</span>
              <div className="flex items-center gap-1 bg-[#14151b] p-0.5 rounded-lg border border-white/10">
                <button
                  onClick={() => {
                    setExtractorOutputMode('color');
                    handleUpdate(val1, val2, val3, { colorSpace: extractorSpace, channels: extractorChannels, outputMode: 'color' });
                  }}
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    extractorOutputMode === 'color' ? 'bg-[#5fd3ad]/20 text-[#5fd3ad] border border-[#5fd3ad]/40' : 'text-white/40 hover:text-white'
                  }`}
                >
                  Color Channels
                </button>
                <button
                  onClick={() => {
                    setExtractorOutputMode('grayscale');
                    handleUpdate(val1, val2, val3, { colorSpace: extractorSpace, channels: extractorChannels, outputMode: 'grayscale' });
                  }}
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    extractorOutputMode === 'grayscale' ? 'bg-[#5fd3ad]/20 text-[#5fd3ad] border border-[#5fd3ad]/40' : 'text-white/40 hover:text-white'
                  }`}
                >
                  Grayscale Mask
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. RGB OFFSET GLITCH: UNIFORM vs INDIVIDUAL CHANNELS */}
        {adjustment === 'glitch_rgb_offset' && (
          <div className="flex flex-col gap-2.5 bg-[#20222a] p-3 rounded-xl border border-white/5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-white/50 font-medium">Offset Routing Mode</span>
              <div className="flex items-center gap-1 bg-[#14151b] p-0.5 rounded-lg border border-white/10">
                <button
                  onClick={() => {
                    setRgbOffsetMode('uniform');
                    handleUpdate(val1, 0, 0);
                  }}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors cursor-pointer ${
                    rgbOffsetMode === 'uniform' ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white'
                  }`}
                >
                  Uniform Shift
                </button>
                <button
                  onClick={() => {
                    setRgbOffsetMode('individual');
                    handleUpdate(val1, 50, 20);
                  }}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors cursor-pointer ${
                    rgbOffsetMode === 'individual' ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white'
                  }`}
                >
                  Individual R/G/B
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-red-400 font-mono text-[11px] w-24">Red Channel</span>
              <input
                type="range"
                min="0"
                max="100"
                value={val1}
                onChange={(e) => handleUpdate(parseInt(e.target.value), val2, val3)}
                className="flex-1 h-2 bg-white/10 accent-red-500 rounded-lg cursor-pointer"
              />
              <span className="text-red-400 font-mono text-xs w-10 text-right">{val1}%</span>
            </div>

            {rgbOffsetMode === 'individual' && (
              <>
                <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
                  <span className="text-green-400 font-mono text-[11px] w-24">Green Channel</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={val2}
                    onChange={(e) => handleUpdate(val1, parseInt(e.target.value), val3)}
                    className="flex-1 h-1.5 bg-white/10 accent-green-500 rounded-lg cursor-pointer"
                  />
                  <span className="text-green-400 font-mono text-xs w-10 text-right">{val2 - 50}%</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#5fd3ad] font-mono text-[11px] w-24">Blue Channel</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={val3}
                    onChange={(e) => handleUpdate(val1, val2, parseInt(e.target.value))}
                    className="flex-1 h-1.5 bg-white/10 accent-[#5fd3ad] rounded-lg cursor-pointer"
                  />
                  <span className="text-[#5fd3ad] font-mono text-xs w-10 text-right">{val3 - 50}%</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* 4. CHANNEL SWAP GLITCH: 22 CREATIVE MODES */}
        {adjustment === 'glitch_channel_swap' && (
          <div className="flex flex-col gap-2 bg-[#20222a] p-3 rounded-xl border border-white/5">
            <span className="text-[11px] text-white/50 font-medium">Select Creative Channel Swap Mode ({CHANNEL_SWAP_MODES.length} Permutations):</span>
            <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
              {CHANNEL_SWAP_MODES.map((modeName, idx) => {
                const maxIdx = CHANNEL_SWAP_MODES.length - 1;
                const currentModeIdx = Math.max(0, Math.min(maxIdx, Math.round((val1 / 100) * maxIdx)));
                const isSelected = currentModeIdx === idx;
                return (
                  <button
                    key={modeName}
                    onClick={() => handleUpdate(Math.round((idx / maxIdx) * 100), 0, 0)}
                    className={`flex items-center justify-start px-2 py-1.5 rounded-lg text-[10px] font-mono border text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600/60 border-blue-400 text-white font-bold shadow-sm ring-1 ring-blue-400/50'
                        : 'bg-[#14151b] border-white/5 text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span className="truncate">{modeName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}



        {/* 5. FISHEYE LENS OPTICAL DISTORTION */}
        {adjustment === 'fisheye' && (
          <div className="flex flex-col gap-2.5 bg-[#20222a] p-3 rounded-xl border border-white/5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/60 font-mono text-[11px] w-28">Distortion</span>
              <input
                type="range"
                min="0"
                max="100"
                value={val1}
                onChange={(e) => handleUpdate(parseInt(e.target.value), val2, val3)}
                className="flex-1 h-2 bg-white/10 accent-[#5fd3ad] rounded-lg cursor-pointer"
              />
              <span className="text-[#5fd3ad] font-mono text-xs w-12 text-right">
                {val1 > 50 ? `+${(val1 - 50) * 2}%` : `${(val1 - 50) * 2}%`}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
              <span className="text-white/50 font-mono text-[11px] w-28">Center X</span>
              <input
                type="range"
                min="0"
                max="100"
                value={val2}
                onChange={(e) => handleUpdate(val1, parseInt(e.target.value), val3)}
                className="flex-1 h-1.5 bg-white/10 accent-pink-500 rounded-lg cursor-pointer"
              />
              <span className="text-pink-400 font-mono text-xs w-12 text-right">{val2}%</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/50 font-mono text-[11px] w-28">Center Y</span>
              <input
                type="range"
                min="0"
                max="100"
                value={val3}
                onChange={(e) => handleUpdate(val1, val2, parseInt(e.target.value))}
                className="flex-1 h-1.5 bg-white/10 accent-pink-500 rounded-lg cursor-pointer"
              />
              <span className="text-pink-400 font-mono text-xs w-12 text-right">{val3}%</span>
            </div>
          </div>
        )}

        {/* 6. PERSPECTIVE BLUR WITH INTERACTIVE FOCAL POINT */}
        {adjustment === 'perspective_blur' && (
          <div className="flex flex-col gap-2.5 bg-[#20222a] p-3 rounded-xl border border-white/5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/60 font-mono text-[11px] w-28">Blur Intensity</span>
              <input
                type="range"
                min="0"
                max="100"
                value={val1}
                onChange={(e) => handleUpdate(parseInt(e.target.value), val2, val3)}
                className="flex-1 h-2 bg-white/10 accent-[#5fd3ad] rounded-lg cursor-pointer"
              />
              <span className="text-[#5fd3ad] font-mono text-xs w-12 text-right">{val1}%</span>
            </div>

            {/* Interactive Focal Pin Pad */}
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
              <div className="flex flex-col gap-0.5">
                <span className="text-white/70 font-semibold text-xs flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />
                  Focal Point ({val2}%, {val3}%)
                </span>
                <span className="text-[10px] text-white/40">Drag directly on the canvas or touch pad below</span>
              </div>
              <button
                onClick={() => handleUpdate(val1, 50, 50)}
                className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-medium transition-colors cursor-pointer"
              >
                Center Pin
              </button>
            </div>

            {/* 2D Interactive Pad */}
            <div
              className="relative w-full h-24 bg-[#101115] rounded-xl border border-white/10 flex items-center justify-center cursor-crosshair overflow-hidden"
              onPointerDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const px = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
                const py = Math.max(0, Math.min(100, Math.round(((e.clientY - rect.top) / rect.height) * 100)));
                handleUpdate(val1, px, py);
              }}
            >
              {/* Grid crosshairs */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-full h-px bg-white/10" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="h-full w-px bg-white/10" />
              </div>

              {/* Pin Indicator */}
              <div
                className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full border-2 border-amber-400 bg-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/50 pointer-events-none"
                style={{ left: `${val2}%`, top: `${val3}%` }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
            </div>
          </div>
        )}



        {/* 8. POSTER EDGES */}
        {adjustment === 'poster_edges' && (
          <div className="flex flex-col gap-2.5 bg-[#20222a] p-3 rounded-xl border border-white/5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/60 font-mono text-[11px] w-28">Edge Thickness</span>
              <input
                type="range"
                min="0"
                max="100"
                value={val1}
                onChange={(e) => handleUpdate(parseInt(e.target.value), val2, val3)}
                className="flex-1 h-2 bg-white/10 accent-[#5fd3ad] rounded-lg cursor-pointer"
              />
              <span className="text-[#5fd3ad] font-mono text-xs w-10 text-right">{Math.max(1, Math.round((val1 / 100) * 6))}px</span>
            </div>
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
              <span className="text-white/60 font-mono text-[11px] w-28">Edge Intensity</span>
              <input
                type="range"
                min="0"
                max="100"
                value={val2}
                onChange={(e) => handleUpdate(val1, parseInt(e.target.value), val3)}
                className="flex-1 h-1.5 bg-white/10 accent-pink-500 rounded-lg cursor-pointer"
              />
              <span className="text-pink-400 font-mono text-xs w-10 text-right">{val2}%</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/60 font-mono text-[11px] w-28">Levels</span>
              <input
                type="range"
                min="20"
                max="100"
                value={val3}
                onChange={(e) => handleUpdate(val1, val2, parseInt(e.target.value))}
                className="flex-1 h-1.5 bg-white/10 accent-amber-400 rounded-lg cursor-pointer"
              />
              <span className="text-amber-400 font-mono text-xs w-10 text-right">{Math.max(2, Math.round(val3 / 20))}</span>
            </div>
          </div>
        )}

        {/* 9. PIXELATE / MOSAIC */}
        {adjustment === 'pixelate' && (
          <div className="flex items-center justify-between gap-3 bg-[#20222a] p-3 rounded-xl border border-white/5">
            <span className="text-white/60 font-mono text-[11px] w-24">Cell Size</span>
            <input
              type="range"
              min="0"
              max="100"
              value={val1}
              onChange={(e) => handleUpdate(parseInt(e.target.value))}
              className="flex-1 h-2 bg-white/10 accent-[#5fd3ad] rounded-lg cursor-pointer"
            />
            <span className="text-[#5fd3ad] font-mono text-xs w-14 text-right">
              {Math.max(2, Math.round((val1 / 100) * 48))}px
            </span>
          </div>
        )}

        {/* 10. THRESHOLD */}
        {adjustment === 'threshold' && (
          <div className="flex items-center justify-between gap-3 bg-[#20222a] p-3 rounded-xl border border-white/5">
            <span className="text-white/60 font-mono text-[11px] w-24">Threshold</span>
            <input
              type="range"
              min="0"
              max="100"
              value={val1}
              onChange={(e) => handleUpdate(parseInt(e.target.value))}
              className="flex-1 h-2 bg-white/10 accent-[#5fd3ad] rounded-lg cursor-pointer"
            />
            <span className="text-[#5fd3ad] font-mono text-xs w-14 text-right">
              {Math.round((val1 / 100) * 255)}
            </span>
          </div>
        )}

        {/* 11. CUTOUT (PAPER-CUT POLYGON COLLAGE) */}
        {adjustment === 'cutout' && (
          <div className="flex flex-col gap-2.5 bg-[#20222a] p-3 rounded-xl border border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/50 font-medium">Cutout Paper Gallery</span>
              <span className="text-[10px] text-[#5fd3ad] font-mono">Kuwahara Polygon Simplification</span>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
              <span className="text-white/60 font-mono text-[11px] w-28">No. of Levels</span>
              <input
                type="range"
                min="2"
                max="8"
                value={val1}
                onChange={(e) => {
                  const newLevels = parseInt(e.target.value);
                  setCutoutLevels(newLevels);
                  handleUpdate(newLevels, val2, val3, {
                    levels: newLevels,
                    simplicity: val2,
                    fidelity: val3,
                  });
                }}
                className="flex-1 h-2 bg-white/10 accent-[#5fd3ad] rounded-lg cursor-pointer"
              />
              <span className="text-[#5fd3ad] font-mono text-xs w-10 text-right">{val1}</span>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
              <span className="text-white/60 font-mono text-[11px] w-28">Edge Simplicity</span>
              <input
                type="range"
                min="0"
                max="10"
                value={val2}
                onChange={(e) => {
                  const newSimplicity = parseInt(e.target.value);
                  setCutoutSimplicity(newSimplicity);
                  handleUpdate(val1, newSimplicity, val3, {
                    levels: val1,
                    simplicity: newSimplicity,
                    fidelity: val3,
                  });
                }}
                className="flex-1 h-1.5 bg-white/10 accent-pink-500 rounded-lg cursor-pointer"
              />
              <span className="text-pink-400 font-mono text-xs w-10 text-right">{val2}</span>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
              <span className="text-white/60 font-mono text-[11px] w-28">Edge Fidelity</span>
              <input
                type="range"
                min="1"
                max="3"
                value={val3}
                onChange={(e) => {
                  const newFidelity = parseInt(e.target.value);
                  setCutoutFidelity(newFidelity);
                  handleUpdate(val1, val2, newFidelity, {
                    levels: val1,
                    simplicity: val2,
                    fidelity: newFidelity,
                  });
                }}
                className="flex-1 h-1.5 bg-white/10 accent-cyan-400 rounded-lg cursor-pointer"
              />
              <span className="text-cyan-400 font-mono text-xs w-10 text-right">{val3}</span>
            </div>
          </div>
        )}

        {/* 12. GAUSSIAN BLUR */}
        {adjustment === 'gaussian_blur' && (
          <div className="flex items-center justify-between gap-3 bg-[#20222a] p-2.5 rounded-xl border border-white/5">
            <span className="text-white/60 font-mono text-[11px] w-20">Radius</span>
            <input
              type="range"
              min="0"
              max="40"
              value={val1}
              onChange={(e) => handleUpdate(parseInt(e.target.value))}
              className="flex-1 h-2 bg-white/10 accent-[#5fd3ad] rounded-lg cursor-pointer"
            />
            <span className="text-[#5fd3ad] font-mono text-xs w-10 text-right">{val1}px</span>
          </div>
        )}

        {/* 13. NOISE */}
        {adjustment === 'noise' && (
          <div className="flex flex-col gap-2.5 bg-[#20222a] p-3 rounded-xl border border-white/5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/60 font-mono text-[11px] w-20">Amount</span>
              <input
                type="range"
                min="0"
                max="100"
                value={val1}
                onChange={(e) => handleUpdate(parseInt(e.target.value), val2, val3)}
                className="flex-1 h-2 bg-white/10 accent-[#5fd3ad] rounded-lg cursor-pointer"
              />
              <span className="text-[#5fd3ad] font-mono text-xs w-10 text-right">{val1}%</span>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
              <label className="flex items-center gap-2 cursor-pointer text-[11px] text-white/80">
                <input
                  type="checkbox"
                  checked={val2 === 1}
                  onChange={(e) => handleUpdate(val1, e.target.checked ? 1 : 0, val3)}
                  className="accent-[#5fd3ad] rounded cursor-pointer"
                />
                <span>Monochromatic</span>
              </label>

              <div className="flex items-center gap-1 bg-[#14151b] p-0.5 rounded-lg border border-white/10 text-[10px]">
                <button
                  onClick={() => handleUpdate(val1, val2, 1)}
                  className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                    val3 === 1 ? 'bg-blue-600 text-white font-semibold' : 'text-white/40 hover:text-white'
                  }`}
                >
                  Gaussian
                </button>
                <button
                  onClick={() => handleUpdate(val1, val2, 0)}
                  className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                    val3 === 0 ? 'bg-blue-600 text-white font-semibold' : 'text-white/40 hover:text-white'
                  }`}
                >
                  Uniform
                </button>
              </div>
            </div>
          </div>
        )}

        {/* UNSHARP MASK */}
        {adjustment === 'unsharp_mask' && (
          <div className="flex flex-col gap-2.5 bg-[#20222a] p-3 rounded-xl border border-white/5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/60 font-mono text-[11px] w-24">Amount</span>
              <input
                type="range"
                min="0"
                max="300"
                value={val1}
                onChange={(e) => handleUpdate(parseInt(e.target.value), val2, val3)}
                className="flex-1 h-2 bg-white/10 accent-[#5fd3ad] rounded-lg cursor-pointer"
              />
              <span className="text-[#5fd3ad] font-mono text-xs w-12 text-right">{val1}%</span>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
              <span className="text-white/60 font-mono text-[11px] w-24">Radius</span>
              <input
                type="range"
                min="1"
                max="100"
                value={val2}
                onChange={(e) => handleUpdate(val1, parseInt(e.target.value), val3)}
                className="flex-1 h-1.5 bg-white/10 accent-cyan-400 rounded-lg cursor-pointer"
              />
              <span className="text-cyan-400 font-mono text-xs w-12 text-right">
                {(val2 / 10).toFixed(1)}px
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-white/60 font-mono text-[11px] w-24">Threshold</span>
              <input
                type="range"
                min="0"
                max="100"
                value={val3}
                onChange={(e) => handleUpdate(val1, val2, parseInt(e.target.value))}
                className="flex-1 h-1.5 bg-white/10 accent-amber-400 rounded-lg cursor-pointer"
              />
              <span className="text-amber-400 font-mono text-xs w-12 text-right">{val3}</span>
            </div>
          </div>
        )}

        {/* 14. HUE / SATURATION / BRIGHTNESS */}
        {adjustment === 'hue_saturation' && (
          <div className="flex flex-col gap-2 bg-[#20222a] p-2.5 rounded-xl border border-white/5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/60 font-mono text-[11px] w-24">Hue ({val1}°)</span>
              <input
                type="range"
                min="-180"
                max="180"
                value={val1}
                onChange={(e) => handleUpdate(parseInt(e.target.value), val2, val3)}
                className="flex-1 h-1.5 bg-white/10 accent-[#5fd3ad] rounded-lg cursor-pointer"
              />
              <span className="text-white/70 font-mono text-[11px] w-10 text-right">{val1}°</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/60 font-mono text-[11px] w-24">Saturation ({val2}%)</span>
              <input
                type="range"
                min="-100"
                max="100"
                value={val2}
                onChange={(e) => handleUpdate(val1, parseInt(e.target.value), val3)}
                className="flex-1 h-1.5 bg-white/10 accent-[#5fd3ad] rounded-lg cursor-pointer"
              />
              <span className="text-white/70 font-mono text-[11px] w-10 text-right">{val2}%</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/60 font-mono text-[11px] w-24">Brightness ({val3}%)</span>
              <input
                type="range"
                min="-100"
                max="100"
                value={val3}
                onChange={(e) => handleUpdate(val1, val2, parseInt(e.target.value))}
                className="flex-1 h-1.5 bg-white/10 accent-[#5fd3ad] rounded-lg cursor-pointer"
              />
              <span className="text-white/70 font-mono text-[11px] w-10 text-right">{val3}%</span>
            </div>
          </div>
        )}

        {/* 15. INVERT */}
        {adjustment === 'invert' && (
          <div className="flex items-center justify-between gap-3 bg-[#20222a] p-2.5 rounded-xl border border-white/5">
            <span className="text-white/60 font-mono text-[11px] w-20">Invert</span>
            <input
              type="range"
              min="0"
              max="100"
              value={val1}
              onChange={(e) => handleUpdate(parseInt(e.target.value))}
              className="flex-1 h-2 bg-white/10 accent-[#5fd3ad] rounded-lg cursor-pointer"
            />
            <span className="text-[#5fd3ad] font-mono text-xs w-10 text-right">{val1}%</span>
          </div>
        )}

        {/* 16. GRAYSCALE */}
        {adjustment === 'grayscale' && (
          <div className="flex items-center justify-between gap-3 bg-[#20222a] p-2.5 rounded-xl border border-white/5">
            <span className="text-white/60 font-mono text-[11px] w-20">Grayscale</span>
            <input
              type="range"
              min="0"
              max="100"
              value={val1}
              onChange={(e) => handleUpdate(parseInt(e.target.value))}
              className="flex-1 h-2 bg-white/10 accent-[#5fd3ad] rounded-lg cursor-pointer"
            />
            <span className="text-[#5fd3ad] font-mono text-xs w-10 text-right">{val1}%</span>
          </div>
        )}

        {/* 17. VHS TAPE GLITCH */}
        {adjustment === 'glitch_vhs' && (
          <div className="flex flex-col gap-2 bg-[#20222a] p-2.5 rounded-xl border border-white/5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/60 font-mono text-[11px] w-28">Distortion</span>
              <input
                type="range"
                min="0"
                max="100"
                value={val1}
                onChange={(e) => handleUpdate(parseInt(e.target.value), val2, val3)}
                className="flex-1 h-1.5 bg-white/10 accent-[#5fd3ad] rounded-lg cursor-pointer"
              />
              <span className="text-[#5fd3ad] font-mono text-xs w-10 text-right">{val1}%</span>
            </div>
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
              <span className="text-white/60 font-mono text-[11px] w-28">Color Fringing</span>
              <input
                type="range"
                min="0"
                max="100"
                value={val2}
                onChange={(e) => handleUpdate(val1, parseInt(e.target.value), val3)}
                className="flex-1 h-1.5 bg-white/10 accent-pink-500 rounded-lg cursor-pointer"
              />
              <span className="text-pink-400 font-mono text-xs w-10 text-right">{val2}%</span>
            </div>
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
              <span className="text-white/60 font-mono text-[11px] w-28">Wobble & Crease</span>
              <input
                type="range"
                min="0"
                max="100"
                value={val3}
                onChange={(e) => handleUpdate(val1, val2, parseInt(e.target.value))}
                className="flex-1 h-1.5 bg-white/10 accent-amber-500 rounded-lg cursor-pointer"
              />
              <span className="text-amber-400 font-mono text-xs w-10 text-right">{val3}%</span>
            </div>
          </div>
        )}

        {/* 18. LED SCREEN GLITCH */}
        {adjustment === 'glitch_led_screen' && (
          <div className="flex flex-col gap-2 bg-[#20222a] p-2.5 rounded-xl border border-white/5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/60 font-mono text-[11px] w-28">Pixel Cell Size</span>
              <input
                type="range"
                min="5"
                max="100"
                value={val1}
                onChange={(e) => handleUpdate(parseInt(e.target.value), val2, val3)}
                className="flex-1 h-1.5 bg-white/10 accent-[#5fd3ad] rounded-lg cursor-pointer"
              />
              <span className="text-[#5fd3ad] font-mono text-xs w-10 text-right">{val1}%</span>
            </div>
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
              <span className="text-white/60 font-mono text-[11px] w-28">Grid Gap</span>
              <input
                type="range"
                min="0"
                max="100"
                value={val2}
                onChange={(e) => handleUpdate(val1, parseInt(e.target.value), val3)}
                className="flex-1 h-1.5 bg-white/10 accent-pink-500 rounded-lg cursor-pointer"
              />
              <span className="text-pink-400 font-mono text-xs w-10 text-right">{val2}%</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-white/5">
              <span className="text-white/60 font-mono text-[11px]">Sub-Pixel Stripes</span>
              <button
                onClick={() => handleUpdate(val1, val2, val3 === 0 ? 1 : 0)}
                className={`px-2.5 py-0.5 rounded text-xs cursor-pointer ${
                  val3 === 0 ? 'mayan-btn-jade font-bold' : 'mayan-btn-stone'
                }`}
              >
                {val3 === 0 ? 'RGB Phosphor: ON' : 'Uniform Tiles'}
              </button>
            </div>
          </div>
        )}

        {/* 19. THERMAL INFRARED */}
        {adjustment === 'thermal' && (
          <div className="flex flex-col gap-2 bg-[#20222a] p-2.5 rounded-xl border border-white/5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/60 font-mono text-[11px] w-28">Tone Modulation</span>
              <input
                type="range"
                min="0"
                max="100"
                value={val1}
                onChange={(e) => handleUpdate(parseInt(e.target.value), val2, val3)}
                className="flex-1 h-1.5 bg-white/10 accent-[#5fd3ad] rounded-lg cursor-pointer"
              />
              <span className="text-[#5fd3ad] font-mono text-xs w-10 text-right">{val1}%</span>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
              <span className="text-white/60 font-mono text-[11px]">Gradient Preset:</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleUpdate(val1, num, val3)}
                    className={`w-6 h-6 rounded text-xs font-bold cursor-pointer ${
                      (val2 || 3) === num ? 'mayan-btn-jade' : 'mayan-btn-stone'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 20. PIXEL SORT GLITCH (EXPANDED RANGE & ORIGIN CONTROLS) */}
        {adjustment === 'glitch_pixel_sort' && (
          <div className="flex flex-col gap-2.5 bg-[#141a18] p-3 rounded-xl border border-[#2c3532] text-xs">
            {/* Range Controls: Lower & Upper Threshold */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="flex items-center justify-between gap-2 bg-[#0e1312] p-2 rounded-lg border border-[#2c3532]">
                <span className="text-[#e6c699]/80 font-medium text-[11px] w-24">Min Threshold</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={val1}
                  onChange={(e) => handleUpdate(parseInt(e.target.value), val2, val3)}
                  className="flex-1 h-1.5 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                />
                <span className="font-mono text-[#5fd3ad] text-xs w-8 text-right font-bold">{val1}%</span>
              </div>
              <div className="flex items-center justify-between gap-2 bg-[#0e1312] p-2 rounded-lg border border-[#2c3532]">
                <span className="text-[#e6c699]/80 font-medium text-[11px] w-24">Max Threshold</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={pixelSortUpperThresh}
                  onChange={(e) => {
                    const up = parseInt(e.target.value);
                    setPixelSortUpperThresh(up);
                    handleUpdate(val1, val2, val3, {
                      upperThreshold: up,
                      startXOffset: pixelSortStartX,
                      startYOffset: pixelSortStartY,
                      direction: pixelSortDirection,
                      sortMode: pixelSortMode,
                      invert: pixelSortInvert,
                    });
                  }}
                  className="flex-1 h-1.5 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                />
                <span className="font-mono text-[#5fd3ad] text-xs w-8 text-right font-bold">{pixelSortUpperThresh}%</span>
              </div>
            </div>

            {/* Origin Offsets: X & Y Start Coordinates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="flex items-center justify-between gap-2 bg-[#0e1312] p-2 rounded-lg border border-[#2c3532]">
                <span className="text-[#e6c699]/80 font-medium text-[11px] w-24">Origin X (%)</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={pixelSortStartX}
                  onChange={(e) => {
                    const x = parseInt(e.target.value);
                    setPixelSortStartX(x);
                    handleUpdate(val1, val2, val3, {
                      upperThreshold: pixelSortUpperThresh,
                      startXOffset: x,
                      startYOffset: pixelSortStartY,
                      direction: pixelSortDirection,
                      sortMode: pixelSortMode,
                      invert: pixelSortInvert,
                    });
                  }}
                  className="flex-1 h-1.5 bg-white/10 accent-[#b89058] rounded cursor-pointer"
                />
                <span className="font-mono text-[#e6c699] text-xs w-8 text-right">{pixelSortStartX}%</span>
              </div>
              <div className="flex items-center justify-between gap-2 bg-[#0e1312] p-2 rounded-lg border border-[#2c3532]">
                <span className="text-[#e6c699]/80 font-medium text-[11px] w-24">Origin Y (%)</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={pixelSortStartY}
                  onChange={(e) => {
                    const y = parseInt(e.target.value);
                    setPixelSortStartY(y);
                    handleUpdate(val1, val2, val3, {
                      upperThreshold: pixelSortUpperThresh,
                      startXOffset: pixelSortStartX,
                      startYOffset: y,
                      direction: pixelSortDirection,
                      sortMode: pixelSortMode,
                      invert: pixelSortInvert,
                    });
                  }}
                  className="flex-1 h-1.5 bg-white/10 accent-[#b89058] rounded cursor-pointer"
                />
                <span className="font-mono text-[#e6c699] text-xs w-8 text-right">{pixelSortStartY}%</span>
              </div>
            </div>

            {/* Sort Mode, Direction & Invert Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#2c3532]">
              {/* Sort Criterion */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[#9e9484] font-medium">Sort By:</span>
                <div className="flex items-center gap-1">
                  {(['luminance', 'brightness', 'hue', 'saturation', 'intensity'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setPixelSortMode(m);
                        handleUpdate(val1, val2, val3, {
                          upperThreshold: pixelSortUpperThresh,
                          startXOffset: pixelSortStartX,
                          startYOffset: pixelSortStartY,
                          direction: pixelSortDirection,
                          sortMode: m,
                          invert: pixelSortInvert,
                        });
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize cursor-pointer transition ${
                        pixelSortMode === m ? 'mayan-btn-jade' : 'mayan-btn-stone'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Direction & Inversion */}
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-lg bg-[#0e1312] border border-[#2c3532] p-0.5">
                  <button
                    onClick={() => {
                      setPixelSortDirection('horizontal');
                      handleUpdate(val1, val2, val3, {
                        upperThreshold: pixelSortUpperThresh,
                        startXOffset: pixelSortStartX,
                        startYOffset: pixelSortStartY,
                        direction: 'horizontal',
                        sortMode: pixelSortMode,
                        invert: pixelSortInvert,
                      });
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                      pixelSortDirection === 'horizontal' ? 'mayan-btn-jade' : 'text-[#9e9484] hover:text-[#e6c699]'
                    }`}
                  >
                    Horizontal
                  </button>
                  <button
                    onClick={() => {
                      setPixelSortDirection('vertical');
                      handleUpdate(val1, val2, val3, {
                        upperThreshold: pixelSortUpperThresh,
                        startXOffset: pixelSortStartX,
                        startYOffset: pixelSortStartY,
                        direction: 'vertical',
                        sortMode: pixelSortMode,
                        invert: pixelSortInvert,
                      });
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                      pixelSortDirection === 'vertical' ? 'mayan-btn-jade' : 'text-[#9e9484] hover:text-[#e6c699]'
                    }`}
                  >
                    Vertical
                  </button>
                </div>

                <label className="flex items-center gap-1.5 text-[11px] text-[#e6c699] font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pixelSortInvert}
                    onChange={(e) => {
                      const inv = e.target.checked;
                      setPixelSortInvert(inv);
                      handleUpdate(val1, val2, val3, {
                        upperThreshold: pixelSortUpperThresh,
                        startXOffset: pixelSortStartX,
                        startYOffset: pixelSortStartY,
                        direction: pixelSortDirection,
                        sortMode: pixelSortMode,
                        invert: inv,
                      });
                    }}
                    className="accent-[#5fd3ad] rounded cursor-pointer"
                  />
                  <span>Invert</span>
                </label>

                {/* Randomize Seed button */}
                <button
                  onClick={() => {
                    const rnd = Math.floor(Math.random() * 100);
                    handleUpdate(val1, rnd, val3);
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold mayan-btn-stone hover:border-[#5fd3ad] cursor-pointer"
                  title="Randomize pattern origin and jitter seed"
                >
                  🎲 Seed #{val2}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 21. GENERIC FALLBACK FOR ANY REMAINING ADJUSTMENTS */}
        {adjustment !== 'gaussian_blur' &&
          adjustment !== 'noise' &&
          adjustment !== 'hue_saturation' &&
          adjustment !== 'invert' &&
          adjustment !== 'grayscale' &&
          adjustment !== 'curves' &&
          adjustment !== 'halftone' &&
          adjustment !== 'channel_extractor' &&
          adjustment !== 'glitch_rgb_offset' &&
          adjustment !== 'glitch_channel_swap' &&
          adjustment !== 'glitch_pixel_sort' &&
          adjustment !== 'fisheye' &&
          adjustment !== 'perspective_blur' &&
          adjustment !== 'poster_edges' &&
          adjustment !== 'pixelate' &&
          adjustment !== 'threshold' &&
          adjustment !== 'cutout' &&
          adjustment !== 'unsharp_mask' &&
          adjustment !== 'glitch_vhs' &&
          adjustment !== 'glitch_led_screen' &&
          adjustment !== 'thermal' && (
            <div className="flex flex-col gap-2 bg-[#20222a] p-2.5 rounded-xl border border-white/5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-white/60 font-mono text-[11px] w-24">
                  {adjustment.startsWith('glitch') ? 'Intensity' : 'Amount'}
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={val1}
                  onChange={(e) => handleUpdate(parseInt(e.target.value), val2)}
                  className="flex-1 h-2 bg-white/10 accent-[#5fd3ad] rounded-lg cursor-pointer"
                />
                <span className="text-[#5fd3ad] font-mono text-xs w-10 text-right">{val1}%</span>
              </div>

              {(adjustment === 'motion_blur' ||
                adjustment === 'bloom' ||
                adjustment === 'glitch_scanlines') && (
                <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
                  <span className="text-white/60 font-mono text-[11px] w-24">
                    {adjustment === 'motion_blur'
                      ? 'Angle'
                      : adjustment === 'bloom'
                      ? 'Threshold'
                      : 'Spacing'}
                  </span>
                  <input
                    type="range"
                    min="1"
                    max={adjustment === 'motion_blur' ? 180 : 100}
                    value={val2}
                    onChange={(e) => handleUpdate(val1, parseInt(e.target.value))}
                    className="flex-1 h-1.5 bg-white/10 accent-pink-500 rounded-lg cursor-pointer"
                  />
                  <span className="text-pink-400 font-mono text-xs w-10 text-right">
                    {val2}
                    {adjustment === 'motion_blur' ? '°' : ''}
                  </span>
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  );
};
