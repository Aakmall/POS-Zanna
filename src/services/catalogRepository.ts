import type { CatalogSnapshot } from '../domain/product'
import type { CatalogItem, ProductIllustration } from '../types/pos'

const illustrationKeys = ['rice', 'oil', 'sugar', 'noodles', 'biscuit', 'water', 'tea', 'soap', 'tissue', 'fuel', 'diesel', 'sachet']
// Read model untuk UI lama: satu kartu = satu varian. Tidak ada salinan data permanen.
export function projectCatalog(snapshot: CatalogSnapshot): CatalogItem[] {
  return snapshot.variants.flatMap((variant) => {
    const product = snapshot.products.find((item) => item.id === variant.productId)
    const category = snapshot.categories.find((item) => item.id === product?.categoryId)
    const unit = snapshot.units.find((item) => item.id === variant.sellingUnitId)
    if (!product || !category || !unit) return []
    return [{
      id: variant.id, productId: product.id, name: variant.name === 'Standar' ? product.name : `${product.name} · ${variant.name}`,
      sku: variant.sku ?? '', barcode: variant.barcode, category: category.name, unit: unit.name,
      price: variant.sellingPrice, cost: null, stock: null, minimumStock: (product.minimumStock ?? 0) / 1000,
      symbol: product.name.slice(0, 2).toUpperCase(), isActive: product.isActive && category.isActive && variant.isActive,
      isDemo: product.isDemo, saleMode: variant.saleMode,
      illustration: illustrationKeys.includes(product.illustration ?? '') ? product.illustration as ProductIllustration : undefined,
    }]
  }).sort((a, b) => a.name.localeCompare(b.name, 'id'))
}
