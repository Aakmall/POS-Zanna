import type { BackupData, BackupRepository } from '../domain/backup'
import { BACKUP_SCHEMA, BACKUP_TABLES } from '../domain/backup'
import { canonical, pendingOperations } from '../domain/backupFormat'
import { validateBackupData } from '../domain/backupValidation'
import type { ZannaDatabase } from './database'

export class DexieBackupRepository implements BackupRepository {
  private readonly db: ZannaDatabase
  constructor(db: ZannaDatabase) { this.db = db }
  private checkSchema() { if (this.db.verno !== BACKUP_SCHEMA || this.db.tables.length !== BACKUP_TABLES.length || this.db.tables.some((t) => !BACKUP_TABLES.includes(t.name as typeof BACKUP_TABLES[number]))) throw new Error('Versi penyimpanan tidak didukung untuk cadangan ini.') }
  private async readRows(): Promise<BackupData> {
    const value: unknown = Object.fromEntries(await Promise.all(BACKUP_TABLES.map(async (name) => [name, await this.db.table(name).toArray()])))
    validateBackupData(value)
    return value
  }
  async read(): Promise<BackupData> {
    this.checkSchema()
    return this.db.transaction('r', this.db.tables, () => this.readRows())
  }
  // Only the service's exclusive maintenance section calls this method in the app.
  async replace(incoming: BackupData, expectedCurrent: string): Promise<void> {
    const data = structuredClone(incoming); validateBackupData(data); this.checkSchema()
    const expectedRestored = canonical(data)
    await this.db.transaction('rw', this.db.tables, async () => {
      const before = await this.readRows()
      if (canonical(before) !== expectedCurrent) throw new Error('Data berubah sejak pemeriksaan cadangan. Periksa ulang file sebelum memulihkan.')
      if (pendingOperations(before)) throw new Error('Selesaikan atau batalkan transaksi tertunda sebelum memulihkan data.')
      for (const name of BACKUP_TABLES) await this.db.table(name).clear()
      for (const name of BACKUP_TABLES) if (data[name].length) await this.db.table(name).bulkAdd(data[name])
      const restored = await this.readRows()
      if (canonical(restored) !== expectedRestored) throw new Error('Hasil pemulihan tidak cocok. Seluruh pemulihan dibatalkan.')
    })
  }
}
