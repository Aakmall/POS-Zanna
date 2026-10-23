import type { CheckoutResult } from './checkout'
import type { CreditPayment, Receivable } from './credit'
import type { DashboardData, DashboardTopProduct, DashboardStock } from './dashboard'

export type ReportMethod = 'ALL' | 'CASH' | 'BON'
export type ReportPreset = 'today' | 'week' | 'month' | 'custom'
export interface ReportRequest { preset: ReportPreset; startDate?: string; endDate?: string; method?: ReportMethod }
export interface ReportWindow { startDate: string; endDate: string; fromInclusive: string; toExclusive: string; days: readonly string[]; method: ReportMethod }
// Kept separate from receipts. Future reports.profit.view guard belongs in the service.
export interface SaleItemCost { saleItemId: string; saleId: string; costPerBaseUnit: number | null; totalCost: number | null; policy: 'BASE_HALF_UP_V1' }
export interface ReportingData extends DashboardData { receivables: readonly Receivable[]; payments: readonly CreditPayment[] }
export interface ReportDay { date: string; revenue: number; transactions: number }
export interface SalesReport {
  window: ReportWindow; revenue: number; transactions: number; itemRows: number; cashSales: number; bonSales: number
  creditReceipts: number; moneyReceived: number; days: readonly ReportDay[]; sales: readonly CheckoutResult[]
  topProducts: readonly DashboardTopProduct[]; lowStock: readonly DashboardStock[]; outOfStock: readonly DashboardStock[]; uninitialized: number
  receivables: readonly Receivable[]; payments: readonly CreditPayment[]; totalBon: number; totalPaid: number; outstanding: number
}
export interface ProfitRow { saleId: string; receiptNumber: string; revenue: number; knownRevenue: number; cost: number; profit: number; missingItems: number }
export interface ProfitReport { rows: readonly ProfitRow[]; knownRevenue: number; cost: number; profit: number; missingItems: number; complete: boolean }
export interface ReportingRepository {
  read(window: ReportWindow): Promise<ReportingData>
  readCosts(saleIds: readonly string[]): Promise<readonly SaleItemCost[]>
  subscribe(window: ReportWindow, next: (data: ReportingData) => void, error: (cause: unknown) => void): () => void
}
