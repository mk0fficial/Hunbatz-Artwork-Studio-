/**
 * Embedded backend for Tauri (desktop + Android + iOS).
 *
 * The web version talks to an Express server (server.ts) at /api/local-content/*.
 * Tauri apps (especially mobile) cannot run Node/Express, so inside Tauri we
 * intercept those fetch() calls and answer them locally:
 *   - textures / brush tips / default brushes -> static files bundled in the app
 *     (public/hunbatz-content, listed by manifest.json from scripts/prepare-content.cjs)
 *   - your edited brushes + folders          -> IndexedDB
 *   - .hbatz projects                        -> IndexedDB
 *   - "download" links / a.click() downloads -> native Save dialog (or Downloads folder)
 *
 * In a normal browser (npm run dev) this does nothing and the real server is used.
 */
import JSZip from 'jszip';
import { parseMybFile, parseKppFile } from '../utils/brushParsers';
import { universalToBrush } from '../types/brush';
import { hydrateBrush } from '../constants/brushes';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/* ---------------------------- tiny IndexedDB helper ---------------------------- */

const DB_NAME = 'hunbatz-embedded';
let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('kv');
        req.result.createObjectStore('projects');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function idb<T = any>(
  store: 'kv' | 'projects',
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest
): Promise<T> {
  const d = await db();
  return new Promise<T>((resolve, reject) => {
    const tx = d.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

const kvGet = <T = any>(key: string) => idb<T | undefined>('kv', 'readonly', (s) => s.get(key));
const kvSet = (key: string, val: any) => idb('kv', 'readwrite', (s) => s.put(val, key));

interface StoredProject {
  blob: Blob;
  savedAt: number;
}
const projGet = (name: string) => idb<StoredProject | undefined>('projects', 'readonly', (s) => s.get(name));
const projPut = (name: string, val: StoredProject) => idb('projects', 'readwrite', (s) => s.put(val, name));
const projDel = (name: string) => idb('projects', 'readwrite', (s) => s.delete(name));
const projKeys = () => idb<string[]>('projects', 'readonly', (s) => s.getAllKeys() as IDBRequest);

/* ------------------------------- helpers ------------------------------- */

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

const sanitize = (n: string) => n.replace(/[/\\?%*:|"<>]/g, '_');
const withExt = (n: string) => (n.toLowerCase().endsWith('.hbatz') ? n : `${n}.hbatz`);

interface Manifest {
  textures: string[];
  tips: string[];
  brushes: Record<string, string[]>;
}
let manifestCache: Manifest | null = null;
async function manifest(realFetch: typeof fetch): Promise<Manifest> {
  if (manifestCache) return manifestCache;
  try {
    const r = await realFetch('/hunbatz-content/manifest.json');
    manifestCache = r.ok ? await r.json() : { textures: [], tips: [], brushes: {} };
  } catch {
    manifestCache = { textures: [], tips: [], brushes: {} };
  }
  return manifestCache!;
}

interface BrushState {
  folders: string[];
  brushes: any[];
}
const BRUSH_KEY = 'brushState';
const HIDDEN_FOLDER = (f: string) =>
  f.toLowerCase().includes('velvetcat') ||
  f.toLowerCase().includes('custom') ||
  f === 'Hunbatz Base Brushes' ||
  f === 'Placeholder';

async function loadSeedBrushes(realFetch: typeof fetch): Promise<BrushState> {
  const m = await manifest(realFetch);
  const folders = Object.keys(m.brushes).filter((f) => !HIDDEN_FOLDER(f));
  const brushes: any[] = [];
  for (const folder of folders) {
    for (const file of m.brushes[folder]) {
      try {
        const url = `/hunbatz-content/brushes/${encodeURIComponent(folder)}/${encodeURIComponent(file)}`;
        const r = await realFetch(url);
        if (!r.ok) continue;
        let universal;
        if (/\.(myb|json)$/i.test(file)) {
          universal = parseMybFile(await r.text(), file);
        } else {
          universal = await parseKppFile(await r.arrayBuffer(), file);
        }
        universal.category = folder;
        const hydrated: any = hydrateBrush(universalToBrush(universal));
        if (/\.kpp$/i.test(file)) hydrated.iconUrl = url;
        hydrated.localFileName = file;
        hydrated.localFolderPath = folder;
        brushes.push(hydrated);
      } catch (e) {
        console.warn('[embedded] brush parse failed:', file, e);
      }
    }
  }
  return { folders: folders.length ? folders : ['Inking'], brushes };
}

async function getBrushState(realFetch: typeof fetch): Promise<BrushState> {
  const saved = await kvGet<BrushState>(BRUSH_KEY);
  if (saved && Array.isArray(saved.brushes)) return saved;
  return loadSeedBrushes(realFetch);
}

/* ------------------------------ request router ------------------------------ */

async function route(
  realFetch: typeof fetch,
  url: URL,
  method: string,
  init?: RequestInit
): Promise<Response | null> {
  const p = url.pathname;

  // ---- static project download: /hunbatz-content/Projects/<file>
  if (p.startsWith('/hunbatz-content/Projects/')) {
    const name = decodeURIComponent(p.slice('/hunbatz-content/Projects/'.length));
    const rec = await projGet(name);
    return rec ? new Response(rec.blob) : new Response('Not found', { status: 404 });
  }

  if (!p.startsWith('/api/local-content/')) return null;
  const sub = p.slice('/api/local-content/'.length);
  const body = async () => {
    try {
      return typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    } catch {
      return {};
    }
  };

  // ---- status
  if (sub === 'status') {
    const m = await manifest(realFetch);
    const keys = await projKeys();
    return json({
      ok: true,
      folders: Object.keys(m.brushes),
      totalBrushes: Object.values(m.brushes).reduce((a, b) => a + b.length, 0),
      textures: m.textures.length,
      tips: m.tips.length,
      projects: keys.length,
    });
  }

  // ---- textures
  if (sub === 'textures' && method === 'GET') {
    const m = await manifest(realFetch);
    const textures = m.textures.map((file) => {
      const baseName = file
        .replace(/\.[^/.]+$/, '')
        .replace(/_[a-f0-9]{8}$/i, '')
        .replace(/^[0-9]+[a-z]?_/i, '')
        .replace(/[-_]/g, ' ')
        .trim();
      return {
        id: file.replace(/\.[^/.]+$/, '').toLowerCase(),
        name: baseName || file,
        fileName: file,
        url: `/hunbatz-content/textures/${encodeURIComponent(file)}`,
        tag: 'Local Content',
      };
    });
    return json({ ok: true, textures });
  }

  // ---- brush tips
  if (sub === 'brush-tips' && method === 'GET') {
    const m = await manifest(realFetch);
    const tips = m.tips.map((file, idx) => ({
      id: `tip_local_${idx}_${file.replace(/\.[^/.]+$/, '')}`,
      name: file.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
      fileName: file,
      url: `/hunbatz-content/brush tips/${encodeURIComponent(file)}`,
    }));
    return json({ ok: true, tips });
  }

  // ---- brushes
  if (sub === 'brushes') {
    if (method === 'GET') {
      const st = await getBrushState(realFetch);
      return json({ ok: true, folders: st.folders, brushes: st.brushes });
    }
    if (method === 'POST') {
      const { brush, folder } = await body();
      if (!brush?.name) return json({ ok: false, error: 'Missing brush' }, 400);
      const st = await getBrushState(realFetch);
      const f = (folder || brush.category || 'Inking').trim();
      if (!st.folders.includes(f)) st.folders.push(f);
      const b = { ...brush, category: f };
      const i = st.brushes.findIndex((x) => x.name === b.name && x.category === f);
      if (i >= 0) st.brushes[i] = b;
      else st.brushes.push(b);
      await kvSet(BRUSH_KEY, st);
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      const { folder, fileName, name } = await body();
      const st = await getBrushState(realFetch);
      st.brushes = st.brushes.filter(
        (x) =>
          !(
            (!folder || x.category === folder || x.localFolderPath === folder) &&
            ((name && x.name === name) || (fileName && x.localFileName === fileName))
          )
      );
      await kvSet(BRUSH_KEY, st);
      return json({ ok: true });
    }
  }

  if (sub === 'sync-all' && method === 'POST') {
    const { brushes, folders } = await body();
    if (!Array.isArray(brushes)) return json({ ok: false, error: 'Expected brushes array' }, 400);
    const set = new Set<string>();
    (Array.isArray(folders) ? folders : []).forEach((f: any) => typeof f === 'string' && f.trim() && set.add(f.trim()));
    brushes.forEach((b: any) => b?.category && set.add(String(b.category).trim()));
    if (set.size === 0) set.add('Inking');
    const st: BrushState = { folders: Array.from(set), brushes };
    await kvSet(BRUSH_KEY, st);
    return json({ ok: true, syncedBrushesCount: brushes.length, syncedFoldersCount: set.size, folders: st.folders });
  }

  // ---- folders
  if (sub === 'folders') {
    const st = await getBrushState(realFetch);
    const b = await body();
    if (method === 'POST') {
      const n = String(b.name || '').trim();
      if (n && !st.folders.includes(n)) st.folders.push(n);
    } else if (method === 'DELETE') {
      st.folders = st.folders.filter((f) => f !== b.name);
      st.brushes = st.brushes.filter((x) => x.category !== b.name);
    } else if (method === 'PUT') {
      st.folders = st.folders.map((f) => (f === b.oldName ? b.newName : f));
      st.brushes = st.brushes.map((x) => (x.category === b.oldName ? { ...x, category: b.newName } : x));
    }
    await kvSet(BRUSH_KEY, st);
    return json({ ok: true, folders: st.folders });
  }

  // ---- projects
  if (sub === 'projects' && method === 'GET') {
    const names = await projKeys();
    const projects: any[] = [];
    for (const name of names) {
      try {
        const rec = await projGet(String(name));
        if (!rec) continue;
        const zip = await JSZip.loadAsync(rec.blob);
        const mf = zip.file('manifest.json');
        if (!mf) continue;
        const manifestJson = JSON.parse(await mf.async('string'));
        if (!manifestJson.artwork) continue;
        projects.push({
          fileName: name,
          fileSize: rec.blob.size,
          updatedAt: manifestJson.updatedAt || rec.savedAt,
          createdAt: manifestJson.createdAt || rec.savedAt,
          artwork: {
            ...manifestJson.artwork,
            fileName: name,
            fileSize: rec.blob.size,
            layers: manifestJson.layers || [],
          },
          url: `/hunbatz-content/Projects/${encodeURIComponent(String(name))}`,
        });
      } catch (e) {
        console.warn('[embedded] bad project', name, e);
      }
    }
    projects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return json({ ok: true, projects });
  }

  if (sub === 'projects/save-binary' && method === 'POST') {
    const fileName = url.searchParams.get('fileName');
    if (!fileName) return json({ ok: false, error: 'Missing fileName parameter' }, 400);
    const blob = init?.body instanceof Blob ? init.body : new Blob([init?.body as any]);
    if (!blob.size) return json({ ok: false, error: 'Empty file payload' }, 400);
    const finalName = withExt(sanitize(fileName));
    await projPut(finalName, { blob, savedAt: Date.now() });
    return json({ ok: true, fileName: finalName, size: blob.size, url: `/hunbatz-content/Projects/${encodeURIComponent(finalName)}` });
  }

  if (sub === 'projects/save' && method === 'POST') {
    const { fileName, base64Data } = await body();
    if (!fileName || !base64Data) return json({ ok: false, error: 'Missing fileName or base64Data' }, 400);
    const bin = atob(String(base64Data).replace(/^data:[^;]+;base64,/, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const finalName = withExt(sanitize(fileName));
    await projPut(finalName, { blob: new Blob([bytes]), savedAt: Date.now() });
    return json({ ok: true, fileName: finalName, size: bytes.length, url: `/hunbatz-content/Projects/${encodeURIComponent(finalName)}` });
  }

  if (sub.startsWith('projects/') && method === 'DELETE') {
    const name = withExt(sanitize(decodeURIComponent(sub.slice('projects/'.length))));
    await projDel(name);
    return json({ ok: true, deleted: name });
  }

  return json({ ok: false, error: `Unhandled embedded route: ${method} ${p}` }, 404);
}

/* ------------------------- native file saving (downloads) ------------------------- */

function toast(msg: string) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText =
    'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;' +
    'background:#164435;color:#e0e2ec;padding:10px 16px;border-radius:8px;font:13px sans-serif;' +
    'box-shadow:0 4px 16px rgba(0,0,0,.5);max-width:90vw;text-align:center';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

async function nativeSave(blob: Blob, filename: string) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const { save } = await import('@tauri-apps/plugin-dialog');
  const { writeFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');

  // 1) Save dialog (desktop, iOS)
  try {
    const ext = filename.includes('.') ? filename.split('.').pop()! : '';
    const path = await save({
      defaultPath: filename,
      filters: ext ? [{ name: ext.toUpperCase(), extensions: [ext] }] : undefined,
    });
    if (!path) return; // user cancelled
    await writeFile(path, bytes);
    toast(`Saved ${filename}`);
    return;
  } catch (e) {
    console.warn('[embedded] save dialog unavailable, falling back to folders', e);
  }

  // 2) Fallback (Android): Downloads, then Documents
  for (const [dir, label] of [
    [BaseDirectory.Download, 'Downloads'],
    [BaseDirectory.Document, 'Documents'],
  ] as const) {
    try {
      await writeFile(filename, bytes, { baseDir: dir });
      toast(`Saved to ${label}: ${filename}`);
      return;
    } catch (e) {
      console.warn('[embedded] could not write to', label, e);
    }
  }
  toast('Could not save the file');
}

function handleDownload(a: HTMLAnchorElement) {
  const filename = a.getAttribute('download') || 'download';
  const href = a.href;
  // Start the fetch synchronously so callers can revokeObjectURL right after click()
  fetch(href)
    .then((r) => r.blob())
    .then((blob) => nativeSave(blob, filename))
    .catch((e) => {
      console.error('[embedded] download failed', e);
      toast('Download failed');
    });
}

/* --------------------------------- install --------------------------------- */

if (isTauri) {
  const realFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const url = new URL(raw, window.location.origin);
      const method = (init?.method || (typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET')).toUpperCase();
      if (url.pathname.startsWith('/api/local-content/') || url.pathname.startsWith('/hunbatz-content/Projects/')) {
        const res = await route(realFetch, url, method, init);
        if (res) return res;
      }
    } catch (e) {
      console.error('[embedded] backend error', e);
      return json({ ok: false, error: String((e as Error)?.message || e) }, 500);
    }
    return realFetch(input as any, init);
  };

  // a.download = ...; a.click()  (detached anchors)
  const origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    if (this.hasAttribute('download') && this.href) {
      handleDownload(this);
      return;
    }
    return origClick.call(this);
  };

  // <a href=... download> rendered in the page (e.g. gallery "Export .HBATZ")
  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as Element | null)?.closest?.('a[download]') as HTMLAnchorElement | null;
      if (a && a.href) {
        e.preventDefault();
        handleDownload(a);
      }
    },
    true
  );
}

export {};
