import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('three') && !id.includes('@react-three')) return 'three';
          if (id.includes('framer-motion') || id.includes('gsap')) return 'motion';
          if (id.includes('@tanstack') || id.includes('zustand')) return 'data';
          return 'vendor';
        },
      },
    },
  },
})
