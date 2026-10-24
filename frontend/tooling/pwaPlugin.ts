import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'
import { serviceWorkerSource } from './serviceWorker.ts'

export function pwaPlugin(): Plugin {
  let config: ResolvedConfig
  return {
    name: 'pos-zanna-pwa', apply: 'build', enforce: 'post',
    configResolved(value) { config = value; if (config.base !== '/') throw new Error('PWA POS-Zanna saat ini memerlukan deployment pada root origin (/).') },
    generateBundle: { order: 'post', async handler(_options, bundle) {
      if (!bundle['index.html']) throw new Error('Shell aplikasi tidak ditemukan untuk cache offline.')
      const files = Object.keys(bundle).filter((name) => !name.endsWith('.map')).sort()
      const publicFiles = ['favicon.svg', 'manifest.webmanifest', 'pwa-192.png', 'pwa-512.png']
      const hash = createHash('sha256')
      for (const name of files) { const asset = bundle[name]; hash.update(name); hash.update(asset.type === 'chunk' ? asset.code : asset.source) }
      for (const name of publicFiles) hash.update(await readFile(resolve(config.publicDir, name)))
      const version = hash.digest('hex').slice(0, 20)
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorkerSource([...new Set([...files, ...publicFiles])].map((name) => `/${name}`), version) })
    } },
  }
}
