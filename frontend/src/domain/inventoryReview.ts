import type { CatalogSnapshot, Product } from './product'
import type { StockMovement } from './inventory'
import { assertUnitAllowed, validateUnitPolicy } from './unitPolicy'
import { validateConversion, variantUnitIssue } from './validation'
import { convertInventoryQuantity } from './inventoryRules'

export function productUnitIssues(product: Product, catalog: CatalogSnapshot): string[] {
  const base = catalog.units.find((unit) => unit.id === product.baseUnitId)
  const issues: string[] = []
  try {
    if (!base) throw new Error('Satuan dasar tidak ditemukan.')
    validateUnitPolicy(product.unitPolicy, base, catalog.units)
  } catch (cause) { issues.push(cause instanceof Error ? cause.message : 'Kebijakan satuan perlu ditinjau.') }
  for (const variant of catalog.variants.filter((item) => item.productId === product.id && item.isActive)) {
    const issue = variantUnitIssue(product, variant, catalog.units)
    if (issue) issues.push(`${variant.name}: ${issue}`)
  }
  return issues
}

// This is a read-only assessment against CURRENT policy, not a rewrite or verdict on the past.
export function historicalUnitIssue(record: StockMovement, catalog: CatalogSnapshot): string | null {
  const product = catalog.products.find((item) => item.id === record.productId)
  if (!product) return 'Produk tidak ditemukan; periksa snapshot historis secara manual.'
  if (!product.unitPolicy) return 'Kebijakan kemasan produk belum ditinjau. Kesesuaian catatan historis ini belum dapat dipastikan.'
  const conversion = record.conversionSnapshot
  try {
    if (product.baseUnitId !== conversion.baseUnit.id) throw new Error('Satuan dasar historis berbeda dari master saat ini.')
    assertUnitAllowed(product, conversion.baseUnit, conversion.inputUnit, catalog.units)
    validateConversion(conversion.baseUnit, conversion.inputUnit, conversion.quantityInBaseUnit, 'fixed')
    const amount = convertInventoryQuantity(record.inputQuantity, conversion)
    if (amount !== Math.abs(record.quantityDeltaBase)) throw new Error('Hasil konversi snapshot tidak sesuai delta historis.')
    return null
  } catch (cause) { return `${cause instanceof Error ? cause.message : 'Konversi perlu ditinjau.'} Penilaian memakai kebijakan saat ini; snapshot dan saldo tidak diubah.` }
}
