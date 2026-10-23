import { Link, useSearchParams } from 'react-router'
import { ReceiptText } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { money } from '../../lib/format'
import type { SalesHistoryFilters as Filters, SalesHistoryReader } from '../../domain/salesHistory'
import { salesHistoryService } from '../../services/salesHistoryService'
import { SalesHistoryFilters } from './SalesHistoryFilters'
import { HistoryReadError } from './HistoryReadError'
import { useSalesHistory } from './useSalesHistory'

export function SalesHistoryPage({ service = salesHistoryService }: { service?: SalesHistoryReader }) {
  const [params, setParams] = useSearchParams()
  const filters: Filters = { receipt: params.get('q') ?? '', startDate: params.get('mulai') ?? '', endDate: params.get('sampai') ?? '' }
  const history = useSalesHistory(filters, service)
  function apply(next: Filters) {
    const query = new URLSearchParams()
    if (next.receipt) query.set('q', next.receipt)
    if (next.startDate) query.set('mulai', next.startDate)
    if (next.endDate) query.set('sampai', next.endDate)
    setParams(query)
  }
  const filtered = !!(filters.receipt || filters.startDate || filters.endDate)
  const queryString = params.size ? `?${params.toString()}` : ''
  return <>
    <PageHeader title="Riwayat Penjualan" description="Penjualan tunai dan Bon tersimpan di perangkat ini. Buka kembali rincian dan struk tanpa mengubah transaksi atau stok." action={<Button variant="secondary" disabled={history.status === 'loading' || history.loadingMore} onClick={history.retry}>Muat ulang</Button>} />
    <SalesHistoryFilters key={params.toString()} initial={filters} onApply={apply} onReset={() => setParams({})} />
    {history.error && <HistoryReadError error={history.error} busy={history.loadingMore} onRetry={history.sales.length ? () => void history.loadMore() : history.retry} />}
    {history.status === 'loading' ? <p role="status" className="panel p-6 text-sm text-ink-muted">Membaca riwayat penjualan…</p> : history.status === 'ready' && !history.sales.length && !history.error ? <div className="panel"><EmptyState title={filtered ? 'Tidak ada transaksi yang sesuai' : 'Belum ada penjualan tersimpan'} description={filtered ? 'Ubah nomor struk atau rentang tanggal, atau reset filter untuk melihat seluruh riwayat.' : 'Penjualan tunai yang berhasil dari Kasir akan muncul di sini.'} action={<Link className="btn btn-primary" to="/kasir">Buka Kasir</Link>} /></div> : null}
    {!!history.sales.length && <section aria-label="Daftar penjualan tersimpan">
      <p role="status" className="mb-3 text-xs text-ink-muted">{history.sales.length} transaksi ditampilkan · Terbaru terlebih dahulu</p>
      <ol className="space-y-3">{history.sales.map((sale) => <li key={sale.id} className="panel p-5" data-sale-id={sale.id}>
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><span className="pill bg-success-soft text-success">COMPLETED</span><span className="text-xs text-ink-muted">{sale.paymentMethod === 'BON' ? `Bon / Bayar Nanti · ${sale.customerSnapshot?.name}` : 'Tunai'}</span></div><h2 className="break-all text-sm font-semibold">{sale.receiptNumber}</h2><time dateTime={sale.createdAt} className="mt-2 block text-xs text-ink-muted">{new Date(sale.createdAt).toLocaleString('id-ID')}</time></div>
          <div className="flex flex-wrap items-center justify-between gap-3 md:flex-col md:items-end"><p className="text-lg font-bold tabular-nums">{money(sale.total)}</p><Link className="btn btn-secondary text-xs" to={`/penjualan/${sale.id}${queryString}`} aria-label={`Lihat struk ${sale.receiptNumber}`}><ReceiptText size={16} aria-hidden="true" />Lihat struk</Link></div>
        </div>
      </li>)}</ol>
      {history.nextCursor && <Button variant="secondary" className="mt-5 w-full sm:w-auto" disabled={history.loadingMore} onClick={() => void history.loadMore()}>{history.loadingMore ? 'Memuat transaksi…' : 'Muat lebih banyak'}</Button>}
    </section>}
    <p className="mt-5 text-xs leading-5 text-ink-muted">Riwayat hanya-baca dari IndexedDB lokal. Dashboard menghitung omzet tunai + Bon, bukan cicilan. QRIS belum tersedia; halaman Laporan masih DEMO.</p>
  </>
}
