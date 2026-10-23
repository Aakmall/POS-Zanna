import type { Customer, CustomerDraft, CustomerRepository } from '../domain/customer'
import { validateCustomerDraft } from '../domain/customerRules'

export class CustomerService {
  private readonly repository: CustomerRepository
  constructor(repository: CustomerRepository) { this.repository = repository }
  list() { return this.repository.list() }
  async save(draft: CustomerDraft) { const copy = { ...draft }; validateCustomerDraft(copy); return this.repository.save(copy) }
  archive(customer: Customer, isActive: boolean) { return this.save({ ...customer, isActive, expectedUpdatedAt: customer.updatedAt }) }
  subscribe(next: (customers: readonly Customer[]) => void, error: (cause: unknown) => void) { return this.repository.subscribe(next, error) }
}
