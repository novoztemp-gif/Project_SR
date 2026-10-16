import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Content-hashed asset filenames already bust the cache for the file
// itself, but an already-open tab has no reason to ever re-fetch
// index.html on its own — a kiosk-style tab left open across a deploy
// just keeps running whatever bundle it loaded, however stale. This
// writes a build timestamp both into the running bundle (__BUILD_TIME__)
// and as a tiny static file the app can poll — see AppShell.tsx's version
// check, which prompts a refresh when the two disagree.
const buildTime = Date.now()

function versionFilePlugin() {
  return {
    name: 'write-version-file',
    writeBundle(options: { dir?: string }) {
      const outDir = options.dir ?? 'dist'
      fs.writeFileSync(path.join(outDir, 'version.json'), JSON.stringify({ buildTime }))
    },
  }
}

export default defineConfig({
  plugins: [react(), versionFilePlugin()],
  define: {
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})
