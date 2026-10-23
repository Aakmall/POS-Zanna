import type { CheckoutRepository } from '../domain/checkoutRepository'
import { CheckoutError, type CheckoutCancellation, type CheckoutCommand, type CheckoutIntent, type CheckoutQuote, type CheckoutResult, type CheckoutSelection } from '../domain/checkout'
import { assertSameCheckoutRequest, checkoutFingerprint, copyCheckoutCommand, validateCheckoutIntent } from '../domain/checkoutRequest'
import { calculateCheckoutQuote, copyCheckoutSelections, validateCheckoutAgainstSnapshot } from '../domain/checkoutRules'
import { integrityError, saleMovementFingerprint, validateStoredCheckout } from '../domain/checkoutIntegrity'
import { assertTimestamp, assertUuid } from '../domain/checkoutValidation'
import { calculateChange } from '../domain/checkoutMath'
import { formatReceiptNumber, validateSale } from '../domain/saleRules'
import { PRICING_POLICY, type Sale, type SaleItem } from '../domain/sale'
import type { InventoryBalance, SaleStockMovement } from '../domain/inventory'
import { createUuid } from '../domain/id'
import type { ZannaDatabase } from './database'
import { customerSnapshot } from '../domain/customer'
import { customerSnapshotKey, validateCustomer } from '../domain/customerRules'
import { newReceivable, validateReceivableGraph } from '../domain/creditRules'
import { itemCost } from '../domain/reportingRules'

export class DexieCheckoutRepository implements CheckoutRepository {
  private readonly db: ZannaDatabase
  constructor(db: ZannaDatabase) { this.db = db }
  private masterTables() { return [this.db.products, this.db.categories, this.db.units, this.db.variants, this.db.inventoryBalances, this.db.customers] }
  private resultTables() { return [this.db.sales, this.db.saleItems, this.db.checkoutIntents, this.db.stockMovements, this.db.receivables, this.db.creditPayments, this.db.creditPaymentIntents] }
  private async safely<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation() }
    catch (cause) {
      if (cause instanceof CheckoutError) throw cause
      throw new CheckoutError('STORAGE_ERROR', 'Penyimpanan checkout gagal atau hasil belum dapat dipastikan. Periksa getResult dengan ID operasi yang sama sebelum mencoba lagi.', { cause })
    }
  }
  private async context() {
    const [products, categories, units, variants, balances] = await Promise.all([
      this.db.products.toArray(), this.db.categories.toArray(), this.db.units.toArray(), this.db.variants.toArray(), this.db.inventoryBalances.toArray(),
    ])
    return { catalog: { products, categories, units, variants }, balances }
  }
  private intentCopy(intent: CheckoutIntent): CheckoutIntent {
    return Object.freeze({ ...intent, command: copyCheckoutCommand(intent.command) })
  }
  // Must be called within a transaction containing resultTables (also used by commit/cancel).
  private async operationState(id: string): Promise<{ intent: CheckoutIntent | null; result: CheckoutResult | null }> {
    const intent = await this.db.checkoutIntents.get(id) ?? null
    const sale = await this.db.sales.where('checkoutOperationId').equals(id).first()
    if (intent) {
      try { validateCheckoutIntent(intent); if (intent.checkoutOperationId !== id) throw new Error('ID intent berbeda.') }
      catch (cause) { throw integrityError(cause) }
    }
    if (!sale) {
      if (intent?.status === 'COMMITTED') throw integrityError(new Error('Intent COMMITTED tidak memiliki Sale.'))
      if (await this.db.receivables.where('checkoutOperationId').equals(id).first()) throw integrityError(new Error('Tagihan tidak memiliki Sale.'))
      return { intent, result: null }
    }
    if (!intent) throw integrityError(new Error('Sale tidak memiliki intent.'))
    const [items, movements] = await Promise.all([
      this.db.saleItems.where('saleId').equals(sale.id).toArray(), this.db.stockMovements.where('saleId').equals(sale.id).toArray(),
    ])
    items.sort((a, b) => a.position - b.position)
    const result = validateStoredCheckout(intent, sale, items, movements)
    const receivable = await this.db.receivables.where('saleId').equals(sale.id).first()
    try {
      if (sale.paymentMethod === 'BON') {
        if (!receivable) throw new Error('Penjualan Bon tanpa tagihan.')
        const payments = await this.db.creditPayments.where('receivableId').equals(receivable.id).toArray()
        const paymentIntents = await this.db.creditPaymentIntents.where('receivableId').equals(receivable.id).toArray()
        validateReceivableGraph(receivable, sale, payments, paymentIntents)
      } else if (receivable) throw new Error('Penjualan tunai mempunyai tagihan Bon.')
    } catch (cause) { throw integrityError(cause) }
    return { intent, result }
  }
  async preview(incoming: readonly CheckoutSelection[]): Promise<CheckoutQuote> {
    const selections = copyCheckoutSelections(incoming)
    return this.safely(() => this.db.transaction('r', this.masterTables(), async () => {
      const { catalog, balances } = await this.context()
      return calculateCheckoutQuote(selections, catalog, balances)
    }))
  }
  async prepare(incoming: CheckoutCommand): Promise<CheckoutIntent> {
    const command = copyCheckoutCommand(incoming)
    return this.safely(() => this.db.transaction('rw', this.resultTables(), async () => {
      const { intent } = await this.operationState(command.checkoutOperationId)
      if (intent) {
        assertSameCheckoutRequest(intent, command)
        if (intent.status === 'CANCELLED') throw new CheckoutError('INTENT_CANCELLED', 'Intent sudah dibatalkan. Buat intent baru untuk konfirmasi baru.')
        return this.intentCopy(intent)
      }
      const prepared: CheckoutIntent = { checkoutOperationId: command.checkoutOperationId, command,
        requestFingerprint: checkoutFingerprint(command), createdAt: new Date().toISOString(), status: 'PREPARED' }
      validateCheckoutIntent(prepared)
      await this.db.checkoutIntents.add(prepared)
      return this.intentCopy(prepared)
    }))
  }
  async commit(incoming: CheckoutCommand): Promise<CheckoutResult> {
    const command = copyCheckoutCommand(incoming)
    return this.safely(() => this.db.transaction('rw', [...this.masterTables(), ...this.resultTables(), this.db.saleItemCosts], async () => {
      const { intent, result } = await this.operationState(command.checkoutOperationId)
      if (result) { assertSameCheckoutRequest(result.sale, command); return result }
      if (!intent) throw new CheckoutError('INTENT_REQUIRED', 'Simpan intent melalui prepare sebelum execute.')
      assertSameCheckoutRequest(intent, command)
      if (intent.status === 'CANCELLED') throw new CheckoutError('INTENT_CANCELLED', 'Intent sudah dibatalkan dan tidak dapat dieksekusi.')
      const { catalog, balances } = await this.context()
      const quote = validateCheckoutAgainstSnapshot(command, catalog, balances)
      if (command.paymentMethod === 'BON') {
        const customer = await this.db.customers.get(command.customer.id)
        if (!customer || !customer.isActive) throw new CheckoutError('CUSTOMER_INACTIVE', 'Pilih pelanggan aktif sebelum mencatat Bon.')
        try { validateCustomer(customer) } catch (cause) { throw integrityError(cause) }
        if (customerSnapshotKey(customerSnapshot(customer)) !== customerSnapshotKey(command.customer)) throw new CheckoutError('CUSTOMER_CHANGED', 'Data pelanggan berubah. Tinjau ulang pelanggan dan konfirmasi Bon.')
      }
      const relevant = balances.filter((balance) => quote.stockRequirements.some((entry) => entry.productId === balance.productId))
      let timestamp = Math.max(Date.now(), Date.parse(intent.createdAt))
      for (const balance of relevant) {
        try { assertTimestamp(balance.updatedAt); assertTimestamp(balance.initializedAt) }
        catch (cause) { throw integrityError(cause) }
        timestamp = Math.max(timestamp, Date.parse(balance.updatedAt) + 1)
      }
      const createdAt = new Date(timestamp).toISOString(), saleId = createUuid()
      const sale: Sale = { id: saleId, receiptNumber: formatReceiptNumber(saleId, createdAt), checkoutOperationId: command.checkoutOperationId,
        requestFingerprint: intent.requestFingerprint, createdAt, status: 'COMPLETED', paymentMethod: command.paymentMethod, subtotal: quote.subtotal,
        total: quote.total, cashReceived: command.cashReceived, changeAmount: command.paymentMethod === 'CASH' ? calculateChange(command.cashReceived, quote.total) : 0,
        ...(command.paymentMethod === 'BON' ? { customerSnapshot: { ...command.customer }, dueDate: command.dueDate } : {}),
        operatorId: null, pricingPolicy: PRICING_POLICY }
      const items: SaleItem[] = quote.items.map((item) => ({ ...item, id: createUuid(), saleId }))
      validateSale(sale, items)
      const running = new Map<string, InventoryBalance>(relevant.map((balance) => [balance.productId, { ...balance }]))
      const movements: SaleStockMovement[] = items.map((item) => {
        const balance = running.get(item.productId)!
        const before = balance.quantityBase, after = before - item.quantityBase
        const movement: SaleStockMovement = { id: createUuid(), operationId: createUuid(), productId: item.productId,
          productName: item.productNameSnapshot, movementType: 'SALE', saleId, saleItemId: item.id,
          quantityBeforeBase: before, quantityDeltaBase: -item.quantityBase, quantityAfterBase: after,
          inputQuantity: item.quantity, conversionSnapshot: item.conversionSnapshot, reason: `Penjualan ${sale.receiptNumber}`,
          createdAt: new Date(timestamp + item.position).toISOString(), createdBy: null, requestFingerprint: saleMovementFingerprint(sale, item) }
        balance.quantityBase = after; balance.updatedAt = movement.createdAt
        return movement
      })
      const committed: CheckoutIntent = { ...intent, status: 'COMMITTED', saleId }
      validateStoredCheckout(committed, sale, items, movements)
      await this.db.sales.add(sale)
      if (sale.paymentMethod === 'BON') await this.db.receivables.add(newReceivable(sale, createUuid()))
      for (const item of items) await this.db.saleItems.add(item)
      for (const item of items) await this.db.saleItemCosts.add(itemCost(item, catalog.products.find((product) => product.id === item.productId)!))
      for (const movement of movements) await this.db.stockMovements.add(movement)
      for (const balance of running.values()) await this.db.inventoryBalances.put(balance)
      await this.db.checkoutIntents.put(committed)
      // Read back actual stored values; hook/constraint failures must not yield synthetic success.
      const stored = await this.operationState(command.checkoutOperationId)
      if (!stored.result) throw integrityError(new Error('Hasil commit tidak ditemukan.'))
      return { ...stored.result, duplicate: false }
    }))
  }
  async getResult(id: string): Promise<CheckoutResult | null> {
    assertUuid(id, 'ID operasi checkout')
    return this.safely(() => this.db.transaction('r', this.resultTables(), async () => (await this.operationState(id)).result))
  }
  async getIntent(id: string): Promise<CheckoutIntent | null> {
    assertUuid(id, 'ID operasi checkout')
    return this.safely(() => this.db.transaction('r', this.resultTables(), async () => {
      const { intent } = await this.operationState(id)
      return intent ? this.intentCopy(intent) : null
    }))
  }
  async listUnresolved(): Promise<readonly CheckoutIntent[]> {
    return this.safely(() => this.db.transaction('r', this.resultTables(), async () => {
      const pending = await this.db.checkoutIntents.where('status').equals('PREPARED').toArray()
      const results: CheckoutIntent[] = []
      for (const entry of pending) {
        const { intent } = await this.operationState(entry.checkoutOperationId)
        if (!intent || intent.status !== 'PREPARED') throw integrityError(new Error('Daftar intent tidak konsisten.'))
        results.push(this.intentCopy(intent))
      }
      return results.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.checkoutOperationId.localeCompare(b.checkoutOperationId))
    }))
  }
  async cancel(id: string): Promise<CheckoutCancellation> {
    assertUuid(id, 'ID operasi checkout')
    return this.safely(() => this.db.transaction('rw', this.resultTables(), async () => {
      const { intent, result } = await this.operationState(id)
      if (result) return { status: 'COMMITTED' as const, result }
      if (!intent) throw new CheckoutError('INTENT_REQUIRED', 'Intent tidak ditemukan untuk dibatalkan.')
      if (intent.status === 'CANCELLED') return { status: 'CANCELLED' as const, intent: this.intentCopy(intent) }
      if (intent.status !== 'PREPARED') throw integrityError(new Error('Intent COMMITTED tanpa hasil.'))
      const cancelled: CheckoutIntent = { ...intent, status: 'CANCELLED' }
      validateCheckoutIntent(cancelled)
      await this.db.checkoutIntents.put(cancelled)
      return { status: 'CANCELLED' as const, intent: this.intentCopy(cancelled) }
    }))
  }
}
