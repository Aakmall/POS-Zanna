import type { InventoryCommand, InventoryRepository, InventoryBalance } from '../domain/inventory'
import type { CatalogSnapshot } from '../domain/product'
import { previewMovement, validateInventoryCommand } from '../domain/inventoryRules'

export class InventoryService {
  private readonly repository: InventoryRepository
  constructor(repository: InventoryRepository) { this.repository = repository }
  preview(command: InventoryCommand, catalog: CatalogSnapshot, balance?: InventoryBalance) { return previewMovement(command, catalog, balance) }
  async execute(command: InventoryCommand) { const request = { ...command }; validateInventoryCommand(request); return this.repository.apply(request) }
  getBalances() { return this.repository.getBalances() }
  getHistory(productId: string) { return this.repository.getHistory(productId) }
  subscribeBalances(...args: Parameters<InventoryRepository['subscribeBalances']>) { return this.repository.subscribeBalances(...args) }
  subscribeHistory(...args: Parameters<InventoryRepository['subscribeHistory']>) { return this.repository.subscribeHistory(...args) }
}
