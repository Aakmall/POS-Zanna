import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { Dexie } from 'dexie'
import { ZannaDatabase, PRODUCT_SCHEMA_V1 } from '../src/data/database'
import { DexieCustomerRepository } from '../src/data/dexieCustomerRepository'
import { CustomerService } from '../src/services/customerOperations'
import { CreditError } from '../src/domain/credit'
import { customerSnapshot } from '../src/domain/customer'
import { validateDueDate } from '../src/domain/customerRules'
import { saleFixture, commandFixture } from './checkout-fixtures'
import { creditFixture } from './credit-fixtures'
import { CheckoutService } from '../src/services/checkoutOperations'
import { DexieCheckoutRepository } from '../src/data/dexieCheckoutRepository'

const databases: ZannaDatabase[] = []
after(async () => { for (const db of databases) await db.delete() })
function database() { const db = new ZannaDatabase(`credit-test-${crypto.randomUUID()}`); databases.push(db); return db }
function customers(db = database()) { const service = new CustomerService(new DexieCustomerRepository(db)); return { db, service } }
const draft = () => ({ name: 'Ibu Sari', phone: '0812345678', address: 'Jalan Mawar', note: 'Pelanggan warung', isActive: true })
const code = (expected: CreditError['code']) => (cause: unknown) => cause instanceof CreditError && cause.code === expected

test('pelanggan: tambah, baca ulang, edit, UUID dan timestamp stabil; input tidak dimutasi', async () => {
  const { db, service } = customers(), input = draft(), original = structuredClone(input)
  const saved = await service.save(input)
  assert.deepEqual(input, original); assert.equal((await service.list())[0].name, 'Ibu Sari')
  const edited = await service.save({ ...saved, expectedUpdatedAt: saved.updatedAt, name: 'Sari diperbarui' })
  assert.equal(edited.id, saved.id); assert.equal(edited.createdAt, saved.createdAt); assert.ok(edited.updatedAt > saved.updatedAt)
  db.close(); await db.open(); assert.equal((await service.list())[0].name, 'Sari diperbarui')
  assert.equal(typeof saved.phone, 'string'); assert.equal(await db.customers.count(), 1)
})
test('pelanggan: arsip/aktifkan tidak menghapus master dan snapshot historis tidak ikut berubah', async () => {
  const { service } = customers(), saved = await service.save(draft()), snapshot = customerSnapshot(saved)
  const archived = await service.archive(saved, false)
  assert.equal(archived.isActive, false); assert.equal((await service.list()).length, 1)
  const active = await service.archive(archived, true)
  assert.equal(active.isActive, true); assert.deepEqual(snapshot, customerSnapshot(saved))
})
test('pelanggan: nama wajib, kontak opsional, panjang teks dan status divalidasi', async () => {
  const { service } = customers()
  for (const invalid of [{ name: ' ' }, { name: 'a'.repeat(101) }, { phone: 'a'.repeat(41) }, { address: 'a'.repeat(301) }, { note: 'a'.repeat(1001) }]) await assert.rejects(service.save({ ...draft(), ...invalid }), code('INVALID_REQUEST'))
  const empty = await service.save({ ...draft(), phone: '', address: '', note: '' })
  assert.equal(empty.phone, ''); assert.equal(empty.address, '')
  // Same names are allowed: UUID, not a name/phone, identifies a customer.
  await service.save({ ...draft(), phone: '' }); assert.equal((await service.list()).length, 2)
})
test('pelanggan: edit usang tidak menimpa perubahan tab lain', async () => {
  const { service } = customers(), saved = await service.save(draft())
  await service.save({ ...saved, expectedUpdatedAt: saved.updatedAt, address: 'Alamat baru' })
  await assert.rejects(service.save({ ...saved, expectedUpdatedAt: saved.updatedAt, name: 'Stale' }), code('CUSTOMER_CHANGED'))
  assert.equal((await service.list())[0].address, 'Alamat baru')
})
test('jatuh tempo opsional memakai tanggal kalender valid, bukan timestamp UTC', () => {
  for (const date of [null, '2028-02-29', '2026-10-25']) assert.doesNotThrow(() => validateDueDate(date))
  for (const date of ['', '2026-02-29', '2026-11-31', '2026-10-25T00:00:00Z']) assert.throws(() => validateDueDate(date))
})
test('migrasi literal v3 ke v5 additive: sembilan tabel lama, CASH/fingerprint/intent tidak ditulis ulang', async () => {
  const legacy = new Dexie(`credit-migration-${crypto.randomUUID()}`)
  legacy.version(1).stores(PRODUCT_SCHEMA_V1)
  legacy.version(2).stores({ inventoryBalances: 'productId, updatedAt', stockMovements: 'id, productId, &operationId, [productId+createdAt], createdAt' })
  legacy.version(3).stores({ sales: 'id, &receiptNumber, &checkoutOperationId, createdAt, status', saleItems: 'id, saleId, productId, variantId, &[saleId+position]', checkoutIntents: 'checkoutOperationId, status, createdAt, saleId', stockMovements: 'id, productId, &operationId, [productId+createdAt], createdAt, saleId, &saleItemId' })
  const f = saleFixture(), request = commandFixture().command
  await legacy.table('sales').add(f.sale); await legacy.table('saleItems').bulkAdd(f.items)
  await legacy.table('checkoutIntents').add({ checkoutOperationId: request.checkoutOperationId, command: request, requestFingerprint: 'legacy fingerprint unchanged', createdAt: f.sale.createdAt, status: 'PREPARED' })
  const captured = Object.fromEntries(await Promise.all(legacy.tables.map(async (table) => [table.name, await table.toArray()])))
  legacy.close()
  const db = new ZannaDatabase(legacy.name); databases.push(db)
  await db.open(); assert.equal(db.verno, 5); assert.equal(db.tables.length, 14)
  for (const [name, rows] of Object.entries(captured)) assert.deepEqual(await db.table(name).toArray(), rows)
  for (const name of ['customers', 'receivables', 'creditPayments', 'creditPaymentIntents']) assert.equal(await db.table(name).count(), 0)
  assert.equal(db.receivables.schema.idxByName.saleId.unique, true)
  assert.equal(db.creditPayments.schema.idxByName.operationId.unique, true)
})
test('CASH committed dan PREPARED v1 yang valid tetap dapat dibuka/retry sesudah upgrade literal v3', async () => {
  const source = await creditFixture(), legacy = new Dexie(`credit-valid-v3-${crypto.randomUUID()}`)
  legacy.version(3).stores({ ...PRODUCT_SCHEMA_V1, inventoryBalances: 'productId, updatedAt', stockMovements: 'id, productId, &operationId, [productId+createdAt], createdAt, saleId, &saleItemId', sales: 'id, &receiptNumber, &checkoutOperationId, createdAt, status', saleItems: 'id, saleId, productId, variantId, &[saleId+position]', checkoutIntents: 'checkoutOperationId, status, createdAt, saleId' })
  const upgraded = new ZannaDatabase(legacy.name); databases.push(upgraded)
  try {
    const quote = await source.checkout.preview([{ variantId: source.variant.id, quantity: 1000 }])
    const cash = { payloadVersion: 1 as const, paymentMethod: 'CASH' as const, checkoutOperationId: crypto.randomUUID(), lines: quote.lines, expectedTotal: quote.total, cashReceived: quote.total }
    await source.checkout.prepare(cash); const committed = await source.checkout.execute(cash)
    const pending = { ...cash, checkoutOperationId: crypto.randomUUID() }; await source.checkout.prepare(pending)
    const oldData: Record<string, unknown[]> = Object.fromEntries(await Promise.all(legacy.tables.map(async (table) => [table.name, await source.db.table<unknown>(table.name).toArray()] as const)))
    await legacy.transaction('rw', legacy.tables, async () => { for (const [name, rows] of Object.entries(oldData)) if (rows.length) await legacy.table(name).bulkAdd(rows) })
    legacy.close(); await upgraded.open()
    for (const [name, rows] of Object.entries(oldData)) assert.deepEqual(await upgraded.table(name).toArray(), rows)
    assert.equal(await upgraded.customers.count(), 0); assert.equal(await upgraded.receivables.count(), 0)
    const service = new CheckoutService(new DexieCheckoutRepository(upgraded))
    assert.deepEqual((await service.getResult(cash.checkoutOperationId))!.sale, committed.sale)
    assert.equal((await service.execute(cash)).duplicate, true)
    assert.equal((await service.listUnresolved())[0].command.payloadVersion, 1)
    assert.equal((await service.execute(pending)).sale.paymentMethod, 'CASH')
    assert.equal(await upgraded.sales.count(), 2); assert.equal(await upgraded.receivables.count(), 0)
  } finally { legacy.close(); await source.db.delete() }
})
