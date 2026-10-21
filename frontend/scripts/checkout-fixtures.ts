// All values in this file belong to isolated tests, never the application/browser seed.
import type { CatalogSnapshot, Product, ProductVariant } from '../src/domain/product'
import type { InventoryBalance } from '../src/domain/inventory'
import type { CheckoutCommand } from '../src/domain/checkout'
import type { Sale, SaleItem } from '../src/domain/sale'
import { PRICING_POLICY } from '../src/domain/sale'
import { builtinUnits } from '../src/data/units'
import { calculateCheckoutQuote } from '../src/domain/checkoutRules'
import { checkoutFingerprint } from '../src/domain/checkoutRequest'
import { calculateChange } from '../src/domain/checkoutMath'
import { formatReceiptNumber } from '../src/domain/saleRules'

export const testStamp = '2026-10-21T01:00:00.000Z'
export function checkoutFixture(baseCode = 'l', mode: ProductVariant['saleMode'] = 'variable') {
  const units = structuredClone(builtinUnits), unit = (code: string) => units.find((item) => item.code === code)!
  const base = unit(baseCode)
  const category = { id: crypto.randomUUID(), name: 'Kategori uji', nameKey: 'kategori uji', isActive: true, createdAt: testStamp, updatedAt: testStamp }
  const product: Product = {
    id: crypto.randomUUID(), name: base.dimension === 'volume' ? 'Solar' : 'Barang uji', categoryId: category.id, baseUnitId: base.id,
    costPrice: null, costKnown: false, minimumStock: null, isActive: true, isDemo: false, createdAt: testStamp, updatedAt: testStamp,
    unitPolicy: { kind: base.dimension === 'volume' ? 'fuel' : 'general', allowedPackagingUnitIds: (base.dimension === 'volume' ? ['botol', 'jeriken'] : ['dus', 'sachet']).map((code) => unit(code).id).filter((id) => id !== base.id) },
  }
  const variant: ProductVariant = {
    id: crypto.randomUUID(), productId: product.id, name: 'Standar', sellingUnitId: base.id,
    quantityInBaseUnit: 1000, sellingPrice: 13000, saleMode: mode, isActive: true, sku: `TEST-${crypto.randomUUID()}`, barcode: `00${crypto.randomUUID().replaceAll('-', '')}`,
    createdAt: testStamp, updatedAt: testStamp,
  }
  const catalog: CatalogSnapshot = { products: [product], variants: [variant], units, categories: [category] }
  const balances: InventoryBalance[] = [{ productId: product.id, quantityBase: 100000, initializedAt: testStamp, updatedAt: testStamp }]
  return { catalog, balances, product, variant, unit }
}
export function commandFixture(f = checkoutFixture(), quantity = 1500) {
  const quote = calculateCheckoutQuote([{ variantId: f.variant.id, quantity }], f.catalog, f.balances)
  const command: CheckoutCommand = { payloadVersion: 1, checkoutOperationId: crypto.randomUUID(), paymentMethod: 'CASH',
    lines: quote.lines, expectedTotal: quote.total, cashReceived: 1_000_000 }
  return { ...f, quote, command }
}
export function saleFixture() {
  const f = commandFixture(), id = crypto.randomUUID()
  const sale: Sale = { id, receiptNumber: formatReceiptNumber(id, testStamp), checkoutOperationId: f.command.checkoutOperationId,
    requestFingerprint: checkoutFingerprint(f.command), createdAt: testStamp, status: 'COMPLETED', paymentMethod: 'CASH',
    subtotal: f.quote.subtotal, total: f.quote.total, cashReceived: f.command.cashReceived,
    changeAmount: calculateChange(f.command.cashReceived, f.quote.total), operatorId: null, pricingPolicy: PRICING_POLICY }
  const items: SaleItem[] = f.quote.items.map((item) => ({ ...structuredClone(item), id: crypto.randomUUID(), saleId: id }))
  return { ...f, sale, items }
}
