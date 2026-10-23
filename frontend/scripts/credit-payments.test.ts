import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ZannaDatabase } from '../src/data/database'
import { DexieCreditRepository } from '../src/data/dexieCreditRepository'
import { CreditService } from '../src/services/creditOperations'
import { CreditError, type CreditPaymentCommand } from '../src/domain/credit'
import { DexieDashboardRepository } from '../src/data/dexieDashboardRepository'
import { DashboardService } from '../src/services/dashboardOperations'
import { DexieSalesHistoryRepository } from '../src/data/dexieSalesHistoryRepository'
import { SalesHistoryService } from '../src/services/salesHistoryOperations'
import { creditFixture, bonCommand, businessSnapshot } from './credit-fixtures'

const code = (expected: CreditError['code']) => (cause: unknown) => cause instanceof CreditError && cause.code === expected
async function setup() {
  const f = await creditFixture(), command = await bonCommand(f)
  await f.checkout.prepare(command); const sale = await f.checkout.execute(command)
  const credit = new CreditService(new DexieCreditRepository(f.db)), debt = (await f.db.receivables.toArray())[0]
  const payment = (amount: number, expectedBalance = debt.balance): CreditPaymentCommand => ({ payloadVersion: 1, operationId: crypto.randomUUID(), receivableId: debt.id, amount, expectedBalance })
  return { ...f, credit, debt, sale, payment }
}
test('cicilan dan pelunasan: UNPAID→PARTIAL→PAID, bukti immutable dan tidak menyentuh stok/Sale', async () => {
  const f = await setup()
  try {
    const before = await businessSnapshot(f.db), first = f.payment(5000)
    await f.credit.prepare(first); const part = await f.credit.execute(first)
    assert.equal(part.payment.balanceBefore, 19500); assert.equal(part.payment.balanceAfter, 14500)
    assert.equal((await f.credit.detail(f.debt.id)).receivable.status, 'PARTIAL')
    const last = f.payment(14500, 14500); await f.credit.prepare(last); await f.credit.execute(last)
    const detail = await f.credit.detail(f.debt.id)
    assert.equal(detail.receivable.status, 'PAID'); assert.equal(detail.receivable.balance, 0); assert.equal(detail.receivable.totalPaid, 19500)
    assert.equal(detail.payments.length, 2); assert.deepEqual(detail.payments[0], part.payment)
    for (const name of ['inventoryBalances', 'stockMovements', 'sales', 'saleItems', 'checkoutIntents', 'products', 'variants']) assert.deepEqual((await businessSnapshot(f.db))[name], before[name], name)
    assert.equal((await f.credit.overview()).totalOutstanding, 0)
    assert.equal((await f.credit.getPayment(first.operationId))!.payment.id, part.payment.id)
  } finally { await f.db.delete() }
})
for (const amount of [0, -1, 0.5, NaN, Infinity, 19501, 1000000001]) test(`cicilan menolak nominal ${amount} tanpa efek bisnis`, async () => {
  const f = await setup()
  try { const before = await businessSnapshot(f.db); await assert.rejects(async () => f.credit.prepare(f.payment(amount))); assert.deepEqual(await businessSnapshot(f.db), before) }
  finally { await f.db.delete() }
})
test('dua koneksi membayar bersamaan: saldo serial, tidak bisa kelebihan bayar', async () => {
  const f = await setup(), other = new ZannaDatabase(f.db.name), second = new CreditService(new DexieCreditRepository(other))
  try {
    const a = f.payment(15000), b = f.payment(15000)
    await f.credit.prepare(a); await second.prepare(b)
    const results = await Promise.allSettled([f.credit.execute(a), second.execute(b)])
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
    const rejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult
    assert.equal(code('BALANCE_CHANGED')(rejected.reason), true)
    assert.equal((await f.credit.detail(f.debt.id)).receivable.balance, 4500); assert.equal(await f.db.creditPayments.count(), 1)
  } finally { other.close(); await f.db.delete() }
})
test('double execute/retry pembayaran dan payload berbeda: satu bukti, tidak mengurangi saldo dua kali', async () => {
  const f = await setup()
  try {
    const command = f.payment(5000); await f.credit.prepare(command)
    const results = await Promise.all([f.credit.execute(command), f.credit.execute(command)])
    assert.deepEqual(results.map((result) => result.duplicate).sort(), [false, true]); assert.equal(await f.db.creditPayments.count(), 1)
    const after = await businessSnapshot(f.db)
    await f.credit.execute(command); assert.deepEqual(await businessSnapshot(f.db), after)
    await assert.rejects(f.credit.prepare({ ...command, amount: 6000 }), code('OPERATION_PAYLOAD_MISMATCH'))
    await assert.rejects(f.credit.execute({ ...command, amount: 6000 }), code('OPERATION_PAYLOAD_MISMATCH'))
  } finally { await f.db.delete() }
})
for (const table of ['creditPayments', 'receivables', 'creditPaymentIntents'] as const) test(`rollback pembayaran ketika ${table} gagal, semua tabel kembali`, async () => {
  const f = await setup()
  try {
    const command = f.payment(5000); await f.credit.prepare(command)
    const before = await businessSnapshot(f.db), target = f.db.table(table), fail = () => { throw new Error('Injected payment write failure') }
    if (table === 'creditPayments') target.hook('creating', fail); else target.hook('updating', fail)
    try { await assert.rejects(f.credit.execute(command), code('STORAGE_ERROR')) }
    finally { if (table === 'creditPayments') target.hook('creating').unsubscribe(fail); else target.hook('updating').unsubscribe(fail) }
    assert.deepEqual(await businessSnapshot(f.db), before)
    assert.equal((await f.credit.execute(command)).payment.balanceAfter, 14500)
  } finally { await f.db.delete() }
})
test('recovery pembayaran PREPARED dan response-lost setelah reopen: tidak autoexecute atau membuat pengganti', async () => {
  const f = await setup()
  try {
    const command = f.payment(5000); await f.credit.prepare(command); f.db.close(); await f.db.open()
    assert.equal((await f.credit.listUnresolved())[0].operationId, command.operationId); assert.equal(await f.db.creditPayments.count(), 0)
    await f.credit.execute(command); f.db.close(); await f.db.open()
    assert.equal((await f.credit.getPayment(command.operationId))!.payment.amount, 5000)
    assert.equal((await f.credit.execute(command)).duplicate, true); assert.equal(await f.db.creditPayments.count(), 1)
  } finally { await f.db.delete() }
})
test('cancel sebelum prepare menahan retry terlambat; cancel committed mengembalikan bukti dan tidak undo', async () => {
  const f = await setup()
  try {
    const cancelled = f.payment(5000); assert.equal(await f.credit.cancel(cancelled), null)
    await assert.rejects(f.credit.prepare(cancelled), code('INTENT_CANCELLED'))
    await assert.rejects(f.credit.execute(cancelled), code('INTENT_CANCELLED'))
    const committed = f.payment(5000); await f.credit.prepare(committed); const paid = await f.credit.execute(committed)
    assert.equal((await f.credit.cancel(committed))!.payment.id, paid.payment.id)
    assert.equal((await f.credit.detail(f.debt.id)).receivable.balance, 14500)
  } finally { await f.db.delete() }
})
test('pelanggan diarsip/rename tetap bisa melunasi; bukti dan struk memakai snapshot awal', async () => {
  const f = await setup()
  try {
    await f.customers.save({ ...f.customer, expectedUpdatedAt: f.customer.updatedAt, isActive: false, name: 'Nama baru' })
    const command = f.payment(19500); await f.credit.prepare(command); const paid = await f.credit.execute(command)
    assert.equal(paid.payment.customerSnapshot.name, 'Bu Sari')
    assert.equal((await f.checkout.getResult(f.sale.sale.checkoutOperationId))!.sale.customerSnapshot?.name, 'Bu Sari')
    const overview = await f.credit.overview(); assert.equal(overview.customers[0].isActive, false); assert.equal(overview.receivables[0].status, 'PAID')
  } finally { await f.db.delete() }
})
for (const corruption of ['balance', 'payment', 'intent'] as const) test(`saldo/riwayat korup ${corruption} diblokir tanpa repair atau pembayaran kedua`, async () => {
  const f = await setup()
  try {
    const command = f.payment(5000); await f.credit.prepare(command); const result = await f.credit.execute(command)
    if (corruption === 'balance') await f.db.receivables.update(f.debt.id, { balance: 14000 })
    if (corruption === 'payment') await f.db.creditPayments.update(result.payment.id, { amount: 6000 })
    if (corruption === 'intent') await f.db.creditPaymentIntents.delete(command.operationId)
    const before = await businessSnapshot(f.db)
    await assert.rejects(f.credit.overview(), code('INTEGRITY_ERROR'))
    await assert.rejects(f.credit.getPayment(command.operationId), code('INTEGRITY_ERROR'))
    assert.deepEqual(await businessSnapshot(f.db), before)
  } finally { await f.db.delete() }
})
test('Dashboard CASH+BON menghitung omzet sekali; pelunasan bukan penjualan baru, riwayat hanya baca', async () => {
  const f = await setup()
  try {
    const quote = await f.checkout.preview([{ variantId: f.variant.id, quantity: 1000 }])
    const cash = { payloadVersion: 1 as const, paymentMethod: 'CASH' as const, checkoutOperationId: crypto.randomUUID(), lines: quote.lines, expectedTotal: quote.total, cashReceived: quote.total }
    await f.checkout.prepare(cash); await f.checkout.execute(cash)
    const dashboard = new DashboardService(new DexieDashboardRepository(f.db)), history = new SalesHistoryService(new DexieSalesHistoryRepository(f.db))
    const before = await dashboard.read(new Date())
    assert.equal(before.today.revenue, 32500); assert.equal(before.today.transactions, 2)
    const command = f.payment(19500); await f.credit.prepare(command); await f.credit.execute(command)
    const unchanged = await businessSnapshot(f.db)
    const after = await dashboard.read(new Date()); assert.equal(after.today.revenue, 32500); assert.equal(after.today.transactions, 2)
    assert.equal((await f.credit.overview()).totalOutstanding, 0)
    const list = await history.list(); assert.equal(list.sales.filter((sale) => sale.paymentMethod === 'BON').length, 1)
    await history.getDetail(f.sale.sale.id); await f.credit.detail(f.debt.id)
    assert.deepEqual(await businessSnapshot(f.db), unchanged)
  } finally { await f.db.delete() }
})
test('ringkasan beberapa pelanggan termasuk arsip: total sisa benar pada UNPAID, PARTIAL dan PAID', async () => {
  const f = await setup()
  try {
    const secondCustomer = await f.customers.save({ name: 'Pak Agus', phone: '', address: '', note: '', isActive: true })
    const secondBon = await bonCommand({ ...f, customer: secondCustomer })
    await f.checkout.prepare(secondBon); await f.checkout.execute(secondBon)
    const thirdBon = await bonCommand(f); await f.checkout.prepare(thirdBon); await f.checkout.execute(thirdBon)
    const otherDebt = (await f.db.receivables.toArray()).find((entry) => entry.customerId === secondCustomer.id)!
    const partial = f.payment(5000); await f.credit.prepare(partial); await f.credit.execute(partial)
    const paid: CreditPaymentCommand = { ...f.payment(19500), receivableId: otherDebt.id }
    await f.credit.prepare(paid); await f.credit.execute(paid)
    await f.customers.archive(f.customer, false)
    const before = await businessSnapshot(f.db), overview = await f.credit.overview()
    assert.equal(overview.totalOutstanding, 34000)
    assert.deepEqual(overview.receivables.map((entry) => entry.status).sort(), ['PAID', 'PARTIAL', 'UNPAID'])
    assert.equal(overview.customers.find((entry) => entry.id === f.customer.id)!.isActive, false)
    assert.deepEqual(await businessSnapshot(f.db), before)
  } finally { await f.db.delete() }
})
