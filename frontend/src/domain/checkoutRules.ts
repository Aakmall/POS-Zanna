import type { CatalogSnapshot, Product, ProductVariant, Unit } from './product'
import type { ConversionSnapshot, InventoryBalance, UnitSnapshot } from './inventory'
import { CheckoutError, type CheckoutCommand, type CheckoutQuote, type CheckoutSelection } from './checkout'
import { assertCheckoutQuantity, assertMoney, calculateChange, calculateLineTotal, MAX_CHECKOUT_LINES, sumLineTotals } from './checkoutMath'
import { assertRecord, assertTimestamp, assertUnitSnapshot, assertUuid } from './checkoutValidation'
import { validateCheckoutCommand } from './checkoutRequest'
import { validateUnitPolicy } from './unitPolicy'
import { validateVariantUnit } from './validation'
import { convertInventoryQuantity, MAX_STOCK_BASE } from './inventoryRules'

function snapshotUnit(unit: Unit): UnitSnapshot {
  const snapshot = { id: unit.id, code: unit.code, name: unit.name, dimension: unit.dimension, factor: unit.factor, isPackaging: unit.isPackaging }
  assertUnitSnapshot(snapshot)
  return snapshot
}
function activeVariant(variantId: string, catalog: CatalogSnapshot) {
  const variant = catalog.variants.find((entry) => entry.id === variantId)
  const product = catalog.products.find((entry) => entry.id === variant?.productId)
  const category = catalog.categories.find((entry) => entry.id === product?.categoryId)
  if (!variant || !product || !category || !variant.isActive || !product.isActive || !category.isActive) throw new CheckoutError('PRODUCT_UNAVAILABLE', 'Produk, kategori, atau varian tidak ditemukan/aktif.')
  return { variant, product }
}
function expectedVariant(product: Product, variant: ProductVariant): CheckoutCommand['lines'][number]['expected'] {
  assertMoney(variant.sellingPrice, 'Harga jual')
  return { productId: product.id, baseUnitId: product.baseUnitId, sellingUnitId: variant.sellingUnitId,
    saleMode: variant.saleMode, quantityInBaseUnit: variant.quantityInBaseUnit, unitPrice: variant.sellingPrice,
    productUpdatedAt: product.updatedAt, variantUpdatedAt: variant.updatedAt }
}
export function copyCheckoutSelections(value: unknown): readonly CheckoutSelection[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_CHECKOUT_LINES) throw new CheckoutError('INVALID_REQUEST', 'Pilih 1–100 varian untuk preview.')
  return Object.freeze(value.map((line: unknown) => {
    assertRecord(line, 'Pilihan checkout'); assertUuid(line.variantId, 'ID varian'); assertCheckoutQuantity(line.quantity, 'variable')
    return Object.freeze({ variantId: line.variantId, quantity: line.quantity })
  }))
}
function variantConversion(variant: ProductVariant, catalog: CatalogSnapshot): ConversionSnapshot {
  const product = catalog.products.find((entry) => entry.id === variant.productId)!
  const base = catalog.units.find((unit) => unit.id === product.baseUnitId)
  const selling = catalog.units.find((unit) => unit.id === variant.sellingUnitId)
  if (!base || !selling) throw new CheckoutError('PRODUCT_UNAVAILABLE', 'Satuan dasar/jual produk tidak ditemukan.')
  try { validateUnitPolicy(product.unitPolicy, base, catalog.units) }
  catch (cause) { throw new CheckoutError('POLICY_REVIEW_REQUIRED', cause instanceof Error ? cause.message : 'Kebijakan satuan perlu ditinjau.') }
  try { validateVariantUnit(product, variant, catalog.units) }
  catch (cause) { throw new CheckoutError('INVALID_REQUEST', cause instanceof Error ? cause.message : 'Varian satuan tidak valid.') }
  return { baseUnit: snapshotUnit(base), inputUnit: snapshotUnit(selling), source: 'variant',
    quantityInBaseUnit: variant.quantityInBaseUnit, variantId: variant.id, variantName: variant.name }
}

// Pure read-model calculation. No Dexie, clock, ID generation, or business writes.
export function calculateCheckoutQuote(selections: readonly CheckoutSelection[], catalog: CatalogSnapshot, balances: readonly InventoryBalance[]): CheckoutQuote {
  if (!Array.isArray(selections) || !selections.length || selections.length > MAX_CHECKOUT_LINES) throw new CheckoutError('INVALID_REQUEST', 'Pilih 1–100 varian unik untuk kalkulasi checkout.')
  const used = new Set<string>(), demand = new Map<string, bigint>()
  const lines: CheckoutQuote['lines'][number][] = [], items: CheckoutQuote['items'][number][] = []
  for (const [index, selection] of selections.entries()) {
    assertRecord(selection, 'Pilihan checkout'); assertUuid(selection.variantId, 'ID varian')
    if (used.has(selection.variantId)) throw new CheckoutError('INVALID_REQUEST', 'Varian duplikat pada keranjang.')
    used.add(selection.variantId)
    const { variant, product } = activeVariant(selection.variantId, catalog)
    if (variant.saleMode !== 'fixed' && variant.saleMode !== 'variable') throw new CheckoutError('INVALID_REQUEST', 'Mode varian tidak valid.')
    assertCheckoutQuantity(selection.quantity, variant.saleMode); assertMoney(variant.sellingPrice, 'Harga jual')
    assertTimestamp(product.updatedAt); assertTimestamp(variant.updatedAt)
    const conversion = variantConversion(variant, catalog)
    let quantityBase: number
    try { quantityBase = convertInventoryQuantity(selection.quantity, conversion) }
    catch (cause) { throw new CheckoutError('INVALID_REQUEST', cause instanceof Error ? cause.message : 'Hasil konversi tidak valid.') }
    const lineTotal = calculateLineTotal(variant.sellingPrice, selection.quantity)
    demand.set(product.id, (demand.get(product.id) ?? 0n) + BigInt(quantityBase))
    lines.push({ variantId: variant.id, quantity: selection.quantity, expected: expectedVariant(product, variant) })
    items.push({ position: index + 1, productId: product.id, variantId: variant.id,
      productNameSnapshot: product.name, variantNameSnapshot: variant.name, saleModeSnapshot: variant.saleMode,
      unitSnapshot: { ...conversion.inputUnit }, conversionSnapshot: conversion,
      quantity: selection.quantity, quantityBase, unitPriceSnapshot: variant.sellingPrice, lineTotal })
  }
  const stockRequirements = Array.from(demand, ([productId, quantity]) => {
    if (quantity > BigInt(MAX_STOCK_BASE)) throw new CheckoutError('INSUFFICIENT_STOCK', 'Kebutuhan stok bersama melampaui batas saldo.')
    const matches = balances.filter((balance) => balance.productId === productId)
    if (!matches.length) throw new CheckoutError('STOCK_NOT_INITIALIZED', 'Stok awal produk belum diatur.')
    const balance = matches[0]
    if (matches.length !== 1 || !Number.isSafeInteger(balance.quantityBase) || balance.quantityBase < 0 || balance.quantityBase > MAX_STOCK_BASE) throw new CheckoutError('INTEGRITY_ERROR', 'Saldo stok tidak valid atau duplikat.')
    if (quantity > BigInt(balance.quantityBase)) throw new CheckoutError('INSUFFICIENT_STOCK', 'Gabungan varian melebihi saldo stok produk.')
    return { productId, quantityBase: Number(quantity) }
  })
  const total = sumLineTotals(items.map((item) => item.lineTotal))
  return { lines, items, stockRequirements, subtotal: total, total }
}

// Caller in step 4.3 must supply master/balances read INSIDE its atomic transaction.
export function validateCheckoutAgainstSnapshot(command: CheckoutCommand, catalog: CatalogSnapshot, balances: readonly InventoryBalance[]): CheckoutQuote {
  validateCheckoutCommand(command)
  for (const line of command.lines) {
    const { product, variant } = activeVariant(line.variantId, catalog)
    const latest = expectedVariant(product, variant)
    if ((Object.keys(latest) as (keyof typeof latest)[]).some((key) => line.expected[key] !== latest[key])) throw new CheckoutError('QUOTE_CHANGED', 'Master, harga, atau faktor berubah. Tinjau ulang konfirmasi checkout.')
  }
  const quote = calculateCheckoutQuote(command.lines, catalog, balances)
  if (command.expectedTotal !== quote.total) throw new CheckoutError('QUOTE_CHANGED', 'Total konfirmasi tidak sesuai perhitungan master terbaru.')
  if (command.paymentMethod === 'CASH') calculateChange(command.cashReceived, quote.total)
  return quote
}
