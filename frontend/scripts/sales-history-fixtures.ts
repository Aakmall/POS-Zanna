// Isolated emulator fixtures only. Never imported by src or seeded in a browser.
import { ZannaDatabase } from '../src/data/database'
import { DexieSalesHistoryRepository } from '../src/data/dexieSalesHistoryRepository'
import { SalesHistoryService } from '../src/services/salesHistoryOperations'
import { calculateCheckoutQuote } from '../src/domain/checkoutRules'
import { checkoutFingerprint } from '../src/domain/checkoutRequest'
import { formatReceiptNumber } from '../src/domain/saleRules'
import { saleMovementFingerprint, validateStoredCheckout } from '../src/domain/checkoutIntegrity'
import type { CheckoutCommand, CheckoutIntent } from '../src/domain/checkout'
import { PRICING_POLICY, type Sale, type SaleItem } from '../src/domain/sale'
import type { SaleStockMovement } from '../src/domain/inventory'
import { checkoutFixture } from './checkout-fixtures'

export function historyFixture() {
  const db = new ZannaDatabase(`sales-history-test-${crypto.randomUUID()}`)
  const service = new SalesHistoryService(new DexieSalesHistoryRepository(db))
  return { db, service }
}
export async function historySale(db: ZannaDatabase, createdAt = '2026-10-22T03:00:00.000Z', options: { id?: string; multi?: boolean } = {}) {
  const f = checkoutFixture(), stamp = '2026-01-01T00:00:00.000Z'
  f.product.createdAt = stamp; f.product.updatedAt = stamp; f.variant.createdAt = stamp; f.variant.updatedAt = stamp
  f.catalog.categories[0].nameKey = f.catalog.categories[0].id
  if (options.multi) f.catalog.variants.push({ ...f.variant, id: crypto.randomUUID(), name: 'Eceran', sku: undefined, barcode: undefined, sellingPrice: 12000 })
  const quote = calculateCheckoutQuote(f.catalog.variants.map((variant, index) => ({ variantId: variant.id, quantity: index ? 500 : 1500 })), f.catalog, f.balances)
  const command: CheckoutCommand = { payloadVersion: 1, checkoutOperationId: crypto.randomUUID(), paymentMethod: 'CASH', lines: quote.lines, expectedTotal: quote.total, cashReceived: 100000 }
  const id = options.id ?? crypto.randomUUID(), requestFingerprint = checkoutFingerprint(command)
  const sale: Sale = { id, checkoutOperationId: command.checkoutOperationId, requestFingerprint, receiptNumber: formatReceiptNumber(id, createdAt), createdAt,
    status: 'COMPLETED', paymentMethod: 'CASH', subtotal: quote.total, total: quote.total, cashReceived: command.cashReceived, changeAmount: command.cashReceived - quote.total, operatorId: null, pricingPolicy: PRICING_POLICY }
  const items: SaleItem[] = quote.items.map((item) => ({ ...item, id: crypto.randomUUID(), saleId: id }))
  const intent: CheckoutIntent = { checkoutOperationId: command.checkoutOperationId, command, requestFingerprint, createdAt, status: 'COMMITTED', saleId: id }
  let balance = 100000
  const movements: SaleStockMovement[] = items.map((item) => {
    const before = balance; balance -= item.quantityBase
    return { id: crypto.randomUUID(), operationId: crypto.randomUUID(), productId: item.productId, productName: item.productNameSnapshot, movementType: 'SALE', saleId: id, saleItemId: item.id,
      inputQuantity: item.quantity, quantityBeforeBase: before, quantityAfterBase: balance, quantityDeltaBase: -item.quantityBase, conversionSnapshot: item.conversionSnapshot,
      reason: `Penjualan ${sale.receiptNumber}`, createdBy: null, createdAt: new Date(Date.parse(createdAt) + item.position).toISOString(), requestFingerprint: saleMovementFingerprint(sale, item) }
  })
  const result = validateStoredCheckout(intent, sale, items, movements)
  await db.transaction('rw', db.tables, async () => {
    await db.units.bulkPut(f.catalog.units); await db.categories.bulkAdd(f.catalog.categories); await db.products.add(f.product); await db.variants.bulkAdd(f.catalog.variants)
    await db.sales.add(sale); await db.saleItems.bulkAdd(items); await db.checkoutIntents.add(intent); await db.stockMovements.bulkAdd(movements)
    await db.inventoryBalances.add({ productId: f.product.id, quantityBase: balance, initializedAt: stamp, updatedAt: movements.at(-1)!.createdAt })
  })
  return { ...f, result, sale, items, intent, command, movements }
}
export async function historySnapshot(db: ZannaDatabase) {
  return Object.fromEntries(await Promise.all(db.tables.map(async (table) => [table.name, await table.toArray()])))
}
