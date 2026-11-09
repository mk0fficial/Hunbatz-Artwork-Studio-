# Hunbatz Studio – Tauri fix

1. Copy everything in this folder over your project (same paths). DELETE `untitled.tsx` and `bun.lock` (or keep bun, but then use `bun install`).
2. `npm install`
3. `npm run icons`   (makes app-icon.png placeholder + all icon sizes; swap app-icon.png for your logo and re-run `npm run tauri icon app-icon.png`)
4. Desktop:  `npm run tauri dev`        Build: `npm run tauri build`
5. Android:  `npm run tauri android init` once, then `npm run tauri android dev` / `npm run tauri android build`
6. iOS/iPad (Mac only): `npm run tauri ios init`, then `npm run tauri ios dev` / `ios build`
