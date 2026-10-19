import type { CartLine, Product } from '../../types/pos'

export function setCartQuantity(cart: CartLine[], product: Product, quantity: number): CartLine[] {
  if (!Number.isSafeInteger(quantity) || quantity < 0) return cart
  if (quantity === 0) return cart.filter((line) => line.productId !== product.id)
  const previous = cart.find((line) => line.productId === product.id)
  // Tetap izinkan pengurangan ketika stok/harga diubah pada halaman lain.
  if (previous && quantity < previous.quantity) {
    return cart.map((line) => line.productId === product.id ? { ...line, quantity } : line)
  }
  if (quantity > product.stock || product.price === null) return cart
  return cart.some((line) => line.productId === product.id)
    ? cart.map((line) => line.productId === product.id ? { ...line, quantity } : line)
    : [...cart, { productId: product.id, quantity }]
}

export function quoteCart(cart: CartLine[], products: Product[]) {
  const lines = cart.flatMap((line) => {
    const product = products.find((item) => item.id === line.productId)
    return product ? [{ ...line, product, amount: (product.price ?? 0) * line.quantity }] : []
  })
  const total = lines.reduce((sum, line) => sum + line.amount, 0)
  const invalid = lines.length !== cart.length || lines.some(({ product, quantity, amount }) =>
    product.price === null || product.price < 0 || !Number.isSafeInteger(product.price) ||
    quantity < 1 || !Number.isSafeInteger(quantity) || quantity > product.stock || !Number.isSafeInteger(amount)) || !Number.isSafeInteger(total)
  return { lines, total, itemCount: cart.reduce((sum, line) => sum + line.quantity, 0), valid: cart.length > 0 && !invalid }
}
export type CartQuote = ReturnType<typeof quoteCart>
