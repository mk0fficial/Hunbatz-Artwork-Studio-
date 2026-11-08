import React, { useState } from 'react';
import {
  ChevronLeft,
  Wrench,
  Wand2,
  Sparkles,
  MousePointer2,
  Paintbrush,
  Hand,
  Eraser,
  Layers as LayersIcon,
  Maximize,
  Minimize,
  Sliders,
  RotateCcw,
  Shapes,
  LassoSelect,
} from 'lucide-react';
import { ToolType, ActiveAdjustment } from '../types/canvas';

interface HeaderBarProps {
  projectTitle: string;
  zoomScale: number;
  activeTool: ToolType;
  currentColor: string;
  layerCount: number;
  isActionsOpen: boolean;
  isBrushLibraryOpen: boolean;
  isLayersOpen: boolean;
  isColorStudioOpen: boolean;
  isZenMode: boolean;
  isShapesOpen?: boolean;
  isVectorLayer?: boolean;
  onUpdateTitle: (title: string) => void;
  onSelectTool: (tool: ToolType) => void;
  onToggleActions: () => void;
  onToggleShapes?: () => void;
  onToggleBrushLibrary: () => void;
  onToggleLayers: () => void;
  onToggleColorStudio: () => void;
  onToggleZenMode: () => void;
  onResetZoom: () => void;
  onNavigateGallery: () => void;
  onTriggerAdjustment: (type: ActiveAdjustment) => void;
  onColorDropDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  uiScale?: number;
  deviceMode?: string;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  projectTitle,
  zoomScale,
  activeTool,
  currentColor,
  layerCount,
  isActionsOpen,
  isBrushLibraryOpen,
  isLayersOpen,
  isColorStudioOpen,
  isZenMode,
  isShapesOpen = false,
  isVectorLayer = false,
  onUpdateTitle,
  onSelectTool,
  onToggleActions,
  onToggleShapes,
  onToggleBrushLibrary,
  onToggleLayers,
  onToggleColorStudio,
  onToggleZenMode,
  onResetZoom,
  onNavigateGallery,
  onTriggerAdjustment,
  onColorDropDragStart,
  uiScale = 1.0,
  deviceMode = 'auto',
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(projectTitle);
  const [isAdjustmentsMenuOpen, setIsAdjustmentsMenuOpen] = useState(false);

  const isCompact = deviceMode === 'phone' || (uiScale !== undefined && uiScale <= 0.85);
  const iconSize = isCompact ? 13 : uiScale <= 0.95 ? 14 : 16;
  const btnPadding = isCompact ? 'p-1 sm:p-1.5' : 'p-2';
  const headerHeight = isCompact ? 'h-10' : 'h-13';

  const handleFinishTitle = () => {
    setIsEditingTitle(false);
    if (tempTitle.trim()) {
      onUpdateTitle(tempTitle.trim());
    } else {
      setTempTitle(projectTitle);
    }
  };

  return (
    <header className={`fixed top-0 inset-x-0 ${headerHeight} bg-gradient-to-r from-[#121615] via-[#1a201e] to-[#121615] border-b-2 border-[#b89058]/60 shadow-[0_4px_24px_rgba(0,0,0,0.9)] z-40 px-2 sm:px-3 flex items-center justify-between select-none transition-all`}>
      {/* Left Tools Cluster */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {/* Gallery Button */}
        <button
          onClick={onNavigateGallery}
          title="Back to Gallery"
          className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg mayan-btn-stone text-xs font-semibold text-[#e6c699] hover:text-[#fff6e5] transition-all cursor-pointer shadow-sm active:scale-95"
        >
          <ChevronLeft size={iconSize} className="text-[#b89058]" />
          <span className="font-mayan tracking-wider hidden xs:inline sm:inline text-[11px] sm:text-xs">Gallery</span>
        </button>

        <div className="h-4 sm:h-5 w-px bg-[#b89058]/30 mx-0.5 sm:mx-1" />

        {/* Actions (Wrench) */}
        <button
          onClick={onToggleActions}
          title="Actions (Canvas, Share, Prefs)"
          className={`${btnPadding} rounded-lg transition-all cursor-pointer ${
            isActionsOpen
              ? 'mayan-btn-jade'
              : 'mayan-btn-stone hover:border-[#b89058]/50'
          }`}
        >
          <Wrench size={iconSize} />
        </button>

        {/* Adjustments (Magic Wand - hidden on Vector Layers per Module 2) */}
        {!isVectorLayer && (
          <div className="relative">
            <button
              onClick={() => setIsAdjustmentsMenuOpen(!isAdjustmentsMenuOpen)}
              title="Adjustments (Filters & Color)"
              className={`${btnPadding} rounded-lg transition-all cursor-pointer ${
                isAdjustmentsMenuOpen
                  ? 'mayan-btn-jade'
                  : 'mayan-btn-stone hover:border-[#b89058]/50'
              }`}
            >
              <Wand2 size={iconSize} />
            </button>

            {/* Adjustments Dropdown */}
            {isAdjustmentsMenuOpen && (
              <div
                className="absolute left-0 top-11 z-50 w-64 max-h-[68vh] overflow-y-auto mayan-panel border-2 border-[#b89058]/60 rounded-xl shadow-2xl p-2 text-xs flex flex-col gap-0.5 animate-in fade-in duration-100 scrollbar-thin"
                onClick={(e) => e.stopPropagation()}
              >
              {/* Color & Tonality */}
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#b89058] px-3 pt-1.5 pb-0.5 font-mayan">
                Color & Tonality
              </span>
              <button
                onClick={() => {
                  onTriggerAdjustment('hue_saturation');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer"
              >
                <span>Hue, Saturation, Brightness</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('curves');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer"
              >
                <span>Curves</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('gradient_map');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer"
              >
                <span>Gradient Map</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('invert');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer"
              >
                <span>Invert Colors</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('grayscale');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer"
              >
                <span>Grayscale (B&W)</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('thermal');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer text-red-300"
              >
                <span>Thermal Infrared</span>
              </button>

              <div className="h-px bg-white/10 my-1" />

              {/* Blurs & Optics */}
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 px-3 pt-1 pb-0.5">
                Blurs & Optics
              </span>
              <button
                onClick={() => {
                  onTriggerAdjustment('dither_suite');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer text-[#5fd3ad] font-semibold"
              >
                <span>Dither Suite (4 Engines)</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('gaussian_blur');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer"
              >
                <span>Gaussian Blur</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('motion_blur');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer"
              >
                <span>Motion Blur</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('surface_blur');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer"
              >
                <span>Surface Blur</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('bloom');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer"
              >
                <span>Bloom Glow</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('chromatic_aberration');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer"
              >
                <span>Chromatic Aberration</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('perspective_blur');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer"
              >
                <span>Perspective Blur</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('halftone');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer"
              >
                <span>Halftone Dots</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('channel_extractor');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer text-[#5fd3ad]"
              >
                <span>Channel Extractor</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('sharpen');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer"
              >
                <span>Sharpen</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('noise');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer"
              >
                <span>Noise & Grain</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('unsharp_mask');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer"
              >
                <span>Unsharp Mask</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('fisheye');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer"
              >
                <span>Fisheye Lens</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('poster_edges');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer"
              >
                <span>Poster Edges</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('pixelate');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer"
              >
                <span>Pixelate / Mosaic</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('threshold');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer"
              >
                <span>Threshold</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('cutout');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer"
              >
                <span>Cutout Paper</span>
              </button>

              <div className="h-px bg-white/10 my-1" />

              {/* Glitch Studio */}
              <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400/70 px-3 pt-1 pb-0.5">
                Glitch Studio
              </span>
              <button
                onClick={() => {
                  onTriggerAdjustment('glitch_rgb_offset');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer"
              >
                <span>RGB Offset</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('glitch_channel_swap');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer"
              >
                <span>Channel Swap</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('glitch_random_dispersion');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer"
              >
                <span>Random Dispersion</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('glitch_scanlines');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer"
              >
                <span>Scanlines CRT</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('glitch_vhs');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer text-pink-300"
              >
                <span>VHS Tape Filter</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('glitch_led_screen');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer text-cyan-300"
              >
                <span>LED Screen Phosphor</span>
              </button>
              <button
                onClick={() => {
                  onTriggerAdjustment('glitch_pixel_sort');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer text-[#5fd3ad] font-semibold"
              >
                <span>Pixel Sort Glitch</span>
              </button>

              <div className="h-px bg-white/10 my-1" />

              {/* Liquify Studio */}
              <button
                onClick={() => {
                  onTriggerAdjustment('liquify');
                  setIsAdjustmentsMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-blue-600/20 text-blue-400 font-semibold text-left transition-colors cursor-pointer"
              >
                <span>Liquify Studio</span>
              </button>
            </div>
          )}
        </div>
        )}


        {/* Shapes Toggle (Vector & Comics) */}
        <button
          onClick={onToggleShapes}
          title="Vector & Comic Shapes"
          className={`${btnPadding} rounded-lg transition-all cursor-pointer ${
            isShapesOpen
              ? 'mayan-btn-jade'
              : 'mayan-btn-stone hover:border-[#b89058]/50'
          }`}
        >
          <Shapes size={iconSize} />
        </button>

        {/* Selection Ribbon Tool ('S' shape - hidden on Vector Layers per Module 2) */}
        {!isVectorLayer ? (
          <button
            onClick={() => onSelectTool(activeTool === 'select' ? 'brush' : 'select')}
            title="Selection Tool (Freehand, Rect, Ellipse)"
            className={`${btnPadding} rounded-lg transition-all cursor-pointer ${
              activeTool === 'select'
                ? 'mayan-btn-jade'
                : 'mayan-btn-stone hover:border-[#b89058]/50'
            }`}
          >
            <LassoSelect size={iconSize} />
          </button>
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg mayan-well border border-[#5fd3ad]/40 text-[9px] sm:text-[10px] font-mono font-semibold text-[#5fd3ad]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5fd3ad] animate-pulse" />
            <span className="hidden sm:inline">VECTOR MODE</span>
          </div>
        )}

        {/* Transform Tool */}
        <button
          onClick={() => onSelectTool(activeTool === 'transform' ? 'brush' : 'transform')}
          title="Transform Tool (V)"
          className={`${btnPadding} rounded-lg transition-all cursor-pointer ${
            activeTool === 'transform'
              ? 'mayan-btn-jade'
              : 'mayan-btn-stone hover:border-[#b89058]/50'
          }`}
        >
          <MousePointer2 size={iconSize} />
        </button>

      </div>

      {/* Center Title & Canvas Zoom Info (Carved Cartouche Plaque) - Hidden on compact phones to maximize drawing controls */}
      <div className={`hidden sm:flex items-center gap-1.5 sm:gap-2 text-xs ${isCompact ? 'max-w-[110px]' : ''}`}>
        {isEditingTitle ? (
          <input
            type="text"
            value={tempTitle}
            onChange={(e) => setTempTitle(e.target.value)}
            onBlur={handleFinishTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFinishTitle();
              if (e.key === 'Escape') {
                setTempTitle(projectTitle);
                setIsEditingTitle(false);
              }
            }}
            autoFocus
            className="mayan-well border border-[#b89058] text-[#f2fbf7] font-mayan px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-xs text-center font-bold focus:outline-none shadow-inner"
          />
        ) : (
          <button
            onClick={() => setIsEditingTitle(true)}
            title="Click to rename artwork"
            className="mayan-well border border-[#b89058]/60 hover:border-[#b89058] font-bold text-[#e6c699] hover:text-[#fff6e5] px-2 sm:px-3.5 py-0.5 sm:py-1 rounded-lg transition-all cursor-pointer font-mayan text-xs tracking-wider shadow-sm flex items-center gap-1 truncate"
          >
            <span className="text-[#b89058] text-[9px]">❖</span>
            <span className="truncate">{projectTitle}</span>
            <span className="text-[#b89058] text-[9px]">❖</span>
          </button>
        )}

        <button
          onClick={onResetZoom}
          title="Reset Zoom to 100%"
          className="mayan-well border border-[#2c3532] hover:border-[#b89058]/50 font-mono text-[10px] sm:text-[11px] text-[#9e9484] hover:text-[#e6c699] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg transition-colors cursor-pointer"
        >
          {Math.round(zoomScale * 100)}%
        </button>
      </div>

      {/* Right Tools Cluster (Brush, Smudge, Eraser, Layers, Color Swatch) */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {/* Raster Brush, Smudge & Eraser Tools (Hidden in Vector Layer mode per Module 1) */}
        {!isVectorLayer && (
          <>
            {/* Paint Brush */}
            <button
              onClick={() => {
                if (activeTool === 'brush') {
                  onToggleBrushLibrary();
                } else {
                  onSelectTool('brush');
                }
              }}
              title="Paint Brush (B) - Click again for Brush Library"
              className={`${btnPadding} rounded-lg transition-all cursor-pointer ${
                activeTool === 'brush'
                  ? 'mayan-btn-jade'
                  : 'mayan-btn-stone hover:border-[#b89058]/50'
              }`}
            >
              <Paintbrush size={iconSize} />
            </button>

            {/* Smudge Tool */}
            <button
              onClick={() => {
                if (activeTool === 'smudge') {
                  onToggleBrushLibrary();
                } else {
                  onSelectTool('smudge');
                }
              }}
              title="Smudge Tool (S)"
              className={`${btnPadding} rounded-lg transition-all cursor-pointer ${
                activeTool === 'smudge'
                  ? 'mayan-btn-jade'
                  : 'mayan-btn-stone hover:border-[#b89058]/50'
              }`}
            >
              <Hand size={iconSize} />
            </button>

            {/* Eraser Tool */}
            <button
              onClick={() => {
                if (activeTool === 'eraser') {
                  onToggleBrushLibrary();
                } else {
                  onSelectTool('eraser');
                }
              }}
              title="Eraser Tool (E)"
              className={`${btnPadding} rounded-lg transition-all cursor-pointer ${
                activeTool === 'eraser'
                  ? 'mayan-btn-jade'
                  : 'mayan-btn-stone hover:border-[#b89058]/50'
              }`}
            >
              <Eraser size={iconSize} />
            </button>

            <div className="h-4 sm:h-5 w-px bg-[#b89058]/30 mx-0.5" />
          </>
        )}

        {/* Layers Button */}
        <button
          onClick={onToggleLayers}
          title="Layers (L)"
          className={`relative ${btnPadding} rounded-lg transition-all cursor-pointer ${
            isLayersOpen
              ? 'mayan-btn-jade'
              : 'mayan-btn-stone hover:border-[#b89058]/50'
          }`}
        >
          <LayersIcon size={iconSize} />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-gradient-to-br from-[#5fd3ad] to-[#164435] border border-[#b89058] text-[8px] sm:text-[9px] font-bold text-white flex items-center justify-center shadow-md">
            {layerCount}
          </span>
        </button>

        {/* Color Circle & ColorDrop source (Ringed with antique bronze / Kukulkan bezel) */}
        <div
          draggable
          onDragStart={onColorDropDragStart}
          onClick={onToggleColorStudio}
          title="Active Color (Click for Color Studio, Drag onto canvas for ColorDrop!)"
          className="relative ml-0.5 sm:ml-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-[#b89058] shadow-[0_0_8px_rgba(184,144,88,0.5),inset_0_0_3px_rgba(0,0,0,0.8)] cursor-pointer hover:scale-110 active:scale-95 transition-transform overflow-hidden group shrink-0"
          style={{ backgroundColor: currentColor }}
        >
          <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Fullscreen Zen Mode Button */}
        <button
          onClick={onToggleZenMode}
          title="Toggle Fullscreen / Zen Mode (Tab)"
          className={`ml-0.5 sm:ml-1 ${btnPadding} rounded-lg mayan-btn-stone text-[#9e9484] hover:text-[#e6c699] transition-colors cursor-pointer`}
        >
          {isZenMode ? <Minimize size={iconSize - 1} /> : <Maximize size={iconSize - 1} />}
        </button>
      </div>
    </header>
  );
};
