import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { ZannaDatabase } from '../src/data/database'
import { DexieCheckoutRepository } from '../src/data/dexieCheckoutRepository'
import { CheckoutService } from '../src/services/checkoutOperations'
import { DexieInventoryRepository } from '../src/data/dexieInventoryRepository'
import { InventoryService } from '../src/services/inventoryOperations'
import { CheckoutError, type CheckoutCommand, type CheckoutErrorCode, type CheckoutSelection } from '../src/domain/checkout'
import type { SaleItem } from '../src/domain/sale'
import type { StockMovement } from '../src/domain/inventory'
import { copyCheckoutCommand } from '../src/domain/checkoutRequest'
import { validateSale } from '../src/domain/saleRules'
import { checkoutFixture, commandFixture } from './checkout-fixtures'

const connections: ZannaDatabase[] = []
after(async () => {
  for (const db of connections) db.close()
  for (const name of new Set(connections.map((db) => db.name))) await new ZannaDatabase(name).delete()
})
const code = (expected: CheckoutErrorCode) => (cause: unknown) => cause instanceof CheckoutError && cause.code === expected
function connect(name: string) {
  const db = new ZannaDatabase(name); connections.push(db)
  const repository = new DexieCheckoutRepository(db), service = new CheckoutService(repository)
  const inventory = new InventoryService(new DexieInventoryRepository(db))
  return { db, repository, service, inventory }
}
async function setup(f = checkoutFixture(), initialize = true) {
  const connection = connect(`checkout-service-test-${crypto.randomUUID()}`), { db, inventory } = connection
  await db.transaction('rw', [db.products, db.categories, db.variants, db.units], async () => {
    await db.units.bulkAdd(f.catalog.units); await db.categories.bulkAdd(f.catalog.categories)
    await db.products.bulkAdd(f.catalog.products); await db.variants.bulkAdd(f.catalog.variants)
  })
  if (initialize) for (const product of f.catalog.products) await inventory.execute({ operationId: crypto.randomUUID(),
    productId: product.id, movementType: 'OPENING_BALANCE', inputUnitId: product.baseUnitId,
    inputQuantity: f.balances.find((balance) => balance.productId === product.id)!.quantityBase, reason: 'Stok awal fixture tes' })
  return { ...f, ...connection }
}
type Fixture = Awaited<ReturnType<typeof setup>>
async function request(f: Fixture, selections: readonly CheckoutSelection[] = [{ variantId: f.variant.id, quantity: 1500 }], cashReceived = 200000) {
  const quote = await f.service.preview(selections)
  const command: CheckoutCommand = { payloadVersion: 1, checkoutOperationId: crypto.randomUUID(), paymentMethod: 'CASH',
    lines: quote.lines, expectedTotal: quote.total, cashReceived }
  return command
}
async function snapshot(db: ZannaDatabase) {
  return Object.fromEntries(await Promise.all(db.tables.map(async (table) => [table.name, await table.toArray()])))
}
async function remaining(f: Fixture) { return (await f.db.inventoryBalances.get(f.product.id))!.quantityBase }
async function saleMovements(f: Fixture) { return (await f.db.stockMovements.toArray()).filter((record) => record.movementType === 'SALE') }
function multipleProducts() {
  const solar = checkoutFixture(), noodles = checkoutFixture('bungkus', 'fixed')
  noodles.product.categoryId = solar.product.categoryId; noodles.product.name = 'Mi instan'; noodles.variant.sellingPrice = 3500
  solar.catalog.products.push(noodles.product); solar.catalog.variants.push(noodles.variant); solar.balances.push(noodles.balances[0])
  return solar
}
function sharedFuel() {
  const f = checkoutFixture('l', 'fixed'); f.product.name = 'Bensin'
  f.variant.sellingUnitId = f.unit('botol').id; f.variant.name = 'Botol 1 L'
  for (const factor of [1500, 5000]) f.catalog.variants.push({ ...f.variant, id: crypto.randomUUID(), name: `Botol ${factor / 1000} L`, quantityInBaseUnit: factor, sku: undefined, barcode: undefined })
  return f
}

test('service preview tanpa write; prepare persisten/idempoten dan execute wajib intent', async () => {
  const f = await setup(), before = await snapshot(f.db)
  const command = await request(f)
  assert.deepEqual(await snapshot(f.db), before)
  await assert.rejects(f.service.execute(command), code('INTENT_REQUIRED'))
  const prepared = await f.service.prepare(command), repeated = await f.service.prepare(command)
  assert.deepEqual(prepared, repeated); assert.equal(prepared.status, 'PREPARED')
  assert.equal(await f.db.checkoutIntents.count(), 1); assert.equal(await f.db.sales.count(), 0)
  assert.equal(await remaining(f), 100000); assert.equal((await saleMovements(f)).length, 0)
  assert.equal(await f.service.getResult(command.checkoutOperationId), null)
})

test('execute Solar 1,5 L x Rp13.000: satu commit, tunai Rp20.000, kembalian Rp500, snapshot/ledger utuh', async () => {
  const f = await setup(), command = await request(f, undefined, 20000)
  const masters = await f.db.products.toArray(), before = (await f.db.inventoryBalances.get(f.product.id))!
  await f.service.prepare(command)
  const result = await f.service.execute(command)
  validateSale(result.sale, result.items)
  assert.equal(result.duplicate, false); assert.equal(result.sale.total, 19500); assert.equal(result.sale.changeAmount, 500)
  assert.equal(result.sale.operatorId, null); assert.equal(result.items[0].productNameSnapshot, 'Solar')
  assert.equal(result.items[0].quantity, 1500); assert.equal(result.items[0].quantityBase, 1500)
  assert.equal(result.items[0].unitSnapshot.code, 'l'); assert.equal(result.items[0].unitPriceSnapshot, 13000)
  assert.equal(await remaining(f), 98500)
  const [movement] = await saleMovements(f)
  assert.equal(movement.saleId, result.sale.id); assert.equal(movement.saleItemId, result.items[0].id)
  assert.equal(movement.quantityBeforeBase, 100000); assert.equal(movement.quantityDeltaBase, -1500); assert.equal(movement.quantityAfterBase, 98500)
  assert.notEqual(movement.operationId, command.checkoutOperationId); assert.deepEqual(movement.conversionSnapshot, result.items[0].conversionSnapshot)
  assert.equal((await f.db.checkoutIntents.get(command.checkoutOperationId))?.status, 'COMMITTED')
  assert.equal((await f.db.inventoryBalances.get(f.product.id))?.initializedAt, before.initializedAt)
  assert.deepEqual(await f.db.products.toArray(), masters)
  assert.deepEqual((await f.service.getResult(command.checkoutOperationId))?.sale, result.sale)
})

test('beberapa produk: Sale tunggal, dua items/movement, saldo masing-masing dan total konsisten', async () => {
  const f = await setup(multipleProducts())
  const command = await request(f, [{ variantId: f.variant.id, quantity: 1500 }, { variantId: f.catalog.variants[1].id, quantity: 2000 }], 30000)
  await f.service.prepare(command); const result = await f.service.execute(command)
  assert.equal(result.items.length, 2); assert.equal(result.sale.total, 26500); assert.equal(result.sale.changeAmount, 3500)
  assert.equal(await f.db.sales.count(), 1); assert.equal(await f.db.saleItems.count(), 2)
  assert.equal(await remaining(f), 98500)
  assert.equal((await f.db.inventoryBalances.get(f.catalog.products[1].id))?.quantityBase, 98000)
  assert.equal(new Set((await saleMovements(f)).map((record) => record.operationId)).size, 2)
})

test('varian bensin 1/1,5/5 L berbagi saldo dan membentuk chain ledger sesuai urutan item', async () => {
  const source = sharedFuel(); source.balances[0].quantityBase = 10000
  const f = await setup(source), command = await request(f, f.catalog.variants.map((variant) => ({ variantId: variant.id, quantity: 1000 })))
  await f.service.prepare(command); const result = await f.service.execute(command)
  const records = (await saleMovements(f)).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  assert.deepEqual(records.map((record) => [record.quantityBeforeBase, record.quantityDeltaBase, record.quantityAfterBase]), [[10000, -1000, 9000], [9000, -1500, 7500], [7500, -5000, 2500]])
  assert.equal(await remaining(f), 2500)
  assert.deepEqual(result.items.map((item) => item.conversionSnapshot.quantityInBaseUnit), [1000, 1500, 5000])
})

test('harga HALF_UP per baris tersimpan; Rp0 eksplisit sah; quantityBase tidak dibulatkan', async () => {
  const source = checkoutFixture(); source.variant.sellingPrice = 12500
  const f = await setup(source), command = await request(f, [{ variantId: f.variant.id, quantity: 1 }])
  await f.service.prepare(command); const result = await f.service.execute(command)
  assert.equal(result.sale.total, 13); assert.equal(result.items[0].quantityBase, 1); assert.equal(await remaining(f), 99999)
  await f.db.variants.update(f.variant.id, { sellingPrice: 0 })
  const free = await request(f, [{ variantId: f.variant.id, quantity: 1000 }], 0)
  await f.service.prepare(free); assert.equal((await f.service.execute(free)).sale.total, 0)
})

test('boundary service/repository menolak request invalid dan uang kurang tanpa intent/bisnis baru', async () => {
  const f = await setup(), command = await request(f), before = await snapshot(f.db)
  await assert.rejects(f.service.preview([]), code('INVALID_REQUEST'))
  for (const invalid of [{ ...command, lines: [] }, { ...command, paymentMethod: 'QRIS' }, { ...command, paymentMethod: 'Bon' }, { ...command, cashReceived: 0.5 }]) {
    await assert.rejects(f.service.prepare(invalid as CheckoutCommand), code('INVALID_REQUEST'))
    await assert.rejects(f.repository.commit(invalid as CheckoutCommand), code('INVALID_REQUEST'))
  }
  await assert.rejects(f.service.prepare({ ...command, cashReceived: 1 }), code('CASH_INSUFFICIENT'))
  assert.deepEqual(await snapshot(f.db), before)
})

for (const target of ['product', 'variant', 'category', 'price', 'policy'] as const) test(`execute menolak master ${target} tidak valid setelah prepare, tanpa efek parsial`, async () => {
  const f = await setup(), command = await request(f); await f.service.prepare(command)
  if (target === 'product') await f.db.products.update(f.product.id, { isActive: false })
  if (target === 'variant') await f.db.variants.update(f.variant.id, { isActive: false })
  if (target === 'category') await f.db.categories.update(f.product.categoryId, { isActive: false })
  if (target === 'price') await f.db.variants.update(f.variant.id, { sellingPrice: null })
  if (target === 'policy') await f.db.products.update(f.product.id, { unitPolicy: { kind: 'fuel', allowedPackagingUnitIds: [f.unit('sachet').id] } })
  const before = await snapshot(f.db)
  await assert.rejects(f.service.execute(command), code(target === 'price' ? 'INVALID_REQUEST' : target === 'policy' ? 'POLICY_REVIEW_REQUIRED' : 'PRODUCT_UNAVAILABLE'))
  assert.deepEqual(await snapshot(f.db), before)
})

for (const target of ['price', 'factor', 'mode', 'metadata'] as const) test(`perubahan expected ${target} memberi QUOTE_CHANGED sebelum kalkulasi/penulisan`, async () => {
  const f = await setup(), command = await request(f); await f.service.prepare(command)
  if (target === 'price') await f.db.variants.update(f.variant.id, { sellingPrice: 14000 })
  if (target === 'factor') await f.db.variants.update(f.variant.id, { quantityInBaseUnit: 1500 })
  if (target === 'mode') await f.db.variants.update(f.variant.id, { saleMode: 'fixed' })
  if (target === 'metadata') await f.db.products.update(f.product.id, { updatedAt: '2026-10-21T02:00:00.000Z' })
  const before = await snapshot(f.db)
  await assert.rejects(f.service.execute(command), code('QUOTE_CHANGED'))
  assert.deepEqual(await snapshot(f.db), before)
})

test('BBM Sachet tidak dapat diselundupkan lewat command yang expected-nya mengikuti master invalid', async () => {
  const f = await setup(), valid = await request(f)
  await f.db.variants.update(f.variant.id, { sellingUnitId: f.unit('sachet').id, quantityInBaseUnit: 12000, saleMode: 'fixed' })
  const command: CheckoutCommand = { ...valid, lines: [{ ...valid.lines[0], quantity: 10000, expected: { ...valid.lines[0].expected, sellingUnitId: f.unit('sachet').id, quantityInBaseUnit: 12000, saleMode: 'fixed' } }], expectedTotal: 130000 }
  await f.service.prepare(command); const before = await snapshot(f.db)
  await assert.rejects(f.service.execute(command), /tidak diizinkan/)
  assert.deepEqual(await snapshot(f.db), before)
})

test('stok belum diinisialisasi/berkurang dan kebutuhan gabungan berlebih ditolak seluruhnya', async () => {
  const uninitialized = await setup(checkoutFixture(), false), missingCommand = commandFixture(uninitialized).command
  await uninitialized.service.prepare(missingCommand)
  await assert.rejects(uninitialized.service.execute(missingCommand), code('STOCK_NOT_INITIALIZED'))
  assert.equal(await uninitialized.db.sales.count(), 0)
  const f = await setup(sharedFuel())
  const command = await request(f, [{ variantId: f.catalog.variants[2].id, quantity: 2000 }, { variantId: f.variant.id, quantity: 1000 }]) // 11 L.
  await f.service.prepare(command)
  await f.inventory.execute({ operationId: crypto.randomUUID(), productId: f.product.id, movementType: 'ADJUSTMENT_OUT', inputQuantity: 90000, inputUnitId: f.product.baseUnitId, reason: 'Sisa fisik 10 L' })
  const before = await snapshot(f.db)
  await assert.rejects(f.service.execute(command), code('INSUFFICIENT_STOCK'))
  assert.deepEqual(await snapshot(f.db), before)
})

test('ID sama payload berbeda ditolak saat prepare dan setelah commit; replay mengembalikan hasil lama', async () => {
  const f = await setup(), command = await request(f); await f.service.prepare(command)
  const mismatch = { ...command, cashReceived: command.cashReceived + 1 }
  await assert.rejects(f.service.prepare(mismatch), code('OPERATION_PAYLOAD_MISMATCH'))
  await assert.rejects(f.service.execute(mismatch), code('OPERATION_PAYLOAD_MISMATCH'))
  const first = await f.service.execute(command), before = await snapshot(f.db)
  await assert.rejects(f.service.execute(mismatch), code('OPERATION_PAYLOAD_MISMATCH'))
  const replay = await f.service.execute(command)
  assert.equal((await f.service.prepare(command)).status, 'COMMITTED')
  assert.equal(replay.duplicate, true); assert.deepEqual(replay.sale, first.sale); assert.deepEqual(replay.items, first.items)
  assert.deepEqual(await snapshot(f.db), before)
})

test('cancel persisten/idempoten, CANCELLED tidak bisa prepare/execute; ID tidak ditemukan jelas', async () => {
  const f = await setup(), command = await request(f); await f.service.prepare(command)
  assert.equal((await f.service.cancel(command.checkoutOperationId)).status, 'CANCELLED')
  assert.equal((await f.service.cancel(command.checkoutOperationId)).status, 'CANCELLED')
  await assert.rejects(f.service.execute(command), code('INTENT_CANCELLED'))
  await assert.rejects(f.service.prepare(command), code('INTENT_CANCELLED'))
  await assert.rejects(f.service.cancel(crypto.randomUUID()), code('INTENT_REQUIRED'))
  assert.equal(await f.service.getResult(crypto.randomUUID()), null)
  assert.equal(await remaining(f), 100000)
})

for (const failure of ['item2', 'movement', 'balance', 'intent'] as const) test(`atomic rollback saat penulisan ${failure} gagal: semua sembilan tabel sama dengan sebelum execute`, async () => {
  const f = await setup(multipleProducts()), command = await request(f, f.catalog.variants.map((variant) => ({ variantId: variant.id, quantity: 1000 })))
  await f.service.prepare(command); const before = await snapshot(f.db)
  const failItem = (_key: unknown, item: SaleItem) => { if (item.position === 2) throw new Error('Forced item 2 failure') }
  const failMovement = (_key: unknown, record: StockMovement) => { if (record.movementType === 'SALE') throw new Error('Forced movement failure') }
  const failUpdate = () => { throw new Error('Forced update failure') }
  if (failure === 'item2') f.db.saleItems.hook('creating', failItem)
  if (failure === 'movement') f.db.stockMovements.hook('creating', failMovement)
  if (failure === 'balance') f.db.inventoryBalances.hook('updating', failUpdate)
  if (failure === 'intent') f.db.checkoutIntents.hook('updating', failUpdate)
  try { await assert.rejects(f.service.execute(command), code('STORAGE_ERROR')) }
  finally {
    f.db.saleItems.hook('creating').unsubscribe(failItem); f.db.stockMovements.hook('creating').unsubscribe(failMovement)
    f.db.inventoryBalances.hook('updating').unsubscribe(failUpdate); f.db.checkoutIntents.hook('updating').unsubscribe(failUpdate)
  }
  assert.deepEqual(await snapshot(f.db), before)
  assert.equal((await f.db.checkoutIntents.get(command.checkoutOperationId))?.status, 'PREPARED')
  assert.equal(await f.service.getResult(command.checkoutOperationId), null)
  assert.equal((await f.service.execute(command)).duplicate, false)
})

test('dua koneksi prepare/execute ID sama: satu Sale, satu pengurangan, satu hasil duplicate', async () => {
  const f = await setup(), other = connect(f.db.name), command = await request(f)
  await Promise.all([f.service.prepare(command), other.service.prepare(command)])
  const results = await Promise.all([f.service.execute(command), other.service.execute(command)])
  assert.deepEqual(results.map((result) => result.duplicate).sort(), [false, true])
  assert.equal(results[0].sale.id, results[1].sale.id); assert.equal(await f.db.sales.count(), 1)
  assert.equal((await saleMovements(f)).length, 1); assert.equal(await remaining(f), 98500)
})

test('dua intent bersamaan menjual 4 L dari 5 L: hanya satu berhasil, tanpa stok negatif', async () => {
  const source = checkoutFixture(); source.balances[0].quantityBase = 5000
  const f = await setup(source), other = connect(f.db.name), first = await request(f, [{ variantId: f.variant.id, quantity: 4000 }]), second = { ...first, checkoutOperationId: crypto.randomUUID() }
  await Promise.all([f.service.prepare(first), other.service.prepare(second)])
  const results = await Promise.allSettled([f.service.execute(first), other.service.execute(second)])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  const rejected = results.find((result) => result.status === 'rejected')!
  assert.equal(rejected.status === 'rejected' && code('INSUFFICIENT_STOCK')(rejected.reason), true)
  assert.equal(await remaining(f), 1000); assert.equal(await f.db.sales.count(), 1)
  assert.equal((await f.service.listUnresolved()).length, 1)
})

test('checkout versus koreksi stok bersamaan memakai saldo serial, tidak lost update', async () => {
  const source = checkoutFixture(); source.balances[0].quantityBase = 5000
  const f = await setup(source), other = connect(f.db.name), command = await request(f, [{ variantId: f.variant.id, quantity: 4000 }])
  await f.service.prepare(command)
  const results = await Promise.allSettled([f.service.execute(command), other.inventory.execute({ operationId: crypto.randomUUID(), productId: f.product.id, movementType: 'ADJUSTMENT_OUT', inputUnitId: f.product.baseUnitId, inputQuantity: 3000, reason: 'Uji koreksi bersamaan' })])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(await remaining(f), results[0].status === 'fulfilled' ? 1000 : 2000)
  const records = await f.db.stockMovements.toArray()
  assert.equal(records.length, 2); assert.equal(records.reduce((total, record) => total + record.quantityDeltaBase, 0), await remaining(f))
})

test('checkout versus edit master bersamaan: commit snapshot lama atau QUOTE_CHANGED, tidak harga campuran', async () => {
  const f = await setup(), other = connect(f.db.name), command = await request(f); await f.service.prepare(command)
  const results = await Promise.allSettled([f.service.execute(command), other.db.transaction('rw', [other.db.products, other.db.variants], async () => {
    await other.db.variants.update(f.variant.id, { sellingPrice: 16000, updatedAt: '2026-10-21T03:00:00.000Z' })
  })])
  assert.equal(results[1].status, 'fulfilled')
  if (results[0].status === 'fulfilled') { assert.equal(results[0].value.sale.total, 19500); assert.equal(await remaining(f), 98500) }
  else { assert.equal(code('QUOTE_CHANGED')(results[0].reason), true); assert.equal(await remaining(f), 100000) }
})

test('cancel versus execute bersamaan hanya menghasilkan CANCELLED atau COMMITTED yang konsisten', async () => {
  const f = await setup(), other = connect(f.db.name), command = await request(f); await f.service.prepare(command)
  const [execution, cancellation] = await Promise.allSettled([f.service.execute(command), other.service.cancel(command.checkoutOperationId)])
  assert.equal(cancellation.status, 'fulfilled')
  if (cancellation.status !== 'fulfilled') return
  if (cancellation.value.status === 'COMMITTED') {
    assert.equal(execution.status, 'fulfilled'); assert.equal(await f.db.sales.count(), 1); assert.equal(await remaining(f), 98500)
    if (execution.status === 'fulfilled') assert.equal(cancellation.value.result.sale.id, execution.value.sale.id)
  } else {
    assert.equal(execution.status, 'rejected')
    if (execution.status === 'rejected') assert.equal(code('INTENT_CANCELLED')(execution.reason), true)
    assert.equal(await f.db.sales.count(), 0); assert.equal(await remaining(f), 100000)
  }
})

test('recovery prepare/reopen tidak auto-execute; commit/reopen/replay memakai snapshot lama setelah master berubah', async () => {
  const f = await setup(), command = await request(f); await f.service.prepare(command); f.db.close()
  const reopened = connect(f.db.name)
  const [pending] = await reopened.service.listUnresolved()
  assert.deepEqual(pending.command, command); assert.equal(await reopened.db.sales.count(), 0)
  const result = await reopened.service.execute(pending.command); reopened.db.close()
  const again = connect(f.db.name)
  await again.db.products.update(f.product.id, { name: 'Solar baru', isActive: false, unitPolicy: undefined })
  await again.db.variants.update(f.variant.id, { name: 'Varian baru', sellingPrice: null, quantityInBaseUnit: 9999, isActive: false })
  const stored = await again.service.getResult(command.checkoutOperationId), replay = await again.service.execute(command)
  assert.deepEqual(stored?.sale, result.sale); assert.deepEqual(stored?.items, result.items)
  assert.deepEqual(replay.items, result.items); assert.equal(replay.duplicate, true)
  assert.equal(await again.db.sales.count(), 1); assert.equal((await again.service.cancel(command.checkoutOperationId)).status, 'COMMITTED')
  assert.equal((await again.service.listUnresolved()).length, 0)
})

test('listUnresolved hanya PREPARED; getResult tidak menilai balance yang sah berubah setelah penjualan', async () => {
  const f = await setup(), first = await request(f), cancelled = { ...first, checkoutOperationId: crypto.randomUUID() }, pending = { ...first, checkoutOperationId: crypto.randomUUID() }
  await f.service.prepare(first); await f.service.prepare(cancelled); await f.service.prepare(pending)
  const result = await f.service.execute(first); await f.service.cancel(cancelled.checkoutOperationId)
  await f.inventory.execute({ operationId: crypto.randomUUID(), productId: f.product.id, movementType: 'STOCK_IN', inputUnitId: f.product.baseUnitId, inputQuantity: 10000, reason: 'Barang datang setelah penjualan' })
  assert.deepEqual((await f.service.listUnresolved()).map((entry) => entry.checkoutOperationId), [pending.checkoutOperationId])
  assert.deepEqual((await f.service.getResult(first.checkoutOperationId))?.items, result.items)
})

test('intent COMMITTED tanpa Sale ditolak seluruh operasi recovery; tidak ada Sale pengganti', async () => {
  const f = await setup(), command = await request(f), intent = await f.service.prepare(command)
  await f.db.checkoutIntents.put({ ...intent, status: 'COMMITTED', saleId: crypto.randomUUID() }) // Corruption fixture only.
  const before = await snapshot(f.db)
  for (const operation of [() => f.service.getResult(command.checkoutOperationId), () => f.service.execute(command), () => f.service.prepare(command), () => f.service.cancel(command.checkoutOperationId)]) await assert.rejects(operation(), code('INTEGRITY_ERROR'))
  assert.deepEqual(await snapshot(f.db), before)
})

for (const corruption of ['item', 'movement', 'intent'] as const) test(`hasil committed ${corruption} rusak tidak boleh direkonstruksi dari master atau dijual ulang`, async () => {
  const f = await setup(), command = await request(f); await f.service.prepare(command)
  const result = await f.service.execute(command)
  if (corruption === 'item') await f.db.saleItems.update(result.items[0].id, { lineTotal: 1 })
  if (corruption === 'movement') { const [record] = await saleMovements(f); await f.db.stockMovements.update(record.id, { quantityAfterBase: 1 }) }
  if (corruption === 'intent') await f.db.checkoutIntents.delete(command.checkoutOperationId)
  const before = await snapshot(f.db)
  await assert.rejects(f.service.getResult(command.checkoutOperationId), code('INTEGRITY_ERROR'))
  await assert.rejects(f.service.execute(command), code('INTEGRITY_ERROR'))
  assert.deepEqual(await snapshot(f.db), before)
})

test('deep copy di service dan repository melindungi request yang dimutasi selama promise berlangsung', async () => {
  const f = await setup(), original = structuredClone(await request(f)), expected = copyCheckoutCommand(original)
  const preparing = f.service.prepare(original)
  Reflect.set(original.lines[0].expected, 'unitPrice', 1); Reflect.set(original.lines[0], 'quantity', 1)
  assert.deepEqual((await preparing).command, expected)
  const mutable = structuredClone(expected), executing = f.repository.commit(mutable)
  Reflect.set(mutable.lines[0], 'quantity', 1)
  assert.equal((await executing).sale.total, 19500)
})

test('benturan receiptNumber membatalkan intent kedua tanpa overwrite atau pengurangan kedua', async () => {
  const f = await setup(), first = await request(f); await f.service.prepare(first)
  const result = await f.service.execute(first), second = { ...first, checkoutOperationId: crypto.randomUUID() }
  await f.service.prepare(second); const before = await snapshot(f.db)
  const conflict = (_key: unknown, sale: { receiptNumber: string }) => { sale.receiptNumber = result.sale.receiptNumber }
  f.db.sales.hook('creating', conflict)
  try { await assert.rejects(f.service.execute(second), code('STORAGE_ERROR')) }
  finally { f.db.sales.hook('creating').unsubscribe(conflict) }
  assert.deepEqual(await snapshot(f.db), before)
})
