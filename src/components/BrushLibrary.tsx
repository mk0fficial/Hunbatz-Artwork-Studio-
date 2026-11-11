import React, { useState, useRef, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { Brush, BrushCategory, ToolType } from '../types/canvas';
import {
  Paintbrush,
  Settings2,
  Copy,
  Plus,
  Upload,
  Download,
  FolderPlus,
  Folder,
  Trash2,
  Edit3,
  Check,
  X,
  Circle,
  Triangle,
  Square,
  MoreVertical,
  MoreHorizontal,
  RefreshCw,
  HardDrive,
} from 'lucide-react';
import {
  fetchLocalBrushes,
  createLocalFolder,
  deleteLocalFolder,
  renameLocalFolder,
  deleteLocalBrush,
  syncAllToLocalContent,
} from '../services/localContentService';
import { BrushStudioModal } from './BrushStudioModal';
import { BrushTipGizmo } from './BrushTipGizmo';
import {
  hydrateBrush,
  loadBrushFolders,
  saveBrushFolders,
  FACTORY_BRUSH_DEFAULTS,
} from '../constants/brushes';
import {
  renderStrokeSegment,
  onKritaTipTextureLoaded,
  generateBrushSwatch,
} from '../utils/brushEngine';
import { importBrushFiles } from '../utils/brushImporter';
import { parseBrushArchiveOrBinary } from '../utils/brushParsers';
import { universalToBrush } from '../types/brush';
import { MayanCornerBrackets } from './MayanDecorations';

interface BrushLibraryProps {
  brushes: Brush[];
  activeBrush: Brush;
  activeTool: ToolType;
  currentColor?: string;
  brushSize?: number;
  brushOpacity?: number;
  onSelectBrush: (brush: Brush) => void;
  onUpdateBrush: (brush: Brush) => void;
  onBatchUpdateBrushes?: (brushes: Brush[]) => void;
  onDuplicateBrush?: (brush: Brush) => void;
  onImportBrushes?: (brushes: Brush[]) => void;
  onSyncAllToLocalContent?: () => Promise<void> | void;
  onClose: () => void;
}

export const BrushLibrary: React.FC<BrushLibraryProps> = ({
  brushes,
  activeBrush,
  activeTool,
  currentColor = '#ffffff',
  brushSize = 30,
  brushOpacity = 1,
  onSelectBrush,
  onUpdateBrush,
  onBatchUpdateBrushes,
  onDuplicateBrush,
  onImportBrushes,
  onSyncAllToLocalContent,
  onClose,
}) => {
  const validBrushes = brushes.length > 0 ? brushes : FACTORY_BRUSH_DEFAULTS.filter((b) => b.category === 'Inking');
  const activeValidBrushes = validBrushes;
  const currentBrush: Brush =
    (activeBrush && activeBrush.id ? activeBrush : validBrushes[0] || FACTORY_BRUSH_DEFAULTS[0]) ||
    ({ id: 'fallback', name: 'Inking Pen', category: 'Inking', size: 24, opacity: 1 } as Brush);

  const [folders, setFolders] = useState<string[]>(() => {
    const loaded = loadBrushFolders();
    const dynamicCats = Array.from(
      new Set(activeValidBrushes.map((b) => b.category).filter(Boolean))
    );
    const combined = Array.from(new Set([...loaded, ...dynamicCats])).filter(
      (f) =>
        f &&
        !f.toLowerCase().includes('velvetcat') &&
        !f.toLowerCase().includes('custom') &&
        f !== 'Hunbatz Base Brushes' &&
        f !== 'Placeholder'
    );
    return combined.length > 0 ? combined : ['Inking'];
  });

  const [selectedCategory, setSelectedCategory] = useState<BrushCategory>(() => {
    if (currentBrush.category && folders.includes(currentBrush.category)) {
      return currentBrush.category;
    }
    return folders[0] || 'Inking';
  });

  const [isSyncingAll, setIsSyncingAll] = useState(false);

  useEffect(() => {
    if (folders.length > 0 && !folders.includes(selectedCategory)) {
      setSelectedCategory(folders[0]);
    }
  }, [folders, selectedCategory]);

  const handleDropAllToLocalContent = async () => {
    setIsSyncingAll(true);
    try {
      if (onSyncAllToLocalContent) {
        await onSyncAllToLocalContent();
      } else {
        await syncAllToLocalContent(activeValidBrushes, folders);
      }
    } catch (err) {
      console.error('Failed to sync all brushes to local content:', err);
    } finally {
      setIsSyncingAll(false);
    }
  };

  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [draggedBrushId, setDraggedBrushId] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  const [editingBrush, setEditingBrush] = useState<Brush | null>(null);
  const [activeFolderMenu, setActiveFolderMenu] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showTipGizmo, setShowTipGizmo] = useState(false);
  const [tipLoadTick, setTipLoadTick] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderListRef = useRef<HTMLDivElement | null>(null);
  const activeMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return onKritaTipTextureLoaded(() => {
      setTipLoadTick((t) => t + 1);
    });
  }, []);

  useEffect(() => {
    const handleOutsideClick = () => setActiveFolderMenu(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (activeFolderMenu && activeMenuRef.current && folderListRef.current) {
      const container = folderListRef.current;
      const menu = activeMenuRef.current;
      const timer = setTimeout(() => {
        if (!container || !menu) return;
        const containerRect = container.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        
        // Scroll to show the menu within the visible area
        const overflowBottom = menuRect.bottom - containerRect.bottom + 64; // Extra clearance for menu height
        const underflowTop = menuRect.top - containerRect.top;
        
        if (overflowBottom > 0) {
          container.scrollBy({ top: overflowBottom, behavior: 'smooth' });
        } else if (underflowTop < 0) {
          container.scrollBy({ top: underflowTop - 8, behavior: 'smooth' });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeFolderMenu]);

  const updateFoldersList = (nextFolders: string[]) => {
    const clean = Array.from(new Set(nextFolders.map((f) => f.trim()).filter(Boolean)));
    setFolders(clean);
    saveBrushFolders(clean);
  };

  const [isRefreshingLocal, setIsRefreshingLocal] = useState(false);

  const handleRefreshLocalContent = async () => {
    setIsRefreshingLocal(true);
    try {
      const res = await fetchLocalBrushes();
      if (res.folders && res.folders.length > 0) {
        updateFoldersList(res.folders);
      }
      if (res.brushes && res.brushes.length > 0) {
        if (onBatchUpdateBrushes) {
          onBatchUpdateBrushes(res.brushes);
        }
        const match = res.brushes.find((b) => b.id === currentBrush.id);
        if (!match) {
          const inCat = res.brushes.find((b) => b.category === selectedCategory);
          onSelectBrush(inCat || res.brushes[0]);
        }
      }
    } catch (err) {
      console.error('Failed to refresh local brushes from disk:', err);
    } finally {
      setIsRefreshingLocal(false);
    }
  };

  const handleCreateFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    if (!folders.includes(trimmed)) {
      const next = [...folders, trimmed];
      updateFoldersList(next);
      createLocalFolder(trimmed).catch(() => {});
    }
    setSelectedCategory(trimmed);
    setNewFolderName('');
    setIsCreatingFolder(false);
  };

  const handleRenameFolder = (oldName: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === oldName) {
      setRenamingFolder(null);
      return;
    }
    const next = folders.map((f) => (f === oldName ? trimmed : f));
    updateFoldersList(next);
    renameLocalFolder(oldName, trimmed).catch(() => {});

    const updatedBrushes = validBrushes.map((b) =>
      b.category === oldName ? { ...b, category: trimmed } : b
    );
    if (onBatchUpdateBrushes) {
      onBatchUpdateBrushes(updatedBrushes);
    } else {
      updatedBrushes.forEach((b) => {
        if (b.category === trimmed) onUpdateBrush(b);
      });
    }
    if (currentBrush.category === oldName) {
      onSelectBrush({ ...currentBrush, category: trimmed });
    }
    if (selectedCategory === oldName) {
      setSelectedCategory(trimmed);
    }
    setRenamingFolder(null);
  };

  /**
   * Deleting a folder now permanently deletes the folder AND all brushes inside it
   * (instead of moving its brushes into another folder).
   */
  const handleDeleteFolder = (folderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (folders.length <= 1) return;

    deleteLocalFolder(folderName).catch(() => {});

    const nextFolders = folders.filter((f) => f !== folderName);
    const fallbackFolder = nextFolders[0] || 'Inking';

    // Permanently delete all brushes that belonged to `folderName`
    let remainingBrushes = activeValidBrushes.filter(
      (b) => (b.category || folders[0] || 'Inking') !== folderName
    );

    // Ensure at least 1 brush exists in the app if all brushes were deleted
    if (remainingBrushes.length === 0) {
      const fallbackPreset = FACTORY_BRUSH_DEFAULTS.find((b) => b.category === fallbackFolder) || FACTORY_BRUSH_DEFAULTS[0];
      remainingBrushes = [
        { ...fallbackPreset, category: fallbackFolder },
      ];
    }

    if (onBatchUpdateBrushes) {
      onBatchUpdateBrushes(remainingBrushes);
    }

    updateFoldersList(nextFolders);

    if (selectedCategory === folderName) {
      setSelectedCategory(fallbackFolder);
    }
    if (currentBrush.category === folderName && remainingBrushes[0]) {
      onSelectBrush(remainingBrushes[0]);
    }
  };

  const handleDuplicateFolder = (folderName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveFolderMenu(null);
    let baseCopyName = `${folderName} (Copy)`;
    let copyIndex = 1;
    while (folders.includes(baseCopyName)) {
      copyIndex++;
      baseCopyName = `${folderName} (Copy ${copyIndex})`;
    }
    const newFolderName = baseCopyName;
    const folderBrushes = activeValidBrushes.filter(
      (b) => (b.category || folders[0] || 'Inking') === folderName
    );
    const clonedBrushes: Brush[] = folderBrushes.map((b) => ({
      ...b,
      id: `brush_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: `${b.name} (Copy)`,
      category: newFolderName,
      isCustom: true,
    }));

    const nextFolders = [...folders, newFolderName];
    updateFoldersList(nextFolders);

    if (clonedBrushes.length > 0) {
      if (onBatchUpdateBrushes) {
        onBatchUpdateBrushes([...activeValidBrushes, ...clonedBrushes]);
      } else {
        clonedBrushes.forEach((b) => onUpdateBrush(b));
      }
      onSelectBrush(clonedBrushes[0]);
    }
    setSelectedCategory(newFolderName);
  };

  const handleExportFolderBundle = async (folderName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveFolderMenu(null);
    const folderBrushes = activeValidBrushes.filter(
      (b) => (b.category || folders[0] || 'Inking') === folderName
    );
    try {
      const zip = new JSZip();
      const manifest = {
        name: folderName,
        format: 'hunbatz_brush_bundle',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        brushCount: folderBrushes.length,
      };
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));
      zip.file('brushes.json', JSON.stringify(folderBrushes, null, 2));

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = folderName.replace(/[^a-z0-9_-]/gi, '_');
      a.href = url;
      a.download = `${safeName}.bundle.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export bundle:', err);
    }
  };

  const handleDeleteBrush = (brushId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (activeValidBrushes.length <= 1) return;
    const targetBrush = activeValidBrushes.find((b) => b.id === brushId);
    if (targetBrush) {
      deleteLocalBrush(
        targetBrush.category || selectedCategory,
        (targetBrush as any).localFileName,
        targetBrush.name
      ).catch(() => {});
    }
    const remaining = activeValidBrushes.filter((b) => b.id !== brushId);
    if (onBatchUpdateBrushes) {
      onBatchUpdateBrushes(remaining);
    }
    if (currentBrush.id === brushId && remaining.length > 0) {
      const sameFolder = remaining.find((b) => b.category === selectedCategory);
      onSelectBrush(sameFolder || remaining[0]);
    }
  };

  /**
   * Export either a single brush or all brushes in the current folder as a JSON preset pack
   */
  const handleExportBrushes = (targetBrushes: Brush[], filenamePrefix: string) => {
    const cleanName = filenamePrefix.replace(/[^a-z0-9_-]/gi, '_');
    const blob = new Blob([JSON.stringify(targetBrushes, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanName}.hunbatz.brushes.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsImporting(true);
    try {
      const allFiles = Array.from(files);
      const imported: Brush[] = [];

      for (const file of allFiles) {
        if (file.name.endsWith('.json')) {
          try {
            const txt = await file.text();
            const parsedJson = JSON.parse(txt);
            if (Array.isArray(parsedJson)) {
              imported.push(...parsedJson.map((b) => hydrateBrush(b)));
              continue;
            } else if (parsedJson && parsedJson.name) {
              imported.push(hydrateBrush(parsedJson));
              continue;
            }
          } catch {}
        }
        try {
          const uBrushes = await parseBrushArchiveOrBinary(file);
          if (uBrushes && uBrushes.length > 0) {
            imported.push(...uBrushes.map((u) => universalToBrush(u)));
            continue;
          }
        } catch (err) {
          console.warn(`parseBrushArchiveOrBinary error for ${file.name}:`, err);
        }
        try {
          const fallbackBrushes = await importBrushFiles([file]);
          if (fallbackBrushes && fallbackBrushes.length > 0) {
            imported.push(...fallbackBrushes);
          }
        } catch (err2) {
          console.error(`Failed to import brush file ${file.name}:`, err2);
        }
      }

      if (imported.length > 0) {
        const targetFolder = selectedCategory || folders[0] || 'Inking';
        const nextFolders = folders.includes(targetFolder)
          ? [...folders]
          : [...folders, targetFolder];

        const assigned = imported.map((b) => ({
          ...b,
          category: targetFolder,
          isCustom: true,
        }));
        updateFoldersList(nextFolders);

        if (onImportBrushes) {
          onImportBrushes(assigned);
        } else if (onBatchUpdateBrushes) {
          onBatchUpdateBrushes([...assigned, ...activeValidBrushes]);
        } else {
          assigned.forEach((b) => onUpdateBrush(b));
        }

        const firstBrush = assigned[0];
        onSelectBrush(firstBrush);
        setSelectedCategory(targetFolder);
      }
    } catch (err) {
      console.error('Failed to import brushes:', err);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const drawPreviewRibbon = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const isEraser = activeTool === 'eraser';
    const isSmudge = activeTool === 'smudge';
    const drawColor = isEraser
      ? '#94a3b8'
      : isSmudge
      ? '#38bdf8'
      : currentColor || '#ffffff';

    const w = canvas.width;
    const h = canvas.height;
    const pointsCount = 44;
    const pts: { x: number; y: number; pressure: number; time: number }[] = [];

    for (let i = 0; i <= pointsCount; i++) {
      const t = i / pointsCount;
      const x = 18 + t * (w - 36);
      const y = h / 2 + Math.sin(t * Math.PI * 2) * (h * 0.25);
      const pressure = Math.sin(t * Math.PI) * 0.85 + 0.15;
      pts.push({ x, y, pressure, time: Date.now() + i * 16 });
    }

    const previewSize = Math.max(8, Math.min(26, (brushSize ?? 28) * 0.65));
    const previewOpacity = brushOpacity ?? 1;

    for (let i = 0; i < pts.length - 1; i++) {
      renderStrokeSegment(
        ctx,
        pts[i],
        pts[i + 1],
        currentBrush,
        drawColor,
        previewSize,
        previewOpacity,
        false
      );
    }
  }, [activeTool, currentBrush, currentColor, brushSize, brushOpacity, tipLoadTick]);

  useEffect(() => {
    drawPreviewRibbon();
  }, [drawPreviewRibbon]);

  const filteredBrushes = activeValidBrushes.filter(
    (b) => (b.category || folders[0] || 'Inking') === selectedCategory
  );

  const getToolTitle = () => {
    switch (activeTool) {
      case 'eraser':
        return 'Eraser Library';
      case 'smudge':
        return 'Smudge Library';
      default:
        return 'Brush Library';
    }
  };

  const handleCreateNewBrush = () => {
    const categoryName = selectedCategory || folders[0] || 'Inking';
    const newBrush: Brush = hydrateBrush({
      id: `brush_custom_${Date.now()}`,
      name: `New ${categoryName} Brush`,
      category: categoryName,
      description: 'Custom designed brush preset for Hunbatz Studio.',
      size: 24,
      opacity: 1.0,
      hardness: 0.95,
      streamline: 0.25,
      spacing: 0.04,
      jitter: 0,
      texture: 'hard_round',
      pressureSizeFactor: 0.75,
      pressureOpacityFactor: 0.0,
      minSize: 1,
      maxSize: 300,
      author: 'User',
      isCustom: true,
    });
    setEditingBrush(newBrush);
  };

  const handleDuplicate = (b: Brush, e: React.MouseEvent) => {
    e.stopPropagation();
    const cloned: Brush = {
      ...b,
      id: `${b.id}_copy_${Date.now()}`,
      name: `${b.name} Copy`,
      isCustom: true,
      author: 'User',
    };
    if (onDuplicateBrush) {
      onDuplicateBrush(cloned);
    } else {
      onUpdateBrush(cloned);
    }
  };

  const renderShapeBadge = (b: Brush) => {
    const iconUrl = (b as any).iconUrl || (b as any).shapeTextureUrl;
    if (iconUrl) {
      return (
        <img
          src={iconUrl}
          alt={b.name}
          className="w-7 h-7 rounded-md object-contain shrink-0 shadow-sm border border-[#5fd3ad]/40 bg-black"
        />
      );
    }
    const swatch = generateBrushSwatch(b, 44, 44, '#5fd3ad');
    if (swatch) {
      return (
        <img
          src={swatch}
          alt={b.name}
          className="w-7 h-7 rounded-md object-contain shrink-0 shadow-sm border border-[#5fd3ad]/40 bg-black"
        />
      );
    }
    const tex = b.shape?.texture || b.texture;
    if (tex === 'hard_triangle' || tex === 'calligraphy_nib') {
      return <Triangle size={12} className="text-[#5fd3ad] shrink-0" />;
    }
    if (tex === 'hard_square' || tex === 'hard_airbrush' || tex === 'chisel_marker') {
      return <Square size={12} className="text-[#5fd3ad] shrink-0" />;
    }
    return <Circle size={12} className="text-[#5fd3ad] shrink-0" />;
  };

  return (
    <>
      <div
        className="absolute top-14 right-2 sm:right-28 z-50 w-[500px] max-w-[calc(100vw-1rem)] h-[640px] mayan-panel popover border-2 border-[#2c3532] shadow-[0_16px_50px_rgba(0,0,0,0.95)] text-[#e6c699] flex flex-col select-none animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
        data-floating-ui="true"
        onClick={(e) => {
          e.stopPropagation();
          setActiveFolderMenu(null);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <MayanCornerBrackets size={16} color="#b89058" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2c3532] shrink-0">
          <div className="flex items-center gap-2">
            <Paintbrush size={15} className="text-[#b89058]" />
            <span className="text-xs font-mayan font-bold uppercase tracking-wider text-[#b89058]">
              {getToolTitle()}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept=".kpp,.myb,.bundle,.gbr,.gih,.sut,.brush,.brushset,.abr,.zip,.json,image/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold mayan-btn-stone hover:text-white transition-all cursor-pointer disabled:opacity-50"
              title="Import Krita (.bundle, .kpp), GIMP (.gbr, .gih), MyPaint (.myb), Clip Studio (.sut), or .json"
            >
              <Upload size={11} />
              <span>{isImporting ? 'Importing...' : 'Import'}</span>
            </button>
            <button
              onClick={() =>
                handleExportBrushes(
                  filteredBrushes.length > 0 ? filteredBrushes : [currentBrush],
                  selectedCategory || 'Hunbatz_Brushes'
                )
              }
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold mayan-btn-stone hover:text-white transition-all cursor-pointer"
              title="Export all brushes in current folder"
            >
              <Download size={11} />
              <span>Export</span>
            </button>
            <button
              onClick={handleDropAllToLocalContent}
              disabled={isSyncingAll}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold mayan-btn-stone hover:border-[#5fd3ad] text-[#5fd3ad] hover:text-white transition-all cursor-pointer disabled:opacity-50"
              title="Drop & persist all active studio brushes directly to disk in './Hunbatz local content/brushes/'"
            >
              <HardDrive size={11} className={isSyncingAll ? 'animate-spin' : ''} />
              <span>{isSyncingAll ? 'Saving...' : 'Drop Local'}</span>
            </button>
            <button
              onClick={handleCreateNewBrush}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold mayan-btn-jade transition-all cursor-pointer shadow-sm"
              title="Design new brush in this folder"
            >
              <Plus size={13} />
              <span>New Brush</span>
            </button>
          </div>
        </div>

        {/* Live Active Stroke Preview Ribbon */}
        <div className="mx-3 my-2 p-2.5 mayan-well rounded-xl border border-[#2a302d] flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 font-medium text-white/90">
              {renderShapeBadge(currentBrush)}
              <span className="truncate max-w-[150px]">{currentBrush.name}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#164435] text-[#5fd3ad] font-mono">
                {Math.round((currentBrush.shape?.roundness ?? 1) * 100)}% Round •{' '}
                {Math.round(currentBrush.shape?.rotation ?? 0)}°
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowTipGizmo((p) => !p)}
                className={`text-[10px] px-2 py-0.5 rounded font-medium cursor-pointer transition ${
                  showTipGizmo
                    ? 'mayan-btn-jade text-white'
                    : 'mayan-btn-stone text-[#e6c699]/70 hover:text-white'
                }`}
                title="Toggle Tip Angle & Roundness Gizmo"
              >
                Tip Gizmo {showTipGizmo ? '▲' : '▼'}
              </button>
              <span className="font-mono text-[10px] text-white/40">
                {Math.round(brushSize)}px • {Math.round(brushOpacity * 100)}%
              </span>
            </div>
          </div>
          <div className="w-full h-11 rounded-lg overflow-hidden mayan-well flex items-center justify-center border border-[#b89058]/30">
            <canvas
              ref={previewCanvasRef}
              width={360}
              height={44}
              className="w-full h-full object-contain"
            />
          </div>

          {showTipGizmo && (
            <div
              className="mt-1 p-2 rounded-lg bg-[#0d100f] border border-[#5fd3ad]/40 flex items-center justify-around animate-in fade-in zoom-in-95 duration-100"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <BrushTipGizmo
                angle={currentBrush.shape?.rotation ?? 0}
                roundness={currentBrush.shape?.roundness ?? 1}
                size={82}
                showNumericInputs={true}
                onChange={(newAngle, newRoundness) => {
                  const updated: Brush = {
                    ...currentBrush,
                    shape: {
                      ...currentBrush.shape,
                      texture:
                        currentBrush.shape?.texture ||
                        currentBrush.texture ||
                        'hard_round',
                      scatter: currentBrush.shape?.scatter ?? 0,
                      count: currentBrush.shape?.count ?? 1,
                      countJitter: currentBrush.shape?.countJitter ?? 0,
                      followStroke: currentBrush.shape?.followStroke ?? false,
                      rotation: newAngle,
                      roundness: newRoundness,
                    },
                  };
                  onUpdateBrush(updated);
                  onSelectBrush(updated);
                }}
              />
              <div className="flex flex-col text-[10px] text-[#e6c699]/70 max-w-[170px] leading-tight">
                <span className="font-bold text-[#5fd3ad]">Tip Angle & Roundness</span>
                <span className="mt-1 opacity-80">
                  Drag arrow to rotate tip angle. Drag nodes to compress roundness.
                </span>
                <span className="mt-1 text-emerald-400 font-mono">
                  Cursor outline updates live.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Two-Pane Body: Folder Sidebar + Brush List */}
        <div className="flex flex-1 min-h-0">
          {/* Left Pane: Folders - Scrollable with bottom clearance for open menus */}
          <div
            ref={folderListRef}
            className="w-52 mayan-well border-r border-[#2c3532] pt-2 flex flex-col gap-1 overflow-y-auto overflow-x-hidden shrink-0 touch-pan-y overscroll-contain scrollbar-thin [scrollbar-color:#398f73_#141817] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[#141817] [&::-webkit-scrollbar-thumb]:bg-[#2c7a60] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#5fd3ad]"
          >
            <div className="px-2 pb-1.5 border-b border-[#2c3532]/60">
              {!isCreatingFolder ? (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 w-full">
                    <button
                      onClick={() => setIsCreatingFolder(true)}
                      className="flex-1 py-1.5 px-2 rounded-lg mayan-btn-stone text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer hover:border-[#5fd3ad]"
                    >
                      <FolderPlus size={13} className="text-[#5fd3ad]" />
                      <span>+ New Folder</span>
                    </button>
                    <button
                      onClick={handleRefreshLocalContent}
                      disabled={isRefreshingLocal}
                      title="Re-scan 'Hunbatz local content/brushes/' on disk for new folders & brushes (.myb, .kpp)"
                      className="p-1.5 rounded-lg mayan-btn-stone hover:text-[#5fd3ad] cursor-pointer transition disabled:opacity-50 flex items-center justify-center shrink-0"
                    >
                      <RefreshCw size={13} className={isRefreshingLocal ? 'animate-spin text-[#5fd3ad]' : 'text-[#b89058]'} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-[#9e9484]/70 px-0.5 font-mono">
                    <span className="truncate">Hunbatz local content</span>
                    <span className="text-[#5fd3ad] shrink-0 font-semibold">{isRefreshingLocal ? 'Scanning...' : 'Live Sync'}</span>
                  </div>
                  <button
                    onClick={handleDropAllToLocalContent}
                    disabled={isSyncingAll}
                    className="w-full py-1.5 px-2 rounded-lg mayan-btn-jade text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all disabled:opacity-50"
                    title="Drop & persist all active studio brushes directly to disk in './Hunbatz local content/brushes/'"
                  >
                    <HardDrive size={12} className={isSyncingAll ? 'animate-pulse text-white' : 'text-white'} />
                    <span>{isSyncingAll ? 'Saving to Disk...' : 'Drop to Local Content'}</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 p-1.5 rounded-lg bg-black/40 border border-[#5fd3ad]/60">
                  <input
                    type="text"
                    placeholder="Folder name..."
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateFolder();
                      if (e.key === 'Escape') setIsCreatingFolder(false);
                    }}
                    autoFocus
                    className="w-full bg-[#0b0e0d] text-white text-xs px-2 py-1 rounded border border-white/10 focus:outline-none focus:border-[#5fd3ad]"
                  />
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setIsCreatingFolder(false)}
                      className="p-1 rounded text-white/50 hover:text-white cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                    <button
                      onClick={handleCreateFolder}
                      className="px-2 py-0.5 rounded bg-[#2c7a60] text-white text-[10px] font-semibold cursor-pointer"
                    >
                      Create
                    </button>
                  </div>
                </div>
              )}
            </div>

            {folders.map((folder) => {
              const count = activeValidBrushes.filter(
                (b) => (b.category || folders[0] || 'Inking') === folder
              ).length;
              const isSelected = selectedCategory === folder;
              const isDragTarget = dragOverFolder === folder;

              return (
                <div
                  key={folder}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverFolder(folder);
                  }}
                  onDragLeave={() => setDragOverFolder(null)}
                  onDrop={() => {
                    setDragOverFolder(null);
                    if (draggedBrushId) {
                      const targetBrush = activeValidBrushes.find(
                        (b) => b.id === draggedBrushId
                      );
                      if (targetBrush) {
                        onUpdateBrush({ ...targetBrush, category: folder });
                        setSelectedCategory(folder);
                      }
                      setDraggedBrushId(null);
                    }
                  }}
                  className={`group rounded-lg mx-1 my-0.5 transition-all overflow-visible ${
                    isDragTarget
                      ? 'ring-2 ring-emerald-500 bg-emerald-500/20 text-white'
                      : isSelected
                      ? 'bg-[#164435]/70 text-[#5fd3ad] font-bold border-l-2 border-[#5fd3ad]'
                      : 'text-[#9e9484] hover:text-[#e6c699] hover:bg-white/5'
                  }`}
                >
                  <div
                    onClick={() => setSelectedCategory(folder)}
                    className="px-2 py-2 text-left text-xs font-medium flex items-center justify-between cursor-pointer select-none"
                  >
                    {renamingFolder === folder ? (
                      <div
                        className="flex items-center gap-1 w-full"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') handleRenameFolder(folder);
                            if (e.key === 'Escape') setRenamingFolder(null);
                          }}
                          autoFocus
                          className="w-full bg-[#0b0e0d] text-white text-[11px] px-1.5 py-0.5 rounded border border-[#5fd3ad]"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRenameFolder(folder);
                          }}
                          className="text-[#5fd3ad] hover:text-white cursor-pointer p-0.5"
                        >
                          <Check size={12} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 truncate flex-1 min-w-0 pr-1">
                          <Folder
                            size={13}
                            className={isSelected ? 'text-[#5fd3ad] shrink-0' : 'text-[#b89058]/70 shrink-0'}
                          />
                          <span className="truncate">{folder}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] opacity-50 font-mono">
                            {count}
                          </span>

                          {/* Action Menu Trigger Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveFolderMenu(activeFolderMenu === folder ? null : folder);
                            }}
                            className={`min-w-[28px] min-h-[28px] p-1 rounded-md cursor-pointer transition flex items-center justify-center shrink-0 ${
                              activeFolderMenu === folder
                                ? 'bg-[#5fd3ad]/30 text-[#5fd3ad]'
                                : 'text-white/60 hover:text-white hover:bg-white/10'
                            }`}
                            title="Folder Actions"
                          >
                            <MoreHorizontal size={15} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Dropdown Menu directly under the folder row - Compact 2-column grid */}
                  {activeFolderMenu === folder && (
                    <div
                      ref={activeMenuRef}
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 border-t border-[#2c3532] bg-[#0c100e] flex flex-col gap-1.5 animate-in slide-in-from-top-1 duration-150 text-xs text-white"
                    >
                      <div className="flex items-center justify-between px-1 pb-1 border-b border-white/10 text-[9px] text-[#9e9484] uppercase tracking-wider font-semibold">
                        <span>Folder Actions</span>
                        <button
                          onClick={() => setActiveFolderMenu(null)}
                          className="hover:text-white cursor-pointer text-xs p-0.5 rounded text-white/50"
                          title="Close Actions"
                        >
                          ✕
                        </button>
                      </div>

                      {/* 2x2 Grid of Actions: all 4 actions visible at once without clipping */}
                      <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                        <button
                          onClick={() => {
                            setActiveFolderMenu(null);
                            setRenamingFolder(folder);
                            setRenameValue(folder);
                          }}
                          className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-white/5 hover:bg-[#164435] active:scale-[0.96] text-white/90 hover:text-white cursor-pointer transition text-xs font-medium border border-white/5 hover:border-[#5fd3ad]/50"
                          title="Rename folder"
                        >
                          <Edit3 size={12} className="text-[#5fd3ad] shrink-0" />
                          <span>Rename</span>
                        </button>

                        <button
                          onClick={(e) => handleDuplicateFolder(folder, e)}
                          className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-white/5 hover:bg-[#164435] active:scale-[0.96] text-white/90 hover:text-white cursor-pointer transition text-xs font-medium border border-white/5 hover:border-[#5fd3ad]/50"
                          title="Duplicate folder"
                        >
                          <Copy size={12} className="text-amber-400 shrink-0" />
                          <span>Duplicate</span>
                        </button>

                        <button
                          onClick={(e) => handleExportFolderBundle(folder, e)}
                          className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-white/5 hover:bg-[#164435] active:scale-[0.96] text-white/90 hover:text-white cursor-pointer transition text-xs font-medium border border-white/5 hover:border-[#5fd3ad]/50"
                          title="Export folder as .bundle.zip"
                        >
                          <Download size={12} className="text-cyan-400 shrink-0" />
                          <span>Export</span>
                        </button>

                        {folders.length > 1 ? (
                          <button
                            onClick={(e) => {
                              setActiveFolderMenu(null);
                              handleDeleteFolder(folder, e);
                            }}
                            className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 active:scale-[0.96] text-red-300 hover:text-red-100 cursor-pointer transition text-xs font-medium border border-red-800/40 hover:border-red-600/60"
                            title="Delete folder and its brushes"
                          >
                            <Trash2 size={12} className="text-red-400 shrink-0" />
                            <span>Delete</span>
                          </button>
                        ) : (
                          <div
                            className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-white/5 opacity-40 text-white/40 text-xs font-medium cursor-not-allowed border border-white/5"
                            title="Default folder cannot be deleted"
                          >
                            <Trash2 size={12} className="shrink-0" />
                            <span>Delete</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Guaranteed bottom scroll clearance so last folder and open menu never hit the edge */}
            <div className="h-28 shrink-0 pointer-events-none" />
          </div>

          {/* Right Pane: Brushes inside Selected Folder - Scrollable with bottom clearance */}
          <div className="flex-1 p-2.5 pb-40 flex flex-col gap-2 overflow-y-auto touch-pan-y overscroll-contain scrollbar-thin [scrollbar-color:#398f73_#141817] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[#141817] [&::-webkit-scrollbar-thumb]:bg-[#2c7a60] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#5fd3ad]">
            {filteredBrushes.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-xs text-white/40 gap-2">
                <Folder size={24} className="text-white/20" />
                <span>This folder is empty.</span>
                <button
                  onClick={handleCreateNewBrush}
                  className="px-3 py-1.5 rounded-lg mayan-btn-jade text-xs font-semibold cursor-pointer mt-1"
                >
                  + Create Brush Here
                </button>
              </div>
            ) : (
              filteredBrushes.map((b) => {
                const isActive = b.id === currentBrush.id;
                const hasCustomTip = Boolean((b as any).shapeTextureUrl);

                return (
                  <div
                    key={b.id}
                    draggable
                    onDragStart={() => setDraggedBrushId(b.id)}
                    onDragEnd={() => setDraggedBrushId(null)}
                    onClick={() => {
                      onSelectBrush(b);
                    }}
                    className={`group relative p-3 rounded-xl border flex flex-col gap-1.5 transition-all cursor-pointer ${
                      isActive
                        ? 'mayan-panel border-2 border-[#5fd3ad]/80 shadow-[0_0_14px_rgba(95,211,173,0.35)]'
                        : 'mayan-well border border-[#2a302d] hover:border-[#b89058]/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        {renderShapeBadge(b)}
                        <span className="text-xs font-semibold text-[#f2fbf7] truncate">
                          {b.name}
                        </span>
                      </div>

                      {/* Duplicate, Export, Edit in Studio, and Delete Brush Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExportBrushes([b], b.name);
                          }}
                          title="Export Brush"
                          className="p-1 rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                        >
                          <Download size={12} />
                        </button>
                        <button
                          onClick={(e) => handleDuplicate(b, e)}
                          title="Duplicate Brush"
                          className="p-1 rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingBrush(b);
                          }}
                          title="Open Brush Studio Settings"
                          className="p-1 rounded-md text-[#5fd3ad] hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                        >
                          <Settings2 size={13} />
                        </button>
                        {activeValidBrushes.length > 1 && (
                          <button
                            onClick={(e) => handleDeleteBrush(b.id, e)}
                            title="Delete Brush"
                            className="p-1 rounded-md text-red-400/70 hover:text-red-400 hover:bg-red-500/15 transition-all cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-[10px] text-white/45 line-clamp-1 leading-snug">
                      {b.description}
                    </p>

                    {/* Live Dynamic Stroke Swatch Preview */}
                    <div className="w-full h-8 rounded-lg overflow-hidden bg-[#070a09] border border-[#232d29] flex items-center justify-center p-0.5 shadow-inner">
                      <img
                        src={generateBrushSwatch(b, 280, 36, isActive ? '#5fd3ad' : '#b89058')}
                        alt={`${b.name} preview`}
                        className="w-full h-full object-contain pointer-events-none"
                        loading="lazy"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[9px] text-white/35 pt-0.5 font-mono">
                      <span>
                        {hasCustomTip
                          ? 'KRITA STAMP TIP'
                          : (b.shape?.texture || b.texture).toUpperCase()}
                      </span>
                      <span>Click gear icon to edit</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {editingBrush && (
        <BrushStudioModal
          brush={editingBrush}
          allBrushes={activeValidBrushes}
          onSelectPreset={(b) => {
            setEditingBrush(b);
            onSelectBrush(b);
          }}
          onSave={(updatedPreset) => {
            const asBrush = universalToBrush(updatedPreset);
            if (!folders.includes(asBrush.category)) {
              updateFoldersList([...folders, asBrush.category]);
            }
            onUpdateBrush(asBrush);
            onSelectBrush(asBrush);
            setEditingBrush(null);
          }}
          onUpdateBrush={(updated) => {
            if (!folders.includes(updated.category)) {
              updateFoldersList([...folders, updated.category]);
            }
            onUpdateBrush(updated);
            onSelectBrush(updated);
          }}
          onDuplicateBrush={onDuplicateBrush}
          onDeleteBrush={(idToDelete) => {
            handleDeleteBrush(idToDelete);
            setEditingBrush(null);
          }}
          onClose={() => setEditingBrush(null)}
        />
      )}
    </>
  );
};