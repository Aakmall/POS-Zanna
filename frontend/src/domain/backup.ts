import type { Category, Product, ProductVariant, Unit } from './product'
import type { InventoryBalance, StockMovement } from './inventory'
import type { Sale, SaleItem } from './sale'
import type { CheckoutIntent } from './checkout'
import type { Customer } from './customer'
import type { CreditPayment, CreditPaymentIntent, Receivable } from './credit'
import type { SaleItemCost } from './reporting'

export const BACKUP_FORMAT = 'POS_ZANNA_BACKUP'
export const BACKUP_SCHEMA = 5
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024
export const BACKUP_TABLES = ['products', 'categories', 'units', 'variants', 'inventoryBalances', 'stockMovements', 'sales', 'saleItems', 'checkoutIntents', 'customers', 'receivables', 'creditPayments', 'creditPaymentIntents', 'saleItemCosts'] as const
export type BackupTable = typeof BACKUP_TABLES[number]
export interface BackupData {
  products: Product[]; categories: Category[]; units: Unit[]; variants: ProductVariant[]
  inventoryBalances: InventoryBalance[]; stockMovements: StockMovement[]; sales: Sale[]; saleItems: SaleItem[]
  checkoutIntents: CheckoutIntent[]; customers: Customer[]; receivables: Receivable[]; creditPayments: CreditPayment[]
  creditPaymentIntents: CreditPaymentIntent[]; saleItemCosts: SaleItemCost[]
}
export interface BackupFile {
  format: typeof BACKUP_FORMAT; formatVersion: 1; schemaVersion: typeof BACKUP_SCHEMA; appVersion: 'phase-7'
  id: string; createdAt: string; counts: Record<BackupTable, number>; data: BackupData; checksum: string
}
export interface RestorePreview { id: string; createdAt: string; counts: Record<BackupTable, number>; currentCounts: Record<BackupTable, number>; pendingOperations: number }
export interface BackupRepository { read(): Promise<BackupData>; replace(data: BackupData, expectedCurrent: string): Promise<void> }
export interface MaintenanceGate {
  exclusive<T>(operation: () => Promise<T>): Promise<T>
  checkRecovery(): void
  restored(): void
}
