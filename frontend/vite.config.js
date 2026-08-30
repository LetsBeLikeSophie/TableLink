import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/tables': 'http://localhost:8080',
      '/joins': 'http://localhost:8080',
      '/segments': 'http://localhost:8080',
    },
  },
})
