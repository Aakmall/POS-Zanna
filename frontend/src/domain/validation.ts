import { QUANTITY_SCALE, type CatalogSnapshot, type Product, type ProductDraft, type ProductVariant, type Unit, type VariantDraft } from './product'
import { ValidationError } from './errors'
import { assertUnitAllowed, validateUnitPolicy, type UnitMeasure } from './unitPolicy'

export { ValidationError } from './errors'
export const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('id')
export const validMoney = (value: number | null) => value === null || (Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000)
export function validateConversion(base: UnitMeasure, selling: UnitMeasure, quantity: number, mode: 'fixed' | 'variable') {
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 1_000_000_000) throw new ValidationError('Konversi wajib positif, maksimal 1.000.000 satuan dasar, dengan paling banyak 3 desimal.')
  if (base.id === selling.id && quantity !== QUANTITY_SCALE) throw new ValidationError('Konversi ke satuan dasar yang sama wajib 1; isi kemasan harus memakai satuan yang berbeda.')
  if (base.dimension === 'count' && quantity % QUANTITY_SCALE !== 0) throw new ValidationError('Konversi satuan dasar diskret tidak boleh menghasilkan pecahan pcs/bungkus/kemasan.')
  if (base.dimension !== selling.dimension && !selling.isPackaging) throw new ValidationError('Satuan berat tidak dapat dikonversi ke volume/jumlah, atau sebaliknya. Gunakan kemasan dengan isi yang jelas.')
  if (!selling.isPackaging && quantity * base.factor !== selling.factor * QUANTITY_SCALE) throw new ValidationError('Konversi satuan ukur harus mengikuti faktor baku. Contoh: 1 gram = 0,001 kg.')
  if (mode === 'variable' && (base.dimension === 'count' || selling.isPackaging || selling.dimension !== base.dimension)) throw new ValidationError('Jumlah aktual hanya untuk satuan ukur berat/volume yang kompatibel, bukan kemasan.')
}
export function validateVariantUnit(product: Pick<Product, 'baseUnitId' | 'unitPolicy'>, variant: Pick<VariantDraft, 'sellingUnitId' | 'quantityInBaseUnit' | 'saleMode'>, units: Unit[]) {
  const base = units.find((unit) => unit.id === product.baseUnitId)
  const selling = units.find((unit) => unit.id === variant.sellingUnitId)
  if (!base || !selling) throw new ValidationError('Satuan dasar/jual tidak ditemukan.')
  validateConversion(base, selling, variant.quantityInBaseUnit, variant.saleMode)
  assertUnitAllowed(product, base, selling, units)
}
export function variantUnitIssue(product: Pick<Product, 'baseUnitId' | 'unitPolicy'>, variant: ProductVariant | VariantDraft, units: Unit[]): string | null {
  try { validateVariantUnit(product, variant, units); return null } catch (cause) { return cause instanceof Error ? cause.message : 'Konfigurasi satuan tidak valid.' }
}
export function validateProduct(draft: ProductDraft, snapshot: CatalogSnapshot) {
  if (!draft.name.trim() || draft.name.trim().length > 100) throw new ValidationError('Nama produk wajib diisi, maksimal 100 karakter.')
  const category = snapshot.categories.find((item) => item.id === draft.categoryId)
  if (!category || (draft.isActive && !category.isActive)) throw new ValidationError('Pilih kategori yang valid dan aktif untuk produk aktif.')
  const base = snapshot.units.find((item) => item.id === draft.baseUnitId)
  if (!base) throw new ValidationError('Satuan dasar tidak valid.')
  validateUnitPolicy(draft.unitPolicy, base, snapshot.units)
  if (!validMoney(draft.costPrice) || draft.costKnown !== (draft.costPrice !== null)) throw new ValidationError('Modal harus rupiah bulat atau kosong dengan status belum diketahui.')
  if (draft.minimumStock !== null && (!Number.isSafeInteger(draft.minimumStock) || draft.minimumStock < 0 || draft.minimumStock > 1_000_000_000)) throw new ValidationError('Batas stok minimum tidak valid.')
  if (base.dimension === 'count' && draft.minimumStock !== null && draft.minimumStock % QUANTITY_SCALE !== 0) throw new ValidationError('Batas stok satuan diskret harus bilangan bulat dalam satuan dasar.')
  if (!draft.variants.length || (draft.isActive && !draft.variants.some((item) => item.isActive))) throw new ValidationError('Produk memerlukan minimal satu varian; produk aktif memerlukan varian aktif.')
  const skus = new Set<string>(), barcodes = new Set<string>(), ids = new Set<string>()
  for (const variant of snapshot.variants.filter((item) => item.productId !== draft.id || !draft.variants.some((entry) => entry.id === item.id))) {
    if (variant.sku) skus.add(variant.sku)
    if (variant.barcode) barcodes.add(variant.barcode)
  }
  for (const variant of draft.variants) {
    if (variant.id) {
      if (ids.has(variant.id) || !snapshot.variants.some((item) => item.id === variant.id && item.productId === draft.id)) throw new ValidationError('Identitas varian tidak valid atau duplikat.')
      ids.add(variant.id)
    }
    if (!variant.name.trim() || variant.name.trim().length > 80) throw new ValidationError('Nama varian wajib diisi, maksimal 80 karakter.')
    if (!validMoney(variant.sellingPrice)) throw new ValidationError('Harga jual harus rupiah bulat tidak negatif, atau kosong jika belum diatur.')
    if (!['fixed', 'variable'].includes(variant.saleMode)) throw new ValidationError('Mode penjualan varian tidak valid.')
    const unit = snapshot.units.find((item) => item.id === variant.sellingUnitId)
    if (!unit) throw new ValidationError('Pilih satuan jual yang valid.')
    // Only an unchanged legacy conversion may be retained as inactive for audit.
    const previous = snapshot.variants.find((item) => item.id === variant.id && item.productId === draft.id)
    const archiveUnchanged = !variant.isActive && previous && previous.sellingUnitId === variant.sellingUnitId && previous.quantityInBaseUnit === variant.quantityInBaseUnit && previous.saleMode === variant.saleMode
    if (!archiveUnchanged) validateVariantUnit(draft, variant, snapshot.units)
    const sku = variant.sku?.trim().toUpperCase(), barcode = variant.barcode?.trim()
    if (sku) { if (sku.length > 60 || skus.has(sku)) throw new ValidationError('SKU harus unik (termasuk varian nonaktif), maksimal 60 karakter.'); skus.add(sku) }
    if (barcode) { if (!/^[A-Za-z0-9-]{1,80}$/.test(barcode) || barcodes.has(barcode)) throw new ValidationError('Barcode harus unik pada seluruh varian, berisi huruf/angka/tanda hubung, maksimal 80 karakter.'); barcodes.add(barcode) }
  }
}
