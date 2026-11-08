import JSZip from 'jszip';
import { Brush, BrushCategory } from '../types/canvas';

// Helper to convert an ArrayBuffer to a Base64 data URL
export function arrayBufferToDataUrl(buffer: ArrayBuffer, mimeType: string = 'image/png'): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const blob = new Blob([buffer], { type: mimeType });
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  const base64 = typeof Buffer !== 'undefined' ? Buffer.from(buffer).toString('base64') : '';
  return Promise.resolve(`data:${mimeType};base64,${base64}`);
}

// Convert 8-bit grayscale bitmap into a transparent Canvas PNG Data URL (Photoshop stamp)
export function grayscaleToStampDataUrl(
  pixels: Uint8Array,
  width: number,
  height: number
): string {
  if (typeof document === 'undefined') {
    return 'data:image/png;base64,';
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  for (let i = 0; i < pixels.length; i++) {
    const gray = pixels[i];
    // In Photoshop stamps, 0 = black / full paint, 255 = transparent or vice versa
    // We treat darker/opaque pixels as the brush stamp mask
    const alpha = 255 - gray;
    const idx = i * 4;
    data[idx] = 255; // White stamp base, will be tinted dynamically by color
    data[idx + 1] = 255;
    data[idx + 2] = 255;
    data[idx + 3] = alpha;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Binary Parser for Photoshop (.abr) Brush Files
 * Supports Version 1, 2, and 6+ Sampled Brushes (8BIM / samp)
 */
export async function parseAbrFile(file: File | ArrayBuffer | { name?: string; arrayBuffer: () => Promise<ArrayBuffer> }): Promise<Brush[]> {
  const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  if (!buffer || buffer.byteLength < 4) return [];
  const view = new DataView(buffer);
  const brushes: Brush[] = [];
  const fileName = ('name' in file && typeof file.name === 'string') ? file.name.replace(/\.abr$/i, '') : 'Photoshop Brush';

  const version = view.getInt16(0); // 1, 2, or 6+

  // Version 1 or 2 (Standard Sampled & Computed Brushes)
  if (version === 1 || version === 2) {
    const count = view.getInt16(2);
    let offset = 4;

    for (let i = 0; i < count && offset + 10 < buffer.byteLength; i++) {
      try {
        const type = view.getInt16(offset);
        offset += 2;
        const size = view.getInt32(offset);
        offset += 4;

        if (type === 1) {
          // Computed brush
          offset += size;
        } else if (type === 2) {
          // Sampled brush tip
          const top = view.getInt32(offset);
          const left = view.getInt32(offset + 4);
          const bottom = view.getInt32(offset + 8);
          const right = view.getInt32(offset + 12);
          const depth = view.getInt16(offset + 16);
          offset += 18;

          const width = right - left;
          const height = bottom - top;

          if (width > 0 && height > 0 && width <= 4096 && height <= 4096) {
            const pixelCount = width * height;
            if (offset + pixelCount <= buffer.byteLength) {
              const pixelData = new Uint8Array(buffer, offset, pixelCount);
              const stampUrl = grayscaleToStampDataUrl(pixelData, width, height);

              brushes.push({
                id: `abr_${Date.now()}_${i}`,
                name: `${fileName} #${i + 1}`,
                category: 'Imported Brushes',
                description: `Imported from Photoshop ABR (${width}x${height})`,
                size: Math.min(width, 120),
                opacity: 1,
                streamline: 0.25,
                spacing: 0.15,
                jitter: 0,
                texture: 'smooth_ink',
                pressureSizeFactor: 0.7,
                pressureOpacityFactor: 0.5,
                minSize: 3,
                maxSize: Math.max(width, 250),
                customStampUrl: stampUrl,
                sourceFormat: 'photoshop',
                isCustom: true,
                author: 'Photoshop ABR',
              });
              offset += pixelCount;
            }
          }
        } else {
          offset += size;
        }
      } catch {
        break;
      }
    }
  }

  // Version 6+ (8BIM Sampled Brushes blocks: '8BIM', 'samp')
  if (brushes.length === 0) {
    // Scan buffer for 8BIM 'samp' tags
    const uint8 = new Uint8Array(buffer);
    let searchPos = 0;

    while (searchPos < uint8.length - 16) {
      // Look for '8BIM' signature (0x38, 0x42, 0x49, 0x4D)
      if (
        uint8[searchPos] === 0x38 &&
        uint8[searchPos + 1] === 0x42 &&
        uint8[searchPos + 2] === 0x49 &&
        uint8[searchPos + 3] === 0x4d
      ) {
        const key = String.fromCharCode(
          uint8[searchPos + 4],
          uint8[searchPos + 5],
          uint8[searchPos + 6],
          uint8[searchPos + 7]
        );

        if (key === 'samp') {
          // Found sampled brushes block!
          const blockLength = view.getInt32(searchPos + 8);
          let sampleOffset = searchPos + 12;
          const blockEnd = Math.min(buffer.byteLength, sampleOffset + blockLength);

          let bIndex = 0;
          while (sampleOffset + 24 < blockEnd) {
            try {
              const sampleLength = view.getInt32(sampleOffset);
              sampleOffset += 4;

              if (sampleLength <= 0 || sampleOffset + sampleLength > buffer.byteLength) {
                break;
              }

              // Top, Left, Bottom, Right
              const top = view.getInt32(sampleOffset);
              const left = view.getInt32(sampleOffset + 4);
              const bottom = view.getInt32(sampleOffset + 8);
              const right = view.getInt32(sampleOffset + 12);
              const depth = view.getInt16(sampleOffset + 16);
              const compression = uint8[sampleOffset + 18];

              const width = right - left;
              const height = bottom - top;

              if (width > 0 && height > 0 && width <= 4096 && height <= 4096) {
                const pixelStart = sampleOffset + 19;
                const pixelCount = width * height;

                if (compression === 0 && pixelStart + pixelCount <= buffer.byteLength) {
                  // Raw uncompressed pixels
                  const pixels = new Uint8Array(buffer, pixelStart, pixelCount);
                  const stampUrl = grayscaleToStampDataUrl(pixels, width, height);

                  brushes.push({
                    id: `abr_v6_${Date.now()}_${bIndex}`,
                    name: `${fileName} #${bIndex + 1}`,
                    category: 'Imported Brushes',
                    description: `Photoshop ABR Tip (${width}x${height})`,
                    size: Math.min(width, 100),
                    opacity: 1,
                    streamline: 0.3,
                    spacing: 0.12,
                    jitter: 0,
                    texture: 'smooth_ink',
                    pressureSizeFactor: 0.8,
                    pressureOpacityFactor: 0.6,
                    minSize: 4,
                    maxSize: Math.max(width, 280),
                    customStampUrl: stampUrl,
                    sourceFormat: 'photoshop',
                    isCustom: true,
                    author: 'Photoshop ABR',
                  });
                }
              }

              sampleOffset += sampleLength;
              bIndex++;
            } catch {
              break;
            }
          }
        }
      }
      searchPos++;
    }
  }

  // Fallback: If no sampled tips parsed, create a default stylized brush with the filename
  if (brushes.length === 0) {
    brushes.push({
      id: `abr_fallback_${Date.now()}`,
      name: fileName,
      category: 'Imported Brushes',
      description: 'Imported Photoshop Brush Preset',
      size: 40,
      opacity: 1,
      streamline: 0.35,
      spacing: 0.1,
      jitter: 0,
      texture: 'acrylic_wet',
      pressureSizeFactor: 0.8,
      pressureOpacityFactor: 0.7,
      minSize: 3,
      maxSize: 300,
      sourceFormat: 'photoshop',
      isCustom: true,
      author: 'Photoshop',
    });
  }

  return brushes;
}

/**
 * Converts a raw Procreate Shape.png (or any image buffer) into a transparent white alpha stamp mask
 * Handles both white-on-black (standard Procreate) and black-on-white images
 */
export async function convertShapeToAlphaMask(
  imageBuffer: ArrayBuffer,
  mimeType: string = 'image/png'
): Promise<string> {
  const dataUrl = await arrayBufferToDataUrl(imageBuffer, mimeType);
  if (typeof document === 'undefined') {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (w === 0 || h === 0) {
          resolve(dataUrl);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // Sample corners to detect background darkness
        const sampleBrightness = (x: number, y: number) => {
          const idx = (y * w + x) * 4;
          return data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
        };

        const corners = [
          sampleBrightness(0, 0),
          sampleBrightness(Math.min(w - 1, 1), 0),
          sampleBrightness(0, Math.min(h - 1, 1)),
          sampleBrightness(w - 1, 0),
          sampleBrightness(0, h - 1),
          sampleBrightness(w - 1, h - 1),
        ];
        const avgCornerBrightness = corners.reduce((a, b) => a + b, 0) / corners.length;
        const isDarkBackground = avgCornerBrightness < 128;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // If original pixel was already fully transparent, keep it transparent
          if (a <= 5) {
            data[i + 3] = 0;
            continue;
          }

          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          let alpha: number;

          if (isDarkBackground) {
            // White on black background (standard Procreate Shape.png)
            alpha = Math.round(lum * (a / 255));
          } else {
            // Black on white background
            alpha = Math.round((255 - lum) * (a / 255));
          }

          // Force RGB to pure white (255, 255, 255) so ctx.globalCompositeOperation = 'source-in' works cleanly
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
          data[i + 3] = Math.max(0, Math.min(255, alpha));
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Extracts a readable brush name from a Procreate brush.archive (binary or XML plist)
 */
export function extractBrushNameFromArchive(buffer: ArrayBuffer | Uint8Array): string | null {
  try {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let text = '';
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if (b >= 32 && b <= 126) {
        text += String.fromCharCode(b);
      } else {
        text += ' ';
      }
    }

    // Check XML plist format
    const xmlMatch = text.match(/<key>name<\/key>\s*<string>([^<]+)<\/string>/i);
    if (xmlMatch && xmlMatch[1]?.trim()) {
      return xmlMatch[1].trim();
    }

    // Check binary plist format: look for "name" property
    const nameIndex = text.indexOf('name');
    if (nameIndex !== -1) {
      const snippet = text.slice(nameIndex + 4, nameIndex + 140);
      const matches = snippet.match(/[A-Z][a-zA-Z0-9\s-_]{2,35}/g);
      if (matches) {
        const blacklist = new Set([
          'NSObject',
          'NSDictionary',
          'NSMutableDictionary',
          'NSString',
          'NSKeyedArchiver',
          'NSNumber',
          'NSData',
          'NSArray',
          'NSMutableArray',
        ]);
        for (const candidate of matches) {
          const trimmed = candidate.trim();
          if (!blacklist.has(trimmed) && trimmed.length >= 3) {
            return trimmed;
          }
        }
      }
    }
  } catch {}
  return null;
}

/**
 * Unzips and parses a Procreate (.brush) file
 */
export async function parseProcreateBrush(
  fileOrBuffer: File | ArrayBuffer | { name?: string; arrayBuffer: () => Promise<ArrayBuffer> },
  brushName?: string
): Promise<Brush | null> {
  try {
    const arrayBuffer = fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const allPaths = Object.keys(zip.files).filter((p) => !zip.files[p].dir);

    // Look for Shape image (e.g. Shape.png, shape.png, Shape.jpg, QuickLook/Thumbnail.png)
    const shapePath =
      allPaths.find((p) => /shape\.(png|jpe?g|webp)/i.test(p)) ||
      allPaths.find((p) => /shape/i.test(p) && /\.(png|jpe?g|webp)/i.test(p)) ||
      allPaths.find((p) => /quicklook\/thumbnail\.png/i.test(p)) ||
      allPaths.find((p) => /thumb/i.test(p) && /\.(png|jpe?g|webp)/i.test(p));

    let stampDataUrl: string | undefined;
    if (shapePath) {
      const shapeBuf = await zip.files[shapePath].async('arraybuffer');
      stampDataUrl = await convertShapeToAlphaMask(shapeBuf);
    }

    // Look for Grain image
    const grainPath = allPaths.find((p) => /grain\.(png|jpe?g|webp)/i.test(p));
    let grainDataUrl: string | undefined;
    if (grainPath) {
      const grainBuf = await zip.files[grainPath].async('arraybuffer');
      grainDataUrl = await arrayBufferToDataUrl(grainBuf);
    }

    // Determine Brush Name
    let resolvedName = brushName;
    const archivePath = allPaths.find((p) => /brush\.archive/i.test(p));
    if (!resolvedName && archivePath) {
      const arcBuf = await zip.files[archivePath].async('arraybuffer');
      resolvedName = extractBrushNameFromArchive(arcBuf) || undefined;
    }
    if (!resolvedName) {
      resolvedName =
        'name' in fileOrBuffer && typeof fileOrBuffer.name === 'string'
          ? fileOrBuffer.name.replace(/\.brush$/i, '')
          : 'Procreate Brush';
    }

    return {
      id: `procreate_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: resolvedName,
      category: 'Imported Brushes',
      description: 'Imported Procreate Brush with custom tip texture',
      size: 45,
      opacity: 1,
      streamline: 0.55,
      spacing: 0.1,
      jitter: 0,
      texture: 'smooth_ink',
      pressureSizeFactor: 0.85,
      pressureOpacityFactor: 0.65,
      minSize: 2,
      maxSize: 320,
      customStampUrl: stampDataUrl,
      customGrainUrl: grainDataUrl,
      sourceFormat: 'procreate',
      isCustom: true,
      author: 'Procreate',
    };
  } catch (err) {
    console.warn('Error parsing Procreate .brush file:', err);
    return null;
  }
}

/**
 * Unzips and parses a Procreate (.brushset) collection
 * Supports standard multi-folder brush archives as well as nested .brush bundles
 */
export async function parseProcreateBrushSet(
  fileOrBuffer: File | ArrayBuffer | { name?: string; arrayBuffer: () => Promise<ArrayBuffer> },
  setName?: string
): Promise<Brush[]> {
  const brushes: Brush[] = [];
  try {
    const arrayBuffer = fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const resolvedSetName =
      setName ||
      ('name' in fileOrBuffer && typeof fileOrBuffer.name === 'string'
        ? fileOrBuffer.name.replace(/\.brushset$/i, '')
        : 'Procreate Brushes');

    const allPaths = Object.keys(zip.files).filter((p) => !zip.files[p].dir);

    // 1. Check if there are nested .brush files
    const nestedBrushFiles = allPaths.filter((p) => /\.brush$/i.test(p));
    if (nestedBrushFiles.length > 0) {
      for (const bPath of nestedBrushFiles) {
        const buf = await zip.files[bPath].async('arraybuffer');
        const brushTitle = bPath.split('/').pop()?.replace(/\.brush$/i, '') || resolvedSetName;
        const b = await parseProcreateBrush(buf, brushTitle);
        if (b) brushes.push(b);
      }
      return brushes;
    }

    // 2. Procreate standard .brushset structure: Subfolders containing Shape.png, Grain.png, brush.archive
    const folderMap = new Map<string, string[]>();
    for (const p of allPaths) {
      const parts = p.split('/');
      if (parts.length > 1) {
        const folder = parts.slice(0, parts.length - 1).join('/');
        if (!folderMap.has(folder)) folderMap.set(folder, []);
        folderMap.get(folder)!.push(p);
      } else {
        if (!folderMap.has('')) folderMap.set('', []);
        folderMap.get('')!.push(p);
      }
    }

    // Inspect each subfolder for brush assets
    for (const [folder, files] of folderMap.entries()) {
      const hasShape = files.some((f) => /shape\.(png|jpe?g|webp)/i.test(f) || /shape/i.test(f));
      const hasArchive = files.some((f) => /brush\.archive/i.test(f) || /\.archive/i.test(f));
      const hasThumbnail = files.some((f) => /thumb/i.test(f));

      if (hasShape || hasArchive || hasThumbnail) {
        const shapePath =
          files.find((f) => /shape\.(png|jpe?g|webp)/i.test(f)) ||
          files.find((f) => /shape/i.test(f) && /\.(png|jpe?g|webp)/i.test(f)) ||
          files.find((f) => /quicklook\/thumbnail\.png/i.test(f)) ||
          files.find((f) => /thumb/i.test(f) && /\.(png|jpe?g|webp)/i.test(f));

        let stampDataUrl: string | undefined;
        if (shapePath) {
          const shapeBuf = await zip.files[shapePath].async('arraybuffer');
          stampDataUrl = await convertShapeToAlphaMask(shapeBuf);
        }

        const grainPath = files.find((f) => /grain\.(png|jpe?g|webp)/i.test(f));
        let grainDataUrl: string | undefined;
        if (grainPath) {
          const grainBuf = await zip.files[grainPath].async('arraybuffer');
          grainDataUrl = await arrayBufferToDataUrl(grainBuf);
        }

        let brushTitle: string | undefined;
        const archivePath = files.find((f) => /brush\.archive/i.test(f));
        if (archivePath) {
          const arcBuf = await zip.files[archivePath].async('arraybuffer');
          brushTitle = extractBrushNameFromArchive(arcBuf) || undefined;
        }

        if (!brushTitle) {
          const folderName = folder.split('/').pop() || '';
          if (folderName && !/^[0-9a-f-]{16,}$/i.test(folderName) && !/^\d+$/.test(folderName)) {
            brushTitle = folderName;
          } else {
            brushTitle = `${resolvedSetName} Brush ${brushes.length + 1}`;
          }
        }

        brushes.push({
          id: `procreate_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: brushTitle,
          category: 'Imported Brushes',
          description: `Imported from ${resolvedSetName} brush set`,
          size: 40,
          opacity: 1,
          streamline: 0.55,
          spacing: 0.1,
          jitter: 0,
          texture: 'smooth_ink',
          pressureSizeFactor: 0.85,
          pressureOpacityFactor: 0.65,
          minSize: 2,
          maxSize: 320,
          customStampUrl: stampDataUrl,
          customGrainUrl: grainDataUrl,
          sourceFormat: 'procreate',
          isCustom: true,
          author: 'Procreate',
        });
      }
    }

    // 3. Fallback: If no subfolders matched, try parsing entire file as a single brush
    if (brushes.length === 0) {
      const single = await parseProcreateBrush(arrayBuffer, resolvedSetName);
      if (single) brushes.push(single);
    }
  } catch (err) {
    console.warn('Error parsing .brushset:', err);
  }

  return brushes;
}

/**
 * Automatically infers an authentic Krita 4 Preset category from a brush name or PaintOp engine
 */
export function inferKritaCategory(name: string, paintopId?: string): string {
  const n = (name || '').toLowerCase();
  const p = (paintopId || '').toLowerCase();

  if (
    p === 'colorsmudge' ||
    n.includes('wet') ||
    n.includes('knife') ||
    n.includes('smear') ||
    n.includes('smudge') ||
    n.includes('blend')
  ) {
    return 'Krita Wet & Paint';
  }
  if (n.includes('water') || n.includes('wash') || n.includes('aquarelle')) {
    return 'Krita Watercolor';
  }
  if (n.includes('airbrush') || n.includes('basic') || n.includes('round')) {
    return 'Krita Basic';
  }
  if (
    n.includes('chalk') ||
    n.includes('charcoal') ||
    n.includes('pastel') ||
    p === 'chalkbrush'
  ) {
    return 'Krita Chalk & Charcoal';
  }
  if (
    n.includes('pencil') ||
    n.includes('graphite') ||
    n.includes('lead') ||
    n.includes('sketch') ||
    p === 'sketchbrush'
  ) {
    return 'Krita Pencils';
  }
  if (
    n.includes('ink') ||
    n.includes('gpen') ||
    n.includes('fineliner') ||
    n.includes('sumi') ||
    n.includes('comic') ||
    n.includes('pen')
  ) {
    return 'Krita Inks';
  }
  if (n.includes('marker') || n.includes('chisel') || n.includes('highlighter')) {
    return 'Krita Markers';
  }
  if (
    n.includes('bristle') ||
    n.includes('flat') ||
    n.includes('glaze') ||
    n.includes('roller') ||
    n.includes('dry') ||
    n.includes('eroded') ||
    n.includes('crease') ||
    p === 'hairybrush'
  ) {
    return 'Krita Bristles & Dry';
  }
  if (
    n.includes('texture') ||
    n.includes('splatter') ||
    n.includes('sponge') ||
    n.includes('grunge') ||
    n.includes('shading') ||
    p === 'spraybrush'
  ) {
    return 'Krita Textures';
  }
  if (p === 'mypaintbrush') {
    return 'Krita Wet & Paint';
  }
  return 'Imported Brushes';
}

/**
 * Parses MyPaint (.myb) Brush preset files (JSON or Key-Value text)
 */
export async function parseMybFile(
  contentOrBuffer:
    | string
    | ArrayBuffer
    | File
    | { name?: string; text?: () => Promise<string>; arrayBuffer?: () => Promise<ArrayBuffer> },
  presetName?: string
): Promise<Brush> {
  let text = '';
  let resolvedName = presetName;

  if (typeof contentOrBuffer === 'string') {
    text = contentOrBuffer;
  } else if ('text' in contentOrBuffer && typeof contentOrBuffer.text === 'function') {
    text = await contentOrBuffer.text();
    if (!resolvedName && 'name' in contentOrBuffer && typeof contentOrBuffer.name === 'string') {
      resolvedName = contentOrBuffer.name.replace(/\.myb$/i, '');
    }
  } else if ('arrayBuffer' in contentOrBuffer && typeof contentOrBuffer.arrayBuffer === 'function') {
    const buf = await contentOrBuffer.arrayBuffer();
    text = new TextDecoder('utf-8').decode(buf);
    if (!resolvedName && 'name' in contentOrBuffer && typeof contentOrBuffer.name === 'string') {
      resolvedName = contentOrBuffer.name.replace(/\.myb$/i, '');
    }
  } else if (contentOrBuffer instanceof ArrayBuffer) {
    text = new TextDecoder('utf-8').decode(contentOrBuffer);
  }

  if (resolvedName) {
    resolvedName = resolvedName.replace(/\.myb$/i, '');
  }
  if (!resolvedName) {
    resolvedName = 'MyPaint Brush';
  }
  resolvedName = resolvedName
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

  const settings: Record<string, number> = {};

  try {
    const trimmed = text.trim();
    if (trimmed.startsWith('{')) {
      const json = JSON.parse(trimmed);
      const rawSettings = json.settings || json;
      for (const [key, val] of Object.entries(rawSettings)) {
        if (typeof val === 'number') {
          settings[key] = val;
        } else if (
          val &&
          typeof val === 'object' &&
          'base_value' in val &&
          typeof (val as any).base_value === 'number'
        ) {
          settings[key] = (val as any).base_value;
        }
      }
    }
  } catch {}

  if (Object.keys(settings).length === 0) {
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const key = parts[0];
        const val = parseFloat(parts[1]);
        if (!isNaN(val)) {
          settings[key] = val;
        }
      }
    }
  }

  const radiusLog = settings['radius_logarithmic'] ?? 2.0;
  const sizePx = Math.max(2, Math.min(300, Math.round(Math.exp(radiusLog) * 2)));
  const opaque = settings['opaque'] ?? 1.0;
  const hardness = settings['hardness'] ?? 0.8;
  const dabsPerRadius = settings['dabs_per_actual_radius'] ?? 2.0;
  const spacing = Math.max(0.02, Math.min(0.6, 1 / Math.max(1, dabsPerRadius * 2)));
  const smudge = settings['smudge'] ?? 0.0;
  const speedSlowness = settings['speed1_slowness'] ?? 0.04;
  const slowTracking = settings['slow_tracking'] ?? 0.25;

  const category = inferKritaCategory(resolvedName, smudge > 0.1 ? 'colorsmudge' : 'mypaintbrush');

  return {
    id: `myb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: resolvedName,
    category,
    description: `MyPaint Native Brush (${resolvedName})`,
    size: sizePx,
    opacity: Math.max(0.05, Math.min(1.0, opaque)),
    hardness: Math.max(0.0, Math.min(1.0, hardness)),
    streamline: Math.max(0.0, Math.min(0.95, slowTracking)),
    spacing,
    jitter: settings['tracking_noise'] ? Math.min(0.5, settings['tracking_noise']) : 0,
    texture: hardness > 0.9 ? 'hard_round' : 'smooth_ink',
    pressureSizeFactor: 0.75,
    pressureOpacityFactor: 0.5,
    minSize: Math.max(1, Math.round(sizePx * 0.15)),
    maxSize: Math.max(sizePx * 2, 200),
    sourceFormat: 'mypaint',
    isCustom: true,
    author: 'MyPaint Engine',
    strokePath: {
      spacing,
      jitter: settings['tracking_noise'] ? Math.min(0.5, settings['tracking_noise']) : 0,
      jitterLateral: 0,
      jitterLinear: 0,
      fallOff: 0,
    },
    stabilization: {
      streamline: Math.max(0.0, Math.min(0.95, slowTracking)),
      stabilization: Math.min(0.8, speedSlowness * 10),
      motionFiltering: 0,
    },
    wetMix: {
      dilution: smudge > 0 ? Math.min(1, smudge * 1.2) : 0,
      charge: 1.0,
      attack: 1.0,
      pull: Math.min(1, smudge),
      grade: 1.0,
    },
    smudge: {
      strength: Math.min(1, smudge * 1.5),
      jitter: 0,
      brushFlow: 0.9,
    },
  };
}

/**
 * Internal helper to synthesize a Krita Brush model from preset XML & optional preview
 */
export function buildKritaBrushFromXml(
  rawText: string,
  previewDataUrl: string | undefined,
  fallbackName: string
): Brush {
  let name = fallbackName;
  let paintopId = 'pixelbrush';
  let size = 35;
  let opacity = 1.0;
  let flow = 1.0;
  let spacing = 0.08;
  let hardness = 0.8;

  const nameMatch =
    rawText.match(/name="([^"]+)"/i) ||
    rawText.match(/<name>([^<]+)<\/name>/i) ||
    rawText.match(/filename="([^"]+)"/i);
  if (nameMatch && nameMatch[1]?.trim()) {
    name = nameMatch[1].trim().replace(/\.kpp$/i, '');
  }

  name = name
    .replace(/_+/g, ' ')
    .trim();

  const paintopMatch =
    rawText.match(/paintopid="([^"]+)"/i) ||
    rawText.match(/<param name="paintop">([^<]+)<\/param>/i);
  if (paintopMatch && paintopMatch[1]?.trim()) {
    paintopId = paintopMatch[1].trim();
  }

  const sizeMatch =
    rawText.match(/name="General\/size"[^>]*>([^<]+)<\/param>/i) ||
    rawText.match(/General\/size\s+([0-9.]+)/i) ||
    rawText.match(/<size>([0-9.]+)<\/size>/i);
  if (sizeMatch && !isNaN(parseFloat(sizeMatch[1]))) {
    size = Math.max(2, Math.min(400, Math.round(parseFloat(sizeMatch[1]))));
  }

  const opMatch =
    rawText.match(/name="General\/opacity"[^>]*>([^<]+)<\/param>/i) ||
    rawText.match(/General\/opacity\s+([0-9.]+)/i);
  if (opMatch && !isNaN(parseFloat(opMatch[1]))) {
    opacity = Math.max(0.05, Math.min(1.0, parseFloat(opMatch[1])));
  }

  const flowMatch =
    rawText.match(/name="General\/flow"[^>]*>([^<]+)<\/param>/i) ||
    rawText.match(/General\/flow\s+([0-9.]+)/i);
  if (flowMatch && !isNaN(parseFloat(flowMatch[1]))) {
    flow = Math.max(0.05, Math.min(1.0, parseFloat(flowMatch[1])));
  }

  const spMatch =
    rawText.match(/name="Spacing\/spacing"[^>]*>([^<]+)<\/param>/i) ||
    rawText.match(/Spacing\/spacing\s+([0-9.]+)/i);
  if (spMatch && !isNaN(parseFloat(spMatch[1]))) {
    spacing = Math.max(0.02, Math.min(0.8, parseFloat(spMatch[1])));
  }

  const category = inferKritaCategory(name, paintopId);

  if (name.toLowerCase().includes('hard') || name.toLowerCase().includes('basic-1')) {
    hardness = 1.0;
  } else if (name.toLowerCase().includes('soft') || name.toLowerCase().includes('airbrush')) {
    hardness = 0.2;
  }

  return {
    id: `kpp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    category,
    description: `Krita PaintOp Preset (${paintopId})`,
    size,
    opacity,
    hardness,
    streamline: 0.35,
    spacing,
    jitter:
      name.toLowerCase().includes('rough') || name.toLowerCase().includes('dry') ? 0.08 : 0,
    texture: hardness >= 0.95 ? 'hard_round' : 'smooth_ink',
    pressureSizeFactor: name.toLowerCase().includes('size') ? 0.85 : 0.5,
    pressureOpacityFactor: name.toLowerCase().includes('opacity') ? 0.75 : 0.0,
    minSize: Math.max(1, Math.round(size * 0.1)),
    maxSize: Math.max(size * 2, 250),
    customStampUrl: previewDataUrl,
    sourceFormat: 'krita',
    isCustom: true,
    author: 'Krita 4 Preset Engine',
    rendering: {
      mode: 'heavy_glaze',
      flow,
      wetEdges:
        name.toLowerCase().includes('fringe') || name.toLowerCase().includes('water') ? 0.7 : 0,
      burntEdges: 0,
    },
    wetMix: {
      dilution: category === 'Krita Wet & Paint' ? 0.6 : 0,
      charge: 1.0,
      attack: 1.0,
      pull: category === 'Krita Wet & Paint' ? 0.5 : 0,
      grade: 1.0,
    },
    smudge: {
      strength: category === 'Krita Wet & Paint' ? 0.7 : 0,
      jitter: 0,
      brushFlow: 0.85,
    },
  };
}

/**
 * Binary & Metadata Parser for Krita PaintOp Presets (.kpp)
 * Unpacks Krita PNG preset images with embedded XML chunks or ZIP preset archives
 */
export async function parseKppFile(
  fileOrBuffer: File | ArrayBuffer | { name?: string; arrayBuffer: () => Promise<ArrayBuffer> },
  presetName?: string
): Promise<Brush | null> {
  try {
    const buffer =
      fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer();
    if (!buffer || buffer.byteLength < 8) return null;

    const uint8 = new Uint8Array(buffer);
    const defaultFileName =
      'name' in fileOrBuffer && typeof fileOrBuffer.name === 'string'
        ? fileOrBuffer.name.replace(/\.kpp(\.png)?$/i, '')
        : 'Krita Brush';

    // 1. Check if it is a ZIP archive (magic bytes 0x50, 0x4B, 0x03, 0x04)
    if (uint8[0] === 0x50 && uint8[1] === 0x4b && uint8[2] === 0x03 && uint8[3] === 0x04) {
      try {
        const zip = await JSZip.loadAsync(buffer);
        const allPaths = Object.keys(zip.files).filter((p) => !zip.files[p].dir);

        let previewDataUrl: string | undefined;
        const imgPath = allPaths.find((p) => /(preview|thumbnail|\.kpp)\.(png|jpe?g)/i.test(p));
        if (imgPath) {
          const imgBuf = await zip.files[imgPath].async('arraybuffer');
          previewDataUrl = await arrayBufferToDataUrl(imgBuf);
        }

        let xmlContent = '';
        const xmlPath = allPaths.find(
          (p) => /(preset|paintoppreset)\.xml$/i.test(p) || p.endsWith('.kpp')
        );
        if (xmlPath) {
          xmlContent = await zip.files[xmlPath].async('text');
        }

        return buildKritaBrushFromXml(xmlContent, previewDataUrl, presetName || defaultFileName);
      } catch (e) {
        console.warn('Failed parsing zip-based .kpp:', e);
      }
    }

    // 2. Standard Krita .kpp: PNG image containing embedded XML metadata in tEXt/zTXt/iTXt chunk
    const isPng =
      uint8[0] === 0x89 &&
      uint8[1] === 0x50 &&
      uint8[2] === 0x4e &&
      uint8[3] === 0x47;

    let previewDataUrl: string | undefined;
    if (isPng) {
      previewDataUrl = await arrayBufferToDataUrl(buffer, 'image/png');
    }

    // Extract text from raw byte stream to find XML string
    let decodedText = '';
    for (let i = 0; i < uint8.length; i++) {
      const b = uint8[i];
      if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) {
        decodedText += String.fromCharCode(b);
      } else {
        if (decodedText.length > 0 && decodedText[decodedText.length - 1] !== ' ') {
          decodedText += ' ';
        }
      }
    }

    return buildKritaBrushFromXml(decodedText, previewDataUrl, presetName || defaultFileName);
  } catch (err) {
    console.warn('Error parsing .kpp file:', err);
    return null;
  }
}

/**
 * Unzips and parses a complete Krita Resource Bundle (.bundle)
 * Extracts all .kpp presets, brush tips, and categorizes them automatically
 */
export async function parseKritaBundle(
  fileOrBuffer: File | ArrayBuffer | { name?: string; arrayBuffer: () => Promise<ArrayBuffer> },
  bundleName?: string
): Promise<Brush[]> {
  const brushes: Brush[] = [];
  try {
    const arrayBuffer =
      fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const resolvedBundleName =
      bundleName ||
      ('name' in fileOrBuffer && typeof fileOrBuffer.name === 'string'
        ? fileOrBuffer.name.replace(/\.bundle$/i, '')
        : 'Krita Bundle');

    const allPaths = Object.keys(zip.files).filter((p) => !zip.files[p].dir);

    // 1. Find all .kpp files in kis_paintoppresets/ or anywhere in the bundle
    const kppFiles = allPaths.filter(
      (p) => /\.kpp$/i.test(p) || p.includes('kis_paintoppresets/')
    );

    for (const kPath of kppFiles) {
      try {
        const kBuf = await zip.files[kPath].async('arraybuffer');
        const fileName = kPath.split('/').pop()?.replace(/\.kpp$/i, '') || resolvedBundleName;
        const brush = await parseKppFile(kBuf, fileName);
        if (brush) {
          brushes.push(brush);
        }
      } catch (err) {
        console.warn(`Failed parsing bundle entry ${kPath}:`, err);
      }
    }

    // 2. Also check for any .myb files
    const mybFiles = allPaths.filter((p) => /\.myb$/i.test(p));
    for (const mPath of mybFiles) {
      try {
        const text = await zip.files[mPath].async('text');
        const fileName = mPath.split('/').pop()?.replace(/\.myb$/i, '') || 'MyPaint Brush';
        const brush = await parseMybFile(text, fileName);
        if (brush) {
          brushes.push(brush);
        }
      } catch {}
    }
  } catch (err) {
    console.warn('Error loading Krita .bundle:', err);
  }

  return brushes;
}

/**
 * Unified Multi-File Brush Importer
 * Accepts Krita (.kpp, .bundle), MyPaint (.myb), Procreate (.brush, .brushset),
 * Photoshop (.abr), and standard image files (as brush stamp masks).
 */
export async function importBrushFiles(files: FileList | File[]): Promise<Brush[]> {
  const imported: Brush[] = [];
  const fileArray = Array.from(files);

  for (const file of fileArray) {
    const nameLower = file.name.toLowerCase();

    if (nameLower.endsWith('.bundle') || nameLower.includes('.bundle.')) {
      const bundleBrushes = await parseKritaBundle(file);
      imported.push(...bundleBrushes);
    } else if (nameLower.endsWith('.kpp') || nameLower.includes('.kpp.')) {
      const kppBrush = await parseKppFile(file);
      if (kppBrush) imported.push(kppBrush);
    } else if (nameLower.endsWith('.myb')) {
      const mybBrush = await parseMybFile(file);
      if (mybBrush) imported.push(mybBrush);
    } else if (nameLower.endsWith('.brushset') || nameLower.includes('.brushset.')) {
      const setBrushes = await parseProcreateBrushSet(file);
      imported.push(...setBrushes);
    } else if (nameLower.endsWith('.brush') || nameLower.includes('.brush.')) {
      const b = await parseProcreateBrush(file);
      if (b) imported.push(b);
    } else if (nameLower.endsWith('.abr')) {
      const abrBrushes = await parseAbrFile(file);
      imported.push(...abrBrushes);
    } else if (nameLower.endsWith('.zip')) {
      try {
        const buf = await file.arrayBuffer();
        const testZip = await JSZip.loadAsync(buf);
        const paths = Object.keys(testZip.files);
        const hasKpp = paths.some((p) => /\.kpp/i.test(p) || p.includes('kis_paintoppresets/'));
        const hasMyb = paths.some((p) => /\.myb/i.test(p));

        if (hasKpp || hasMyb) {
          const bBrushes = await parseKritaBundle(buf, file.name.replace(/\.zip$/i, ''));
          imported.push(...bBrushes);
        } else {
          const setBrushes = await parseProcreateBrushSet(buf, file.name.replace(/\.zip$/i, ''));
          if (setBrushes.length > 0) {
            imported.push(...setBrushes);
          } else {
            const b = await parseProcreateBrush(buf);
            if (b) imported.push(b);
          }
        }
      } catch {
        const setBrushes = await parseProcreateBrushSet(file);
        imported.push(...setBrushes);
      }
    } else if (file.type.startsWith('image/')) {
      const shapeBuf = await file.arrayBuffer();
      const dataUrl = await convertShapeToAlphaMask(shapeBuf, file.type);
      const name = file.name.replace(/\.[^/.]+$/, '');
      imported.push({
        id: `custom_stamp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name,
        category: 'Imported Brushes',
        description: `Custom Stamp Texture (${file.type})`,
        size: 50,
        opacity: 1,
        streamline: 0.35,
        spacing: 0.15,
        jitter: 0,
        texture: 'smooth_ink',
        pressureSizeFactor: 0.8,
        pressureOpacityFactor: 0.6,
        minSize: 3,
        maxSize: 350,
        customStampUrl: dataUrl,
        sourceFormat: 'native',
        isCustom: true,
        author: 'User Stamp',
      });
    } else {
      // Fallback: try parsing as KPP, MYB, or Procreate
      try {
        const kppBrush = await parseKppFile(file);
        if (kppBrush) {
          imported.push(kppBrush);
          continue;
        }
      } catch {}

      try {
        const setBrushes = await parseProcreateBrushSet(file);
        if (setBrushes.length > 0) {
          imported.push(...setBrushes);
        } else {
          const b = await parseProcreateBrush(file);
          if (b) imported.push(b);
        }
      } catch {}
    }
  }

  return imported;
}
