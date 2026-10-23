import type { UUID } from './product'
import type { Sale, SaleItem } from './sale'
import { ValidationError } from './errors'
import type { CustomerSnapshot } from './customer'

export const checkoutErrorCodes = [
  'INVALID_REQUEST', 'CASH_INSUFFICIENT', 'PRODUCT_UNAVAILABLE', 'POLICY_REVIEW_REQUIRED',
  'QUOTE_CHANGED', 'STOCK_NOT_INITIALIZED', 'INSUFFICIENT_STOCK', 'OPERATION_PAYLOAD_MISMATCH',
  'INTENT_REQUIRED', 'INTENT_CANCELLED', 'STORAGE_ERROR', 'INTEGRITY_ERROR',
  'CUSTOMER_INACTIVE', 'CUSTOMER_CHANGED',
] as const
export type CheckoutErrorCode = typeof checkoutErrorCodes[number]
export class CheckoutError extends ValidationError {
  readonly code: CheckoutErrorCode
  constructor(code: CheckoutErrorCode, message: string, options?: ErrorOptions) { super(message, options); this.name = 'CheckoutError'; this.code = code }
}
export interface CheckoutSelection { readonly variantId: UUID; readonly quantity: number }
export interface CheckoutLineRequest extends CheckoutSelection {
  readonly expected: {
    readonly productId: UUID
    readonly baseUnitId: UUID
    readonly sellingUnitId: UUID
    readonly saleMode: 'fixed' | 'variable'
    readonly quantityInBaseUnit: number
    readonly unitPrice: number
    readonly productUpdatedAt: string
    readonly variantUpdatedAt: string
  }
}
interface CheckoutCommandBase {
  readonly checkoutOperationId: UUID
  readonly lines: readonly CheckoutLineRequest[]
  readonly expectedTotal: number
  readonly cashReceived: number
}
export type CheckoutCommand = CheckoutCommandBase & (
  { readonly payloadVersion: 1; readonly paymentMethod: 'CASH' } |
  { readonly payloadVersion: 2; readonly paymentMethod: 'BON'; readonly customer: Readonly<CustomerSnapshot>; readonly dueDate: string | null }
)
export interface CheckoutQuote {
  readonly lines: readonly CheckoutLineRequest[]
  readonly subtotal: number
  readonly total: number
  readonly items: readonly Omit<SaleItem, 'id' | 'saleId'>[]
  readonly stockRequirements: readonly { productId: UUID; quantityBase: number }[]
}
export interface CheckoutResult { readonly sale: Sale; readonly items: readonly SaleItem[]; readonly duplicate: boolean }
interface IntentData {
  readonly checkoutOperationId: UUID
  readonly command: CheckoutCommand
  readonly requestFingerprint: string
  readonly createdAt: string
}
export type CheckoutIntent = IntentData & (
  { readonly status: 'COMMITTED'; readonly saleId: UUID } |
  { readonly status: 'PREPARED' | 'CANCELLED'; readonly saleId?: never }
)
// Read-only part of the persistence contract; the atomic writer extends it separately.
export interface CheckoutReadRepository {
  getResult(checkoutOperationId: UUID): Promise<CheckoutResult | null>
  getIntent(checkoutOperationId: UUID): Promise<CheckoutIntent | null>
}
export type CheckoutCancellation =
  { readonly status: 'CANCELLED'; readonly intent: CheckoutIntent } |
  { readonly status: 'COMMITTED'; readonly result: CheckoutResult }
