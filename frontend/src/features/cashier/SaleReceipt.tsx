import type { CheckoutResult } from '../../domain/checkout'
import { quantityText } from '../../domain/quantity'
import { money } from '../../lib/format'

export function SaleReceipt({ result }: { result: CheckoutResult }) {
  const { sale, items } = result
  return <section aria-label="Struk penjualan tersimpan" className="space-y-4 text-sm">
    <div className="text-center"><h3 className="text-xl font-bold">Zanna-Cell</h3><p className="mt-1 text-xs text-success" role="status">{sale.paymentMethod === 'BON' ? 'Penjualan Bon tersimpan · Bayar Nanti' : 'Pembayaran tunai tersimpan'}</p></div>
    <dl className="space-y-2 text-xs"><div><dt className="text-ink-muted">Nomor struk</dt><dd className="break-all font-medium">{sale.receiptNumber}</dd></div><div><dt className="text-ink-muted">Tanggal dan waktu</dt><dd>{new Date(sale.createdAt).toLocaleString('id-ID')}</dd></div><div><dt className="text-ink-muted">Metode</dt><dd>{sale.paymentMethod === 'BON' ? 'Bon / Bayar Nanti' : 'Tunai'}</dd></div>{sale.paymentMethod === 'BON' && <><div><dt className="text-ink-muted">Pelanggan saat transaksi</dt><dd>{sale.customerSnapshot?.name}{sale.customerSnapshot?.phone && ` · ${sale.customerSnapshot.phone}`}</dd></div>{sale.customerSnapshot?.address && <div><dt className="text-ink-muted">Alamat saat transaksi</dt><dd>{sale.customerSnapshot.address}</dd></div>}<div><dt className="text-ink-muted">Jatuh tempo</dt><dd>{sale.dueDate ?? 'Tidak ditentukan'}</dd></div></>}</dl>
    <ul className="divide-y divide-line border-y border-line">{items.map((item) => <li key={item.id} className="py-3"><p className="font-semibold">{item.productNameSnapshot}</p><p className="text-xs text-ink-muted">{item.variantNameSnapshot}</p><div className="mt-2 flex justify-between gap-3 text-xs"><span>{quantityText(item.quantity)} {item.unitSnapshot.name} × {money(item.unitPriceSnapshot)}</span><strong>{money(item.lineTotal)}</strong></div></li>)}</ul>
    <dl className="space-y-2"><div className="flex justify-between"><dt>Subtotal</dt><dd>{money(sale.subtotal)}</dd></div><div className="flex justify-between text-lg font-bold"><dt>{sale.paymentMethod === 'BON' ? 'Total Utang saat pembelian' : 'Total pembayaran'}</dt><dd>{money(sale.total)}</dd></div>{sale.paymentMethod === 'CASH' && <><div className="flex justify-between"><dt>Uang diterima</dt><dd>{money(sale.cashReceived)}</dd></div><div className="flex justify-between font-semibold text-brand"><dt>Kembalian</dt><dd>{money(sale.changeAmount)}</dd></div></>}</dl>
    {sale.paymentMethod === 'BON' && <p className="rounded-lg bg-warning-soft p-3 text-xs leading-5 text-warning">Tidak ada uang diterima saat checkout Bon. Nilai di atas adalah utang awal, bukan sisa terkini. Lihat Pelanggan &amp; Bon untuk cicilan dan Sisa Utang.</p>}
    <p className="text-xs text-ink-muted">Struk digital dari transaksi tersimpan di perangkat ini.</p>
  </section>
}
