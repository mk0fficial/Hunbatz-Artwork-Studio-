import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';
import { parseMybFile, parseKppFile, serializeBrushToMyb } from './src/utils/brushParsers';
import { universalToBrush } from './src/types/brush';
import { hydrateBrush, DEFAULT_BRUSH_CATEGORIES } from './src/constants/brushes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

const LOCAL_CONTENT_DIR = path.resolve(process.cwd(), 'Hunbatz local content');
const BRUSHES_DIR = path.join(LOCAL_CONTENT_DIR, 'brushes');
const TEXTURES_DIR = path.join(LOCAL_CONTENT_DIR, 'textures');
const TIPS_DIR = path.join(LOCAL_CONTENT_DIR, 'brush tips');
const PROJECTS_DIR = path.join(LOCAL_CONTENT_DIR, 'Projects');

// Ensure base directories exist
for (const dir of [LOCAL_CONTENT_DIR, BRUSHES_DIR, TEXTURES_DIR, TIPS_DIR, PROJECTS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Serve local content statically under /hunbatz-content and /assets/brush_tips
app.use('/hunbatz-content', express.static(LOCAL_CONTENT_DIR));
app.use('/assets/brush_tips', express.static(TIPS_DIR));

// 1. Status endpoint
app.get('/api/local-content/status', (_req, res) => {
  try {
    const folders = fs.existsSync(BRUSHES_DIR)
      ? fs.readdirSync(BRUSHES_DIR, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
      : [];

    let totalBrushes = 0;
    for (const f of folders) {
      const p = path.join(BRUSHES_DIR, f);
      const files = fs.readdirSync(p).filter((file) => /\.(myb|kpp)$/i.test(file));
      totalBrushes += files.length;
    }

    const textures = fs.existsSync(TEXTURES_DIR)
      ? fs.readdirSync(TEXTURES_DIR).filter((f) => /\.(png|jpg|jpeg|webp|pat)$/i.test(f)).length
      : 0;

    const tips = fs.existsSync(TIPS_DIR)
      ? fs.readdirSync(TIPS_DIR).filter((f) => /\.(png|jpg|jpeg|webp|gbr)$/i.test(f)).length
      : 0;

    const projects = fs.existsSync(PROJECTS_DIR)
      ? fs.readdirSync(PROJECTS_DIR).filter((f) => f.toLowerCase().endsWith('.hbatz')).length
      : 0;

    res.json({
      ok: true,
      path: LOCAL_CONTENT_DIR,
      foldersCount: folders.length,
      folders,
      totalBrushes,
      texturesCount: textures,
      tipsCount: tips,
      projectsCount: projects,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 2. Get all brush folders and brushes from disk
app.get('/api/local-content/brushes', async (_req, res) => {
  try {
    if (!fs.existsSync(BRUSHES_DIR)) {
      return res.json({ folders: ['Inking'], brushes: [] });
    }

    const folderEntries = fs.readdirSync(BRUSHES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((name) =>
        !name.toLowerCase().includes('velvetcat') &&
        !name.toLowerCase().includes('custom') &&
        name !== 'Hunbatz Base Brushes' &&
        name !== 'Placeholder'
      );

    // Strictly respect the folders present on disk; do NOT force deleted default categories
    const allFolders = folderEntries.length > 0 ? folderEntries : ['Inking'];
    const brushes: any[] = [];

    for (const folder of allFolders) {
      const folderPath = path.join(BRUSHES_DIR, folder);
      if (!fs.existsSync(folderPath)) continue;

      const files = fs.readdirSync(folderPath).filter((f) => /\.(myb|kpp|json)$/i.test(f));
      for (const file of files) {
        try {
          const filePath = path.join(folderPath, file);
          if (file.endsWith('.myb') || file.endsWith('.json')) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const universal = parseMybFile(content, file);
            universal.category = folder;
            const hydrated = hydrateBrush(universalToBrush(universal));
            (hydrated as any).localFileName = file;
            (hydrated as any).localFolderPath = folder;
            brushes.push(hydrated);
          } else if (file.endsWith('.kpp')) {
            const buf = fs.readFileSync(filePath);
            const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
            const universal = await parseKppFile(ab, file);
            universal.category = folder;
            const hydrated = hydrateBrush(universalToBrush(universal));
            (hydrated as any).iconUrl = `/hunbatz-content/brushes/${encodeURIComponent(folder)}/${encodeURIComponent(file)}`;
            (hydrated as any).localFileName = file;
            (hydrated as any).localFolderPath = folder;
            brushes.push(hydrated);
          }
        } catch (err) {
          console.error(`Error reading brush file ${file} in ${folder}:`, err);
        }
      }
    }

    res.json({
      ok: true,
      folders: allFolders,
      brushes,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 2b. Sync/Drop all studio brushes directly into Hunbatz local content directory
app.post('/api/local-content/sync-all', (req, res) => {
  try {
    const { brushes, folders } = req.body;
    if (!Array.isArray(brushes)) {
      return res.status(400).json({ ok: false, error: 'Expected brushes array' });
    }

    if (!fs.existsSync(BRUSHES_DIR)) {
      fs.mkdirSync(BRUSHES_DIR, { recursive: true });
    }

    // 1. Gather all active folders
    const targetFolders = new Set<string>();
    if (Array.isArray(folders)) {
      folders.forEach((f) => {
        if (typeof f === 'string' && f.trim()) targetFolders.add(f.trim());
      });
    }
    brushes.forEach((b: any) => {
      if (b && b.category && typeof b.category === 'string') {
        targetFolders.add(b.category.trim());
      }
    });

    if (targetFolders.size === 0) {
      targetFolders.add('Inking');
    }

    // Ensure target folder directories exist
    for (const folder of targetFolders) {
      const fPath = path.join(BRUSHES_DIR, folder);
      if (!fs.existsSync(fPath)) {
        fs.mkdirSync(fPath, { recursive: true });
      }
    }

    // 2. Remove folders on disk that are NOT in targetFolders
    const existingDirs = fs.readdirSync(BRUSHES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const dirName of existingDirs) {
      if (!targetFolders.has(dirName)) {
        const removePath = path.join(BRUSHES_DIR, dirName);
        fs.rmSync(removePath, { recursive: true, force: true });
      }
    }

    // 3. For each folder, save active brushes and remove stale files
    const writtenFilesByFolder = new Map<string, Set<string>>();
    for (const brush of brushes) {
      if (!brush || !brush.name) continue;
      const folder = (brush.category || 'Inking').trim();
      const folderPath = path.join(BRUSHES_DIR, folder);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      const fileName = `${brush.name.replace(/[/\\?%*:|"<>]/g, '_')}.myb`;
      const filePath = path.join(folderPath, fileName);
      const mybContent = serializeBrushToMyb(brush);
      fs.writeFileSync(filePath, mybContent, 'utf-8');

      if (!writtenFilesByFolder.has(folder)) {
        writtenFilesByFolder.set(folder, new Set());
      }
      writtenFilesByFolder.get(folder)!.add(fileName);
    }

    // Remove any stale brush files from each folder that weren't in brushes
    for (const folder of targetFolders) {
      const folderPath = path.join(BRUSHES_DIR, folder);
      if (!fs.existsSync(folderPath)) continue;
      const currentFiles = fs.readdirSync(folderPath);
      const keepFiles = writtenFilesByFolder.get(folder) || new Set();
      for (const file of currentFiles) {
        if (file.endsWith('.myb') && !keepFiles.has(file)) {
          fs.unlinkSync(path.join(folderPath, file));
        }
      }
    }

    res.json({
      ok: true,
      syncedBrushesCount: brushes.length,
      syncedFoldersCount: targetFolders.size,
      folders: Array.from(targetFolders),
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 3. Save a brush as .myb into a local folder
app.post('/api/local-content/brushes', (req, res) => {
  try {
    const { brush, folder } = req.body;
    if (!brush || !brush.name) {
      return res.status(400).json({ ok: false, error: 'Missing brush or brush name' });
    }

    const targetFolder = (folder || brush.category || 'Pencils').trim();
    const folderPath = path.join(BRUSHES_DIR, targetFolder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const cleanName = brush.name.replace(/[/\\?%*:|"<>]/g, '_').trim();
    const fileName = `${cleanName}.myb`;
    const filePath = path.join(folderPath, fileName);

    const updatedBrush = { ...brush, category: targetFolder };
    const mybContent = serializeBrushToMyb(updatedBrush);
    fs.writeFileSync(filePath, mybContent, 'utf-8');

    res.json({
      ok: true,
      folder: targetFolder,
      fileName,
      path: filePath,
      brush: updatedBrush,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 4. Delete a brush file from disk
app.delete('/api/local-content/brushes', (req, res) => {
  try {
    const { folder, fileName, name } = req.body;
    if (!folder) return res.status(400).json({ ok: false, error: 'Folder required' });

    const folderPath = path.join(BRUSHES_DIR, folder);
    const targetFile = fileName || (name ? `${name.replace(/[/\\?%*:|"<>]/g, '_')}.myb` : null);
    if (!targetFile) return res.status(400).json({ ok: false, error: 'File name required' });

    const filePath = path.join(folderPath, targetFile);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return res.json({ ok: true, deleted: targetFile });
    }

    res.status(404).json({ ok: false, error: 'File not found' });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 5. Create a new folder
app.post('/api/local-content/folders', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ ok: false, error: 'Folder name required' });
    }

    const cleanName = name.replace(/[/\\?%*:|"<>]/g, '_').trim();
    const folderPath = path.join(BRUSHES_DIR, cleanName);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    res.json({ ok: true, folder: cleanName });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 5b. Delete a folder from disk
app.delete('/api/local-content/folders', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ ok: false, error: 'Folder name required' });
    }
    const cleanName = name.replace(/[/\\?%*:|"<>]/g, '_').trim();
    const folderPath = path.join(BRUSHES_DIR, cleanName);
    if (fs.existsSync(folderPath)) {
      fs.rmSync(folderPath, { recursive: true, force: true });
      return res.json({ ok: true, deleted: cleanName });
    }
    res.json({ ok: true, message: 'Folder not found or already deleted' });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 5c. Rename a folder on disk
app.put('/api/local-content/folders', (req, res) => {
  try {
    const { oldName, newName } = req.body;
    if (!oldName || !newName) {
      return res.status(400).json({ ok: false, error: 'Old and new folder names required' });
    }
    const cleanOld = oldName.replace(/[/\\?%*:|"<>]/g, '_').trim();
    const cleanNew = newName.replace(/[/\\?%*:|"<>]/g, '_').trim();
    const oldPath = path.join(BRUSHES_DIR, cleanOld);
    const newPath = path.join(BRUSHES_DIR, cleanNew);
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
      return res.json({ ok: true, oldName: cleanOld, newName: cleanNew });
    }
    res.status(404).json({ ok: false, error: 'Source folder not found' });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 6. Get all texture / pattern swatches
app.get('/api/local-content/textures', (_req, res) => {
  try {
    if (!fs.existsSync(TEXTURES_DIR)) {
      return res.json({ textures: [] });
    }

    const files = fs.readdirSync(TEXTURES_DIR).filter((f) =>
      /\.(png|jpg|jpeg|webp|pat)$/i.test(f)
    );

    const textures = files.map((file) => {
      // Derive clean name: e.g. "01_canvas_57b8ade6.png" -> "01 Canvas"
      const baseName = file
        .replace(/\.[^/.]+$/, '')
        .replace(/_[a-f0-9]{8}$/i, '')
        .replace(/^[0-9]+[a-z]?_/i, '')
        .replace(/[-_]/g, ' ')
        .trim();

      const id = file.replace(/\.[^/.]+$/, '').toLowerCase();
      const url = `/hunbatz-content/textures/${encodeURIComponent(file)}`;

      return {
        id,
        name: baseName || file,
        fileName: file,
        url,
        tag: 'Local Content',
      };
    });

    res.json({ ok: true, textures });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 7. Get all brush tip stamps
app.get('/api/local-content/brush-tips', (_req, res) => {
  try {
    if (!fs.existsSync(TIPS_DIR)) {
      return res.json({ tips: [] });
    }

    const files = fs.readdirSync(TIPS_DIR).filter((f) =>
      /\.(png|jpg|jpeg|webp|gbr)$/i.test(f)
    );

    const tips = files.map((file, idx) => {
      const cleanName = file.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const id = `tip_local_${idx}_${file.replace(/\.[^/.]+$/, '')}`;
      const url = `/hunbatz-content/brush tips/${encodeURIComponent(file)}`;

      return {
        id,
        name: cleanName,
        fileName: file,
        url,
      };
    });

    res.json({ ok: true, tips });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 8. Get all .HBATZ projects stored in Hunbatz local content/Projects/
app.get('/api/local-content/projects', async (_req, res) => {
  try {
    if (!fs.existsSync(PROJECTS_DIR)) {
      return res.json({ ok: true, projects: [] });
    }

    const files = fs.readdirSync(PROJECTS_DIR).filter((f) => f.toLowerCase().endsWith('.hbatz'));
    const projects: any[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(PROJECTS_DIR, file);
        const stat = fs.statSync(filePath);
        const fileBuf = fs.readFileSync(filePath);
        const zip = await JSZip.loadAsync(fileBuf);
        const manifestFile = zip.file('manifest.json');
        if (manifestFile) {
          const manifestText = await manifestFile.async('string');
          const manifest = JSON.parse(manifestText);
          if (manifest.artwork) {
            projects.push({
              fileName: file,
              fileSize: stat.size,
              updatedAt: manifest.updatedAt || stat.mtimeMs,
              createdAt: manifest.createdAt || stat.birthtimeMs,
              artwork: {
                ...manifest.artwork,
                fileName: file,
                fileSize: stat.size,
                layers: manifest.layers || [],
              },
              url: `/hunbatz-content/Projects/${encodeURIComponent(file)}`,
            });
          }
        }
      } catch (fileErr) {
        console.error(`Failed to parse .hbatz project file ${file}:`, fileErr);
      }
    }

    // Sort by updatedAt descending (newest on top)
    projects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    res.json({ ok: true, projects });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 9. Save .HBATZ project binary directly into Hunbatz local content/Projects/
app.post(
  '/api/local-content/projects/save-binary',
  express.raw({ type: () => true, limit: '200mb' }),
  async (req, res) => {
    try {
      const fileNameParam = (req.query.fileName as string) || (req.headers['x-filename'] as string);
      if (!fileNameParam) {
        return res.status(400).json({ ok: false, error: 'Missing fileName parameter' });
      }

      if (!fs.existsSync(PROJECTS_DIR)) {
        fs.mkdirSync(PROJECTS_DIR, { recursive: true });
      }

      const safeName = path.basename(fileNameParam).replace(/[/\\?%*:|"<>]/g, '_');
      const finalFileName = safeName.endsWith('.hbatz') ? safeName : `${safeName}.hbatz`;
      const targetPath = path.join(PROJECTS_DIR, finalFileName);

      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
      if (!buffer || buffer.length === 0) {
        return res.status(400).json({ ok: false, error: 'Empty file payload' });
      }

      fs.writeFileSync(targetPath, buffer);
      console.log(`Saved .HBATZ project: ${targetPath} (${buffer.length} bytes)`);

      res.json({
        ok: true,
        fileName: finalFileName,
        size: buffer.length,
        url: `/hunbatz-content/Projects/${encodeURIComponent(finalFileName)}`,
      });
    } catch (err: any) {
      console.error('Error saving .HBATZ project to local content:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  }
);

// 9b. Save .HBATZ project JSON base64
app.post('/api/local-content/projects/save', async (req, res) => {
  try {
    const { fileName, base64Data } = req.body;
    if (!fileName || !base64Data) {
      return res.status(400).json({ ok: false, error: 'Missing fileName or base64Data' });
    }

    if (!fs.existsSync(PROJECTS_DIR)) {
      fs.mkdirSync(PROJECTS_DIR, { recursive: true });
    }

    const safeName = path.basename(fileName).replace(/[/\\?%*:|"<>]/g, '_');
    const finalFileName = safeName.endsWith('.hbatz') ? safeName : `${safeName}.hbatz`;
    const targetPath = path.join(PROJECTS_DIR, finalFileName);

    const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');
    fs.writeFileSync(targetPath, buffer);

    res.json({
      ok: true,
      fileName: finalFileName,
      size: buffer.length,
      url: `/hunbatz-content/Projects/${encodeURIComponent(finalFileName)}`,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 10. Delete .HBATZ project from Hunbatz local content/Projects/
app.delete('/api/local-content/projects/:fileName', (req, res) => {
  try {
    const { fileName } = req.params;
    if (!fileName) return res.status(400).json({ ok: false, error: 'File name required' });

    const safeName = path.basename(fileName);
    const finalFileName = safeName.endsWith('.hbatz') ? safeName : `${safeName}.hbatz`;
    const targetPath = path.join(PROJECTS_DIR, finalFileName);

    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      console.log(`Deleted project from disk: ${targetPath}`);
      return res.json({ ok: true, deleted: finalFileName });
    }

    res.json({ ok: true, message: 'File not found or already deleted' });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Mount Vite dev server in middleware mode
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hunbatz Studio full-stack dev server running on http://0.0.0.0:${PORT}`);
    console.log(`Local content root: ${LOCAL_CONTENT_DIR}`);
  });
}

startServer();
