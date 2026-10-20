import type { CatalogSnapshot, Category, Product, ProductDraft, UUID } from './product'

export interface ProductRepository {
  initialize(): Promise<void>
  getSnapshot(): Promise<CatalogSnapshot>
  saveProduct(draft: ProductDraft): Promise<Product>
  setProductActive(id: UUID, isActive: boolean, expectedUpdatedAt: string): Promise<void>
  saveCategory(name: string, id?: UUID): Promise<Category>
  setCategoryActive(id: UUID, isActive: boolean): Promise<void>
  seedDemo(): Promise<number>
  subscribe(next: (snapshot: CatalogSnapshot) => void, error: (error: unknown) => void): () => void
}
