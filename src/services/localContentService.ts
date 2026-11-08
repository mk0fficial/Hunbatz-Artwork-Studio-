import { Brush } from '../types/canvas';
import { DEFAULT_BRUSH_CATEGORIES, FACTORY_BRUSH_DEFAULTS, hydrateBrush } from '../constants/brushes';
import { registerCustomKritaPattern, preloadKritaTexture, KritaPatternDef } from '../utils/brushEngine';

export interface LocalTextureDef {
  id: string;
  name: string;
  fileName: string;
  url: string;
  tag?: string;
}

export interface LocalTipDef {
  id: string;
  name: string;
  fileName: string;
  url: string;
}

export interface LocalBrushesResponse {
  folders: string[];
  brushes: Brush[];
}

let cachedTextures: LocalTextureDef[] = [];
let cachedTips: LocalTipDef[] = [];
const textureSubscribers: Array<(textures: LocalTextureDef[]) => void> = [];

export function subscribeToLocalTextures(cb: (textures: LocalTextureDef[]) => void) {
  textureSubscribers.push(cb);
  if (cachedTextures.length > 0) cb(cachedTextures);
  return () => {
    const idx = textureSubscribers.indexOf(cb);
    if (idx !== -1) textureSubscribers.splice(idx, 1);
  };
}

export async function fetchLocalBrushes(): Promise<LocalBrushesResponse> {
  try {
    const res = await fetch('/api/local-content/brushes');
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.folders) && Array.isArray(data.brushes) && data.brushes.length > 0) {
        const cleanFolders = data.folders.filter(
          (f: string) =>
            f &&
            !f.toLowerCase().includes('velvetcat') &&
            !f.toLowerCase().includes('custom') &&
            f !== 'Hunbatz Base Brushes' &&
            f !== 'Placeholder'
        );
        const hydrated = data.brushes.map((b: any) => hydrateBrush(b));
        return {
          folders: cleanFolders.length > 0 ? cleanFolders : ['Inking'],
          brushes: hydrated,
        };
      }
    }
  } catch (err) {
    console.warn('Could not fetch brushes from local-content API, using defaults:', err);
  }

  return {
    folders: ['Inking'],
    brushes: FACTORY_BRUSH_DEFAULTS.filter((b) => b.category === 'Inking'),
  };
}

export async function syncAllToLocalContent(brushes: Brush[], folders: string[]): Promise<boolean> {
  try {
    const res = await fetch('/api/local-content/sync-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brushes, folders }),
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to sync all brushes to local content API:', err);
    return false;
  }
}

export async function saveLocalBrush(brush: Brush, folder: string): Promise<boolean> {
  try {
    const res = await fetch('/api/local-content/brushes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brush, folder }),
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to save brush to local-content API:', err);
    return false;
  }
}

export async function deleteLocalBrush(folder: string, fileName?: string, name?: string): Promise<boolean> {
  try {
    const res = await fetch('/api/local-content/brushes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, fileName, name }),
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to delete brush from local-content API:', err);
    return false;
  }
}

export async function createLocalFolder(name: string): Promise<boolean> {
  try {
    const res = await fetch('/api/local-content/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to create local folder:', err);
    return false;
  }
}

export async function deleteLocalFolder(name: string): Promise<boolean> {
  try {
    const res = await fetch('/api/local-content/folders', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to delete local folder:', err);
    return false;
  }
}

export async function renameLocalFolder(oldName: string, newName: string): Promise<boolean> {
  try {
    const res = await fetch('/api/local-content/folders', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldName, newName }),
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to rename local folder:', err);
    return false;
  }
}

export async function fetchLocalTextures(): Promise<LocalTextureDef[]> {
  try {
    const res = await fetch('/api/local-content/textures');
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.textures)) {
        cachedTextures = data.textures;
        // Auto register all textures into global pattern registry
        for (const tex of data.textures) {
          preloadKritaTexture(tex.url);
          registerCustomKritaPattern(tex.name, tex.url, tex.id);
        }
        textureSubscribers.forEach((cb) => cb(cachedTextures));
        return data.textures;
      }
    }
  } catch (err) {
    console.warn('Could not fetch textures from local-content API:', err);
  }
  return cachedTextures;
}

export async function fetchLocalBrushTips(): Promise<LocalTipDef[]> {
  try {
    const res = await fetch('/api/local-content/brush-tips');
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.tips)) {
        cachedTips = data.tips;
        for (const tip of data.tips) {
          preloadKritaTexture(tip.url);
        }
        return data.tips;
      }
    }
  } catch (err) {
    console.warn('Could not fetch tips from local-content API:', err);
  }
  return cachedTips;
}

// Initial eager fetch when module loads
if (typeof window !== 'undefined') {
  setTimeout(() => {
    fetchLocalTextures().catch(() => {});
    fetchLocalBrushTips().catch(() => {});
  }, 100);
}
