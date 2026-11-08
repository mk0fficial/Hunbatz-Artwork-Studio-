import React, { useRef, useState, useEffect } from 'react';
import { VectorShapeConfig, Point2D } from '../types/shapes';
import { Brush } from '../types/canvas';
import { renderVectorShape, simplifyPointsRDP } from '../utils/shapeRenderer';

interface VectorShapeOverlayProps {
  config: VectorShapeConfig;
  activeBrush: Brush;
  zoom: number;
  pan: { x: number; y: number };
  canvasWidth: number;
  canvasHeight: number;
  onChangeConfig: (updates: Partial<VectorShapeConfig>) => void;
}

type DragTarget =
  | 'body'
  | 'handle_tl'
  | 'handle_tr'
  | 'handle_br'
  | 'handle_bl'
  | 'tail_tip'
  | 'thought_origin'
  | 'triangle_v0'
  | 'triangle_v1'
  | 'triangle_v2'
  | { type: 'path_point'; index: number };

export const VectorShapeOverlay: React.FC<VectorShapeOverlayProps> = ({
  config,
  activeBrush,
  zoom,
  pan,
  canvasWidth,
  canvasHeight,
  onChangeConfig,
}) => {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeDrag, setActiveDrag] = useState<DragTarget | null>(null);

  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    initialConfig: VectorShapeConfig;
  }>({
    pointerX: 0,
    pointerY: 0,
    initialConfig: { ...config },
  });

  // Calculate exact canvas-space coordinates relative to the workspace container
  const getCanvasPos = (clientX: number, clientY: number) => {
    const rect = overlayRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  };

  const toScreenX = (x: number) => pan.x + x * zoom;
  const toScreenY = (y: number) => pan.y + y * zoom;

  // Redraw canvas preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    renderVectorShape(ctx, config, activeBrush);
  }, [config, activeBrush, canvasWidth, canvasHeight]);

  // Listen for Shift + S to remove selected path point
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === 's' || e.key === 'S')) {
        if (
          config.type === 'brush_path' &&
          config.pathPoints &&
          config.selectedPointIndex !== null &&
          config.selectedPointIndex !== undefined &&
          config.pathPoints.length > 2
        ) {
          const idx = config.selectedPointIndex;
          const nextPts = config.pathPoints.filter((_, i) => i !== idx);
          onChangeConfig({
            pathPoints: nextPts,
            selectedPointIndex: null,
          });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config, onChangeConfig]);

  const handleRemovePoint = (indexToRemove: number) => {
    if (!config.pathPoints || config.pathPoints.length <= 2) return;
    const nextPts = config.pathPoints.filter((_, i) => i !== indexToRemove);
    onChangeConfig({
      pathPoints: nextPts,
      selectedPointIndex: null,
    });
  };

  // --- TRAIL DRAWING (Freehand with ~70-85% point reduction via RDP) ---
  const trailPointsRef = useRef<Point2D[]>([]);
  const [isDrawingTrailActive, setIsDrawingTrailActive] = useState(false);

  const handleTrailPointerDown = (e: React.PointerEvent) => {
    if (!config.isDrawingTrail) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDrawingTrailActive(true);
    const { x: canvasX, y: canvasY } = getCanvasPos(e.clientX, e.clientY);
    trailPointsRef.current = [{ x: Math.round(canvasX), y: Math.round(canvasY), width: config.strokeWidth }];
  };

  const handleTrailPointerMove = (e: React.PointerEvent) => {
    if (!config.isDrawingTrail || !isDrawingTrailActive) return;
    e.stopPropagation();
    const { x: canvasX, y: canvasY } = getCanvasPos(e.clientX, e.clientY);
    const last = trailPointsRef.current[trailPointsRef.current.length - 1];
    if (!last || Math.hypot(canvasX - last.x, canvasY - last.y) >= 12) {
      trailPointsRef.current.push({ x: Math.round(canvasX), y: Math.round(canvasY), width: config.strokeWidth });
      onChangeConfig({ pathPoints: [...trailPointsRef.current] });
    }
  };

  const handleTrailPointerUp = (e: React.PointerEvent) => {
    if (!config.isDrawingTrail || !isDrawingTrailActive) return;
    e.stopPropagation();
    setIsDrawingTrailActive(false);

    if (trailPointsRef.current.length >= 2) {
      // Smart Point Reduction: Run Ramer-Douglas-Peucker with epsilon=4.8 to reduce points by 70-85%!
      const simplifiedPts = simplifyPointsRDP(trailPointsRef.current, 4.8);

      const xs = simplifiedPts.map((p) => p.x);
      const ys = simplifiedPts.map((p) => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);

      onChangeConfig({
        x: minX,
        y: minY,
        width: Math.max(40, maxX - minX),
        height: Math.max(40, maxY - minY),
        pathPoints: simplifiedPts,
        isDrawingTrail: false,
      });
    }
  };

  // --- CLICK ON SPACE BETWEEN POINTS / ON LINE TO ADD POINT ---
  const handleAddPointAtCoord = (e: React.MouseEvent) => {
    e.stopPropagation();
    const { x: canvasX, y: canvasY } = getCanvasPos(e.clientX, e.clientY);
    const currentPts = config.pathPoints || [];
    if (currentPts.length === 0) {
      onChangeConfig({ pathPoints: [{ x: Math.round(canvasX), y: Math.round(canvasY), width: config.strokeWidth }] });
      return;
    }

    let bestIdx = currentPts.length;
    let bestDist = Infinity;
    for (let i = 0; i < currentPts.length - 1; i++) {
      const p1 = currentPts[i];
      const p2 = currentPts[i + 1];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const dist = Math.hypot(canvasX - midX, canvasY - midY);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i + 1;
      }
    }

    const nextPts = [...currentPts];
    nextPts.splice(bestIdx, 0, { x: Math.round(canvasX), y: Math.round(canvasY), width: config.strokeWidth });
    onChangeConfig({
      pathPoints: nextPts,
      selectedPointIndex: bestIdx,
    });
  };

  // --- PROLONGED HOLD GROWING CIRCLE (AREA OF EFFECT THICKENING) ---
  const [holdAura, setHoldAura] = useState<{
    screenX: number;
    screenY: number;
    canvasX: number;
    canvasY: number;
    radius: number;
    addedThickness: number;
  } | null>(null);

  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pointerDownPosRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const currentPtsRef = useRef<Point2D[]>(config.pathPoints || []);
  currentPtsRef.current = config.pathPoints || [];

  const startHoldTimer = (clientX: number, clientY: number) => {
    if (config.type !== 'brush_path' || config.isDrawingTrail) return;
    pointerDownPosRef.current = { clientX, clientY };

    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);

    holdTimeoutRef.current = setTimeout(() => {
      const { x: cX, y: cY } = getCanvasPos(clientX, clientY);
      const rect = overlayRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
      const sX = clientX - rect.left;
      const sY = clientY - rect.top;

      let curRadius = 14;
      let curAdded = 0.5;

      setHoldAura({
        screenX: sX,
        screenY: sY,
        canvasX: cX,
        canvasY: cY,
        radius: curRadius,
        addedThickness: curAdded,
      });

      holdIntervalRef.current = setInterval(() => {
        curRadius = Math.min(110, curRadius + 1.4);
        const intensityStep = 0.35;
        curAdded += intensityStep;

        setHoldAura({
          screenX: sX,
          screenY: sY,
          canvasX: cX,
          canvasY: cY,
          radius: curRadius,
          addedThickness: curAdded,
        });

        // Smooth cosine falloff for all points within the area of effect
        const updatedPts = currentPtsRef.current.map((pt) => {
          const dist = Math.hypot(pt.x - cX, pt.y - cY);
          if (dist <= curRadius) {
            const factor = Math.cos((dist / curRadius) * (Math.PI / 2));
            const currentW = pt.width ?? config.strokeWidth;
            const nextW = Math.min(100, Math.max(1, currentW + intensityStep * factor));
            return { ...pt, width: Number(nextW.toFixed(1)) };
          }
          return pt;
        });

        currentPtsRef.current = updatedPts;
        onChangeConfig({ pathPoints: updatedPts });
      }, 40);
    }, 280);
  };

  const cancelHoldTimer = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setHoldAura(null);
    pointerDownPosRef.current = null;
  };

  // --- STANDARD DRAGGING HANDLERS ---
  const handlePointerDown = (e: React.PointerEvent, target: DragTarget) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setActiveDrag(target);
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      initialConfig: JSON.parse(JSON.stringify(config)),
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // If pointer moved more than 6px during hold timer, cancel hold (user intends to drag!)
    if (pointerDownPosRef.current) {
      const dist = Math.hypot(e.clientX - pointerDownPosRef.current.clientX, e.clientY - pointerDownPosRef.current.clientY);
      if (dist > 6) {
        cancelHoldTimer();
      }
    }

    if (!activeDrag) return;
    e.stopPropagation();

    const dx = (e.clientX - dragStartRef.current.pointerX) / zoom;
    const dy = (e.clientY - dragStartRef.current.pointerY) / zoom;
    const init = dragStartRef.current.initialConfig;

    if (activeDrag === 'body') {
      const newX = Math.round(init.x + dx);
      const newY = Math.round(init.y + dy);
      const updates: Partial<VectorShapeConfig> = { x: newX, y: newY };

      if (init.tailTip) {
        updates.tailTip = { x: init.tailTip.x + dx, y: init.tailTip.y + dy };
      }
      if (init.thoughtOrigin) {
        updates.thoughtOrigin = { x: init.thoughtOrigin.x + dx, y: init.thoughtOrigin.y + dy };
      }
      if (init.triangleVertices) {
        updates.triangleVertices = [
          { x: init.triangleVertices[0].x + dx, y: init.triangleVertices[0].y + dy },
          { x: init.triangleVertices[1].x + dx, y: init.triangleVertices[1].y + dy },
          { x: init.triangleVertices[2].x + dx, y: init.triangleVertices[2].y + dy },
        ];
      }
      if (init.pathPoints) {
        updates.pathPoints = init.pathPoints.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
      }

      onChangeConfig(updates);
      return;
    }

    if (activeDrag === 'handle_br') {
      const newW = Math.max(20, Math.round(init.width + dx));
      const newH = Math.max(20, Math.round(init.height + dy));
      onChangeConfig({
        width: config.type === 'square' ? Math.max(newW, newH) : newW,
        height: config.type === 'square' ? Math.max(newW, newH) : newH,
      });
      return;
    }

    if (activeDrag === 'handle_tl') {
      const newX = Math.round(init.x + dx);
      const newY = Math.round(init.y + dy);
      const newW = Math.max(20, Math.round(init.width - dx));
      const newH = Math.max(20, Math.round(init.height - dy));
      onChangeConfig({ x: newX, y: newY, width: newW, height: newH });
      return;
    }

    if (activeDrag === 'handle_tr') {
      const newY = Math.round(init.y + dy);
      const newW = Math.max(20, Math.round(init.width + dx));
      const newH = Math.max(20, Math.round(init.height - dy));
      onChangeConfig({ y: newY, width: newW, height: newH });
      return;
    }

    if (activeDrag === 'handle_bl') {
      const newX = Math.round(init.x + dx);
      const newW = Math.max(20, Math.round(init.width - dx));
      const newH = Math.max(20, Math.round(init.height + dy));
      onChangeConfig({ x: newX, width: newW, height: newH });
      return;
    }

    if (activeDrag === 'tail_tip') {
      const baseTail = init.tailTip || { x: init.x + init.width * 0.2, y: init.y + init.height + 50 };
      onChangeConfig({
        tailTip: {
          x: Math.round(baseTail.x + dx),
          y: Math.round(baseTail.y + dy),
        },
      });
      return;
    }

    if (activeDrag === 'thought_origin') {
      const baseOrigin = init.thoughtOrigin || { x: init.x + init.width * 0.2, y: init.y + init.height + 60 };
      onChangeConfig({
        thoughtOrigin: {
          x: Math.round(baseOrigin.x + dx),
          y: Math.round(baseOrigin.y + dy),
        },
      });
      return;
    }

    if (typeof activeDrag === 'object' && activeDrag.type === 'path_point') {
      const idx = activeDrag.index;
      if (init.pathPoints && init.pathPoints[idx]) {
        const nextPts = [...init.pathPoints];
        nextPts[idx] = {
          ...init.pathPoints[idx],
          x: Math.round(init.pathPoints[idx].x + dx),
          y: Math.round(init.pathPoints[idx].y + dy),
        };
        onChangeConfig({ pathPoints: nextPts });
      }
      return;
    }

    if (typeof activeDrag === 'string' && activeDrag.startsWith('triangle_v')) {
      const idx = Number(activeDrag.replace('triangle_v', ''));
      const vertices = init.triangleVertices || [
        { x: init.x + init.width / 2, y: init.y },
        { x: init.x + init.width, y: init.y + init.height },
        { x: init.x, y: init.y + init.height },
      ];
      const nextVertices: [Point2D, Point2D, Point2D] = [...vertices];
      nextVertices[idx] = {
        x: Math.round(vertices[idx].x + dx),
        y: Math.round(vertices[idx].y + dy),
      };
      onChangeConfig({ triangleVertices: nextVertices });
      return;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    cancelHoldTimer();
    if (activeDrag) {
      e.stopPropagation();
      setActiveDrag(null);
    }
  };

  const { x, y, width, height } = config;

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none z-30 select-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerDown={(e) => {
        if (config.type === 'brush_path' && !config.isDrawingTrail) {
          startHoldTimer(e.clientX, e.clientY);
        }
      }}
    >
      {/* Canvas preview layer positioned exact with zoom & pan */}
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="absolute origin-top-left pointer-events-none"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          width: canvasWidth,
          height: canvasHeight,
        }}
      />

      {/* Growing Radial Area of Effect Aura Circle */}
      {holdAura && (
        <div
          className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-400 bg-cyan-400/25 shadow-[0_0_25px_rgba(34,211,238,0.7)] flex items-center justify-center animate-pulse z-50"
          style={{
            left: holdAura.screenX,
            top: holdAura.screenY,
            width: holdAura.radius * 2 * zoom,
            height: holdAura.radius * 2 * zoom,
          }}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-300 ring-4 ring-cyan-400/50" />
          <div className="absolute -top-7 whitespace-nowrap bg-[#0e1017]/95 border border-cyan-400/70 text-cyan-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow-xl">
            Thickening: +{holdAura.addedThickness.toFixed(1)}px (Radius: {Math.round(holdAura.radius)}px)
          </div>
        </div>
      )}

      {/* Bounding Box / Body Drag area */}
      <div
        className="absolute border border-blue-400/60 dashed-border pointer-events-auto cursor-move"
        style={{
          left: toScreenX(x),
          top: toScreenY(y),
          width: width * zoom,
          height: height * zoom,
        }}
        onPointerDown={(e) => handlePointerDown(e, 'body')}
      >
        <div className="absolute -top-5 left-0 text-[10px] font-mono font-bold bg-blue-600/90 text-white px-1.5 py-0.5 rounded shadow whitespace-nowrap">
          {config.type.replace('_', ' ').toUpperCase()} • {Math.round(width)}×{Math.round(height)}
        </div>
      </div>

      {/* Corner Handles */}
      <div
        className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 bg-white border-2 border-blue-500 rounded-sm shadow-md pointer-events-auto cursor-nwse-resize hover:scale-125 transition-transform"
        style={{ left: toScreenX(x), top: toScreenY(y) }}
        onPointerDown={(e) => handlePointerDown(e, 'handle_tl')}
      />
      <div
        className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 bg-white border-2 border-blue-500 rounded-sm shadow-md pointer-events-auto cursor-nesw-resize hover:scale-125 transition-transform"
        style={{ left: toScreenX(x + width), top: toScreenY(y) }}
        onPointerDown={(e) => handlePointerDown(e, 'handle_tr')}
      />
      <div
        className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 bg-white border-2 border-blue-500 rounded-sm shadow-md pointer-events-auto cursor-nwse-resize hover:scale-125 transition-transform"
        style={{ left: toScreenX(x + width), top: toScreenY(y + height) }}
        onPointerDown={(e) => handlePointerDown(e, 'handle_br')}
      />
      <div
        className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 bg-white border-2 border-blue-500 rounded-sm shadow-md pointer-events-auto cursor-nesw-resize hover:scale-125 transition-transform"
        style={{ left: toScreenX(x), top: toScreenY(y + height) }}
        onPointerDown={(e) => handlePointerDown(e, 'handle_bl')}
      />

      {/* Interactive Tail Tip Handle for Speech Bubble */}
      {config.type === 'speech_bubble' && (
        (() => {
          const tail = config.tailTip || { x: x + width * 0.2, y: y + height + 50 };
          return (
            <div
              className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 bg-amber-400 border-2 border-white rounded-full shadow-lg pointer-events-auto cursor-pointer hover:scale-125 transition-transform"
              style={{ left: toScreenX(tail.x), top: toScreenY(tail.y) }}
              onPointerDown={(e) => handlePointerDown(e, 'tail_tip')}
              title="Drag speech bubble tail"
            >
              <div className="absolute left-5 top-0 text-[9px] bg-black/80 text-amber-300 font-mono px-1 rounded whitespace-nowrap">
                Tail Tip
              </div>
            </div>
          );
        })()
      )}

      {/* Interactive Thought Origin Handle for Thought Bubble */}
      {config.type === 'thought_bubble' && (
        (() => {
          const origin = config.thoughtOrigin || { x: x + width * 0.2, y: y + height + 60 };
          return (
            <div
              className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 bg-sky-400 border-2 border-white rounded-full shadow-lg pointer-events-auto cursor-pointer hover:scale-125 transition-transform"
              style={{ left: toScreenX(origin.x), top: toScreenY(origin.y) }}
              onPointerDown={(e) => handlePointerDown(e, 'thought_origin')}
              title="Drag thought bubble origin"
            >
              <div className="absolute left-5 top-0 text-[9px] bg-black/80 text-sky-300 font-mono px-1 rounded whitespace-nowrap">
                Origin
              </div>
            </div>
          );
        })()
      )}

      {/* Freehand Trail Drawing Capture Overlay */}
      {config.type === 'brush_path' && config.isDrawingTrail && (
        <div
          className="absolute inset-0 pointer-events-auto cursor-crosshair z-40 bg-black/15"
          onPointerDown={handleTrailPointerDown}
          onPointerMove={handleTrailPointerMove}
          onPointerUp={handleTrailPointerUp}
        >
          <div className="absolute top-24 inset-x-0 mx-auto w-fit bg-[#121418]/95 border border-emerald-500/50 rounded-xl px-3 py-1.5 shadow-2xl text-xs text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Draw freely across canvas to form brush line · Release to simplify & edit points</span>
          </div>
        </div>
      )}

      {/* SVG Clickable Path Line to Add Points Directly */}
      {config.type === 'brush_path' && config.pathPoints && config.pathPoints.length >= 2 && !config.isDrawingTrail && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ width: '100%', height: '100%' }}
        >
          {config.pathPoints.slice(0, -1).map((pt, i) => {
            const next = config.pathPoints![i + 1];
            return (
              <line
                key={`line_${i}`}
                x1={toScreenX(pt.x)}
                y1={toScreenY(pt.y)}
                x2={toScreenX(next.x)}
                y2={toScreenY(next.y)}
                stroke="transparent"
                strokeWidth={20}
                className="pointer-events-auto cursor-copy hover:stroke-emerald-400/40 transition-colors"
                onClick={handleAddPointAtCoord}
                onPointerDown={(e) => startHoldTimer(e.clientX, e.clientY)}
              >
                <title>Click space between points to add point · Hold to thicken line</title>
              </line>
            );
          })}
        </svg>
      )}

      {/* Interactive Spline Control Points for Brush Path */}
      {config.type === 'brush_path' && !config.isDrawingTrail && (
        config.pathPoints?.map((pt, idx) => {
          const isSelected = config.selectedPointIndex === idx;
          const ptW = pt.width ?? config.strokeWidth;
          return (
            <div
              key={idx}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full shadow-lg pointer-events-auto cursor-pointer transition-transform ${
                isSelected
                  ? 'bg-amber-400 border-2 border-white scale-125 ring-2 ring-amber-400/60'
                  : 'bg-emerald-400 border-2 border-white hover:scale-125'
              }`}
              style={{
                left: toScreenX(pt.x),
                top: toScreenY(pt.y),
                width: Math.max(14, Math.min(26, ptW * zoom)),
                height: Math.max(14, Math.min(26, ptW * zoom)),
              }}
              onPointerDown={(e) => {
                if (e.shiftKey) {
                  e.stopPropagation();
                  e.preventDefault();
                  handleRemovePoint(idx);
                  return;
                }
                startHoldTimer(e.clientX, e.clientY);
                onChangeConfig({ selectedPointIndex: idx });
                handlePointerDown(e, { type: 'path_point', index: idx });
              }}
              title={`Drag point #${idx + 1} (${ptW}px) · Shift+Click to remove · Hold to thicken`}
            >
              <div className="absolute -top-4 -left-1 text-[9px] font-mono font-bold text-emerald-300 bg-black/85 px-1 rounded whitespace-nowrap shadow pointer-events-none">
                P{idx + 1} {pt.width ? `· ${Math.round(pt.width)}px` : ''}
              </div>
            </div>
          );
        })
      )}

      {/* Interactive Triangle Vertex Handles */}
      {config.type === 'triangle' && (
        (config.triangleVertices || [
          { x: x + width / 2, y: y },
          { x: x + width, y: y + height },
          { x, y: y + height },
        ]).map((v, idx) => (
          <div
            key={idx}
            className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 bg-purple-400 border-2 border-white rounded-full shadow-lg pointer-events-auto cursor-pointer hover:scale-125 transition-transform"
            style={{ left: toScreenX(v.x), top: toScreenY(v.y) }}
            onPointerDown={(e) => handlePointerDown(e, `triangle_v${idx}` as DragTarget)}
            title={`Drag triangle vertex #${idx + 1}`}
          />
        ))
      )}
    </div>
  );
};
