import { QUANTITY_SCALE, type ProductUnitPolicy, type Unit } from '../../domain/product'
import { parseQuantity, quantityInput, quantityText } from '../../domain/quantity'
import { convertInventoryQuantity } from '../../domain/inventoryRules'
import { validateVariantUnit } from '../../domain/validation'

export type UnitEntry = 'direct' | 'packaging' | 'metric' | 'legacy'
export interface VariantUnitValue {
  sellingUnitId: string
  quantity: string
  saleMode: 'fixed' | 'variable'
  unitEntry?: UnitEntry // Form intent only; never written to the domain or database.
}

export function variantUnitEntry(value: VariantUnitValue, base: Unit | undefined, units: Unit[]): UnitEntry {
  if (value.unitEntry) return value.unitEntry
  const selling = units.find((unit) => unit.id === value.sellingUnitId)
  const quantity = parseQuantity(value.quantity)
  if (!base || !selling) return 'legacy'
  if (selling.id === base.id) return quantity === QUANTITY_SCALE ? 'direct' : 'legacy'
  if (selling.isPackaging) return 'packaging'
  if (base.dimension !== 'count' && selling.dimension === base.dimension && quantity === selling.factor * QUANTITY_SCALE / base.factor) return 'metric'
  return 'legacy'
}

// Only explicit form actions call these functions. Opening/editing a name never normalizes old data.
export function directUnitPatch(base: Unit, currentMode: VariantUnitValue['saleMode']): VariantUnitValue {
  return { unitEntry: 'direct', sellingUnitId: base.id, quantity: '1', saleMode: base.dimension === 'count' || base.isPackaging ? 'fixed' : currentMode }
}
export function packagingUnitPatch(sellingUnitId = ''): VariantUnitValue {
  return { unitEntry: 'packaging', sellingUnitId, quantity: '', saleMode: 'fixed' }
}
export function metricUnitPatch(base: Unit, selling: Unit, currentMode: VariantUnitValue['saleMode']): VariantUnitValue {
  return { unitEntry: 'metric', sellingUnitId: selling.id, quantity: quantityInput(selling.factor * QUANTITY_SCALE / base.factor), saleMode: currentMode }
}

export function stockImpact(value: VariantUnitValue, base: Unit, policy: ProductUnitPolicy, units: Unit[]): { lines: string[]; issue: string | null } {
  const quantity = parseQuantity(value.quantity)
  if (quantity === null) return { lines: [], issue: `Isi wajib berupa angka dalam ${base.name}, maksimal 3 angka di belakang koma.` }
  const selling = units.find((unit) => unit.id === value.sellingUnitId)
  if (!selling) return { lines: [], issue: 'Pilih jenis kemasan atau satuan jual terlebih dahulu.' }
  try {
    validateVariantUnit({ baseUnitId: base.id, unitPolicy: policy }, { sellingUnitId: selling.id, quantityInBaseUnit: quantity, saleMode: value.saleMode }, units)
    const conversion = { baseUnit: base, inputUnit: selling, quantityInBaseUnit: quantity, source: 'variant' as const }
    return { lines: [1, 2].map((count) => `Menjual ${count} ${selling.name} mengurangi stok ${quantityText(convertInventoryQuantity(count * QUANTITY_SCALE, conversion))} ${base.name}`), issue: null }
  } catch (cause) { return { lines: [], issue: cause instanceof Error ? cause.message : 'Periksa pengaturan satuan.' } }
}

// Advisory only: recognize explicit mass/volume labels, never infer or change a conversion.
export function variantSizeWarning(name: string, value: VariantUnitValue, base: Unit, units: Unit[]): string | null {
  const quantity = parseQuantity(value.quantity)
  if (quantity === null || quantity <= 0) return null
  const aliases: Record<string, string> = { l: 'l', liter: 'l', litre: 'l', ml: 'ml', mililiter: 'ml', milliliter: 'ml', kg: 'kg', kilogram: 'kg', g: 'g', gr: 'g', gram: 'g' }
  const sizes = name.matchAll(/(?:^|[^\d.,])(\d+(?:[.,]\d{1,3})?)\s*(milliliter|mililiter|kilogram|liter|litre|gram|ml|kg|gr|l|g)(?![\p{L}\p{N}])/giu)
  for (const match of sizes) {
    const namedUnit = units.find((unit) => unit.code === aliases[match[2].toLowerCase()])
    const namedQuantity = parseQuantity(match[1])
    if (!namedUnit || namedUnit.dimension !== base.dimension || namedQuantity === null || namedQuantity <= 0) continue
    if (BigInt(namedQuantity) * BigInt(namedUnit.factor) !== BigInt(quantity) * BigInt(base.factor)) {
      return `Periksa nama varian: tertulis ${match[1]} ${namedUnit.name}, tetapi pengaturan saat ini ${quantityText(quantity)} ${base.name} per satuan jual. Nama tidak menentukan isi atau mengubah stok. Jika ukuran kemasan dimaksudkan, pilih kemasan dan isi yang sesuai. Peringatan ini tidak menghalangi penyimpanan.`
    }
  }
  return null
}
