import { liveQuery } from 'dexie'
import type { ReportingRepository, ReportingData, ReportWindow } from '../domain/reporting'
import { DexieDashboardRepository } from './dexieDashboardRepository'
import { DexieCreditRepository } from './dexieCreditRepository'
import type { ZannaDatabase } from './database'

export class DexieReportingRepository implements ReportingRepository {
  private readonly db: ZannaDatabase
  constructor(db: ZannaDatabase) { this.db = db }
  async read(window: ReportWindow): Promise<ReportingData> {
    try { return await this.db.transaction('r', this.db.tables, async () => {
      const base = await new DexieDashboardRepository(this.db).read(window)
      const overview = await new DexieCreditRepository(this.db).overview()
      const payments = await this.db.creditPayments.where('createdAt').between(window.fromInclusive, window.toExclusive, true, false).toArray()
      if (payments.some((payment) => !overview.receivables.some((r) => r.id === payment.receivableId && r.saleId === payment.saleId))) throw new Error('Pembayaran tanpa tagihan yang sesuai.')
      return { ...base, receivables: overview.receivables, payments }
    }) } catch (cause) {
      // Wrap storage failures so liveQuery reports a visible error rather than waiting
      // indefinitely for a deliberately closed database to reopen.
      throw new Error('Laporan belum dapat dibaca. Coba lagi tanpa menghapus data perangkat.', { cause })
    }
  }
  async readCosts(saleIds: readonly string[]) { return this.db.saleItemCosts.where('saleId').anyOf([...saleIds]).toArray() }
  subscribe(window: ReportWindow, next: (data: ReportingData) => void, error: (cause: unknown) => void) {
    const subscription = liveQuery(() => this.read(window)).subscribe({ next, error })
    return () => subscription.unsubscribe()
  }
}
