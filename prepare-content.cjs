// Copies "Hunbatz local content" into public/hunbatz-content (so Tauri bundles it)
// and writes manifest.json listing every texture / brush tip / brush file.
// Replaces what the Express server (server.ts) used to do by scanning the disk.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'Hunbatz local content');
const dest = path.join(root, 'public', 'hunbatz-content');

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });

const list = (dir, re) =>
  fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => re.test(f)).sort() : [];

const manifest = { textures: [], tips: [], brushes: {} };

for (const sub of ['textures', 'brush tips', 'brushes']) {
  const from = path.join(src, sub);
  if (fs.existsSync(from)) fs.cpSync(from, path.join(dest, sub), { recursive: true });
}

manifest.textures = list(path.join(dest, 'textures'), /\.(png|jpg|jpeg|webp|pat)$/i);
manifest.tips = list(path.join(dest, 'brush tips'), /\.(png|jpg|jpeg|webp|gbr)$/i);

const brushesDir = path.join(dest, 'brushes');
if (fs.existsSync(brushesDir)) {
  for (const d of fs.readdirSync(brushesDir, { withFileTypes: true })) {
    if (d.isDirectory()) {
      manifest.brushes[d.name] = list(path.join(brushesDir, d.name), /\.(myb|kpp|json)$/i);
    }
  }
}

fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(
  `[content] ${manifest.textures.length} textures, ${manifest.tips.length} tips, ` +
    `${Object.keys(manifest.brushes).length} brush folders -> public/hunbatz-content`
);
