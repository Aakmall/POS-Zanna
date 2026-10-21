import type { CheckoutCommand, CheckoutSelection } from '../domain/checkout'
import type { CheckoutRepository } from '../domain/checkoutRepository'
import { copyCheckoutCommand } from '../domain/checkoutRequest'
import { copyCheckoutSelections } from '../domain/checkoutRules'
import { assertUuid } from '../domain/checkoutValidation'

export class CheckoutService {
  private readonly repository: CheckoutRepository
  constructor(repository: CheckoutRepository) { this.repository = repository }
  async preview(selections: readonly CheckoutSelection[]) { return this.repository.preview(copyCheckoutSelections(selections)) }
  async prepare(command: CheckoutCommand) { return this.repository.prepare(copyCheckoutCommand(command)) }
  async execute(command: CheckoutCommand) { return this.repository.commit(copyCheckoutCommand(command)) }
  async getResult(checkoutOperationId: string) { assertUuid(checkoutOperationId, 'ID operasi checkout'); return this.repository.getResult(checkoutOperationId) }
  async listUnresolved() { return this.repository.listUnresolved() }
  async cancel(checkoutOperationId: string) { assertUuid(checkoutOperationId, 'ID operasi checkout'); return this.repository.cancel(checkoutOperationId) }
}
