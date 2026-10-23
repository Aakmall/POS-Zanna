import { ValidationError } from './errors'
import type { Customer, CustomerSnapshot } from './customer'
import type { CheckoutResult } from './checkout'

export class CreditError extends ValidationError {
  readonly code: 'INVALID_REQUEST' | 'NOT_FOUND' | 'BALANCE_CHANGED' | 'PAYMENT_TOO_LARGE' | 'OPERATION_PAYLOAD_MISMATCH' | 'INTENT_REQUIRED' | 'INTENT_CANCELLED' | 'STORAGE_ERROR' | 'INTEGRITY_ERROR' | 'CUSTOMER_CHANGED'
  constructor(code: CreditError['code'], message: string, options?: ErrorOptions) { super(message, options); this.name = 'CreditError'; this.code = code }
}
export type ReceivableStatus = 'UNPAID' | 'PARTIAL' | 'PAID'
export interface Receivable {
  id: string
  saleId: string
  checkoutOperationId: string
  customerId: string
  customerSnapshot: CustomerSnapshot
  receiptNumber: string
  createdAt: string
  updatedAt: string
  dueDate: string | null // Local calendar date, not a UTC instant.
  originalAmount: number
  totalPaid: number
  balance: number
  status: ReceivableStatus
}
export interface CreditPaymentCommand {
  readonly payloadVersion: 1
  readonly operationId: string
  readonly receivableId: string
  readonly amount: number
  readonly expectedBalance: number
}
export interface CreditPayment {
  id: string
  operationId: string
  receivableId: string
  saleId: string
  customerId: string
  customerSnapshot: CustomerSnapshot
  saleReceiptNumber: string
  receiptNumber: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  paymentMethod: 'CASH'
  createdAt: string
  requestFingerprint: string
}
interface PaymentIntentData { operationId: string; receivableId: string; command: CreditPaymentCommand; requestFingerprint: string; createdAt: string }
export type CreditPaymentIntent = PaymentIntentData & (
  { status: 'PREPARED' | 'CANCELLED'; paymentId?: never } | { status: 'COMMITTED'; paymentId: string }
)
export interface CreditPaymentResult { payment: CreditPayment; duplicate: boolean }
export interface CreditOverview {
  customers: readonly Customer[]
  receivables: readonly Receivable[]
  totalOutstanding: number
}
export interface ReceivableDetail { receivable: Receivable; payments: readonly CreditPayment[]; sale: CheckoutResult }
export interface CreditRepository {
  overview(): Promise<CreditOverview>
  detail(receivableId: string): Promise<ReceivableDetail>
  subscribe(next: (overview: CreditOverview) => void, error: (cause: unknown) => void): () => void
  prepare(command: CreditPaymentCommand): Promise<CreditPaymentIntent>
  execute(command: CreditPaymentCommand): Promise<CreditPaymentResult>
  getPayment(operationId: string): Promise<CreditPaymentResult | null>
  listUnresolved(): Promise<readonly CreditPaymentIntent[]>
  cancel(command: CreditPaymentCommand): Promise<CreditPaymentResult | null>
}
