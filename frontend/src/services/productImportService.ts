import { localDatabase } from '../data/localDatabase'
import { DexieProductImportRepository } from '../data/dexieProductImportRepository'
import { ProductImportService } from './productImportOperations'
export const productImportService = new ProductImportService(new DexieProductImportRepository(localDatabase))
