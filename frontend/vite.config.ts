import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { pwaPlugin } from './tooling/pwaPlugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), pwaPlugin()],
  // Merge tiny shared modules instead of making each icon/helper a request.
  build: { rolldownOptions: { output: { codeSplitting: { groups: [
    { name: 'app-core', tags: ['$initial'], priority: 20 },
    { name: 'page-shared', minShareCount: 2, priority: 10 },
  ] } } } },
  preview: { headers: { 'Cache-Control': 'no-cache' } },
})
