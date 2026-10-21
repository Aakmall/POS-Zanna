import { CheckoutError, type CheckoutSelection } from '../../domain/checkout'
import { assertCheckoutQuantity, scaleFixedQuantity } from '../../domain/checkoutMath'
import { parseQuantity } from '../../domain/quantity'
import type { CartLine, CatalogItem } from '../../types/pos'

export function scaledCartQuantity(quantity: number, mode: 'fixed' | 'variable' = 'fixed') {
  const scaled = mode === 'fixed' ? scaleFixedQuantity(quantity) : parseQuantity(String(quantity))
  assertCheckoutQuantity(scaled, mode)
  return scaled
}
export function cartSelections(cart: readonly CartLine[], products: readonly CatalogItem[]): readonly CheckoutSelection[] {
  return cart.map((line) => {
    const product = products.find((item) => item.id === line.variantId)
    if (!product) throw new CheckoutError('PRODUCT_UNAVAILABLE', `Varian ${line.variantId} tidak tersedia. Hapus baris ini atau periksa master produk.`)
    return { variantId: line.variantId, quantity: scaledCartQuantity(line.quantity, product.saleMode) }
  })
}
