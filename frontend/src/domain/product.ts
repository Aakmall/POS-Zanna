export const QUANTITY_SCALE = 1000
export type UUID = string
export interface Metadata { createdAt: string; updatedAt: string }
export interface Category extends Metadata { id: UUID; name: string; nameKey: string; isActive: boolean }
export type UnitDimension = 'count' | 'mass' | 'volume'
export interface ProductUnitPolicy {
  kind: 'general' | 'fuel'
  allowedPackagingUnitIds: UUID[]
}
export interface Unit extends Metadata {
  id: UUID; code: string; name: string; dimension: UnitDimension
  factor: number; isPackaging: boolean
}
export interface Product extends Metadata {
  id: UUID; name: string; categoryId: UUID; baseUnitId: UUID
  costPrice: number | null; costKnown: boolean; minimumStock: number | null
  isActive: boolean; isDemo: boolean; demoKey?: string; illustration?: string
  unitPolicy?: ProductUnitPolicy // Absent on legacy records: packaging needs owner review.
}
export interface ProductVariant extends Metadata {
  id: UUID; productId: UUID; name: string; sku?: string; barcode?: string
  sellingUnitId: UUID; quantityInBaseUnit: number; sellingPrice: number | null
  saleMode: 'fixed' | 'variable'; isActive: boolean
}
export interface CatalogSnapshot { products: Product[]; categories: Category[]; units: Unit[]; variants: ProductVariant[] }
export interface VariantDraft {
  id?: UUID; name: string; sku?: string; barcode?: string; sellingUnitId: UUID
  quantityInBaseUnit: number; sellingPrice: number | null; saleMode: 'fixed' | 'variable'; isActive: boolean
}
export interface ProductDraft {
  id?: UUID; expectedUpdatedAt?: string; name: string; categoryId: UUID; baseUnitId: UUID
  costPrice: number | null; costKnown: boolean; minimumStock: number | null
  isActive: boolean; variants: VariantDraft[]
  unitPolicy?: ProductUnitPolicy
}
