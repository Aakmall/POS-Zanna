import type { CartLine, CatalogItem } from '../../types/pos'

import { calculateLineTotal, sumLineTotals } from '../../domain/checkoutMath'
import { convertInventoryQuantity } from '../../domain/inventoryRules'
import { scaledCartQuantity } from './checkoutCart'

function sharedStockIssue(cart: CartLine[], products: CatalogItem[]) {
  const demand = new Map<string, bigint>()
  for (const line of cart) {
    const item = products.find((product) => product.id === line.variantId)
    if (!item?.productId || item.stockBase === undefined) continue
    if (item.stockBase === null) return 'Stok awal belum diatur.'
    const scaled = scaledCartQuantity(line.quantity, item.saleMode)
    const amount = item.conversion ? convertInventoryQuantity(scaled, item.conversion)
      : line.quantity * (item.quantityInBaseUnit ?? 1000) // Legacy DEMO fixtures only.
    if (!Number.isSafeInteger(amount)) return 'Konversi jumlah tidak dapat disimpan tepat.'
    const total = (demand.get(item.productId) ?? 0n) + BigInt(amount)
    if (total > BigInt(item.stockBase)) return 'Gabungan varian melebihi stok bersama produk. Kurangi jumlah.'
    demand.set(item.productId, total)
  }
  return ''
}

export function setCartQuantity(cart: CartLine[], product: CatalogItem, quantity: number, products: CatalogItem[] = [product]): CartLine[] {
  if (quantity === 0) return cart.filter((line) => line.variantId !== product.id)
  try { scaledCartQuantity(quantity, product.saleMode) } catch { return cart }
  const previous = cart.find((line) => line.variantId === product.id)
  // Tetap izinkan pengurangan ketika stok/harga diubah pada halaman lain.
  if (previous && quantity < previous.quantity) {
    return cart.map((line) => line.variantId === product.id ? { ...line, quantity } : line)
  }
  if (product.stockStatus === 'NOT_INITIALIZED' || (product.stock !== null && quantity > product.stock) || product.price === null || product.isActive === false) return cart
  const candidate = cart.some((line) => line.variantId === product.id)
    ? cart.map((line) => line.variantId === product.id ? { ...line, quantity } : line)
    : [...cart, { variantId: product.id, quantity }]
  try { return sharedStockIssue(candidate, products) ? cart : candidate } catch { return cart }
}

export function canAddToCart(cart: CartLine[], product: CatalogItem, products: CatalogItem[]) {
  const before = cart.find((line) => line.variantId === product.id)?.quantity ?? 0
  return (setCartQuantity(cart, product, before + 1, products).find((line) => line.variantId === product.id)?.quantity ?? 0) > before
}

export function quoteCart(cart: CartLine[], products: CatalogItem[]) {
  const lines = cart.map((line) => {
    const product: CatalogItem = products.find((item) => item.id === line.variantId) ?? {
      id: line.variantId, name: `Varian tidak tersedia (${line.variantId})`, sku: '', category: '', unit: '', price: null, cost: null, stock: null, minimumStock: null, symbol: '?', isActive: false,
    }
    const issues: string[] = []
    let amount = 0
    if (product.isActive === false) issues.push('Produk/varian tidak tersedia atau nonaktif. Periksa master atau hapus baris ini.')
    if (product.price === null) issues.push('Harga belum diatur.')
    if (product.stockStatus === 'NOT_INITIALIZED') issues.push('Stok awal belum diatur.')
    if (product.stock !== null && line.quantity > product.stock) issues.push('Jumlah melebihi stok tersedia.')
    try { const scaled = scaledCartQuantity(line.quantity, product.saleMode); if (product.price !== null) amount = calculateLineTotal(product.price, scaled) }
    catch { issues.push('Harga atau jumlah tidak valid. Fixed harus bulat; volume/berat maksimal tiga desimal.') }
    return { ...line, product, amount, issues }
  })
  let total = 0
  let sharedIssue: string
  try { total = sumLineTotals(lines.map((line) => line.amount)); sharedIssue = sharedStockIssue(cart, products) }
  catch { sharedIssue = 'Total atau konversi jumlah tidak valid. Periksa jumlah dan satuan.' }
  return { lines, total, sharedIssue, itemCount: cart.reduce((sum, line) => sum + line.quantity, 0), valid: cart.length > 0 && !sharedIssue && lines.every((line) => !line.issues.length) }
}
export type CartQuote = ReturnType<typeof quoteCart>
