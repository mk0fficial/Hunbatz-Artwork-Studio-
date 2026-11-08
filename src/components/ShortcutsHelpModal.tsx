import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { MayanCornerBrackets } from './MayanDecorations';

interface ShortcutsHelpModalProps {
  onClose: () => void;
}

export const ShortcutsHelpModal: React.FC<ShortcutsHelpModalProps> = ({ onClose }) => {
  const shortcuts = [
    { key: 'B', desc: 'Brush Tool / Brush Library' },
    { key: 'E', desc: 'Eraser Tool' },
    { key: 'S', desc: 'Smudge Tool' },
    { key: 'V', desc: 'Transform Tool' },
    { key: 'I / Alt', desc: 'Eyedropper Color Picker' },
    { key: 'L', desc: 'Toggle Layers Panel' },
    { key: 'Delete / Del', desc: 'Delete Active Layer' },
    { key: 'C', desc: 'Toggle Color Studio' },
    { key: '[  /  ]', desc: 'Decrease / Increase Brush Size' },
    { key: 'Ctrl + V', desc: 'Paste Image or Object (as new layer)' },
    { key: 'Ctrl + C', desc: 'Copy Active Layer to Clipboard' },
    { key: 'Ctrl + Shift + C', desc: 'Copy Merged Canvas' },
    { key: 'Ctrl + X', desc: 'Cut Active Layer' },
    { key: 'Ctrl + Z', desc: 'Undo' },
    { key: 'Ctrl + Y / Ctrl+Shift+Z', desc: 'Redo' },
    { key: 'Space + Drag / 1 Finger', desc: 'Pan Canvas' },
    { key: 'Pinch / 2 Fingers', desc: 'Zoom & Pan Canvas' },
    { key: 'Scroll Wheel', desc: 'Zoom Canvas' },
    { key: 'Tab', desc: 'Hide / Show All UI (Zen Mode)' },
    { key: 'Esc', desc: 'Close Active Menus / Cancel Transform' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mayan-panel relative p-6 text-[#E6C699] flex flex-col gap-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <MayanCornerBrackets size={16} />

        <div className="flex items-center justify-between pb-3 border-b border-[#2C3532]">
          <div className="flex items-center gap-2.5">
            <Keyboard size={18} className="text-[#5fd3ad]" />
            <h2 className="text-sm font-semibold tracking-wider text-[#E6C699] font-mayan uppercase">
              PC & Touch Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#9E9484] hover:text-[#E6C699] hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-2 max-h-[55vh] overflow-y-auto pr-1 text-xs">
          {shortcuts.map((sc) => (
            <div
              key={sc.key}
              className="flex items-center justify-between py-1.5 px-3 rounded-lg mayan-well border border-[#2C3532]"
            >
              <span className="text-[#D9BC94] font-medium">{sc.desc}</span>
              <kbd className="px-2.5 py-0.5 rounded font-mono text-[11px] mayan-btn-jade text-[#F4FBF7] font-bold">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="p-3 mayan-well border border-[#B89058]/30 rounded-xl text-[11px] text-[#D9BC94] leading-relaxed">
          <strong className="text-[#E6C699] font-mayan">Stylus & Touch Ergonomics:</strong> Stylus draws with continuous pressure and tilt dynamics while single/two-finger touch gestures pan and zoom with automatic palm rejection.
        </div>
      </div>
    </div>
  );
};
