import { BACKUP_FORMAT, BACKUP_SCHEMA, BACKUP_TABLES, MAX_BACKUP_BYTES, type BackupData, type BackupFile, type BackupTable } from './backup'
import { assertRecord, assertTimestamp, assertUuid } from './checkoutValidation'
import { validateBackupData } from './backupValidation'

export function canonical(value: unknown): string {
  const seen = new Set<object>()
  const normalize = (value: unknown, depth: number): unknown => {
    if (depth > 30) throw new Error('Struktur cadangan terlalu dalam.')
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value !== 'object' || value instanceof Date || seen.has(value)) throw new Error('Ada nilai data yang tidak dapat dicadangkan dengan aman.')
    seen.add(value)
    try {
      if (Array.isArray(value)) return value.map((v) => normalize(v, depth + 1))
      const entries = Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b, 'en'))
      if (entries.some(([key]) => ['__proto__', 'constructor', 'prototype'].includes(key))) throw new Error('Nama kolom cadangan tidak didukung.')
      return Object.fromEntries(entries.map(([key, v]) => [key, normalize(v, depth + 1)]))
    } finally { seen.delete(value) }
  }
  const text = JSON.stringify(normalize(value, 0))
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new Error('Cadangan melampaui batas 50 MB. Hubungi pengembang untuk data besar.')
  return text
}
export function backupCounts(data: BackupData): Record<BackupTable, number> {
  return Object.fromEntries(BACKUP_TABLES.map((name) => [name, data[name].length])) as Record<BackupTable, number>
}
async function checksum(value: unknown): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)))
  return [...new Uint8Array(hash)].map((n) => n.toString(16).padStart(2, '0')).join('')
}
export async function makeBackup(data: BackupData): Promise<BackupFile> {
  validateBackupData(data)
  const body: Omit<BackupFile, 'checksum'> = { format: BACKUP_FORMAT, formatVersion: 1, schemaVersion: BACKUP_SCHEMA, appVersion: 'phase-7', id: crypto.randomUUID(), createdAt: new Date().toISOString(), counts: backupCounts(data), data }
  return { ...body, checksum: await checksum(body) }
}
export async function parseBackup(text: string): Promise<BackupFile> {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new Error('File cadangan maksimal 50 MB.')
  let value: unknown
  try { value = JSON.parse(text) } catch { throw new Error('File cadangan rusak atau bukan JSON yang valid.') }
  assertRecord(value, 'Berkas cadangan')
  const fields = ['format', 'formatVersion', 'schemaVersion', 'appVersion', 'id', 'createdAt', 'counts', 'data', 'checksum']
  if (Object.keys(value).length !== fields.length || Object.keys(value).some((key) => !fields.includes(key)) || value.format !== BACKUP_FORMAT || value.formatVersion !== 1 || value.schemaVersion !== BACKUP_SCHEMA || value.appVersion !== 'phase-7') throw new Error('Format atau versi cadangan belum didukung. Gunakan cadangan versi skema 5 dari aplikasi ini.')
  assertUuid(value.id, 'Identitas cadangan'); assertTimestamp(value.createdAt); assertRecord(value.counts, 'Jumlah catatan')
  if (typeof value.checksum !== 'string' || !/^[a-f0-9]{64}$/.test(value.checksum)) throw new Error('Pemeriksaan keutuhan file tidak tersedia.')
  const { checksum: recorded, ...body } = value
  if (await checksum(body) !== recorded) throw new Error('Isi cadangan berubah atau rusak. Pemulihan dibatalkan.')
  validateBackupData(value.data)
  const counts = value.counts, data = value.data
  if (Object.keys(counts).length !== BACKUP_TABLES.length || BACKUP_TABLES.some((name) => counts[name] !== data[name].length)) throw new Error('Jumlah catatan tidak sesuai isi cadangan.')
  // Runtime format and all 14 table graphs have been checked, without defaults/repair.
  return value as unknown as BackupFile
}
export const pendingOperations = (data: BackupData) => data.checkoutIntents.filter((i) => i.status === 'PREPARED').length + data.creditPaymentIntents.filter((i) => i.status === 'PREPARED').length
