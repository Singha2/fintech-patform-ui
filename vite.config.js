import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The backend has no CORS (SecurityConfig keeps .cors() disabled), so the browser must stay same-origin.
// All app calls use relative paths beginning /api/v1/... — Vite forwards /api → the backend on :8080.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
})
