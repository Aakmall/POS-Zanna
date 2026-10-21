import type { CheckoutResult } from '../../domain/checkout'
import { quantityText } from '../../domain/quantity'
import { money } from '../../lib/format'

export function SaleReceipt({ result }: { result: CheckoutResult }) {
  const { sale, items } = result
  return <section aria-label="Struk penjualan tersimpan" className="space-y-4 text-sm">
    <div className="text-center"><h3 className="text-xl font-bold">Zanna-Cell</h3><p className="mt-1 text-xs text-success" role="status">Pembayaran tunai tersimpan</p></div>
    <dl className="space-y-2 text-xs"><div><dt className="text-ink-muted">Nomor struk</dt><dd className="break-all font-medium">{sale.receiptNumber}</dd></div><div><dt className="text-ink-muted">Tanggal dan waktu</dt><dd>{new Date(sale.createdAt).toLocaleString('id-ID')}</dd></div><div><dt className="text-ink-muted">Metode</dt><dd>Tunai</dd></div></dl>
    <ul className="divide-y divide-line border-y border-line">{items.map((item) => <li key={item.id} className="py-3"><p className="font-semibold">{item.productNameSnapshot}</p><p className="text-xs text-ink-muted">{item.variantNameSnapshot}</p><div className="mt-2 flex justify-between gap-3 text-xs"><span>{quantityText(item.quantity)} {item.unitSnapshot.name} × {money(item.unitPriceSnapshot)}</span><strong>{money(item.lineTotal)}</strong></div></li>)}</ul>
    <dl className="space-y-2"><div className="flex justify-between"><dt>Subtotal</dt><dd>{money(sale.subtotal)}</dd></div><div className="flex justify-between text-lg font-bold"><dt>Total pembayaran</dt><dd>{money(sale.total)}</dd></div><div className="flex justify-between"><dt>Uang diterima</dt><dd>{money(sale.cashReceived)}</dd></div><div className="flex justify-between font-semibold text-brand"><dt>Kembalian</dt><dd>{money(sale.changeAmount)}</dd></div></dl>
    <p className="text-xs text-ink-muted">Struk digital dari transaksi tersimpan di perangkat ini.</p>
  </section>
}
