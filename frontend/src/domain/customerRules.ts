import type { Customer, CustomerDraft, CustomerSnapshot } from './customer'
import { CreditError } from './credit'
import { assertRecord, assertTimestamp, assertUuid } from './checkoutValidation'

function text(value: unknown, label: string, limit: number, required = false): asserts value is string {
  if (typeof value !== 'string' || value.length > limit || (required && !value.trim())) throw new CreditError('INVALID_REQUEST', `${label}${required ? ' wajib diisi dan' : ''} maksimal ${limit} karakter.`)
}
export function validateCustomerDraft(value: CustomerDraft) {
  if (value.id !== undefined) { assertUuid(value.id, 'ID pelanggan'); assertTimestamp(value.expectedUpdatedAt) }
  text(value.name, 'Nama pelanggan', 100, true); text(value.phone, 'Telepon', 40); text(value.address, 'Alamat', 300); text(value.note, 'Catatan', 1000)
  if (typeof value.isActive !== 'boolean') throw new CreditError('INVALID_REQUEST', 'Status pelanggan tidak valid.')
}
export function validateCustomerSnapshot(value: unknown): asserts value is CustomerSnapshot {
  assertRecord(value, 'Snapshot pelanggan'); assertUuid(value.id, 'ID pelanggan'); assertTimestamp(value.updatedAt)
  text(value.name, 'Nama pelanggan', 100, true); text(value.phone, 'Telepon', 40); text(value.address, 'Alamat', 300)
}
export function validateCustomer(value: unknown): asserts value is Customer {
  assertRecord(value, 'Pelanggan')
  const record = value
  validateCustomerSnapshot(value)
  assertTimestamp(record.createdAt); text(record.note, 'Catatan', 1000)
  if (typeof record.isActive !== 'boolean' || Date.parse(value.updatedAt) < Date.parse(record.createdAt)) throw new CreditError('INTEGRITY_ERROR', 'Metadata pelanggan tidak konsisten.')
}
export function customerSnapshotKey(value: CustomerSnapshot) { return JSON.stringify([value.id, value.name, value.phone, value.address, value.updatedAt]) }
export function validateDueDate(value: unknown): asserts value is string | null {
  if (value === null) return
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0, 4) < '1000') throw new CreditError('INVALID_REQUEST', 'Tanggal jatuh tempo tidak valid.')
  const date = new Date(`${value}T12:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new CreditError('INVALID_REQUEST', 'Tanggal jatuh tempo tidak valid.')
}
