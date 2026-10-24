import type { BackupFile, BackupRepository, MaintenanceGate, RestorePreview } from '../domain/backup'
import { backupCounts, canonical, makeBackup, parseBackup, pendingOperations } from '../domain/backupFormat'

export class BackupService {
  private readonly repository: BackupRepository
  private readonly gate: MaintenanceGate
  private readonly plans = new WeakMap<RestorePreview, { file: BackupFile; current: string }>()
  private lastBackup = ''
  constructor(repository: BackupRepository, gate: MaintenanceGate) { this.repository = repository; this.gate = gate }
  // Future authorization: backups.export / backups.restore, not implemented in Phase 7.
  async create(): Promise<{ file: BackupFile; text: string; name: string }> {
    const file = await makeBackup(await this.repository.read()), text = canonical(file)
    await parseBackup(text) // Validate the exact downloadable file, not just an in-memory draft.
    this.lastBackup = canonical(file.data)
    return { file, text, name: `POS-Zanna-cadangan-${file.createdAt.replaceAll(':', '-').replaceAll('.', '-')}.json` }
  }
  async inspect(text: string): Promise<RestorePreview> {
    const file = await parseBackup(text), current = await this.repository.read()
    const preview = { id: file.id, createdAt: file.createdAt, counts: backupCounts(file.data), currentCounts: backupCounts(current), pendingOperations: pendingOperations(file.data) }
    this.plans.set(preview, { file: structuredClone(file), current: canonical(current) })
    return preview
  }
  async restore(preview: RestorePreview, confirmation: string): Promise<void> {
    const plan = this.plans.get(preview)
    if (!plan || confirmation !== 'PULIHKAN DATA') throw new Error('Periksa cadangan dan ketik PULIHKAN DATA untuk menyetujui penggantian seluruh data.')
    if (plan.current !== this.lastBackup) throw new Error('Buat dan simpan cadangan data sekarang terlebih dahulu, lalu periksa ulang file pemulihan.')
    this.plans.delete(preview) // A plan can only be submitted once, even during a double click.
    await this.gate.exclusive(async () => {
      this.gate.checkRecovery()
      await this.repository.replace(plan.file.data, plan.current)
      this.gate.restored()
    })
  }
  async assertIdle(): Promise<void> {
    this.gate.checkRecovery()
    if (pendingOperations(await this.repository.read())) throw new Error('Selesaikan atau batalkan transaksi/pembayaran tertunda sebelum melanjutkan.')
  }
}
