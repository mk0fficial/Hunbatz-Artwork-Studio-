import React, { useState } from 'react';
import {
  FlipHorizontal,
  FlipVertical,
  Grid,
  Info,
  Video,
  FileJson,
  Image as ImageIcon,
  Sliders,
  Keyboard,
  Plus,
  Clipboard,
  Copy,
  Scissors,
  Crop,
  Film,
  BookOpen,
  Eye,
  FileCode,
  FileText,
  Layers,
  Monitor,
  Tablet,
  Smartphone,
  Zap,
  RotateCcw,
} from 'lucide-react';
import { DrawingGuideConfig } from '../types/canvas';
import { MayanCornerBrackets } from './MayanDecorations';

export type DeviceMode = 'auto' | 'pc' | 'tablet' | 'phone';
export type RamProfile = 'low' | 'medium' | 'power';

interface ActionsModalProps {
  canvasWidth: number;
  canvasHeight: number;
  layerCount: number;
  drawingGuide: DrawingGuideConfig;
  sidebarPosition: 'left' | 'right';
  showBrushCursor: boolean;
  isAnimationAssistActive?: boolean;
  isPageAssistActive?: boolean;
  isReferenceActive?: boolean;
  onOpenCropResize?: () => void;
  onToggleAnimationAssist?: () => void;
  onTogglePageAssist?: () => void;
  onToggleReference?: () => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  onToggleDrawingGuide: () => void;
  onOpenDrawingGuideSettings: () => void;
  onExport: (format: 'png' | 'jpeg' | 'webp' | 'json' | 'psd' | 'pdf' | 'tiff' | 'procreate' | 'hbatz') => void;
  onOpenTimeLapse: () => void;
  onToggleSidebarPosition: () => void;
  onToggleBrushCursor: () => void;
  onOpenShortcuts: () => void;
  onInsertPhoto: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPasteClipboard: () => void;
  onCopyLayer: () => void;
  onCopyCanvas: () => void;
  onCutLayer: () => void;
  onClose: () => void;
  touchPaintingEnabled?: boolean;
  onToggleTouchPainting?: () => void;
  pressureCurvePoint?: { x: number; y: number };
  onChangePressureCurvePoint?: (pt: { x: number; y: number }) => void;
  onResetPressureCurve?: () => void;
  deviceMode?: DeviceMode;
  onChangeDeviceMode?: (mode: DeviceMode) => void;
  uiScale?: number;
  onChangeUiScale?: (scale: number) => void;
  onResetUiScale?: () => void;
  hwAcceleration?: boolean;
  onToggleHwAcceleration?: () => void;
  ramProfile?: RamProfile;
  onChangeRamProfile?: (profile: RamProfile) => void;
}

type ActionTab = 'add' | 'canvas' | 'share' | 'video' | 'prefs' | 'help';

export const ActionsModal: React.FC<ActionsModalProps> = ({
  canvasWidth,
  canvasHeight,
  layerCount,
  drawingGuide,
  sidebarPosition,
  showBrushCursor,
  isAnimationAssistActive = false,
  isPageAssistActive = false,
  isReferenceActive = false,
  onOpenCropResize,
  onToggleAnimationAssist,
  onTogglePageAssist,
  onToggleReference,
  onFlipHorizontal,
  onFlipVertical,
  onToggleDrawingGuide,
  onOpenDrawingGuideSettings,
  onExport,
  onOpenTimeLapse,
  onToggleSidebarPosition,
  onToggleBrushCursor,
  onOpenShortcuts,
  onInsertPhoto,
  onPasteClipboard,
  onCopyLayer,
  onCopyCanvas,
  onCutLayer,
  onClose,
  touchPaintingEnabled = true,
  onToggleTouchPainting,
  pressureCurvePoint = { x: 0.5, y: 0.5 },
  onChangePressureCurvePoint,
  onResetPressureCurve,
  deviceMode = 'auto',
  onChangeDeviceMode,
  uiScale = 1.0,
  onChangeUiScale,
  onResetUiScale,
  hwAcceleration = true,
  onToggleHwAcceleration,
  ramProfile = 'medium',
  onChangeRamProfile,
}) => {
  const [activeTab, setActiveTab] = useState<ActionTab>('add');
  const isDraggingCurveRef = React.useRef(false);
  const curveSvgRef = React.useRef<SVGSVGElement | null>(null);

  const updateCurvePointFromEvent = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!curveSvgRef.current || !onChangePressureCurvePoint) return;
    const rect = curveSvgRef.current.getBoundingClientRect();
    const clampedX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const clampedY = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    onChangePressureCurvePoint({
      x: Number(clampedX.toFixed(2)),
      y: Number(clampedY.toFixed(2)),
    });
  };

  return (
    <div
      className="absolute top-14 left-16 z-50 w-92 mayan-panel border-2 border-[#2c3532] shadow-[0_16px_50px_rgba(0,0,0,0.95)] text-[#e6c699] flex flex-col select-none animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <MayanCornerBrackets size={16} color="#b89058" />

      {/* Tab Buttons (Add, Canvas, Share, Video, Prefs, Help) */}
      <div className="flex border-b border-[#2c3532] mayan-well text-xs font-medium">
        {(['add', 'canvas', 'share', 'video', 'prefs', 'help'] as ActionTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-center capitalize transition-colors cursor-pointer ${
              activeTab === tab
                ? 'text-[#f2fbf7] border-b-2 border-[#5fd3ad] font-bold bg-[#164435]/30 font-mayan'
                : 'text-[#9e9484] hover:text-[#e6c699]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-3 flex flex-col gap-1.5 max-h-[460px] overflow-y-auto">
        {/* ADD TAB (Insert Photo, Paste Object, Copy, Cut) */}
        {activeTab === 'add' && (
          <>
            <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-xs text-white transition-colors cursor-pointer">
              <ImageIcon size={16} className="text-blue-400" />
              <div className="flex flex-col text-left">
                <span className="font-medium">Insert a Photo</span>
                <span className="text-[10px] text-white/40">Places image as a new layer with transform</span>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  onInsertPhoto(e);
                  onClose();
                }}
                className="hidden"
              />
            </label>

            <button
              onClick={() => {
                onPasteClipboard();
                onClose();
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
            >
              <Clipboard size={16} className="text-emerald-400" />
              <div className="flex flex-col text-left">
                <span className="font-medium">Paste from Clipboard (Ctrl+V)</span>
                <span className="text-[10px] text-white/40">Paste copied image or object into artwork</span>
              </div>
            </button>

            <div className="h-px bg-white/5 my-1" />

            <button
              onClick={() => {
                onCopyLayer();
                onClose();
              }}
              className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
            >
              <Copy size={15} className="text-white/70" />
              <div className="flex flex-col text-left">
                <span className="font-medium">Copy Active Layer (Ctrl+C)</span>
              </div>
            </button>

            <button
              onClick={() => {
                onCopyCanvas();
                onClose();
              }}
              className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
            >
              <Copy size={15} className="text-purple-400" />
              <div className="flex flex-col text-left">
                <span className="font-medium">Copy Canvas (Ctrl+Shift+C)</span>
                <span className="text-[10px] text-white/40">Copies all visible layers flattened</span>
              </div>
            </button>

            <button
              onClick={() => {
                onCutLayer();
                onClose();
              }}
              className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
            >
              <Scissors size={15} className="text-amber-400" />
              <div className="flex flex-col text-left">
                <span className="font-medium">Cut Active Layer (Ctrl+X)</span>
              </div>
            </button>
          </>
        )}

        {/* CANVAS TAB (Matching Procreate Actions > Canvas video 0:03-0:05) */}
        {activeTab === 'canvas' && (
          <>
            {/* Crop & Resize */}
            {onOpenCropResize && (
              <button
                onClick={() => {
                  onOpenCropResize();
                  onClose();
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
              >
                <Crop size={16} className="text-white/70" />
                <div className="flex flex-col text-left">
                  <span className="font-medium">Crop & Resize</span>
                  <span className="text-[10px] text-white/40">Adjust bounds, DPI, or resample image</span>
                </div>
              </button>
            )}

            <div className="h-px bg-white/5 my-0.5" />

            {/* Animation Assist Toggle */}
            {onToggleAnimationAssist && (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/5 text-xs text-white">
                <div className="flex items-center gap-3">
                  <Film size={16} className="text-blue-400" />
                  <span>Animation Assist</span>
                </div>
                <input
                  type="checkbox"
                  checked={isAnimationAssistActive}
                  onChange={onToggleAnimationAssist}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
              </div>
            )}

            {/* Page Assist Toggle */}
            {onTogglePageAssist && (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/5 text-xs text-white">
                <div className="flex items-center gap-3">
                  <BookOpen size={16} className="text-emerald-400" />
                  <span>Page Assist</span>
                </div>
                <input
                  type="checkbox"
                  checked={isPageAssistActive}
                  onChange={onTogglePageAssist}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
              </div>
            )}

            {/* Drawing Guide Toggle */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/5 text-xs text-white">
              <div className="flex items-center gap-3">
                <Grid size={16} className="text-white/70" />
                <span>Drawing Guide</span>
              </div>
              <input
                type="checkbox"
                checked={drawingGuide.type !== 'none'}
                onChange={onToggleDrawingGuide}
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
            </div>

            {/* Edit Drawing Guide Button */}
            <button
              onClick={() => {
                onOpenDrawingGuideSettings();
                onClose();
              }}
              className="flex items-center justify-between px-3 py-2 pl-9 rounded-xl hover:bg-white/10 text-xs text-blue-400 font-medium transition-colors cursor-pointer"
            >
              <span>Edit Drawing Guide</span>
              <Sliders size={14} />
            </button>

            {/* Reference Toggle */}
            {onToggleReference && (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/5 text-xs text-white">
                <div className="flex items-center gap-3">
                  <Eye size={16} className="text-amber-400" />
                  <span>Reference</span>
                </div>
                <input
                  type="checkbox"
                  checked={isReferenceActive}
                  onChange={onToggleReference}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
              </div>
            )}

            <div className="h-px bg-white/5 my-0.5" />

            <button
              onClick={() => {
                onFlipHorizontal();
                onClose();
              }}
              className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
            >
              <FlipHorizontal size={16} className="text-white/70" />
              <span>Flip Canvas Horizontal</span>
            </button>
            <button
              onClick={() => {
                onFlipVertical();
                onClose();
              }}
              className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
            >
              <FlipVertical size={16} className="text-white/70" />
              <span>Flip Canvas Vertical</span>
            </button>

            <div className="h-px bg-white/5 my-0.5" />

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 text-xs">
              <Info size={16} className="text-white/50 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-white">Canvas Information</span>
                <span className="text-white/60 text-[11px]">
                  {canvasWidth} × {canvasHeight} px · {layerCount} Layers · RGB 8-bit
                </span>
              </div>
            </div>
          </>
        )}

        {/* SHARE / EXPORT TAB */}
        {activeTab === 'share' && (
          <>
            <span className="px-3 pt-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Export Formats
            </span>
            <button
              onClick={() => {
                onExport('hbatz');
                onClose();
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#164435]/40 border border-[#5fd3ad]/50 hover:bg-[#164435]/70 text-xs text-white transition-all cursor-pointer shadow-sm group"
            >
              <FileCode size={16} className="text-[#5fd3ad] group-hover:scale-110 transition-transform" />
              <div className="flex flex-col text-left">
                <span className="font-bold text-[#5fd3ad]">Hunbatz Project (.HBATZ)</span>
                <span className="text-[10px] text-white/50">Lossless archive: layers, smart layers, depth & FX</span>
              </div>
            </button>
            <button
              onClick={() => {
                onExport('png');
                onClose();
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
            >
              <ImageIcon size={16} className="text-blue-400" />
              <div className="flex flex-col text-left">
                <span className="font-medium">PNG (Full Resolution)</span>
                <span className="text-[10px] text-white/40">Supports transparency and lossless alpha</span>
              </div>
            </button>
            <button
              onClick={() => {
                onExport('jpeg');
                onClose();
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
            >
              <ImageIcon size={16} className="text-amber-400" />
              <div className="flex flex-col text-left">
                <span className="font-medium">JPEG (High Quality)</span>
                <span className="text-[10px] text-white/40">Compact size with crisp color reproduction</span>
              </div>
            </button>
            <button
              onClick={() => {
                onExport('webp');
                onClose();
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
            >
              <ImageIcon size={16} className="text-emerald-400" />
              <div className="flex flex-col text-left">
                <span className="font-medium">WebP Image</span>
                <span className="text-[10px] text-white/40">Modern web-optimized format</span>
              </div>
            </button>
            <button
              onClick={() => {
                onExport('psd');
                onClose();
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
            >
              <Layers size={16} className="text-cyan-400" />
              <div className="flex flex-col text-left">
                <span className="font-medium">PSD (Adobe Photoshop)</span>
                <span className="text-[10px] text-white/40">Layered binary file compatible with Photoshop</span>
              </div>
            </button>
            <button
              onClick={() => {
                onExport('pdf');
                onClose();
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
            >
              <FileText size={16} className="text-red-400" />
              <div className="flex flex-col text-left">
                <span className="font-medium">PDF (Portable Document)</span>
                <span className="text-[10px] text-white/40">Vector document container for print & sharing</span>
              </div>
            </button>
            <button
              onClick={() => {
                onExport('tiff');
                onClose();
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
            >
              <FileCode size={16} className="text-teal-400" />
              <div className="flex flex-col text-left">
                <span className="font-medium">TIFF (Baseline Uncompressed)</span>
                <span className="text-[10px] text-white/40">Studio archival format with uncompressed RGB</span>
              </div>
            </button>
            <button
              onClick={() => {
                onExport('json');
                onClose();
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
            >
              <FileJson size={16} className="text-purple-400" />
              <div className="flex flex-col text-left">
                <span className="font-medium">Procreate Project Archive</span>
                <span className="text-[10px] text-white/40">Preserves layers, blend modes, and stroke history</span>
              </div>
            </button>
          </>
        )}

        {/* VIDEO / TIME-LAPSE TAB */}
        {activeTab === 'video' && (
          <>
            <span className="px-3 pt-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Time-Lapse Recording
            </span>
            <button
              onClick={() => {
                onOpenTimeLapse();
                onClose();
              }}
              className="flex items-center gap-3 px-3 py-3 rounded-xl bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 text-xs text-white transition-colors cursor-pointer"
            >
              <Video size={18} className="text-blue-400" />
              <div className="flex flex-col text-left">
                <span className="font-semibold text-blue-200">Time-Lapse Replay</span>
                <span className="text-[10px] text-white/50">Watch full progressive playback of your artwork</span>
              </div>
            </button>
          </>
        )}

        {/* PREFERENCES TAB */}
        {activeTab === 'prefs' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/5 text-xs text-white">
              <span>Right-Hand Interface</span>
              <button
                onClick={onToggleSidebarPosition}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                  sidebarPosition === 'right' ? 'bg-[#5fd3ad]' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    sidebarPosition === 'right' ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/5 text-xs text-white">
              <span>Brush Cursor Outline</span>
              <button
                onClick={onToggleBrushCursor}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                  showBrushCursor ? 'bg-[#5fd3ad]' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    showBrushCursor ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="h-px bg-white/5 my-0.5" />

            {/* Touch Painting Toggle */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 text-xs">
              <div>
                <div className="font-semibold text-[#e6c699]">Touch Painting</div>
                <div className="text-[10px] text-[#e6c699]/60">
                  {touchPaintingEnabled ? 'Finger + Stylus draws' : 'Stylus Pen only'}
                </div>
              </div>
              <button
                onClick={onToggleTouchPainting}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                  touchPaintingEnabled ? 'mayan-btn-jade' : 'mayan-btn-stone'
                }`}
              >
                {touchPaintingEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Interactive Manual Bezier Pressure Curve Editor */}
            <div className="p-2.5 rounded-xl bg-[#0c100f] border border-[#2c3532] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#e6c699]">Pressure Curve</span>
                  <span className="text-[10px] text-[#5fd3ad] block font-mono">Custom Stylus Response</span>
                </div>
                {onResetPressureCurve && (
                  <button
                    onClick={onResetPressureCurve}
                    className="mayan-btn-stone px-2 py-0.5 rounded text-[10px] hover:border-[#5fd3ad] cursor-pointer"
                  >
                    Reset Curve
                  </button>
                )}
              </div>

              <div className="mayan-well p-2 rounded-lg flex flex-col items-center">
                <svg
                  ref={curveSvgRef}
                  width={220}
                  height={150}
                  viewBox="0 0 220 150"
                  className="bg-[#080a09] rounded-lg border border-[#2c3532] cursor-crosshair touch-none select-none"
                  onPointerDown={(e) => {
                    isDraggingCurveRef.current = true;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    updateCurvePointFromEvent(e);
                  }}
                  onPointerMove={(e) => {
                    if (!isDraggingCurveRef.current) return;
                    updateCurvePointFromEvent(e);
                  }}
                  onPointerUp={(e) => {
                    isDraggingCurveRef.current = false;
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }}
                >
                  <line x1="0" y1="37.5" x2="220" y2="37.5" stroke="#1e2623" strokeWidth="1" />
                  <line x1="0" y1="75" x2="220" y2="75" stroke="#1e2623" strokeWidth="1" />
                  <line x1="0" y1="112.5" x2="220" y2="112.5" stroke="#1e2623" strokeWidth="1" />
                  <line x1="55" y1="0" x2="55" y2="150" stroke="#1e2623" strokeWidth="1" />
                  <line x1="110" y1="0" x2="110" y2="150" stroke="#1e2623" strokeWidth="1" />
                  <line x1="165" y1="0" x2="165" y2="150" stroke="#1e2623" strokeWidth="1" />

                  <line
                    x1="0"
                    y1="150"
                    x2="220"
                    y2="0"
                    stroke="#2c3532"
                    strokeDasharray="4 4"
                    strokeWidth="1.5"
                  />

                  {(() => {
                    const cx = pressureCurvePoint.x * 220;
                    const cy = (1 - pressureCurvePoint.y) * 150;
                    const ctrlX = 2 * cx - 110;
                    const ctrlY = 2 * cy - 75;
                    return (
                      <>
                        <path
                          d={`M 0 150 Q ${ctrlX} ${ctrlY} 220 0`}
                          fill="none"
                          stroke="#5fd3ad"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r="7"
                          fill="#5fd3ad"
                          stroke="#e6c699"
                          strokeWidth="2"
                        />
                      </>
                    );
                  })()}
                </svg>
                <div className="w-full flex justify-between text-[10px] text-[#e6c699]/70 mt-1.5 px-1 font-mono">
                  <span>Input: {Math.round(pressureCurvePoint.x * 100)}%</span>
                  <span>Output: {Math.round(pressureCurvePoint.y * 100)}%</span>
                </div>
              </div>
            </div>

            {/* UI Size Adaptability & Device Mode Section */}
            <div className="p-2.5 rounded-xl bg-[#0c100f] border border-[#2c3532] flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#e6c699]">Interface & Device Adaptability</span>
                  <span className="text-[10px] text-[#5fd3ad] block font-mono">
                    Scale menus, icons & text for drawing space
                  </span>
                </div>
                {onResetUiScale && (
                  <button
                    onClick={onResetUiScale}
                    className="mayan-btn-stone px-2 py-0.5 rounded text-[10px] hover:border-[#5fd3ad] cursor-pointer flex items-center gap-1"
                    title="Reset to default scale for active device"
                  >
                    <RotateCcw size={10} />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {/* Device Type Selector */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-[#e6c699]/70 uppercase tracking-wider">
                  Device Preset
                </span>
                <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-black/40 border border-[#2c3532]">
                  {(
                    [
                      { id: 'auto', label: 'Auto', icon: Zap },
                      { id: 'pc', label: 'PC', icon: Monitor },
                      { id: 'tablet', label: 'Tablet', icon: Tablet },
                      { id: 'phone', label: 'Phone', icon: Smartphone },
                    ] as const
                  ).map((dev) => {
                    const Icon = dev.icon;
                    const isSelected = deviceMode === dev.id;
                    return (
                      <button
                        key={dev.id}
                        onClick={() => onChangeDeviceMode?.(dev.id)}
                        className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-md text-[10px] font-medium transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#164435] text-[#5fd3ad] font-bold border border-[#5fd3ad]/60 shadow-sm'
                            : 'text-[#e6c699]/70 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Icon size={13} className={isSelected ? 'text-[#5fd3ad]' : 'opacity-70'} />
                        <span className="mt-0.5">{dev.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* UI Size Adaptability Slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#e6c699]/80 font-medium">UI & Icon Size</span>
                  <span className="font-mono text-[#5fd3ad] font-bold">
                    {Math.round(uiScale * 100)}%{' '}
                    <span className="text-[9px] text-[#e6c699]/50 font-sans font-normal">
                      {uiScale <= 0.8
                        ? '(Compact Phone)'
                        : uiScale <= 0.95
                        ? '(Tablet)'
                        : uiScale <= 1.05
                        ? '(Standard PC)'
                        : '(Spacious)'}
                    </span>
                  </span>
                </div>
                <input
                  type="range"
                  min={0.65}
                  max={1.35}
                  step={0.01}
                  value={uiScale}
                  onChange={(e) => onChangeUiScale?.(parseFloat(e.target.value))}
                  className="w-full accent-[#5fd3ad] cursor-pointer h-1.5 bg-[#1b221f] rounded-lg"
                />
                <div className="flex justify-between text-[9px] text-[#e6c699]/40 font-mono px-0.5">
                  <span>65% (Compact)</span>
                  <span>100% (Default)</span>
                  <span>135% (Large)</span>
                </div>
              </div>
            </div>

            {/* Hardware Drawing Acceleration Toggle */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 text-xs border border-[#2c3532]/60">
              <div className="flex-1 pr-2">
                <div className="flex items-center gap-1.5 font-semibold text-[#e6c699]">
                  <Zap size={13} className="text-[#5fd3ad]" />
                  <span>Hardware Drawing Acceleration</span>
                </div>
                <div className="text-[10px] text-[#e6c699]/60 leading-tight mt-0.5">
                  Zero-latency stroke coalescing & dirty-rect blitting for iPad Air and mobile devices
                </div>
              </div>
              <button
                onClick={onToggleHwAcceleration}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition shrink-0 ${
                  hwAcceleration ? 'mayan-btn-jade' : 'mayan-btn-stone'
                }`}
              >
                {hwAcceleration ? 'ACTIVE' : 'OFF'}
              </button>
            </div>

            {/* RAM & Memory Optimization Profile */}
            <div className="p-2.5 rounded-xl bg-[#0c100f] border border-[#2c3532] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#e6c699]">RAM & Engine Profile</span>
                  <span className="text-[10px] text-[#5fd3ad] block font-mono">
                    Scale undo history & scratch memory buffers
                  </span>
                </div>
                <span className="text-[9px] px-2 py-0.5 rounded bg-[#164435] text-[#5fd3ad] font-mono font-bold uppercase">
                  {ramProfile === 'low' ? 'Low (~1 GB)' : ramProfile === 'power' ? 'Power (Max)' : 'Medium (~1.5–2 GB)'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-black/40 border border-[#2c3532]">
                {[
                  {
                    id: 'low' as const,
                    title: 'Low',
                    target: '~1 GB',
                    desc: 'Able to draw fine, lightweight sketching. 10-step undo, aggressive scratch buffer disposal.',
                  },
                  {
                    id: 'medium' as const,
                    title: 'Medium',
                    target: '~1.5–2 GB',
                    desc: 'Balanced studio default for all devices. Stable drawing & 25-step undo history.',
                  },
                  {
                    id: 'power' as const,
                    title: 'Power',
                    target: 'Max / Adapt',
                    desc: 'Breaks limitations and runs smooth at any point adapting to intensity. 60-step undo.',
                  },
                ].map((prof) => {
                  const isSelected = ramProfile === prof.id;
                  return (
                    <button
                      key={prof.id}
                      onClick={() => onChangeRamProfile?.(prof.id)}
                      className={`flex flex-col items-center justify-center py-2 px-1 rounded-md text-center transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#164435] text-[#5fd3ad] font-bold border border-[#5fd3ad]/70 shadow-sm'
                          : 'text-[#e6c699]/70 hover:text-white hover:bg-white/5 border border-transparent'
                      }`}
                      title={prof.desc}
                    >
                      <span className="text-xs font-bold">{prof.title}</span>
                      <span className="text-[9px] opacity-75 font-mono">{prof.target}</span>
                    </button>
                  );
                })}
              </div>

              <p className="text-[9.5px] text-[#9e9484] leading-relaxed px-1">
                {ramProfile === 'low' &&
                  '• Low Mode: Optimized for ~1GB RAM devices. Capped to 10 undo steps with immediate offscreen scratch buffer cleanup after every stroke.'}
                {ramProfile === 'medium' &&
                  '• Medium Mode: Stable across all devices (~1.5–2GB RAM). 25-step undo history and balanced scratch buffer caching.'}
                {ramProfile === 'power' &&
                  '• Power Mode: Workstation performance. Breaks limitations, keeps unthrottled scratch buffers, and allows 60-step undo history adapting to heavy workloads.'}
              </p>
            </div>
          </div>
        )}

        {/* HELP TAB */}
        {activeTab === 'help' && (
          <>
            <button
              onClick={() => {
                onOpenShortcuts();
                onClose();
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
            >
              <Keyboard size={16} className="text-white/70" />
              <span>Keyboard Shortcuts & Gestures</span>
            </button>
            <div className="p-3 bg-white/5 rounded-xl text-[11px] text-white/60 flex flex-col gap-1.5 leading-relaxed">
              <span className="font-semibold text-white">Procreate Desktop Tips:</span>
              <span>• Press Ctrl+V anytime to paste images or objects from clipboard!</span>
              <span>• Drag any image file directly onto the canvas to paste it as a layer.</span>
              <span>• Adjust Gaussian Blur and effects with instantaneous live visual preview!</span>
              <span>• Drag the color circle in top right onto any area for ColorDrop fill.</span>
              <span>• Press Space + Drag or use middle mouse to pan the canvas smoothly.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
