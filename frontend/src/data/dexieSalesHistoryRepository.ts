import { CheckoutError, type CheckoutReadRepository } from '../domain/checkout'
import { validateSaleHeader } from '../domain/saleRules'
import { SalesHistoryError, type SalesHistoryPage, type SalesHistoryQuery, type SalesHistoryRepository } from '../domain/salesHistory'
import type { ZannaDatabase } from './database'
import { DexieCheckoutRepository } from './dexieCheckoutRepository'

export class DexieSalesHistoryRepository implements SalesHistoryRepository {
  private readonly db: ZannaDatabase
  private readonly checkout: Pick<CheckoutReadRepository, 'getResult'>
  constructor(db: ZannaDatabase) { this.db = db; this.checkout = new DexieCheckoutRepository(db) }
  private async read<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation() }
    catch (cause) {
      if (cause instanceof SalesHistoryError) throw cause
      if (cause instanceof CheckoutError && cause.code !== 'STORAGE_ERROR') throw new SalesHistoryError('INTEGRITY_ERROR', 'Data transaksi tidak konsisten. Struk tidak dapat ditampilkan; mintalah pemeriksaan data.', { cause })
      throw new SalesHistoryError('STORAGE_ERROR', 'Riwayat belum dapat dibaca dari penyimpanan perangkat. Coba lagi tanpa menghapus data browser.', { cause })
    }
  }
  async list(query: SalesHistoryQuery): Promise<SalesHistoryPage> {
    return this.read(() => this.db.transaction('r', this.db.sales, async () => {
      const { cursor } = query
      const upper = cursor?.createdAt ?? query.toExclusive ?? '\uffff'
      // IndexedDB index order is (createdAt, primary key). reverse() reverses BOTH keys.
      const rows = await this.db.sales.where('createdAt').between(query.fromInclusive ?? '', upper, true, !!cursor)
        .reverse().filter((sale) => {
          if (cursor && sale.createdAt === cursor.createdAt && sale.id >= cursor.id) return false
          // Sales only contain COMPLETED. A different persisted status is corruption,
          // while PREPARED/CANCELLED intents live in a separate store and are never queried.
          validateSaleHeader(sale)
          return sale.receiptNumber.toUpperCase().includes(query.receipt)
        }).limit(query.pageSize + 1).toArray()
      const sales = rows.slice(0, query.pageSize), last = sales.at(-1)
      return { sales, nextCursor: rows.length > query.pageSize && last ? { createdAt: last.createdAt, id: last.id, filterKey: query.filterKey } : null }
    }))
  }
  async getDetail(saleId: string) {
    return this.read(() => this.db.transaction('r', this.db.tables, async () => {
      const sale = await this.db.sales.get(saleId)
      if (!sale) {
        const related = await this.db.checkoutIntents.where('saleId').equals(saleId).first()
        if (related?.status === 'COMMITTED') throw new SalesHistoryError('INTEGRITY_ERROR', 'Penjualan yang dirujuk intent tersimpan tidak ditemukan. Data perlu diperiksa.')
        throw new SalesHistoryError('NOT_FOUND', 'Transaksi tidak ditemukan. Periksa alamat atau kembali ke riwayat penjualan.')
      }
      validateSaleHeader(sale)
      // Nested read shares the same transaction: reuse all Sale–Item–Intent–SALE validation.
      const result = await this.checkout.getResult(sale.checkoutOperationId)
      if (!result || result.sale.id !== saleId) throw new SalesHistoryError('INTEGRITY_ERROR', 'Identitas hasil transaksi tidak sesuai. Data perlu diperiksa.')
      return result
    }))
  }
}
