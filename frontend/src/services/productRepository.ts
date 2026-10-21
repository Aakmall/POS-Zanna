import type { ProductRepository } from '../domain/productRepository'
import { localDatabase } from '../data/localDatabase'
import { DexieProductRepository } from '../data/dexieProductRepository'

// Composition root: satu-satunya pemilihan implementasi penyimpanan.
export const productRepository: ProductRepository = new DexieProductRepository(localDatabase)
