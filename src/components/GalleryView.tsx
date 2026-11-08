import React, { useState } from 'react';
import { ArtworkProject } from '../types/canvas';
import {
  Plus,
  Image as ImageIcon,
  MoreVertical,
  Copy,
  Trash2,
  Sparkles,
  Calendar,
  HardDrive,
  FileArchive,
  Download,
} from 'lucide-react';
import {
  MayanCornerBrackets,
  MayanFriezeDivider,
  MayanEagleGlyph,
} from './MayanDecorations';

interface GalleryViewProps {
  artworks: ArtworkProject[];
  onOpenArtwork: (id: string) => void;
  onCreateNewArtwork: (width: number, height: number, title?: string) => void;
  onDuplicateArtwork: (id: string) => void;
  onDeleteArtwork: (id: string) => void;
  onImportImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImportHbatz?: (file: File) => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CANVAS_PRESETS = [
  { name: 'Square', width: 2048, height: 2048, desc: '2048 × 2048 px · Perfect for social media' },
  { name: 'Screen Size', width: 1920, height: 1080, desc: '1920 × 1080 px · Standard desktop 16:9' },
  { name: '4K Ultra HD', width: 3840, height: 2160, desc: '3840 × 2160 px · High resolution studio canvas' },
  { name: 'Portrait Illustration', width: 1600, height: 2200, desc: '1600 × 2200 px · Comic & book covers' },
  { name: 'Story / Mobile', width: 1080, height: 1920, desc: '1080 × 1920 px · 9:16 vertical illustration' },
];

export const GalleryView: React.FC<GalleryViewProps> = ({
  artworks,
  onOpenArtwork,
  onCreateNewArtwork,
  onDuplicateArtwork,
  onDeleteArtwork,
  onImportImage,
  onImportHbatz,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [customW, setCustomW] = useState(1920);
  const [customH, setCustomH] = useState(1080);
  const [contextMenuArtworkId, setContextMenuArtworkId] = useState<string | null>(null);

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div
      className={`fixed inset-0 bg-[#090b0a] bg-[radial-gradient(ellipse_at_top,_#19231f_0%,_#0e1211_50%,_#070808_100%)] text-[#e6c699] flex flex-col select-none overflow-y-auto transition-colors ${
        isDragOver ? 'ring-4 ring-[#5fd3ad] ring-inset bg-[#164435]/20' : ''
      }`}
      onClick={() => setContextMenuArtworkId(null)}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
          const file = files[0];
          if (file.name.endsWith('.hbatz') && onImportHbatz) {
            onImportHbatz(file);
          } else {
            const syntheticEvent = {
              target: { files: [file] },
            } as unknown as React.ChangeEvent<HTMLInputElement>;
            onImportImage(syntheticEvent);
          }
        }
      }}
    >
      {/* Drag Over Overlay Banner */}
      {isDragOver && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-100">
          <div className="mayan-panel p-6 rounded-2xl border-2 border-[#5fd3ad] shadow-[0_0_50px_rgba(95,211,173,0.5)] flex flex-col items-center gap-3">
            <Sparkles size={36} className="text-[#5fd3ad] animate-bounce" />
            <span className="font-mayan text-base font-bold text-[#f2fbf7] tracking-wider">
              Drop .HBATZ or Image to Copy into Projects/
            </span>
            <span className="text-xs text-[#5fd3ad] font-mono">Auto-saved to Hunbatz local content/Projects/</span>
          </div>
        </div>
      )}

      {/* Gallery Header */}
      <header className="sticky top-0 z-30 h-16 bg-[#141817]/95 backdrop-blur-xl border-b-2 border-[#2c3532] px-8 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#5fd3ad] shadow-[0_0_10px_rgba(95,211,173,0.8)] border border-[#c8a262]" />
            <h1 className="text-lg sm:text-xl font-mayan font-extrabold tracking-widest text-[#e6c699] flex items-center gap-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              HUNBATZ ART STUDIO
            </h1>
          </div>
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0d1210] border border-[#2c3532] text-[11px] font-mono text-[#5fd3ad] shadow-inner">
            <HardDrive size={12} className="text-[#b89058]" />
            <span>Hunbatz local content / Projects</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Import File Button */}
          <label className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg mayan-btn-stone text-xs font-semibold text-[#e6c699] hover:text-[#fff6e5] transition-all cursor-pointer shadow-md">
            <ImageIcon size={14} className="text-[#b89058]" />
            <span>Import</span>
            <input
              type="file"
              accept="image/*,.json,.hbatz"
              onChange={onImportImage}
              className="hidden"
            />
          </label>

          {/* New Canvas Button */}
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg mayan-btn-cta text-xs font-semibold text-[#f4fbf7] font-mayan tracking-wider shadow-lg transition-transform active:scale-95 cursor-pointer"
          >
            <Plus size={15} />
            <span>New Canvas</span>
          </button>
        </div>
      </header>

      {/* Artworks Grid */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between border-b border-[#2c3532] pb-3">
          <div className="flex items-center gap-2 text-xs text-[#b89058] font-mayan font-bold uppercase tracking-wider">
            <MayanEagleGlyph size={15} color="#5fd3ad" />
            <span>{artworks.length} {artworks.length === 1 ? 'Artwork' : 'Artworks'} In Local Projects (.HBATZ)</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[#9e9484] font-mono">
            <FileArchive size={13} className="text-[#5fd3ad]" />
            <span>Hunbatz local content/Projects/</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {artworks.map((art, index) => (
            <div
              key={`${art.id || 'artwork'}_${index}`}
              onClick={() => onOpenArtwork(art.id)}
              className="group relative mayan-panel rounded-xl overflow-hidden shadow-2xl hover:shadow-[0_0_25px_rgba(95,211,173,0.25)] hover:border-[#b89058] transition-all duration-200 cursor-pointer flex flex-col"
            >
              <MayanCornerBrackets size={14} color="#b89058" />

              {/* Thumbnail Container */}
              <div className="relative aspect-[4/3] w-full bg-[#0b0e0d] checkerboard-pattern overflow-hidden flex items-center justify-center border-b border-[#2c3532]">
                {/* .HBATZ badge */}
                <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 px-2 py-0.5 rounded bg-[#141817]/90 backdrop-blur-md border border-[#2c3532] text-[10px] font-mono text-[#5fd3ad] shadow-md">
                  <FileArchive size={11} className="text-[#5fd3ad]" />
                  <span>.HBATZ</span>
                </div>

                {art.thumbnailUrl ? (
                  <img
                    src={art.thumbnailUrl}
                    alt={art.title}
                    className="w-full h-full object-contain group-hover:scale-102 transition-transform duration-200"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-[#9e9484]/50 gap-1.5">
                    <ImageIcon size={32} />
                    <span className="text-[11px] font-mono">Blank Artwork</span>
                  </div>
                )}

                {/* More Menu Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setContextMenuArtworkId(
                      contextMenuArtworkId === art.id ? null : art.id
                    );
                  }}
                  className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-[#141817]/90 backdrop-blur-md text-[#b89058] hover:text-[#5fd3ad] border border-[#2c3532] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-lg z-20"
                >
                  <MoreVertical size={14} />
                </button>

                {/* Dropdown Menu */}
                {contextMenuArtworkId === art.id && (
                  <div
                    className="absolute right-2.5 top-11 z-40 w-38 mayan-panel border-2 border-[#b89058]/70 shadow-2xl p-1 text-xs text-[#e6c699] flex flex-col gap-0.5 animate-in fade-in duration-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        onDuplicateArtwork(art.id);
                        setContextMenuArtworkId(null);
                      }}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[#164435]/40 hover:text-[#5fd3ad] text-left cursor-pointer transition-colors"
                    >
                      <Copy size={13} />
                      <span>Duplicate</span>
                    </button>
                    {art.fileName && (
                      <a
                        href={`/hunbatz-content/Projects/${encodeURIComponent(art.fileName)}`}
                        download={art.fileName}
                        onClick={() => setContextMenuArtworkId(null)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[#164435]/40 hover:text-[#5fd3ad] text-left cursor-pointer transition-colors"
                      >
                        <Download size={13} />
                        <span>Export .HBATZ</span>
                      </a>
                    )}
                    <button
                      onClick={() => {
                        onDeleteArtwork(art.id);
                        setContextMenuArtworkId(null);
                      }}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded text-[#f87171] hover:bg-[#4a211d]/50 hover:text-[#fca5a5] text-left cursor-pointer transition-colors"
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="p-3.5 flex flex-col gap-1 bg-[#141817]">
                <h3 className="text-sm font-mayan font-bold text-[#e6c699] truncate group-hover:text-[#5fd3ad] transition-colors">
                  {art.title}
                </h3>
                <div className="flex items-center justify-between text-[11px] text-[#9e9484] font-mono">
                  <span>{art.width} × {art.height} px</span>
                  <span>{art.fileSize ? formatBytes(art.fileSize) : formatDate(art.updatedAt)}</span>
                </div>
                {art.fileName && (
                  <div className="text-[10px] text-[#b89058]/80 font-mono truncate flex items-center gap-1 mt-0.5">
                    <span className="text-[#5fd3ad]">↳</span> {art.fileName}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* New Canvas Modal */}
      {isNewModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsNewModalOpen(false)}
        >
          <div
            className="w-full max-w-lg mayan-panel border-2 border-[#b89058] rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] p-6 text-[#e6c699] flex flex-col gap-5 select-none relative"
            onClick={(e) => e.stopPropagation()}
          >
            <MayanCornerBrackets size={18} color="#b89058" />

            <div className="flex items-center justify-between pb-3 border-b-2 border-[#2c3532]">
              <div className="flex items-center gap-2">
                <span className="text-[#5fd3ad]">❖</span>
                <h2 className="text-sm font-mayan font-bold tracking-wider text-[#e6c699]">
                  CREATE NEW CANVAS
                </h2>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="text-[#9e9484] hover:text-[#e6c699] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Presets List */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-mayan font-bold uppercase tracking-wider text-[#b89058]">Canvas Presets</span>
              <div className="flex flex-col gap-2">
                {CANVAS_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => {
                      onCreateNewArtwork(preset.width, preset.height, preset.name);
                      setIsNewModalOpen(false);
                    }}
                    className="flex items-center justify-between p-3 rounded-xl mayan-well hover:border-[#5fd3ad] hover:bg-[#164435]/30 transition-all text-left cursor-pointer group"
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-[#e6c699] group-hover:text-[#5fd3ad]">
                        {preset.name}
                      </span>
                      <span className="text-[11px] text-[#9e9484]">{preset.desc}</span>
                    </div>
                    <span className="text-xs font-mono text-[#5fd3ad] font-semibold">
                      {preset.width} × {preset.height}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Dimensions */}
            <div className="flex flex-col gap-2 pt-2 border-t border-[#2c3532]">
              <span className="text-xs font-mayan font-bold uppercase tracking-wider text-[#b89058]">Custom Dimensions</span>
              <div className="flex items-center gap-3">
                <div className="flex-1 flex flex-col gap-1">
                  <span className="text-[10px] text-[#9e9484] font-mono">Width (px)</span>
                  <input
                    type="number"
                    min="200"
                    max="6000"
                    value={customW}
                    onChange={(e) => setCustomW(parseInt(e.target.value) || 1000)}
                    className="mayan-well rounded-lg px-3 py-2 text-xs text-[#5fd3ad] font-mono focus:outline-none focus:border-[#5fd3ad]"
                  />
                </div>
                <span className="text-[#b89058] pt-4 font-bold">×</span>
                <div className="flex-1 flex flex-col gap-1">
                  <span className="text-[10px] text-[#9e9484] font-mono">Height (px)</span>
                  <input
                    type="number"
                    min="200"
                    max="6000"
                    value={customH}
                    onChange={(e) => setCustomH(parseInt(e.target.value) || 1000)}
                    className="mayan-well rounded-lg px-3 py-2 text-xs text-[#5fd3ad] font-mono focus:outline-none focus:border-[#5fd3ad]"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2c3532]">
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium mayan-btn-stone text-[#9e9484] hover:text-[#e6c699] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onCreateNewArtwork(customW, customH, 'Custom Artwork');
                  setIsNewModalOpen(false);
                }}
                className="px-5 py-2 rounded-lg text-xs font-semibold mayan-btn-cta text-[#f4fbf7] font-mayan tracking-wider shadow-lg transition-transform active:scale-95 cursor-pointer"
              >
                Create Canvas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
