import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ZannaDatabase } from '../src/data/database'
import { DexieDashboardRepository } from '../src/data/dexieDashboardRepository'
import { DashboardService } from '../src/services/dashboardOperations'
import { dashboardWindow } from '../src/domain/dashboardRules'
import { historySale, historySnapshot } from './sales-history-fixtures'
import { DexieProductRepository } from '../src/data/dexieProductRepository'
import { InventoryService } from '../src/services/inventoryOperations'
import { DexieInventoryRepository } from '../src/data/dexieInventoryRepository'
import { CheckoutService } from '../src/services/checkoutOperations'
import { DexieCheckoutRepository } from '../src/data/dexieCheckoutRepository'
import { SalesHistoryService } from '../src/services/salesHistoryOperations'
import { DexieSalesHistoryRepository } from '../src/data/dexieSalesHistoryRepository'
import { projectCatalog } from '../src/services/catalogRepository'
import { cartSelections } from '../src/features/cashier/checkoutCart'
import { CheckoutError } from '../src/domain/checkout'

process.env.TZ = 'Asia/Singapore'
const now = new Date('2026-10-22T08:00:00.000Z')
function setup() {
  const db = new ZannaDatabase(`phase4-final-${crypto.randomUUID()}`)
  return { db, dashboard: new DashboardService(new DexieDashboardRepository(db)), products: new DexieProductRepository(db), inventory: new InventoryService(new DexieInventoryRepository(db)), checkout: new CheckoutService(new DexieCheckoutRepository(db)), history: new SalesHistoryService(new DexieSalesHistoryRepository(db)) }
}
test('Dashboard kosong: tujuh hari nol, tanpa angka DEMO atau write', async () => {
  const f = setup()
  try {
    const result = await f.dashboard.read(now), before = await historySnapshot(f.db)
    assert.deepEqual(result.today, { date: '2026-10-22', revenue: 0, transactions: 0, itemRows: 0 })
    assert.equal(result.days.length, 7); assert.equal(result.topProducts.length, 0); assert.equal(result.recent.length, 0)
    assert.deepEqual(await historySnapshot(f.db), before); assert.equal(f.db.verno, 5)
  } finally { await f.db.delete() }
})
test('Dashboard batas hari lokal, tujuh hari termasuk nol, recent dapat lebih tua dari periode', async () => {
  const f = setup()
  try {
    const old = await historySale(f.db, '2026-10-01T03:00:00.000Z')
    await historySale(f.db, '2026-10-21T15:59:59.999Z')
    const start = await historySale(f.db, '2026-10-21T16:00:00.000Z'), end = await historySale(f.db, '2026-10-22T15:59:59.999Z')
    await historySale(f.db, '2026-10-22T16:00:00.000Z')
    const result = await f.dashboard.read(now)
    assert.equal(result.today.transactions, 2); assert.equal(result.today.revenue, start.sale.total + end.sale.total)
    assert.equal(result.days[0].date, '2026-10-16'); assert.equal(result.days[0].revenue, 0)
    assert.equal(result.recent.length, 5); assert.equal(result.recent.at(-1)!.sale.id, old.sale.id)
  } finally { await f.db.delete() }
})
test('Dashboard kalender DST: tujuh hari lokal, bukan interval tetap 168 jam', () => {
  try {
    process.env.TZ = 'America/New_York'
    const range = dashboardWindow(new Date('2026-03-08T16:00:00Z'))
    assert.equal(range.days.length, 7); assert.equal(Date.parse(range.toExclusive) - Date.parse(range.fromInclusive), 167 * 3600000)
  } finally { process.env.TZ = 'Asia/Singapore' }
})
test('Dashboard menghitung baris, bukan quantity; snapshot tetap setelah edit/arsip master', async () => {
  const f = setup()
  try {
    const saved = await historySale(f.db, undefined, { multi: true }), before = await f.dashboard.read(now)
    assert.equal(before.today.itemRows, 2); assert.equal(before.today.revenue, 25500)
    assert.equal(before.topProducts.length, 1); assert.equal(before.topProducts[0].quantity, 2000)
    await f.db.products.update(saved.product.id, { name: 'Nama baru', isActive: false }); await f.db.variants.update(saved.variant.id, { sellingPrice: 99000 })
    const after = await f.dashboard.read(now)
    assert.deepEqual(after.today, before.today); assert.deepEqual(after.topProducts, before.topProducts)
  } finally { await f.db.delete() }
})
test('Dashboard produk nol/menipis/belum diatur berbeda; satu saldo per produk', async () => {
  const f = setup()
  try {
    const saved = await historySale(f.db, undefined, { multi: true })
    await f.db.products.update(saved.product.id, { minimumStock: 5000 }); await f.db.inventoryBalances.update(saved.product.id, { quantityBase: 1000 })
    let result = await f.dashboard.read(now); assert.equal(result.lowStock.length, 1); assert.equal(result.outOfStock.length, 0)
    await f.db.inventoryBalances.update(saved.product.id, { quantityBase: 0 }); result = await f.dashboard.read(now)
    assert.equal(result.lowStock.length, 0); assert.equal(result.outOfStock.length, 1)
    await f.db.inventoryBalances.delete(saved.product.id); result = await f.dashboard.read(now)
    assert.equal(result.uninitialized, 1); assert.equal(result.outOfStock.length, 0)
  } finally { await f.db.delete() }
})
test('Dashboard nama produk berubah antarpenjualan: agregat tetap satu produk/satuan, label snapshot terbaru', async () => {
  const f = setup()
  try {
    const saved = await historySale(f.db, new Date().toISOString())
    await f.db.products.update(saved.product.id, { name: 'Solar nama baru', updatedAt: new Date().toISOString() })
    const quote = await f.checkout.preview([{ variantId: saved.variant.id, quantity: 1500 }])
    const command = { ...saved.command, checkoutOperationId: crypto.randomUUID(), lines: quote.lines, expectedTotal: quote.total }
    await f.checkout.prepare(command); const sale = await f.checkout.execute(command)
    const result = await f.dashboard.read(new Date(sale.sale.createdAt))
    assert.equal(result.topProducts.length, 1); assert.equal(result.topProducts[0].revenue, 39000)
    assert.equal(result.topProducts[0].quantity, 3000); assert.equal(result.topProducts[0].name, 'Solar nama baru')
    assert.equal((await f.history.getDetail(saved.sale.id)).items[0].productNameSnapshot, 'Solar')
  } finally { await f.db.delete() }
})
test('Dashboard corrupt item/balance dan storage error tidak disamarkan sebagai nol', async () => {
  const f = setup()
  try {
    const saved = await historySale(f.db)
    await f.db.inventoryBalances.update(saved.product.id, { quantityBase: -1 })
    await assert.rejects(f.dashboard.read(now), (cause: unknown) => cause instanceof CheckoutError)
    await f.db.inventoryBalances.update(saved.product.id, { quantityBase: 1000 }); await f.db.saleItems.delete(saved.items[0].id)
    await assert.rejects(f.dashboard.read(now), (cause: unknown) => cause instanceof CheckoutError && cause.code === 'INTEGRITY_ERROR')
    f.db.close({ disableAutoOpen: true }); await assert.rejects(f.dashboard.read(now), (cause: unknown) => cause instanceof CheckoutError && cause.code === 'STORAGE_ERROR')
  } finally { await f.db.delete() }
})
test('Audit produk→inventory→cart→checkout→ledger→struk→history→Dashboard: BBM, kg dan bungkus', async () => {
  const f = setup()
  try {
    await f.products.initialize(); const category = await f.products.saveCategory('Audit Fase 4')
    const units = (await f.products.getSnapshot()).units, unit = (code: string) => units.find((entry) => entry.code === code)!.id
    const create = async (name: string, base: string, fuel: boolean, variants: { name: string; sellingUnitId: string; quantityInBaseUnit: number; sellingPrice: number; saleMode: 'fixed' | 'variable'; isActive: boolean }[], stock: number) => {
      const product = await f.products.saveProduct({ name, categoryId: category.id, baseUnitId: unit(base), unitPolicy: { kind: fuel ? 'fuel' : 'general', allowedPackagingUnitIds: fuel ? [unit('botol'), unit('jeriken')] : [] }, costPrice: null, costKnown: false, minimumStock: 2000, isActive: true, variants })
      await f.inventory.execute({ operationId: crypto.randomUUID(), productId: product.id, movementType: 'OPENING_BALANCE', inputQuantity: stock, inputUnitId: product.baseUnitId, reason: '' })
      return product
    }
    const variable = (name: string, code: string, price: number) => ({ name, sellingUnitId: unit(code), quantityInBaseUnit: 1000, sellingPrice: price, saleMode: 'variable' as const, isActive: true })
    const bensin = await create('Bensin', 'l', true, [{ ...variable('Botol 1 L', 'botol', 13000), saleMode: 'fixed' }, { ...variable('Botol 1,5 L', 'botol', 19500), quantityInBaseUnit: 1500, saleMode: 'fixed' }, variable('Liter', 'l', 13000)], 10000)
    const solar = await create('Solar', 'l', true, [variable('Liter', 'l', 13000)], 5000)
    const rice = await create('Beras', 'kg', false, [variable('Kilogram', 'kg', 12000)], 5000)
    const noodles = await create('Mi', 'bungkus', false, [{ ...variable('Standar', 'bungkus', 3500), saleMode: 'fixed' }], 10000)
    const catalog = await f.products.getSnapshot(), balances = await f.inventory.getBalances(), products = projectCatalog(catalog, balances)
    const cart = catalog.variants.map((variant) => ({ variantId: variant.id, quantity: variant.productId === bensin.id ? variant.saleMode === 'variable' ? 1.5 : 1 : variant.productId === noodles.id ? 2 : 0.5 }))
    const quote = await f.checkout.preview(cartSelections(cart, products))
    assert.equal(quote.total, 71500)
    const command = { payloadVersion: 1 as const, paymentMethod: 'CASH' as const, checkoutOperationId: crypto.randomUUID(), lines: quote.lines, expectedTotal: quote.total, cashReceived: 100000 }
    await f.checkout.prepare(command)
    const [a, b] = await Promise.all([f.checkout.execute(command), f.checkout.execute(command)])
    assert.equal(a.sale.id, b.sale.id); assert.equal(await f.db.sales.count(), 1); assert.equal(a.sale.changeAmount, 28500)
    assert.equal(await f.db.saleItems.count(), 6); assert.equal((await f.db.stockMovements.toArray()).filter((entry) => entry.movementType === 'SALE').length, 6)
    assert.equal((await f.db.inventoryBalances.get(bensin.id))!.quantityBase, 6000)
    assert.equal((await f.db.inventoryBalances.get(solar.id))!.quantityBase, 4500)
    assert.equal((await f.db.inventoryBalances.get(rice.id))!.quantityBase, 4500)
    const before = await historySnapshot(f.db), result = await f.dashboard.read(new Date(a.sale.createdAt))
    assert.equal(result.today.revenue, 71500); assert.equal(result.today.transactions, 1); assert.equal(result.today.itemRows, 6)
    assert.equal(result.topProducts.filter((entry) => entry.name === 'Bensin').length, 2) // Bottle and Liter never mixed.
    assert.deepEqual((await f.history.getDetail(a.sale.id)).sale, a.sale); await f.history.list()
    assert.deepEqual(await historySnapshot(f.db), before)
    await f.products.setProductActive(bensin.id, false, bensin.updatedAt)
    assert.deepEqual((await f.dashboard.read(new Date(a.sale.createdAt))).topProducts, result.topProducts)
    assert.deepEqual((await f.checkout.getResult(command.checkoutOperationId))!.items, a.items)
  } finally { await f.db.delete() }
})
test('Audit rollback tidak mengubah Dashboard/history/stok dan PREPARED bisa dipulihkan', async () => {
  const f = setup()
  const fault = () => { throw new Error('Injected ledger fault') }
  try {
    const saved = await historySale(f.db), command = { ...saved.command, checkoutOperationId: crypto.randomUUID() }
    await f.checkout.prepare(command)
    const before = await historySnapshot(f.db), oldDashboard = await f.dashboard.read(now)
    f.db.stockMovements.hook('creating', fault); await assert.rejects(f.checkout.execute(command)); f.db.stockMovements.hook('creating').unsubscribe(fault)
    assert.deepEqual(await historySnapshot(f.db), before); assert.deepEqual(await f.dashboard.read(now), oldDashboard)
    assert.ok((await f.checkout.listUnresolved()).some((intent) => intent.checkoutOperationId === command.checkoutOperationId))
    f.db.close(); await f.db.open(); assert.equal(await f.checkout.getResult(command.checkoutOperationId), null)
    const committed = await f.checkout.execute(command); assert.equal((await f.history.getDetail(committed.sale.id)).sale.id, committed.sale.id)
  } finally { f.db.stockMovements.hook('creating').unsubscribe(fault); await f.db.delete() }
})
test('Dashboard live subscription memperbarui omzet setelah checkout dan status stok setelah mutasi', async () => {
  const f = setup(); const saved = await historySale(f.db)
  const events: Awaited<ReturnType<DashboardService['read']>>[] = [], errors: unknown[] = []
  const stop = f.dashboard.subscribe(new Date(Date.now() + 86400000), (value) => events.push(value), (cause) => errors.push(cause))
  const wait = async (predicate: () => boolean) => { for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise((resolve) => setTimeout(resolve, 15)) }; assert.fail('Subscription tidak diperbarui') }
  try {
    await wait(() => events.length > 0)
    const command = { ...saved.command, checkoutOperationId: crypto.randomUUID() }; await f.checkout.prepare(command); await f.checkout.execute(command)
    await wait(() => events.at(-1)!.recent.length === 2)
    await f.inventory.execute({ operationId: crypto.randomUUID(), productId: saved.product.id, movementType: 'ADJUSTMENT_OUT', inputQuantity: (await f.db.inventoryBalances.get(saved.product.id))!.quantityBase, inputUnitId: saved.product.baseUnitId, reason: 'Audit stok habis' })
    await wait(() => events.at(-1)!.outOfStock.length === 1)
    assert.equal(errors.length, 0)
  } finally { stop(); await f.db.delete() }
})
