import type { CartLine, CatalogItem } from '../../types/pos'

export function setCartQuantity(cart: CartLine[], product: CatalogItem, quantity: number): CartLine[] {
  if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 1_000_000) return cart
  if (quantity === 0) return cart.filter((line) => line.variantId !== product.id)
  const previous = cart.find((line) => line.variantId === product.id)
  // Tetap izinkan pengurangan ketika stok/harga diubah pada halaman lain.
  if (previous && quantity < previous.quantity) {
    return cart.map((line) => line.variantId === product.id ? { ...line, quantity } : line)
  }
  if ((product.stock !== null && quantity > product.stock) || product.price === null || product.isActive === false || product.saleMode === 'variable') return cart
  return cart.some((line) => line.variantId === product.id)
    ? cart.map((line) => line.variantId === product.id ? { ...line, quantity } : line)
    : [...cart, { variantId: product.id, quantity }]
}

export function quoteCart(cart: CartLine[], products: CatalogItem[]) {
  const lines = cart.flatMap((line) => {
    const product = products.find((item) => item.id === line.variantId)
    return product ? [{ ...line, product, amount: (product.price ?? 0) * line.quantity }] : []
  })
  const total = lines.reduce((sum, line) => sum + line.amount, 0)
  const invalid = lines.length !== cart.length || lines.some(({ product, quantity, amount }) =>
    product.price === null || product.price < 0 || !Number.isSafeInteger(product.price) ||
    product.isActive === false || product.saleMode === 'variable' || quantity < 1 || quantity > 1_000_000 || !Number.isSafeInteger(quantity) || (product.stock !== null && quantity > product.stock) || !Number.isSafeInteger(amount)) || !Number.isSafeInteger(total)
  return { lines, total, itemCount: cart.reduce((sum, line) => sum + line.quantity, 0), valid: cart.length > 0 && !invalid }
}
export type CartQuote = ReturnType<typeof quoteCart>


