import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { JSDOM } from 'jsdom'
import { SalesHistoryError, type SalesHistoryReader } from '../src/domain/salesHistory'
import { historyFixture, historySale, historySnapshot } from './sales-history-fixtures'
import { localDatabase } from '../src/data/localDatabase'
import { DexieProductRepository } from '../src/data/dexieProductRepository'
import { DexieInventoryRepository } from '../src/data/dexieInventoryRepository'
import { InventoryService } from '../src/services/inventoryOperations'
import type { DemoStore } from '../src/app/demoContext'

process.env.TZ = 'Asia/Singapore'
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' }), browser = dom.window
for (const key of ['window', 'document', 'HTMLElement', 'HTMLDialogElement', 'HTMLInputElement', 'Event', 'MouseEvent'] as const) Object.defineProperty(globalThis, key, { value: key === 'window' ? browser : browser[key], configurable: true })
Object.defineProperty(globalThis, 'navigator', { value: browser.navigator, configurable: true })
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
browser.scrollTo = () => {}
let width = 1366
const media = new browser.EventTarget()
const mql = Object.assign(media, { media: '(min-width: 1024px)', onchange: null, get matches() { return width >= 1024 }, addListener() {}, removeListener() {} })
browser.matchMedia = () => mql as unknown as MediaQueryList
browser.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
browser.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { MemoryRouter } = await import('react-router')
const { AppRoutes } = await import('../src/app/routes')
const { DemoProvider } = await import('../src/app/DemoProvider')
const { useDemoStore } = await import('../src/hooks/useDemoStore')
after(() => { localDatabase.close(); dom.window.close() })
const content = () => browser.document.getElementById('operasional')?.textContent ?? ''
async function wait(condition: () => boolean) {
  for (let i = 0; i < 100; i++) { if (condition()) return; await act(async () => { await new Promise((resolve) => setTimeout(resolve, 15)) }) }
  assert.fail(`DOM state tidak tercapai: ${content().slice(-1500)}`)
}
async function ready() { await wait(() => !!browser.document.querySelector('h1') && !content().includes('Membaca riwayat penjualan…') && !content().includes('Membaca struk tersimpan…')) }
function button(label: string) {
  const found = [...browser.document.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent === label)
  assert.ok(found, label); return found
}
async function click(label: string) { await act(async () => button(label).click()) }
async function input(id: string, value: string) {
  const element = browser.document.querySelector<HTMLInputElement>(id)!
  assert.ok(element)
  await act(async () => {
    Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value')!.set!.call(element, value)
    element.dispatchEvent(new browser.Event('input', { bubbles: true }))
  })
}
async function mount(service: SalesHistoryReader, route = '/penjualan', waitReady = true) {
  browser.sessionStorage.clear(); browser.localStorage.clear()
  const container = browser.document.createElement('div'); browser.document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(<MemoryRouter initialEntries={[route]}><AppRoutes salesHistory={service} /></MemoryRouter>))
  if (waitReady) await ready()
  return { async unmount() { await act(async () => root.unmount()); container.remove() } }
}
const rows = () => [...browser.document.querySelectorAll<HTMLElement>('[data-sale-id]')]
async function open(id: string) { await act(async () => browser.document.querySelector<HTMLAnchorElement>(`[data-sale-id="${id}"] a`)!.click()); await ready() }

test('DOM history kosong: empty state dan akses Kasir, bukan data DEMO', async () => {
  const f = historyFixture(), ui = await mount(f.service)
  try { assert.match(content(), /Belum ada penjualan tersimpan/); assert.equal(rows().length, 0); assert.ok(browser.document.querySelector('a[href="/kasir"]')) }
  finally { await ui.unmount(); await f.db.delete() }
})
test('DOM history list/detail/reopen: SaleReceipt yang sama, Rupiah, tanggal Indonesia, status', async () => {
  const f = historyFixture(), saved = await historySale(f.db, undefined, { multi: true }), before = await historySnapshot(f.db)
  const defaultUnits = await localDatabase.units.toArray(), ui = await mount(f.service)
  try {
    assert.equal(rows().length, 1); assert.ok(content().includes(saved.sale.receiptNumber)); assert.match(content().replace(/\s/g, ''), /Rp25\.500/)
    assert.equal(browser.document.querySelector('time')!.dateTime, saved.sale.createdAt); assert.match(content(), /COMPLETED/)
    await open(saved.sale.id)
    const receipt = browser.document.querySelector('[aria-label="Struk penjualan tersimpan"]')!
    assert.ok(receipt); assert.equal(receipt.querySelectorAll('li').length, 2); assert.match(receipt.textContent!, /Solar.*Standar.*Eceran/s)
    const receiptText = receipt.textContent
    await act(async () => browser.document.querySelector<HTMLAnchorElement>('a[href="/penjualan"]')!.click()); await ready(); await open(saved.sale.id)
    assert.equal(browser.document.querySelector('[aria-label="Struk penjualan tersimpan"]')!.textContent, receiptText)
    assert.deepEqual(await historySnapshot(f.db), before)
    assert.deepEqual(await localDatabase.units.toArray(), defaultUnits) // History route must not initialize master units.
  } finally { await ui.unmount(); await f.db.delete() }
})
test('DOM history search/tanggal/reset dan kombinasi tanpa hasil', async () => {
  const f = historyFixture(), old = await historySale(f.db, '2026-10-21T03:00:00.000Z'), recent = await historySale(f.db)
  const ui = await mount(f.service)
  try {
    await input('#history-receipt', old.sale.id); await click('Terapkan filter'); await ready()
    assert.deepEqual(rows().map((row) => row.dataset.saleId), [old.sale.id])
    await input('#history-start', '2026-10-22'); await input('#history-end', '2026-10-22'); await click('Terapkan filter'); await ready()
    assert.match(content(), /Tidak ada transaksi yang sesuai/); assert.equal(rows().length, 0)
    await click('Reset filter'); await ready()
    assert.equal(rows().length, 2); assert.equal(rows()[0].dataset.saleId, recent.sale.id)
    assert.equal(browser.document.querySelector<HTMLInputElement>('#history-receipt')!.value, '')
    assert.equal(browser.document.querySelector<HTMLInputElement>('#history-start')!.value, '')
  } finally { await ui.unmount(); await f.db.delete() }
})
test('DOM history load more dengan double-click tidak duplikasi dan tidak membaca items', async () => {
  const f = historyFixture()
  for (let i = 0; i < 23; i++) await historySale(f.db)
  let moreCalls = 0
  const reader: SalesHistoryReader = { getDetail: (id) => f.service.getDetail(id), list: async (request) => { if (request?.cursor) moreCalls++; return f.service.list(request) } }
  const ui = await mount(reader)
  try {
    assert.equal(rows().length, 20)
    const more = button('Muat lebih banyak')
    await act(async () => { more.click(); more.click() }); await wait(() => rows().length === 23)
    assert.equal(new Set(rows().map((row) => row.dataset.saleId)).size, 23); assert.equal(moreCalls, 1)
    assert.equal([...browser.document.querySelectorAll('button')].some((item) => item.textContent === 'Muat lebih banyak'), false)
  } finally { await ui.unmount(); await f.db.delete() }
})
test('DOM history error database: pesan aman dan Coba lagi, bukan empty state', async () => {
  const f = historyFixture(); await historySale(f.db)
  let broken = true
  const reader: SalesHistoryReader = { getDetail: (id) => f.service.getDetail(id), list: async (request) => { if (broken) throw new Error('private stack payload'); return f.service.list(request) } }
  const ui = await mount(reader)
  try {
    assert.match(content(), /Riwayat tidak dapat dibaca/); assert.doesNotMatch(content(), /Belum ada penjualan|private stack/)
    broken = false; await click('Coba lagi'); await ready(); assert.equal(rows().length, 1)
  } finally { await ui.unmount(); await f.db.delete() }
})
test('DOM history load-more error menjaga baris lama dan retry tidak mengulang halaman pertama', async () => {
  const f = historyFixture()
  for (let i = 0; i < 21; i++) await historySale(f.db)
  let fail = true
  const reader: SalesHistoryReader = { getDetail: (id) => f.service.getDetail(id), list: async (request) => { if (request?.cursor && fail) throw new SalesHistoryError('STORAGE_ERROR', 'Penyimpanan sementara tidak tersedia.'); return f.service.list(request) } }
  const ui = await mount(reader)
  try {
    await click('Muat lebih banyak'); await wait(() => !!browser.document.querySelector('[role="alert"]'))
    assert.equal(rows().length, 20); fail = false; await click('Coba lagi'); await wait(() => rows().length === 21)
    assert.equal(new Set(rows().map((row) => row.dataset.saleId)).size, 21)
  } finally { await ui.unmount(); await f.db.delete() }
})
test('DOM history filter invalid dari URL dan tanggal terbalik dapat direset', async () => {
  const f = historyFixture(); await historySale(f.db)
  const ui = await mount(f.service, '/penjualan?mulai=2026-02-30')
  try {
    assert.match(content(), /Periksa filter pencarian/); assert.equal(rows().length, 0)
    await click('Reset filter'); await ready(); assert.equal(rows().length, 1)
    await input('#history-start', '2026-10-23'); await input('#history-end', '2026-10-22'); await click('Terapkan filter'); await ready()
    assert.match(content(), /Tanggal mulai tidak boleh melewati/)
  } finally { await ui.unmount(); await f.db.delete() }
})
test('DOM history direct route dan refresh mempertahankan filter/detail tanpa pointer checkout', async () => {
  const f = historyFixture(), saved = await historySale(f.db)
  const route = `/penjualan/${saved.sale.id}?q=${saved.sale.id}&mulai=2026-10-22&sampai=2026-10-22`
  let ui = await mount(f.service, route)
  try {
    assert.ok(browser.document.querySelector('[aria-label="Struk penjualan tersimpan"]'))
    await ui.unmount(); ui = await mount(f.service, route)
    assert.ok(content().includes(saved.sale.receiptNumber))
    await act(async () => browser.document.querySelector<HTMLAnchorElement>('#operasional a')!.click()); await ready()
    assert.equal(browser.document.querySelector<HTMLInputElement>('#history-receipt')!.value, saved.sale.id)
    assert.equal(rows().length, 1)
  } finally { await ui.unmount(); await f.db.delete() }
})
test('DOM history detail ID tidak ditemukan dibedakan dari storage/integrity', async () => {
  const f = historyFixture(), ui = await mount(f.service, `/penjualan/${crypto.randomUUID()}`)
  try { assert.match(content(), /Transaksi tidak ditemukan/); assert.equal(browser.document.querySelector('[aria-label="Struk penjualan tersimpan"]'), null) }
  finally { await ui.unmount(); await f.db.delete() }
})
test('DOM history SaleItem hilang: tampil integrity error, tidak struk parsial atau empty', async () => {
  const f = historyFixture(), saved = await historySale(f.db, undefined, { multi: true })
  await f.db.saleItems.delete(saved.items[0].id)
  const before = await historySnapshot(f.db), ui = await mount(f.service, `/penjualan/${saved.sale.id}`)
  try {
    assert.match(content(), /Data transaksi tidak konsisten/); assert.doesNotMatch(content(), /Belum ada penjualan tersimpan/)
    assert.equal(browser.document.querySelector('[aria-label="Struk penjualan tersimpan"]'), null)
    assert.deepEqual(await historySnapshot(f.db), before)
  } finally { await ui.unmount(); await f.db.delete() }
})
test('DOM history receipt snapshot tetap ketika master berubah/arsip dan dibuka ulang', async () => {
  const f = historyFixture(), saved = await historySale(f.db), ui = await mount(f.service, `/penjualan/${saved.sale.id}`)
  try {
    const before = browser.document.querySelector('[aria-label="Struk penjualan tersimpan"]')!.textContent
    await f.db.products.update(saved.product.id, { name: 'Nama sekarang', isActive: false }); await f.db.variants.update(saved.variant.id, { sellingPrice: 15000 })
    await act(async () => browser.document.querySelector<HTMLAnchorElement>('#operasional a')!.click()); await ready(); await open(saved.sale.id)
    assert.equal(browser.document.querySelector('[aria-label="Struk penjualan tersimpan"]')!.textContent, before)
  } finally { await ui.unmount(); await f.db.delete() }
})
test('DOM history respons halaman lama tidak mengalahkan filter baru', async () => {
  const f = historyFixture(), saved = await historySale(f.db); await historySale(f.db)
  let release: () => void = () => {}; const gate = new Promise<void>((resolve) => { release = resolve })
  const reader: SalesHistoryReader = { getDetail: (id) => f.service.getDetail(id), list: async (request) => { if (!request?.receipt) await gate; return f.service.list(request) } }
  const ui = await mount(reader, '/penjualan', false)
  try {
    await input('#history-receipt', saved.sale.id); await click('Terapkan filter'); await ready()
    assert.equal(rows().length, 1)
    await act(async () => release()); await ready()
    assert.deepEqual(rows().map((row) => row.dataset.saleId), [saved.sale.id])
  } finally { release(); await ui.unmount(); await f.db.delete() }
})
test('DOM history load more lama diabaikan ketika filter diubah', async () => {
  const f = historyFixture(), saved = await historySale(f.db)
  for (let i = 0; i < 20; i++) await historySale(f.db)
  let release: () => void = () => {}; const gate = new Promise<void>((resolve) => { release = resolve })
  const reader: SalesHistoryReader = { getDetail: (id) => f.service.getDetail(id), list: async (request) => { if (request?.cursor) await gate; return f.service.list(request) } }
  const ui = await mount(reader)
  try {
    await click('Muat lebih banyak'); await input('#history-receipt', saved.sale.id); await click('Terapkan filter'); await ready()
    assert.equal(rows().length, 1); await act(async () => release()); await ready()
    assert.deepEqual(rows().map((row) => row.dataset.saleId), [saved.sale.id])
  } finally { release(); await ui.unmount(); await f.db.delete() }
})
test('DOM navigasi desktop/tablet/mobile: entry riwayat tersedia, Menu dan tiga shortcut tetap', async () => {
  const f = historyFixture(); await historySale(f.db); const ui = await mount(f.service)
  try {
    assert.ok(browser.document.querySelector('nav[aria-label="Navigasi operasional"] a[href="/penjualan"]'))
    for (const viewport of [768, 390]) {
      await act(async () => { width = viewport; media.dispatchEvent(new browser.Event('change')) })
      assert.deepEqual([...browser.document.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Navigasi cepat"] a')].map((link) => link.getAttribute('href')), ['/dashboard', '/kasir', '/produk'])
      await act(async () => browser.document.querySelector<HTMLButtonElement>('[aria-label="Buka semua menu"]')!.click())
      const link = browser.document.querySelector<HTMLAnchorElement>('dialog a[href="/penjualan"]')!
      assert.ok(link); await act(async () => link.click()); await ready(); assert.equal(browser.document.querySelector('dialog'), null)
    }
    await act(async () => { width = 1366; media.dispatchEvent(new browser.Event('change')) })
  } finally { await ui.unmount(); await f.db.delete() }
})

test('DOM provider masuk/keluar riwayat menjaga cart/controller dan membaca saldo terbaru saat kembali', async () => {
  const f = historyFixture(), saved = await historySale(f.db), repository = new DexieProductRepository(f.db), inventory = new InventoryService(new DexieInventoryRepository(f.db))
  let initializations = 0, store: DemoStore
  const initialize = repository.initialize.bind(repository)
  repository.initialize = async () => { initializations++; await initialize() }
  function Probe() { store = useDemoStore(); return null }
  const container = browser.document.createElement('div'); browser.document.body.append(container)
  const root = createRoot(container)
  async function render(enabled: boolean) { await act(async () => root.render(<DemoProvider repository={repository} inventory={inventory} catalogEnabled={enabled}><Probe /></DemoProvider>)) }
  try {
    await render(true); await wait(() => store?.status === 'ready')
    await act(async () => store.setCart([{ variantId: saved.variant.id, quantity: 1 }]))
    const cart = store!.cart, controller = store!.checkoutController, before = await historySnapshot(f.db)
    await render(false)
    assert.equal(initializations, 1); assert.equal(store!.cart, cart); assert.equal(store!.checkoutController, controller)
    assert.deepEqual(await historySnapshot(f.db), before)
    await inventory.execute({ operationId: crypto.randomUUID(), productId: saved.product.id, movementType: 'STOCK_IN', inputQuantity: 1000, inputUnitId: saved.product.baseUnitId, reason: 'Uji subscription kembali' })
    const latest = (await inventory.getBalances())[0].quantityBase
    await render(true); await wait(() => store!.inventoryBalances[0]?.quantityBase === latest)
    assert.equal(store!.cart, cart); assert.equal(store!.checkoutController, controller); assert.equal(initializations, 2)
  } finally { await act(async () => root.unmount()); container.remove(); await f.db.delete() }
})
