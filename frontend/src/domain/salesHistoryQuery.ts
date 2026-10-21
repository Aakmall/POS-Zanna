import { assertTimestamp, assertUuid } from './checkoutValidation'
import { SalesHistoryError, type SalesHistoryQuery, type SalesHistoryRequest } from './salesHistory'

export const SALES_HISTORY_PAGE_SIZE = 20
export const MAX_SALES_HISTORY_PAGE_SIZE = 50
function invalid(message: string): never { throw new SalesHistoryError('INVALID_FILTER', message) }
function localDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return invalid('Tanggal harus memakai format tahun-bulan-hari yang valid.')
  const [year, month, day] = value.split('-').map(Number)
  if (year < 1000 || year > 9998) return invalid('Tahun filter harus antara 1000 dan 9998.')
  const date = new Date(0)
  date.setFullYear(year, month - 1, day); date.setHours(0, 0, 0, 0)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return invalid('Tanggal filter tidak ada dalam kalender.')
  return date
}
// Calendar days in the browser timezone, NOT UTC-midnight and NOT a fixed 24-hour duration.
export function createSalesHistoryQuery(request: SalesHistoryRequest = {}): SalesHistoryQuery {
  const { receipt = '', startDate = '', endDate = '', pageSize = SALES_HISTORY_PAGE_SIZE, cursor = null } = request
  if (typeof receipt !== 'string' || receipt.length > 100 || typeof startDate !== 'string' || typeof endDate !== 'string') return invalid('Pencarian maksimal 100 karakter dan tanggal harus valid.')
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_SALES_HISTORY_PAGE_SIZE) return invalid('Ukuran halaman harus 1–50 transaksi.')
  const needle = receipt.trim().toUpperCase()
  const start = startDate ? localDay(startDate) : null
  const end = endDate ? localDay(endDate) : null
  if (start && end && start > end) return invalid('Tanggal mulai tidak boleh melewati tanggal akhir.')
  if (end) { end.setDate(end.getDate() + 1); end.setHours(0, 0, 0, 0) }
  const fromInclusive = start?.toISOString() ?? null, toExclusive = end?.toISOString() ?? null
  const filterKey = JSON.stringify([needle, fromInclusive, toExclusive])
  if (cursor) {
    try { assertTimestamp(cursor.createdAt); assertUuid(cursor.id, 'ID cursor') }
    catch { return invalid('Penunjuk halaman tidak valid. Muat ulang riwayat.') }
    if (cursor.filterKey !== filterKey || (fromInclusive && cursor.createdAt < fromInclusive) || (toExclusive && cursor.createdAt >= toExclusive)) return invalid('Filter berubah. Mulai kembali dari halaman pertama.')
  }
  return { receipt: needle, fromInclusive, toExclusive, pageSize, cursor: cursor ? { ...cursor } : null, filterKey }
}
