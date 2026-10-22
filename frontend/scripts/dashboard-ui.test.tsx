import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { JSDOM } from 'jsdom'
import { historyFixture, historySale, historySnapshot } from './sales-history-fixtures'
import { DexieDashboardRepository } from '../src/data/dexieDashboardRepository'
import { DashboardService } from '../src/services/dashboardOperations'
import { CheckoutService } from '../src/services/checkoutOperations'
import { DexieCheckoutRepository } from '../src/data/dexieCheckoutRepository'
import { InventoryService } from '../src/services/inventoryOperations'
import { DexieInventoryRepository } from '../src/data/dexieInventoryRepository'
import { localDatabase } from '../src/data/localDatabase'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' }), browser = dom.window
for (const key of ['window', 'document', 'HTMLElement', 'HTMLDialogElement', 'Event', 'MouseEvent'] as const) Object.defineProperty(globalThis, key, { value: key === 'window' ? browser : browser[key], configurable: true })
Object.defineProperty(globalThis, 'navigator', { value: browser.navigator, configurable: true })
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
browser.scrollTo = () => {}
let width = 1366
const media = new browser.EventTarget()
const mql = Object.assign(media, { media: '(min-width: 1024px)', onchange: null, get matches() { return width >= 1024 }, addListener() {}, removeListener() {} })
browser.matchMedia = () => mql as unknown as MediaQueryList
browser.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
browser.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
const { act } = await import('react'), { createRoot } = await import('react-dom/client'), { MemoryRouter } = await import('react-router')
const { AppRoutes } = await import('../src/app/routes')
after(() => { localDatabase.close(); dom.window.close() })
const text = () => browser.document.getElementById('operasional')?.textContent ?? ''
async function wait(predicate: () => boolean) { for (let i = 0; i < 100; i++) { if (predicate()) return; await act(async () => { await new Promise((resolve) => setTimeout(resolve, 15)) }) }; assert.fail(text()) }
async function mount(f: ReturnType<typeof historyFixture>) {
  const container = browser.document.createElement('div'); browser.document.body.append(container)
  const root = createRoot(container), service = new DashboardService(new DexieDashboardRepository(f.db))
  await act(async () => root.render(<MemoryRouter initialEntries={['/dashboard']}><AppRoutes dashboard={service} salesHistory={f.service} /></MemoryRouter>))
  await wait(() => !text().includes('Membaca Dashboard…'))
  return { async close() { await act(async () => root.unmount()); container.remove() } }
}
test('DOM Dashboard kosong: seluruh metrik nyata nol, grafik tujuh hari dan empty states', async () => {
  const f = historyFixture(), ui = await mount(f)
  try {
    assert.match(browser.document.querySelector('[data-metric="revenue"]')!.textContent!.replace(/\s/g, ''), /Rp0/)
    assert.match(browser.document.querySelector('[data-metric="items"]')!.textContent!, /0/)
    assert.equal(browser.document.querySelectorAll('[aria-label="Penjualan tujuh hari"] li').length, 7)
    assert.match(text(), /Belum ada transaksi tersimpan/); assert.doesNotMatch(text(), /Pelanggan fiktif|Sampel tetap|Total DEMO/)
    assert.equal(await f.db.sales.count(), 0)
  } finally { await ui.close(); await f.db.delete() }
})
test('DOM Dashboard live: checkout memperbarui omzet/baris, stock out terpisah dan receipt link nyata', async () => {
  const f = historyFixture(), saved = await historySale(f.db, new Date().toISOString(), { multi: true }), ui = await mount(f)
  const checkout = new CheckoutService(new DexieCheckoutRepository(f.db)), inventory = new InventoryService(new DexieInventoryRepository(f.db))
  try {
    assert.match(browser.document.querySelector('[data-metric="revenue"]')!.textContent!.replace(/\s/g, ''), /Rp25\.500/)
    const command = { ...saved.command, checkoutOperationId: crypto.randomUUID() }
    await act(async () => { await checkout.prepare(command); await checkout.execute(command) })
    await wait(() => browser.document.querySelector('[data-metric="revenue"]')!.textContent!.replace(/\s/g, '').includes('Rp51.000'))
    assert.match(browser.document.querySelector('[data-metric="items"]')!.textContent!, /4/)
    await act(async () => { await inventory.execute({ operationId: crypto.randomUUID(), productId: saved.product.id, movementType: 'ADJUSTMENT_OUT', inputUnitId: saved.product.baseUnitId, inputQuantity: (await inventory.getBalances())[0].quantityBase, reason: 'Audit stok habis' }) })
    await wait(() => browser.document.querySelector('[aria-label="Produk stok habis"]')!.textContent!.includes('Solar'))
    const before = await historySnapshot(f.db)
    await act(async () => browser.document.querySelector<HTMLAnchorElement>(`a[href="/penjualan/${saved.sale.id}"]`)!.click())
    await wait(() => !!browser.document.querySelector('[aria-label="Struk penjualan tersimpan"]'))
    assert.deepEqual(await historySnapshot(f.db), before)
  } finally { await ui.close(); await f.db.delete() }
})
test('DOM Dashboard read-only dan navigasi Menu pada empat viewport tidak merusak shortcut', async () => {
  const f = historyFixture(); await historySale(f.db, new Date().toISOString())
  const before = await historySnapshot(f.db), ui = await mount(f)
  try {
    for (const viewport of [390, 768, 1024, 1366]) {
      await act(async () => { width = viewport; media.dispatchEvent(new browser.Event('change')) })
      assert.ok(browser.document.querySelector('[data-metric="revenue"]'))
      assert.deepEqual([...browser.document.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Navigasi cepat"] a')].map((link) => link.getAttribute('href')), ['/dashboard', '/kasir', '/produk'])
      await act(async () => browser.document.querySelector<HTMLButtonElement>('[aria-label="Buka semua menu"]')!.click())
      assert.ok(browser.document.querySelector('dialog a[href="/penjualan"]'))
      await act(async () => browser.document.querySelector<HTMLButtonElement>('[aria-label="Tutup dialog"]')!.click())
    }
    assert.deepEqual(await historySnapshot(f.db), before)
  } finally { await ui.close(); await f.db.delete() }
})
test('DOM Dashboard storage error/retry: tidak menampilkan angka nol palsu atau reset data', async () => {
  const f = historyFixture(); await historySale(f.db, new Date().toISOString()); f.db.close({ disableAutoOpen: true })
  const ui = await mount(f)
  try {
    await wait(() => !!browser.document.querySelector('[role="alert"]'))
    assert.equal(browser.document.querySelector('[data-metric="revenue"]'), null)
    await f.db.open()
    const retry = [...browser.document.querySelectorAll<HTMLButtonElement>('button')].find((entry) => entry.textContent === 'Coba lagi')!
    await act(async () => retry.click()); await wait(() => !!browser.document.querySelector('[data-metric="revenue"]'))
    assert.equal(await f.db.sales.count(), 1)
  } finally { await ui.close(); await f.db.delete() }
})
