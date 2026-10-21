import { assertUuid } from '../domain/checkoutValidation'
import { SalesHistoryError, type SalesHistoryReader, type SalesHistoryRepository, type SalesHistoryRequest } from '../domain/salesHistory'
import { createSalesHistoryQuery } from '../domain/salesHistoryQuery'

export class SalesHistoryService implements SalesHistoryReader {
  private readonly repository: SalesHistoryRepository
  constructor(repository: SalesHistoryRepository) { this.repository = repository }
  async list(request: SalesHistoryRequest = {}) { return this.repository.list(createSalesHistoryQuery(request)) }
  async getDetail(saleId: string) {
    try { assertUuid(saleId, 'ID penjualan') }
    catch { throw new SalesHistoryError('NOT_FOUND', 'Transaksi tidak ditemukan. Periksa alamat atau kembali ke riwayat penjualan.') }
    return this.repository.getDetail(saleId)
  }
}
