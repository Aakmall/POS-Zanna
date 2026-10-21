import type { CatalogItem } from '../../types/pos'
import { useDemoStore } from '../../hooks/useDemoStore'
import { canAddToCart, quoteCart, setCartQuantity } from './cartLogic'

export function useCart(products: CatalogItem[]) {
  const { cart, setCart, checkoutController } = useDemoStore()
  const quote = quoteCart(cart, products)
  return {
    cart, quote,
    add: (product: CatalogItem) => { if (!checkoutController.locked) setCart((items) => setCartQuantity(items, product, (items.find((line) => line.variantId === product.id)?.quantity ?? 0) + 1, products)) },
    change: (product: CatalogItem, quantity: number) => { if (!checkoutController.locked) setCart((items) => setCartQuantity(items, product, quantity, products)) },
    canAdd: (product: CatalogItem) => canAddToCart(cart, product, products),
    remove: (id: string) => { if (!checkoutController.locked) setCart((items) => items.filter((line) => line.variantId !== id)) },
    clear: () => { if (!checkoutController.locked) setCart([]) },
    clearOwned: () => setCart((items) => items === cart ? [] : items),
  }
}
