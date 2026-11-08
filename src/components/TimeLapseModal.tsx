import React, { useState, useEffect, useRef } from 'react';
import { CanvasStrokeRecord } from '../types/canvas';
import { Play, Pause, RotateCcw, X, FastForward, Film } from 'lucide-react';
import { renderStrokeSegment } from '../utils/brushEngine';
import { DEFAULT_BRUSHES } from '../constants/brushes';

interface TimeLapseModalProps {
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  strokes: CanvasStrokeRecord[];
  onClose: () => void;
}

export const TimeLapseModal: React.FC<TimeLapseModalProps> = ({
  canvasWidth,
  canvasHeight,
  backgroundColor,
  strokes,
  onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentStrokeIndex, setCurrentStrokeIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(2); // 1x, 2x, 4x, 8x

  const replayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Redraw canvas up to currentStrokeIndex
  const redrawUpTo = (targetIndex: number) => {
    const canvas = replayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and draw background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const safeLimit = Math.min(targetIndex, strokes.length);
    for (let i = 0; i < safeLimit; i++) {
      const stroke = strokes[i];
      const brush = DEFAULT_BRUSHES.find((b) => b.id === stroke.brushId) || DEFAULT_BRUSHES[0];
      const isEraser = stroke.tool === 'eraser';

      for (let p = 1; p < stroke.points.length; p++) {
        renderStrokeSegment(
          ctx,
          stroke.points[p - 1],
          stroke.points[p],
          brush,
          stroke.color,
          stroke.size,
          stroke.opacity,
          isEraser
        );
      }
    }
  };

  // Playback loop
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    let lastTime = performance.now();

    const loop = (now: number) => {
      const elapsed = now - lastTime;
      // Step faster with playbackSpeed
      if (elapsed > 30 / playbackSpeed) {
        lastTime = now;
        setCurrentStrokeIndex((prev) => {
          if (prev >= strokes.length) {
            setIsPlaying(false);
            return strokes.length;
          }
          const next = prev + 1;
          redrawUpTo(next);
          return next;
        });
      }
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, playbackSpeed, strokes.length]);

  const handleSeek = (index: number) => {
    setCurrentStrokeIndex(index);
    redrawUpTo(index);
  };

  const handleRestart = () => {
    setCurrentStrokeIndex(0);
    redrawUpTo(0);
    setIsPlaying(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex flex-col items-center justify-between p-6 animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      {/* Top Bar */}
      <div
        className="w-full max-w-4xl flex items-center justify-between text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5">
          <Film size={20} className="text-blue-400" />
          <h2 className="text-sm font-semibold tracking-wide">
            Procreate Time-Lapse Replay
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>
      </div>

      {/* Main Preview Screen */}
      <div
        className="flex-1 flex items-center justify-center max-w-4xl w-full my-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shadow-2xl rounded-2xl overflow-hidden border border-white/10 bg-[#121318]">
          <canvas
            ref={replayCanvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="max-h-[65vh] max-w-[85vw] object-contain rounded-xl"
          />
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div
        className="w-full max-w-2xl bg-[#1a1b22]/90 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col gap-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrubber Timeline */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-white/50 w-10">
            {currentStrokeIndex}/{strokes.length}
          </span>
          <input
            type="range"
            min="0"
            max={Math.max(1, strokes.length)}
            value={currentStrokeIndex}
            onChange={(e) => handleSeek(parseInt(e.target.value))}
            className="flex-1 h-1.5 bg-white/10 accent-blue-500 rounded-lg cursor-pointer"
          />
          <span className="text-[11px] font-mono text-white/50 w-10 text-right">
            {Math.round((currentStrokeIndex / Math.max(1, strokes.length)) * 100)}%
          </span>
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer shadow-md"
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              onClick={handleRestart}
              title="Restart from beginning"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-white/80 transition-colors cursor-pointer"
            >
              <RotateCcw size={18} />
            </button>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5 text-xs text-white">
            {[1, 2, 4, 8].map((spd) => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-2.5 py-1 rounded-lg font-mono transition-colors cursor-pointer ${
                  playbackSpeed === spd
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
