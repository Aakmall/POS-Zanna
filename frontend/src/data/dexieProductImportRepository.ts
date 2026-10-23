import type { ProductImportRepository, ImportPreview } from '../domain/productImport'
import { catalogFingerprint } from '../domain/productImport'
import { nameKey, validateProduct } from '../domain/validation'
import type { ZannaDatabase } from './database'
import { DexieProductRepository } from './dexieProductRepository'

export class DexieProductImportRepository implements ProductImportRepository {
  private readonly db: ZannaDatabase
  constructor(db: ZannaDatabase) { this.db = db }
  snapshot() { return new DexieProductRepository(this.db).getSnapshot() }
  async commit(incoming: ImportPreview): Promise<number> {
    const preview = structuredClone(incoming)
    if (preview.issues.length || !preview.drafts.length || preview.rows > 500) throw new Error('Perbaiki seluruh kesalahan lalu pilih ulang file sebelum impor.')
    return this.db.transaction('rw', [this.db.products, this.db.categories, this.db.units, this.db.variants], async () => {
      const repository = new DexieProductRepository(this.db), snapshot = await repository.getSnapshot()
      if (catalogFingerprint(snapshot) !== preview.catalogFingerprint) throw new Error('Data produk berubah sejak preview. Pilih ulang file dan periksa hasil sebelum impor.')
      const names = new Set(snapshot.products.map((p) => nameKey(p.name)))
      for (const draft of preview.drafts) {
        if (draft.id || draft.expectedUpdatedAt || draft.variants.some((v) => v.id) || names.has(nameKey(draft.name))) throw new Error('Impor hanya menambah produk baru. Ada identitas/nama produk yang bertabrakan.')
        names.add(nameKey(draft.name)); validateProduct(draft, await repository.getSnapshot())
        await repository.saveProduct(draft)
      }
      return preview.drafts.length
    })
  }
}
