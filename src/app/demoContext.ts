import { createContext, type Dispatch, type SetStateAction } from 'react'
import type { CartLine, Product } from '../types/pos'

export interface DemoStore {
  products: Product[]
  cart: CartLine[]
  setCart: Dispatch<SetStateAction<CartLine[]>>
  status: 'loading' | 'ready' | 'error'
  reload: () => void
  simulateError: () => void
  saveProduct: (product: Product) => void
  adjustStock: (id: string, stock: number) => void
}
export const DemoContext = createContext<DemoStore | null>(null)
