import type { ProductRepository } from '../domain/productRepository'
import { ZannaDatabase } from '../data/database'
import { DexieProductRepository } from '../data/dexieProductRepository'

// Composition root: satu-satunya pemilihan implementasi penyimpanan.
export const productRepository: ProductRepository = new DexieProductRepository(new ZannaDatabase())
