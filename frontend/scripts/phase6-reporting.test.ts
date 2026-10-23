import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Dexie } from 'dexie'
import { ZannaDatabase, PRODUCT_SCHEMA_V1 } from '../src/data/database'
import { DexieReportingRepository } from '../src/data/dexieReportingRepository'
import { ReportingService } from '../src/services/reportingOperations'
import { reportWindow, itemCost, sumMoney, summarizeReport } from '../src/domain/reportingRules'
import { csv, salesCsv, profitCsv, creditCsv } from '../src/services/reportExport'
import { DexieCreditRepository } from '../src/data/dexieCreditRepository'
import { CreditService } from '../src/services/creditOperations'
import { creditFixture, bonCommand, businessSnapshot } from './credit-fixtures'
import { historySale } from './sales-history-fixtures'
import { saleFixture } from './checkout-fixtures'

const reports = (db: ZannaDatabase) => new ReportingService(new DexieReportingRepository(db))
async function cash(f: Awaited<ReturnType<typeof creditFixture>>) {
  const quote = await f.checkout.preview([{ variantId: f.variant.id, quantity: 1500 }])
  const command = { payloadVersion: 1 as const, checkoutOperationId: crypto.randomUUID(), paymentMethod: 'CASH' as const, lines: quote.lines, expectedTotal: quote.total, cashReceived: quote.total + 500 }
  await f.checkout.prepare(command)
  return { command, result: await f.checkout.execute(command) }
}

test('periode hari/pekan/bulan dan custom memakai kalender lokal, bukan potong UTC', () => {
  const old = process.env.TZ
  try {
    process.env.TZ = 'Asia/Jakarta'
    const now = new Date('2026-10-23T01:00:00+07:00')
    assert.equal(reportWindow({ preset: 'today' }, now).fromInclusive, '2026-10-22T17:00:00.000Z')
    assert.equal(reportWindow({ preset: 'week' }, now).days.length, 7)
    assert.equal(reportWindow({ preset: 'week' }, now).startDate, '2026-10-17')
    assert.equal(reportWindow({ preset: 'month' }, now).startDate, '2026-10-01')
    const custom = reportWindow({ preset: 'custom', startDate: '2026-10-01', endDate: '2026-10-02' }, now)
    assert.equal(custom.toExclusive, '2026-10-02T17:00:00.000Z')
    assert.equal(custom.days.length, 2)
  } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old }
})
test('periode kalender tetap benar ketika hari DST bukan 24 jam', () => {
  const old = process.env.TZ
  try {
    process.env.TZ = 'America/New_York'
    const window = reportWindow({ preset: 'custom', startDate: '2026-03-08', endDate: '2026-03-08' })
    assert.equal(window.days.length, 1); assert.equal(Date.parse(window.toExclusive) - Date.parse(window.fromInclusive), 23 * 3600000)
  } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old }
})
for (const [startDate, endDate] of [['', ''], ['2026-02-30', '2026-03-01'], ['2026-10-24', '2026-10-23'], ['2025-01-01', '2026-10-23']]) {
  test(`filter tanggal tidak valid ditolak: ${startDate}/${endDate}`, () => assert.throws(() => reportWindow({ preset: 'custom', startDate, endDate })))
}
test('agregat uang integer dan overflow dilaporkan, bukan kehilangan presisi', () => {
  assert.equal(sumMoney([10000, -1000, 1]), 9001)
  assert.throws(() => sumMoney([0.1])); assert.throws(() => sumMoney([Number.MAX_SAFE_INTEGER, 1]))
})
test('laporan kosong benar-benar nol dan pembacaan tidak menulis', async () => {
  const db = new ZannaDatabase(`phase6-empty-${crypto.randomUUID()}`)
  try {
    await db.open(); const before = await businessSnapshot(db), report = await reports(db).read({ preset: 'week' })
    assert.equal(report.revenue, 0); assert.equal(report.moneyReceived, 0); assert.equal(report.days.length, 7)
    assert.deepEqual(await businessSnapshot(db), before)
  } finally { await db.delete() }
})
test('batas awal/akhir, metode dan detail laporan memakai Sale sah, pembayaran bukan omzet baru', async () => {
  const db = new ZannaDatabase(`phase6-dates-${crypto.randomUUID()}`), window = reportWindow({ preset: 'custom', startDate: '2026-10-20', endDate: '2026-10-21' })
  try {
    await historySale(db, new Date(Date.parse(window.fromInclusive) - 1).toISOString())
    const first = await historySale(db, window.fromInclusive)
    await historySale(db, new Date(Date.parse(window.toExclusive) - 1).toISOString())
    await historySale(db, window.toExclusive)
    const service = reports(db), report = await service.read({ preset: 'custom', startDate: window.startDate, endDate: window.endDate })
    assert.equal(report.transactions, 2); assert.equal(report.revenue, 39000); assert.ok(report.sales.some((s) => s.sale.id === first.sale.id))
    assert.equal((await service.read({ preset: 'custom', startDate: window.startDate, endDate: window.endDate, method: 'BON' })).revenue, 0)
  } finally { await db.delete() }
})
test('CASH + BON, kas bersih, cicilan, total piutang dan filter tanpa double counting', async () => {
  const f = await creditFixture()
  try {
    const saved = await cash(f), command = await bonCommand(f); await f.checkout.prepare(command); await f.checkout.execute(command)
    const service = reports(f.db), credit = new CreditService(new DexieCreditRepository(f.db)), receivable = (await credit.overview()).receivables[0]
    const before = await businessSnapshot(f.db), report = await service.read({ preset: 'today' })
    assert.equal(report.revenue, 39000); assert.equal(report.cashSales, 19500); assert.equal(report.bonSales, 19500); assert.equal(report.moneyReceived, 19500)
    assert.equal(report.outstanding, 19500); assert.equal(report.totalPaid, 0); assert.deepEqual(await businessSnapshot(f.db), before)
    const payment = { payloadVersion: 1 as const, operationId: crypto.randomUUID(), receivableId: receivable.id, expectedBalance: 19500, amount: 5000 }
    await credit.prepare(payment); await credit.execute(payment)
    const afterPayment = await service.read({ preset: 'today' })
    assert.equal(afterPayment.revenue, 39000); assert.equal(afterPayment.transactions, 2); assert.equal(afterPayment.moneyReceived, 24500)
    assert.equal(afterPayment.totalPaid, 5000); assert.equal(afterPayment.outstanding, 14500); assert.equal(afterPayment.payments.length, 1)
    const onlyCash = await service.read({ preset: 'today', method: 'CASH' }), onlyBon = await service.read({ preset: 'today', method: 'BON' })
    assert.equal(onlyCash.revenue, 19500); assert.equal(onlyCash.creditReceipts, 0); assert.equal(onlyBon.moneyReceived, 5000)
    assert.equal(onlyCash.outstanding, 14500); assert.equal(saved.result.sale.changeAmount, 500)
    assert.match(creditCsv(afterPayment), /14500/)
  } finally { await f.db.delete() }
})
test('pembayaran dalam periode atas Bon di luar periode tetap kas, tidak menciptakan penjualan', async () => {
  const f = await creditFixture()
  try {
    const command = await bonCommand(f); await f.checkout.prepare(command); await f.checkout.execute(command)
    const credit = new CreditService(new DexieCreditRepository(f.db)), r = (await credit.overview()).receivables[0]
    const payment = { payloadVersion: 1 as const, operationId: crypto.randomUUID(), receivableId: r.id, amount: 5000, expectedBalance: r.balance }
    await credit.prepare(payment); const paid = await credit.execute(payment)
    const repository = new DexieReportingRepository(f.db), window = reportWindow({ preset: 'today' }), data = await repository.read(window)
    // Pure aggregation fixture represents a historical sale outside the selected period.
    const report = summarizeReport({ ...data, period: [], payments: [paid.payment] }, window)
    assert.equal(report.revenue, 0); assert.equal(report.transactions, 0); assert.equal(report.moneyReceived, 5000)
  } finally { await f.db.delete() }
})
test('snapshot HPP baru memakai satuan dasar, round half-up dan tidak berubah saat master diedit/retry', async () => {
  const f = await creditFixture()
  try {
    await f.db.products.update(f.product.id, { costKnown: true, costPrice: 10000 })
    const saved = await cash(f), service = reports(f.db), report = await service.read({ preset: 'today' }), profit = await service.profit(report)
    assert.equal(profit.cost, 15000); assert.equal(profit.profit, 4500); assert.equal(profit.complete, true)
    await f.db.products.update(f.product.id, { costPrice: 99999 })
    const before = await businessSnapshot(f.db)
    assert.deepEqual(await service.profit(report), profit)
    assert.equal((await f.checkout.execute(saved.command)).duplicate, true)
    assert.equal(await f.db.saleItemCosts.count(), 1); assert.deepEqual(await businessSnapshot(f.db), before)
    assert.match(profitCsv(report, profit), /4500/); assert.doesNotMatch(salesCsv(report), /Harga modal|Laba kotor/)
  } finally { await f.db.delete() }
})
test('HPP botol 1,5 L dan jeriken 5 L mengikuti quantityBase, bukan jumlah kemasan', () => {
  const item = saleFixture().items[0]
  assert.equal(itemCost({ ...item, quantityBase: 1500 }, { costKnown: true, costPrice: 10000 }).totalCost, 15000)
  assert.equal(itemCost({ ...item, quantityBase: 5000 }, { costKnown: true, costPrice: 10000 }).totalCost, 50000)
  assert.equal(itemCost({ ...item, quantityBase: 500 }, { costKnown: true, costPrice: 1 }).totalCost, 1)
  assert.equal(itemCost(item, { costKnown: true, costPrice: 0 }).totalCost, 0)
  assert.throws(() => itemCost(item, { costKnown: true, costPrice: null }))
  assert.throws(() => itemCost(item, { costKnown: false, costPrice: 10000 }))
})
test('modal hilang dikecualikan dari penjualan laba, bukan dianggap nol atau diambil dari master terbaru', async () => {
  const f = await creditFixture()
  try {
    await cash(f)
    await f.db.products.update(f.product.id, { costKnown: true, costPrice: 10000 }); await cash(f)
    const service = reports(f.db), report = await service.read({ preset: 'today' }), profit = await service.profit(report)
    assert.equal(report.revenue, 39000); assert.equal(profit.knownRevenue, 19500); assert.equal(profit.cost, 15000); assert.equal(profit.profit, 4500)
    assert.equal(profit.complete, false); assert.equal(profit.missingItems, 1); assert.match(profitCsv(report, profit), /PARSIAL/)
  } finally { await f.db.delete() }
})
test('kegagalan write snapshot modal rollback Sale, inventory, Bon dan intent secara atomik', async () => {
  const f = await creditFixture()
  try {
    const command = await bonCommand(f); await f.checkout.prepare(command); const before = await businessSnapshot(f.db)
    const fail = () => { throw new Error('fault snapshot cost') }
    f.db.saleItemCosts.hook('creating', fail)
    await assert.rejects(f.checkout.execute(command)); f.db.saleItemCosts.hook('creating').unsubscribe(fail)
    assert.deepEqual(await businessSnapshot(f.db), before)
    await f.checkout.execute(command); assert.equal(await f.db.saleItemCosts.count(), 1); assert.equal(await f.db.receivables.count(), 1)
  } finally { await f.db.delete() }
})
test('korupsi biaya terdeteksi dan laporan tidak memperbaiki data diam-diam', async () => {
  const f = await creditFixture()
  try {
    await f.db.products.update(f.product.id, { costKnown: true, costPrice: 10000 }); await cash(f)
    const cost = (await f.db.saleItemCosts.toArray())[0]; await f.db.saleItemCosts.update(cost.saleItemId, { totalCost: 1 })
    const before = await businessSnapshot(f.db), service = reports(f.db)
    await assert.rejects(service.profit(await service.read({ preset: 'today' })), /tidak konsisten/)
    assert.deepEqual(await businessSnapshot(f.db), before)
  } finally { await f.db.delete() }
})
test('ekspor CSV UTF-8, kutip/koma/baris baru dan formula injection tetap aman', () => {
  const output = csv([['=SUM(1,2)', '+1', '-x', '@x', '\t=1', 'a,"b"\nc', '0812', -500]])
  assert.ok(output.startsWith('\uFEFF')); assert.match(output, /'@x/); assert.match(output, /'\t=1/); assert.match(output, /"a,""b""\nc"/); assert.match(output, /"0812"/); assert.ok(output.endsWith('"-500"\r\n'))
})
test('migrasi literal v4 → v5 menjaga 13 tabel lama dan menandai laba lama parsial tanpa backfill', async () => {
  const f = await creditFixture(), legacy = new Dexie(`phase6-v4-${crypto.randomUUID()}`)
  legacy.version(4).stores({ ...PRODUCT_SCHEMA_V1, inventoryBalances: 'productId, updatedAt', stockMovements: 'id, productId, &operationId, [productId+createdAt], createdAt, saleId, &saleItemId', sales: 'id, &receiptNumber, &checkoutOperationId, createdAt, status, paymentMethod', saleItems: 'id, saleId, productId, variantId, &[saleId+position]', checkoutIntents: 'checkoutOperationId, status, createdAt, saleId', customers: 'id, name, updatedAt', receivables: 'id, &saleId, &checkoutOperationId, customerId, status, createdAt, [customerId+createdAt], dueDate', creditPayments: 'id, &operationId, receivableId, customerId, saleId, createdAt, [receivableId+createdAt], &receiptNumber', creditPaymentIntents: 'operationId, status, receivableId, createdAt, &paymentId' })
  const upgraded = new ZannaDatabase(legacy.name)
  try {
    const saved = await cash(f), bon = await bonCommand(f); await f.checkout.prepare(bon); await f.checkout.execute(bon)
    const data = await businessSnapshot(f.db)
    await legacy.transaction('rw', legacy.tables, async () => { for (const table of legacy.tables) await table.bulkAdd(data[table.name]) })
    legacy.close(); await upgraded.open()
    assert.equal(upgraded.verno, 5); assert.equal(await upgraded.saleItemCosts.count(), 0)
    for (const [name, rows] of Object.entries(data)) if (name !== 'saleItemCosts') assert.deepEqual(await upgraded.table(name).toArray(), rows)
    const service = reports(upgraded), report = await service.read({ preset: 'today' }), profit = await service.profit(report)
    assert.equal(report.revenue, saved.result.sale.total * 2); assert.equal(profit.missingItems, 2); assert.equal(profit.complete, false)
  } finally { legacy.close(); await upgraded.delete(); await f.db.delete() }
})
