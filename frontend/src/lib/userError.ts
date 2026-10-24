import { ValidationError } from '../domain/errors'
import { SalesHistoryError } from '../domain/salesHistory'

// Native IndexedDB errors and unexpected exceptions can contain technical details.
export function userError(cause: unknown, fallback: string): string {
  return cause instanceof ValidationError || cause instanceof SalesHistoryError ? cause.message : fallback
}
