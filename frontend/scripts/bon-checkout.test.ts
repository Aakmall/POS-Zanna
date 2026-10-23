import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ZannaDatabase } from '../src/data/database'
import { DexieCheckoutRepository } from '../src/data/dexieCheckoutRepository'
import { CheckoutService } from '../src/services/checkoutOperations'
import { CheckoutError, type CheckoutErrorCode } from '../src/domain/checkout'
import { copyCheckoutCommand, checkoutFingerprint } from '../src/domain/checkoutRequest'
import { bonCommand, businessSnapshot, creditFixture } from './credit-fixtures'
import { checkoutFixture } from './checkout-fixtures'

const code = (expected: CheckoutErrorCode) => (cause: unknown) => cause instanceof CheckoutError && cause.code === expected
test('checkout Bon atomik: Sale/Item/SALE/saldo/tagihan/intent tersimpan tanpa uang tunai', async () => {
  const f = await creditFixture()
  try {
    const command = await bonCommand(f), before = await businessSnapshot(f.db)
    await f.checkout.prepare(command)
    assert.equal(await f.db.receivables.count(), 0)
    const result = await f.checkout.execute(command)
    assert.equal(result.sale.paymentMethod, 'BON'); assert.equal(result.sale.total, 19500); assert.equal(result.sale.cashReceived, 0); assert.equal(result.sale.changeAmount, 0)
    assert.equal(result.sale.customerSnapshot?.name, 'Bu Sari'); assert.equal(result.sale.dueDate, '2026-11-01')
    const debt = (await f.db.receivables.toArray())[0]
    assert.equal(debt.saleId, result.sale.id); assert.equal(debt.originalAmount, 19500); assert.equal(debt.balance, 19500); assert.equal(debt.status, 'UNPAID')
    assert.equal((await f.db.inventoryBalances.get(f.product.id))!.quantityBase, 98500)
    assert.equal(await f.db.creditPayments.count(), 0)
    assert.deepEqual(await f.db.products.toArray(), before.products)
    assert.equal((await f.db.checkoutIntents.get(command.checkoutOperationId))!.status, 'COMMITTED')
    assert.deepEqual((await f.checkout.getResult(command.checkoutOperationId))!.items, result.items)
  } finally { await f.db.delete() }
})
test('Bon dua varian stok bersama: harga/isi tepat dan satu saldo produk', async () => {
  const source = checkoutFixture('l', 'fixed')
  source.variant.sellingUnitId = source.unit('botol').id; source.variant.quantityInBaseUnit = 1500; source.variant.sellingPrice = 15000
  source.catalog.variants.push({ ...source.variant, id: crypto.randomUUID(), name: 'Jeriken 5 L', sellingUnitId: source.unit('jeriken').id, quantityInBaseUnit: 5000, sellingPrice: 50000, sku: undefined, barcode: undefined })
  const f = await creditFixture(source)
  try {
    const command = await bonCommand(f, source.catalog.variants.map((variant, index) => ({ variantId: variant.id, quantity: index ? 1000 : 2000 })))
    await f.checkout.prepare(command); const result = await f.checkout.execute(command)
    assert.equal(result.sale.total, 80000); assert.deepEqual(result.items.map((item) => item.quantityBase), [3000, 5000])
    assert.equal((await f.db.inventoryBalances.get(f.product.id))!.quantityBase, 92000)
    assert.equal((await f.db.receivables.toArray())[0].balance, 80000)
  } finally { await f.db.delete() }
})
for (const change of ['stock', 'inactive', 'price', 'factor', 'customer'] as const) test(`Bon menolak perubahan ${change} sebelum commit tanpa efek parsial`, async () => {
  const f = await creditFixture()
  try {
    const command = await bonCommand(f); await f.checkout.prepare(command)
    if (change === 'stock') await f.db.inventoryBalances.update(f.product.id, { quantityBase: 1000 })
    if (change === 'inactive') await f.customers.archive(f.customer, false)
    if (change === 'price') await f.db.variants.update(f.variant.id, { sellingPrice: 14000 })
    if (change === 'factor') await f.db.variants.update(f.variant.id, { quantityInBaseUnit: 2000 })
    if (change === 'customer') await f.customers.save({ ...f.customer, expectedUpdatedAt: f.customer.updatedAt, name: 'Nama berubah' })
    const before = await businessSnapshot(f.db)
    await assert.rejects(f.checkout.execute(command), code(change === 'stock' ? 'INSUFFICIENT_STOCK' : change === 'inactive' ? 'CUSTOMER_INACTIVE' : change === 'customer' ? 'CUSTOMER_CHANGED' : 'QUOTE_CHANGED'))
    assert.deepEqual(await businessSnapshot(f.db), before)
  } finally { await f.db.delete() }
})
for (const tableName of ['receivables', 'saleItems', 'stockMovements', 'inventoryBalances', 'checkoutIntents'] as const) test(`Bon rollback seluruh efek ketika write ${tableName} gagal`, async () => {
  const f = await creditFixture()
  try {
    const command = await bonCommand(f); await f.checkout.prepare(command)
    const before = await businessSnapshot(f.db), table = f.db.table(tableName)
    const fail = () => { throw new Error(`Fault injection ${tableName}`) }
    const hook = tableName === 'inventoryBalances' || tableName === 'checkoutIntents' ? 'updating' : 'creating'
    if (hook === 'updating') table.hook('updating', fail); else table.hook('creating', fail)
    try { await assert.rejects(f.checkout.execute(command), code('STORAGE_ERROR')) } finally { if (hook === 'updating') table.hook('updating').unsubscribe(fail); else table.hook('creating').unsubscribe(fail) }
    assert.deepEqual(await businessSnapshot(f.db), before)
  } finally { await f.db.delete() }
})
test('Bon double execute dan reopen menggunakan ID lama: satu Sale/tagihan, histori pelanggan immutable', async () => {
  const f = await creditFixture(), other = new ZannaDatabase(f.db.name), second = new CheckoutService(new DexieCheckoutRepository(other))
  try {
    const command = await bonCommand(f); await f.checkout.prepare(command)
    const results = await Promise.all([f.checkout.execute(command), second.execute(command)])
    assert.deepEqual(results.map((result) => result.duplicate).sort(), [false, true])
    assert.equal(await f.db.sales.count(), 1); assert.equal(await f.db.receivables.count(), 1)
    const before = await businessSnapshot(f.db)
    f.db.close(); await f.db.open()
    assert.equal((await f.checkout.getResult(command.checkoutOperationId))!.sale.id, results[0].sale.id)
    assert.deepEqual(await businessSnapshot(f.db), before)
    const archived = await f.customers.archive(f.customer, false)
    await f.customers.save({ ...archived, expectedUpdatedAt: archived.updatedAt, name: 'Nama baru' })
    const recovered = await second.execute(command)
    assert.equal(recovered.sale.customerSnapshot?.name, 'Bu Sari'); assert.equal((await f.db.receivables.toArray())[0].customerSnapshot.name, 'Bu Sari')
    assert.equal((await f.db.inventoryBalances.get(f.product.id))!.quantityBase, 98500)
    await assert.rejects(second.execute(copyCheckoutCommand({ ...command, dueDate: '2026-11-02' })), code('OPERATION_PAYLOAD_MISMATCH'))
  } finally { other.close(); await f.db.delete() }
})
test('Bon PREPARED dipulihkan setelah refresh tanpa autoexecute; cancel bersifat final', async () => {
  const f = await creditFixture()
  try {
    const command = await bonCommand(f); await f.checkout.prepare(command); f.db.close(); await f.db.open()
    assert.equal((await f.checkout.listUnresolved())[0].command.paymentMethod, 'BON')
    assert.equal(await f.db.sales.count(), 0); assert.equal(await f.db.receivables.count(), 0)
    await f.checkout.cancel(command.checkoutOperationId)
    await assert.rejects(f.checkout.execute(command), code('INTENT_CANCELLED'))
    assert.equal(await f.db.receivables.count(), 0)
  } finally { await f.db.delete() }
})
test('fingerprint CASH v1 tetap persis format lama; Bon mewajibkan pelanggan, total positif dan tanpa uang', async () => {
  const f = await creditFixture()
  try {
    const bon = await bonCommand(f), cash = copyCheckoutCommand({ ...bon, payloadVersion: 1, paymentMethod: 'CASH', cashReceived: bon.expectedTotal })
    const legacyParts = [1, 'CASH', cash.cashReceived, cash.expectedTotal, cash.lines.map((line) => [line.variantId, line.quantity, line.expected.productId, line.expected.baseUnitId, line.expected.sellingUnitId, line.expected.saleMode, line.expected.quantityInBaseUnit, line.expected.unitPrice, line.expected.productUpdatedAt, line.expected.variantUpdatedAt])]
    assert.equal(checkoutFingerprint(cash), JSON.stringify(legacyParts))
    for (const invalid of [{ ...bon, cashReceived: 1000 }, { ...bon, expectedTotal: 0 }, { ...bon, customer: null }, { ...bon, dueDate: '2026-02-30' }, { ...bon, paymentMethod: 'QRIS' }]) assert.throws(() => copyCheckoutCommand(invalid))
    assert.equal(await f.db.sales.count(), 0)
  } finally { await f.db.delete() }
})
test('Bon tanpa tagihan/mismatch snapshot ditolak pembaca, tidak diperbaiki diam-diam', async () => {
  const f = await creditFixture()
  try {
    const command = await bonCommand(f); await f.checkout.prepare(command); await f.checkout.execute(command)
    await f.db.receivables.clear() // Isolated corruption fixture only.
    const before = await businessSnapshot(f.db)
    await assert.rejects(f.checkout.getResult(command.checkoutOperationId), code('INTEGRITY_ERROR'))
    assert.deepEqual(await businessSnapshot(f.db), before)
  } finally { await f.db.delete() }
})
test('dua checkout Bon berbeda berebut stok: satu commit, tanpa stok negatif atau tagihan kedua', async () => {
  const source = checkoutFixture(); source.balances[0].quantityBase = 2000
  const f = await creditFixture(source), other = new ZannaDatabase(f.db.name), second = new CheckoutService(new DexieCheckoutRepository(other))
  try {
    const a = await bonCommand(f), b = await bonCommand(f)
    await f.checkout.prepare(a); await second.prepare(b)
    const results = await Promise.allSettled([f.checkout.execute(a), second.execute(b)])
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
    assert.equal(await f.db.sales.count(), 1); assert.equal(await f.db.receivables.count(), 1)
    assert.equal((await f.db.inventoryBalances.get(f.product.id))!.quantityBase, 500)
  } finally { other.close(); await f.db.delete() }
})
