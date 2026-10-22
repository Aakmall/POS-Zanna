import type { CheckoutResult } from './checkout'
import type { InventoryBalance, UnitSnapshot } from './inventory'
import type { Product, Unit } from './product'

export interface DashboardDay { date: string; revenue: number; transactions: number; itemRows: number }
export interface DashboardStock { productId: string; name: string; active: boolean; quantityBase: number; minimumStock: number | null; unit: string }
export interface DashboardTopProduct { key: string; name: string; unit: UnitSnapshot; quantity: number; revenue: number; itemRows: number }
export interface DashboardWindow { days: readonly string[]; fromInclusive: string; toExclusive: string }
export interface DashboardSnapshot {
  today: DashboardDay; days: readonly DashboardDay[]; recent: readonly CheckoutResult[]
  topProducts: readonly DashboardTopProduct[]; lowStock: readonly DashboardStock[]; outOfStock: readonly DashboardStock[]; uninitialized: number
}
export interface DashboardData { period: readonly CheckoutResult[]; recent: readonly CheckoutResult[]; products: readonly Product[]; units: readonly Unit[]; balances: readonly InventoryBalance[] }
export interface DashboardRepository { read(window: DashboardWindow): Promise<DashboardData>; subscribe(window: DashboardWindow, next: (data: DashboardData) => void, error: (cause: unknown) => void): () => void }
