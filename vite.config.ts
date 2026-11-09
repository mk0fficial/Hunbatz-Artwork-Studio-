import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// Set automatically by `tauri android dev` / `tauri ios dev` (your PC's LAN IP).
const tauriHost = process.env.TAURI_DEV_HOST;
const hmrDisabled = process.env.DISABLE_HMR === 'true';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    // Tauri: don't hide Rust errors behind Vite's screen clearing
    clearScreen: false,
    // Expose TAURI_ENV_* variables to the frontend
    envPrefix: ['VITE_', 'TAURI_ENV_*'],
    server: {
      port: 3000,
      strictPort: true,
      // Phones/tablets can't reach "localhost" on your PC, so bind to the LAN IP when Tauri gives one
      host: tauriHost || false,
      hmr: hmrDisabled
        ? false
        : tauriHost
          ? { protocol: 'ws', host: tauriHost, port: 3001 }
          : undefined,
      watch: hmrDisabled ? null : { ignored: ['**/src-tauri/**', '**/Hunbatz local content/**'] },
    },
    build: {
      // WebView2 (Windows) = Chromium, WKWebView (mac/iOS) = Safari
      target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari15',
      minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
      sourcemap: !!process.env.TAURI_ENV_DEBUG,
    },
  };
});
