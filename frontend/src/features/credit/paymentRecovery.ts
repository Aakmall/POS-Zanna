import type { CreditPaymentCommand } from '../../domain/credit'
import { copyCreditPaymentCommand } from '../../domain/creditRules'
import { assertUuid } from '../../domain/checkoutValidation'

export interface PaymentRecoveryStore { pending(): readonly CreditPaymentCommand[]; save(command: CreditPaymentCommand): void; resolve(operationId: string): void }
export const PAYMENT_RECOVERY_PREFIX = 'zanna-cell.credit-payment.v1.'
export const browserPaymentRecovery: PaymentRecoveryStore = {
  pending() {
    const commands: CreditPaymentCommand[] = []
    for (let index = 0; index < window.localStorage.length; index++) {
      const key = window.localStorage.key(index)
      if (!key?.startsWith(PAYMENT_RECOVERY_PREFIX)) continue
      const raw = window.localStorage.getItem(key)
      if (raw === null) continue
      const command = copyCreditPaymentCommand(JSON.parse(raw) as unknown)
      if (key !== `${PAYMENT_RECOVERY_PREFIX}${command.operationId}`) throw new Error('Jurnal pembayaran tidak sesuai ID.')
      commands.push(command)
    }
    return commands
  },
  save(command) { window.localStorage.setItem(`${PAYMENT_RECOVERY_PREFIX}${command.operationId}`, JSON.stringify(copyCreditPaymentCommand(command))) },
  resolve(id) { assertUuid(id, 'ID pembayaran'); window.localStorage.removeItem(`${PAYMENT_RECOVERY_PREFIX}${id}`) },
}
