import type { UUID } from './product'
import type { ConversionSnapshot, UnitSnapshot } from './inventory'
import type { CustomerSnapshot } from './customer'

export const PRICING_POLICY = 'HALF_UP_LINE_V1' as const
export interface Sale {
  id: UUID
  receiptNumber: string
  checkoutOperationId: UUID
  requestFingerprint: string
  createdAt: string
  status: 'COMPLETED'
  paymentMethod: 'CASH' | 'BON'
  customerSnapshot?: CustomerSnapshot // Required for BON; absent on historical CASH records.
  dueDate?: string | null
  subtotal: number
  total: number
  cashReceived: number
  changeAmount: number
  operatorId: UUID | null
  pricingPolicy: typeof PRICING_POLICY
}
export interface SaleItem {
  id: UUID
  saleId: UUID
  position: number
  productId: UUID
  variantId: UUID
  productNameSnapshot: string
  variantNameSnapshot: string
  saleModeSnapshot: 'fixed' | 'variable'
  unitSnapshot: UnitSnapshot
  conversionSnapshot: ConversionSnapshot
  quantity: number // Scaled 1000 in SELLING unit, unlike the existing UI CartLine.
  quantityBase: number // Scaled 1000 in BASE unit.
  unitPriceSnapshot: number
  lineTotal: number
}
