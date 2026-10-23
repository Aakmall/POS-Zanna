import { liveQuery } from 'dexie'
import { CheckoutError, type CheckoutResult } from '../domain/checkout'
import type { DashboardData, DashboardRepository, DashboardWindow } from '../domain/dashboard'
import { validateSaleHeader } from '../domain/saleRules'
import type { ZannaDatabase } from './database'
import { DexieCheckoutRepository } from './dexieCheckoutRepository'
import { DexieReportingRepository } from './dexieReportingRepository'

export class DexieDashboardRepository implements DashboardRepository {
  private readonly db: ZannaDatabase
  private readonly checkout: DexieCheckoutRepository
  constructor(db: ZannaDatabase) { this.db = db; this.checkout = new DexieCheckoutRepository(db) }
  get reporting() { return new DexieReportingRepository(this.db) }
  async read(window: DashboardWindow): Promise<DashboardData> {
    try {
      return await this.db.transaction('r', this.db.tables, async () => {
        const period = await this.db.sales.where('createdAt').between(window.fromInclusive, window.toExclusive, true, false).toArray()
        const recent = await this.db.sales.orderBy('createdAt').reverse().limit(5).toArray()
        const results = new Map<string, CheckoutResult>()
        for (const sale of [...period, ...recent]) {
          if (results.has(sale.id)) continue
          validateSaleHeader(sale)
          const result = await this.checkout.getResult(sale.checkoutOperationId)
          if (!result || result.sale.id !== sale.id) throw new CheckoutError('INTEGRITY_ERROR', 'Relasi penjualan Dashboard tidak konsisten.')
          results.set(sale.id, result)
        }
        const [products, units, balances] = await Promise.all([this.db.products.toArray(), this.db.units.toArray(), this.db.inventoryBalances.toArray()])
        return { period: period.map((sale) => results.get(sale.id)!), recent: recent.map((sale) => results.get(sale.id)!), products, units, balances }
      })
    } catch (cause) {
      if (cause instanceof CheckoutError && cause.code === 'STORAGE_ERROR') throw cause
      if (cause instanceof CheckoutError) throw new CheckoutError('INTEGRITY_ERROR', 'Data Dashboard tidak konsisten. Periksa transaksi atau persediaan; data tidak diperbaiki otomatis.', { cause })
      throw new CheckoutError('STORAGE_ERROR', 'Dashboard belum dapat membaca penyimpanan perangkat. Coba lagi tanpa menghapus data browser.', { cause })
    }
  }
  subscribe(window: DashboardWindow, next: (data: DashboardData) => void, error: (cause: unknown) => void) {
    const subscription = liveQuery(() => this.read(window)).subscribe({ next, error })
    return () => subscription.unsubscribe()
  }
}
