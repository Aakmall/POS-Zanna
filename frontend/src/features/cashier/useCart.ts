import type { CatalogItem } from '../../types/pos'
import { useDemoStore } from '../../hooks/useDemoStore'
import { quoteCart, setCartQuantity } from './cartLogic'

export function useCart(products: CatalogItem[]) {
  const { cart, setCart } = useDemoStore()
  const quote = quoteCart(cart, products)
  return {
    cart, quote,
    add: (product: CatalogItem) => setCart((items) => setCartQuantity(items, product, (items.find((line) => line.variantId === product.id)?.quantity ?? 0) + 1)),
    change: (product: CatalogItem, quantity: number) => setCart((items) => setCartQuantity(items, product, quantity)),
    remove: (id: string) => setCart((items) => items.filter((line) => line.variantId !== id)),
    clear: () => setCart([]),
  }
}


