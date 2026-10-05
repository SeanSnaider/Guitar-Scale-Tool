/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    hmr: {
      overlay: true,
    },
    watch: {
      usePolling: true,
    },
    // FretAgent sidecar (agent-server). Must not set `xfwd`: the agent route
    // only accepts local requests without X-Forwarded-For headers.
    proxy: {
      '/api/agent': 'http://localhost:3001',
      '/api/tools': 'http://localhost:3001',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
