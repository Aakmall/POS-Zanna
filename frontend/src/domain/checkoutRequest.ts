import { CheckoutError, type CheckoutCommand, type CheckoutIntent } from './checkout'
import { assertCheckoutQuantity, assertMoney, calculateChange, MAX_CHECKOUT_LINES } from './checkoutMath'
import { assertRecord, assertTimestamp, assertUuid } from './checkoutValidation'

export function validateCheckoutCommand(value: unknown): asserts value is CheckoutCommand {
  assertRecord(value, 'Request checkout'); assertUuid(value.checkoutOperationId, 'ID operasi checkout')
  if (value.payloadVersion !== 1 || value.paymentMethod !== 'CASH') throw new CheckoutError('INVALID_REQUEST', 'Hanya payload v1 dan pembayaran CASH yang didukung.')
  assertMoney(value.expectedTotal, 'Total konfirmasi'); assertMoney(value.cashReceived, 'Uang diterima')
  if (!Array.isArray(value.lines) || !value.lines.length || value.lines.length > MAX_CHECKOUT_LINES) throw new CheckoutError('INVALID_REQUEST', 'Keranjang harus berisi 1–100 varian unik.')
  const variants = new Set<string>()
  for (const line of value.lines) {
    assertRecord(line, 'Baris checkout'); assertUuid(line.variantId, 'ID varian')
    if (variants.has(line.variantId)) throw new CheckoutError('INVALID_REQUEST', 'Varian duplikat pada request checkout.')
    variants.add(line.variantId)
    assertRecord(line.expected, 'Konfirmasi varian')
    const expected = line.expected
    for (const field of ['productId', 'baseUnitId', 'sellingUnitId'] as const) assertUuid(expected[field], field)
    if (expected.saleMode !== 'fixed' && expected.saleMode !== 'variable') throw new CheckoutError('INVALID_REQUEST', 'Mode penjualan tidak valid.')
    assertCheckoutQuantity(line.quantity, expected.saleMode); assertMoney(expected.unitPrice, 'Harga konfirmasi')
    if (typeof expected.quantityInBaseUnit !== 'number' || !Number.isSafeInteger(expected.quantityInBaseUnit) || expected.quantityInBaseUnit <= 0 || expected.quantityInBaseUnit > 1_000_000_000) throw new CheckoutError('INVALID_REQUEST', 'Faktor konfirmasi tidak valid.')
    assertTimestamp(expected.productUpdatedAt); assertTimestamp(expected.variantUpdatedAt)
  }
  calculateChange(value.cashReceived, value.expectedTotal)
}
export function copyCheckoutCommand(value: unknown): CheckoutCommand {
  validateCheckoutCommand(value)
  const lines = Object.freeze(value.lines.map((line) => Object.freeze({
    variantId: line.variantId, quantity: line.quantity,
    expected: Object.freeze({ productId: line.expected.productId, baseUnitId: line.expected.baseUnitId,
      sellingUnitId: line.expected.sellingUnitId, saleMode: line.expected.saleMode,
      quantityInBaseUnit: line.expected.quantityInBaseUnit, unitPrice: line.expected.unitPrice,
      productUpdatedAt: line.expected.productUpdatedAt, variantUpdatedAt: line.expected.variantUpdatedAt }),
  })))
  return Object.freeze({ payloadVersion: value.payloadVersion, checkoutOperationId: value.checkoutOperationId,
    paymentMethod: value.paymentMethod, lines, expectedTotal: value.expectedTotal, cashReceived: value.cashReceived })
}
export function checkoutFingerprint(value: unknown): string {
  const command = copyCheckoutCommand(value)
  return JSON.stringify([command.payloadVersion, command.paymentMethod, command.cashReceived, command.expectedTotal,
    command.lines.map((line) => [line.variantId, line.quantity, line.expected.productId, line.expected.baseUnitId,
      line.expected.sellingUnitId, line.expected.saleMode, line.expected.quantityInBaseUnit, line.expected.unitPrice,
      line.expected.productUpdatedAt, line.expected.variantUpdatedAt])])
}
export function assertSameCheckoutRequest(stored: { checkoutOperationId: string; requestFingerprint: string }, incoming: unknown): void {
  validateCheckoutCommand(incoming)
  if (stored.checkoutOperationId !== incoming.checkoutOperationId || stored.requestFingerprint !== checkoutFingerprint(incoming)) throw new CheckoutError('OPERATION_PAYLOAD_MISMATCH', 'ID operasi checkout sudah digunakan dengan isi berbeda.')
}
export function validateCheckoutIntent(value: unknown): asserts value is CheckoutIntent {
  assertRecord(value, 'Checkout intent'); assertUuid(value.checkoutOperationId, 'ID intent'); assertTimestamp(value.createdAt)
  validateCheckoutCommand(value.command)
  if (value.checkoutOperationId !== value.command.checkoutOperationId || value.requestFingerprint !== checkoutFingerprint(value.command)) throw new CheckoutError('OPERATION_PAYLOAD_MISMATCH', 'Identitas/fingerprint intent tidak sesuai command.')
  if (value.status === 'COMMITTED') assertUuid(value.saleId, 'ID penjualan intent')
  else if ((value.status !== 'PREPARED' && value.status !== 'CANCELLED') || value.saleId !== undefined) throw new CheckoutError('INVALID_REQUEST', 'Status intent atau referensi saleId tidak sesuai.')
}
