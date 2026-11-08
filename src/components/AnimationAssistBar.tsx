import React, { useState, useEffect } from 'react';
import { Layer, AnimationConfig } from '../types/canvas';
import {
  Play,
  Pause,
  Sliders,
  Plus,
  Repeat,
  Copy,
  Trash2,
  Clock,
} from 'lucide-react';

interface AnimationAssistBarProps {
  layers: Layer[];
  activeLayerId: string;
  config: AnimationConfig;
  onSelectFrame: (layerId: string) => void;
  onAddFrame: () => void;
  onDuplicateFrame: (layerId: string) => void;
  onDeleteFrame: (layerId: string) => void;
  onChangeConfig: (updates: Partial<AnimationConfig>) => void;
  onClose?: () => void;
}

export const AnimationAssistBar: React.FC<AnimationAssistBarProps> = ({
  layers,
  activeLayerId,
  config,
  onSelectFrame,
  onAddFrame,
  onDuplicateFrame,
  onDeleteFrame,
  onChangeConfig,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedFrameMenu, setSelectedFrameMenu] = useState<string | null>(null);

  // Animation Playback Loop
  useEffect(() => {
    if (!config.isPlaying || layers.length <= 1) return;

    const intervalMs = Math.max(20, Math.round(1000 / config.fps));
    const timer = setInterval(() => {
      const currIdx = layers.findIndex((l) => l.id === activeLayerId);
      let nextIdx = (currIdx + 1) % layers.length;
      onSelectFrame(layers[nextIdx].id);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [config.isPlaying, config.fps, layers, activeLayerId, onSelectFrame]);

  return (
    <div
      className="fixed bottom-4 inset-x-0 mx-auto w-full max-w-2xl z-40 px-3 select-none pointer-events-auto animate-in slide-in-from-bottom-2 duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-[#14161d]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-2.5 flex flex-col gap-2 text-white text-xs">
        {/* Controls Row (Matching Video 0:05) */}
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-1.5">
            {/* Play / Pause Button */}
            <button
              onClick={() => onChangeConfig({ isPlaying: !config.isPlaying })}
              title={config.isPlaying ? 'Pause Animation' : 'Play Animation'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-white shadow-md transition-all active:scale-95 cursor-pointer"
            >
              {config.isPlaying ? <Pause size={14} /> : <Play size={14} />}
              <span>{config.isPlaying ? 'Pause' : 'Play'}</span>
            </button>

            {/* Settings Button */}
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              title="Animation Settings"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                isSettingsOpen
                  ? 'bg-blue-600/30 border-blue-500/50 text-blue-400'
                  : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
              }`}
            >
              <Sliders size={13} />
              <span>Settings</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-white/50">
              {layers.findIndex((l) => l.id === activeLayerId) + 1} / {layers.length} Frames
            </span>

            {/* Add Frame Button */}
            <button
              onClick={onAddFrame}
              title="Add New Frame (Layer)"
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>Add Frame</span>
            </button>
          </div>
        </div>

        {/* Animation Filmstrip of Frame Thumbnails (Matching Video 0:05–0:08) */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 px-0.5 scrollbar-thin">
          {layers.map((layer, index) => {
            const isActive = layer.id === activeLayerId;
            return (
              <div
                key={layer.id}
                onClick={() => {
                  onSelectFrame(layer.id);
                  if (isActive) {
                    setSelectedFrameMenu(selectedFrameMenu === layer.id ? null : layer.id);
                  }
                }}
                className={`relative flex flex-col items-center justify-center w-14 h-14 rounded-xl border-2 shrink-0 cursor-pointer transition-all ${
                  isActive
                    ? 'border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.5)] scale-105 bg-[#252835]'
                    : 'border-white/10 hover:border-white/30 bg-[#191b24]'
                }`}
              >
                {layer.thumbnailUrl ? (
                  <img
                    src={layer.thumbnailUrl}
                    alt={layer.name}
                    className="w-full h-full object-contain rounded-lg p-0.5"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-mono text-[10px] text-white/40">
                    #{index + 1}
                  </div>
                )}

                <div className="absolute bottom-0 inset-x-0 text-center text-[9px] font-mono bg-black/70 text-white/80 rounded-b-lg py-0.5">
                  {index + 1}
                </div>
              </div>
            );
          })}
        </div>

        {/* Frame Action Menu Popover when clicking active frame */}
        {selectedFrameMenu && (
          <div className="flex items-center justify-between bg-[#1f222d] border border-white/10 rounded-xl px-3 py-1.5 text-xs">
            <span className="text-white/60 text-[11px]">Frame #{layers.findIndex((l) => l.id === selectedFrameMenu) + 1} Options:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onDuplicateFrame(selectedFrameMenu);
                  setSelectedFrameMenu(null);
                }}
                className="flex items-center gap-1 text-white/80 hover:text-white cursor-pointer px-2 py-0.5 rounded hover:bg-white/10"
              >
                <Copy size={12} /> Duplicate
              </button>
              {layers.length > 1 && (
                <button
                  onClick={() => {
                    onDeleteFrame(selectedFrameMenu);
                    setSelectedFrameMenu(null);
                  }}
                  className="flex items-center gap-1 text-red-400 hover:text-red-300 cursor-pointer px-2 py-0.5 rounded hover:bg-white/10"
                >
                  <Trash2 size={12} /> Delete
                </button>
              )}
            </div>
          </div>
        )}

        {/* Settings Popover */}
        {isSettingsOpen && (
          <div className="bg-[#181a24] border border-white/10 rounded-xl p-3 flex flex-col gap-2.5 text-xs animate-in fade-in duration-100">
            {/* FPS Slider */}
            <div className="flex items-center justify-between">
              <span className="text-white/70">Frames Per Second (FPS):</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={config.fps}
                  onChange={(e) => onChangeConfig({ fps: Number(e.target.value) })}
                  className="w-24 accent-blue-500 cursor-pointer"
                />
                <span className="font-mono text-white font-bold w-6 text-right">{config.fps}</span>
              </div>
            </div>

            {/* Loop Mode */}
            <div className="flex items-center justify-between">
              <span className="text-white/70">Playback:</span>
              <div className="flex items-center gap-1 bg-[#101218] p-0.5 rounded-lg border border-white/5">
                {(['loop', 'pingpong', 'oneshot'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => onChangeConfig({ loopMode: mode })}
                    className={`px-2 py-0.5 rounded capitalize cursor-pointer text-[11px] ${
                      config.loopMode === mode
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-white/50 hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Onion Skin Frames */}
            <div className="flex items-center justify-between">
              <span className="text-white/70">Onion Skin Frames:</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={5}
                  value={config.onionSkinFrames}
                  onChange={(e) => onChangeConfig({ onionSkinFrames: Number(e.target.value) })}
                  className="w-24 accent-blue-500 cursor-pointer"
                />
                <span className="font-mono text-white w-6 text-right">
                  {config.onionSkinFrames === 0 ? 'None' : config.onionSkinFrames}
                </span>
              </div>
            </div>

            {/* Onion Skin Opacity */}
            <div className="flex items-center justify-between">
              <span className="text-white/70">Onion Skin Opacity:</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={10}
                  max={80}
                  value={Math.round(config.onionSkinOpacity * 100)}
                  onChange={(e) =>
                    onChangeConfig({ onionSkinOpacity: Number(e.target.value) / 100 })
                  }
                  className="w-24 accent-blue-500 cursor-pointer"
                />
                <span className="font-mono text-white w-6 text-right">
                  {Math.round(config.onionSkinOpacity * 100)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
