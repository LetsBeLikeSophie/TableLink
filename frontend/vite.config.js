import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Served at itssophie.dev/tablelink/ in production; stays at root for local dev.
  base: command === 'build' ? '/tablelink/' : '/',
  server: {
    proxy: {
      '/tables': 'http://localhost:8080',
      '/joins': 'http://localhost:8080',
      '/segments': 'http://localhost:8080',
    },
  },
}))
