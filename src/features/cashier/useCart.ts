import type { Product } from '../../types/pos'
import { useDemoStore } from '../../hooks/useDemoStore'
import { quoteCart, setCartQuantity } from './cartLogic'

export function useCart(products: Product[]) {
  const { cart, setCart } = useDemoStore()
  const quote = quoteCart(cart, products)
  return {
    cart, quote,
    add: (product: Product) => setCart((items) => setCartQuantity(items, product, (items.find((line) => line.productId === product.id)?.quantity ?? 0) + 1)),
    change: (product: Product, quantity: number) => setCart((items) => setCartQuantity(items, product, quantity)),
    remove: (id: string) => setCart((items) => items.filter((line) => line.productId !== id)),
    clear: () => setCart([]),
  }
}
