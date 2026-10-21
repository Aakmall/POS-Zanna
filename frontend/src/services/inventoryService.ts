import { localDatabase } from '../data/localDatabase'
import { DexieInventoryRepository } from '../data/dexieInventoryRepository'
import { InventoryService } from './inventoryOperations'
export const inventoryService = new InventoryService(new DexieInventoryRepository(localDatabase))
