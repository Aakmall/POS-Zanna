import type { Sale } from './sale'
import type { CheckoutResult } from './checkout'

export type SalesHistoryErrorCode = 'INVALID_FILTER' | 'NOT_FOUND' | 'STORAGE_ERROR' | 'INTEGRITY_ERROR'
export class SalesHistoryError extends Error {
  readonly code: SalesHistoryErrorCode
  constructor(code: SalesHistoryErrorCode, message: string, options?: ErrorOptions) { super(message, options); this.name = 'SalesHistoryError'; this.code = code }
}
export interface SalesHistoryFilters { receipt: string; startDate: string; endDate: string }
export interface SalesHistoryCursor { createdAt: string; id: string; filterKey: string }
export interface SalesHistoryRequest extends Partial<SalesHistoryFilters> { pageSize?: number; cursor?: SalesHistoryCursor | null }
export interface SalesHistoryQuery {
  receipt: string; fromInclusive: string | null; toExclusive: string | null
  pageSize: number; cursor: SalesHistoryCursor | null; filterKey: string
}
export interface SalesHistoryPage { sales: readonly Sale[]; nextCursor: SalesHistoryCursor | null }
export interface SalesHistoryRepository {
  list(query: SalesHistoryQuery): Promise<SalesHistoryPage>
  getDetail(saleId: string): Promise<CheckoutResult>
}
export interface SalesHistoryReader {
  list(request?: SalesHistoryRequest): Promise<SalesHistoryPage>
  getDetail(saleId: string): Promise<CheckoutResult>
}
