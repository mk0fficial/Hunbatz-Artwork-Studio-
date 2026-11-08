import React, { useRef, useState, useEffect } from 'react';
import { Compass, PenTool } from 'lucide-react';
import {
  kritaHardwareTiltState,
  updateHardwareTiltTelemetry,
} from '../utils/brushEngine';

interface BrushTipGizmoProps {
  angle: number; // 0 to 360 degrees
  roundness: number; // Supports 0.05..1.0 OR 5..100
  penTiltControl?: boolean;
  onChange: (angle: number, roundness: number, penTiltControl?: boolean) => void;
  size?: number;
  showNumericInputs?: boolean;
  showTiltButton?: boolean;
}

export const BrushTipGizmo: React.FC<BrushTipGizmoProps> = ({
  angle = 0,
  roundness = 1,
  penTiltControl = false,
  onChange,
  size = 96,
  showNumericInputs = true,
  showTiltButton = true,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dragMode, setDragMode] = useState<'angle' | 'roundness' | null>(null);
  const [hasHardwareTilt, setHasHardwareTilt] = useState<boolean>(
    kritaHardwareTiltState.hasDetectedPenTilt
  );
  const [liveAzimuth, setLiveAzimuth] = useState<number>(
    kritaHardwareTiltState.lastAzimuthDeg
  );

  // Normalize roundness so both 0.05..1.0 and 5..100 work seamlessly
  const isPercentScale = roundness > 1.05;
  const normRoundness = isPercentScale
    ? Math.max(0.05, Math.min(1.0, roundness / 100))
    : Math.max(0.05, Math.min(1.0, Number(roundness) || 1.0));
  const cleanAngle = ((Number(angle) || 0) % 360 + 360) % 360;

  // Listen globally for hardware pen tilt telemetry so the button unlocks automatically
  useEffect(() => {
    const onGlobalPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'pen') {
        const detected = updateHardwareTiltTelemetry(e);
        if (detected) {
          setHasHardwareTilt(true);
          setLiveAzimuth(kritaHardwareTiltState.lastAzimuthDeg);
        }
      }
    };
    window.addEventListener('pointermove', onGlobalPointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', onGlobalPointerMove);
  }, []);

  const emitChange = (nextAngleDeg: number, nextNormRoundness: number, nextTilt?: boolean) => {
    const clampedRoundness = Math.max(0.05, Math.min(1.0, Math.round(nextNormRoundness * 100) / 100));
    const outRoundness = isPercentScale ? Math.round(clampedRoundness * 100) : clampedRoundness;
    onChange(((Math.round(nextAngleDeg) % 360) + 360) % 360, outRoundness, nextTilt ?? penTiltControl);
  };

  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = size / 2 - 8;
  const rx = outerRadius * 0.78;
  const ry = Math.max(3, rx * normRoundness);
  const rad = (cleanAngle * Math.PI) / 180;

  // Gold directional arrow handle along major axis
  const arrowDist = outerRadius * 0.94;
  const arrowX = cx + Math.cos(rad) * arrowDist;
  const arrowY = cy + Math.sin(rad) * arrowDist;

  // Jade squeeze handles along minor axis (perpendicular to angle)
  const perpRad = rad + Math.PI / 2;
  const node1X = cx + Math.cos(perpRad) * ry;
  const node1Y = cy + Math.sin(perpRad) * ry;
  const node2X = cx - Math.cos(perpRad) * ry;
  const node2Y = cy - Math.sin(perpRad) * ry;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - cx;
    const py = e.clientY - rect.top - cy;

    const distToNode1 = Math.hypot(px - Math.cos(perpRad) * ry, py - Math.sin(perpRad) * ry);
    const distToNode2 = Math.hypot(px + Math.cos(perpRad) * ry, py + Math.sin(perpRad) * ry);

    if (distToNode1 < 15 || distToNode2 < 15) {
      setDragMode('roundness');
    } else {
      setDragMode('angle');
      let deg = Math.round((Math.atan2(py, px) * 180) / Math.PI);
      if (deg < 0) deg += 360;
      emitChange(deg, normRoundness);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragMode) return;
    e.stopPropagation();
    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - cx;
    const py = e.clientY - rect.top - cy;

    if (dragMode === 'angle') {
      let deg = Math.round((Math.atan2(py, px) * 180) / Math.PI);
      if (deg < 0) deg += 360;
      emitChange(deg, normRoundness);
    } else if (dragMode === 'roundness') {
      const projDist = Math.abs(-Math.sin(rad) * px + Math.cos(rad) * py);
      const newRoundness = Math.max(0.05, Math.min(1.0, projDist / rx));
      emitChange(cleanAngle, newRoundness);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragMode) return;
    e.stopPropagation();
    e.preventDefault();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    setDragMode(null);
  };

  return (
    <div
      className="flex flex-col items-center gap-2 select-none"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Interactive Krita KisBrushTip Dial */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative rounded-full cursor-grab active:cursor-grabbing shadow-inner bg-[#0c100f] border-2 border-[#2c3532] hover:border-[#5fd3ad] transition-colors touch-none"
        style={{ width: size, height: size }}
        title="Drag gold handle to rotate Tip Angle (0-360°). Drag jade nodes inward/outward to squeeze Roundness (5-100%)."
      >
        <svg width={size} height={size} className="overflow-visible pointer-events-none">
          {/* Reference crosshair axes */}
          <line
            x1={cx}
            y1={6}
            x2={cx}
            y2={size - 6}
            stroke="#222a27"
            strokeDasharray="2,2"
            strokeWidth="1"
          />
          <line
            x1={6}
            y1={cy}
            x2={size - 6}
            y2={cy}
            stroke="#222a27"
            strokeDasharray="2,2"
            strokeWidth="1"
          />

          {/* Outer degree ring */}
          <circle
            cx={cx}
            cy={cy}
            r={outerRadius}
            fill="none"
            stroke="#1b2220"
            strokeWidth="1.5"
          />

          {/* Live Oriented Krita Elliptical Dab Footprint */}
          <g transform={`rotate(${cleanAngle}, ${cx}, ${cy})`}>
            <ellipse
              cx={cx}
              cy={cy}
              rx={rx}
              ry={ry}
              fill="rgba(95, 211, 173, 0.18)"
              stroke="#5fd3ad"
              strokeWidth="1.8"
            />
            <line
              x1={cx - rx}
              y1={cy}
              x2={cx + rx}
              y2={cy}
              stroke="#5fd3ad"
              strokeWidth="1"
              strokeDasharray="2,2"
              opacity="0.65"
            />
          </g>

          {/* Gold Angle Vector & Handle */}
          <line
            x1={cx}
            y1={cy}
            x2={arrowX}
            y2={arrowY}
            stroke="#e6c699"
            strokeWidth="1.75"
          />
          <circle
            cx={arrowX}
            cy={arrowY}
            r={5.5}
            fill="#e6c699"
            stroke="#0c100f"
            strokeWidth="1.5"
          />

          {/* Jade Roundness Squeeze Nodes (Minor Axis) */}
          <circle
            cx={node1X}
            cy={node1Y}
            r={4.5}
            fill="#0c100f"
            stroke="#5fd3ad"
            strokeWidth="2"
          />
          <circle
            cx={node2X}
            cy={node2Y}
            r={4.5}
            fill="#0c100f"
            stroke="#5fd3ad"
            strokeWidth="2"
          />
        </svg>
      </div>

      {/* Numeric Angle & Roundness Readout Pills */}
      {showNumericInputs && (
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#e6c699]">
          <div
            className="flex items-center gap-0.5 bg-[#141a18] px-1.5 py-0.5 rounded border border-[#2c3532]"
            title="Brush Tip Angle (0° to 360°)"
          >
            <span className="text-[#b89058] text-[10px]">∠</span>
            <input
              type="number"
              min="0"
              max="360"
              value={Math.round(cleanAngle)}
              onChange={(e) => {
                const val = (parseInt(e.target.value, 10) || 0) % 360;
                emitChange(val < 0 ? val + 360 : val, normRoundness);
              }}
              className="w-8 bg-transparent text-center text-[#5fd3ad] font-bold focus:outline-none"
            />
            <span className="text-[#8e8574]">°</span>
          </div>

          <div
            className="flex items-center gap-0.5 bg-[#141a18] px-1.5 py-0.5 rounded border border-[#2c3532]"
            title="Brush Tip Roundness (5% flat nib to 100% circle)"
          >
            <span className="text-[#b89058] text-[10px]">◯</span>
            <input
              type="number"
              min="5"
              max="100"
              value={Math.round(normRoundness * 100)}
              onChange={(e) => {
                const val = Math.max(5, Math.min(100, parseInt(e.target.value, 10) || 100));
                emitChange(cleanAngle, val / 100);
              }}
              className="w-8 bg-transparent text-center text-[#5fd3ad] font-bold focus:outline-none"
            />
            <span className="text-[#8e8574]">%</span>
          </div>
        </div>
      )}

      {/* Krita Stylus Tilt Sensor Button */}
      {showTiltButton && (
        <button
          type="button"
          onClick={() => emitChange(cleanAngle, normRoundness, !penTiltControl)}
          title={
            hasHardwareTilt
              ? 'Bind Hardware Stylus Tilt Azimuth & Elevation to Tip Angle & Roundness'
              : 'Toggle Stylus Tilt Sensor (Touch stylus with tilt support to canvas to activate live telemetry)'
          }
          className={`w-full px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
            penTiltControl
              ? 'bg-[#164435] border-[#5fd3ad] text-[#f2fbf7] shadow-[0_0_10px_rgba(95,211,173,0.3)]'
              : 'bg-[#141a18] border-[#2c3532] text-[#9e9484] hover:text-[#e6c699] hover:border-[#b89058]/60'
          }`}
        >
          {penTiltControl ? (
            <Compass className="text-[#5fd3ad] animate-pulse" size={11} />
          ) : (
            <PenTool className="text-[#b89058]" size={11} />
          )}
          <span>
            {penTiltControl
              ? hasHardwareTilt
                ? `Tilt Active (${liveAzimuth}°)`
                : 'Pen Tilt ON'
              : 'Pen Tilt Control'}
          </span>
        </button>
      )}
    </div>
  );
};
