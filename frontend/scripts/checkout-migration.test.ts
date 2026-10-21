import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Dexie } from 'dexie'
import { ZannaDatabase, PRODUCT_SCHEMA_V1 } from '../src/data/database'
import type { StockMovement } from '../src/domain/inventory'
import type { CheckoutIntent } from '../src/domain/checkout'
import { checkoutFingerprint, copyCheckoutCommand } from '../src/domain/checkoutRequest'
import { validateSale } from '../src/domain/saleRules'
import { checkoutFixture, commandFixture, saleFixture, testStamp } from './checkout-fixtures'

const oldStores = ['products', 'categories', 'units', 'variants', 'inventoryBalances', 'stockMovements'] as const
async function legacyV2() {
  const db = new Dexie(`checkout-migration-test-${crypto.randomUUID()}`)
  db.version(1).stores(PRODUCT_SCHEMA_V1)
  // Literal v2 fixture: this schema must remain usable independently of the new class.
  db.version(2).stores({ inventoryBalances: 'productId, updatedAt', stockMovements: 'id, productId, &operationId, [productId+createdAt], createdAt' })
  const f = checkoutFixture('bungkus', 'fixed')
  const unit = f.unit('bungkus'), snapshotUnit = { id: unit.id, code: unit.code, name: unit.name, dimension: unit.dimension, factor: unit.factor, isPackaging: unit.isPackaging }
  const records: StockMovement[] = [30000, 10000].map((quantity, index) => ({
    id: crypto.randomUUID(), operationId: crypto.randomUUID(), productId: f.product.id, productName: f.product.name,
    movementType: index === 0 ? 'OPENING_BALANCE' : 'STOCK_IN', inputQuantity: quantity,
    quantityBeforeBase: index === 0 ? 0 : 30000, quantityAfterBase: index === 0 ? 30000 : 40000, quantityDeltaBase: quantity,
    conversionSnapshot: { baseUnit: snapshotUnit, inputUnit: snapshotUnit, quantityInBaseUnit: 1000, source: 'base' },
    reason: 'Fixture ledger v2', createdBy: null, createdAt: index === 0 ? testStamp : '2026-10-21T01:00:01.000Z', requestFingerprint: `legacy-fixture-${index}`,
  }))
  const balance = { ...f.balances[0], quantityBase: 40000, updatedAt: records[1].createdAt }
  await db.transaction('rw', db.tables, async () => {
    await db.table('units').bulkAdd(f.catalog.units)
    await db.table('categories').bulkAdd(f.catalog.categories)
    await db.table('products').bulkAdd(f.catalog.products)
    await db.table('variants').bulkAdd(f.catalog.variants)
    await db.table('inventoryBalances').add(balance)
    await db.table('stockMovements').bulkAdd(records)
  })
  const captured = await Promise.all(oldStores.map((store) => db.table(store).toArray()))
  db.close()
  return { name: db.name, captured, records, balance }
}
const constraint = (error: unknown) => error instanceof Error && error.name === 'ConstraintError'

test('migrasi v2 → v3 mempertahankan seluruh master/policy/barcode/saldo/ledger tanpa backfill', async () => {
  const old = await legacyV2(), db = new ZannaDatabase(old.name)
  try {
    await db.open()
    assert.equal(db.verno, 3)
    for (const [index, store] of oldStores.entries()) assert.deepEqual(await db.table(store).toArray(), old.captured[index], store)
    assert.equal((await db.variants.toArray())[0].barcode?.startsWith('00'), true)
    assert.deepEqual((await db.inventoryBalances.toArray())[0], old.balance)
    assert.equal((await db.stockMovements.toArray()).every((record) => record.saleItemId === undefined), true)
    assert.equal(await db.sales.count(), 0); assert.equal(await db.saleItems.count(), 0); assert.equal(await db.checkoutIntents.count(), 0)
    assert.equal(db.tables.length, 9)
    db.close(); await db.open()
    for (const [index, store] of oldStores.entries()) assert.deepEqual(await db.table(store).toArray(), old.captured[index])
    assert.equal(await db.sales.count(), 0)
  } finally { await db.delete() } // Only this random fake-indexeddb test database.
})

test('skema v3: receiptNumber dan checkoutOperationId unik tanpa menulis ke database pengguna', async () => {
  const db = new ZannaDatabase(`checkout-constraints-test-${crypto.randomUUID()}`)
  const { sale, items } = saleFixture(); validateSale(sale, items)
  try {
    await db.sales.add(sale) // Raw constraint fixture only, NOT an operational Sale writer.
    await assert.rejects(db.sales.add({ ...sale, id: crypto.randomUUID(), checkoutOperationId: crypto.randomUUID() }), constraint)
    await assert.rejects(db.sales.add({ ...sale, id: crypto.randomUUID(), receiptNumber: 'TEST-OTHER-RECEIPT' }), constraint)
    assert.equal(await db.sales.count(), 1)
    assert.equal(await db.inventoryBalances.count(), 0) // Demonstrates schema alone does not enforce atomicity/FKs.
  } finally { await db.delete() }
})

test('skema v3: saleItems unik pada saleId+position dan dapat dicari dari parent', async () => {
  const db = new ZannaDatabase(`checkout-items-test-${crypto.randomUUID()}`), { items } = saleFixture()
  try {
    const item = items[0]
    await db.saleItems.add(item)
    await assert.rejects(db.saleItems.add({ ...item, id: crypto.randomUUID() }), constraint)
    await db.saleItems.add({ ...item, id: crypto.randomUUID(), position: 2 })
    assert.equal(await db.saleItems.where('saleId').equals(item.saleId).count(), 2)
    assert.equal(db.saleItems.schema.idxByName['[saleId+position]'].unique, true)
  } finally { await db.delete() }
})

test('skema v3: intent key unik; field status/saleId terindeks; tidak ada prepare operasional', async () => {
  const db = new ZannaDatabase(`checkout-intent-test-${crypto.randomUUID()}`), { command } = commandFixture()
  const intent: CheckoutIntent = { checkoutOperationId: command.checkoutOperationId, command: copyCheckoutCommand(command), requestFingerprint: checkoutFingerprint(command), status: 'PREPARED', createdAt: testStamp }
  try {
    await db.checkoutIntents.add(intent)
    await assert.rejects(db.checkoutIntents.add(intent), constraint)
    const stored = await db.checkoutIntents.get(command.checkoutOperationId)
    assert.deepEqual(stored, intent)
    assert.equal(await db.checkoutIntents.where('status').equals('PREPARED').count(), 1)
    assert.equal(db.checkoutIntents.schema.primKey.name, 'checkoutOperationId')
    assert.ok(db.checkoutIntents.schema.idxByName.saleId)
  } finally { await db.delete() }
})

test('skema v3: banyak ledger manual tanpa saleItemId sah; saleItemId terisi harus unik', async () => {
  const old = await legacyV2(), db = new ZannaDatabase(old.name)
  try {
    assert.equal(await db.stockMovements.count(), 2)
    const referenced = { ...old.records[0], id: crypto.randomUUID(), operationId: crypto.randomUUID(), saleId: crypto.randomUUID(), saleItemId: crypto.randomUUID() }
    // Deliberately raw index fixture; it makes no claim of a valid SALE domain transaction.
    await db.stockMovements.add(referenced)
    await assert.rejects(db.stockMovements.add({ ...referenced, id: crypto.randomUUID(), operationId: crypto.randomUUID() }), constraint)
    await assert.rejects(db.stockMovements.add({ ...referenced, id: crypto.randomUUID(), saleItemId: crypto.randomUUID() }), constraint)
    assert.equal(await db.stockMovements.where('saleId').equals(referenced.saleId).count(), 1)
    assert.deepEqual(await db.stockMovements.get(old.records[0].id), old.records[0])
    assert.deepEqual(await db.inventoryBalances.toArray(), [old.balance])
  } finally { await db.delete() }
})

test('database baru v3 tidak membuat produk/saldo/Sale/intent otomatis', async () => {
  const db = new ZannaDatabase(`checkout-empty-test-${crypto.randomUUID()}`)
  try {
    await db.open()
    for (const table of db.tables) assert.equal(await table.count(), 0, table.name)
  } finally { await db.delete() }
})
