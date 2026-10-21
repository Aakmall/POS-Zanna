import type { ConversionSnapshot } from './inventory'
import { CheckoutError } from './checkout'
import { PRICING_POLICY, type Sale, type SaleItem } from './sale'
import { assertCheckoutQuantity, assertMoney, calculateChange, calculateLineTotal, MAX_CHECKOUT_LINES, sumLineTotals } from './checkoutMath'
import { assertRecord, assertText, assertTimestamp, assertUnitSnapshot, assertUuid, unitSnapshotKey } from './checkoutValidation'
import { convertInventoryQuantity, MAX_STOCK_BASE } from './inventoryRules'
import { validateConversion } from './validation'

export function formatReceiptNumber(saleId: string, createdAt: string): string {
  assertUuid(saleId, 'ID penjualan'); assertTimestamp(createdAt)
  return `ZC-${createdAt.slice(0, 10).replaceAll('-', '')}-${saleId}`
}
export function validateSaleItem(value: unknown): asserts value is SaleItem {
  assertRecord(value, 'Item penjualan')
  for (const field of ['id', 'saleId', 'productId', 'variantId'] as const) assertUuid(value[field], field)
  if (typeof value.position !== 'number' || !Number.isSafeInteger(value.position) || value.position < 1 || value.position > MAX_CHECKOUT_LINES) throw new CheckoutError('INVALID_REQUEST', 'Urutan item penjualan tidak valid.')
  assertText(value.productNameSnapshot, 'Nama produk snapshot', 100); assertText(value.variantNameSnapshot, 'Nama varian snapshot', 80)
  if (value.saleModeSnapshot !== 'fixed' && value.saleModeSnapshot !== 'variable') throw new CheckoutError('INVALID_REQUEST', 'Mode snapshot tidak valid.')
  assertCheckoutQuantity(value.quantity, value.saleModeSnapshot)
  assertMoney(value.unitPriceSnapshot, 'Harga snapshot'); assertMoney(value.lineTotal, 'Nilai baris')
  assertUnitSnapshot(value.unitSnapshot); assertRecord(value.conversionSnapshot, 'Konversi snapshot')
  const conversion = value.conversionSnapshot
  assertUnitSnapshot(conversion.baseUnit); assertUnitSnapshot(conversion.inputUnit)
  if (conversion.source !== 'variant' || conversion.variantId !== value.variantId || conversion.variantName !== value.variantNameSnapshot || typeof conversion.quantityInBaseUnit !== 'number') throw new CheckoutError('INVALID_REQUEST', 'Snapshot konversi penjualan harus sesuai varian dan namanya.')
  if (unitSnapshotKey(value.unitSnapshot) !== unitSnapshotKey(conversion.inputUnit)) throw new CheckoutError('INVALID_REQUEST', 'Snapshot satuan jual berbeda dari satuan konversi.')
  const snapshot: ConversionSnapshot = { baseUnit: conversion.baseUnit, inputUnit: conversion.inputUnit,
    source: 'variant', variantId: value.variantId as string, variantName: value.variantNameSnapshot, quantityInBaseUnit: conversion.quantityInBaseUnit }
  let quantityBase: number
  try {
    validateConversion(snapshot.baseUnit, snapshot.inputUnit, snapshot.quantityInBaseUnit, value.saleModeSnapshot)
    quantityBase = convertInventoryQuantity(value.quantity, snapshot)
  } catch (cause) { throw new CheckoutError('INVALID_REQUEST', cause instanceof Error ? cause.message : 'Snapshot konversi tidak valid.') }
  if (typeof value.quantityBase !== 'number' || !Number.isSafeInteger(value.quantityBase) || value.quantityBase <= 0 || value.quantityBase > MAX_STOCK_BASE || value.quantityBase !== quantityBase) throw new CheckoutError('INVALID_REQUEST', 'Quantity base snapshot tidak sesuai hasil konversi tepat.')
  if (value.lineTotal !== calculateLineTotal(value.unitPriceSnapshot, value.quantity)) throw new CheckoutError('INVALID_REQUEST', 'Nilai baris tidak sesuai HALF_UP_LINE_V1.')
}

// Shared header checks allow bounded history queries without reading every SaleItem.
export function validateSaleHeader(value: unknown): asserts value is Sale {
  assertRecord(value, 'Penjualan')
  assertUuid(value.id, 'ID penjualan'); assertUuid(value.checkoutOperationId, 'ID operasi checkout'); assertTimestamp(value.createdAt)
  if (value.status !== 'COMPLETED' || value.paymentMethod !== 'CASH' || value.pricingPolicy !== PRICING_POLICY) throw new CheckoutError('INVALID_REQUEST', 'Status, metode, atau pricing policy penjualan tidak didukung.')
  if (value.receiptNumber !== formatReceiptNumber(value.id, value.createdAt)) throw new CheckoutError('INVALID_REQUEST', 'Nomor struk tidak sesuai identitas/tanggal UTC penjualan.')
  assertText(value.requestFingerprint, 'Fingerprint penjualan', 100000)
  if (value.operatorId !== null) assertUuid(value.operatorId, 'ID operator')
  assertMoney(value.subtotal, 'Subtotal'); assertMoney(value.total, 'Total'); assertMoney(value.cashReceived, 'Uang diterima'); assertMoney(value.changeAmount, 'Kembalian')
  if (value.subtotal !== value.total || value.changeAmount !== calculateChange(value.cashReceived, value.total)) throw new CheckoutError('INVALID_REQUEST', 'Total atau kembalian penjualan tidak sesuai.')
}

// Historical validation uses snapshots, never current master names/prices/policy.
// This does not prove persistence, foreign keys or inventory atomicity.
export function validateSale(value: unknown, items: readonly unknown[]): asserts value is Sale {
  validateSaleHeader(value)
  if (!Array.isArray(items) || !items.length || items.length > MAX_CHECKOUT_LINES) throw new CheckoutError('INVALID_REQUEST', 'Penjualan harus memiliki 1–100 item.')
  const ids = new Set<string>(), variants = new Set<string>(), amounts: number[] = []
  for (const [index, item] of items.entries()) {
    validateSaleItem(item)
    if (item.saleId !== value.id || item.position !== index + 1 || ids.has(item.id) || variants.has(item.variantId)) throw new CheckoutError('INVALID_REQUEST', 'Relasi, urutan, atau keunikan item penjualan tidak valid.')
    ids.add(item.id); variants.add(item.variantId); amounts.push(item.lineTotal)
  }
  const total = sumLineTotals(amounts)
  if (value.subtotal !== total || value.total !== total) throw new CheckoutError('INVALID_REQUEST', 'Subtotal/total harus sama dengan jumlah nilai baris.')
}
