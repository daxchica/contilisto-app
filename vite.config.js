// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@coa': path.resolve(__dirname, 'shared/coa'),
    },
  },
  server: {
    port: 5173,
    strictPort: true, // Prevents switching to other ports
    fs: { allow: ['..'] },
  },
  optimizeDeps: { include: ["pdfjs-dist"]
  },
});
