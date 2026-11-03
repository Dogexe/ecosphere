import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ['three'] },
  // lab.html is a standalone look-development page (realism test), not part of the game.
  build: { rollupOptions: { input: { main: 'index.html', lab: 'lab.html' } } },
  server: {
    allowedHosts: ['josh.tail5425f0.ts.net'],
  },
})
