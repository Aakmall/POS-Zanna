import { guardedWrite } from './guardedWrite'
import { liveQuery } from 'dexie'
import { CheckoutError } from '../domain/checkout'
import { CreditError, type CreditOverview, type CreditPayment, type CreditPaymentCommand, type CreditPaymentIntent, type CreditPaymentResult, type CreditRepository, type ReceivableDetail } from '../domain/credit'
import { copyCreditPaymentCommand, creditStatus, paymentFingerprint, paymentReceiptNumber, samePaymentRequest, validatePaymentIntent } from '../domain/creditRules'
import { validateCustomer } from '../domain/customerRules'
import { createUuid } from '../domain/id'
import { assertUuid } from '../domain/checkoutValidation'
import type { ZannaDatabase } from './database'
import { DexieCheckoutRepository } from './dexieCheckoutRepository'

export class DexieCreditRepository implements CreditRepository {
  private readonly db: ZannaDatabase
  private readonly checkout: DexieCheckoutRepository
  constructor(db: ZannaDatabase) { this.db = db; this.checkout = new DexieCheckoutRepository(db) }
  private tables() { return [this.db.customers, this.db.sales, this.db.saleItems, this.db.checkoutIntents, this.db.stockMovements, this.db.receivables, this.db.creditPayments, this.db.creditPaymentIntents] }
  private async safe<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation() }
    catch (cause) {
      if (cause instanceof CreditError) throw cause
      if (cause instanceof CheckoutError && cause.code !== 'STORAGE_ERROR') throw new CreditError('INTEGRITY_ERROR', 'Data Bon atau pembayaran tidak konsisten. Jangan menerima pembayaran pengganti sebelum data diperiksa.', { cause })
      throw new CreditError('STORAGE_ERROR', 'Penyimpanan Bon belum dapat dipastikan. Periksa hasil dengan ID operasi yang sama; jangan menerima uang lagi.', { cause })
    }
  }
  private async detailInTransaction(id: string): Promise<ReceivableDetail> {
    const receivable = await this.db.receivables.get(id)
    if (!receivable) throw new CreditError('NOT_FOUND', 'Tagihan tidak ditemukan.')
    const sale = await this.checkout.getResult(receivable.checkoutOperationId)
    if (!sale || sale.sale.id !== receivable.saleId || sale.sale.paymentMethod !== 'BON') throw new CreditError('INTEGRITY_ERROR', 'Tagihan tidak mempunyai penjualan Bon yang sesuai.')
    // getResult validates Sale/Item/stock ledger AND the full receivable/payment graph.
    const payments = await this.db.creditPayments.where('receivableId').equals(id).toArray()
    payments.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    return { receivable, payments, sale }
  }
  async overview(): Promise<CreditOverview> {
    return this.safe(() => this.db.transaction('r', this.tables(), async () => {
      const [customers, receivables, bonSales] = await Promise.all([this.db.customers.orderBy('name').toArray(), this.db.receivables.toArray(), this.db.sales.where('paymentMethod').equals('BON').toArray()])
      for (const customer of customers) validateCustomer(customer)
      if (bonSales.length !== receivables.length || bonSales.some((sale) => !receivables.some((entry) => entry.saleId === sale.id))) throw new CreditError('INTEGRITY_ERROR', 'Jumlah penjualan Bon dan tagihan tidak sesuai.')
      let total = 0n
      for (const receivable of receivables) {
        if (!customers.some((customer) => customer.id === receivable.customerId)) throw new CreditError('INTEGRITY_ERROR', 'Pelanggan tagihan tidak ditemukan; histori tidak boleh dihapus.')
        await this.detailInTransaction(receivable.id)
        total += BigInt(receivable.balance)
      }
      if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new CreditError('INTEGRITY_ERROR', 'Total piutang melampaui presisi angka yang didukung.')
      return { customers, receivables: receivables.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)), totalOutstanding: Number(total) }
    }))
  }
  async detail(id: string) { assertUuid(id, 'ID tagihan'); return this.safe(() => this.db.transaction('r', this.tables(), () => this.detailInTransaction(id))) }
  subscribe(next: (overview: CreditOverview) => void, error: (cause: unknown) => void) {
    const subscription = liveQuery(() => this.overview()).subscribe({ next, error })
    return () => subscription.unsubscribe()
  }
  private async paymentState(id: string): Promise<{ intent: CreditPaymentIntent | null; result: CreditPaymentResult | null }> {
    const intent = await this.db.creditPaymentIntents.get(id) ?? null
    const payment = await this.db.creditPayments.where('operationId').equals(id).first()
    if (intent) { try { validatePaymentIntent(intent) } catch (cause) { throw new CreditError('INTEGRITY_ERROR', 'Intent pembayaran tersimpan tidak konsisten.', { cause }) } }
    if (!payment) {
      if (intent?.status === 'COMMITTED') throw new CreditError('INTEGRITY_ERROR', 'Intent pembayaran COMMITTED tanpa bukti pembayaran.')
      return { intent, result: null }
    }
    if (!intent || intent.status !== 'COMMITTED' || intent.paymentId !== payment.id) throw new CreditError('INTEGRITY_ERROR', 'Pembayaran tidak memiliki intent COMMITTED yang sesuai.')
    try { await this.detailInTransaction(payment.receivableId) }
    catch (cause) {
      if (cause instanceof CreditError && cause.code === 'NOT_FOUND') throw new CreditError('INTEGRITY_ERROR', 'Pembayaran tersimpan tanpa tagihan.', { cause })
      throw cause
    }
    return { intent, result: { payment, duplicate: true } }
  }
  async prepare(incoming: CreditPaymentCommand): Promise<CreditPaymentIntent> {
    const command = copyCreditPaymentCommand(incoming)
    return this.safe(() => guardedWrite(this.db, () => this.db.transaction('rw', this.tables(), async () => {
      const { intent } = await this.paymentState(command.operationId)
      if (intent) {
        samePaymentRequest(intent, command)
        if (intent.status === 'CANCELLED') throw new CreditError('INTENT_CANCELLED', 'Pembayaran ini sudah dibatalkan. Tinjau nominal sebelum konfirmasi baru.')
        return { ...intent, command: copyCreditPaymentCommand(intent.command) }
      }
      const prepared: CreditPaymentIntent = { operationId: command.operationId, receivableId: command.receivableId, command, requestFingerprint: paymentFingerprint(command), createdAt: new Date().toISOString(), status: 'PREPARED' }
      await this.db.creditPaymentIntents.add(prepared)
      return prepared
    })))
  }
  async execute(incoming: CreditPaymentCommand): Promise<CreditPaymentResult> {
    const command = copyCreditPaymentCommand(incoming)
    return this.safe(() => guardedWrite(this.db, () => this.db.transaction('rw', this.tables(), async () => {
      const { intent, result } = await this.paymentState(command.operationId)
      if (result) { samePaymentRequest(result.payment, command); return result }
      if (!intent) throw new CreditError('INTENT_REQUIRED', 'Simpan konfirmasi pembayaran terlebih dahulu.')
      samePaymentRequest(intent, command)
      if (intent.status === 'CANCELLED') throw new CreditError('INTENT_CANCELLED', 'Pembayaran sudah dibatalkan.')
      const { receivable } = await this.detailInTransaction(command.receivableId)
      if (receivable.balance !== command.expectedBalance) throw new CreditError('BALANCE_CHANGED', 'Sisa Utang berubah. Batalkan intent ini lalu buka ulang tagihan untuk meninjau nominal terbaru.')
      if (command.amount > receivable.balance) throw new CreditError('PAYMENT_TOO_LARGE', 'Pembayaran melebihi Sisa Utang.')
      const createdAt = new Date(Math.max(Date.now(), Date.parse(receivable.updatedAt) + 1, Date.parse(intent.createdAt))).toISOString(), id = createUuid()
      const payment: CreditPayment = { id, operationId: command.operationId, receivableId: receivable.id, saleId: receivable.saleId,
        customerId: receivable.customerId, customerSnapshot: { ...receivable.customerSnapshot }, saleReceiptNumber: receivable.receiptNumber,
        receiptNumber: paymentReceiptNumber(id, createdAt), amount: command.amount, balanceBefore: receivable.balance, balanceAfter: receivable.balance - command.amount,
        paymentMethod: 'CASH', createdAt, requestFingerprint: intent.requestFingerprint }
      const totalPaid = receivable.totalPaid + command.amount
      await this.db.creditPayments.add(payment)
      await this.db.receivables.put({ ...receivable, totalPaid, balance: payment.balanceAfter, status: creditStatus(receivable.originalAmount, totalPaid), updatedAt: createdAt })
      await this.db.creditPaymentIntents.put({ ...intent, status: 'COMMITTED', paymentId: id })
      const stored = await this.paymentState(command.operationId)
      if (!stored.result) throw new CreditError('INTEGRITY_ERROR', 'Bukti pembayaran tidak ditemukan setelah penulisan.')
      return { ...stored.result, duplicate: false }
    })))
  }
  async getPayment(id: string) { assertUuid(id, 'ID pembayaran'); return this.safe(() => this.db.transaction('r', this.tables(), async () => (await this.paymentState(id)).result)) }
  async listUnresolved(): Promise<readonly CreditPaymentIntent[]> {
    return this.safe(() => this.db.transaction('r', this.tables(), async () => {
      const pending = await this.db.creditPaymentIntents.where('status').equals('PREPARED').toArray()
      for (const intent of pending) await this.paymentState(intent.operationId)
      return pending.map((intent) => ({ ...intent, command: copyCreditPaymentCommand(intent.command) }))
    }))
  }
  async cancel(incoming: CreditPaymentCommand): Promise<CreditPaymentResult | null> {
    const command = copyCreditPaymentCommand(incoming)
    return this.safe(() => guardedWrite(this.db, () => this.db.transaction('rw', this.tables(), async () => {
      const { intent, result } = await this.paymentState(command.operationId)
      if (result) { samePaymentRequest(result.payment, command); return result }
      if (intent) samePaymentRequest(intent, command)
      // A cancellation can precede prepare: late retries cannot revive this operation.
      const cancelled: CreditPaymentIntent = { operationId: command.operationId, receivableId: command.receivableId, command,
        requestFingerprint: paymentFingerprint(command), createdAt: intent?.createdAt ?? new Date().toISOString(), status: 'CANCELLED' }
      await this.db.creditPaymentIntents.put(cancelled)
      return null
    })))
  }
}
