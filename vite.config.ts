import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ['three'] },
  server: {
    allowedHosts: ['josh.tail5425f0.ts.net'],
  },
})
