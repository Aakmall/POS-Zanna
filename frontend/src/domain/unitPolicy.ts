import type { Product, ProductUnitPolicy, Unit } from './product'
import { ValidationError } from './errors'
export type UnitMeasure = Omit<Unit, 'createdAt' | 'updatedAt'>

export const dimensionLabels = { count: 'Jumlah (COUNT)', mass: 'Berat (MASS)', volume: 'Volume (VOLUME)' }
export const policyKindLabels = { general: 'Umum', fuel: 'BBM (bensin / solar)' }

// Codes are stable unit identities, never product names. Other products may allow sachets.
export function packagingPermittedByKind(kind: ProductUnitPolicy['kind'], unit: UnitMeasure) {
  return unit.isPackaging && (kind === 'general' || ['botol', 'jeriken'].includes(unit.code))
}

export function validateUnitPolicy(policy: ProductUnitPolicy | undefined, base: UnitMeasure, units: Unit[]): asserts policy is ProductUnitPolicy {
  if (!policy || !['general', 'fuel'].includes(policy.kind) || !Array.isArray(policy.allowedPackagingUnitIds)) throw new ValidationError('Tinjau dan simpan kebijakan satuan/kemasan produk terlebih dahulu.')
  if (policy.kind === 'fuel' && (base.dimension !== 'volume' || base.isPackaging)) throw new ValidationError('Produk BBM wajib memakai satuan dasar ukur VOLUME, seperti liter atau mililiter.')
  const ids = policy.allowedPackagingUnitIds
  if (new Set(ids).size !== ids.length || ids.some((id) => typeof id !== 'string' || !units.some((unit) => unit.id === id && unit.id !== base.id && packagingPermittedByKind(policy.kind, unit)))) throw new ValidationError('Daftar kemasan tidak valid. BBM hanya mendukung botol/jeriken yang diizinkan pemilik.')
}

export function assertUnitAllowed(product: Pick<Product, 'unitPolicy'>, base: UnitMeasure, input: UnitMeasure, units: Unit[]) {
  if (product.unitPolicy !== undefined) validateUnitPolicy(product.unitPolicy, base, units)
  if (input.id === base.id) return
  if (!input.isPackaging) {
    if (base.dimension === 'count' || input.dimension !== base.dimension) throw new ValidationError('Satuan tidak kompatibel: dimensi berat, volume, dan jumlah tidak boleh dicampur.')
    return
  }
  if (!product.unitPolicy) throw new ValidationError('Kemasan belum diizinkan. Tinjau kebijakan satuan produk di halaman Produk terlebih dahulu.')
  if (!packagingPermittedByKind(product.unitPolicy.kind, input) || !product.unitPolicy.allowedPackagingUnitIds.includes(input.id)) throw new ValidationError(`Kemasan ${input.name} tidak diizinkan untuk produk ini.`)
}

export function unitAllowed(product: Pick<Product, 'unitPolicy'>, base: Unit, input: Unit, units: Unit[]) {
  try { assertUnitAllowed(product, base, input, units); return true } catch { return false }
}
