import fs from 'node:fs/promises'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** MediaPipe ships a sourceMappingURL that points at a file npm does not include. */
function ignoreMissingMediaPipeSourcemap(): Plugin {
  return {
    name: 'ignore-mediapipe-sourcemap',
    enforce: 'pre',
    async load(id) {
      const file = id.split('?')[0]
      if (!file.includes('@mediapipe/tasks-vision') || !file.endsWith('.mjs')) return
      const code = await fs.readFile(file, 'utf8')
      return {
        code: code.replace(/\/\/# sourceMappingURL=.*$/gm, ''),
        map: null,
      }
    },
  }
}

export default defineConfig({
  plugins: [ignoreMissingMediaPipeSourcemap(), react(), tailwindcss()],
  optimizeDeps: {
    // MediaPipe is a large WASM bundle. Pre-bundling it makes Vite hang on
    // "scanning dependencies" and then full-reload the page in a loop.
    exclude: ['@mediapipe/tasks-vision'],
  },
  server: {
    watch: {
      ignored: ['**/dist/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
