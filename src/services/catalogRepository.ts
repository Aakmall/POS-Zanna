import { demoProducts } from '../mocks/products'
import type { Product } from '../types/pos'

export interface CatalogRepository { list(): Promise<Product[]> }

// Boundary data lokal. Tidak memanggil jaringan dan bukan backend/API.
export const demoCatalogRepository: CatalogRepository = {
  async list() { return demoProducts.map((product) => ({ ...product })) },
}
