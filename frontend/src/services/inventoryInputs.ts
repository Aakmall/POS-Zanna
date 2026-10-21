import type { CatalogSnapshot } from '../domain/product'
import { unitAllowed } from '../domain/unitPolicy'
import { variantUnitIssue } from '../domain/validation'

export interface InventoryInputOption { key: string; label: string; unitId: string; variantId?: string; custom?: boolean }
export function inventoryInputOptions(catalog: CatalogSnapshot, productId: string): InventoryInputOption[] {
  const product = catalog.products.find((item) => item.id === productId)
  const base = catalog.units.find((item) => item.id === product?.baseUnitId)
  if (!product || !base) return []
  const available = catalog.units.filter((unit) => unitAllowed(product, base, unit, catalog.units))
  return [
    ...available.filter((unit) => unit.id === base.id).map((unit) => ({ key: `base:${unit.id}`, label: `${unit.name} · satuan dasar`, unitId: unit.id })),
    ...available.filter((unit) => unit.id !== base.id && base.dimension !== 'count' && unit.dimension === base.dimension && !unit.isPackaging)
      .map((unit) => ({ key: `unit:${unit.id}`, label: unit.name, unitId: unit.id })),
    ...catalog.variants.filter((variant) => variant.productId === productId && variant.isActive && !variantUnitIssue(product, variant, catalog.units)).map((variant) => ({
      key: `variant:${variant.id}`, label: `Varian: ${variant.name} (${catalog.units.find((item) => item.id === variant.sellingUnitId)?.name ?? '—'})`, unitId: variant.sellingUnitId, variantId: variant.id,
    })),
    ...available.filter((unit) => unit.isPackaging && unit.id !== base.id).map((unit) => ({ key: `custom:${unit.id}`, label: `${unit.name} · isi manual`, unitId: unit.id, custom: true })),
  ]
}
