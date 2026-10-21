import type { Unit, UUID } from './product'

export const movementTypes = ['OPENING_BALANCE', 'STOCK_IN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT'] as const
export type MovementType = typeof movementTypes[number]
export type StockStatus = 'NOT_INITIALIZED' | 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK'
export interface InventoryBalance {
  productId: UUID; quantityBase: number; initializedAt: string; updatedAt: string
}
export type UnitSnapshot = Pick<Unit, 'id' | 'code' | 'name' | 'dimension' | 'factor' | 'isPackaging'>
export interface ConversionSnapshot {
  baseUnit: UnitSnapshot; inputUnit: UnitSnapshot; quantityInBaseUnit: number
  source: 'base' | 'metric' | 'variant' | 'custom'; variantId?: UUID; variantName?: string
}
export interface InventoryCommand {
  operationId: UUID; productId: UUID; movementType: MovementType
  inputQuantity: number; inputUnitId: UUID; variantId?: UUID
  customQuantityInBaseUnit?: number; reason: string
  expectedBeforeBase?: number; expectedFactorBase?: number
}
interface MovementData {
  id: UUID; operationId: UUID; productId: UUID; productName: string
  quantityDeltaBase: number; quantityBeforeBase: number; quantityAfterBase: number; inputQuantity: number
  conversionSnapshot: ConversionSnapshot; reason: string; createdBy: null; createdAt: string; requestFingerprint: string
}
export interface ManualStockMovement extends MovementData {
  movementType: MovementType
  saleId?: UUID; saleItemId?: UUID // Legacy optional fields preserved without rewriting records.
}
export interface SaleStockMovement extends MovementData {
  movementType: 'SALE'; saleId: UUID; saleItemId: UUID
}
export type StockMovement = ManualStockMovement | SaleStockMovement
export interface MovementResult { movement: StockMovement; duplicate: boolean }
export interface InventoryRepository {
  getBalances(): Promise<InventoryBalance[]>
  getHistory(productId: UUID): Promise<StockMovement[]>
  apply(command: InventoryCommand): Promise<MovementResult>
  subscribeBalances(next: (balances: InventoryBalance[]) => void, error: (error: unknown) => void): () => void
  subscribeHistory(productId: UUID, next: (movements: StockMovement[]) => void, error: (error: unknown) => void): () => void
}
