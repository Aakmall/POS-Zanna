import { Dexie, type Table } from 'dexie'
import type { Category, Product, ProductVariant, Unit } from '../domain/product'
import type { InventoryBalance, StockMovement } from '../domain/inventory'

export const PRODUCT_SCHEMA_V1 = {
  products: 'id, categoryId, baseUnitId, &demoKey, updatedAt',
  categories: 'id, &nameKey', units: 'id, &code',
  variants: 'id, productId, &sku, &barcode, sellingUnitId',
}

export class ZannaDatabase extends Dexie {
  products!: Table<Product, string>
  categories!: Table<Category, string>
  units!: Table<Unit, string>
  variants!: Table<ProductVariant, string>
  inventoryBalances!: Table<InventoryBalance, string>
  stockMovements!: Table<StockMovement, string>
  constructor(name = 'zanna-cell-db') {
    super(name)
    this.version(1).stores(PRODUCT_SCHEMA_V1)
    // Additive only: master v1 dipertahankan; stok lama TIDAK dibuat nol otomatis.
    this.version(2).stores({
      inventoryBalances: 'productId, updatedAt',
      stockMovements: 'id, productId, &operationId, [productId+createdAt], createdAt',
    })
    this.on('versionchange', () => this.close())
  }
}
