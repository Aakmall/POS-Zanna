import type { CheckoutResult } from '../../domain/checkout'
import { SaleReceipt } from '../cashier/SaleReceipt'

export function SaleDetails({ result }: { result: CheckoutResult }) {
  return <article className="panel mx-auto max-w-2xl p-5 sm:p-7" aria-label="Detail penjualan tersimpan">
    <p className="mb-5 border-b border-line pb-4 text-xs text-ink-muted">Status transaksi: <span className="pill ml-2 bg-success-soft text-success">{result.sale.status}</span></p>
    <SaleReceipt result={result} />
  </article>
}
