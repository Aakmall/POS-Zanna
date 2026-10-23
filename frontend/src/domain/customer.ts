import type { Metadata, UUID } from './product'

export interface Customer extends Metadata {
  id: UUID
  name: string
  phone: string
  address: string
  note: string
  isActive: boolean
}
export type CustomerSnapshot = Pick<Customer, 'id' | 'name' | 'phone' | 'address' | 'updatedAt'>
export interface CustomerDraft {
  id?: UUID
  expectedUpdatedAt?: string
  name: string
  phone: string
  address: string
  note: string
  isActive: boolean
}
export interface CustomerRepository {
  list(): Promise<readonly Customer[]>
  save(draft: CustomerDraft): Promise<Customer>
  subscribe(next: (customers: readonly Customer[]) => void, error: (cause: unknown) => void): () => void
}
export function customerSnapshot(customer: Customer): CustomerSnapshot {
  return { id: customer.id, name: customer.name, phone: customer.phone, address: customer.address, updatedAt: customer.updatedAt }
}
