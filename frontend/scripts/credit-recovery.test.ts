import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CreditError, type CreditPaymentCommand } from '../src/domain/credit'
import { DexieCreditRepository } from '../src/data/dexieCreditRepository'
import { CreditService } from '../src/services/creditOperations'
import { CreditPaymentController, type PaymentClient } from '../src/features/credit/paymentController'
import type { PaymentRecoveryStore } from '../src/features/credit/paymentRecovery'
import { creditFixture, bonCommand } from './credit-fixtures'

async function setup() {
  const f = await creditFixture(), command = await bonCommand(f)
  await f.checkout.prepare(command); await f.checkout.execute(command)
  const service = new CreditService(new DexieCreditRepository(f.db)), debt = (await f.db.receivables.toArray())[0]
  const journal = new Map<string, CreditPaymentCommand>()
  const storage: PaymentRecoveryStore = { pending: () => [...journal.values()], save: (command) => { journal.set(command.operationId, command) }, resolve: (id) => { journal.delete(id) } }
  const client: PaymentClient = { prepare: (command) => service.prepare(command), execute: (command) => service.execute(command), getPayment: (id) => service.getPayment(id), listUnresolved: () => service.listUnresolved(), cancel: (command) => service.cancel(command) }
  return { ...f, service, debt, journal, storage, client }
}
test('controller double-click sinkron: hanya satu intent dan pembayaran', async () => {
  const f = await setup()
  try {
    const controller = new CreditPaymentController(f.client, f.storage); await controller.boot(); controller.begin(f.debt)
    await Promise.all([controller.confirm(5000), controller.confirm(5000), controller.confirm(5000)])
    assert.equal(controller.getSnapshot().status, 'success'); assert.equal(await f.db.creditPayments.count(), 1)
    assert.equal((await f.service.detail(f.debt.id)).receivable.balance, 14500); assert.equal(f.journal.size, 0)
  } finally { await f.db.delete() }
})
test('response pembayaran hilang: uncertain menahan close/confirm/resume, check membuka bukti yang sama', async () => {
  const f = await setup()
  try {
    f.client.execute = async (command) => { await f.service.execute(command); throw new CreditError('STORAGE_ERROR', 'Response lost') }
    const controller = new CreditPaymentController(f.client, f.storage); await controller.boot(); controller.begin(f.debt); await controller.confirm(5000)
    const id = controller.getSnapshot().command!.operationId
    assert.equal(controller.getSnapshot().status, 'uncertain'); controller.close(); await controller.resume(); await controller.confirm(5000)
    assert.equal(controller.getSnapshot().open, true); assert.equal(await f.db.creditPayments.count(), 1)
    await controller.check(); assert.equal(controller.getSnapshot().result!.payment.operationId, id); assert.equal(controller.getSnapshot().status, 'success')
    assert.equal(await f.db.creditPayments.count(), 1)
  } finally { await f.db.delete() }
})
test('refresh PREPARED: jurnal dan DB memulihkan UUID, tidak autoexecute, pembayaran baru terkunci', async () => {
  const f = await setup()
  try {
    f.client.execute = async () => { throw new CreditError('STORAGE_ERROR', 'Interrupted before commit') }
    const old = new CreditPaymentController(f.client, f.storage); await old.boot(); old.begin(f.debt); await old.confirm(5000)
    const id = old.getSnapshot().command!.operationId
    const fresh = new CreditPaymentController(f.service, f.storage); await fresh.boot()
    assert.equal(await f.db.creditPayments.count(), 0); assert.equal(fresh.locked, true)
    fresh.begin(f.debt); assert.equal(fresh.getSnapshot().open, false)
    await fresh.select(fresh.getSnapshot().pending[0]); assert.equal(fresh.getSnapshot().command!.operationId, id)
    await fresh.resume(); assert.equal(fresh.getSnapshot().result!.payment.operationId, id); assert.equal(await f.db.creditPayments.count(), 1)
  } finally { await f.db.delete() }
})
test('jurnal gagal ditulis: tidak prepare/execute, perbaiki lalu retry dengan ID yang sama', async () => {
  const f = await setup()
  try {
    let blocked = true
    const storage: PaymentRecoveryStore = { ...f.storage, save: (command) => { if (blocked) throw new Error('Storage disabled'); f.storage.save(command) } }
    const controller = new CreditPaymentController(f.service, storage); await controller.boot(); controller.begin(f.debt); await controller.confirm(5000)
    const id = controller.getSnapshot().command!.operationId
    assert.equal(await f.db.creditPaymentIntents.count(), 0); assert.equal(await f.db.creditPayments.count(), 0)
    blocked = false; await controller.check(); await controller.resume()
    assert.equal(controller.getSnapshot().result!.payment.operationId, id)
  } finally { await f.db.delete() }
})
test('jurnal rusak/read DB gagal mengunci pembayaran sampai check berhasil; tidak menghapus jurnal', async () => {
  const f = await setup()
  try {
    let broken = true
    const storage: PaymentRecoveryStore = { ...f.storage, pending: () => { if (broken) throw new Error('Malformed journal'); return f.storage.pending() } }
    const controller = new CreditPaymentController(f.service, storage); await controller.boot(); controller.begin(f.debt)
    assert.equal(controller.getSnapshot().status, 'uncertain'); assert.equal(controller.getSnapshot().ready, false)
    assert.equal(await f.db.creditPayments.count(), 0)
    broken = false; await controller.check(); assert.equal(controller.locked, false)
  } finally { await f.db.delete() }
})
test('pembatalan setelah prepare gagal: tombstone CANCELLED menolak request terlambat', async () => {
  const f = await setup()
  try {
    f.client.prepare = async () => { throw new CreditError('STORAGE_ERROR', 'Prepare lost') }
    const controller = new CreditPaymentController(f.client, f.storage); await controller.boot(); controller.begin(f.debt); await controller.confirm(5000)
    const command = controller.getSnapshot().command!
    await controller.check(); await controller.cancel()
    assert.equal(controller.getSnapshot().command, null); assert.equal((await f.db.creditPaymentIntents.get(command.operationId))!.status, 'CANCELLED')
    await assert.rejects(f.service.prepare(command), (cause: unknown) => cause instanceof CreditError && cause.code === 'INTENT_CANCELLED')
    assert.equal(await f.db.creditPayments.count(), 0)
  } finally { await f.db.delete() }
})
