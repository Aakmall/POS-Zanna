import type { CartLine, CatalogItem } from '../../types/pos'

function exceedsSharedStock(cart: CartLine[], products: CatalogItem[]) {
  const demand = new Map<string, bigint>()
  for (const line of cart) {
    const item = products.find((product) => product.id === line.variantId)
    if (!item?.productId || item.stockBase === undefined) continue
    if (item.stockBase === null || !Number.isSafeInteger(item.quantityInBaseUnit) || (item.quantityInBaseUnit ?? 0) <= 0) return true
    const total = (demand.get(item.productId) ?? 0n) + BigInt(line.quantity) * BigInt(item.quantityInBaseUnit!)
    if (total > BigInt(item.stockBase)) return true
    demand.set(item.productId, total)
  }
  return false
}

export function setCartQuantity(cart: CartLine[], product: CatalogItem, quantity: number, products: CatalogItem[] = [product]): CartLine[] {
  if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 1_000_000) return cart
  if (quantity === 0) return cart.filter((line) => line.variantId !== product.id)
  const previous = cart.find((line) => line.variantId === product.id)
  // Tetap izinkan pengurangan ketika stok/harga diubah pada halaman lain.
  if (previous && quantity < previous.quantity) {
    return cart.map((line) => line.variantId === product.id ? { ...line, quantity } : line)
  }
  if (product.stockStatus === 'NOT_INITIALIZED' || (product.stock !== null && quantity > product.stock) || product.price === null || product.isActive === false || product.saleMode === 'variable') return cart
  const candidate = cart.some((line) => line.variantId === product.id)
    ? cart.map((line) => line.variantId === product.id ? { ...line, quantity } : line)
    : [...cart, { variantId: product.id, quantity }]
  return exceedsSharedStock(candidate, products) ? cart : candidate
}

export function canAddToCart(cart: CartLine[], product: CatalogItem, products: CatalogItem[]) {
  const before = cart.find((line) => line.variantId === product.id)?.quantity ?? 0
  return (setCartQuantity(cart, product, before + 1, products).find((line) => line.variantId === product.id)?.quantity ?? 0) > before
}

export function quoteCart(cart: CartLine[], products: CatalogItem[]) {
  const lines = cart.flatMap((line) => {
    const product = products.find((item) => item.id === line.variantId)
    return product ? [{ ...line, product, amount: (product.price ?? 0) * line.quantity }] : []
  })
  const total = lines.reduce((sum, line) => sum + line.amount, 0)
  const invalid = lines.length !== cart.length || lines.some(({ product, quantity, amount }) =>
    product.price === null || product.price < 0 || !Number.isSafeInteger(product.price) ||
    product.stockStatus === 'NOT_INITIALIZED' || product.isActive === false || product.saleMode === 'variable' || quantity < 1 || quantity > 1_000_000 || !Number.isSafeInteger(quantity) || (product.stock !== null && quantity > product.stock) || !Number.isSafeInteger(amount)) || !Number.isSafeInteger(total) || (cart.every((line) => Number.isSafeInteger(line.quantity) && line.quantity >= 0) && exceedsSharedStock(cart, products))
  return { lines, total, itemCount: cart.reduce((sum, line) => sum + line.quantity, 0), valid: cart.length > 0 && !invalid }
}
export type CartQuote = ReturnType<typeof quoteCart>
