import React, { useState, useRef } from 'react';
import { Check, X, RotateCcw, Link2, Unlink2 } from 'lucide-react';

interface CropResizeOverlayProps {
  currentWidth: number;
  currentHeight: number;
  zoom: number;
  pan: { x: number; y: number };
  onApply: (params: {
    width: number;
    height: number;
    cropX: number;
    cropY: number;
    resample: boolean;
    dpi: number;
  }) => void;
  onCancel: () => void;
}

type DragHandle = 'body' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w';

export const CropResizeOverlay: React.FC<CropResizeOverlayProps> = ({
  currentWidth,
  currentHeight,
  zoom,
  pan,
  onApply,
  onCancel,
}) => {
  const [cropBox, setCropBox] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: currentWidth,
    height: currentHeight,
  });

  const [aspectLocked, setAspectLocked] = useState(false);
  const [resample, setResample] = useState(false);
  const [dpi, setDpi] = useState(300);

  const [activeDrag, setActiveDrag] = useState<DragHandle | null>(null);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    startBox: { x: number; y: number; width: number; height: number };
  }>({
    pointerX: 0,
    pointerY: 0,
    startBox: { x: 0, y: 0, width: currentWidth, height: currentHeight },
  });

  const aspectRatio = currentWidth / currentHeight;

  const handlePointerDown = (e: React.PointerEvent, handle: DragHandle) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setActiveDrag(handle);
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      startBox: { ...cropBox },
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeDrag) return;
    e.stopPropagation();

    const dx = (e.clientX - dragStartRef.current.pointerX) / zoom;
    const dy = (e.clientY - dragStartRef.current.pointerY) / zoom;
    const init = dragStartRef.current.startBox;

    if (activeDrag === 'body') {
      setCropBox((prev) => ({
        ...prev,
        x: Math.round(init.x + dx),
        y: Math.round(init.y + dy),
      }));
      return;
    }

    let newX = init.x;
    let newY = init.y;
    let newW = init.width;
    let newH = init.height;

    if (activeDrag.includes('e')) {
      newW = Math.max(50, Math.round(init.width + dx));
    }
    if (activeDrag.includes('s')) {
      newH = Math.max(50, Math.round(init.height + dy));
    }
    if (activeDrag.includes('w')) {
      newW = Math.max(50, Math.round(init.width - dx));
      newX = Math.round(init.x + (init.width - newW));
    }
    if (activeDrag.includes('n')) {
      newH = Math.max(50, Math.round(init.height - dy));
      newY = Math.round(init.y + (init.height - newH));
    }

    if (aspectLocked) {
      if (activeDrag.includes('e') || activeDrag.includes('w')) {
        newH = Math.round(newW / aspectRatio);
      } else {
        newW = Math.round(newH * aspectRatio);
      }
    }

    setCropBox({
      x: newX,
      y: newY,
      width: newW,
      height: newH,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeDrag) {
      e.stopPropagation();
      setActiveDrag(null);
    }
  };

  const handleReset = () => {
    setCropBox({
      x: 0,
      y: 0,
      width: currentWidth,
      height: currentHeight,
    });
  };

  const handleCommit = () => {
    onApply({
      width: Math.round(cropBox.width),
      height: Math.round(cropBox.height),
      cropX: Math.round(cropBox.x),
      cropY: Math.round(cropBox.y),
      resample,
      dpi,
    });
  };

  const toScreenX = (x: number) => pan.x + x * zoom;
  const toScreenY = (y: number) => pan.y + y * zoom;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-40"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Dimmed backdrop outside crop area */}
      <div
        className="absolute inset-0 bg-black/45 pointer-events-auto"
        style={{
          clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${toScreenX(
            cropBox.x
          )}px ${toScreenY(cropBox.y)}px, ${toScreenX(cropBox.x)}px ${toScreenY(
            cropBox.y + cropBox.height
          )}px, ${toScreenX(cropBox.x + cropBox.width)}px ${toScreenY(
            cropBox.y + cropBox.height
          )}px, ${toScreenX(cropBox.x + cropBox.width)}px ${toScreenY(
            cropBox.y
          )}px, ${toScreenX(cropBox.x)}px ${toScreenY(cropBox.y)}px)`,
        }}
      />

      {/* Interactive Crop Boundary Box */}
      <div
        className="absolute border-2 border-white shadow-2xl pointer-events-auto cursor-move"
        style={{
          left: toScreenX(cropBox.x),
          top: toScreenY(cropBox.y),
          width: cropBox.width * zoom,
          height: cropBox.height * zoom,
        }}
        onPointerDown={(e) => handlePointerDown(e, 'body')}
      >
        {/* Rule of Thirds Grid Lines */}
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
          <div className="border-r border-b border-white" />
          <div className="border-r border-b border-white" />
          <div className="border-b border-white" />
          <div className="border-r border-b border-white" />
          <div className="border-r border-b border-white" />
          <div className="border-b border-white" />
          <div className="border-r border-white" />
          <div className="border-r border-white" />
          <div />
        </div>

        {/* Live Dimension readout badge */}
        <div className="absolute -top-7 left-0 bg-black/85 text-white font-mono font-bold text-[11px] px-2 py-0.5 rounded shadow">
          {Math.round(cropBox.width)} × {Math.round(cropBox.height)} px
        </div>

        {/* Corner Handles */}
        <div
          className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-sm cursor-nwse-resize shadow"
          onPointerDown={(e) => handlePointerDown(e, 'nw')}
        />
        <div
          className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-sm cursor-nesw-resize shadow"
          onPointerDown={(e) => handlePointerDown(e, 'ne')}
        />
        <div
          className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-sm cursor-nwse-resize shadow"
          onPointerDown={(e) => handlePointerDown(e, 'se')}
        />
        <div
          className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-sm cursor-nesw-resize shadow"
          onPointerDown={(e) => handlePointerDown(e, 'sw')}
        />

        {/* Edge Midpoint Handles */}
        <div
          className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-2.5 bg-white border border-black/40 rounded-full cursor-ns-resize shadow"
          onPointerDown={(e) => handlePointerDown(e, 'n')}
        />
        <div
          className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-2.5 bg-white border border-black/40 rounded-full cursor-ns-resize shadow"
          onPointerDown={(e) => handlePointerDown(e, 's')}
        />
        <div
          className="absolute top-1/2 -left-1.5 -translate-y-1/2 h-8 w-2.5 bg-white border border-black/40 rounded-full cursor-ew-resize shadow"
          onPointerDown={(e) => handlePointerDown(e, 'w')}
        />
        <div
          className="absolute top-1/2 -right-1.5 -translate-y-1/2 h-8 w-2.5 bg-white border border-black/40 rounded-full cursor-ew-resize shadow"
          onPointerDown={(e) => handlePointerDown(e, 'e')}
        />
      </div>

      {/* Floating Bottom Control Bar */}
      <div
        className="fixed bottom-6 inset-x-0 mx-auto w-full max-w-xl z-50 px-4 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#16181f]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-3 flex flex-col gap-2.5 text-white text-xs select-none">
          {/* Top row: Width & Height numeric inputs + Aspect lock + DPI */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-white/50 text-[11px]">W:</span>
              <input
                type="number"
                min={10}
                max={8000}
                value={Math.round(cropBox.width)}
                onChange={(e) => {
                  const val = Math.max(10, Number(e.target.value));
                  setCropBox((prev) => ({
                    ...prev,
                    width: val,
                    height: aspectLocked ? Math.round(val / aspectRatio) : prev.height,
                  }));
                }}
                className="w-16 bg-[#0e0f14] border border-white/10 rounded-lg px-2 py-1 text-right font-mono font-bold text-white focus:outline-none"
              />
              <span className="text-white/40 text-[10px]">px</span>
            </div>

            {/* Aspect Ratio Lock Toggle */}
            <button
              onClick={() => setAspectLocked(!aspectLocked)}
              title={aspectLocked ? 'Aspect Ratio Locked' : 'Aspect Ratio Unlocked'}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                aspectLocked
                  ? 'bg-blue-600/30 border-blue-500/50 text-blue-400'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
              }`}
            >
              {aspectLocked ? <Link2 size={15} /> : <Unlink2 size={15} />}
            </button>

            <div className="flex items-center gap-2">
              <span className="text-white/50 text-[11px]">H:</span>
              <input
                type="number"
                min={10}
                max={8000}
                value={Math.round(cropBox.height)}
                onChange={(e) => {
                  const val = Math.max(10, Number(e.target.value));
                  setCropBox((prev) => ({
                    ...prev,
                    height: val,
                    width: aspectLocked ? Math.round(val * aspectRatio) : prev.width,
                  }));
                }}
                className="w-16 bg-[#0e0f14] border border-white/10 rounded-lg px-2 py-1 text-right font-mono font-bold text-white focus:outline-none"
              />
              <span className="text-white/40 text-[10px]">px</span>
            </div>

            {/* DPI select */}
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-white/50 text-[11px]">DPI:</span>
              <select
                value={dpi}
                onChange={(e) => setDpi(Number(e.target.value))}
                className="bg-[#0e0f14] border border-white/10 rounded-lg px-2 py-1 font-mono text-white text-xs focus:outline-none cursor-pointer"
              >
                <option value={72}>72</option>
                <option value={150}>150</option>
                <option value={300}>300</option>
                <option value={600}>600</option>
              </select>
            </div>
          </div>

          {/* Bottom row: Resample switch + Reset + Cancel + Done */}
          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={resample}
                onChange={(e) => setResample(e.target.checked)}
                className="accent-blue-500 rounded cursor-pointer"
              />
              <span className="text-white/70 text-[11px]">Resample Canvas</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                title="Reset to Original Dimensions"
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <RotateCcw size={15} />
              </button>
              <button
                onClick={onCancel}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCommit}
                className="flex items-center gap-1 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs shadow-lg transition-all active:scale-95 cursor-pointer"
              >
                <Check size={14} /> Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
