import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { creditFixture, bonCommand, businessSnapshot } from './credit-fixtures'
import { ZannaDatabase } from '../src/data/database'
import { DexieBackupRepository } from '../src/data/dexieBackupRepository'
import { BackupService } from '../src/services/backupOperations'
import { BACKUP_TABLES, BACKUP_SCHEMA, type BackupData, type MaintenanceGate } from '../src/domain/backup'
import { backupCounts, canonical, makeBackup, parseBackup } from '../src/domain/backupFormat'
import { validateBackupData } from '../src/domain/backupValidation'
import { DexieCreditRepository } from '../src/data/dexieCreditRepository'
import { CreditService } from '../src/services/creditOperations'
import { ReportingService } from '../src/services/reportingOperations'
import { DexieReportingRepository } from '../src/data/dexieReportingRepository'

const gate = (): MaintenanceGate => ({ exclusive: (fn) => fn(), checkRecovery() {}, restored() {} })
const backup = (db: ZannaDatabase, safety = gate()) => new BackupService(new DexieBackupRepository(db), safety)
async function richFixture() {
  const f = await creditFixture()
  await f.db.products.update(f.product.id, { costKnown: true, costPrice: 10000 })
  const quote = await f.checkout.preview([{ variantId: f.variant.id, quantity: 1500 }])
  const cash = { payloadVersion: 1 as const, paymentMethod: 'CASH' as const, checkoutOperationId: crypto.randomUUID(), lines: quote.lines, expectedTotal: quote.total, cashReceived: 20000 }
  await f.checkout.prepare(cash); await f.checkout.execute(cash)
  const bon = await bonCommand(f); await f.checkout.prepare(bon); await f.checkout.execute(bon)
  const credit = new CreditService(new DexieCreditRepository(f.db)), r = (await credit.overview()).receivables[0]
  const payment = { payloadVersion: 1 as const, operationId: crypto.randomUUID(), receivableId: r.id, amount: 5000, expectedBalance: r.balance }
  await credit.prepare(payment); await credit.execute(payment)
  return { ...f, cash, bon, credit, payment }
}

test('backup kosong: metadata/format/checksum dan 14 tabel eksplisit, tanpa write/reset', async () => {
  const db = new ZannaDatabase(`phase7-empty-${crypto.randomUUID()}`)
  try {
    await db.open(); const before = await businessSnapshot(db), saved = await backup(db).create(), parsed = await parseBackup(saved.text)
    assert.equal(parsed.schemaVersion, BACKUP_SCHEMA); assert.equal(Object.keys(parsed.data).length, 14); assert.equal(parsed.checksum.length, 64)
    assert.equal(parsed.formatVersion, 1); assert.match(saved.name, /^POS-Zanna-cadangan-.*\.json$/)
    assert.deepEqual(await businessSnapshot(db), before)
  } finally { await db.delete() }
})
test('backup lengkap: transaksi CASH/BON/cicilan/HPP/ledger utuh dan source tidak berubah', async () => {
  const f = await richFixture()
  try {
    const before = await businessSnapshot(f.db), saved = await backup(f.db).create(), file = await parseBackup(saved.text)
    assert.deepEqual(file.counts, backupCounts(file.data)); assert.equal(file.counts.sales, 2); assert.equal(file.counts.creditPayments, 1); assert.equal(file.counts.saleItemCosts, 2)
    assert.equal(file.data.receivables[0].balance, 14500)
    assert.deepEqual(JSON.parse(canonical(file.data)), JSON.parse(canonical(before)))
    assert.deepEqual(await businessSnapshot(f.db), before)
  } finally { await f.db.delete() }
})
test('snapshot read konsisten terhadap write bersamaan: tidak mengambil separuh commit', async () => {
  const f = await richFixture()
  try {
    const edit = f.db.transaction('rw', f.db.products, f.db.variants, async () => {
      await f.db.products.update(f.product.id, { name: 'Nama baru serentak' })
      await f.db.variants.update(f.variant.id, { name: 'Varian baru serentak' })
    })
    const saved = backup(f.db).create(); await edit
    const file = (await saved).file
    assert.equal(file.data.products[0].name === 'Nama baru serentak', file.data.variants[0].name === 'Varian baru serentak')
  } finally { await f.db.delete() }
})
test('preview tidak menulis; restore penuh terverifikasi, tidak merge, laporan/Bon/HPP tetap konsisten', async () => {
  const source = await richFixture(), target = await richFixture()
  let restored = 0
  try {
    const saved = await backup(source.db).create(), service = backup(target.db, { ...gate(), restored() { restored++ } })
    await service.create(); const before = await businessSnapshot(target.db), preview = await service.inspect(saved.text)
    assert.deepEqual(await businessSnapshot(target.db), before)
    assert.equal(preview.currentCounts.sales, 2)
    await assert.rejects(service.restore(preview, 'SALAH'), /PULIHKAN DATA/)
    await service.restore(preview, 'PULIHKAN DATA'); assert.equal(restored, 1)
    assert.equal(canonical(await businessSnapshot(target.db)), canonical(saved.file.data))
    assert.equal(await target.db.products.get(target.product.id), undefined)
    const credit = new CreditService(new DexieCreditRepository(target.db)); assert.equal((await credit.overview()).totalOutstanding, 14500)
    const reports = new ReportingService(new DexieReportingRepository(target.db)), report = await reports.read({ preset: 'today' })
    assert.equal(report.revenue, 39000); assert.equal(report.moneyReceived, 24500); assert.equal((await reports.profit(report)).profit, 9000)
    assert.equal((await target.checkout.execute(source.cash)).duplicate, true)
    assert.equal(await target.db.sales.count(), 2)
  } finally { await source.db.delete(); await target.db.delete() }
})
test('restore wajib cadangan kondisi sekarang; preview tidak boleh diganti atau dipakai dua kali', async () => {
  const f = await richFixture()
  try {
    const service = backup(f.db), text = canonical(await makeBackup(await new DexieBackupRepository(f.db).read())), preview = await service.inspect(text)
    await assert.rejects(service.restore(preview, 'PULIHKAN DATA'), /Cadangkan|cadangan data sekarang/)
    await service.create()
    await assert.rejects(service.restore(structuredClone(preview), 'PULIHKAN DATA'), /Periksa/)
    const outcomes = await Promise.allSettled([service.restore(preview, 'PULIHKAN DATA'), service.restore(preview, 'PULIHKAN DATA')])
    assert.equal(outcomes.filter((v) => v.status === 'fulfilled').length, 1)
  } finally { await f.db.delete() }
})
test('master berubah setelah preview: restore ditolak dan data terbaru tetap utuh', async () => {
  const f = await richFixture()
  try {
    const service = backup(f.db), saved = await service.create(), preview = await service.inspect(saved.text)
    await f.db.products.update(f.product.id, { name: 'Perubahan sesudah preview' })
    const before = await businessSnapshot(f.db)
    await assert.rejects(service.restore(preview, 'PULIHKAN DATA'), /berubah sejak/)
    assert.deepEqual(await businessSnapshot(f.db), before)
  } finally { await f.db.delete() }
})
test('transaksi PREPARED target memblokir restore; source PREPARED tetap dipertahankan tanpa autoexecute', async () => {
  const source = await richFixture(), target = await richFixture()
  try {
    const pending = { ...source.cash, checkoutOperationId: crypto.randomUUID() }; await source.checkout.prepare(pending)
    const saved = await backup(source.db).create(), service = backup(target.db)
    const ownPending = { ...target.cash, checkoutOperationId: crypto.randomUUID() }; await target.checkout.prepare(ownPending)
    await service.create(); const preview = await service.inspect(saved.text), before = await businessSnapshot(target.db)
    assert.equal(preview.pendingOperations, 1)
    await assert.rejects(service.restore(preview, 'PULIHKAN DATA'), /tertunda/); assert.deepEqual(await businessSnapshot(target.db), before)
    await target.checkout.cancel(ownPending.checkoutOperationId); await service.create()
    await service.restore(await service.inspect(saved.text), 'PULIHKAN DATA')
    assert.equal((await target.checkout.listUnresolved())[0].checkoutOperationId, pending.checkoutOperationId)
    assert.equal(await target.db.sales.count(), 2)
  } finally { await source.db.delete(); await target.db.delete() }
})
for (const table of ['products', 'saleItems', 'stockMovements', 'creditPayments', 'saleItemCosts'] as const) test(`fault restore saat ${table}: seluruh data awal kembali, tanpa restore parsial`, async () => {
  const source = await richFixture(), target = await richFixture()
  try {
    const saved = await backup(source.db).create(), service = backup(target.db); await service.create()
    const preview = await service.inspect(saved.text), before = await businessSnapshot(target.db)
    const fail = () => { throw new Error(`fault ${table}`) }; target.db.table(table).hook('creating', fail)
    await assert.rejects(service.restore(preview, 'PULIHKAN DATA')); target.db.table(table).hook('creating').unsubscribe(fail)
    assert.deepEqual(await businessSnapshot(target.db), before)
  } finally { await source.db.delete(); await target.db.delete() }
})
test('kegagalan gate/jurnal mencegah pemulihan sebelum ada write', async () => {
  const f = await richFixture()
  try {
    const service = backup(f.db, { ...gate(), checkRecovery() { throw new Error('jurnal belum selesai') } }), saved = await service.create(), preview = await service.inspect(saved.text), before = await businessSnapshot(f.db)
    await assert.rejects(service.restore(preview, 'PULIHKAN DATA'), /jurnal/); assert.deepEqual(await businessSnapshot(f.db), before)
  } finally { await f.db.delete() }
})
test('hasil write yang dimodifikasi hook terdeteksi saat readback dan rollback seluruh penggantian', async () => {
  const source = await richFixture(), target = await richFixture()
  try {
    const exported = await backup(source.db).create(), service = backup(target.db); await service.create()
    const preview = await service.inspect(exported.text), before = await businessSnapshot(target.db)
    const modify = (_key: unknown, row: { name?: string }) => { row.name = 'Unexpected hook change' }
    target.db.products.hook('creating', modify)
    await assert.rejects(service.restore(preview, 'PULIHKAN DATA'), /tidak cocok/)
    target.db.products.hook('creating').unsubscribe(modify); assert.deepEqual(await businessSnapshot(target.db), before)
  } finally { await source.db.delete(); await target.db.delete() }
})
test('file rusak/checksum/versi/metadata salah ditolak, bukan ditebak atau dimigrasi otomatis', async () => {
  const f = await richFixture()
  try {
    const saved = await backup(f.db).create(), before = await businessSnapshot(f.db)
    for (const text of ['not json', '{}', saved.text.replace('POS_ZANNA_BACKUP', 'OTHER'), saved.text.replace('"schemaVersion":5', '"schemaVersion":999'), saved.text.replace('"balance":14500', '"balance":14501')]) await assert.rejects(parseBackup(text))
    assert.deepEqual(await businessSnapshot(f.db), before)
  } finally { await f.db.delete() }
})
const corruptions: [string, (data: BackupData) => void][] = [
  ['duplikat identitas', (d) => { d.products.push(structuredClone(d.products[0])) }],
  ['duplikat barcode', (d) => { d.variants.push({ ...d.variants[0], id: crypto.randomUUID(), sku: 'OTHER' }) }],
  ['kategori hilang', (d) => { d.categories = [] }],
  ['produk item hilang', (d) => { d.saleItems[0].productId = crypto.randomUUID() }],
  ['subtotal salah', (d) => { d.sales[0].total += 1 }],
  ['saldo stok berbeda', (d) => { d.inventoryBalances[0].quantityBase += 1000 }],
  ['opening hilang', (d) => { d.stockMovements = d.stockMovements.filter((m) => m.movementType !== 'OPENING_BALANCE') }],
  ['ledger sale hilang', (d) => { d.stockMovements = d.stockMovements.filter((m) => m.movementType !== 'SALE') }],
  ['tagihan hilang', (d) => { d.receivables = [] }],
  ['saldo piutang salah', (d) => { d.receivables[0].balance += 1 }],
  ['pembayaran hilang', (d) => { d.creditPayments = [] }],
  ['intent pembayaran hilang', (d) => { d.creditPaymentIntents = [] }],
  ['HPP berubah', (d) => { d.saleItemCosts[0].totalCost = 1 }],
  ['tabel rahasia tidak diizinkan', (d) => { Object.assign(d, { authSecrets: [] }) }],
]
for (const [label, mutate] of corruptions) test(`validasi graph backup menolak ${label}`, async () => {
  const f = await richFixture()
  try { const data = await new DexieBackupRepository(f.db).read(), before = await businessSnapshot(f.db); mutate(data); assert.throws(() => validateBackupData(data)); assert.deepEqual(await businessSnapshot(f.db), before) }
  finally { await f.db.delete() }
})
test('kegagalan pembuatan backup tidak mengubah sumber atau menghasilkan file berhasil palsu', async () => {
  const f = await richFixture()
  try {
    await f.db.inventoryBalances.update(f.product.id, { quantityBase: 1 }); const before = await businessSnapshot(f.db)
    await assert.rejects(backup(f.db).create()); assert.deepEqual(await businessSnapshot(f.db), before)
    f.db.close({ disableAutoOpen: true }); await assert.rejects(backup(f.db).create())
  } finally { await f.db.delete() }
})
test('modal lama kosong dan master legacy tanpa policy tetap dapat dicadangkan tanpa perbaikan diam-diam', async () => {
  const f = await richFixture()
  try {
    await f.db.saleItemCosts.clear(); await f.db.products.update(f.product.id, { unitPolicy: undefined })
    const before = await businessSnapshot(f.db), saved = await backup(f.db).create()
    assert.equal(saved.file.data.saleItemCosts.length, 0); assert.deepEqual(await businessSnapshot(f.db), before)
  } finally { await f.db.delete() }
})
test('semua tabel schema 5 wajib dan jumlahnya persis, tanpa tabel tambahan untuk backup', async () => {
  const f = await richFixture()
  try { assert.deepEqual(f.db.tables.map((t) => t.name).sort(), [...BACKUP_TABLES].sort()); assert.equal(f.db.verno, 5) }
  finally { await f.db.delete() }
})
test('operasi bisnis lokal tetap berjalan tanpa jaringan: stok/CASH/Bon/cicilan/laporan/backup/restore', async () => {
  const originalFetch = globalThis.fetch
  let attempted = 0
  globalThis.fetch = async () => { attempted++; throw new Error('network unavailable') }
  let f: Awaited<ReturnType<typeof richFixture>> | undefined
  const target = new ZannaDatabase(`phase7-offline-target-${crypto.randomUUID()}`)
  try {
    f = await richFixture()
    const r = (await f.credit.overview()).receivables[0], pay = { payloadVersion: 1 as const, operationId: crypto.randomUUID(), receivableId: r.id, amount: r.balance, expectedBalance: r.balance }
    await f.credit.prepare(pay); await f.credit.execute(pay)
    const saved = await backup(f.db).create(), service = backup(target); await service.create()
    await service.restore(await service.inspect(saved.text), 'PULIHKAN DATA')
    const reporting = new ReportingService(new DexieReportingRepository(target)), report = await reporting.read({ preset: 'today' })
    assert.equal(report.revenue, 39000); assert.equal(report.outstanding, 0); assert.equal(report.moneyReceived, 39000)
    assert.equal((await reporting.profit(report)).profit, 9000); assert.equal(attempted, 0)
  } finally { globalThis.fetch = originalFetch; if (f) await f.db.delete(); await target.delete() }
})
