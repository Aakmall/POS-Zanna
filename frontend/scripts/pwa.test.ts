import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { serviceWorkerSource } from '../tooling/serviceWorker'
import { workerFixture } from './pwa-fixtures'

const assets = ['/index.html', '/assets/app.js', '/assets/lazy-excel.js', '/manifest.webmanifest']
test('manifest valid: POS-Zanna, standalone, scope/start dan ikon PNG nyata 192/512', async () => {
  const manifest = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'))
  assert.equal(manifest.name, 'POS-Zanna'); assert.equal(manifest.display, 'standalone'); assert.equal(manifest.start_url, '/dashboard'); assert.equal(manifest.scope, '/')
  for (const size of [192, 512]) { const icon = manifest.icons.find((i: { sizes: string }) => i.sizes === `${size}x${size}`); assert.ok(icon); const png = await readFile(`public${icon.src}`); assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size) }
  assert.ok((await readFile('index.html', 'utf8')).includes('rel="manifest"'))
})
test('cache shell dan lazy chunk offline, termasuk deep link router; tanpa jaringan wajib', async () => {
  let online = true
  const fixture = workerFixture(serviceWorkerSource(assets, 'v1'), async (url) => { if (!online) throw new Error('offline'); return new Response(`asset:${new URL(url).pathname}`) })
  await fixture.dispatch('install'); await fixture.dispatch('activate'); online = false
  for (const path of ['/dashboard', '/kasir', '/bon', '/laporan', '/penjualan/uuid']) assert.equal(await (await fixture.request(path))!.text(), 'asset:/index.html')
  assert.equal(await (await fixture.request('/assets/lazy-excel.js', 'cors'))!.text(), 'asset:/assets/lazy-excel.js')
  assert.equal(fixture.state.claimed, 1)
})
test('POST, API, file cadangan dan lintas origin tidak masuk cache data bisnis', async () => {
  const fixture = workerFixture(serviceWorkerSource(assets, 'v1')); await fixture.dispatch('install')
  assert.equal(await fixture.request('/api/sales', 'cors'), undefined)
  assert.equal(await fixture.request('/kasir', 'cors', 'POST'), undefined)
  assert.equal(await fixture.request('/cadangan.json', 'cors'), undefined)
  assert.equal(await fixture.request('https://other.test/assets/app.js', 'cors'), undefined)
  assert.deepEqual([...fixture.caches.values()][0].entries.size, assets.length)
})
test('install gagal tidak merusak cache versi sebelumnya dan tidak mengakses IndexedDB', async () => {
  const previous = workerFixture(serviceWorkerSource(assets, 'v1')); await previous.dispatch('install')
  const fixture = workerFixture(serviceWorkerSource(assets, 'v2'), async () => new Response('missing', { status: 404 }))
  fixture.caches.set('pos-zanna-app-v1', previous.caches.get('pos-zanna-app-v1')!)
  await assert.rejects(fixture.dispatch('install'))
  assert.ok(fixture.caches.has('pos-zanna-app-v1')); assert.equal(fixture.caches.has('pos-zanna-app-v2'), false)
  assert.doesNotMatch(serviceWorkerSource(assets, 'v1'), /indexedDB\.|localStorage\.|sessionStorage\./)
})
test('activate hanya menghapus cache aset POS-Zanna lama; cache lain tetap', async () => {
  const fixture = workerFixture(serviceWorkerSource(assets, 'v2')); await fixture.dispatch('install')
  const cache = [...fixture.caches.values()][0]; fixture.caches.set('pos-zanna-app-v1', cache); fixture.caches.set('other-application', cache)
  await fixture.dispatch('activate'); assert.equal(fixture.caches.has('pos-zanna-app-v1'), false); assert.equal(fixture.caches.has('other-application'), true)
})
test('update tidak otomatis skipWaiting; persetujuan hanya dari satu jendela, status cache diperiksa', async () => {
  const fixture = workerFixture(serviceWorkerSource(assets, 'v1')); await fixture.dispatch('install')
  assert.equal(fixture.state.skipWaiting, 0)
  assert.deepEqual(JSON.parse(JSON.stringify(await fixture.message('APP_STATUS'))), { ready: true, version: 'v1', count: 1 })
  fixture.state.clients.push({ id: 'old-version' })
  assert.deepEqual(JSON.parse(JSON.stringify(await fixture.message('ACTIVATE_UPDATE'))), { accepted: false }); assert.equal(fixture.state.skipWaiting, 0)
  fixture.state.clients.pop(); await fixture.message('ACTIVATE_UPDATE'); assert.equal(fixture.state.skipWaiting, 1)
  const cache = [...fixture.caches.values()][0]; cache.entries.delete('/assets/app.js')
  assert.equal((await fixture.message('APP_STATUS') as { ready: boolean }).ready, false)
})
