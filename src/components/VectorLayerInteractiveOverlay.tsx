import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Layer, VectorPath, VectorPoint, BrushTexture } from '../types/canvas';
import { VectorToolSubMode } from './VectorPenToolbar';
import {
  stabilizeStrokePoints,
  addNodeToVectorPath,
  deleteNodeFromVectorPath,
  eraseWholeVectorPath,
  eraseToIntersection,
  applyTargetedThickening,
  renderVectorPathsToContext,
  distanceToSegment,
} from '../utils/vectorEngine';

interface VectorLayerInteractiveOverlayProps {
  activeLayer: Layer;
  zoom: number;
  pan: { x: number; y: number };
  canvasWidth: number;
  canvasHeight: number;
  editMode: VectorToolSubMode;
  strokeWidth: number;
  strokeColor: string;
  hasFill: boolean;
  fillColor: string;
  isClosed: boolean;
  brushTexture: BrushTexture;
  lineCorrection: number; // 0 - 100
  thickenFactor: number;
  isShiftLocked?: boolean;
  onUpdateLayerPaths: (paths: VectorPath[]) => void;
  onPushHistory: () => void;
  onShowToast?: (msg: string) => void;
  onSelectLastPathConfig?: (cfg: {
    strokeWidth: number;
    strokeColor: string;
    brushTexture: BrushTexture;
    isClosed: boolean;
    hasFill: boolean;
    fillColor: string;
  }) => void;
}

export const VectorLayerInteractiveOverlay: React.FC<VectorLayerInteractiveOverlayProps> = ({
  activeLayer,
  zoom,
  pan,
  canvasWidth,
  canvasHeight,
  editMode,
  strokeWidth,
  strokeColor,
  hasFill,
  fillColor,
  isClosed,
  brushTexture,
  lineCorrection,
  thickenFactor,
  isShiftLocked = false,
  onUpdateLayerPaths,
  onPushHistory,
  onShowToast,
  onSelectLastPathConfig,
}) => {
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Active interaction state
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number | null>(null);
  const [hoveredNode, setHoveredNode] = useState<{ pathId: string; nodeIndex: number } | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<{ pathId: string; point: { x: number; y: number } } | null>(null);
  const [isPointerDown, setIsPointerDown] = useState(false);

  // Growing Radial Circle for prolonged hold thickening
  const [radialHoldCircle, setRadialHoldCircle] = useState<{
    x: number;
    y: number;
    radius: number;
    intensity: number;
  } | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const holdStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const holdStartTimeRef = useRef<number>(0);
  const holdAnimFrameRef = useRef<number | null>(null);

  // Drawing stroke buffer for 'pen' mode
  const currentRawStrokeRef = useRef<{ x: number; y: number; pressure?: number }[]>([]);
  // Swipe segment buffer for eraser_intersect
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  // Dragging node index
  const draggingNodeRef = useRef<{ pathId: string; nodeIndex: number } | null>(null);

  const paths = activeLayer.vectorPaths || [];

  // Helper to re-render layer's own canvas from vector paths
  const syncLayerCanvas = useCallback(
    (newPaths: VectorPath[]) => {
      activeLayer.ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      renderVectorPathsToContext(activeLayer.ctx, newPaths, canvasWidth, canvasHeight, selectedPathId);
      onUpdateLayerPaths(newPaths);
    },
    [activeLayer, canvasWidth, canvasHeight, onUpdateLayerPaths, selectedPathId]
  );

  // Transform client pointer event directly into exact canvas coordinates
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) {
      return {
        x: Math.round((e.clientX - pan.x) / zoom),
        y: Math.round((e.clientY - pan.y) / zoom),
      };
    }
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * canvasWidth);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * canvasHeight);
    return { x, y };
  };

  // Redraw Interactive Overlay UI (Nodes, Lines, Live Preview, Growing Radial Circle)
  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 1. In 'pen' mode: draw live in-progress stroke
    if (editMode === 'pen' && isPointerDown && currentRawStrokeRef.current.length > 1) {
      const smoothed = stabilizeStrokePoints(currentRawStrokeRef.current, lineCorrection);
      if (smoothed.length > 1) {
        ctx.save();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(smoothed[0].x, smoothed[0].y);
        for (let i = 1; i < smoothed.length - 1; i++) {
          const xc = (smoothed[i].x + smoothed[i + 1].x) / 2;
          const yc = (smoothed[i].y + smoothed[i + 1].y) / 2;
          ctx.quadraticCurveTo(smoothed[i].x, smoothed[i].y, xc, yc);
        }
        const last = smoothed[smoothed.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 2. In 'node' mode: render clickable control points and handles
    if (editMode === 'node') {
      paths.forEach((path) => {
        const isSelected = path.id === selectedPathId;

        // Draw outline path guide
        ctx.save();
        ctx.strokeStyle = isSelected ? 'rgba(59, 130, 246, 0.85)' : 'rgba(255, 255, 255, 0.28)';
        ctx.lineWidth = isSelected ? 2 : 1.5;
        ctx.setLineDash(isSelected ? [] : [4, 4]);

        ctx.beginPath();
        if (path.points.length > 0) {
          ctx.moveTo(path.points[0].x, path.points[0].y);
          for (let i = 1; i < path.points.length; i++) {
            ctx.lineTo(path.points[i].x, path.points[i].y);
          }
          if (path.closed) ctx.closePath();
        }
        ctx.stroke();
        ctx.restore();

        // Draw node circles
        path.points.forEach((pt, idx) => {
          const isNodeSelected = isSelected && idx === selectedNodeIndex;
          const isNodeHovered = hoveredNode?.pathId === path.id && hoveredNode?.nodeIndex === idx;

          ctx.save();
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, isNodeSelected ? 7 : isNodeHovered ? 6 : 4.5, 0, Math.PI * 2);

          if (isNodeSelected) {
            ctx.fillStyle = '#3b82f6';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
          } else if (isNodeHovered) {
            ctx.fillStyle = '#fbbf24';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
          } else {
            ctx.fillStyle = isSelected ? '#93c5fd' : '#ffffff';
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1.5;
          }

          ctx.fill();
          ctx.stroke();
          ctx.restore();
        });
      });

      // Render Hover Preview for adding a node on a line segment
      if (hoveredSegment && !draggingNodeRef.current && !isPointerDown) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(hoveredSegment.point.x, hoveredSegment.point.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();

        // Tiny plus sign inside preview node
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(hoveredSegment.point.x - 3, hoveredSegment.point.y);
        ctx.lineTo(hoveredSegment.point.x + 3, hoveredSegment.point.y);
        ctx.moveTo(hoveredSegment.point.x, hoveredSegment.point.y - 3);
        ctx.lineTo(hoveredSegment.point.x, hoveredSegment.point.y + 3);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 3. GROWING RADIAL CIRCLE VISUALIZATION (Prolonged Hold Area of Effect)
    if (radialHoldCircle) {
      const { x, y, radius, intensity } = radialHoldCircle;
      ctx.save();

      // Soft pulsating radial fill
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(168, 85, 247, 0.22)';
      ctx.fill();

      // Neon glowing border
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Outer dashed aura
      ctx.beginPath();
      ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Center crosshair dot
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // HUD floating label
      const label = `Radius: ${Math.round(radius)}px · Width: +${Math.round((intensity - 1) * 100)}%`;
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      const textWidth = ctx.measureText(label).width;
      ctx.fillRect(x - textWidth / 2 - 8, y - radius - 26, textWidth + 16, 20);
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.5)';
      ctx.strokeRect(x - textWidth / 2 - 8, y - radius - 26, textWidth + 16, 20);

      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y - radius - 12);

      ctx.restore();
    }

    // 4. In 'thicken' mode: draw hover circle cursor
    if (editMode === 'thicken' && isPointerDown && currentRawStrokeRef.current.length > 0 && !radialHoldCircle) {
      const lastPt = currentRawStrokeRef.current[currentRawStrokeRef.current.length - 1];
      ctx.save();
      ctx.beginPath();
      ctx.arc(lastPt.x, lastPt.y, 24, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }, [
    canvasWidth,
    canvasHeight,
    editMode,
    isPointerDown,
    lineCorrection,
    paths,
    selectedNodeIndex,
    selectedPathId,
    hoveredNode,
    hoveredSegment,
    radialHoldCircle,
    strokeColor,
    strokeWidth,
  ]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  // Clean up any lingering hold timers on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (holdAnimFrameRef.current) cancelAnimationFrame(holdAnimFrameRef.current);
    };
  }, []);

  // Hover tracking in 'node' mode
  const handlePointerHoverMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPointerDown || editMode !== 'node') return;

    const { x, y } = getCanvasCoords(e);

    // 1. Check if hovering over any existing node
    for (const path of paths) {
      for (let i = 0; i < path.points.length; i++) {
        const pt = path.points[i];
        if (Math.hypot(pt.x - x, pt.y - y) <= 12) {
          setHoveredNode({ pathId: path.id, nodeIndex: i });
          setHoveredSegment(null);
          return;
        }
      }
    }
    setHoveredNode(null);

    // 2. Check if hovering near a line segment to add a node
    for (const path of paths) {
      for (let i = 0; i < path.points.length - 1; i++) {
        const p1 = path.points[i];
        const p2 = path.points[i + 1];
        const { dist, proj } = distanceToSegment({ x, y }, p1, p2);
        if (dist <= 14) {
          setHoveredSegment({ pathId: path.id, point: proj });
          return;
        }
      }
      if (path.closed && path.points.length > 2) {
        const p1 = path.points[path.points.length - 1];
        const p2 = path.points[0];
        const { dist, proj } = distanceToSegment({ x, y }, p1, p2);
        if (dist <= 14) {
          setHoveredSegment({ pathId: path.id, point: proj });
          return;
        }
      }
    }
    setHoveredSegment(null);
  };

  // Start prolonged hold radial thickening animation loop
  const startRadialHoldThickening = (originX: number, originY: number) => {
    holdStartTimeRef.current = performance.now();
    onPushHistory();

    const tick = () => {
      const elapsed = performance.now() - holdStartTimeRef.current;
      // Radius grows from 12px to 70px over 1.8 seconds
      const progress = Math.min(1.0, elapsed / 1800);
      const currentRadius = 12 + progress * 58;
      const currentIntensity = 1.0 + progress * 1.8;

      setRadialHoldCircle({
        x: originX,
        y: originY,
        radius: currentRadius,
        intensity: currentIntensity,
      });

      // Apply dynamic widening to segments inside the expanding circle
      const updated = applyTargetedThickening(
        paths,
        originX,
        originY,
        currentRadius,
        1.0 + progress * 0.8
      );
      syncLayerCanvas(updated);

      if (progress < 1.0) {
        holdAnimFrameRef.current = requestAnimationFrame(tick);
      }
    };

    holdAnimFrameRef.current = requestAnimationFrame(tick);
  };

  // Pointer Down
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsPointerDown(true);

    const { x: canvasX, y: canvasY } = getCanvasCoords(e);
    holdStartPosRef.current = { x: canvasX, y: canvasY };

    // Set a prolonged hold timer (300ms) to trigger expanding radial area thickening
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (holdAnimFrameRef.current) cancelAnimationFrame(holdAnimFrameRef.current);

    holdTimerRef.current = window.setTimeout(() => {
      if (editMode === 'node' || editMode === 'thicken') {
        startRadialHoldThickening(canvasX, canvasY);
        onShowToast?.('Radial Thickness Area Expanding (Release to commit)');
      }
    }, 280);

    if (editMode === 'pen') {
      currentRawStrokeRef.current = [{ x: canvasX, y: canvasY, pressure: e.pressure || 0.5 }];
      return;
    }

    if (editMode === 'node') {
      const isShiftActive = e.shiftKey || isShiftLocked;

      // Check if clicking directly on a node
      for (const path of paths) {
        for (let i = 0; i < path.points.length; i++) {
          const pt = path.points[i];
          if (Math.hypot(pt.x - canvasX, pt.y - canvasY) <= 14) {
            setSelectedPathId(path.id);
            setSelectedNodeIndex(i);

            // Shift + Click removes the point cleanly!
            if (isShiftActive) {
              if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
              onPushHistory();
              const updated = deleteNodeFromVectorPath(path, i);
              let nextPaths: VectorPath[];
              if (updated) {
                nextPaths = paths.map((p) => (p.id === path.id ? updated : p));
              } else {
                nextPaths = paths.filter((p) => p.id !== path.id);
              }
              syncLayerCanvas(nextPaths);
              setSelectedNodeIndex(null);
              onShowToast?.('Removed vector control point (Shift+Click)');
              return;
            }

            // Otherwise initiate node drag
            draggingNodeRef.current = { pathId: path.id, nodeIndex: i };
            return;
          }
        }
      }

      // If not clicking on an existing node, check if clicking on a line segment to ADD a node!
      for (const path of paths) {
        const added = addNodeToVectorPath(path, canvasX, canvasY, 20);
        if (added) {
          if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
          onPushHistory();
          const nextPaths = paths.map((p) => (p.id === path.id ? added.path : p));
          syncLayerCanvas(nextPaths);
          setSelectedPathId(path.id);
          setSelectedNodeIndex(added.newNodeIndex);
          draggingNodeRef.current = { pathId: path.id, nodeIndex: added.newNodeIndex };
          onShowToast?.('Added control point to vector line');
          return;
        }
      }

      // Clicked outside
      setSelectedPathId(null);
      setSelectedNodeIndex(null);
    }

    if (editMode === 'eraser_line') {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      onPushHistory();
      const updated = eraseWholeVectorPath(paths, canvasX, canvasY, 24);
      if (updated.length !== paths.length) {
        syncLayerCanvas(updated);
        onShowToast?.('Erased whole vector line');
      }
    }

    if (editMode === 'eraser_intersect') {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      swipeStartRef.current = { x: canvasX, y: canvasY };
    }

    if (editMode === 'thicken') {
      currentRawStrokeRef.current = [{ x: canvasX, y: canvasY }];
    }
  };

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDown) {
      handlePointerHoverMove(e);
      return;
    }
    e.stopPropagation();

    const { x: canvasX, y: canvasY } = getCanvasCoords(e);

    // If pointer moved more than 6px from origin, cancel the stationary prolonged hold timer
    if (holdStartPosRef.current) {
      const distFromStart = Math.hypot(
        canvasX - holdStartPosRef.current.x,
        canvasY - holdStartPosRef.current.y
      );
      if (distFromStart > 6 && !radialHoldCircle) {
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      }
    }

    // If radial circle is already expanding, do not drag nodes simultaneously
    if (radialHoldCircle) return;

    if (editMode === 'pen') {
      currentRawStrokeRef.current.push({
        x: canvasX,
        y: canvasY,
        pressure: e.pressure || 0.5,
      });
      drawOverlay();
      return;
    }

    if (editMode === 'node' && draggingNodeRef.current) {
      const { pathId, nodeIndex } = draggingNodeRef.current;
      const targetPath = paths.find((p) => p.id === pathId);
      if (targetPath && targetPath.points[nodeIndex]) {
        const nextPts = [...targetPath.points];
        nextPts[nodeIndex] = { ...nextPts[nodeIndex], x: canvasX, y: canvasY };
        const updated = paths.map((p) => (p.id === pathId ? { ...p, points: nextPts } : p));
        syncLayerCanvas(updated);
      }
      return;
    }

    if (editMode === 'eraser_line') {
      const updated = eraseWholeVectorPath(paths, canvasX, canvasY, 20);
      if (updated.length !== paths.length) {
        syncLayerCanvas(updated);
      }
    }

    if (editMode === 'eraser_intersect' && swipeStartRef.current) {
      const swipeEnd = { x: canvasX, y: canvasY };
      const updated = eraseToIntersection(paths, swipeStartRef.current, swipeEnd, 18);
      if (updated.length !== paths.length || JSON.stringify(updated) !== JSON.stringify(paths)) {
        syncLayerCanvas(updated);
        swipeStartRef.current = swipeEnd;
      }
    }

    if (editMode === 'thicken') {
      currentRawStrokeRef.current = [{ x: canvasX, y: canvasY }];
      const updated = applyTargetedThickening(paths, canvasX, canvasY, 24, thickenFactor);
      syncLayerCanvas(updated);
      drawOverlay();
    }
  };

  // Pointer Up
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDown) return;
    e.stopPropagation();
    setIsPointerDown(false);

    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (holdAnimFrameRef.current) cancelAnimationFrame(holdAnimFrameRef.current);
    holdStartPosRef.current = null;

    if (radialHoldCircle) {
      setRadialHoldCircle(null);
      drawOverlay();
      onShowToast?.('Applied radial area line thickening');
      return;
    }

    if (editMode === 'pen') {
      if (currentRawStrokeRef.current.length > 2) {
        onPushHistory();
        // Uses RDP curve simplification (at least 70-85% fewer points!)
        const smoothed = stabilizeStrokePoints(currentRawStrokeRef.current, lineCorrection);
        const newPath: VectorPath = {
          id: `vec_path_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          points: smoothed,
          strokeColor: strokeColor,
          strokeWidth: strokeWidth,
          closed: isClosed,
          fillColor: hasFill ? fillColor : undefined,
          ...(brushTexture !== 'smooth_ink' ? { brushTexture } : {}),
        } as VectorPath;

        const nextPaths = [...paths, newPath];
        syncLayerCanvas(nextPaths);
        setSelectedPathId(newPath.id);
        setSelectedNodeIndex(null);

        onSelectLastPathConfig?.({
          strokeWidth,
          strokeColor,
          brushTexture,
          isClosed,
          hasFill,
          fillColor,
        });
      }
      currentRawStrokeRef.current = [];
      drawOverlay();
      return;
    }

    draggingNodeRef.current = null;
    swipeStartRef.current = null;
    currentRawStrokeRef.current = [];
    drawOverlay();
  };

  // Synchronize path settings if user changes toolbar parameters while a path is selected
  useEffect(() => {
    if (!selectedPathId) return;
    const path = paths.find((p) => p.id === selectedPathId);
    if (!path) return;

    if (
      (path as any).brushTexture !== brushTexture ||
      path.strokeWidth !== strokeWidth ||
      path.strokeColor !== strokeColor ||
      path.closed !== isClosed ||
      (hasFill && path.fillColor !== fillColor) ||
      (!hasFill && path.fillColor !== undefined)
    ) {
      const updated = paths.map((p) =>
        p.id === selectedPathId
          ? ({
              ...p,
              strokeWidth,
              strokeColor,
              closed: isClosed,
              fillColor: hasFill ? fillColor : undefined,
              brushTexture,
            } as VectorPath)
          : p
      );
      syncLayerCanvas(updated);
    }
  }, [brushTexture, strokeWidth, strokeColor, isClosed, hasFill, fillColor, selectedPathId, paths, syncLayerCanvas]);

  return (
    <canvas
      ref={overlayCanvasRef}
      width={canvasWidth}
      height={canvasHeight}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`absolute inset-0 z-30 touch-none ${
        editMode === 'pen'
          ? 'cursor-crosshair'
          : editMode === 'node'
          ? 'cursor-pointer'
          : editMode.startsWith('eraser')
          ? 'cursor-crosshair'
          : 'cursor-cell'
      }`}
    />
  );
};
