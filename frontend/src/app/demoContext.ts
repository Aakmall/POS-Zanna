import { createContext, type Dispatch, type SetStateAction } from 'react'
import type { CartLine, CatalogItem } from '../types/pos'
import type { CatalogSnapshot } from '../domain/product'
import type { ProductRepository } from '../domain/productRepository'

export interface DemoStore {
  products: CatalogItem[]
  snapshot: CatalogSnapshot
  repository: ProductRepository
  cart: CartLine[]
  setCart: Dispatch<SetStateAction<CartLine[]>>
  status: 'loading' | 'ready' | 'error'
  error: string
  reload: () => void
  simulateError: () => void
}
export const DemoContext = createContext<DemoStore | null>(null)
