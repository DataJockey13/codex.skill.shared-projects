import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/vertrag/' : '/',
  plugins: [vue()],
  server: { port: 5173, strictPort: true },
  preview: { port: 5175, strictPort: true },
}))
