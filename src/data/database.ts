import { Dexie, type Table } from 'dexie'
import type { Category, Product, ProductVariant, Unit } from '../domain/product'

export class ZannaDatabase extends Dexie {
  products!: Table<Product, string>
  categories!: Table<Category, string>
  units!: Table<Unit, string>
  variants!: Table<ProductVariant, string>
  constructor(name = 'zanna-cell-db') {
    super(name)
    this.version(1).stores({
      products: 'id, categoryId, baseUnitId, &demoKey, updatedAt',
      categories: 'id, &nameKey', units: 'id, &code',
      variants: 'id, productId, &sku, &barcode, sellingUnitId',
    })
    // Versi berikutnya ditambahkan dengan version(n).stores(...).upgrade(...).
    // Jangan mengganti/menghapus versi ini untuk mengubah skema pengguna lama.
    this.on('versionchange', () => this.close())
  }
}
