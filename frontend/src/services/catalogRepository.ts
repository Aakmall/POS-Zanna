import type { CatalogSnapshot } from '../domain/product'
import type { CatalogItem, ProductIllustration } from '../types/pos'
import type { InventoryBalance } from '../domain/inventory'
import { stockStatus } from '../domain/inventoryRules'
import { variantUnitIssue } from '../domain/validation'

const illustrationKeys = ['rice', 'oil', 'sugar', 'noodles', 'biscuit', 'water', 'tea', 'soap', 'tissue', 'fuel', 'diesel', 'sachet']
// Read model untuk UI lama: satu kartu = satu varian. Tidak ada salinan data permanen.
export function projectCatalog(snapshot: CatalogSnapshot, balances: InventoryBalance[] = []): CatalogItem[] {
  return snapshot.variants.flatMap((variant) => {
    const product = snapshot.products.find((item) => item.id === variant.productId)
    const category = snapshot.categories.find((item) => item.id === product?.categoryId)
    const unit = snapshot.units.find((item) => item.id === variant.sellingUnitId)
    if (!product || !category || !unit) return []
    if (variantUnitIssue(product, variant, snapshot.units)) return []
    const balance = balances.find((item) => item.productId === product.id)
    const baseUnit = snapshot.units.find((item) => item.id === product.baseUnitId)
    return [{
      id: variant.id, productId: product.id, name: variant.name === 'Standar' ? product.name : `${product.name} · ${variant.name}`,
      sku: variant.sku ?? '', barcode: variant.barcode, category: category.name, unit: unit.name,
      price: variant.sellingPrice, cost: null,
      stock: balance && variant.quantityInBaseUnit > 0 ? variant.saleMode === 'variable' ? balance.quantityBase / variant.quantityInBaseUnit : Math.floor(balance.quantityBase / variant.quantityInBaseUnit) : null,
      stockBase: balance?.quantityBase ?? null, stockStatus: stockStatus(balance, product.minimumStock),
      quantityInBaseUnit: variant.quantityInBaseUnit, baseUnitName: baseUnit?.name,
      conversion: baseUnit ? { baseUnit, inputUnit: unit, quantityInBaseUnit: variant.quantityInBaseUnit, source: 'variant' as const, variantId: variant.id, variantName: variant.name } : undefined,
      minimumStock: product.minimumStock === null ? null : product.minimumStock / 1000,
      symbol: product.name.slice(0, 2).toUpperCase(), isActive: product.isActive && category.isActive && variant.isActive,
      isDemo: product.isDemo, saleMode: variant.saleMode,
      illustration: illustrationKeys.includes(product.illustration ?? '') ? product.illustration as ProductIllustration : undefined,
    }]
  }).sort((a, b) => a.name.localeCompare(b.name, 'id'))
}
