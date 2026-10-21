import type { CheckoutCancellation, CheckoutCommand, CheckoutIntent, CheckoutQuote, CheckoutReadRepository, CheckoutResult, CheckoutSelection } from './checkout'
import type { UUID } from './product'

export interface CheckoutRepository extends CheckoutReadRepository {
  preview(selections: readonly CheckoutSelection[]): Promise<CheckoutQuote>
  prepare(command: CheckoutCommand): Promise<CheckoutIntent>
  commit(command: CheckoutCommand): Promise<CheckoutResult>
  listUnresolved(): Promise<readonly CheckoutIntent[]>
  cancel(checkoutOperationId: UUID): Promise<CheckoutCancellation>
}
