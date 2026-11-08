import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Layer } from '../types/canvas';
import {
  X,
  Pipette,
  Maximize2,
  Upload,
  Image as ImageIcon,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  GripHorizontal,
} from 'lucide-react';
import { MayanCornerBrackets } from './MayanDecorations';
import { renderFullArtworkCanvas } from '../utils/exportEngine';

interface ReferenceWindowProps {
  isOpen: boolean;
  onClose: () => void;
  layers: Layer[];
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor?: string;
  onSampleColor: (hexColor: string) => void;
}

export const ReferenceWindow: React.FC<ReferenceWindowProps> = ({
  isOpen,
  onClose,
  layers,
  canvasWidth,
  canvasHeight,
  backgroundColor = '#ffffff',
  onSampleColor,
}) => {
  if (!isOpen) return null;

  // Window position & size
  const [position, setPosition] = useState<{ x: number; y: number }>(() => ({
    x: typeof window !== 'undefined' ? Math.max(80, window.innerWidth - 380) : 500,
    y: 70,
  }));
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 340, height: 320 });

  // Mode: Canvas Mirror vs Imported Image
  const [mode, setMode] = useState<'canvas' | 'image'>('canvas');
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  // Eyedropper mode inside reference
  const [isEyedropperActive, setIsEyedropperActive] = useState<boolean>(true);
  const [sampledColor, setSampledColor] = useState<string | null>(null);

  // Viewport Pan & Zoom
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; startPanX: number; startPanY: number }>({
    x: 0,
    y: 0,
    startPanX: 0,
    startPanY: 0,
  });

  // Dragging window frame
  const isDraggingWindowRef = useRef(false);
  const dragWindowStartRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number }>({
    clientX: 0,
    clientY: 0,
    startX: 0,
    startY: 0,
  });

  // Resizing window frame
  const isResizingRef = useRef(false);
  const resizeStartRef = useRef<{ clientX: number; clientY: number; startW: number; startH: number }>({
    clientX: 0,
    clientY: 0,
    startW: 0,
    startH: 0,
  });

  // Canvas mirror buffer
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Render Canvas Mirror onto preview canvas
  const updateCanvasMirror = useCallback(() => {
    if (mode !== 'canvas') return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    const full = renderFullArtworkCanvas(layers, canvasWidth, canvasHeight, backgroundColor);
    ctx.drawImage(full, 0, 0);
  }, [layers, canvasWidth, canvasHeight, backgroundColor, mode]);

  useEffect(() => {
    updateCanvasMirror();
  }, [updateCanvasMirror]);

  // Window Header Dragging Handlers
  const handleHeaderPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    isDraggingWindowRef.current = true;
    dragWindowStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startX: position.x,
      startY: position.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handleHeaderPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingWindowRef.current) return;
    e.stopPropagation();
    const dx = e.clientX - dragWindowStartRef.current.clientX;
    const dy = e.clientY - dragWindowStartRef.current.clientY;
    setPosition({
      x: Math.max(10, Math.min(window.innerWidth - 100, dragWindowStartRef.current.startX + dx)),
      y: Math.max(10, Math.min(window.innerHeight - 80, dragWindowStartRef.current.startY + dy)),
    });
  };

  const handleHeaderPointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    isDraggingWindowRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}
  };

  // Window Resizing Handlers (Bottom-Right Corner)
  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    isResizingRef.current = true;
    resizeStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startW: size.width,
      startH: size.height,
    };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!isResizingRef.current) return;
    e.stopPropagation();
    const dx = e.clientX - resizeStartRef.current.clientX;
    const dy = e.clientY - resizeStartRef.current.clientY;
    setSize({
      width: Math.max(220, Math.min(window.innerWidth - position.x - 20, resizeStartRef.current.startW + dx)),
      height: Math.max(180, Math.min(window.innerHeight - position.y - 20, resizeStartRef.current.startH + dy)),
    });
  };

  const handleResizePointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    isResizingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}
  };

  // Image Upload Handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setImageSrc(result);
      setMode('image');
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Viewport Eyedropper Sampling and Pan Handlers
  const sampleColorFromViewport = (clientX: number, clientY: number) => {
    if (!viewportRef.current) return;
    const vRect = viewportRef.current.getBoundingClientRect();
    const vx = clientX - vRect.left;
    const vy = clientY - vRect.top;

    if (mode === 'canvas' && previewCanvasRef.current) {
      const canvas = previewCanvasRef.current;
      // Calculate normalized coordinates on source canvas taking pan & zoom into account
      const cx = (vx - vRect.width / 2 - pan.x) / zoom + canvas.width / 2;
      const cy = (vy - vRect.height / 2 - pan.y) / zoom + canvas.height / 2;

      const px = Math.round(cx);
      const py = Math.round(cy);
      if (px >= 0 && px < canvas.width && py >= 0 && py < canvas.height) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          const pixel = ctx.getImageData(px, py, 1, 1).data;
          const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
          setSampledColor(hex);
          onSampleColor(hex);
        }
      }
    } else if (mode === 'image' && imageElementRef.current) {
      const img = imageElementRef.current;
      const imgW = img.naturalWidth || 300;
      const imgH = img.naturalHeight || 300;
      const ix = (vx - vRect.width / 2 - pan.x) / zoom + imgW / 2;
      const iy = (vy - vRect.height / 2 - pan.y) / zoom + imgH / 2;

      const px = Math.round(ix);
      const py = Math.round(iy);
      if (px >= 0 && px < imgW && py >= 0 && py < imgH) {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = 1;
        offCanvas.height = 1;
        const oCtx = offCanvas.getContext('2d', { willReadFrequently: true });
        if (oCtx) {
          oCtx.drawImage(img, px, py, 1, 1, 0, 0, 1, 1);
          const pixel = oCtx.getImageData(0, 0, 1, 1).data;
          const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
          setSampledColor(hex);
          onSampleColor(hex);
        }
      }
    }
  };

  const handleViewportPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (isEyedropperActive) {
      sampleColorFromViewport(e.clientX, e.clientY);
    }
    // Start panning
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handleViewportPointerMove = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (isEyedropperActive && (e.buttons & 1)) {
      sampleColorFromViewport(e.clientX, e.clientY);
    } else if (isPanning && !isEyedropperActive) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan({
        x: panStartRef.current.startPanX + dx,
        y: panStartRef.current.startPanY + dy,
      });
    }
  };

  const handleViewportPointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsPanning(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom((prev) => Math.max(0.15, Math.min(8.0, prev * factor)));
  };

  const resetFit = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
      }}
      className="fixed z-50 mayan-panel border-2 border-[#5fd3ad]/60 shadow-[0_16px_50px_rgba(0,0,0,0.95)] flex flex-col select-none animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      <MayanCornerBrackets size={14} color="#5fd3ad" />

      {/* Header Bar (Draggable frame) */}
      <div
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        className="flex items-center justify-between px-2.5 py-1.5 bg-[#0e1312] border-b border-[#2c3532] text-xs cursor-grab active:cursor-grabbing select-none shrink-0"
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripHorizontal size={13} className="text-[#9e9484] shrink-0" />
          <span className="font-mayan font-bold text-[#f2fbf7] text-[11px] tracking-wider uppercase">
            Reference
          </span>

          {/* Mode Tabs: Canvas | Image */}
          <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/10" onPointerDown={(e) => e.stopPropagation()}>
            <button
              onClick={() => {
                setMode('canvas');
                resetFit();
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                mode === 'canvas'
                  ? 'bg-[#164435] text-[#5fd3ad] font-bold shadow'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Layers size={10} />
              <span>Canvas</span>
            </button>
            <button
              onClick={() => {
                setMode('image');
                resetFit();
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                mode === 'image'
                  ? 'bg-[#164435] text-[#5fd3ad] font-bold shadow'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <ImageIcon size={10} />
              <span>Image</span>
            </button>
          </div>
        </div>

        {/* Header Right Action Icons */}
        <div className="flex items-center gap-1 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
          {/* Eyedropper Tool Toggle */}
          <button
            onClick={() => setIsEyedropperActive(!isEyedropperActive)}
            className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition ${
              isEyedropperActive
                ? 'bg-[#5fd3ad] text-black shadow'
                : 'mayan-btn-stone text-white/70 hover:text-white'
            }`}
            title="Sample Color from Reference (Click anywhere on image)"
          >
            <Pipette size={12} />
          </button>

          {/* Import New Image Button (in Image Mode) */}
          {mode === 'image' && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-1.5 h-6 rounded mayan-btn-stone hover:text-white text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
              title="Import New Reference Image"
            >
              <Upload size={11} className="text-[#5fd3ad]" />
              <span>Import</span>
            </button>
          )}

          {/* Reset Zoom & Pan */}
          <button
            onClick={resetFit}
            className="w-6 h-6 rounded mayan-btn-stone hover:text-white flex items-center justify-center text-white/70 cursor-pointer"
            title="Reset Zoom & Pan (Fit to window)"
          >
            <RotateCcw size={11} />
          </button>

          {/* Close Window */}
          <button
            onClick={onClose}
            className="w-6 h-6 rounded mayan-btn-stone hover:text-red-300 flex items-center justify-center text-white/70 cursor-pointer ml-0.5"
            title="Close Reference Window"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Hidden File Input for Image Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Viewport Area */}
      <div
        ref={viewportRef}
        onWheel={handleWheel}
        onPointerDown={handleViewportPointerDown}
        onPointerMove={handleViewportPointerMove}
        onPointerUp={handleViewportPointerUp}
        className={`flex-1 relative overflow-hidden bg-[#070a09] flex items-center justify-center ${
          isEyedropperActive ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
        }`}
      >
        {/* Empty state for Image mode */}
        {mode === 'image' && !imageSrc && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 text-white/50 hover:text-white transition p-6 text-center cursor-pointer border-2 border-dashed border-white/20 rounded-2xl m-4"
          >
            <Upload size={24} className="text-[#5fd3ad]" />
            <span className="text-xs font-semibold text-[#f2fbf7]">Import Reference Image</span>
            <span className="text-[10px] text-white/40">Tap to browse PNG, JPEG, WebP</span>
          </div>
        )}

        {/* Transform container for pan/zoom */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
          className="flex items-center justify-center transition-transform duration-75 ease-out select-none"
        >
          {/* Mode 1: Canvas Mirror */}
          {mode === 'canvas' && (
            <canvas
              ref={previewCanvasRef}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
              }}
              className="pointer-events-none"
            />
          )}

          {/* Mode 2: Imported Image */}
          {mode === 'image' && imageSrc && (
            <img
              ref={imageElementRef}
              src={imageSrc}
              alt="Reference"
              style={{
                maxWidth: `${size.width - 20}px`,
                maxHeight: `${size.height - 70}px`,
                boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
              }}
              className="pointer-events-none object-contain"
            />
          )}
        </div>

        {/* Sampled Color Loupe Badge */}
        {sampledColor && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/80 border border-white/20 text-[10px] shadow-lg animate-in fade-in duration-100">
            <span
              className="w-3 h-3 rounded-full border border-white/40 shadow-inner"
              style={{ backgroundColor: sampledColor }}
            />
            <span className="font-mono text-[#5fd3ad] uppercase font-bold">{sampledColor}</span>
          </div>
        )}

        {/* Bottom Zoom Indicator */}
        <div className="absolute bottom-2 left-2 z-10 px-1.5 py-0.5 rounded bg-black/60 text-[9px] font-mono text-white/50">
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* Resize Handle (Bottom-Right Corner) */}
      <div
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize flex items-center justify-center text-white/30 hover:text-[#5fd3ad] transition-colors"
        title="Drag corner to resize reference window"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="rotate-90">
          <path d="M9 1L1 9M9 5L5 9M9 9L8 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
};
