import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { preview } from 'vite'
import { workerFixture } from './pwa-fixtures'

test('production preview: SW/manifest/seluruh lazy asset tersedia, shell/cache hasil build melayani offline dalam emulator', async () => {
  const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false } })
  try {
    const address = server.httpServer.address(); assert.ok(address && typeof address !== 'string')
    const origin = `http://127.0.0.1:${address.port}`, swResponse = await fetch(`${origin}/sw.js`)
    assert.equal(swResponse.status, 200); assert.match(swResponse.headers.get('cache-control') ?? '', /no-cache/)
    const source = await swResponse.text(), manifest = await (await fetch(`${origin}/manifest.webmanifest`)).json()
    assert.equal(manifest.name, 'POS-Zanna'); assert.match(await (await fetch(`${origin}/kasir`)).text(), /id="root"/)
    const match = source.match(/const ASSETS = (\[[^\n]+\]);/); assert.ok(match)
    const assets: string[] = JSON.parse(match[1]), responses = new Map<string, Response>()
    assert.equal(assets.filter((a) => a.includes('universal-')).length, 2)
    for (const path of assets) {
      const response = await fetch(`${origin}${path}`); assert.equal(response.status, 200, path)
      if (path.endsWith('.js')) assert.match(response.headers.get('content-type') ?? '', /javascript/)
      responses.set(path, response)
    }
    const built = await readFile('dist/sw.js', 'utf8'); assert.equal(source, built)
    let offline = false
    const worker = workerFixture(source, async (url) => { if (offline) throw new Error('offline'); const response = responses.get(new URL(url).pathname); assert.ok(response); return response.clone() })
    await worker.dispatch('install'); await worker.dispatch('activate'); offline = true
    for (const route of ['/dashboard', '/kasir', '/bon', '/laporan', '/pengaturan']) assert.match(await (await worker.request(route))!.text(), /id="root"/)
    for (const path of assets.filter((a) => a.endsWith('.js'))) assert.ok((await (await worker.request(path, 'cors'))!.text()).length > 0)
  } finally { await new Promise<void>((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve())) }
})
