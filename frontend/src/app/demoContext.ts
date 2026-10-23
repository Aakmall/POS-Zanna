import { createContext, type Dispatch, type SetStateAction } from 'react'
import type { CartLine, CatalogItem } from '../types/pos'
import type { CatalogSnapshot } from '../domain/product'
import type { ProductRepository } from '../domain/productRepository'
import type { InventoryBalance } from '../domain/inventory'
import type { InventoryService } from '../services/inventoryOperations'
import type { CheckoutController } from '../features/cashier/checkoutController'
import type { CustomerService } from '../services/customerOperations'

export interface DemoStore {
  products: CatalogItem[]
  snapshot: CatalogSnapshot
  repository: ProductRepository
  inventoryBalances: InventoryBalance[]
  inventoryService: InventoryService
  cart: CartLine[]
  setCart: Dispatch<SetStateAction<CartLine[]>>
  checkoutController: CheckoutController
  customerService: CustomerService
  status: 'loading' | 'ready' | 'error'
  error: string
  reload: () => void
  simulateError: () => void
}
export const DemoContext = createContext<DemoStore | null>(null)
