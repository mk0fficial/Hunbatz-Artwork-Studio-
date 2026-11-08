import React from 'react';
import { Layer } from '../types/canvas';
import { Plus, ChevronLeft, ChevronRight, FileText } from 'lucide-react';

interface PageAssistBarProps {
  layers: Layer[];
  activeLayerId: string;
  onSelectPage: (layerId: string) => void;
  onNewPage: () => void;
  onClose?: () => void;
}

export const PageAssistBar: React.FC<PageAssistBarProps> = ({
  layers,
  activeLayerId,
  onSelectPage,
  onNewPage,
}) => {
  const currentIndex = layers.findIndex((l) => l.id === activeLayerId);

  const handlePrevPage = () => {
    if (currentIndex > 0) {
      onSelectPage(layers[currentIndex - 1].id);
    }
  };

  const handleNextPage = () => {
    if (currentIndex < layers.length - 1) {
      onSelectPage(layers[currentIndex + 1].id);
    }
  };

  return (
    <div
      className="fixed bottom-4 inset-x-0 mx-auto w-full max-w-xl z-40 px-3 select-none pointer-events-auto animate-in slide-in-from-bottom-2 duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-[#14161d]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-2.5 flex flex-col gap-2 text-white text-xs">
        {/* Top Header Row (Matching Video 0:13–0:18) */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-blue-400" />
            <span className="font-semibold text-white">Page Assist</span>
            <span className="text-[11px] font-mono text-white/50 ml-1">
              Page {currentIndex + 1} of {layers.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Prev / Next Page navigation arrows */}
            <button
              onClick={handlePrevPage}
              disabled={currentIndex <= 0}
              className={`p-1.5 rounded-lg border transition-colors ${
                currentIndex > 0
                  ? 'border-white/10 text-white/80 hover:bg-white/10 cursor-pointer'
                  : 'border-white/5 text-white/20 cursor-not-allowed'
              }`}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={handleNextPage}
              disabled={currentIndex >= layers.length - 1}
              className={`p-1.5 rounded-lg border transition-colors ${
                currentIndex < layers.length - 1
                  ? 'border-white/10 text-white/80 hover:bg-white/10 cursor-pointer'
                  : 'border-white/5 text-white/20 cursor-not-allowed'
              }`}
            >
              <ChevronRight size={14} />
            </button>

            {/* New Page Button */}
            <button
              onClick={onNewPage}
              title="Add New Document Page"
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-white shadow-md transition-all active:scale-95 cursor-pointer ml-1"
            >
              <Plus size={14} />
              <span>New Page</span>
            </button>
          </div>
        </div>

        {/* Page Filmstrip (Matching Video 0:13) */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 px-0.5 scrollbar-thin">
          {layers.map((layer, index) => {
            const isActive = layer.id === activeLayerId;
            return (
              <div
                key={layer.id}
                onClick={() => onSelectPage(layer.id)}
                className={`relative flex flex-col items-center justify-center w-14 h-16 rounded-xl border-2 shrink-0 cursor-pointer transition-all ${
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
                    P{index + 1}
                  </div>
                )}

                <div className="absolute bottom-0 inset-x-0 text-center text-[9px] font-mono bg-black/70 text-white/80 rounded-b-lg py-0.5">
                  Page {index + 1}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
