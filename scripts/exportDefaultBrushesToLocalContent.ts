import fs from 'fs';
import path from 'path';
import { FACTORY_BRUSH_DEFAULTS } from '../src/constants/brushes';
import { Brush } from '../src/types/canvas';

function serializeBrushToMyb(brush: Brush): string {
  const radiusLog = Math.log(Math.max(1, (brush.size || 24) / 2));
  const dabsPerRadius = Math.round(1 / Math.max(0.01, brush.spacing || 0.05));
  const roundness = brush.shape?.roundness ?? 1.0;
  const angle = brush.shape?.rotation ?? 0;
  const smudge = brush.wetMix?.pull ?? (brush as any).smudgePull ?? 0;

  const mybObj = {
    myb_version: 2,
    name: brush.name,
    category: brush.category,
    settings: {
      radius_logarithmic: { base_value: radiusLog },
      opaque: { base_value: brush.opacity ?? 1.0 },
      hardness: { base_value: brush.hardness ?? 0.8 },
      dabs_per_actual_radius: { base_value: dabsPerRadius },
      elliptical_dab_ratio: { base_value: roundness },
      elliptical_dab_angle: { base_value: angle },
      smudge: { base_value: smudge },
      speed1_slowness: { base_value: brush.streamline ?? 0.2 },
    },
    hunbatz_preset: brush,
  };
  return JSON.stringify(mybObj, null, 2);
}

const baseDir = path.resolve(process.cwd(), 'Hunbatz local content', 'brushes');

console.log(`Exporting ${FACTORY_BRUSH_DEFAULTS.length} default brushes to ${baseDir}...`);

for (const brush of FACTORY_BRUSH_DEFAULTS) {
  const catFolder = path.join(baseDir, brush.category || 'Pencils');
  if (!fs.existsSync(catFolder)) {
    fs.mkdirSync(catFolder, { recursive: true });
  }

  // Sanitize filename
  const cleanName = brush.name.replace(/[/\\?%*:|"<>]/g, '_');
  const filePath = path.join(catFolder, `${cleanName}.myb`);

  const content = serializeBrushToMyb(brush);
  fs.writeFileSync(filePath, content, 'utf-8');
}

console.log('Export complete!');
