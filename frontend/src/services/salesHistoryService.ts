import { localDatabase } from '../data/localDatabase'
import { DexieSalesHistoryRepository } from '../data/dexieSalesHistoryRepository'
import { SalesHistoryService } from './salesHistoryOperations'

export const salesHistoryService = new SalesHistoryService(new DexieSalesHistoryRepository(localDatabase))
