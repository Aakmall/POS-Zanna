import { liveQuery } from 'dexie'
import type { InventoryCommand, InventoryRepository, InventoryBalance, StockMovement, MovementResult } from '../domain/inventory'
import { commandFingerprint, previewMovement, validateInventoryCommand } from '../domain/inventoryRules'
import { createUuid } from '../domain/id'
import { ValidationError } from '../domain/validation'
import { ZannaDatabase } from './database'

export class DexieInventoryRepository implements InventoryRepository {
  private readonly db: ZannaDatabase
  constructor(db: ZannaDatabase) { this.db = db }
  getBalances() { return this.db.inventoryBalances.toArray() }
  async getHistory(productId: string) {
    const records = await this.db.stockMovements.where('productId').equals(productId).toArray()
    return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
  }
  subscribeBalances(next: (balances: InventoryBalance[]) => void, error: (error: unknown) => void) {
    const subscription = liveQuery(() => this.getBalances()).subscribe({ next, error })
    return () => subscription.unsubscribe()
  }
  subscribeHistory(productId: string, next: (records: StockMovement[]) => void, error: (error: unknown) => void) {
    const subscription = liveQuery(() => this.getHistory(productId)).subscribe({ next, error })
    return () => subscription.unsubscribe()
  }
  async apply(incoming: InventoryCommand): Promise<MovementResult> {
    const command = { ...incoming }
    validateInventoryCommand(command)
    return this.db.transaction('rw', [this.db.products, this.db.categories, this.db.units, this.db.variants, this.db.inventoryBalances, this.db.stockMovements], async () => {
      const fingerprint = commandFingerprint(command)
      const duplicate = await this.db.stockMovements.where('operationId').equals(command.operationId).first()
      if (duplicate) {
        if (duplicate.requestFingerprint !== fingerprint) throw new ValidationError('Identitas operasi sudah digunakan dengan isi berbeda. Buat operasi baru.')
        return { movement: duplicate, duplicate: true }
      }
      const catalog = { products: await this.db.products.toArray(), categories: await this.db.categories.toArray(), units: await this.db.units.toArray(), variants: await this.db.variants.toArray() }
      const balance = await this.db.inventoryBalances.get(command.productId)
      const preview = previewMovement(command, catalog, balance)
      const product = catalog.products.find((item) => item.id === command.productId)!
      const now = new Date(Math.max(Date.now(), balance ? Date.parse(balance.updatedAt) + 1 : 0)).toISOString()
      const movement: StockMovement = {
        id: createUuid(), operationId: command.operationId, productId: product.id, productName: product.name,
        movementType: command.movementType, quantityBeforeBase: preview.before, quantityDeltaBase: preview.delta,
        quantityAfterBase: preview.after, inputQuantity: command.inputQuantity, conversionSnapshot: preview.conversion,
        reason: command.reason.trim(), createdBy: null, createdAt: now, requestFingerprint: fingerprint,
      }
      await this.db.inventoryBalances.put({ productId: product.id, quantityBase: preview.after, initializedAt: balance?.initializedAt ?? now, updatedAt: now })
      await this.db.stockMovements.add(movement)
      return { movement, duplicate: false }
    })
  }
}
