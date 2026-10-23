import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SalesHistoryError, type SalesHistoryErrorCode } from '../src/domain/salesHistory'
import { createSalesHistoryQuery } from '../src/domain/salesHistoryQuery'
import { historyFixture, historySale, historySnapshot } from './sales-history-fixtures'
import { DexieCheckoutRepository } from '../src/data/dexieCheckoutRepository'
import { CheckoutService } from '../src/services/checkoutOperations'
import type { Sale } from '../src/domain/sale'

process.env.TZ = 'Asia/Singapore'
const code = (expected: SalesHistoryErrorCode) => (cause: unknown) => cause instanceof SalesHistoryError && cause.code === expected
test('history kosong: page kosong, tidak membuat data atau schema baru', async () => {
  const f = historyFixture()
  try { assert.deepEqual(await f.service.list(), { sales: [], nextCursor: null }); assert.equal(f.db.verno, 4); assert.equal(await f.db.checkoutIntents.count(), 0) }
  finally { await f.db.delete() }
})
test('history satu penjualan sukses: header dan detail memakai hasil tersimpan', async () => {
  const f = historyFixture()
  try {
    const saved = await historySale(f.db), page = await f.service.list()
    assert.deepEqual(page.sales, [saved.sale]); assert.equal(page.nextCursor, null)
    assert.deepEqual(await f.service.getDetail(saved.sale.id), saved.result)
  } finally { await f.db.delete() }
})
test('history beberapa penjualan: createdAt terbaru lebih dahulu', async () => {
  const f = historyFixture()
  try {
    const older = await historySale(f.db, '2026-10-21T03:00:00.000Z'), newer = await historySale(f.db, '2026-10-22T03:00:00.000Z')
    assert.deepEqual((await f.service.list()).sales.map((sale) => sale.id), [newer.sale.id, older.sale.id])
  } finally { await f.db.delete() }
})
test('history keyset pagination dan tie timestamp: ID descending tanpa duplikasi/kehilangan', async () => {
  const f = historyFixture()
  try {
    const ids = [1, 5, 2, 4, 3].map((n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`)
    for (const id of ids) await historySale(f.db, '2026-10-22T03:00:00.000Z', { id })
    const first = await f.service.list({ pageSize: 2 }), second = await f.service.list({ pageSize: 2, cursor: first.nextCursor }), third = await f.service.list({ pageSize: 2, cursor: second.nextCursor })
    const all = [...first.sales, ...second.sales, ...third.sales].map((sale) => sale.id)
    assert.deepEqual(all, [...ids].sort().reverse()); assert.equal(new Set(all).size, 5); assert.equal(third.nextCursor, null)
    assert.deepEqual((await f.service.list({ pageSize: 2, cursor: first.nextCursor })).sales, second.sales)
  } finally { await f.db.delete() }
})
test('history pagination tetap konsisten jika checkout baru ditambahkan setelah halaman pertama', async () => {
  const f = historyFixture()
  try {
    const old = await historySale(f.db, '2026-10-21T03:00:00.000Z'); await historySale(f.db, '2026-10-22T03:00:00.000Z')
    const first = await f.service.list({ pageSize: 1 }); await historySale(f.db, '2026-10-23T03:00:00.000Z')
    const next = await f.service.list({ pageSize: 1, cursor: first.nextCursor })
    assert.deepEqual(next.sales.map((sale) => sale.id), [old.sale.id]); assert.equal(next.nextCursor, null)
  } finally { await f.db.delete() }
})
test('history mencari receipt parsial/case insensitive; tanpa hasil tidak memunculkan transaksi lain', async () => {
  const f = historyFixture()
  try {
    const saved = await historySale(f.db); await historySale(f.db)
    assert.deepEqual((await f.service.list({ receipt: `  ${saved.sale.id.toLowerCase()}  ` })).sales, [saved.sale])
    assert.deepEqual((await f.service.list({ receipt: 'tidak-ada' })).sales, [])
  } finally { await f.db.delete() }
})
test('history tanggal tunggal lokal mencakup midnight sampai milidetik akhir hari', async () => {
  const f = historyFixture()
  try {
    await historySale(f.db, '2026-10-20T15:59:59.999Z')
    const start = await historySale(f.db, '2026-10-20T16:00:00.000Z'), end = await historySale(f.db, '2026-10-21T15:59:59.999Z')
    await historySale(f.db, '2026-10-21T16:00:00.000Z')
    assert.deepEqual((await f.service.list({ startDate: '2026-10-21', endDate: '2026-10-21' })).sales.map((sale) => sale.id), [end.sale.id, start.sale.id])
  } finally { await f.db.delete() }
})
test('history rentang dan tanggal satu sisi mengikuti zona lokal', async () => {
  const f = historyFixture()
  try {
    const old = await historySale(f.db, '2026-10-20T03:00:00.000Z'), middle = await historySale(f.db, '2026-10-21T03:00:00.000Z'), recent = await historySale(f.db, '2026-10-22T03:00:00.000Z')
    assert.deepEqual((await f.service.list({ startDate: '2026-10-20', endDate: '2026-10-21' })).sales.map((s) => s.id), [middle.sale.id, old.sale.id])
    assert.deepEqual((await f.service.list({ startDate: '2026-10-21' })).sales.map((s) => s.id), [recent.sale.id, middle.sale.id])
    assert.deepEqual((await f.service.list({ endDate: '2026-10-20' })).sales.map((s) => s.id), [old.sale.id])
  } finally { await f.db.delete() }
})
test('history kombinasi pencarian/tanggal dan cursor mempertahankan semua filter', async () => {
  const f = historyFixture()
  try {
    await historySale(f.db, '2026-10-20T03:00:00.000Z'); const saved = await historySale(f.db, '2026-10-22T03:00:00.000Z')
    const noMatch = await f.service.list({ receipt: saved.sale.id, startDate: '2026-10-20', endDate: '2026-10-20' })
    assert.equal(noMatch.sales.length, 0)
    for (let i = 0; i < 3; i++) await historySale(f.db, '2026-10-22T05:00:00.000Z')
    const request = { receipt: 'zc-20261022', startDate: '2026-10-22', endDate: '2026-10-22', pageSize: 2 }
    const first = await f.service.list(request), next = await f.service.list({ ...request, cursor: first.nextCursor })
    assert.equal([...first.sales, ...next.sales].length, 4)
    assert.ok([...first.sales, ...next.sales].every((sale) => sale.receiptNumber.startsWith('ZC-20261022')))
  } finally { await f.db.delete() }
})
test('history filter tanggal salah/terbalik dan page size di luar batas ditolak', async () => {
  const f = historyFixture()
  try {
    for (const request of [{ startDate: '2026-02-30' }, { endDate: '2026-13-01' }, { startDate: '22/10/2026' }, { startDate: '2026-10-23', endDate: '2026-10-22' }, { pageSize: 0 }, { pageSize: 51 }, { pageSize: 1.5 }, { receipt: 'x'.repeat(101) }]) await assert.rejects(f.service.list(request), code('INVALID_FILTER'))
    assert.equal(await f.db.sales.count(), 0)
  } finally { await f.db.delete() }
})
test('history cursor dari filter lain atau cursor rusak ditolak', async () => {
  const f = historyFixture()
  try {
    await historySale(f.db); await historySale(f.db)
    const first = await f.service.list({ pageSize: 1 }); assert.ok(first.nextCursor)
    await assert.rejects(f.service.list({ receipt: 'different', cursor: first.nextCursor }), code('INVALID_FILTER'))
    await assert.rejects(f.service.list({ cursor: { ...first.nextCursor, id: 'bad-id' } }), code('INVALID_FILTER'))
  } finally { await f.db.delete() }
})
test('history local-day menggunakan kalender DST, bukan tambahan 24 jam tetap', () => {
  const previous = process.env.TZ
  try {
    process.env.TZ = 'America/New_York'
    const spring = createSalesHistoryQuery({ startDate: '2026-03-08', endDate: '2026-03-08' })
    assert.equal(Date.parse(spring.toExclusive!) - Date.parse(spring.fromInclusive!), 23 * 3600000)
    const autumn = createSalesHistoryQuery({ startDate: '2026-11-01', endDate: '2026-11-01' })
    assert.equal(Date.parse(autumn.toExclusive!) - Date.parse(autumn.fromInclusive!), 25 * 3600000)
  } finally { process.env.TZ = previous }
})
test('history detail multi-item mengembalikan seluruh snapshot berurutan', async () => {
  const f = historyFixture()
  try {
    const saved = await historySale(f.db, undefined, { multi: true }), result = await f.service.getDetail(saved.sale.id)
    assert.equal(result.items.length, 2); assert.deepEqual(result.items.map((item) => item.position), [1, 2]); assert.equal(result.sale.total, 25500)
  } finally { await f.db.delete() }
})
test('history snapshot tetap setelah harga/nama/unit master berubah dan produk diarsipkan', async () => {
  const f = historyFixture()
  try {
    const saved = await historySale(f.db, undefined, { multi: true }), before = await f.service.getDetail(saved.sale.id)
    await f.db.products.update(saved.product.id, { name: 'Nama baru', isActive: false }); await f.db.variants.update(saved.variant.id, { sellingPrice: 15000, name: 'Varian baru', isActive: false })
    await f.db.units.update(saved.variant.sellingUnitId, { name: 'Nama unit sekarang' })
    assert.deepEqual(await f.service.getDetail(saved.sale.id), before)
  } finally { await f.db.delete() }
})
for (const corrupt of ['missingItem', 'snapshot', 'movement', 'intent'] as const) test(`history detail ${corrupt}: INTEGRITY_ERROR, tanpa repair/write`, async () => {
  const f = historyFixture()
  try {
    const saved = await historySale(f.db, undefined, { multi: true })
    if (corrupt === 'missingItem') await f.db.saleItems.delete(saved.items[0].id)
    if (corrupt === 'snapshot') await f.db.saleItems.update(saved.items[0].id, { unitPriceSnapshot: 99000 })
    if (corrupt === 'movement') await f.db.stockMovements.delete(saved.movements[0].id)
    if (corrupt === 'intent') await f.db.checkoutIntents.delete(saved.command.checkoutOperationId)
    const before = await historySnapshot(f.db)
    await assert.rejects(f.service.getDetail(saved.sale.id), code('INTEGRITY_ERROR')); assert.deepEqual(await historySnapshot(f.db), before)
  } finally { await f.db.delete() }
})
test('history header rusak adalah error integritas, bukan empty state', async () => {
  const f = historyFixture()
  try {
    const saved = await historySale(f.db)
    await f.db.sales.update(saved.sale.id, { changeAmount: 0 }); await assert.rejects(f.service.list(), code('INTEGRITY_ERROR'))
    // Deliberately bypass the compile-time union to emulate malformed persisted data.
    await f.db.sales.update(saved.sale.id, { changeAmount: saved.sale.changeAmount, status: 'PREPARED' as Sale['status'] })
    await assert.rejects(f.service.list(), code('INTEGRITY_ERROR'))
  }
  finally { await f.db.delete() }
})
test('history PREPARED/CANCELLED bukan Sale; list tidak membaca semua SaleItems', async () => {
  const f = historyFixture()
  try {
    const saved = await historySale(f.db), checkout = new CheckoutService(new DexieCheckoutRepository(f.db))
    const command = { ...saved.command, checkoutOperationId: crypto.randomUUID() }
    await checkout.prepare(command); await checkout.prepare({ ...command, checkoutOperationId: crypto.randomUUID() }); await checkout.cancel(command.checkoutOperationId)
    const fail = () => { throw new Error('List must not read SaleItems') }
    f.db.saleItems.hook('reading', fail)
    try { assert.equal((await f.service.list()).sales.length, 1) } finally { f.db.saleItems.hook('reading').unsubscribe(fail) }
  } finally { await f.db.delete() }
})
test('history ID tidak ada/salah dan orphan COMMITTED dibedakan', async () => {
  const f = historyFixture()
  try {
    await assert.rejects(f.service.getDetail(crypto.randomUUID()), code('NOT_FOUND')); await assert.rejects(f.service.getDetail('not-an-id'), code('NOT_FOUND'))
    const saved = await historySale(f.db); await f.db.sales.delete(saved.sale.id)
    await assert.rejects(f.service.getDetail(saved.sale.id), code('INTEGRITY_ERROR'))
  } finally { await f.db.delete() }
})
test('history database ditutup/tidak tersedia: STORAGE_ERROR, tidak reset DB', async () => {
  const f = historyFixture()
  try {
    const saved = await historySale(f.db); f.db.close({ disableAutoOpen: true })
    await assert.rejects(f.service.list(), code('STORAGE_ERROR')); await assert.rejects(f.service.getDetail(saved.sale.id), code('STORAGE_ERROR'))
    await f.db.open(); assert.equal(await f.db.sales.count(), 1)
  } finally { await f.db.delete() }
})
test('history seluruh list/detail/reopen read-only: sembilan tabel persis sama', async () => {
  const f = historyFixture()
  try {
    const saved = await historySale(f.db, undefined, { multi: true }), before = await historySnapshot(f.db)
    await f.service.list(); await f.service.list({ receipt: saved.sale.id }); await f.service.getDetail(saved.sale.id); f.db.close(); await f.db.open(); await f.service.getDetail(saved.sale.id)
    assert.deepEqual(await historySnapshot(f.db), before)
  } finally { await f.db.delete() }
})

test('history membaca hasil checkout tunai nyata melalui engine yang sudah ada', async () => {
  const f = historyFixture()
  try {
    const source = await historySale(f.db), checkout = new CheckoutService(new DexieCheckoutRepository(f.db))
    const command = { ...source.command, checkoutOperationId: crypto.randomUUID() }
    await checkout.prepare(command); const committed = await checkout.execute(command), before = await historySnapshot(f.db)
    const detail = await f.service.getDetail(committed.sale.id)
    assert.deepEqual(detail.sale, committed.sale); assert.deepEqual(detail.items, committed.items)
    assert.equal((await f.service.list()).sales[0].id, committed.sale.id)
    assert.deepEqual(await historySnapshot(f.db), before)
  } finally { await f.db.delete() }
})
