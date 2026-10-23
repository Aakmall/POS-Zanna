import { CreditError, type CreditPayment, type CreditPaymentCommand, type CreditPaymentIntent, type Receivable, type ReceivableStatus } from './credit'
import { assertMoney } from './checkoutMath'
import { assertRecord, assertTimestamp, assertUuid } from './checkoutValidation'
import { customerSnapshotKey, validateCustomerSnapshot, validateDueDate } from './customerRules'
import type { Sale } from './sale'
import { validateSaleHeader } from './saleRules'

export function creditStatus(original: number, paid: number): ReceivableStatus { return paid === original ? 'PAID' : paid === 0 ? 'UNPAID' : 'PARTIAL' }
function checkedPaymentCommand(value: unknown): CreditPaymentCommand {
  assertRecord(value, 'Pembayaran Bon'); assertUuid(value.operationId, 'ID operasi pembayaran'); assertUuid(value.receivableId, 'ID tagihan')
  assertMoney(value.amount, 'Pembayaran'); assertMoney(value.expectedBalance, 'Sisa utang konfirmasi')
  if (value.payloadVersion !== 1 || value.amount <= 0) throw new CreditError('INVALID_REQUEST', 'Pembayaran wajib rupiah bulat lebih dari nol.')
  if (value.amount > value.expectedBalance) throw new CreditError('PAYMENT_TOO_LARGE', 'Pembayaran tidak boleh melebihi sisa utang.')
  return Object.freeze({ payloadVersion: 1, operationId: value.operationId, receivableId: value.receivableId, amount: value.amount, expectedBalance: value.expectedBalance })
}
export function copyCreditPaymentCommand(value: unknown): CreditPaymentCommand {
  try { return checkedPaymentCommand(value) }
  catch (cause) { if (cause instanceof CreditError) throw cause; throw new CreditError('INVALID_REQUEST', cause instanceof Error ? cause.message : 'Pembayaran tidak valid.', { cause }) }
}
export function paymentFingerprint(value: unknown) {
  const command = copyCreditPaymentCommand(value)
  return JSON.stringify([1, command.receivableId, command.amount, command.expectedBalance])
}
export function validatePaymentIntent(intent: CreditPaymentIntent) {
  assertUuid(intent.operationId, 'ID intent pembayaran'); assertTimestamp(intent.createdAt)
  const command = copyCreditPaymentCommand(intent.command)
  if (intent.operationId !== command.operationId || intent.receivableId !== command.receivableId || intent.requestFingerprint !== paymentFingerprint(command)) throw new CreditError('INTEGRITY_ERROR', 'Identitas intent pembayaran tidak sesuai.')
  if (intent.status === 'COMMITTED') assertUuid(intent.paymentId, 'ID pembayaran')
  else if (!['PREPARED', 'CANCELLED'].includes(intent.status) || intent.paymentId !== undefined) throw new CreditError('INTEGRITY_ERROR', 'Status intent pembayaran tidak sesuai.')
}
export function samePaymentRequest(stored: { operationId: string; requestFingerprint: string }, command: CreditPaymentCommand) {
  if (stored.operationId !== command.operationId || stored.requestFingerprint !== paymentFingerprint(command)) throw new CreditError('OPERATION_PAYLOAD_MISMATCH', 'ID pembayaran sudah digunakan dengan nominal atau tagihan berbeda.')
}
export function paymentReceiptNumber(id: string, stamp: string) {
  assertUuid(id, 'ID pembayaran'); assertTimestamp(stamp)
  return `ZCP-${stamp.slice(0, 10).replaceAll('-', '')}-${id}`
}
export function newReceivable(sale: Sale, id: string): Receivable {
  if (sale.paymentMethod !== 'BON' || !sale.customerSnapshot || sale.dueDate === undefined) throw new CreditError('INTEGRITY_ERROR', 'Tagihan hanya dibuat dari penjualan Bon lengkap.')
  return { id, saleId: sale.id, checkoutOperationId: sale.checkoutOperationId, customerId: sale.customerSnapshot.id,
    customerSnapshot: { ...sale.customerSnapshot }, receiptNumber: sale.receiptNumber, createdAt: sale.createdAt, updatedAt: sale.createdAt,
    dueDate: sale.dueDate, originalAmount: sale.total, totalPaid: 0, balance: sale.total, status: 'UNPAID' }
}

// Sale total + immutable payment events are the authority. Receivable is a checked projection.
// No current master/customer or current inventory balance is used for historical validation.
export function validateReceivableGraph(receivable: Receivable, sale: Sale, incoming: readonly CreditPayment[], intents: readonly CreditPaymentIntent[]) {
  validateSaleHeader(sale)
  for (const id of [receivable.id, receivable.saleId, receivable.checkoutOperationId, receivable.customerId]) assertUuid(id, 'ID relasi tagihan')
  validateCustomerSnapshot(receivable.customerSnapshot); validateDueDate(receivable.dueDate)
  assertTimestamp(receivable.createdAt); assertTimestamp(receivable.updatedAt)
  for (const amount of [receivable.originalAmount, receivable.totalPaid, receivable.balance]) assertMoney(amount)
  if (sale.paymentMethod !== 'BON' || !sale.customerSnapshot || receivable.saleId !== sale.id || receivable.checkoutOperationId !== sale.checkoutOperationId ||
    receivable.customerId !== sale.customerSnapshot.id || customerSnapshotKey(receivable.customerSnapshot) !== customerSnapshotKey(sale.customerSnapshot) ||
    receivable.receiptNumber !== sale.receiptNumber || receivable.originalAmount !== sale.total || receivable.dueDate !== sale.dueDate || receivable.createdAt !== sale.createdAt) throw new CreditError('INTEGRITY_ERROR', 'Relasi penjualan dan tagihan tidak konsisten.')
  const payments = [...incoming].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  for (const intent of intents) {
    validatePaymentIntent(intent)
    if (intent.receivableId !== receivable.id || (intent.status === 'COMMITTED' && !payments.some((payment) => payment.id === intent.paymentId && payment.operationId === intent.operationId))) throw new CreditError('INTEGRITY_ERROR', 'Intent pembayaran mengacu ke pembayaran yang hilang.')
  }
  let balance = receivable.originalAmount, lastTime = receivable.createdAt
  const operations = new Set<string>(), ids = new Set<string>()
  for (const payment of payments) {
    assertUuid(payment.id, 'ID pembayaran'); assertUuid(payment.operationId, 'ID operasi pembayaran'); assertTimestamp(payment.createdAt)
    validateCustomerSnapshot(payment.customerSnapshot)
    for (const amount of [payment.amount, payment.balanceBefore, payment.balanceAfter]) assertMoney(amount)
    const matches = intents.filter((intent) => intent.operationId === payment.operationId)
    if (matches.length !== 1) throw new CreditError('INTEGRITY_ERROR', 'Pembayaran tidak mempunyai tepat satu intent.')
    const intent = matches[0]; validatePaymentIntent(intent)
    if (intent.status !== 'COMMITTED' || intent.paymentId !== payment.id || intent.receivableId !== receivable.id ||
      payment.receivableId !== receivable.id || payment.saleId !== sale.id || payment.customerId !== receivable.customerId ||
      customerSnapshotKey(payment.customerSnapshot) !== customerSnapshotKey(receivable.customerSnapshot) || payment.saleReceiptNumber !== sale.receiptNumber ||
      payment.paymentMethod !== 'CASH' || payment.amount <= 0 || payment.amount > balance || payment.balanceBefore !== balance || payment.balanceAfter !== balance - payment.amount ||
      intent.command.amount !== payment.amount || intent.command.expectedBalance !== payment.balanceBefore || payment.requestFingerprint !== intent.requestFingerprint ||
      payment.receiptNumber !== paymentReceiptNumber(payment.id, payment.createdAt) || payment.createdAt <= lastTime || payment.createdAt < intent.createdAt || operations.has(payment.operationId) || ids.has(payment.id)) throw new CreditError('INTEGRITY_ERROR', 'Rantai saldo atau snapshot pembayaran tidak konsisten.')
    operations.add(payment.operationId); ids.add(payment.id); balance = payment.balanceAfter; lastTime = payment.createdAt
  }
  if (receivable.balance !== balance || receivable.totalPaid !== receivable.originalAmount - balance || receivable.status !== creditStatus(receivable.originalAmount, receivable.totalPaid) || receivable.updatedAt !== lastTime) throw new CreditError('INTEGRITY_ERROR', 'Sisa utang berbeda dari penjualan dikurangi pembayaran. Jangan menerima cicilan sebelum data diperiksa.')
}
