import { CheckoutError } from './checkout'
import type { UnitSnapshot } from './inventory'

export function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CheckoutError('INVALID_REQUEST', `${label} harus object yang valid.`)
}
export function assertUuid(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(value)) throw new CheckoutError('INVALID_REQUEST', `${label} harus UUID v4.`)
}
export function assertTimestamp(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new CheckoutError('INVALID_REQUEST', 'Waktu harus ISO UTC dengan milidetik yang valid.')
}
export function assertText(value: unknown, label: string, maximum = 300): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw new CheckoutError('INVALID_REQUEST', `${label} wajib diisi, maksimal ${maximum} karakter.`)
}
export function assertUnitSnapshot(value: unknown): asserts value is UnitSnapshot {
  assertRecord(value, 'Snapshot satuan'); assertUuid(value.id, 'ID satuan')
  assertText(value.code, 'Kode satuan', 60); assertText(value.name, 'Nama satuan', 100)
  if ((value.dimension !== 'count' && value.dimension !== 'mass' && value.dimension !== 'volume') || typeof value.factor !== 'number' || !Number.isSafeInteger(value.factor) || value.factor <= 0 || value.factor > 1_000_000_000 || typeof value.isPackaging !== 'boolean' || (value.isPackaging && value.dimension !== 'count')) throw new CheckoutError('INVALID_REQUEST', 'Dimensi/faktor snapshot satuan tidak valid.')
}
export function unitSnapshotKey(unit: UnitSnapshot): string {
  return JSON.stringify([unit.id, unit.code, unit.name, unit.dimension, unit.factor, unit.isPackaging])
}
