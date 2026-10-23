import { ZannaDatabase } from '../src/data/database'
import { DexieCustomerRepository } from '../src/data/dexieCustomerRepository'
import { DexieCheckoutRepository } from '../src/data/dexieCheckoutRepository'
import { DexieInventoryRepository } from '../src/data/dexieInventoryRepository'
import { CustomerService } from '../src/services/customerOperations'
import { CheckoutService } from '../src/services/checkoutOperations'
import { InventoryService } from '../src/services/inventoryOperations'
import { customerSnapshot } from '../src/domain/customer'
import { copyCheckoutCommand } from '../src/domain/checkoutRequest'
import type { CheckoutSelection } from '../src/domain/checkout'
import { checkoutFixture } from './checkout-fixtures'

export async function creditFixture(source = checkoutFixture()) {
  const db = new ZannaDatabase(`phase5-fixture-${crypto.randomUUID()}`)
  await db.transaction('rw', [db.products, db.categories, db.units, db.variants], async () => {
    await db.products.bulkAdd(source.catalog.products); await db.categories.bulkAdd(source.catalog.categories)
    await db.units.bulkAdd(source.catalog.units); await db.variants.bulkAdd(source.catalog.variants)
  })
  const customers = new CustomerService(new DexieCustomerRepository(db))
  const customer = await customers.save({ name: 'Bu Sari', phone: '081234', address: 'Jalan Mawar', note: '', isActive: true })
  const checkout = new CheckoutService(new DexieCheckoutRepository(db)), inventory = new InventoryService(new DexieInventoryRepository(db))
  for (const product of source.catalog.products) await inventory.execute({ operationId: crypto.randomUUID(), productId: product.id,
    inputUnitId: product.baseUnitId, inputQuantity: source.balances.find((balance) => balance.productId === product.id)!.quantityBase, movementType: 'OPENING_BALANCE', reason: 'Stok awal tes' })
  return { ...source, db, customers, customer, checkout, inventory }
}
export async function bonCommand(f: Awaited<ReturnType<typeof creditFixture>>, selections: readonly CheckoutSelection[] = [{ variantId: f.variant.id, quantity: 1500 }]) {
  const quote = await f.checkout.preview(selections)
  return copyCheckoutCommand({ payloadVersion: 2, paymentMethod: 'BON', checkoutOperationId: crypto.randomUUID(), lines: quote.lines,
    expectedTotal: quote.total, cashReceived: 0, customer: customerSnapshot(f.customer), dueDate: '2026-11-01' })
}
export async function businessSnapshot(db: ZannaDatabase) {
  return Object.fromEntries(await Promise.all(db.tables.map(async (table) => [table.name, await table.toArray()])))
}
