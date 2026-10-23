import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { JSDOM } from 'jsdom'
import { ZannaDatabase } from '../src/data/database'
import { DexieProductRepository } from '../src/data/dexieProductRepository'
import { DexieInventoryRepository } from '../src/data/dexieInventoryRepository'
import { DexieCheckoutRepository } from '../src/data/dexieCheckoutRepository'
import { InventoryService } from '../src/services/inventoryOperations'
import { CheckoutService } from '../src/services/checkoutOperations'
import { CheckoutError, type CheckoutCommand } from '../src/domain/checkout'
import { browserCheckoutSession, CHECKOUT_SESSION_KEY, CHECKOUT_RECOVERY_PREFIX, LAST_RECEIPT_KEY, type CheckoutSessionStore } from '../src/features/cashier/checkoutSession'
import type { CheckoutClient } from '../src/features/cashier/checkoutController'
import type { DemoStore } from '../src/app/demoContext'
import { checkoutFixture } from './checkout-fixtures'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
const browser = dom.window
for (const key of ['window', 'document', 'HTMLElement', 'HTMLDialogElement', 'HTMLInputElement', 'Event', 'MouseEvent'] as const) Object.defineProperty(globalThis, key, { value: key === 'window' ? browser : browser[key], configurable: true })
Object.defineProperty(globalThis, 'navigator', { value: browser.navigator, configurable: true })
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let width = 1366
const media = new browser.EventTarget()
const mql = Object.assign(media, { media: '(min-width: 1024px)', onchange: null, get matches() { return width >= 1024 }, addListener() {}, removeListener() {} })
browser.matchMedia = () => mql as unknown as MediaQueryList
browser.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
browser.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { MemoryRouter } = await import('react-router')
const { DemoProvider } = await import('../src/app/DemoProvider')
const { useDemoStore } = await import('../src/hooks/useDemoStore')
const { CashierPage } = await import('../src/features/cashier/CashierPage')
const connections: ZannaDatabase[] = []
after(async () => { for (const db of connections) await db.delete(); dom.window.close() })
async function wait(condition: () => boolean, message = 'UI state tidak tercapai') {
  for (let i = 0; i < 100; i++) {
    if (condition()) return
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 15)) })
  }
  assert.fail(`${message}: ${browser.document.body.textContent?.slice(-1800)}`)
}
const text = () => browser.document.body.textContent ?? ''
function button(label: string, selector = 'button') {
  const found = [...browser.document.querySelectorAll<HTMLButtonElement>(selector)].find((element) => element.textContent === label)
  assert.ok(found, `Tombol ${label} tersedia`); return found
}
async function click(label: string) { await act(async () => button(label).click()) }
async function input(selector: string, value: string) {
  const element = browser.document.querySelector<HTMLInputElement>(selector)!
  assert.ok(element)
  await act(async () => {
    Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value')!.set!.call(element, value)
    element.dispatchEvent(new browser.Event('input', { bubbles: true }))
  })
}
async function setup(source = checkoutFixture('bungkus', 'fixed')) {
  width = 1366; browser.sessionStorage.clear(); browser.localStorage.clear()
  const db = new ZannaDatabase(`checkout-ui-${crypto.randomUUID()}`); connections.push(db)
  await db.units.bulkAdd(source.catalog.units); await db.categories.bulkAdd(source.catalog.categories)
  await db.products.bulkAdd(source.catalog.products); await db.variants.bulkAdd(source.catalog.variants)
  const inventory = new InventoryService(new DexieInventoryRepository(db))
  for (const product of source.catalog.products) await inventory.execute({ operationId: crypto.randomUUID(), productId: product.id, movementType: 'OPENING_BALANCE', inputUnitId: product.baseUnitId, inputQuantity: source.balances.find((b) => b.productId === product.id)!.quantityBase, reason: '' })
  const repository = new DexieProductRepository(db), service = new CheckoutService(new DexieCheckoutRepository(db))
  return { ...source, db, inventory, repository, service }
}
type Fixture = Awaited<ReturnType<typeof setup>>
async function mount(f: Fixture, client: CheckoutClient = f.service, session: CheckoutSessionStore = browserCheckoutSession) {
  const container = browser.document.createElement('div'); browser.document.body.append(container)
  const root = createRoot(container)
  let store: DemoStore
  function Probe() { store = useDemoStore(); return null }
  await act(async () => root.render(<MemoryRouter initialEntries={['/kasir']}><DemoProvider repository={f.repository} inventory={f.inventory} checkout={client} checkoutSession={session}><Probe /><main id="operasional" tabIndex={-1}><CashierPage /></main></DemoProvider></MemoryRouter>))
  await wait(() => store?.status === 'ready' && (!store.checkoutController.getSnapshot().busy))
  return {
    get store() { return store! },
    async unmount() { await act(async () => root.unmount()); container.remove() },
    async add(index = 0) { await act(async () => browser.document.querySelectorAll<HTMLButtonElement>('.product-add')[index].click()) },
    async pay() {
      const pay = [...browser.document.querySelectorAll<HTMLButtonElement>('.cart-panel button')].find((b) => b.textContent?.startsWith('Bayar '))!
      assert.ok(pay && !pay.disabled); await act(async () => pay.click()); await wait(() => !!browser.document.querySelector('#cash'))
    },
    async success() { await wait(() => !!browser.document.querySelector('[aria-label="Struk penjualan tersimpan"]')) },
  }
}
const delegate = (service: CheckoutClient): CheckoutClient => ({ preview: (lines) => service.preview(lines), prepare: (command) => service.prepare(command), execute: (command) => service.execute(command), getResult: (id) => service.getResult(id), listUnresolved: () => service.listUnresolved(), cancel: (id) => service.cancel(id) })
async function confirm() { await click('Uang pas'); await click('Konfirmasi pembayaran tunai') }
async function makeCommand(f: Fixture) {
  const quote = await f.service.preview([{ variantId: f.variant.id, quantity: 2000 }])
  const command: CheckoutCommand = { payloadVersion: 1, checkoutOperationId: crypto.randomUUID(), paymentMethod: 'CASH', lines: quote.lines, expectedTotal: quote.total, cashReceived: quote.total }
  return command
}

test('UI tunai: commit satu Sale/item/SALE, saldo berkurang, struk dan clear cart milik transaksi', async () => {
  const f = await setup(), ui = await mount(f)
  try {
    await ui.add(); await ui.pay(); await confirm(); await ui.success()
    assert.equal(await f.db.sales.count(), 1); assert.equal(await f.db.saleItems.count(), 1)
    assert.equal(await f.db.stockMovements.where('saleId').above('').count(), 1)
    assert.equal((await f.db.inventoryBalances.get(f.product.id))!.quantityBase, 99000)
    assert.equal(ui.store.cart.length, 0); assert.match(text(), /Uang diterima.*Kembalian/)
    await click('Tutup struk'); await click('Buka struk terakhir'); await ui.success()
  } finally { await ui.unmount() }
})
test('UI tunai kurang/invalid: submit dinonaktifkan, tidak prepare/commit', async () => {
  const f = await setup(), ui = await mount(f)
  try {
    await ui.add(); await ui.pay()
    for (const value of ['100', '-1', '1e6', '1000000001']) {
      await input('#cash', value); assert.equal(button('Konfirmasi pembayaran tunai').disabled, true)
    }
    assert.equal(await f.db.checkoutIntents.count(), 0); assert.equal(await f.db.sales.count(), 0)
    assert.equal(ui.store.cart.length, 1)
  } finally { await ui.unmount() }
})
test('UI QUOTE_CHANGED: cart tetap, cancel intent lama lalu preview baru dan konfirmasi ulang', async () => {
  const f = await setup(), ui = await mount(f)
  try {
    await ui.add(); await ui.pay()
    await act(async () => { await f.db.variants.update(f.variant.id, { sellingPrice: 15000, updatedAt: '2026-10-22T00:00:00.000Z' }) })
    await confirm(); await wait(() => text().includes('QUOTE_CHANGED'))
    assert.equal(await f.db.sales.count(), 0); assert.equal(ui.store.cart.length, 1)
    const oldId = ui.store.checkoutController.getSnapshot().command!.checkoutOperationId
    await click('Batalkan intent untuk koreksi'); await wait(() => !ui.store.checkoutController.getSnapshot().command)
    assert.equal((await f.db.checkoutIntents.get(oldId))!.status, 'CANCELLED')
    await click('Tinjau ulang harga dan stok'); await wait(() => !!browser.document.querySelector('#cash'))
    await confirm(); await ui.success(); assert.equal((await f.db.sales.toArray())[0].total, 15000)
  } finally { await ui.unmount() }
})
test('UI stok berkurang sesudah preview: error bisnis, cart tetap, tidak Sale', async () => {
  const f = await setup(), ui = await mount(f)
  try {
    await ui.add(); await ui.pay()
    await act(async () => { await f.inventory.execute({ operationId: crypto.randomUUID(), productId: f.product.id, movementType: 'ADJUSTMENT_OUT', inputUnitId: f.product.baseUnitId, inputQuantity: 100000, reason: 'Uji stok berubah' }) })
    await confirm(); await wait(() => text().includes('INSUFFICIENT_STOCK'))
    assert.equal(ui.store.cart.length, 1); assert.equal(await f.db.sales.count(), 0)
  } finally { await ui.unmount() }
})
test('UI double-click sinkron: satu prepare/execute dan satu Sale', async () => {
  const f = await setup(), client = delegate(f.service)
  let executions = 0
  client.execute = async (command) => { executions++; return f.service.execute(command) }
  const ui = await mount(f, client)
  try {
    await ui.add(); await ui.pay(); await click('Uang pas')
    const submit = button('Konfirmasi pembayaran tunai')
    await act(async () => { submit.click(); submit.click(); submit.click() })
    await ui.success(); assert.equal(executions, 1); assert.equal(await f.db.sales.count(), 1)
  } finally { await ui.unmount() }
})
test('UI gagal write: rollback seluruh efek; uncertain lalu periksa ID sama', async () => {
  const f = await setup(), ui = await mount(f)
  const fault = () => { throw new Error('Injected write failure') }
  f.db.stockMovements.hook('creating', fault)
  try {
    await ui.add(); await ui.pay(); await confirm(); await wait(() => text().includes('Status transaksi belum dapat dipastikan'))
    const id = ui.store.checkoutController.getSnapshot().command!.checkoutOperationId
    assert.equal(await f.db.sales.count(), 0); assert.equal(await f.db.saleItems.count(), 0)
    assert.equal(await f.db.stockMovements.count(), 1); assert.equal((await f.db.inventoryBalances.get(f.product.id))!.quantityBase, 100000)
    assert.equal(ui.store.cart.length, 1)
    await act(async () => browser.document.querySelector<HTMLButtonElement>('[aria-label="Tutup dialog"]')!.click())
    assert.ok(browser.document.querySelector('dialog'))
    f.db.stockMovements.hook('creating').unsubscribe(fault)
    await click('Periksa hasil transaksi'); await wait(() => text().includes('Lanjutkan request yang sama'))
    await click('Lanjutkan request yang sama'); await ui.success()
    assert.equal((await f.db.sales.toArray())[0].checkoutOperationId, id)
  } finally { f.db.stockMovements.hook('creating').unsubscribe(fault); await ui.unmount() }
})
test('UI respons commit hilang dan DB tak terbaca: uncertain, getResult memakai ID lama', async () => {
  const f = await setup(), client = delegate(f.service), inspected: string[] = []
  let unavailable = false
  client.execute = async (command) => { await f.service.execute(command); unavailable = true; throw new CheckoutError('STORAGE_ERROR', 'Respons hilang') }
  client.getResult = async (id) => { inspected.push(id); if (unavailable) throw new Error('DB unavailable'); return f.service.getResult(id) }
  const ui = await mount(f, client)
  try {
    await ui.add(); await ui.pay(); await confirm(); await wait(() => text().includes('Status transaksi belum dapat dipastikan'))
    const id = ui.store.checkoutController.getSnapshot().command!.checkoutOperationId
    await click('Periksa hasil transaksi'); await wait(() => !ui.store.checkoutController.getSnapshot().busy)
    assert.equal(ui.store.checkoutController.getSnapshot().status, 'uncertain'); assert.equal(ui.store.cart.length, 1)
    unavailable = false; await click('Periksa hasil transaksi'); await ui.success()
    assert.ok(inspected.every((seen) => seen === id)); assert.equal(await f.db.sales.count(), 1); assert.equal(ui.store.cart.length, 0)
  } finally { await ui.unmount() }
})
test('UI refresh setelah prepare: journal dan PREPARED dipulihkan; tanpa auto-execute', async () => {
  const f = await setup(), command = await makeCommand(f)
  await f.service.prepare(command); browserCheckoutSession.write({ active: command, lastId: null })
  const ui = await mount(f)
  try {
    await wait(() => text().includes('Lanjutkan request yang sama')); assert.equal(await f.db.sales.count(), 0)
    await click('Lanjutkan request yang sama'); await ui.success(); assert.equal(await f.db.sales.count(), 1)
  } finally { await ui.unmount() }
})
test('UI listUnresolved tanpa journal: pilih intent dan batal eksplisit tanpa autoexecute', async () => {
  const f = await setup(), command = await makeCommand(f); await f.service.prepare(command)
  const ui = await mount(f)
  try {
    assert.equal(await f.db.sales.count(), 0)
    const recovery = [...browser.document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.startsWith('Pulihkan intent'))!
    assert.ok(recovery); await act(async () => recovery.click()); await wait(() => text().includes('Lanjutkan request yang sama'))
    await click('Batalkan intent untuk koreksi'); await wait(() => !ui.store.checkoutController.getSnapshot().command)
    assert.equal((await f.db.checkoutIntents.get(command.checkoutOperationId))!.status, 'CANCELLED'); assert.equal(await f.db.sales.count(), 0)
  } finally { await ui.unmount() }
})
test('UI refresh setelah commit sebelum UI selesai: temukan struk lama, tidak checkout kedua', async () => {
  const f = await setup(), command = await makeCommand(f); await f.service.prepare(command)
  const result = await f.service.execute(command); browserCheckoutSession.write({ active: command, lastId: null })
  const ui = await mount(f)
  try {
    await ui.success(); assert.ok(text().includes(result.sale.receiptNumber)); assert.equal(await f.db.sales.count(), 1)
    assert.equal(ui.store.checkoutController.getSnapshot().result!.sale.id, result.sale.id)
  } finally { await ui.unmount() }
})
test('UI cancel versus execute: committed Sale ditemukan saat cancel, tidak undo saldo', async () => {
  const f = await setup(), command = await makeCommand(f); await f.service.prepare(command)
  browserCheckoutSession.write({ active: command, lastId: null }); const ui = await mount(f)
  try {
    await wait(() => text().includes('Lanjutkan request yang sama'))
    await f.service.execute(command)
    await click('Batalkan intent untuk koreksi'); await ui.success()
    assert.equal(await f.db.sales.count(), 1); assert.equal((await f.db.inventoryBalances.get(f.product.id))!.quantityBase, 98000)
    assert.equal((await f.db.checkoutIntents.get(command.checkoutOperationId))!.status, 'COMMITTED')
  } finally { await ui.unmount() }
})
test('UI fixed dua botol: adapter mengirim scaled 2000 dan stok isi kemasan tepat', async () => {
  const source = checkoutFixture('l', 'fixed'); source.variant.sellingUnitId = source.unit('botol').id; source.variant.quantityInBaseUnit = 1500
  const f = await setup(source), ui = await mount(f)
  try {
    await ui.add(); await ui.add(); await ui.pay(); await confirm(); await ui.success()
    const item = (await f.db.saleItems.toArray())[0]
    assert.equal(item.quantity, 2000); assert.equal(item.quantityBase, 3000); assert.equal(item.unitSnapshot.code, 'botol')
  } finally { await ui.unmount() }
})
test('UI variable 1,5 L: input aktual → scaled 1500, total Rp19.500, stock tepat', async () => {
  const f = await setup(checkoutFixture()), ui = await mount(f)
  try {
    await ui.add(); await input('#variable-quantity', '1,5'); await click('Simpan jumlah')
    await ui.pay(); await input('#cash', '20000'); await click('Konfirmasi pembayaran tunai'); await ui.success()
    const item = (await f.db.saleItems.toArray())[0], sale = (await f.db.sales.toArray())[0]
    assert.equal(item.quantity, 1500); assert.equal(item.quantityBase, 1500); assert.equal(sale.total, 19500); assert.equal(sale.changeAmount, 500)
    assert.match(text(), /1,5 Liter/)
  } finally { await ui.unmount() }
})
test('UI dua varian satu produk: saldo bersama dan ledger SALE masing-masing', async () => {
  const source = checkoutFixture('l', 'fixed'); source.variant.sellingUnitId = source.unit('botol').id; source.variant.name = 'Botol 1 L'
  source.catalog.variants.push({ ...source.variant, id: crypto.randomUUID(), name: 'Botol 1,5 L', quantityInBaseUnit: 1500, sku: undefined, barcode: undefined })
  const f = await setup(source), ui = await mount(f)
  try {
    await ui.add(0); await ui.add(1); await ui.pay(); await confirm(); await ui.success()
    assert.equal(await f.db.saleItems.count(), 2); assert.equal(await f.db.stockMovements.where('saleId').above('').count(), 2)
    assert.equal((await f.db.inventoryBalances.get(f.product.id))!.quantityBase, 97500)
  } finally { await ui.unmount() }
})
test('UI QRIS DEMO tetap dinonaktifkan: tidak menyiapkan intent/Sale atau mengubah stok', async () => {
  const f = await setup(), ui = await mount(f)
  try {
    await ui.add()
    assert.equal(button('QRIS DEMO').disabled, true); await click('QRIS DEMO')
    assert.equal(button('Bon').disabled, false) // Real BON now has its own integration/DOM tests.
    assert.equal(await f.db.checkoutIntents.count(), 0); assert.equal(await f.db.sales.count(), 0)
    assert.equal(await f.db.stockMovements.count(), 1); assert.equal((await f.db.inventoryBalances.get(f.product.id))!.quantityBase, 100000)
  } finally { await ui.unmount() }
})
test('UI keranjang baru tidak dihapus ketika recovery intent lama sukses', async () => {
  const f = await setup(), command = await makeCommand(f); await f.service.prepare(command)
  browserCheckoutSession.write({ active: command, lastId: null }); const ui = await mount(f)
  try {
    await act(async () => ui.store.setCart([{ variantId: f.variant.id, quantity: 3 }]))
    await click('Lanjutkan request yang sama'); await ui.success()
    assert.equal(ui.store.cart[0].quantity, 3); assert.equal(await f.db.sales.count(), 1)
  } finally { await ui.unmount() }
})
test('UI penyelesaian async intent aktif menjaga cart baru berdasarkan identitas array', async () => {
  const f = await setup(), client = delegate(f.service)
  let release: () => void = () => {}; const gate = new Promise<void>((resolve) => { release = resolve })
  client.execute = async (command) => { await gate; return f.service.execute(command) }
  const ui = await mount(f, client)
  try {
    await ui.add(); await ui.pay(); await confirm(); await wait(() => ui.store.checkoutController.getSnapshot().status === 'processing')
    await act(async () => ui.store.setCart([{ variantId: f.variant.id, quantity: 1 }])) // Same content, different ownership.
    await act(async () => release()); await ui.success(); assert.equal(ui.store.cart.length, 1)
  } finally { release(); await ui.unmount() }
})
test('UI struk tersimpan tidak berubah setelah harga/nama master diedit', async () => {
  const f = await setup(), ui = await mount(f)
  try {
    await ui.add(); await ui.pay(); await confirm(); await ui.success()
    const receipt = browser.document.querySelector('[aria-label="Struk penjualan tersimpan"]')!.textContent
    await click('Tutup struk')
    await act(async () => { await f.db.products.update(f.product.id, { name: 'Nama baru' }); await f.db.variants.update(f.variant.id, { sellingPrice: 99000, name: 'Varian baru' }) })
    await click('Buka struk terakhir'); await ui.success()
    assert.equal(browser.document.querySelector('[aria-label="Struk penjualan tersimpan"]')!.textContent, receipt)
  } finally { await ui.unmount() }
})
test('UI storage penunjuk tidak bisa ditulis: tidak prepare/execute dan tidak UUID pengganti', async () => {
  const f = await setup(), session: CheckoutSessionStore = { read: () => ({ active: null, lastId: null }), write: () => { throw new Error('Storage denied') } }
  const ui = await mount(f, f.service, session)
  try {
    await ui.add(); await ui.pay(); await confirm(); await wait(() => ui.store.checkoutController.getSnapshot().status === 'uncertain')
    const id = ui.store.checkoutController.getSnapshot().command!.checkoutOperationId
    assert.equal(await f.db.checkoutIntents.count(), 0); assert.equal(await f.db.sales.count(), 0)
    await click('Periksa hasil transaksi'); await wait(() => !ui.store.checkoutController.getSnapshot().busy)
    await click('Lanjutkan request yang sama'); assert.equal(ui.store.checkoutController.getSnapshot().command!.checkoutOperationId, id)
    assert.equal(await f.db.sales.count(), 0)
  } finally { await ui.unmount() }
})
test('UI journal rusak/DB startup gagal: blok checkout dan jangan hilangkan pointer', async () => {
  const f = await setup()
  for (const raw of ['{broken', JSON.stringify({ active: { checkoutOperationId: 'invalid' }, lastId: null }), JSON.stringify({ active: null, lastId: 'invalid' })]) {
    browser.sessionStorage.setItem(CHECKOUT_SESSION_KEY, raw)
    const ui = await mount(f)
    try {
      assert.equal(ui.store.checkoutController.getSnapshot().status, 'uncertain')
      assert.equal(browser.document.querySelector<HTMLButtonElement>('.product-add')!.disabled, true)
      assert.equal(browser.sessionStorage.getItem(CHECKOUT_SESSION_KEY), raw)
      assert.equal(await f.db.sales.count(), 0)
    } finally { await ui.unmount() }
  }
})

test('UI startup DB tidak terbaca: uncertain, retry baca tanpa autoexecute', async () => {
  const f = await setup(), client = delegate(f.service)
  let available = false
  client.listUnresolved = async () => { if (!available) throw new Error('DB temporarily unavailable'); return f.service.listUnresolved() }
  const ui = await mount(f, client)
  try {
    assert.equal(ui.store.checkoutController.getSnapshot().status, 'uncertain')
    assert.equal(browser.document.querySelector<HTMLButtonElement>('.product-add')!.disabled, true)
    available = true; await click('Periksa hasil transaksi'); await wait(() => ui.store.checkoutController.getSnapshot().ready)
    await act(async () => browser.document.querySelector<HTMLButtonElement>('[aria-label="Tutup dialog"]')!.click())
    await ui.add(); assert.equal(ui.store.cart.length, 1); assert.equal(await f.db.sales.count(), 0)
  } finally { await ui.unmount() }
})
test('UI journal ditulis sebelum prepare, payload dibekukan dan perubahan cart UI diblokir', async () => {
  const f = await setup(), client = delegate(f.service)
  let release: () => void = () => {}; const gate = new Promise<void>((resolve) => { release = resolve })
  client.prepare = async (command) => {
    assert.equal(browserCheckoutSession.read().active!.checkoutOperationId, command.checkoutOperationId)
    assert.ok(Object.isFrozen(command)); assert.ok(Object.isFrozen(command.lines[0].expected))
    await gate; return f.service.prepare(command)
  }
  const ui = await mount(f, client)
  try {
    await ui.add(); await ui.pay(); await confirm(); await wait(() => ui.store.checkoutController.getSnapshot().status === 'preparing')
    assert.equal(browser.document.querySelector<HTMLButtonElement>('.product-add')!.disabled, true)
    assert.equal(button('Kosongkan').disabled, true)
    await act(async () => browser.document.querySelector<HTMLButtonElement>('[aria-label="Tutup dialog"]')!.click())
    assert.ok(browser.document.querySelector('dialog')); assert.equal(ui.store.cart.length, 1)
    await act(async () => release()); await ui.success()
  } finally { release(); await ui.unmount() }
})
test('UI varian hilang dari projection tetap tampak sebagai baris invalid dengan alasan', async () => {
  const f = await setup(), ui = await mount(f)
  try {
    await ui.add()
    await act(async () => { await f.db.variants.update(f.variant.id, { quantityInBaseUnit: 500 }) }) // Invalid discrete conversion.
    await wait(() => text().includes('Varian tidak tersedia'))
    assert.equal(ui.store.cart.length, 1); assert.match(text(), /Periksa master atau hapus baris ini/)
    const pay = [...browser.document.querySelectorAll<HTMLButtonElement>('.cart-panel button')].find((b) => b.textContent?.startsWith('Bayar '))!
    assert.equal(pay.disabled, true); assert.equal(await f.db.sales.count(), 0)
  } finally { await ui.unmount() }
})
test('UI variable kurang dari satu Liter dan presisi invalid: jumlah kecil sah, empat desimal ditolak', async () => {
  const source = checkoutFixture(); source.balances[0].quantityBase = 500
  const f = await setup(source), ui = await mount(f)
  try {
    assert.equal(browser.document.querySelector<HTMLButtonElement>('.product-add')!.disabled, false)
    await ui.add(); await input('#variable-quantity', '0,1234'); assert.equal(button('Simpan jumlah').disabled, true)
    await input('#variable-quantity', '0,5'); await click('Simpan jumlah'); await ui.pay(); await confirm(); await ui.success()
    assert.equal((await f.db.saleItems.toArray())[0].quantity, 500); assert.equal((await f.db.inventoryBalances.get(f.product.id))!.quantityBase, 0)
  } finally { await ui.unmount() }
})
test('UI refresh sesudah struk ditutup: lastId menemukan snapshot lama tanpa intent aktif', async () => {
  const f = await setup(); let ui = await mount(f)
  try {
    await ui.add(); await ui.pay(); await confirm(); await ui.success()
    const id = ui.store.checkoutController.getSnapshot().result!.sale.id
    await click('Tutup struk'); assert.equal(browserCheckoutSession.read().active, null)
    await ui.unmount(); ui = await mount(f); await ui.success()
    assert.equal(ui.store.checkoutController.getSnapshot().result!.sale.id, id); assert.equal(await f.db.sales.count(), 1)
  } finally { await ui.unmount() }
})

test('UI tutup tab sesudah commit tanpa respons: jurnal durable menemukan Sale lama di tab baru', async () => {
  const f = await setup(), command = await makeCommand(f)
  browserCheckoutSession.write({ active: command, lastId: null })
  await f.service.prepare(command); const result = await f.service.execute(command)
  browser.sessionStorage.clear() // Closing the original tab loses its session pointer.
  assert.ok(browser.localStorage.getItem(`${CHECKOUT_RECOVERY_PREFIX}${command.checkoutOperationId}`))
  const ui = await mount(f)
  try {
    const recover = [...browser.document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.startsWith('Pulihkan intent'))!
    assert.ok(recover); await act(async () => recover.click()); await ui.success()
    assert.equal(ui.store.checkoutController.getSnapshot().result!.sale.id, result.sale.id)
    assert.equal(await f.db.sales.count(), 1); assert.equal(browser.localStorage.getItem(`${CHECKOUT_RECOVERY_PREFIX}${command.checkoutOperationId}`), null)
  } finally { await ui.unmount() }
})
test('UI tab baru membuka struk terakhir sesudah pointer session hilang', async () => {
  const f = await setup(); let ui = await mount(f)
  try {
    await ui.add(); await ui.pay(); await confirm(); await ui.success()
    const id = ui.store.checkoutController.getSnapshot().result!.sale.checkoutOperationId
    assert.equal(browser.localStorage.getItem(LAST_RECEIPT_KEY), id)
    await ui.unmount(); browser.sessionStorage.clear(); ui = await mount(f); await ui.success()
    assert.equal(ui.store.checkoutController.getSnapshot().result!.sale.checkoutOperationId, id)
    assert.equal(await f.db.sales.count(), 1)
  } finally { await ui.unmount() }
})

test('UI cancel jurnal sebelum prepare: simpan CANCELLED agar tab lain tidak bisa menyiapkan ID lama', async () => {
  const f = await setup(), command = await makeCommand(f)
  browserCheckoutSession.write({ active: command, lastId: null })
  const ui = await mount(f)
  try {
    await wait(() => text().includes('Lanjutkan request yang sama'))
    await click('Batalkan intent untuk koreksi'); await wait(() => !ui.store.checkoutController.getSnapshot().command)
    assert.equal((await f.db.checkoutIntents.get(command.checkoutOperationId))!.status, 'CANCELLED')
    await assert.rejects(f.service.prepare(command), (cause: unknown) => cause instanceof CheckoutError && cause.code === 'INTENT_CANCELLED')
    assert.equal(await f.db.sales.count(), 0)
    assert.equal(browser.localStorage.getItem(`${CHECKOUT_RECOVERY_PREFIX}${command.checkoutOperationId}`), null)
  } finally { await ui.unmount() }
})

test('UI HTTP LAN: UUID memakai getRandomValues ketika randomUUID tidak tersedia', async () => {
  const f = await setup(), ui = await mount(f), original = Object.getOwnPropertyDescriptor(globalThis, 'crypto')!
  const nativeCrypto = globalThis.crypto
  try {
    await ui.add(); await ui.pay()
    Object.defineProperty(globalThis, 'crypto', { value: { getRandomValues: (bytes: Uint8Array<ArrayBuffer>) => nativeCrypto.getRandomValues(bytes) }, configurable: true })
    await confirm(); await ui.success()
    const id = (await f.db.sales.toArray())[0].checkoutOperationId
    assert.match(id, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i)
  } finally { Object.defineProperty(globalThis, 'crypto', original); await ui.unmount() }
})
