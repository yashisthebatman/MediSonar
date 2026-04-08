/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react-markdown') || id.includes('remark-gfm') || id.includes('mdast') || id.includes('micromark')) {
            return 'markdown'
          }
          if (id.includes('framer-motion')) {
            return 'motion'
          }
          if (id.includes('react-router') || id.includes('@remix-run')) {
            return 'router'
          }
          if (id.includes('zustand')) {
            return 'state'
          }
          if (id.includes('axios')) {
            return 'network'
          }
          if (id.includes('lucide-react')) {
            return 'icons'
          }
          if (id.includes('react') || id.includes('scheduler')) {
            return 'react-vendor'
          }
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true
  }
})
