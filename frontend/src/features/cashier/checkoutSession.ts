import type { CheckoutCommand } from '../../domain/checkout'
import { copyCheckoutCommand } from '../../domain/checkoutRequest'
import { assertUuid } from '../../domain/checkoutValidation'

export interface CheckoutSession { active: CheckoutCommand | null; lastId: string | null }
export interface CheckoutSessionStore {
  read(): CheckoutSession
  write(value: CheckoutSession): void
  pending?(): readonly CheckoutCommand[]
  resolve?(operationId: string): void
}
export const CHECKOUT_SESSION_KEY = 'zanna-cell.checkout.v1'
export const CHECKOUT_RECOVERY_PREFIX = 'zanna-cell.checkout.recovery.v1.'
export const LAST_RECEIPT_KEY = 'zanna-cell.checkout.last-receipt.v1'

// Per-tab selection plus one durable key per operation (avoids cross-tab read/modify/write races).
// Write BEFORE prepare/execute; IndexedDB remains the sale authority.
export const browserCheckoutSession: CheckoutSessionStore = {
  read() {
    const raw = window.sessionStorage.getItem(CHECKOUT_SESSION_KEY)
    if (!raw) {
      const lastId = window.localStorage.getItem(LAST_RECEIPT_KEY)
      if (lastId !== null) assertUuid(lastId, 'ID struk terakhir')
      return { active: null, lastId }
    }
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || !('active' in value) || !('lastId' in value)) throw new Error('Penunjuk checkout tidak valid.')
    const lastId = value.lastId
    if (lastId !== null) assertUuid(lastId, 'ID struk terakhir')
    return { active: value.active === null ? null : copyCheckoutCommand(value.active), lastId }
  },
  write(value) {
    if (value.active) window.localStorage.setItem(`${CHECKOUT_RECOVERY_PREFIX}${value.active.checkoutOperationId}`, JSON.stringify(copyCheckoutCommand(value.active)))
    if (value.lastId) { assertUuid(value.lastId, 'ID struk terakhir'); window.localStorage.setItem(LAST_RECEIPT_KEY, value.lastId) }
    window.sessionStorage.setItem(CHECKOUT_SESSION_KEY, JSON.stringify(value))
  },
  pending() {
    const commands: CheckoutCommand[] = []
    for (let index = 0; index < window.localStorage.length; index++) {
      const key = window.localStorage.key(index)
      if (!key?.startsWith(CHECKOUT_RECOVERY_PREFIX)) continue
      const raw = window.localStorage.getItem(key)
      if (raw === null) continue
      const command = copyCheckoutCommand(JSON.parse(raw) as unknown)
      if (key !== `${CHECKOUT_RECOVERY_PREFIX}${command.checkoutOperationId}`) throw new Error('Jurnal operasi tidak sesuai ID.')
      commands.push(command)
    }
    return commands
  },
  resolve(operationId) {
    assertUuid(operationId, 'ID jurnal checkout')
    window.localStorage.removeItem(`${CHECKOUT_RECOVERY_PREFIX}${operationId}`)
  },
}
