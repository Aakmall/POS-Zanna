import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'
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
    const emittedJs = (await readdir('dist/assets')).filter((file) => file.endsWith('.js')).map((file) => `/assets/${file}`)
    assert.deepEqual(assets.filter((path) => path.endsWith('.js')).sort(), emittedJs.sort())
    for (const page of ['Cashier', 'Credit', 'Dashboard', 'Products', 'Reports', 'SaleDetails', 'SalesHistory', 'Settings', 'Stock']) assert.ok(assets.some((path) => path.includes(`/${page}Page-`)), page)
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

test('ESM production build benar-benar dieksekusi: halaman lazy dapat dinavigasi tanpa error inisialisasi chunk', async () => {
  // Execute the emitted JS, not TypeScript source. JSDOM/fake IndexedDB still do
  // not constitute a native Service Worker, browser layout or tablet test.
  const dom = new JSDOM('<!doctype html><body><div id="root"></div></body>', { url: 'https://pos.test/' }), browser = dom.window
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLDialogElement', 'Event', 'MouseEvent', 'MutationObserver'] as const) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? browser : browser[key] })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: browser.navigator })
  browser.scrollTo = () => {}
  // Modern target browsers support modulepreload; Node loads the emitted ESM
  // from disk here. JSDOM has no native module loader and must not fetch pos.test.
  const supports = browser.DOMTokenList.prototype.supports
  browser.DOMTokenList.prototype.supports = function (token) { return token === 'modulepreload' || supports.call(this, token) }
  browser.matchMedia = () => Object.assign(new browser.EventTarget(), { matches: true }) as unknown as MediaQueryList
  browser.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  browser.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  const wait = async (condition: () => boolean) => {
    for (let i = 0; i < 200; i++) { if (condition()) return; await new Promise((done) => setTimeout(done, 10)) }
    assert.fail(browser.document.body.textContent ?? '')
  }
  async function navigate(path: string, expected: string) {
    browser.history.pushState({}, '', path); browser.dispatchEvent(new browser.PopStateEvent('popstate'))
    await wait(() => (browser.document.body.textContent ?? '').includes(expected))
    assert.doesNotMatch(browser.document.body.textContent ?? '', /Halaman belum dapat ditampilkan/)
  }
  try {
    const entry = (await readdir('dist/assets')).find((file) => /^index-.+\.js$/.test(file)); assert.ok(entry)
    await import(pathToFileURL(resolve('dist/assets', entry)).href)
    await wait(() => !!browser.document.querySelector('h1'))
    for (const [path, expected] of [
      ['/dashboard', 'Penjualan periode'], ['/kasir', 'Katalog produk'], ['/produk', 'Tambah produk'], ['/stok', 'Persediaan'],
      ['/bon', 'Tambah pelanggan'], ['/laporan', 'Ekspor CSV'], ['/penjualan', 'Riwayat Penjualan'],
      ['/penjualan/00000000-0000-4000-8000-000000000001', 'Transaksi tidak ditemukan'],
      ['/pengaturan?bagian=backup', 'Cadangkan Data'], ['/pengaturan?bagian=app', 'Aset aplikasi'],
    ]) await navigate(path, expected)
  } finally {
    // Unmount the operational provider and report intervals before closing DOM.
    await navigate('/', 'Awal yang rapi.')
    browser.close()
  }
})
