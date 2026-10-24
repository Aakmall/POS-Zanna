import { guardedWrite } from './guardedWrite'
import { liveQuery } from 'dexie'
import type { Customer, CustomerDraft, CustomerRepository } from '../domain/customer'
import { validateCustomer, validateCustomerDraft } from '../domain/customerRules'
import { CreditError } from '../domain/credit'
import { createUuid } from '../domain/id'
import type { ZannaDatabase } from './database'

export class DexieCustomerRepository implements CustomerRepository {
  private readonly db: ZannaDatabase
  constructor(db: ZannaDatabase) { this.db = db }
  async list(): Promise<readonly Customer[]> {
    const customers = await this.db.customers.orderBy('name').toArray()
    for (const customer of customers) validateCustomer(customer)
    return customers
  }
  async save(incoming: CustomerDraft): Promise<Customer> {
    const draft = { ...incoming }; validateCustomerDraft(draft)
    return guardedWrite(this.db, () => this.db.transaction('rw', this.db.customers, async () => {
      const old = draft.id ? await this.db.customers.get(draft.id) : undefined
      if (draft.id && !old) throw new CreditError('NOT_FOUND', 'Pelanggan tidak ditemukan. Muat ulang daftar.')
      if (old) { validateCustomer(old); if (old.updatedAt !== draft.expectedUpdatedAt) throw new CreditError('CUSTOMER_CHANGED', 'Pelanggan sudah diubah. Tutup form dan buka kembali sebelum menyimpan.') }
      const stamp = new Date(Math.max(Date.now(), old ? Date.parse(old.updatedAt) + 1 : 0)).toISOString()
      const customer: Customer = { id: old?.id ?? createUuid(), name: draft.name.trim(), phone: draft.phone.trim(), address: draft.address.trim(), note: draft.note.trim(), isActive: draft.isActive, createdAt: old?.createdAt ?? stamp, updatedAt: stamp }
      await this.db.customers.put(customer)
      return customer
    }))
  }
  subscribe(next: (customers: readonly Customer[]) => void, error: (cause: unknown) => void) {
    const subscription = liveQuery(() => this.list()).subscribe({ next, error })
    return () => subscription.unsubscribe()
  }
}
