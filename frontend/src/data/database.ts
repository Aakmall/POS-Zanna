import { Dexie, type Table } from 'dexie'
import type { Category, Product, ProductVariant, Unit } from '../domain/product'
import type { InventoryBalance, StockMovement } from '../domain/inventory'
import type { Sale, SaleItem } from '../domain/sale'
import type { CheckoutIntent } from '../domain/checkout'

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
  sales!: Table<Sale, string>
  saleItems!: Table<SaleItem, string>
  checkoutIntents!: Table<CheckoutIntent, string>
  constructor(name = 'zanna-cell-db') {
    super(name)
    this.version(1).stores(PRODUCT_SCHEMA_V1)
    // Additive only: master v1 dipertahankan; stok lama TIDAK dibuat nol otomatis.
    this.version(2).stores({
      inventoryBalances: 'productId, updatedAt',
      stockMovements: 'id, productId, &operationId, [productId+createdAt], createdAt',
    })
    // No backfill: v2 data/quantities/ledger are untouched.
    this.version(3).stores({
      sales: 'id, &receiptNumber, &checkoutOperationId, createdAt, status',
      saleItems: 'id, saleId, productId, variantId, &[saleId+position]',
      checkoutIntents: 'checkoutOperationId, status, createdAt, saleId',
      stockMovements: 'id, productId, &operationId, [productId+createdAt], createdAt, saleId, &saleItemId',
    })
    this.on('versionchange', () => this.close())
  }
}
