import { demoProducts } from '../mocks/products'
import type { Category, ProductDraft, Unit } from '../domain/product'
import { nameKey } from '../domain/validation'

export function demoDrafts(categories: Category[], units: Unit[]) {
  const unitId = (code: string) => units.find((item) => item.code === code)!.id
  return demoProducts.filter((item) => !['p11', 'p12'].includes(item.id)).map((item) => {
    const code = item.id === 'p1' || item.id === 'p3' ? 'kg' : ['p2', 'p10', 'p13'].includes(item.id) ? 'l' : ['p4', 'p5'].includes(item.id) ? 'bungkus' : ['p6', 'p7'].includes(item.id) ? 'botol' : item.id === 'p14' ? 'sachet' : 'pcs'
    const draft: ProductDraft = {
      name: item.id === 'p10' ? 'Bensin' : item.name,
      categoryId: categories.find((category) => category.nameKey === nameKey(item.category))!.id,
      baseUnitId: unitId(code), costPrice: item.cost, costKnown: item.cost !== null,
      unitPolicy: { kind: ['p10', 'p13'].includes(item.id) ? 'fuel' : 'general', allowedPackagingUnitIds: item.id === 'p10' ? [unitId('botol'), unitId('jeriken')] : item.id === 'p13' ? [unitId('jeriken')] : item.id === 'p4' ? [unitId('dus')] : [] },
      minimumStock: item.minimumStock === null ? null : item.minimumStock * 1000, isActive: true,
      variants: [{ name: 'Standar', sku: item.sku, sellingUnitId: unitId(code), quantityInBaseUnit: 1000, sellingPrice: item.price, saleMode: 'fixed', isActive: true }],
    }
    if (item.id === 'p10') draft.variants = [
      { name: '1 liter', sku: 'BM-001', sellingUnitId: unitId('botol'), quantityInBaseUnit: 1000, sellingPrice: null, saleMode: 'fixed', isActive: true },
      { name: '1,5 liter', sku: 'BM-002', sellingUnitId: unitId('botol'), quantityInBaseUnit: 1500, sellingPrice: null, saleMode: 'fixed', isActive: true },
      { name: '5 liter', sku: 'BM-003', sellingUnitId: unitId('jeriken'), quantityInBaseUnit: 5000, sellingPrice: null, saleMode: 'fixed', isActive: true },
    ]
    if (item.id === 'p4') draft.variants.push({ name: 'Dus isi 40', sku: 'MK-001-DUS', sellingUnitId: unitId('dus'), quantityInBaseUnit: 40000, sellingPrice: 135000, saleMode: 'fixed', isActive: true })
    return { key: `phase2-${item.id}`, illustration: item.illustration, draft }
  })
}
