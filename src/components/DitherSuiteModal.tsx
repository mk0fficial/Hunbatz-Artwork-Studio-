import React, { useState, useEffect, useRef } from 'react';
import { X, Check, RotateCcw, Shuffle, Layers, Palette, Eye, Sliders } from 'lucide-react';
import { MayanCornerBrackets } from './MayanDecorations';
import {
  DitherAlgorithm,
  DITHER_ALGORITHM_LABELS,
  BUILTIN_PALETTES,
  MACPAINT_38_PATTERNS,
  HalftoneInkChannel,
  applyIndexedDither,
  applyMacPaintDither,
  applyCmykHalftoneScreen,
  applySignalModulation,
} from '../utils/ditherEngine';

interface DitherSuiteModalProps {
  sourceCanvas: HTMLCanvasElement;
  onPreview: (previewCanvas: HTMLCanvasElement) => void;
  onApply: (finalCanvas: HTMLCanvasElement, config?: any) => void;
  onCancel: () => void;
}

export const DitherSuiteModal: React.FC<DitherSuiteModalProps> = ({
  sourceCanvas,
  onPreview,
  onApply,
  onCancel,
}) => {
  const [activeTab, setActiveTab] = useState<'indexed' | 'macpaint' | 'halftone' | 'modulation'>('indexed');

  // --- TAB 1: INDEXED & ERROR-DIFFUSION DITHER STATE ---
  const [algorithm, setAlgorithm] = useState<DitherAlgorithm>('floyd_steinberg');
  const [paletteMode, setPaletteMode] = useState<string>('adaptive');
  const [customColors, setCustomColors] = useState<string[]>([
    '#000000', '#ffffff', '#5fd3ad', '#b89058', '#38bdf8', '#f43f5e'
  ]);
  const [colorCount, setColorCount] = useState<number>(18);
  const [distanceMode, setDistanceMode] = useState<1 | 2 | 3>(2);
  const [ditherStrength, setDitherStrength] = useState<number>(1.0);
  const [gamma, setGamma] = useState<number>(1.0);
  const [pixelStep, setPixelStep] = useState<number>(2);

  // --- TAB 2: MACPAINT 1-BIT DITHER STATE ---
  const [bitmapWidth, setBitmapWidth] = useState<number>(1024);
  const [threshold, setThreshold] = useState<number>(0.354);
  const [contrast, setContrast] = useState<number>(2.50);
  const [grain, setGrain] = useState<number>(0.00);
  const [smooth, setSmooth] = useState<number>(1);
  const [sharpen, setSharpen] = useState<number>(-0.83);
  const [radius, setRadius] = useState<number>(1.2);
  const [inkColor, setInkColor] = useState<string>('#000000');
  const [paperColor, setPaperColor] = useState<string>('#ffffff');
  const [transparentPaper, setTransparentPaper] = useState<boolean>(false);
  const [activePatterns, setActivePatterns] = useState<number[]>([
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 21, 24, 28, 30, 33, 37
  ]);

  // --- TAB 3: CMYK HALFTONE SCREEN PRESS STATE ---
  const [screenShape, setScreenShape] = useState<'round' | 'square' | 'diamond' | 'cross_hatch' | 'line'>('round');
  const [frequency, setFrequency] = useState<number>(161);
  const [halftonePaperColor, setHalftonePaperColor] = useState<string>('#ffffff');
  const [blackGeneration, setBlackGeneration] = useState<number>(0.50);
  const [totalInk, setTotalInk] = useState<number>(300);
  const [dotGain, setDotGain] = useState<number>(0.05);
  const [inkDensity, setInkDensity] = useState<number>(1.00);
  const [edgeRoughness, setEdgeRoughness] = useState<number>(0.30);
  const [seed, setSeed] = useState<number>(0);
  const [inks, setInks] = useState<HalftoneInkChannel[]>([
    { enabled: true, color: '#00ffff', angle: 15, shiftX: 0, shiftY: 0 },
    { enabled: true, color: '#ff00ff', angle: 75, shiftX: 0, shiftY: 0 },
    { enabled: true, color: '#ffff00', angle: 0, shiftX: 0, shiftY: 0 },
    { enabled: true, color: '#000000', angle: 45, shiftX: 0, shiftY: 0 },
  ]);

  // --- TAB 4: FM / CRT SIGNAL MODULATION STATE ---
  const [modResolution, setModResolution] = useState<number>(2048);
  const [waveScale, setWaveScale] = useState<number>(60);
  const [fmSensitivity, setFmSensitivity] = useState<number>(1.00);
  const [signalStrength, setSignalStrength] = useState<number>(0.1);
  const [waveDirection, setWaveDirection] = useState<number>(0); // 0=V, 1=H, 2=Diag
  const [phase, setPhase] = useState<number>(0.00);
  const [lineWidth, setLineWidth] = useState<number>(1.89);
  const [redChannel, setRedChannel] = useState<boolean>(true);
  const [greenChannel, setGreenChannel] = useState<boolean>(true);
  const [blueChannel, setBlueChannel] = useState<boolean>(true);

  // Render preview canvas
  const lastRenderRef = useRef<HTMLCanvasElement | null>(null);

  const updatePreview = () => {
    let result: HTMLCanvasElement;

    if (activeTab === 'indexed') {
      result = applyIndexedDither(sourceCanvas, {
        algorithm,
        paletteColors: paletteMode === 'custom' ? customColors : undefined,
        paletteMode,
        colorCount,
        distanceMode,
        ditherStrength,
        gamma,
        pixelStep,
      });
    } else if (activeTab === 'macpaint') {
      result = applyMacPaintDither(sourceCanvas, {
        bitmapWidth,
        threshold,
        contrast,
        grain,
        smooth,
        sharpen,
        radius,
        inkColor,
        paperColor,
        transparentPaper,
        activePatterns,
      });
    } else if (activeTab === 'halftone') {
      result = applyCmykHalftoneScreen(sourceCanvas, {
        screenShape,
        frequency,
        paperColor: halftonePaperColor,
        blackGeneration,
        totalInk,
        dotGain,
        inkDensity,
        edgeRoughness,
        seed,
        inks,
      });
    } else {
      result = applySignalModulation(sourceCanvas, {
        resolution: modResolution,
        waveScale,
        fmSensitivity,
        signalStrength,
        waveDirection,
        phase,
        lineWidth,
        redChannel,
        greenChannel,
        blueChannel,
      });
    }

    lastRenderRef.current = result;
    onPreview(result);
  };

  useEffect(() => {
    updatePreview();
  }, [
    activeTab,
    algorithm,
    paletteMode,
    customColors,
    colorCount,
    distanceMode,
    ditherStrength,
    gamma,
    pixelStep,
    bitmapWidth,
    threshold,
    contrast,
    grain,
    smooth,
    sharpen,
    radius,
    inkColor,
    paperColor,
    transparentPaper,
    activePatterns,
    screenShape,
    frequency,
    halftonePaperColor,
    blackGeneration,
    totalInk,
    dotGain,
    inkDensity,
    edgeRoughness,
    seed,
    inks,
    modResolution,
    waveScale,
    fmSensitivity,
    signalStrength,
    waveDirection,
    phase,
    lineWidth,
    redChannel,
    greenChannel,
    blueChannel,
  ]);

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 w-96 mayan-panel border-l-2 border-[#2c3532] shadow-2xl p-4 text-[#e6c699] flex flex-col justify-between select-none animate-in slide-in-from-right duration-200"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <MayanCornerBrackets size={16} color="#b89058" />

      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-[#2c3532]">
          <div className="flex items-center gap-2">
            <span className="font-mayan font-bold text-xs uppercase tracking-wider text-[#b89058]">
              Dither Suite Studio
            </span>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#164435] text-[#5fd3ad] font-bold">
              LIVE
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const targetCanvas = lastRenderRef.current || sourceCanvas;
                const currentConfig = {
                  tab: activeTab,
                  indexed: {
                    algorithm,
                    paletteColors: paletteMode === 'custom' ? customColors : undefined,
                    paletteMode,
                    colorCount,
                    distanceMode,
                    ditherStrength,
                    gamma,
                    pixelStep,
                  },
                  macpaint: {
                    bitmapWidth,
                    threshold,
                    contrast,
                    grain,
                    smooth,
                    sharpen,
                    radius,
                    inkColor,
                    paperColor,
                    transparentPaper,
                    activePatterns,
                  },
                  halftone: {
                    shape: screenShape,
                    frequency,
                    paperColor: halftonePaperColor,
                    blackGeneration,
                    totalInk,
                    dotGain,
                    inkDensity,
                    edgeRoughness,
                    seed,
                    inks,
                  },
                  modulation: {
                    modResolution,
                    waveScale,
                    fmSensitivity,
                    signalStrength,
                    waveDirection,
                    phase,
                    lineWidth,
                    channels: { r: redChannel, g: greenChannel, b: blueChannel },
                  },
                };
                onApply(targetCanvas, currentConfig);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Apply Dither Effect to Active Layer"
              className="px-2.5 py-1 rounded-lg mayan-btn-jade text-white text-xs font-semibold flex items-center gap-1 shadow-sm cursor-pointer"
            >
              <Check size={12} />
              <span>Apply</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Cancel and discard preview"
              className="w-7 h-7 rounded-lg mayan-btn-stone flex items-center justify-center text-xs text-[#9e9484] hover:text-white cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* 4 Tabs */}
        <div className="grid grid-cols-4 gap-1 pt-3 pb-2 border-b border-[#2c3532]/60 text-[10px] font-semibold">
          {[
            { id: 'indexed', label: 'Dither' },
            { id: 'macpaint', label: 'MacPaint' },
            { id: 'halftone', label: 'Halftone' },
            { id: 'modulation', label: 'Modulation' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-1.5 rounded-lg text-center cursor-pointer transition ${
                activeTab === tab.id ? 'mayan-btn-jade text-white font-bold' : 'mayan-btn-stone text-[#e6c699]/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Controls Body */}
      <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1 text-xs">
        {/* --- TAB 1: INDEXED & ERROR-DIFFUSION DITHER --- */}
        {activeTab === 'indexed' && (
          <div className="space-y-3">
            {/* Algorithm Selector */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-[#e6c699]/70">Algorithm / Pattern Type:</span>
              <select
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value as DitherAlgorithm)}
                className="bg-[#101413] border border-[#2c3532] text-[#e6c699] text-xs rounded-lg px-2.5 py-1.5 cursor-pointer outline-none"
              >
                {Object.entries(DITHER_ALGORITHM_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Palette Mode */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-[#e6c699]/70">Palette Mode:</span>
              <select
                value={paletteMode}
                onChange={(e) => setPaletteMode(e.target.value)}
                className="bg-[#101413] border border-[#2c3532] text-[#e6c699] text-xs rounded-lg px-2.5 py-1.5 cursor-pointer outline-none"
              >
                {Object.entries(BUILTIN_PALETTES).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Interactive Swatch Grid */}
            <div className="flex flex-col gap-1.5 bg-[#090c0b] p-2.5 rounded-xl border border-[#2c3532]">
              <div className="flex items-center justify-between text-[10px] text-white/60">
                <span>Active Palette Swatches ({paletteMode === 'custom' ? customColors.length : colorCount})</span>
                {paletteMode === 'custom' && (
                  <button
                    onClick={() => setCustomColors([...customColors, '#ffffff'])}
                    className="text-[#5fd3ad] hover:underline cursor-pointer"
                  >
                    + Add Color
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {(paletteMode === 'custom' ? customColors : (BUILTIN_PALETTES[paletteMode]?.colors.length > 0 ? BUILTIN_PALETTES[paletteMode].colors : customColors)).map((hex, i) => (
                  <div key={i} className="relative group w-5 h-5 rounded border border-white/20 overflow-hidden">
                    <input
                      type="color"
                      value={hex}
                      disabled={paletteMode !== 'custom'}
                      onChange={(e) => {
                        const next = [...customColors];
                        next[i] = e.target.value;
                        setCustomColors(next);
                      }}
                      className="absolute inset-0 w-8 h-8 -top-1.5 -left-1.5 cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Color Count Slider (for Adaptive mode) */}
            {paletteMode === 'adaptive' && (
              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between text-[10px] text-white/60">
                  <span>Color Count</span>
                  <span className="font-mono text-[#5fd3ad]">{colorCount}</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={32}
                  value={colorCount}
                  onChange={(e) => setColorCount(Number(e.target.value))}
                  className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                />
              </div>
            )}

            {/* Distance Mode */}
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-[10px] text-[#e6c699]/70">Distance Metric:</span>
              <div className="flex gap-1">
                {[
                  { id: 1, label: 'Euclidean' },
                  { id: 2, label: 'Redmean' },
                  { id: 3, label: 'Luma' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setDistanceMode(m.id as any)}
                    className={`px-2 py-0.5 rounded text-[10px] cursor-pointer transition ${
                      distanceMode === m.id ? 'mayan-btn-jade font-bold' : 'mayan-btn-stone'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dither Strength */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between text-[10px] text-white/60">
                <span>Dither Strength</span>
                <span className="font-mono text-[#5fd3ad]">{ditherStrength.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={200}
                value={Math.round(ditherStrength * 100)}
                onChange={(e) => setDitherStrength(Number(e.target.value) / 100)}
                className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
              />
            </div>

            {/* Gamma */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between text-[10px] text-white/60">
                <span>Gamma Correction</span>
                <span className="font-mono text-[#5fd3ad]">{gamma.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={20}
                max={300}
                value={Math.round(gamma * 100)}
                onChange={(e) => setGamma(Number(e.target.value) / 100)}
                className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
              />
            </div>

            {/* Pixel Step / Scale */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between text-[10px] text-white/60">
                <span>Pixel Scale (Step)</span>
                <span className="font-mono text-[#5fd3ad]">{pixelStep}px</span>
              </div>
              <input
                type="range"
                min={1}
                max={16}
                value={pixelStep}
                onChange={(e) => setPixelStep(Number(e.target.value))}
                className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* --- TAB 2: MACPAINT 1-BIT DITHER --- */}
        {activeTab === 'macpaint' && (
          <div className="space-y-3">
            {/* 38 Classic Patterns Grid */}
            <div className="flex flex-col gap-1.5 bg-[#090c0b] p-2 rounded-xl border border-[#2c3532]">
              <div className="flex items-center justify-between text-[10px] text-white/60">
                <span>MacPaint 8×8 Bit-Patterns (38)</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      const shuffled = [...Array(38).keys()].sort(() => Math.random() - 0.5).slice(0, 12);
                      setActivePatterns(shuffled);
                    }}
                    title="Shuffle Pattern Ramp"
                    className="p-1 rounded hover:bg-white/10 text-white/80 cursor-pointer"
                  >
                    <Shuffle size={11} />
                  </button>
                  <button
                    onClick={() => setActivePatterns([0, 1, 2, 3, 5, 6, 7, 8])}
                    title="Reset to Default Ramp"
                    className="p-1 rounded hover:bg-white/10 text-white/80 cursor-pointer"
                  >
                    <RotateCcw size={11} />
                  </button>
                </div>
              </div>

              {/* 38 Tiles Visual Grid */}
              <div className="grid grid-cols-8 gap-1 p-1 max-h-32 overflow-y-auto">
                {MACPAINT_38_PATTERNS.map((pat, idx) => {
                  const isActive = activePatterns.includes(idx);
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setActivePatterns((prev) =>
                          prev.includes(idx) ? prev.filter((p) => p !== idx) : [...prev, idx]
                        );
                      }}
                      className={`w-7 h-7 rounded border cursor-pointer relative overflow-hidden transition ${
                        isActive ? 'border-[#5fd3ad] ring-1 ring-[#5fd3ad]' : 'border-white/20 opacity-40 hover:opacity-80'
                      }`}
                      style={{
                        backgroundColor: '#ffffff',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath fill='%23000' d='${pat
                          .map((b, y) =>
                            [0, 1, 2, 3, 4, 5, 6, 7]
                              .filter((x) => ((b >> (7 - x)) & 1) === 1)
                              .map((x) => `M${x},${y}h1v1h-1z`)
                              .join('')
                          )
                          .join('')}'/%3E%3C/svg%3E")`,
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Bitmap Width */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between text-[10px] text-white/60">
                <span>Bitmap Width</span>
                <span className="font-mono text-[#5fd3ad]">{bitmapWidth}px</span>
              </div>
              <input
                type="range"
                min={128}
                max={3000}
                value={bitmapWidth}
                onChange={(e) => setBitmapWidth(Number(e.target.value))}
                className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
              />
            </div>

            {/* Threshold */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between text-[10px] text-white/60">
                <span>Threshold</span>
                <span className="font-mono text-[#5fd3ad]">{threshold.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1000}
                value={Math.round(threshold * 1000)}
                onChange={(e) => setThreshold(Number(e.target.value) / 1000)}
                className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
              />
            </div>

            {/* Contrast */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between text-[10px] text-white/60">
                <span>Contrast</span>
                <span className="font-mono text-[#5fd3ad]">{contrast.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={10}
                max={500}
                value={Math.round(contrast * 100)}
                onChange={(e) => setContrast(Number(e.target.value) / 100)}
                className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
              />
            </div>

            {/* Grain */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between text-[10px] text-white/60">
                <span>Grain</span>
                <span className="font-mono text-[#5fd3ad]">{grain.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(grain * 100)}
                onChange={(e) => setGrain(Number(e.target.value) / 100)}
                className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
              />
            </div>

            {/* Sharpen */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between text-[10px] text-white/60">
                <span>Sharpen</span>
                <span className="font-mono text-[#5fd3ad]">{sharpen.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={-200}
                max={200}
                value={Math.round(sharpen * 100)}
                onChange={(e) => setSharpen(Number(e.target.value) / 100)}
                className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
              />
            </div>

            {/* Ink & Paper Colors */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#2c3532]">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/60">Ink:</span>
                <input
                  type="color"
                  value={inkColor}
                  onChange={(e) => setInkColor(e.target.value)}
                  className="w-6 h-6 rounded border border-white/20 bg-transparent cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/60">Paper:</span>
                <input
                  type="color"
                  value={paperColor}
                  onChange={(e) => setPaperColor(e.target.value)}
                  className="w-6 h-6 rounded border border-white/20 bg-transparent cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 3: CMYK HALFTONE SCREEN PRESS --- */}
        {activeTab === 'halftone' && (
          <div className="space-y-3">
            {/* Screen Shape */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[10px] text-[#e6c699]/70">Screen Shape:</span>
              <div className="flex gap-1">
                {(['round', 'square', 'diamond', 'cross_hatch', 'line'] as const).map((sh) => (
                  <button
                    key={sh}
                    onClick={() => setScreenShape(sh)}
                    className={`px-2 py-0.5 rounded text-[10px] capitalize cursor-pointer transition ${
                      screenShape === sh ? 'mayan-btn-jade font-bold' : 'mayan-btn-stone'
                    }`}
                  >
                    {sh.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Frequency */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between text-[10px] text-white/60">
                <span>Frequency (LPI)</span>
                <span className="font-mono text-[#5fd3ad]">{frequency}</span>
              </div>
              <input
                type="range"
                min={10}
                max={300}
                value={frequency}
                onChange={(e) => setFrequency(Number(e.target.value))}
                className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
              />
            </div>

            {/* SEPARATION Accordion */}
            <div className="p-2.5 rounded-xl bg-[#090c0b] border border-[#2c3532] space-y-2">
              <span className="text-[10px] font-mayan font-bold text-[#b89058] uppercase">
                Separation
              </span>
              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between text-[10px] text-white/60">
                  <span>Black Generation</span>
                  <span className="font-mono text-[#5fd3ad]">{blackGeneration.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(blackGeneration * 100)}
                  onChange={(e) => setBlackGeneration(Number(e.target.value) / 100)}
                  className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between text-[10px] text-white/60">
                  <span>Total Ink</span>
                  <span className="font-mono text-[#5fd3ad]">{totalInk}</span>
                </div>
                <input
                  type="range"
                  min={100}
                  max={400}
                  value={totalInk}
                  onChange={(e) => setTotalInk(Number(e.target.value))}
                  className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                />
              </div>
            </div>

            {/* PRESS Accordion */}
            <div className="p-2.5 rounded-xl bg-[#090c0b] border border-[#2c3532] space-y-2">
              <span className="text-[10px] font-mayan font-bold text-[#b89058] uppercase">
                Press Properties
              </span>
              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between text-[10px] text-white/60">
                  <span>Dot Gain</span>
                  <span className="font-mono text-[#5fd3ad]">{dotGain.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={Math.round(dotGain * 100)}
                  onChange={(e) => setDotGain(Number(e.target.value) / 100)}
                  className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between text-[10px] text-white/60">
                  <span>Ink Density</span>
                  <span className="font-mono text-[#5fd3ad]">{inkDensity.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={Math.round(inkDensity * 100)}
                  onChange={(e) => setInkDensity(Number(e.target.value) / 100)}
                  className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
                />
              </div>
            </div>

            {/* 4 INK Channels with 2D Shift Pad */}
            <div className="space-y-2">
              <span className="text-[10px] font-mayan font-bold text-[#b89058] uppercase">
                Ink Channels (1 - 4)
              </span>
              {inks.map((ink, i) => (
                <div key={i} className="p-2 rounded-xl bg-[#0e1211] border border-[#2c3532] space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[10px] text-[#e6c699]">INK {i + 1}</span>
                    <button
                      onClick={() => {
                        const next = [...inks];
                        next[i].enabled = !next[i].enabled;
                        setInks(next);
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                        ink.enabled ? 'mayan-btn-jade text-white' : 'mayan-btn-stone opacity-50'
                      }`}
                    >
                      {ink.enabled ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-white/60">Color:</span>
                      <input
                        type="color"
                        value={ink.color}
                        onChange={(e) => {
                          const next = [...inks];
                          next[i].color = e.target.value;
                          setInks(next);
                        }}
                        className="w-5 h-5 rounded border border-white/20 bg-transparent cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-white/60">Angle:</span>
                      <input
                        type="number"
                        value={ink.angle}
                        onChange={(e) => {
                          const next = [...inks];
                          next[i].angle = Number(e.target.value);
                          setInks(next);
                        }}
                        className="w-12 bg-black/40 border border-[#2c3532] text-[10px] rounded px-1 text-center font-mono"
                      />
                      <span className="text-[10px] text-white/40">°</span>
                    </div>
                  </div>

                  {/* 2D XY Misregistration Shift Pad */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                    <span className="text-[10px] text-white/50">Shift XY ({ink.shiftX.toFixed(2)}, {ink.shiftY.toFixed(2)})</span>
                    <div
                      className="w-12 h-12 rounded bg-black/60 border border-[#2c3532] relative cursor-crosshair"
                      onPointerDown={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = Math.max(-2, Math.min(2, ((e.clientX - rect.left) / rect.width - 0.5) * 4));
                        const y = Math.max(-2, Math.min(2, ((e.clientY - rect.top) / rect.height - 0.5) * 4));
                        const next = [...inks];
                        next[i].shiftX = Number(x.toFixed(2));
                        next[i].shiftY = Number(y.toFixed(2));
                        setInks(next);
                      }}
                    >
                      <div
                        className="absolute w-2 h-2 rounded-full bg-[#5fd3ad] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                        style={{
                          left: `${((ink.shiftX / 4) + 0.5) * 100}%`,
                          top: `${((ink.shiftY / 4) + 0.5) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- TAB 4: FM / CRT SIGNAL MODULATION --- */}
        {activeTab === 'modulation' && (
          <div className="space-y-3">
            {/* Resolution */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between text-[10px] text-white/60">
                <span>Resolution</span>
                <span className="font-mono text-[#5fd3ad]">{modResolution}</span>
              </div>
              <input
                type="range"
                min={128}
                max={2048}
                value={modResolution}
                onChange={(e) => setModResolution(Number(e.target.value))}
                className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
              />
            </div>

            {/* Wave Scale */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between text-[10px] text-white/60">
                <span>Wave Scale</span>
                <span className="font-mono text-[#5fd3ad]">{waveScale}</span>
              </div>
              <input
                type="range"
                min={10}
                max={400}
                value={waveScale}
                onChange={(e) => setWaveScale(Number(e.target.value))}
                className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
              />
            </div>

            {/* FM Sensitivity */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between text-[10px] text-white/60">
                <span>FM Sensitivity</span>
                <span className="font-mono text-[#5fd3ad]">{fmSensitivity.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={200}
                value={Math.round(fmSensitivity * 100)}
                onChange={(e) => setFmSensitivity(Number(e.target.value) / 100)}
                className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
              />
            </div>

            {/* Signal Strength */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between text-[10px] text-white/60">
                <span>Signal Strength</span>
                <span className="font-mono text-[#5fd3ad]">{signalStrength.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={Math.round(signalStrength * 10)}
                onChange={(e) => setSignalStrength(Number(e.target.value) / 10)}
                className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
              />
            </div>

            {/* Wave Direction */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[10px] text-[#e6c699]/70">Wave Direction:</span>
              <div className="flex gap-1">
                {[
                  { id: 0, label: 'Vertical' },
                  { id: 1, label: 'Horizontal' },
                  { id: 2, label: 'Diagonal' },
                ].map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setWaveDirection(d.id)}
                    className={`px-2 py-0.5 rounded text-[10px] cursor-pointer transition ${
                      waveDirection === d.id ? 'mayan-btn-jade font-bold' : 'mayan-btn-stone'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Phase */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between text-[10px] text-white/60">
                <span>Phase</span>
                <span className="font-mono text-[#5fd3ad]">{phase.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1000}
                value={Math.round(phase * 100)}
                onChange={(e) => setPhase(Number(e.target.value) / 100)}
                className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
              />
            </div>

            {/* Line Width */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between text-[10px] text-white/60">
                <span>Line Width</span>
                <span className="font-mono text-[#5fd3ad]">{lineWidth.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={50}
                max={1000}
                value={Math.round(lineWidth * 100)}
                onChange={(e) => setLineWidth(Number(e.target.value) / 100)}
                className="w-full h-1 bg-white/10 accent-[#5fd3ad] rounded cursor-pointer"
              />
            </div>

            {/* Channel Toggles (R, G, B) */}
            <div className="flex items-center justify-between pt-1 border-t border-[#2c3532]">
              <span className="text-[10px] text-white/60">Channels:</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setRedChannel(!redChannel)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                    redChannel ? 'bg-red-900/60 text-red-200 border border-red-500' : 'bg-black/30 text-white/40 border border-transparent'
                  }`}
                >
                  RED
                </button>
                <button
                  onClick={() => setGreenChannel(!greenChannel)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                    greenChannel ? 'bg-green-900/60 text-green-200 border border-green-500' : 'bg-black/30 text-white/40 border border-transparent'
                  }`}
                >
                  GREEN
                </button>
                <button
                  onClick={() => setBlueChannel(!blueChannel)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                    blueChannel ? 'bg-blue-900/60 text-blue-200 border border-blue-500' : 'bg-black/30 text-white/40 border border-transparent'
                  }`}
                >
                  BLUE
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
