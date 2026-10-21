import type { CatalogSnapshot, Unit } from './product'
import { QUANTITY_SCALE } from './product'
import type { ConversionSnapshot, InventoryBalance, InventoryCommand, StockStatus } from './inventory'
import { movementTypes } from './inventory'
import { validateVariantUnit, ValidationError } from './validation'
import { assertUnitAllowed } from './unitPolicy'

export const MAX_STOCK_BASE = 1_000_000_000_000
export const movementLabels = { OPENING_BALANCE: 'Stok awal', STOCK_IN: 'Stok masuk', ADJUSTMENT_IN: 'Koreksi masuk', ADJUSTMENT_OUT: 'Koreksi keluar' }
export const stockStatusLabels: Record<StockStatus, string> = {
  NOT_INITIALIZED: 'Belum diatur', OUT_OF_STOCK: 'Stok habis', LOW_STOCK: 'Stok menipis', IN_STOCK: 'Tersedia',
}
export function stockStatus(balance: InventoryBalance | undefined, minimumStock: number | null): StockStatus {
  if (!balance) return 'NOT_INITIALIZED'
  if (balance.quantityBase === 0) return 'OUT_OF_STOCK'
  if (minimumStock !== null && balance.quantityBase <= minimumStock) return 'LOW_STOCK'
  return 'IN_STOCK'
}
export function validateInventoryCommand(command: InventoryCommand) {
  if (!/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(command.operationId)) throw new ValidationError('Identitas operasi UUID tidak valid.')
  if (!movementTypes.includes(command.movementType)) throw new ValidationError('Jenis mutasi belum didukung pada Fase 3.')
  if (!Number.isSafeInteger(command.inputQuantity) || command.inputQuantity < 0 || command.inputQuantity > MAX_STOCK_BASE) throw new ValidationError('Jumlah stok harus valid, tidak negatif, dan maksimal tiga desimal.')
  if (command.movementType !== 'OPENING_BALANCE' && command.inputQuantity === 0) throw new ValidationError('Jumlah stok masuk atau koreksi harus lebih besar dari nol.')
  if (typeof command.reason !== 'string' || command.reason.trim().length > 300) throw new ValidationError('Alasan maksimal 300 karakter.')
  if (command.movementType.startsWith('ADJUSTMENT') && !command.reason.trim()) throw new ValidationError('Alasan koreksi wajib diisi.')
}
export function commandFingerprint(command: InventoryCommand) {
  return JSON.stringify([command.productId, command.movementType, command.inputQuantity, command.inputUnitId,
    command.variantId ?? null, command.customQuantityInBaseUnit ?? null, command.reason.trim(),
    command.expectedBeforeBase ?? null, command.expectedFactorBase ?? null])
}
function unitSnapshot(unit: Unit) {
  return { id: unit.id, code: unit.code, name: unit.name, dimension: unit.dimension, factor: unit.factor, isPackaging: unit.isPackaging }
}
export function resolveConversion(command: InventoryCommand, catalog: CatalogSnapshot): ConversionSnapshot {
  const product = catalog.products.find((item) => item.id === command.productId)
  const base = catalog.units.find((item) => item.id === product?.baseUnitId)
  const input = catalog.units.find((item) => item.id === command.inputUnitId)
  if (!product || !base || !input) throw new ValidationError('Produk atau satuan tidak ditemukan. Muat ulang data.')
  assertUnitAllowed(product, base, input, catalog.units)
  let factor: number, source: ConversionSnapshot['source']
  let variantName: string | undefined
  if (command.variantId) {
    if (command.customQuantityInBaseUnit !== undefined) throw new ValidationError('Pilih konversi varian atau kemasan manual, bukan keduanya.')
    const variant = catalog.variants.find((item) => item.id === command.variantId && item.productId === product.id && item.isActive && item.sellingUnitId === input.id)
    if (!variant) throw new ValidationError('Varian konversi tidak aktif atau tidak sesuai produk/satuan.')
    validateVariantUnit(product, variant, catalog.units)
    factor = variant.quantityInBaseUnit; source = 'variant'; variantName = variant.name
  } else if (command.customQuantityInBaseUnit !== undefined) {
    if (!input.isPackaging || input.id === base.id) throw new ValidationError('Isi manual hanya untuk kemasan yang berbeda dari satuan dasar.')
    factor = command.customQuantityInBaseUnit; source = 'custom'
  } else if (input.id === base.id) { factor = QUANTITY_SCALE; source = 'base' }
  else {
    if (base.dimension === 'count' || input.dimension !== base.dimension || input.isPackaging) throw new ValidationError('Satuan tidak kompatibel. Isi dus/botol/jeriken wajib ditentukan secara eksplisit.')
    factor = input.factor * QUANTITY_SCALE / base.factor; source = 'metric'
  }
  if (!Number.isSafeInteger(factor) || factor <= 0 || factor > 1_000_000_000) throw new ValidationError('Faktor konversi harus positif dan dapat direpresentasikan tepat dalam skala 1.000.')
  if (base.dimension === 'count' && factor % QUANTITY_SCALE !== 0) throw new ValidationError('Isi satu kemasan tidak boleh berupa pecahan satuan dasar diskret.')
  if (command.expectedFactorBase !== undefined && command.expectedFactorBase !== factor) throw new ValidationError('Konversi telah berubah. Buka kembali form dan periksa konversi terbaru.')
  return { baseUnit: unitSnapshot(base), inputUnit: unitSnapshot(input), quantityInBaseUnit: factor, source,
    ...(command.variantId ? { variantId: command.variantId, variantName } : {}) }
}
export function convertInventoryQuantity(inputQuantity: number, conversion: ConversionSnapshot): number {
  if (!Number.isSafeInteger(inputQuantity) || inputQuantity < 0 || inputQuantity > MAX_STOCK_BASE) throw new ValidationError('Jumlah masukan tidak valid.')
  if (conversion.inputUnit.dimension === 'count' && inputQuantity % QUANTITY_SCALE !== 0) throw new ValidationError('Satuan jumlah/kemasan harus berupa bilangan bulat. Gunakan satuan dasar untuk sebagian isi kemasan.')
  const numerator = BigInt(inputQuantity) * BigInt(conversion.quantityInBaseUnit)
  if (numerator % BigInt(QUANTITY_SCALE) !== 0n) throw new ValidationError('Hasil konversi lebih kecil dari presisi satuan dasar. Pilih jumlah/satuan yang dapat disimpan tepat.')
  const result = numerator / BigInt(QUANTITY_SCALE)
  if (result > BigInt(MAX_STOCK_BASE)) throw new ValidationError('Hasil konversi melampaui batas saldo yang didukung.')
  if (conversion.baseUnit.dimension === 'count' && result % BigInt(QUANTITY_SCALE) !== 0n) throw new ValidationError('Konversi menghasilkan pecahan satuan dasar diskret yang tidak sah.')
  return Number(result)
}
export function previewMovement(command: InventoryCommand, catalog: CatalogSnapshot, balance?: InventoryBalance) {
  validateInventoryCommand(command)
  if (command.movementType === 'OPENING_BALANCE' && balance) throw new ValidationError('Stok awal sudah diatur. Gunakan stok masuk atau koreksi.')
  if (command.movementType !== 'OPENING_BALANCE' && !balance) throw new ValidationError('Atur stok awal terlebih dahulu sebelum stok masuk atau koreksi.')
  const before = balance?.quantityBase ?? 0
  if (!Number.isSafeInteger(before) || before < 0 || before > MAX_STOCK_BASE) throw new ValidationError('Saldo tersimpan tidak valid. Jangan lanjutkan sebelum data diperiksa.')
  if (command.expectedBeforeBase !== undefined && command.expectedBeforeBase !== before) throw new ValidationError('Saldo telah berubah di operasi/tab lain. Buka kembali form untuk meninjau saldo terbaru.')
  const conversion = resolveConversion(command, catalog)
  const amount = convertInventoryQuantity(command.inputQuantity, conversion)
  const delta = command.movementType === 'ADJUSTMENT_OUT' ? -amount : amount
  const after = before + delta
  if (after < 0) throw new ValidationError('Koreksi keluar melebihi saldo tersedia. Stok tidak boleh negatif.')
  if (!Number.isSafeInteger(after) || after > MAX_STOCK_BASE) throw new ValidationError('Saldo akhir melampaui batas yang didukung.')
  return { before, after, delta, conversion }
}
