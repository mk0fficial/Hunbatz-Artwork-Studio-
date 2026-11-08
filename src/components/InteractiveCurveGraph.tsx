import React, { useState, useRef, useEffect } from 'react';

export interface CurvePoint {
  id: string;
  x: number; // 0 to 256
  y: number; // 0 to 256 (where 0 is bottom/black, 256 is top/white)
}

interface InteractiveCurveGraphProps {
  channel: 'rgb' | 'red' | 'green' | 'blue';
  preset: number;
  onLutChange: (lut: Uint8Array) => void;
}

export const InteractiveCurveGraph: React.FC<InteractiveCurveGraphProps> = ({
  channel,
  preset,
  onLutChange,
}) => {
  const [points, setPoints] = useState<CurvePoint[]>([
    { id: 'start', x: 0, y: 0 },
    { id: 'mid', x: 128, y: 128 },
    { id: 'end', x: 256, y: 256 },
  ]);

  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Re-initialize points when preset changes
  useEffect(() => {
    if (preset === 1) {
      // High contrast S-Curve
      setPoints([
        { id: 'start', x: 0, y: 0 },
        { id: 'p1', x: 64, y: 28 },
        { id: 'p2', x: 192, y: 228 },
        { id: 'end', x: 256, y: 256 },
      ]);
    } else if (preset === 2) {
      // Invert
      setPoints([
        { id: 'start', x: 0, y: 256 },
        { id: 'end', x: 256, y: 0 },
      ]);
    } else if (preset === 3) {
      // Cross Process
      setPoints([
        { id: 'start', x: 0, y: 18 },
        { id: 'p1', x: 100, y: 140 },
        { id: 'end', x: 256, y: 245 },
      ]);
    } else if (preset === 4) {
      // Solarize
      setPoints([
        { id: 'start', x: 0, y: 0 },
        { id: 'mid', x: 128, y: 256 },
        { id: 'end', x: 256, y: 0 },
      ]);
    } else if (preset === 0) {
      // Reset
      setPoints([
        { id: 'start', x: 0, y: 0 },
        { id: 'mid', x: 128, y: 128 },
        { id: 'end', x: 256, y: 256 },
      ]);
    }
  }, [preset]);

  // Compute 256-entry monotonic cubic spline LUT and SVG path
  const { pathData, lut } = React.useMemo(() => {
    const sorted = [...points].sort((a, b) => a.x - b.x);
    const lutArr = new Uint8Array(256);

    // Monotonic cubic interpolation
    const n = sorted.length;
    const xs = sorted.map((p) => p.x);
    const ys = sorted.map((p) => p.y);

    const m = new Array(n).fill(0);
    const deltas = new Array(n - 1).fill(0);

    for (let i = 0; i < n - 1; i++) {
      const dx = xs[i + 1] - xs[i];
      deltas[i] = dx !== 0 ? (ys[i + 1] - ys[i]) / dx : 0;
    }

    m[0] = deltas[0];
    for (let i = 1; i < n - 1; i++) {
      m[i] = (deltas[i - 1] + deltas[i]) / 2;
    }
    m[n - 1] = deltas[n - 2];

    for (let i = 0; i < n - 1; i++) {
      if (deltas[i] === 0) {
        m[i] = 0;
        m[i + 1] = 0;
      }
    }

    const interpolateY = (xVal: number) => {
      if (xVal <= xs[0]) return ys[0];
      if (xVal >= xs[n - 1]) return ys[n - 1];

      let k = 0;
      for (let i = 0; i < n - 1; i++) {
        if (xVal >= xs[i] && xVal <= xs[i + 1]) {
          k = i;
          break;
        }
      }

      const h = xs[k + 1] - xs[k];
      if (h === 0) return ys[k];
      const t = (xVal - xs[k]) / h;
      const t2 = t * t;
      const t3 = t2 * t;

      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;

      return h00 * ys[k] + h10 * h * m[k] + h01 * ys[k + 1] + h11 * h * m[k + 1];
    };

    let pStr = '';
    for (let x = 0; x <= 256; x++) {
      const yVal = Math.max(0, Math.min(256, interpolateY(x)));
      if (x < 256) lutArr[x] = Math.max(0, Math.min(255, Math.round(yVal)));
      const svgY = 256 - yVal;
      pStr += `${x === 0 ? 'M' : 'L'} ${x} ${svgY.toFixed(1)} `;
    }

    return { pathData: pStr, lut: lutArr };
  }, [points]);

  useEffect(() => {
    onLutChange(lut);
  }, [lut, onLutChange]);

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingPointId(id);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingPointId || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const rawX = Math.round(((e.clientX - rect.left) / rect.width) * 256);
    const rawY = Math.round(256 - ((e.clientY - rect.top) / rect.height) * 256);

    const clampedX = Math.max(0, Math.min(256, rawX));
    const clampedY = Math.max(0, Math.min(256, rawY));

    setPoints((prev) =>
      prev.map((p) => {
        if (p.id !== draggingPointId) return p;
        // Start point fixed at x=0, end point fixed at x=256
        const newX = p.id === 'start' ? 0 : p.id === 'end' ? 256 : clampedX;
        return { ...p, x: newX, y: clampedY };
      })
    );
  };

  const handlePointerUp = () => {
    setDraggingPointId(null);
  };

  // Click on SVG to add a new point
  const handleSvgClick = (e: React.MouseEvent) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clickX = Math.round(((e.clientX - rect.left) / rect.width) * 256);
    const clickY = Math.round(256 - ((e.clientY - rect.top) / rect.height) * 256);

    // Prevent adding too close to existing points
    if (points.some((p) => Math.hypot(p.x - clickX, p.y - clickY) < 14)) return;

    const newPt: CurvePoint = {
      id: `pt_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      x: Math.max(8, Math.min(248, clickX)),
      y: Math.max(0, Math.min(256, clickY)),
    };

    setPoints((prev) => [...prev, newPt].sort((a, b) => a.x - b.x));
    setDraggingPointId(newPt.id);
  };

  // Double click to delete an interior point
  const handleDoubleClickPoint = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (id === 'start' || id === 'end') return; // protect endpoints
    setPoints((prev) => prev.filter((p) => p.id !== id));
  };

  const strokeColor =
    channel === 'red'
      ? '#ef4444'
      : channel === 'green'
      ? '#22c55e'
      : channel === 'blue'
      ? '#3b82f6'
      : '#ffffff';

  return (
    <div className="flex flex-col gap-2 select-none">
      <div
        className="relative w-full h-44 bg-[#101115] rounded-xl border border-white/10 overflow-hidden cursor-crosshair"
        title="Click anywhere to add point · Drag points to bend curve · Double-click point to delete"
      >
        <svg
          ref={svgRef}
          viewBox="0 0 256 256"
          preserveAspectRatio="none"
          className="w-full h-full"
          onClick={handleSvgClick}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* 4x4 Grid lines */}
          <line x1="64" y1="0" x2="64" y2="256" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <line x1="128" y1="0" x2="128" y2="256" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          <line x1="192" y1="0" x2="192" y2="256" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <line x1="0" y1="64" x2="256" y2="64" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <line x1="0" y1="128" x2="256" y2="128" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          <line x1="0" y1="192" x2="256" y2="192" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

          {/* Diagonal Neutral Line */}
          <line x1="0" y1="256" x2="256" y2="0" stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" strokeWidth="1" />

          {/* Render Spline Path */}
          <path
            d={pathData}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Control Points */}
          {points.map((p) => {
            const isDragging = draggingPointId === p.id;
            const svgY = 256 - p.y;
            return (
              <circle
                key={p.id}
                cx={p.x}
                cy={svgY}
                r={isDragging ? 6.5 : 5}
                fill={isDragging ? '#60a5fa' : '#3b82f6'}
                stroke="#ffffff"
                strokeWidth={isDragging ? 2.5 : 1.5}
                className="cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
                onPointerDown={(e) => handlePointerDown(e, p.id)}
                onDoubleClick={(e) => handleDoubleClickPoint(e, p.id)}
              />
            );
          })}
        </svg>

        <div className="absolute bottom-1 left-2 text-[9px] font-mono text-white/30 pointer-events-none">
          In: 0..255
        </div>
        <div className="absolute top-1 right-2 text-[9px] font-mono text-white/30 pointer-events-none">
          Out: 0..255
        </div>
      </div>
      <span className="text-[10px] text-white/40 italic text-center">
        Click curve to add control points · Drag to bend · Double-click interior points to delete
      </span>
    </div>
  );
};
