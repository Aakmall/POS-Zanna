import type { CatalogItem } from '../../types/pos'
import { useDemoStore } from '../../hooks/useDemoStore'
import { canAddToCart, quoteCart, setCartQuantity } from './cartLogic'

export function useCart(products: CatalogItem[]) {
  const { cart, setCart } = useDemoStore()
  const quote = quoteCart(cart, products)
  return {
    cart, quote,
    add: (product: CatalogItem) => setCart((items) => setCartQuantity(items, product, (items.find((line) => line.variantId === product.id)?.quantity ?? 0) + 1, products)),
    change: (product: CatalogItem, quantity: number) => setCart((items) => setCartQuantity(items, product, quantity, products)),
    canAdd: (product: CatalogItem) => canAddToCart(cart, product, products),
    remove: (id: string) => setCart((items) => items.filter((line) => line.variantId !== id)),
    clear: () => setCart([]),
  }
}
