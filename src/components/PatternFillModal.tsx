import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Upload, Check, Grid, Sparkles, Image as ImageIcon, Trash2 } from 'lucide-react';
import { createPatternCanvas } from '../utils/layerEffectsEngine';
import {
  getAllKritaPatterns,
  getKritaPatternCanvas,
  registerCustomKritaPattern,
  deleteCustomKritaPattern,
  KritaPatternDef,
} from '../utils/brushEngine';
import { fetchLocalTextures } from '../services/localContentService';
import { MayanCornerBrackets } from './MayanDecorations';

interface PatternFillModalProps {
  currentColor: string;
  onApplyPattern: (patternType: string, scale: number, customDataUrl?: string) => void;
  onClose: () => void;
}

export const PatternFillModal: React.FC<PatternFillModalProps> = ({
  currentColor,
  onApplyPattern,
  onClose,
}) => {
  const [patternsList, setPatternsList] = useState<KritaPatternDef[]>([]);
  const [patternPreviewUrls, setPatternPreviewUrls] = useState<Record<string, string>>({});
  const [selectedPatternId, setSelectedPatternId] = useState<string>('01_canvas');
  const [scale, setScale] = useState<number>(100);
  const [fgColor, setFgColor] = useState<string>(currentColor || '#5fd3ad');
  const [bgColor, setBgColor] = useState<string>('transparent');

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load and refresh all patterns (built-in + Hunbatz local content textures)
  const refreshPatterns = useCallback(() => {
    const list = getAllKritaPatterns().filter((p) => p.id !== 'none');
    setPatternsList(list);

    const urls: Record<string, string> = {};
    list.forEach((p) => {
      if (p.customUrl || p.url) {
        urls[p.id] = p.customUrl || p.url || '';
      } else {
        const c = getKritaPatternCanvas(p.id);
        if (c) urls[p.id] = c.toDataURL();
      }
    });
    setPatternPreviewUrls(urls);

    if (list.length > 0 && !list.some((p) => p.id === selectedPatternId)) {
      setSelectedPatternId(list[0].id);
    }
  }, [selectedPatternId]);

  useEffect(() => {
    fetchLocalTextures().then(() => {
      refreshPatterns();
    });
  }, [refreshPatterns]);

  // Draw live swatch preview
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const curPat = patternsList.find((p) => p.id === selectedPatternId);
    const customUrl = curPat?.customUrl || curPat?.url;

    if (customUrl) {
      const img = new Image();
      img.onload = () => {
        const patternCanvas = document.createElement('canvas');
        const s = Math.max(12, Math.round((48 * scale) / 100));
        patternCanvas.width = s;
        patternCanvas.height = s;
        const pCtx = patternCanvas.getContext('2d');
        if (pCtx) {
          if (bgColor !== 'transparent') {
            pCtx.fillStyle = bgColor;
            pCtx.fillRect(0, 0, s, s);
          }
          pCtx.drawImage(img, 0, 0, s, s);
          const pat = ctx.createPattern(patternCanvas, 'repeat');
          if (pat) {
            ctx.fillStyle = pat;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        }
      };
      img.src = customUrl;
    } else {
      const kritaPat = getKritaPatternCanvas(selectedPatternId);
      if (kritaPat) {
        const patternCanvas = document.createElement('canvas');
        const s = Math.max(12, Math.round((kritaPat.width * scale) / 100));
        patternCanvas.width = s;
        patternCanvas.height = s;
        const pCtx = patternCanvas.getContext('2d');
        if (pCtx) {
          if (bgColor !== 'transparent') {
            pCtx.fillStyle = bgColor;
            pCtx.fillRect(0, 0, s, s);
          }
          pCtx.drawImage(kritaPat, 0, 0, s, s);
          const pat = ctx.createPattern(patternCanvas, 'repeat');
          if (pat) {
            ctx.fillStyle = pat;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        }
      } else {
        const patCanvas = createPatternCanvas(selectedPatternId, scale, fgColor, bgColor);
        const pat = ctx.createPattern(patCanvas, 'repeat');
        if (pat) {
          ctx.fillStyle = pat;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
    }
  }, [selectedPatternId, scale, fgColor, bgColor, patternsList]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        const registered = registerCustomKritaPattern(cleanName, result);
        refreshPatterns();
        setSelectedPatternId(registered.id);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeletePattern = (e: React.MouseEvent, patternId: string) => {
    e.stopPropagation();
    deleteCustomKritaPattern(patternId);
    refreshPatterns();
  };

  const handleApply = () => {
    const activePat = patternsList.find((p) => p.id === selectedPatternId);
    onApplyPattern(
      selectedPatternId,
      scale,
      activePat?.customUrl || patternPreviewUrls[selectedPatternId]
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg mayan-panel border-2 border-[#b89058] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] p-4 text-[#e6c699] flex flex-col gap-3.5 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <MayanCornerBrackets size={14} />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2c3532] pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#164435] text-[#5fd3ad] border border-[#5fd3ad]/40">
              <Grid size={16} />
            </div>
            <div>
              <h3 className="font-mayan font-bold text-sm tracking-wide text-[#5fd3ad]">
                Pattern Fill Studio
              </h3>
              <p className="text-[10px] text-[#9e9484]">
                Seamless canvas textures, weaves & persistent custom library
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#9e9484] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Swatch Live Preview Box */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] text-[#9e9484]">
            <span className="font-medium">Swatch Live Preview</span>
            <span className="font-mono text-[10px] text-[#5fd3ad] font-bold">{scale}% Scale</span>
          </div>
          <div className="w-full h-28 rounded-xl border border-[#2c3532] overflow-hidden bg-[#090c0b] shadow-inner relative flex items-center justify-center">
            <canvas ref={previewCanvasRef} width={440} height={112} className="w-full h-full object-cover" />
          </div>
        </div>

        {/* Size / Scale Slider */}
        <div className="flex items-center justify-between gap-3 bg-[#0c100f] px-3 py-2 rounded-xl border border-[#2c3532] text-xs">
          <span className="text-[#9e9484] font-medium text-[11px]">Pattern Scale:</span>
          <input
            type="range"
            min={10}
            max={300}
            step={5}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="flex-1 h-1.5 bg-[#18201d] accent-[#5fd3ad] rounded-lg cursor-pointer"
          />
          <span className="font-mono text-[#5fd3ad] font-bold w-12 text-right">{scale}%</span>
        </div>

        {/* Scrollable Visual Square Thumbnail Grid */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#9e9484] font-medium">
              Unified Pattern Library ({patternsList.length} swatches)
            </span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg mayan-btn-jade text-[11px] font-semibold transition-all cursor-pointer shadow-sm"
              title="Upload custom image to persistent pattern collection"
            >
              <Upload size={12} />
              <span>+ Upload Pattern</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-2 mayan-well rounded-xl border border-[#2c3532]">
            {patternsList.map((pat) => {
              const isSelected = selectedPatternId === pat.id;
              const previewUrl = patternPreviewUrls[pat.id];

              return (
                <div
                  key={pat.id}
                  onClick={() => setSelectedPatternId(pat.id)}
                  className={`group relative flex flex-col items-center p-1.5 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-2 border-[#5fd3ad] bg-[#164435]/50 shadow-[0_0_8px_rgba(95,211,173,0.3)]'
                      : 'border-[#2c3532] bg-[#141a18] hover:border-[#b89058]'
                  }`}
                >
                  <div className="w-14 h-14 rounded bg-[#090c0b] border border-[#2c3532] overflow-hidden flex items-center justify-center">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={pat.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon size={18} className="text-[#9e9484]" />
                    )}
                  </div>
                  <span className="text-[9px] text-[#e6c699] truncate w-full text-center mt-1">
                    {pat.name}
                  </span>

                  {pat.isCustom && (
                    <button
                      onClick={(e) => handleDeletePattern(e, pat.id)}
                      className="absolute top-1 right-1 p-1 rounded bg-black/80 hover:bg-red-900/90 text-[#9e9484] hover:text-red-300 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                      title="Delete from custom pattern library"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Color Settings */}
        <div className="flex items-center justify-between gap-4 bg-[#0c100f] px-3 py-2 rounded-xl border border-[#2c3532] text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#9e9484] text-[11px]">Pattern Color:</span>
            <input
              type="color"
              value={fgColor}
              onChange={(e) => setFgColor(e.target.value)}
              className="w-6 h-6 rounded-md border border-[#2c3532] bg-transparent cursor-pointer p-0"
              title="Foreground Color"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[#9e9484] text-[11px]">Background:</span>
            <select
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="bg-[#141a18] border border-[#2c3532] rounded-lg px-2 py-1 text-[11px] text-[#e6c699] focus:outline-none cursor-pointer"
            >
              <option value="transparent">Transparent</option>
              <option value="#ffffff">White</option>
              <option value="#000000">Black</option>
              <option value="#090c0b">Obsidian Dark</option>
            </select>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#2c3532]">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-xs text-[#9e9484] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl mayan-btn-jade text-xs font-semibold shadow-lg shadow-[#5fd3ad]/20 transition-transform active:scale-95 cursor-pointer"
          >
            <Check size={14} />
            <span>Apply Pattern Tile</span>
          </button>
        </div>
      </div>
    </div>
  );
};
