import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
  ],

  

  build: {
    sourcemap: false, // 🚫 hide source maps
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },

  server: {
    port: 4940,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
