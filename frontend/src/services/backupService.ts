import { localDatabase } from '../data/localDatabase'
import { DexieBackupRepository } from '../data/dexieBackupRepository'
import { BackupService } from './backupOperations'
import { appSafety } from './appSafety'
import { checkBrowserRecovery, clearBrowserRecovery } from './recoverySafety'

export const backupService = new BackupService(new DexieBackupRepository(localDatabase), {
  exclusive: (operation) => appSafety.exclusive(operation),
  checkRecovery: checkBrowserRecovery,
  restored() {
    appSafety.restored()
    // A shortcut cleanup failure must never report a committed restore as failed.
    try { clearBrowserRecovery() } catch { /* Reload remains required; no automatic replay. */ }
  },
})
