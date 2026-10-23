import type { CreditOverview, CreditPaymentCommand, CreditRepository } from '../domain/credit'
import { copyCreditPaymentCommand } from '../domain/creditRules'
import { assertUuid } from '../domain/checkoutValidation'

export class CreditService {
  private readonly repository: CreditRepository
  constructor(repository: CreditRepository) { this.repository = repository }
  async overview() { return this.repository.overview() }
  async detail(id: string) { assertUuid(id, 'ID tagihan'); return this.repository.detail(id) }
  subscribe(next: (overview: CreditOverview) => void, error: (cause: unknown) => void) { return this.repository.subscribe(next, error) }
  async prepare(command: CreditPaymentCommand) { return this.repository.prepare(copyCreditPaymentCommand(command)) }
  async execute(command: CreditPaymentCommand) { return this.repository.execute(copyCreditPaymentCommand(command)) }
  async getPayment(id: string) { assertUuid(id, 'ID operasi pembayaran'); return this.repository.getPayment(id) }
  async listUnresolved() { return this.repository.listUnresolved() }
  async cancel(command: CreditPaymentCommand) { return this.repository.cancel(copyCreditPaymentCommand(command)) }
}
