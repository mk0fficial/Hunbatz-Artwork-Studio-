import React, { useState, useEffect, useRef } from 'react';
import {
  ColorPalette,
  ColorTab,
  HarmonyMode,
} from '../types/canvas';
import {
  DEFAULT_PALETTES,
  HSV,
  hexToHsv,
  hsvToHex,
  hsvToRgb,
  rgbToHex,
  rgbToHsv,
  getHarmonies,
} from '../constants/palettes';
import { Plus, Check, ChevronRight, Pipette } from 'lucide-react';
import { MayanCornerBrackets, MayanKukulkanRing } from './MayanDecorations';

interface ColorStudioProps {
  currentColor: string;
  previousColor: string;
  onChangeColor: (hex: string) => void;
  onClose: () => void;
  onToggleEyedropper?: () => void;
}

export const ColorStudio: React.FC<ColorStudioProps> = ({
  currentColor,
  previousColor,
  onChangeColor,
  onClose,
  onToggleEyedropper,
}) => {
  const [activeTab, setActiveTab] = useState<ColorTab>('disc');
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(currentColor));
  const [harmonyMode, setHarmonyMode] = useState<HarmonyMode>('complementary');
  const [palettes, setPalettes] = useState<ColorPalette[]>(() => {
    try {
      const saved = localStorage.getItem('procreate_pc_palettes');
      return saved ? JSON.parse(saved) : DEFAULT_PALETTES;
    } catch {
      return DEFAULT_PALETTES;
    }
  });

  const discCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const classicCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync HSV when external currentColor changes (e.g. eyedropper)
  useEffect(() => {
    const newHsv = hexToHsv(currentColor);
    setHsv(newHsv);
  }, [currentColor]);

  // Persist palettes
  useEffect(() => {
    try {
      localStorage.setItem('procreate_pc_palettes', JSON.stringify(palettes));
    } catch {}
  }, [palettes]);

  const updateColorFromHsv = (newHsv: HSV) => {
    setHsv(newHsv);
    const hex = hsvToHex(newHsv.h, newHsv.s, newHsv.v);
    onChangeColor(hex);
  };

  // Render DISC
  useEffect(() => {
    if (activeTab !== 'disc') return;
    const canvas = discCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const outerRadius = size / 2 - 4;
    const innerRadius = outerRadius - 20;

    ctx.clearRect(0, 0, size, size);

    // Draw outer hue ring
    for (let angle = 0; angle < 360; angle += 1) {
      const startAngle = (angle - 1) * (Math.PI / 180);
      const endAngle = (angle + 1) * (Math.PI / 180);
      ctx.beginPath();
      ctx.arc(center, center, (outerRadius + innerRadius) / 2, startAngle, endAngle);
      ctx.strokeStyle = `hsl(${angle}, 100%, 50%)`;
      ctx.lineWidth = outerRadius - innerRadius;
      ctx.stroke();
    }

    // Draw inner Saturation/Value triangle/box
    const innerBoxSize = (innerRadius - 8) * 1.35;
    const boxX = center - innerBoxSize / 2;
    const boxY = center - innerBoxSize / 2;

    // Base color from current Hue
    ctx.fillStyle = `hsl(${hsv.h}, 100%, 50%)`;
    ctx.fillRect(boxX, boxY, innerBoxSize, innerBoxSize);

    // Horizontal white-to-transparent gradient (Saturation)
    const whiteGrad = ctx.createLinearGradient(boxX, boxY, boxX + innerBoxSize, boxY);
    whiteGrad.addColorStop(0, '#ffffff');
    whiteGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(boxX, boxY, innerBoxSize, innerBoxSize);

    // Vertical transparent-to-black gradient (Value)
    const blackGrad = ctx.createLinearGradient(boxX, boxY, boxX, boxY + innerBoxSize);
    blackGrad.addColorStop(0, 'rgba(0,0,0,0)');
    blackGrad.addColorStop(1, '#000000');
    ctx.fillStyle = blackGrad;
    ctx.fillRect(boxX, boxY, innerBoxSize, innerBoxSize);

    // Border around inner box
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX, boxY, innerBoxSize, innerBoxSize);

    // Draw Hue ring pin
    const hueRad = (hsv.h * Math.PI) / 180;
    const ringRadius = (outerRadius + innerRadius) / 2;
    const huePinX = center + Math.cos(hueRad) * ringRadius;
    const huePinY = center + Math.sin(hueRad) * ringRadius;

    ctx.beginPath();
    ctx.arc(huePinX, huePinY, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw inner Sat/Val pin
    const satValPinX = boxX + (hsv.s / 100) * innerBoxSize;
    const satValPinY = boxY + (1 - hsv.v / 100) * innerBoxSize;

    ctx.beginPath();
    ctx.arc(satValPinX, satValPinY, 6, 0, Math.PI * 2);
    ctx.fillStyle = currentColor;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [activeTab, hsv, currentColor]);

  // Handle Disc Interactions
  const handleDiscPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = discCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const size = canvas.width;
    const center = size / 2;
    const dx = x - center;
    const dy = y - center;
    const dist = Math.hypot(dx, dy);

    const outerRadius = size / 2 - 4;
    const innerRadius = outerRadius - 20;

    // If clicking on or near the hue ring
    if (dist >= innerRadius - 8) {
      let angle = Math.atan2(dy, dx) * (180 / Math.PI);
      if (angle < 0) angle += 360;
      updateColorFromHsv({ ...hsv, h: Math.round(angle) });
    } else {
      // Inside the sat/val box
      const innerBoxSize = (innerRadius - 8) * 1.35;
      const boxX = center - innerBoxSize / 2;
      const boxY = center - innerBoxSize / 2;

      const normX = Math.max(0, Math.min(innerBoxSize, x - boxX));
      const normY = Math.max(0, Math.min(innerBoxSize, y - boxY));

      const s = Math.round((normX / innerBoxSize) * 100);
      const v = Math.round((1 - normY / innerBoxSize) * 100);

      updateColorFromHsv({ ...hsv, s, v });
    }
  };

  // Add current color to palette
  const handleAddColorToPalette = (paletteId: string, index: number) => {
    setPalettes((prev) =>
      prev.map((pal) => {
        if (pal.id !== paletteId) return pal;
        const newColors = [...pal.colors];
        newColors[index] = currentColor;
        return { ...pal, colors: newColors };
      })
    );
  };

  // Create new palette
  const handleCreatePalette = () => {
    const newPal: ColorPalette = {
      id: `pal_${Date.now()}`,
      name: `Palette ${palettes.length + 1}`,
      colors: Array(30).fill('#24262f'),
    };
    newPal.colors[0] = currentColor;
    setPalettes((prev) => [newPal, ...prev]);
  };

  return (
    <div
      className="absolute top-14 right-4 z-50 w-84 mayan-panel p-4 text-[#e6c699] flex flex-col gap-3 select-none animate-in fade-in zoom-in-95 duration-150 shadow-[0_16px_50px_rgba(0,0,0,0.95)]"
      onClick={(e) => e.stopPropagation()}
    >
      <MayanCornerBrackets size={16} color="#b89058" />

      {/* Top Header: Current Color vs Previous Color Swatch */}
      <div className="flex items-center justify-between pb-2 border-b border-[#2c3532]">
        <span className="text-xs font-mayan font-bold uppercase tracking-wider text-[#b89058]">Colors</span>
        <div className="flex items-center gap-2">
          {onToggleEyedropper && (
            <button
              onClick={() => {
                onToggleEyedropper();
                onClose();
              }}
              title="Pick color from canvas (Eyedropper)"
              className="p-1.5 rounded-lg mayan-btn-stone text-[#e6c699] hover:border-[#b89058] transition-colors cursor-pointer mr-0.5"
            >
              <Pipette size={15} />
            </button>
          )}
          {/* Previous Color */}
          <button
            title="Click to revert to previous color"
            onClick={() => onChangeColor(previousColor)}
            className="w-10 h-7 rounded-md border border-[#2c3532] shadow-inner overflow-hidden cursor-pointer hover:scale-105 transition-transform"
            style={{ backgroundColor: previousColor }}
          />
          {/* Current Color */}
          <div
            title="Current color (Drag onto canvas for ColorDrop!)"
            className="w-12 h-7 rounded-md border-2 border-[#b89058] shadow-[0_0_8px_rgba(184,144,88,0.5),inset_0_0_3px_rgba(0,0,0,0.8)] overflow-hidden cursor-grab active:cursor-grabbing hover:scale-105 transition-transform"
            style={{ backgroundColor: currentColor }}
          />
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="min-h-[260px] flex flex-col justify-center items-center">
        {/* DISC VIEW with Kukulkan Feathered Serpent Ring Frame */}
        {activeTab === 'disc' && (
          <div className="relative flex justify-center items-center py-2">
            <MayanKukulkanRing size={260} className="absolute inset-0 m-auto" />
            <canvas
              ref={discCanvasRef}
              width={240}
              height={240}
              onPointerDown={handleDiscPointer}
              onPointerMove={(e) => {
                if (e.buttons === 1) handleDiscPointer(e);
              }}
              className="cursor-crosshair rounded-full touch-none relative z-10"
            />
          </div>
        )}

        {/* CLASSIC VIEW */}
        {activeTab === 'classic' && (
          <div className="w-full flex flex-col gap-3">
            {/* 2D Sat/Val Grid */}
            <div
              className="relative w-full h-44 rounded-xl overflow-hidden cursor-crosshair border border-white/10"
              style={{ backgroundColor: `hsl(${hsv.h}, 100%, 50%)` }}
              onPointerDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const s = Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
                const v = Math.round(Math.max(0, Math.min(100, (1 - (e.clientY - rect.top) / rect.height) * 100)));
                updateColorFromHsv({ ...hsv, s, v });
              }}
              onPointerMove={(e) => {
                if (e.buttons === 1) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const s = Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
                  const v = Math.round(Math.max(0, Math.min(100, (1 - (e.clientY - rect.top) / rect.height) * 100)));
                  updateColorFromHsv({ ...hsv, s, v });
                }
              }}
            >
              {/* Horizontal white gradient */}
              <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
              {/* Vertical black gradient */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black" />
              {/* Crosshair indicator */}
              <div
                className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${hsv.s}%`,
                  top: `${100 - hsv.v}%`,
                  backgroundColor: currentColor,
                }}
              />
            </div>

            {/* Hue Slider */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-white/50 uppercase tracking-wider">Hue ({hsv.h}°)</span>
              <input
                type="range"
                min="0"
                max="360"
                value={hsv.h}
                onChange={(e) => updateColorFromHsv({ ...hsv, h: parseInt(e.target.value) })}
                className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                style={{
                  background:
                    'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                }}
              />
            </div>
          </div>
        )}

        {/* HARMONY VIEW */}
        {activeTab === 'harmony' && (
          <div className="w-full flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/60">Harmony Scheme:</span>
              <select
                value={harmonyMode}
                onChange={(e) => setHarmonyMode(e.target.value as HarmonyMode)}
                className="bg-[#242730] border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
              >
                <option value="complementary">Complementary</option>
                <option value="split">Split Complementary</option>
                <option value="triadic">Triadic</option>
                <option value="tetradic">Tetradic</option>
                <option value="analogous">Analogous</option>
              </select>
            </div>

            {/* Harmony Swatches */}
            <div className="flex items-center justify-center gap-3 py-4">
              {/* Base Color */}
              <div className="flex flex-col items-center gap-1">
                <button
                  className="w-12 h-12 rounded-xl border-2 border-white shadow-lg cursor-pointer"
                  style={{ backgroundColor: currentColor }}
                />
                <span className="text-[10px] text-white/70">Base</span>
              </div>

              {/* Complementary & Harmony Colors */}
              {getHarmonies(hsv, harmonyMode).map((harmHex, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => onChangeColor(harmHex)}
                    className="w-10 h-10 rounded-xl border border-white/20 shadow-md hover:scale-105 transition-transform cursor-pointer"
                    style={{ backgroundColor: harmHex }}
                  />
                  <span className="text-[10px] text-white/40">#{i + 1}</span>
                </div>
              ))}
            </div>

            {/* Quick Hue adjuster */}
            <input
              type="range"
              min="0"
              max="360"
              value={hsv.h}
              onChange={(e) => updateColorFromHsv({ ...hsv, h: parseInt(e.target.value) })}
              className="w-full h-3 rounded-lg appearance-none cursor-pointer"
              style={{
                background:
                  'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
              }}
            />
          </div>
        )}

        {/* VALUE VIEW */}
        {activeTab === 'value' && (
          <div className="w-full flex flex-col gap-2.5 text-xs">
            {/* Hex Input */}
            <div className="flex items-center justify-between bg-[#20222a] px-3 py-1.5 rounded-lg border border-white/10">
              <span className="text-white/50 font-mono text-[11px]">HEX</span>
              <input
                type="text"
                value={currentColor}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                    onChangeColor(val);
                  }
                }}
                className="bg-transparent text-right font-mono text-xs uppercase tracking-wider text-white focus:outline-none w-24"
              />
            </div>

            {/* RGB Sliders */}
            {(() => {
              const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
              return (
                <div className="flex flex-col gap-2 pt-1 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-red-400 font-mono">R: {rgb.r}</span>
                    <input
                      type="range"
                      min="0"
                      max="255"
                      value={rgb.r}
                      onChange={(e) => {
                        const newRgb = { ...rgb, r: parseInt(e.target.value) };
                        const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
                        onChangeColor(newHex);
                      }}
                      className="w-40 h-1.5 bg-red-950/50 accent-red-500 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-green-400 font-mono">G: {rgb.g}</span>
                    <input
                      type="range"
                      min="0"
                      max="255"
                      value={rgb.g}
                      onChange={(e) => {
                        const newRgb = { ...rgb, g: parseInt(e.target.value) };
                        const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
                        onChangeColor(newHex);
                      }}
                      className="w-40 h-1.5 bg-green-950/50 accent-green-500 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-400 font-mono">B: {rgb.b}</span>
                    <input
                      type="range"
                      min="0"
                      max="255"
                      value={rgb.b}
                      onChange={(e) => {
                        const newRgb = { ...rgb, b: parseInt(e.target.value) };
                        const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
                        onChangeColor(newHex);
                      }}
                      className="w-40 h-1.5 bg-blue-950/50 accent-blue-500 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              );
            })()}

            {/* HSV Sliders */}
            <div className="flex flex-col gap-2 pt-1 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-white/60 font-mono">H: {hsv.h}°</span>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={hsv.h}
                  onChange={(e) => updateColorFromHsv({ ...hsv, h: parseInt(e.target.value) })}
                  className="w-40 h-1.5 bg-white/10 accent-blue-500 rounded-lg cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60 font-mono">S: {hsv.s}%</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={hsv.s}
                  onChange={(e) => updateColorFromHsv({ ...hsv, s: parseInt(e.target.value) })}
                  className="w-40 h-1.5 bg-white/10 accent-blue-500 rounded-lg cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60 font-mono">V: {hsv.v}%</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={hsv.v}
                  onChange={(e) => updateColorFromHsv({ ...hsv, v: parseInt(e.target.value) })}
                  className="w-40 h-1.5 bg-white/10 accent-blue-500 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* PALETTES VIEW */}
        {activeTab === 'palettes' && (
          <div className="w-full flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/70">Palettes</span>
              <button
                onClick={handleCreatePalette}
                className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
              >
                <Plus size={14} /> New Palette
              </button>
            </div>

            {palettes.map((pal) => (
              <div key={pal.id} className="bg-[#1f2129] p-2.5 rounded-xl border border-white/5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white/80">{pal.name}</span>
                  {pal.isDefault && (
                    <span className="text-[10px] text-white/40 uppercase tracking-wider">Default</span>
                  )}
                </div>

                {/* Swatches Grid (6 columns x 5 rows) */}
                <div className="grid grid-cols-6 gap-1.5">
                  {pal.colors.map((c, idx) => (
                    <button
                      key={idx}
                      onClick={() => onChangeColor(c)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        handleAddColorToPalette(pal.id, idx);
                      }}
                      title={`${c} (Right-click to store current color)`}
                      className="w-9 h-7 rounded-md border border-white/10 hover:scale-110 active:scale-95 transition-transform cursor-pointer relative group"
                      style={{ backgroundColor: c }}
                    >
                      {c.toLowerCase() === currentColor.toLowerCase() && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Check size={12} className="text-white drop-shadow-md" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Segmented Tabs (Disc, Classic, Harmony, Value, Palettes) */}
      <div className="grid grid-cols-5 mayan-well p-1 rounded-xl border border-[#2a302d] text-[11px] font-medium text-[#9e9484]">
        {(['disc', 'classic', 'harmony', 'value', 'palettes'] as ColorTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-1.5 capitalize rounded-lg transition-all cursor-pointer font-medium ${
              activeTab === tab
                ? 'mayan-btn-jade text-[#f2fbf7] font-semibold shadow-sm'
                : 'hover:text-[#e6c699] hover:bg-white/5'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
};
