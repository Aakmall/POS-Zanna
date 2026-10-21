import { QUANTITY_SCALE } from './product'
import { CheckoutError } from './checkout'

export const MAX_CHECKOUT_MONEY = 1_000_000_000
export const MAX_CHECKOUT_QUANTITY = 1_000_000_000
export const MAX_CHECKOUT_LINES = 100
export function assertMoney(value: unknown, label = 'Nilai uang'): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > MAX_CHECKOUT_MONEY) throw new CheckoutError('INVALID_REQUEST', `${label} harus integer Rupiah 0–1.000.000.000.`)
}
export function assertCheckoutQuantity(value: unknown, mode: 'fixed' | 'variable'): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0 || value > MAX_CHECKOUT_QUANTITY) throw new CheckoutError('INVALID_REQUEST', 'Jumlah checkout harus scaled integer positif dan dalam batas 1.000.000 satuan jual.')
  if (mode === 'fixed' && value % QUANTITY_SCALE !== 0) throw new CheckoutError('INVALID_REQUEST', 'Jumlah fixed harus kemasan/satuan jual bulat dalam skala 1000.')
}
export function scaleFixedQuantity(count: number): number {
  if (!Number.isSafeInteger(count) || count <= 0 || count > MAX_CHECKOUT_QUANTITY / QUANTITY_SCALE) throw new CheckoutError('INVALID_REQUEST', 'Jumlah kemasan bulat tidak valid.')
  return Number(BigInt(count) * BigInt(QUANTITY_SCALE))
}
export function calculateLineTotal(unitPrice: number, quantity: number): number {
  assertMoney(unitPrice, 'Harga per satuan')
  assertCheckoutQuantity(quantity, 'variable') // Unit/mode compatibility is checked by the contextual calculator.
  const result = (BigInt(unitPrice) * BigInt(quantity) + BigInt(QUANTITY_SCALE / 2)) / BigInt(QUANTITY_SCALE)
  if (result > BigInt(MAX_CHECKOUT_MONEY)) throw new CheckoutError('INVALID_REQUEST', 'Nilai baris melampaui batas transaksi.')
  return Number(result)
}
export function sumLineTotals(values: readonly number[]): number {
  let result = 0n
  for (const value of values) { assertMoney(value, 'Nilai baris'); result += BigInt(value) }
  if (result > BigInt(MAX_CHECKOUT_MONEY)) throw new CheckoutError('INVALID_REQUEST', 'Total melampaui batas transaksi.')
  return Number(result)
}
export function calculateChange(cashReceived: number, total: number): number {
  assertMoney(cashReceived, 'Uang diterima'); assertMoney(total, 'Total')
  if (cashReceived < total) throw new CheckoutError('CASH_INSUFFICIENT', 'Uang diterima kurang dari total.')
  return Number(BigInt(cashReceived) - BigInt(total))
}
