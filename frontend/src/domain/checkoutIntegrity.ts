import { CheckoutError, type CheckoutIntent, type CheckoutResult } from './checkout'
import type { ConversionSnapshot, StockMovement } from './inventory'
import { MAX_STOCK_BASE } from './inventoryRules'
import type { Sale, SaleItem } from './sale'
import { assertTimestamp, assertUuid, unitSnapshotKey } from './checkoutValidation'
import { checkoutFingerprint, validateCheckoutIntent } from './checkoutRequest'
import { validateSale } from './saleRules'

export function conversionSnapshotKey(value: ConversionSnapshot): string {
  return JSON.stringify([unitSnapshotKey(value.baseUnit), unitSnapshotKey(value.inputUnit), value.source,
    value.quantityInBaseUnit, value.variantId ?? null, value.variantName ?? null])
}
export function saleMovementFingerprint(sale: Pick<Sale, 'id' | 'requestFingerprint'>, item: SaleItem): string {
  return JSON.stringify([1, sale.requestFingerprint, sale.id, item.id, item.position, item.productId, item.variantId, item.quantity, item.quantityBase])
}
export function integrityError(cause: unknown): CheckoutError {
  return new CheckoutError('INTEGRITY_ERROR', 'Data checkout tersimpan tidak konsisten. Jangan membuat penjualan pengganti; periksa identitas operasi.', { cause })
}

// Only stored snapshots/intent/ledger are compared, never the current product master or current balance.
export function validateStoredCheckout(intent: CheckoutIntent, sale: Sale, items: readonly SaleItem[], movements: readonly StockMovement[]): CheckoutResult {
  try {
    validateCheckoutIntent(intent); validateSale(sale, items)
    if (intent.status !== 'COMMITTED' || intent.saleId !== sale.id || sale.checkoutOperationId !== intent.checkoutOperationId ||
      sale.requestFingerprint !== intent.requestFingerprint || sale.requestFingerprint !== checkoutFingerprint(intent.command) ||
      sale.total !== intent.command.expectedTotal || sale.cashReceived !== intent.command.cashReceived ||
      items.length !== intent.command.lines.length || movements.length !== items.length || Date.parse(sale.createdAt) < Date.parse(intent.createdAt)) throw new Error('Sale, intent atau jumlah relasi berbeda.')
    const running = new Map<string, number>(), operations = new Set<string>(), movementIds = new Set<string>()
    let previousTime = Date.parse(sale.createdAt)
    for (const [index, item] of items.entries()) {
      const line = intent.command.lines[index], expected = line.expected
      if (item.variantId !== line.variantId || item.quantity !== line.quantity || item.productId !== expected.productId ||
        item.unitPriceSnapshot !== expected.unitPrice || item.saleModeSnapshot !== expected.saleMode ||
        item.unitSnapshot.id !== expected.sellingUnitId || item.conversionSnapshot.baseUnit.id !== expected.baseUnitId ||
        item.conversionSnapshot.quantityInBaseUnit !== expected.quantityInBaseUnit) throw new Error('Snapshot item berbeda dari intent.')
      const matches = movements.filter((record) => record.saleItemId === item.id)
      if (matches.length !== 1) throw new Error('Item tidak memiliki tepat satu movement.')
      const movement = matches[0]
      assertUuid(movement.id, 'ID mutasi'); assertUuid(movement.operationId, 'ID operasi mutasi'); assertTimestamp(movement.createdAt)
      if (movement.movementType !== 'SALE' || movement.saleId !== sale.id || movement.productId !== item.productId ||
        movement.productName !== item.productNameSnapshot || movement.createdBy !== null || movement.inputQuantity !== item.quantity || movement.operationId === sale.checkoutOperationId ||
        movement.quantityDeltaBase !== -item.quantityBase || movement.requestFingerprint !== saleMovementFingerprint(sale, item) ||
        conversionSnapshotKey(movement.conversionSnapshot) !== conversionSnapshotKey(item.conversionSnapshot) ||
        movement.reason !== `Penjualan ${sale.receiptNumber}`) throw new Error('Snapshot atau relasi movement tidak sesuai.')
      for (const quantity of [movement.quantityBeforeBase, movement.quantityAfterBase]) {
        if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > MAX_STOCK_BASE) throw new Error('Saldo historis tidak valid.')
      }
      if (movement.quantityBeforeBase + movement.quantityDeltaBase !== movement.quantityAfterBase ||
        (running.has(item.productId) && running.get(item.productId) !== movement.quantityBeforeBase) ||
        operations.has(movement.operationId) || movementIds.has(movement.id) || Date.parse(movement.createdAt) <= previousTime) throw new Error('Rantai saldo/identitas/waktu mutasi tidak konsisten.')
      operations.add(movement.operationId); movementIds.add(movement.id)
      running.set(item.productId, movement.quantityAfterBase); previousTime = Date.parse(movement.createdAt)
    }
    return { sale, items, duplicate: true }
  } catch (cause) { throw integrityError(cause) }
}
