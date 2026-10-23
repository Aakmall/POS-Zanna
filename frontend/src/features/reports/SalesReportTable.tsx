import { Link } from 'react-router'
import type { SalesReport } from '../../domain/reporting'
import { money } from '../../lib/format'
export function SalesReportTable({ report, limit }: { report: SalesReport; limit?: number }) {
  return <section className="panel overflow-hidden"><h2 className="border-b border-line px-5 py-4 text-sm font-semibold">{limit ? 'Transaksi terbaru' : 'Rincian penjualan'}</h2>
    {!report.sales.length ? <p className="p-5 text-sm text-ink-muted">Belum ada transaksi tersimpan pada periode dan metode ini.</p> : <div className="table-scroll" tabIndex={0} role="region" aria-label="Rincian penjualan, geser untuk melihat seluruh kolom"><table className="data-table"><thead><tr><th scope="col">Struk / detail</th><th scope="col">Waktu</th><th scope="col">Metode</th><th scope="col">Pelanggan saat dijual</th><th scope="col">Penjualan</th></tr></thead><tbody>{report.sales.slice(0, limit).map(({ sale }) => <tr key={sale.id}><td><Link className="inline-flex min-h-11 items-center break-all font-semibold text-brand underline" to={`/penjualan/${sale.id}`}>{sale.receiptNumber}</Link></td><td>{new Date(sale.createdAt).toLocaleString('id-ID')}</td><td>{sale.paymentMethod === 'CASH' ? 'Tunai' : 'Bon / Bayar Nanti'}</td><td>{sale.customerSnapshot?.name ?? '—'}</td><td className="font-semibold">{money(sale.total)}</td></tr>)}</tbody></table></div>}
  </section>
}
