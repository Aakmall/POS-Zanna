import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { pwaPlugin } from './tooling/pwaPlugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), pwaPlugin()],
  preview: { headers: { 'Cache-Control': 'no-cache' } },
})
