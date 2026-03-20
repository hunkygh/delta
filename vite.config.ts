import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 4000,
    strictPort: true
  },
  preview: {
    host: 'localhost',
    port: 4000,
    strictPort: true
  },
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setupTests.ts'
  }
})
