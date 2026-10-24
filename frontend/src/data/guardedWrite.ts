import { Dexie } from 'dexie'
import { appSafety } from '../services/appSafety'

export function guardedWrite<T>(db: Dexie, operation: () => Promise<T>): Promise<T> {
  // Nested repository calls must stay inside the existing Dexie transaction;
  // awaiting a new browser lock there could close the IndexedDB transaction.
  if (Dexie.currentTransaction?.db === db || db.name !== 'zanna-cell-db') return operation()
  return appSafety.write(operation)
}
