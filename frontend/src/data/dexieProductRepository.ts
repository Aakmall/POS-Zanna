import { liveQuery } from 'dexie'
import type { ProductRepository } from '../domain/productRepository'
import type { CatalogSnapshot, Category, Product, ProductDraft, ProductVariant } from '../domain/product'
import { createUuid } from '../domain/id'
import { nameKey, validateProduct, ValidationError } from '../domain/validation'
import { categories as demoCategoryNames } from '../types/pos'
import { builtinUnits } from './units'
import { demoDrafts } from './demoSeed'
import { ZannaDatabase } from './database'

const nextStamp = (previous?: string) => new Date(Math.max(Date.now(), previous ? Date.parse(previous) + 1 : 0)).toISOString()

export class DexieProductRepository implements ProductRepository {
  private readonly db: ZannaDatabase
  constructor(db: ZannaDatabase) { this.db = db }
  private tables() { return [this.db.products, this.db.categories, this.db.units, this.db.variants] }

  async initialize() {
    await this.db.transaction('rw', this.db.units, async () => {
      for (const unit of builtinUnits) {
        if (!await this.db.units.where('code').equals(unit.code).first()) await this.db.units.add(unit)
      }
    })
  }

  async getSnapshot(): Promise<CatalogSnapshot> {
    return this.db.transaction('r', this.tables(), async () => ({
      products: await this.db.products.toArray(), categories: await this.db.categories.toArray(),
      units: await this.db.units.toArray(), variants: await this.db.variants.toArray(),
    }))
  }

  subscribe(next: (snapshot: CatalogSnapshot) => void, error: (error: unknown) => void) {
    const subscription = liveQuery(() => this.getSnapshot()).subscribe({ next, error })
    return () => subscription.unsubscribe()
  }

  async saveProduct(draft: ProductDraft): Promise<Product> {
    return this.db.transaction('rw', this.tables(), async () => {
      const snapshot = await this.getSnapshot()
      const old = draft.id ? snapshot.products.find((item) => item.id === draft.id) : undefined
      if (draft.id && !old) throw new ValidationError('Produk tidak ditemukan. Muat ulang halaman.')
      if (old && draft.expectedUpdatedAt !== old.updatedAt) throw new ValidationError('Produk sudah diubah di tab lain. Tutup form dan buka kembali sebelum menyimpan.')
      if (old && old.baseUnitId !== draft.baseUnitId) throw new ValidationError('Satuan dasar produk tersimpan tidak dapat diganti. Nonaktifkan dan buat produk baru agar makna konversi tidak berubah.')
      validateProduct(draft, snapshot)
      const now = nextStamp(old?.updatedAt)
      const product: Product = {
        id: old?.id ?? createUuid(), name: draft.name.trim(), categoryId: draft.categoryId, baseUnitId: draft.baseUnitId,
        costPrice: draft.costPrice, costKnown: draft.costKnown, minimumStock: draft.minimumStock, isActive: draft.isActive,
        createdAt: old?.createdAt ?? now, updatedAt: now, isDemo: old?.isDemo ?? false,
        ...(old?.demoKey ? { demoKey: old.demoKey } : {}), ...(old?.illustration ? { illustration: old.illustration } : {}),
      }
      await this.db.products.put(product)
      for (const entry of draft.variants) {
        const previous = snapshot.variants.find((item) => item.id === entry.id)
        const variant: ProductVariant = {
          id: entry.id ?? createUuid(), productId: product.id, name: entry.name.trim(),
          ...(entry.sku?.trim() ? { sku: entry.sku.trim().toUpperCase() } : {}),
          ...(entry.barcode?.trim() ? { barcode: entry.barcode.trim() } : {}),
          sellingUnitId: entry.sellingUnitId, quantityInBaseUnit: entry.quantityInBaseUnit, sellingPrice: entry.sellingPrice,
          saleMode: entry.saleMode, isActive: entry.isActive, createdAt: previous?.createdAt ?? now, updatedAt: now,
        }
        await this.db.variants.put(variant)
      }
      // Varian lama dipertahankan sebagai nonaktif; tidak ada hard delete.
      for (const entry of snapshot.variants.filter((item) => item.productId === product.id && !draft.variants.some((variant) => variant.id === item.id))) {
        await this.db.variants.put({ ...entry, isActive: false, updatedAt: now })
      }
      return product
    })
  }

  async setProductActive(id: string, isActive: boolean, expectedUpdatedAt: string) {
    await this.db.transaction('rw', this.tables(), async () => {
      const snapshot = await this.getSnapshot()
      const product = snapshot.products.find((item) => item.id === id)
      if (!product) throw new ValidationError('Produk tidak ditemukan.')
      await this.saveProduct({ ...product, expectedUpdatedAt, isActive, variants: snapshot.variants.filter((item) => item.productId === id) })
    })
  }

  async saveCategory(name: string, id?: string): Promise<Category> {
    return this.db.transaction('rw', this.db.categories, async () => {
      const key = nameKey(name)
      if (!key || name.trim().length > 60) throw new ValidationError('Nama kategori wajib diisi, maksimal 60 karakter.')
      const duplicate = await this.db.categories.where('nameKey').equals(key).first()
      if (duplicate && duplicate.id !== id) throw new ValidationError('Nama kategori sudah digunakan.')
      const previous = id ? await this.db.categories.get(id) : undefined
      if (id && !previous) throw new ValidationError('Kategori tidak ditemukan.')
      const now = nextStamp(previous?.updatedAt)
      const category: Category = { id: id ?? createUuid(), name: name.trim().replace(/\s+/g, ' '), nameKey: key, isActive: previous?.isActive ?? true, createdAt: previous?.createdAt ?? now, updatedAt: now }
      await this.db.categories.put(category)
      return category
    })
  }

  async setCategoryActive(id: string, isActive: boolean) {
    await this.db.transaction('rw', this.db.categories, this.db.products, async () => {
      const category = await this.db.categories.get(id)
      if (!category) throw new ValidationError('Kategori tidak ditemukan.')
      if (!isActive && await this.db.products.where('categoryId').equals(id).filter((item) => item.isActive).count()) throw new ValidationError('Nonaktifkan atau pindahkan produk aktif di kategori ini terlebih dahulu.')
      await this.db.categories.put({ ...category, isActive, updatedAt: nextStamp(category.updatedAt) })
    })
  }

  async seedDemo() {
    await this.initialize()
    return this.db.transaction('rw', this.tables(), async () => {
      for (const name of demoCategoryNames) {
        if (!await this.db.categories.where('nameKey').equals(nameKey(name)).first()) await this.saveCategory(name)
      }
      const snapshot = await this.getSnapshot()
      let count = 0
      for (const entry of demoDrafts(snapshot.categories, snapshot.units)) {
        if (await this.db.products.where('demoKey').equals(entry.key).first()) continue
        const product = await this.saveProduct(entry.draft)
        await this.db.products.put({ ...product, isDemo: true, demoKey: entry.key, illustration: entry.illustration })
        count += 1
      }
      return count
    })
  }
}
