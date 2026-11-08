import React, { useState, useRef, useEffect } from 'react';
import {
  DrawingGuideConfig,
  DrawingGuideType,
  VanishingPoint,
  SymmetryOption,
} from '../types/canvas';
import { Check, X, Sliders, Trash2, Undo2, Redo2 } from 'lucide-react';
import { MayanCornerBrackets } from './MayanDecorations';

interface DrawingGuideSettingsModalProps {
  guide: DrawingGuideConfig;
  canvasWidth: number;
  canvasHeight: number;
  canvasThumbnailUrl?: string;
  onChangeGuide: (updated: DrawingGuideConfig) => void;
  onClose: () => void;
}

export const DrawingGuideSettingsModal: React.FC<DrawingGuideSettingsModalProps> = ({
  guide,
  canvasWidth,
  canvasHeight,
  canvasThumbnailUrl,
  onChangeGuide,
  onClose,
}) => {
  // Working copy of guide settings
  const [tempGuide, setTempGuide] = useState<DrawingGuideConfig>(() => ({
    ...guide,
    thickness: guide.thickness ?? 1.5,
    angle: guide.angle ?? 0,
    origin: guide.origin ?? { x: canvasWidth / 2, y: canvasHeight / 2 },
    vanishingPoints: guide.vanishingPoints ? [...guide.vanishingPoints] : [],
    symmetryOption:
      guide.symmetryOption ??
      (guide.type === 'symmetry_horizontal'
        ? 'horizontal'
        : guide.type === 'symmetry_quad'
        ? 'quadrant'
        : guide.type === 'symmetry_radial'
        ? 'radial'
        : 'vertical'),
    rotationalSymmetry: guide.rotationalSymmetry ?? false,
  }));

  // Undo / Redo history stack within the modal
  const [history, setHistory] = useState<DrawingGuideConfig[]>([]);
  const [redoStack, setRedoStack] = useState<DrawingGuideConfig[]>([]);

  const pushHistory = (newGuide: DrawingGuideConfig) => {
    setHistory((prev) => [...prev, JSON.parse(JSON.stringify(tempGuide))]);
    setRedoStack([]);
    setTempGuide(newGuide);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setRedoStack((r) => [...r, JSON.parse(JSON.stringify(tempGuide))]);
    setTempGuide(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setHistory((h) => [...h, JSON.parse(JSON.stringify(tempGuide))]);
    setTempGuide(next);
  };

  // Keyboard shortcut Ctrl+Z / Ctrl+Shift+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, redoStack, tempGuide]);

  const [activeTab, setActiveTab] = useState<'2d_grid' | 'isometric' | 'perspective' | 'symmetry'>(() => {
    if (guide.type === 'isometric') return 'isometric';
    if (guide.type === 'perspective') return 'perspective';
    if (guide.type.startsWith('symmetry')) return 'symmetry';
    return '2d_grid';
  });

  const [isSymmetryOptionsOpen, setIsSymmetryOptionsOpen] = useState(false);
  const [draggingTarget, setDraggingTarget] = useState<
    'origin' | 'rotation' | { type: 'vp'; index: number } | null
  >(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasCardRef = useRef<HTMLDivElement | null>(null);

  // Sync activeTab with guide type
  const handleSelectTab = (tab: '2d_grid' | 'isometric' | 'perspective' | 'symmetry') => {
    setActiveTab(tab);
    let nextType: DrawingGuideType = '2d_grid';
    if (tab === 'isometric') nextType = 'isometric';
    else if (tab === 'perspective') {
      nextType = 'perspective';
      if (!tempGuide.vanishingPoints || tempGuide.vanishingPoints.length === 0) {
        // Provide a default vanishing point if none exist
        setTempGuide((prev) => ({
          ...prev,
          type: 'perspective',
          vanishingPoints: [
            { id: 'vp_1', x: canvasWidth * 0.5, y: canvasHeight * 0.45, color: '#38bdf8' },
          ],
        }));
        return;
      }
    } else if (tab === 'symmetry') {
      const sym = tempGuide.symmetryOption ?? 'vertical';
      if (sym === 'horizontal') nextType = 'symmetry_horizontal';
      else if (sym === 'quadrant') nextType = 'symmetry_quad';
      else if (sym === 'radial') nextType = 'symmetry_radial';
      else nextType = 'symmetry_vertical';
    }

    setTempGuide((prev) => ({ ...prev, type: nextType }));
  };

  const handleSelectSymmetryOption = (opt: SymmetryOption) => {
    let nextType: DrawingGuideType = 'symmetry_vertical';
    if (opt === 'horizontal') nextType = 'symmetry_horizontal';
    else if (opt === 'quadrant') nextType = 'symmetry_quad';
    else if (opt === 'radial') nextType = 'symmetry_radial';

    setTempGuide((prev) => ({
      ...prev,
      type: nextType,
      symmetryOption: opt,
    }));
  };

  // Canvas click to add perspective vanishing point (on or outside canvas)
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTab !== 'perspective') return;
    if (draggingTarget || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * canvasWidth;
    const clickY = ((e.clientY - rect.top) / rect.height) * canvasHeight;

    const currentVPs = tempGuide.vanishingPoints ?? [];
    if (currentVPs.length >= 5) {
      return; // maximum 5 vanishing points
    }

    pushHistory(tempGuide);

    const vpColors = ['#38bdf8', '#06b6d4', '#ec4899', '#a855f7', '#f59e0b'];
    const newVP: VanishingPoint = {
      id: `vp_${Date.now()}`,
      x: Math.round(clickX),
      y: Math.round(clickY),
      color: vpColors[currentVPs.length % vpColors.length],
    };

    setTempGuide((prev) => ({
      ...prev,
      vanishingPoints: [...(prev.vanishingPoints ?? []), newVP],
    }));
  };

  // Handle dragging origin / rotation / vanishing points
  const handlePointerDownHandle = (e: React.PointerEvent, target: typeof draggingTarget) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingTarget(target);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingTarget || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currX = ((e.clientX - rect.left) / rect.width) * canvasWidth;
    const currY = ((e.clientY - rect.top) / rect.height) * canvasHeight;

    if (draggingTarget === 'origin') {
      setTempGuide((prev) => ({
        ...prev,
        origin: { x: Math.round(currX), y: Math.round(currY) },
      }));
    } else if (draggingTarget === 'rotation') {
      const orig = tempGuide.origin ?? { x: canvasWidth / 2, y: canvasHeight / 2 };
      const rad = Math.atan2(currY - orig.y, currX - orig.x);
      setTempGuide((prev) => ({ ...prev, angle: rad }));
    } else if (typeof draggingTarget === 'object' && draggingTarget.type === 'vp') {
      const idx = draggingTarget.index;
      setTempGuide((prev) => {
        const vps = [...(prev.vanishingPoints ?? [])];
        if (vps[idx]) {
          vps[idx] = { ...vps[idx], x: Math.round(currX), y: Math.round(currY) };
        }
        return { ...prev, vanishingPoints: vps };
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingTarget) {
      e.stopPropagation();
      setDraggingTarget(null);
    }
  };

  const handleDone = () => {
    onChangeGuide(tempGuide);
    onClose();
  };

  const origin = tempGuide.origin ?? { x: canvasWidth / 2, y: canvasHeight / 2 };
  const angle = tempGuide.angle ?? 0;
  const rotPinDist = Math.min(canvasWidth, canvasHeight) * 0.28;
  const rotPinX = origin.x + rotPinDist * Math.cos(angle - Math.PI / 2);
  const rotPinY = origin.y + rotPinDist * Math.sin(angle - Math.PI / 2);

  // Compute rainbow spectrum color from slider
  const handleSpectrumChange = (val: number) => {
    // val 0 to 360
    const hex = `hsl(${val}, 100%, 65%)`;
    setTempGuide((prev) => ({ ...prev, color: hex }));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0d0e12] flex flex-col select-none text-white animate-in fade-in duration-150 overflow-hidden"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Top Header Bar (Matching Video 0:26) */}
      <header className="h-14 mayan-panel border-b border-[#2C3532] px-5 flex items-center justify-between z-20 text-[#E6C699]">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold tracking-wider text-[#E6C699] font-mayan uppercase">Drawing Guides</h1>
        </div>

        {/* Procreate Full 360 Spectrum Hue Bar Slider */}
        <div className="flex items-center gap-3 flex-1 max-w-md mx-6">
          <input
            type="range"
            min={0}
            max={360}
            defaultValue={210}
            onChange={(e) => handleSpectrumChange(Number(e.target.value))}
            className="w-full h-3 rounded-full appearance-none cursor-pointer outline-none border border-[#B89058]/40 shadow-inner"
            style={{
              background:
                'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
            }}
            title="Guide Line Color Spectrum"
          />
          <div
            className="w-5 h-5 rounded-full border-2 border-[#B89058] shadow-md shrink-0"
            style={{ backgroundColor: tempGuide.color }}
          />
        </div>

        {/* Top Right Action Buttons: Undo/Redo, Cancel, Done */}
        <div className="flex items-center gap-2">
          {/* Undo / Redo in Drawing Guides */}
          <div className="flex items-center gap-1 mayan-well p-0.5 rounded-xl border border-[#2C3532] mr-1">
            <button
              onClick={handleUndo}
              disabled={history.length === 0}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                history.length > 0 ? 'text-[#E6C699] hover:bg-white/10' : 'text-[#9E9484]/40 cursor-not-allowed'
              }`}
              title="Undo Guide Adjustment (Ctrl+Z)"
            >
              <Undo2 size={15} />
            </button>
            <button
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                redoStack.length > 0 ? 'text-[#E6C699] hover:bg-white/10' : 'text-[#9E9484]/40 cursor-not-allowed'
              }`}
              title="Redo Guide Adjustment (Ctrl+Shift+Z)"
            >
              <Redo2 size={15} />
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#9E9484] hover:text-[#E6C699] hover:bg-white/10 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleDone}
            title="Commit Drawing Guides"
            className="w-8 h-8 rounded-full mayan-btn-cta flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
          >
            <Check size={16} strokeWidth={3} />
          </button>
        </div>
      </header>

      {/* Perspective Instruction Bar (Matching Video 0:48) */}
      {activeTab === 'perspective' && (
        <div className="w-full bg-[#181a22] py-1.5 text-center text-xs font-medium text-white/60 border-b border-white/5 animate-in fade-in duration-100 flex items-center justify-center gap-3">
          <span>Tap canvas to create vanishing points ({(tempGuide.vanishingPoints ?? []).length}/5)</span>
          {(tempGuide.vanishingPoints ?? []).length > 0 && (
            <button
              onClick={() => setTempGuide((prev) => ({ ...prev, vanishingPoints: [] }))}
              className="text-red-400 hover:text-red-300 text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <Trash2 size={12} /> Clear Points
            </button>
          )}
        </div>
      )}

      {/* Main Interactive Studio Canvas View */}
      <div
        onClick={handleCanvasClick}
        className="flex-1 relative flex items-center justify-center p-12 overflow-hidden checkerboard-pattern cursor-crosshair select-none"
      >
        {/* Canvas preview card (overflow-visible to see guides and points outside) */}
        <div
          ref={containerRef}
          onClick={(e) => {
            e.stopPropagation();
            handleCanvasClick(e);
          }}
          className="relative bg-white shadow-2xl overflow-visible cursor-crosshair border border-white/10"
          style={{
            width: canvasWidth > canvasHeight ? 'min(640px, 70vw)' : 'min(480px, 50vw)',
            aspectRatio: `${canvasWidth} / ${canvasHeight}`,
          }}
        >
          {/* Base artwork preview thumbnail with internal clipping */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {canvasThumbnailUrl && (
              <img
                src={canvasThumbnailUrl}
                alt="Artwork preview"
                className="w-full h-full object-contain opacity-85"
              />
            )}
          </div>

          {/* SVG Overlay for Drawing Guides lines matching exact visual in video */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
          >
            {/* 1. 2D GRID */}
            {activeTab === '2d_grid' && (
              <g
                opacity={tempGuide.opacity}
                stroke={tempGuide.color}
                strokeWidth={tempGuide.thickness}
                transform={`rotate(${(angle * 180) / Math.PI} ${origin.x} ${origin.y})`}
              >
                {/* Horizontal lines */}
                {Array.from({ length: Math.ceil((canvasHeight * 2) / tempGuide.gridSize) }).map((_, i) => {
                  const yPos = (origin.y % tempGuide.gridSize) + (i - 10) * tempGuide.gridSize;
                  return <line key={`h_${i}`} x1={-canvasWidth} y1={yPos} x2={canvasWidth * 2} y2={yPos} />;
                })}
                {/* Vertical lines */}
                {Array.from({ length: Math.ceil((canvasWidth * 2) / tempGuide.gridSize) }).map((_, i) => {
                  const xPos = (origin.x % tempGuide.gridSize) + (i - 10) * tempGuide.gridSize;
                  return <line key={`v_${i}`} x1={xPos} y1={-canvasHeight} x2={xPos} y2={canvasHeight * 2} />;
                })}
              </g>
            )}

            {/* 2. ISOMETRIC GRID */}
            {/* 2. ISOMETRIC GRID (Classic 30° / 90° / 150° Triangular Grid) */}
            {activeTab === 'isometric' && (
              <g
                opacity={tempGuide.opacity}
                stroke={tempGuide.color}
                strokeWidth={tempGuide.thickness}
                transform={`rotate(${(angle * 180) / Math.PI} ${origin.x} ${origin.y})`}
              >
                {/* 1. 90° Vertical lines */}
                {Array.from({ length: Math.ceil((canvasWidth * 2.5) / tempGuide.gridSize) }).map((_, i) => {
                  const xPos = origin.x - canvasWidth + i * tempGuide.gridSize;
                  return (
                    <line
                      key={`iso_v_${i}`}
                      x1={xPos}
                      y1={-canvasHeight}
                      x2={xPos}
                      y2={canvasHeight * 2}
                    />
                  );
                })}
                {/* 2. 30° and 150° diagonals */}
                {Array.from({ length: Math.ceil((canvasHeight * 3.5) / (tempGuide.gridSize * 0.866)) }).map((_, i) => {
                  const dy = (i - 20) * (tempGuide.gridSize * 1.732);
                  const tan30 = 0.57735; // 1 / sqrt(3)
                  return (
                    <React.Fragment key={`iso_diag_${i}`}>
                      {/* +30° diagonal */}
                      <line
                        x1={origin.x - canvasWidth * 1.5}
                        y1={origin.y + dy - canvasWidth * 1.5 * tan30}
                        x2={origin.x + canvasWidth * 1.5}
                        y2={origin.y + dy + canvasWidth * 1.5 * tan30}
                      />
                      {/* -30° / 150° diagonal */}
                      <line
                        x1={origin.x - canvasWidth * 1.5}
                        y1={origin.y + dy + canvasWidth * 1.5 * tan30}
                        x2={origin.x + canvasWidth * 1.5}
                        y2={origin.y + dy - canvasWidth * 1.5 * tan30}
                      />
                    </React.Fragment>
                  );
                })}
              </g>
            )}

            {/* 3. PERSPECTIVE GRID (Matching Video 0:48 - 0:58) */}
            {activeTab === 'perspective' && (
              <g opacity={tempGuide.opacity}>
                {/* Horizon line between VP1 and VP2 */}
                {(tempGuide.vanishingPoints ?? []).length >= 2 && (
                  <line
                    x1={tempGuide.vanishingPoints![0].x}
                    y1={tempGuide.vanishingPoints![0].y}
                    x2={tempGuide.vanishingPoints![1].x}
                    y2={tempGuide.vanishingPoints![1].y}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                )}

                {/* Perspective rays radiating from each vanishing point */}
                {(tempGuide.vanishingPoints ?? []).map((vp, vIdx) => {
                  const rayAngles = Array.from({ length: 24 }).map((_, i) => (i * Math.PI) / 12);
                  return (
                    <g key={vp.id} stroke={vp.color || tempGuide.color} strokeWidth={tempGuide.thickness}>
                      {rayAngles.map((a, aIdx) => (
                        <line
                          key={aIdx}
                          x1={vp.x}
                          y1={vp.y}
                          x2={vp.x + 2000 * Math.cos(a)}
                          y2={vp.y + 2000 * Math.sin(a)}
                        />
                      ))}
                    </g>
                  );
                })}
              </g>
            )}

            {/* 4. SYMMETRY (Matching Video 1:01 - 1:15) */}
            {activeTab === 'symmetry' && (
              <g opacity={tempGuide.opacity} stroke={tempGuide.color} strokeWidth={tempGuide.thickness * 1.5}>
                {/* Vertical axis */}
                {(tempGuide.symmetryOption === 'vertical' ||
                  tempGuide.symmetryOption === 'quadrant' ||
                  tempGuide.symmetryOption === 'radial') && (
                  <line x1={origin.x} y1={-1000} x2={origin.x} y2={canvasHeight + 1000} />
                )}

                {/* Horizontal axis */}
                {(tempGuide.symmetryOption === 'horizontal' ||
                  tempGuide.symmetryOption === 'quadrant' ||
                  tempGuide.symmetryOption === 'radial') && (
                  <line x1={-1000} y1={origin.y} x2={canvasWidth + 1000} y2={origin.y} />
                )}

                {/* Diagonal axes for Radial (8 sectors) */}
                {tempGuide.symmetryOption === 'radial' && (
                  <>
                    <line
                      x1={origin.x - 2000}
                      y1={origin.y - 2000}
                      x2={origin.x + 2000}
                      y2={origin.y + 2000}
                    />
                    <line
                      x1={origin.x - 2000}
                      y1={origin.y + 2000}
                      x2={origin.x + 2000}
                      y2={origin.y - 2000}
                    />
                  </>
                )}
              </g>
            )}
          </svg>

          {/* Interactive Origin Center Dot (White Circle) */}
          <div
            className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white border-2 border-black/60 shadow-lg cursor-move pointer-events-auto hover:scale-125 transition-transform"
            style={{
              left: `${(origin.x / canvasWidth) * 100}%`,
              top: `${(origin.y / canvasHeight) * 100}%`,
            }}
            onPointerDown={(e) => handlePointerDownHandle(e, 'origin')}
            title="Drag to reposition guide origin"
          />

          {/* Interactive Green Rotational Angle Pin (Matching Video 0:26) */}
          {(activeTab === '2d_grid' || activeTab === 'isometric') && (
            <div
              className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400 border-2 border-white shadow-lg cursor-pointer pointer-events-auto hover:scale-125 transition-transform"
              style={{
                left: `${(rotPinX / canvasWidth) * 100}%`,
                top: `${(rotPinY / canvasHeight) * 100}%`,
              }}
              onPointerDown={(e) => handlePointerDownHandle(e, 'rotation')}
              title="Drag to rotate grid angle"
            />
          )}

          {/* Perspective Vanishing Point Draggable Pins & Dynamic Outer Margin Anchors */}
          {activeTab === 'perspective' &&
            (tempGuide.vanishingPoints ?? []).map((vp, idx) => {
              const isOutside =
                vp.x < 0 || vp.x > canvasWidth || vp.y < 0 || vp.y > canvasHeight;

              const clampedX = Math.max(2, Math.min(98, (vp.x / canvasWidth) * 100));
              const clampedY = Math.max(2, Math.min(98, (vp.y / canvasHeight) * 100));

              return (
                <React.Fragment key={vp.id}>
                  {/* Connecting ray from margin to off-canvas point */}
                  {isOutside && (
                    <svg
                      className="absolute inset-0 pointer-events-none overflow-visible"
                      style={{ width: '100%', height: '100%' }}
                    >
                      <line
                        x1={`${clampedX}%`}
                        y1={`${clampedY}%`}
                        x2={`${(vp.x / canvasWidth) * 100}%`}
                        y2={`${(vp.y / canvasHeight) * 100}%`}
                        stroke={vp.color}
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                        opacity={0.8}
                      />
                    </svg>
                  )}

                  {/* Primary Vanishing Point Handle (Draggable anywhere on or outside canvas) */}
                  <div
                    className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-2xl cursor-pointer pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center font-bold text-[9px] text-white z-20"
                    style={{
                      left: `${(vp.x / canvasWidth) * 100}%`,
                      top: `${(vp.y / canvasHeight) * 100}%`,
                      backgroundColor: vp.color,
                    }}
                    onPointerDown={(e) => handlePointerDownHandle(e, { type: 'vp', index: idx })}
                    title={`Vanishing Point #${idx + 1} (${vp.x}, ${vp.y}) ${isOutside ? '(Outside canvas)' : ''}`}
                  >
                    {idx + 1}
                  </div>

                  {/* Dynamic guide pins anchored along outer workspace margin */}
                  {isOutside && (
                    <div
                      className="absolute -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-auto cursor-grab active:cursor-grabbing flex items-center gap-1 bg-[#121418]/95 border-2 rounded-full px-2 py-0.5 shadow-2xl hover:scale-110 transition-transform text-[10px] font-mono font-bold text-white whitespace-nowrap"
                      style={{
                        left: `${clampedX}%`,
                        top: `${clampedY}%`,
                        borderColor: vp.color,
                      }}
                      onPointerDown={(e) => handlePointerDownHandle(e, { type: 'vp', index: idx })}
                      title={`Outer Margin Pin for VP #${idx + 1} · Drag to reposition vanishing point`}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: vp.color }} />
                      <span>VP{idx + 1}</span>
                      <span className="text-[9px] text-white/50">
                        {vp.x < 0 ? `${vp.x}` : vp.x > canvasWidth ? `+${vp.x - canvasWidth}` : `${vp.y}`}px
                      </span>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
        </div>
      </div>

      {/* Symmetry Guide Options Popover (Matching Video 1:07 - 1:12) */}
      {isSymmetryOptionsOpen && activeTab === 'symmetry' && (
        <div
          className="fixed bottom-36 left-1/2 -translate-x-1/2 z-40 w-64 mayan-panel relative p-3 flex flex-col gap-1 text-xs text-[#E6C699] shadow-2xl animate-in slide-in-from-bottom-2 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <MayanCornerBrackets size={12} />
          <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[#B89058] border-b border-[#2C3532] mb-1 font-mayan">
            Guide Options
          </div>
          {(
            [
              { id: 'vertical', label: 'Vertical' },
              { id: 'horizontal', label: 'Horizontal' },
              { id: 'quadrant', label: 'Quadrant' },
              { id: 'radial', label: 'Radial' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelectSymmetryOption(item.id)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                tempGuide.symmetryOption === item.id
                  ? 'mayan-btn-jade text-[#F4FBF7] font-semibold'
                  : 'text-[#D9BC94] hover:bg-white/10'
              }`}
            >
              <span className="font-mayan">{item.label}</span>
              {tempGuide.symmetryOption === item.id && <Check size={14} />}
            </button>
          ))}

          <div className="h-px bg-white/10 my-1" />

          {/* Rotational Symmetry Toggle */}
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-white/80">Rotational Symmetry</span>
            <input
              type="checkbox"
              checked={Boolean(tempGuide.rotationalSymmetry)}
              onChange={(e) =>
                setTempGuide((prev) => ({ ...prev, rotationalSymmetry: e.target.checked }))
              }
              className="accent-blue-500 rounded cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Bottom Floating Control Card (Matching Video 0:26–0:45) */}
      <div className="fixed bottom-6 inset-x-0 mx-auto w-full max-w-xl z-30 px-4">
        <div className="mayan-panel relative p-3.5 flex flex-col gap-2.5 text-xs text-[#E6C699] shadow-2xl">
          <MayanCornerBrackets size={14} />

          {/* 4 Mode Segmented Tabs: 2D Grid, Isometric, Perspective, Symmetry */}
          <div className="grid grid-cols-4 mayan-well p-1 rounded-xl text-xs font-medium text-[#9E9484]">
            <button
              onClick={() => handleSelectTab('2d_grid')}
              className={`py-1.5 rounded-lg transition-all cursor-pointer font-mayan text-[11px] ${
                activeTab === '2d_grid'
                  ? 'mayan-btn-jade text-[#F4FBF7] font-semibold shadow-sm'
                  : 'hover:text-[#E6C699]'
              }`}
            >
              2D Grid
            </button>
            <button
              onClick={() => handleSelectTab('isometric')}
              className={`py-1.5 rounded-lg transition-all cursor-pointer font-mayan text-[11px] ${
                activeTab === 'isometric'
                  ? 'mayan-btn-jade text-[#F4FBF7] font-semibold shadow-sm'
                  : 'hover:text-[#E6C699]'
              }`}
            >
              Isometric
            </button>
            <button
              onClick={() => handleSelectTab('perspective')}
              className={`py-1.5 rounded-lg transition-all cursor-pointer font-mayan text-[11px] ${
                activeTab === 'perspective'
                  ? 'mayan-btn-jade text-[#F4FBF7] font-semibold shadow-sm'
                  : 'hover:text-[#E6C699]'
              }`}
            >
              Perspective
            </button>
            <button
              onClick={() => handleSelectTab('symmetry')}
              className={`py-1.5 rounded-lg transition-all cursor-pointer font-mayan text-[11px] ${
                activeTab === 'symmetry'
                  ? 'mayan-btn-jade text-[#F4FBF7] font-semibold shadow-sm'
                  : 'hover:text-[#E6C699]'
              }`}
            >
              Symmetry
            </button>
          </div>

          {/* Sliders & Switches Row */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1 text-xs">
            {/* Opacity Slider */}
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-[11px]">Opacity</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={Math.round(tempGuide.opacity * 100)}
                  onChange={(e) =>
                    setTempGuide((prev) => ({ ...prev, opacity: Number(e.target.value) / 100 }))
                  }
                  className="w-24 accent-blue-500 cursor-pointer"
                />
                <span className="font-mono text-white text-[11px] w-8 text-right">
                  {Math.round(tempGuide.opacity * 100)}%
                </span>
              </div>
            </div>

            {/* Thickness Slider */}
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-[11px]">Thickness</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={Math.round((tempGuide.thickness / 5) * 100)}
                  onChange={(e) =>
                    setTempGuide((prev) => ({
                      ...prev,
                      thickness: Math.max(0.5, (Number(e.target.value) / 100) * 5),
                    }))
                  }
                  className="w-24 accent-blue-500 cursor-pointer"
                />
                <span className="font-mono text-white text-[11px] w-8 text-right">
                  {Math.round((tempGuide.thickness / 5) * 100)}%
                </span>
              </div>
            </div>

            {/* Grid Size Slider (for 2D and Isometric) */}
            {(activeTab === '2d_grid' || activeTab === 'isometric') && (
              <div className="flex items-center justify-between">
                <span className="text-white/60 text-[11px]">Grid size</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={20}
                    max={200}
                    value={tempGuide.gridSize}
                    onChange={(e) =>
                      setTempGuide((prev) => ({ ...prev, gridSize: Number(e.target.value) }))
                    }
                    className="w-24 accent-blue-500 cursor-pointer"
                  />
                  <span className="font-mono text-white text-[11px] w-8 text-right">
                    {tempGuide.gridSize}px
                  </span>
                </div>
              </div>
            )}

            {/* Assisted Drawing Switch */}
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-[11px]">Assisted Drawing</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={tempGuide.assisted}
                  onChange={(e) =>
                    setTempGuide((prev) => ({ ...prev, assisted: e.target.checked }))
                  }
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-[#2a2d38] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600" />
              </label>
            </div>
          </div>

          {/* Symmetry Options Button (Matching Video 1:06) */}
          {activeTab === 'symmetry' && (
            <div className="pt-1 flex items-center justify-start border-t border-[#2C3532]">
              <button
                onClick={() => setIsSymmetryOptionsOpen(!isSymmetryOptionsOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  isSymmetryOptionsOpen
                    ? 'mayan-btn-jade text-[#F4FBF7]'
                    : 'mayan-btn-stone text-[#E6C699]'
                }`}
              >
                <Sliders size={13} />
                <span className="font-mayan">Options ({tempGuide.symmetryOption})</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
