import { AlertTriangle, ArrowRight, Banknote, PackageX, ReceiptText, ShoppingBasket } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { Button } from '../../components/ui/Button'
import { money } from '../../lib/format'
import { quantityText } from '../../domain/quantity'
import type { DashboardStock } from '../../domain/dashboard'
import type { DashboardService } from '../../services/dashboardOperations'
import { dashboardService } from '../../services/dashboardService'
import { useDashboard } from './useDashboard'

function StockList({ title, rows }: { title: string; rows: readonly DashboardStock[] }) {
  return <section className="panel overflow-hidden" aria-label={title}><h2 className="border-b border-line px-5 py-4 text-sm font-semibold">{title} · {rows.length} produk</h2>
    {!rows.length ? <p className="p-5 text-sm text-ink-muted">Tidak ada produk pada status ini.</p> : <ul className="divide-y divide-line px-5">{rows.slice(0, 5).map((row) => <li key={row.productId} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><h3 className="text-xs font-semibold">{row.name}{!row.active && ' · Nonaktif'}</h3><p className="mt-1 text-[11px] text-ink-muted">Minimum {row.minimumStock === null ? 'belum diatur' : `${quantityText(row.minimumStock)} ${row.unit}`}</p></div><span className="pill bg-warning-soft text-warning">{quantityText(row.quantityBase)} {row.unit}</span></li>)}</ul>}
    <Link to="/stok" className="flex min-h-12 items-center justify-center gap-2 border-t border-line text-xs font-semibold text-brand">Lihat persediaan <ArrowRight size={15} aria-hidden="true" /></Link>
  </section>
}
export function DashboardPage({ service = dashboardService }: { service?: DashboardService }) {
  const { snapshot, error, retry } = useDashboard(service)
  return <>
    <PageHeader title="Ringkasan warung" description="Penjualan tunai dan persediaan nyata dari perangkat ini. Omzet adalah nilai penjualan, bukan laba." action={<Button variant="secondary" onClick={retry}>Muat ulang</Button>} />
    {error ? <div className="panel p-6"><p role="alert" className="text-sm text-danger">{error}</p><Button className="mt-4" onClick={retry}>Coba lagi</Button></div> : !snapshot ? <p role="status" className="panel p-6 text-sm text-ink-muted">Membaca Dashboard…</p> : <>
      <p className="mb-4 text-xs text-ink-muted">{new Date(`${snapshot.today.date}T12:00:00`).toLocaleDateString('id-ID', { dateStyle: 'long' })} · Zona waktu perangkat · Diperbarui otomatis</p>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div data-metric="revenue"><StatCard label="Omzet hari ini" value={money(snapshot.today.revenue)} note="Penjualan COMPLETED · bukan laba" icon={Banknote} /></div>
        <div data-metric="transactions"><StatCard label="Transaksi hari ini" value={String(snapshot.today.transactions)} note="Pembayaran tunai tersimpan" icon={ReceiptText} /></div>
        <div data-metric="items"><StatCard label="Baris item terjual" value={String(snapshot.today.itemRows)} note="Hari ini · bukan gabungan kuantitas" icon={ShoppingBasket} /></div>
        <div><StatCard label="Produk stok habis" value={String(snapshot.outOfStock.length)} note={`${snapshot.lowStock.length} menipis · ${snapshot.uninitialized} belum diatur`} icon={PackageX} /></div>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section className="panel p-5" aria-label="Penjualan tujuh hari"><h2 className="text-sm font-semibold">Omzet tujuh hari</h2><p className="mt-1 mb-5 text-xs text-ink-muted">Enam hari sebelumnya dan hari ini · Rupiah</p><ul className="space-y-4">{snapshot.days.map((day) => <li key={day.date}><div className="mb-1 flex flex-wrap justify-between gap-2 text-xs"><span>{new Date(`${day.date}T12:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} · {day.transactions} transaksi</span><strong>{money(day.revenue)}</strong></div><div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-surface-muted"><div className="h-full bg-brand" style={{ width: `${day.revenue / Math.max(1, ...snapshot.days.map((entry) => entry.revenue)) * 100}%` }} /></div></li>)}</ul></section>
        <section className="panel p-5" aria-label="Produk terlaris"><h2 className="text-sm font-semibold">Produk terlaris</h2><p className="mt-1 mb-4 text-xs leading-5 text-ink-muted">Tujuh hari · berdasarkan omzet · nama dan satuan saat dijual</p>{!snapshot.topProducts.length ? <p className="text-sm text-ink-muted">Belum ada penjualan dalam tujuh hari ini.</p> : <ol className="divide-y divide-line">{snapshot.topProducts.map((row) => <li key={row.key} className="flex flex-wrap justify-between gap-3 py-3"><div><h3 className="text-xs font-semibold">{row.name}</h3><p className="mt-1 text-xs text-ink-muted">{quantityText(row.quantity)} {row.unit.name} · {row.itemRows} baris</p></div><strong className="text-sm">{money(row.revenue)}</strong></li>)}</ol>}</section>
        <section className="panel overflow-hidden" aria-label="Transaksi terbaru"><div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4"><h2 className="text-sm font-semibold">Transaksi terbaru</h2><Link className="text-xs font-semibold text-brand" to="/penjualan">Lihat riwayat</Link></div>{!snapshot.recent.length ? <p className="p-5 text-sm text-ink-muted">Belum ada transaksi tersimpan.</p> : <ul className="divide-y divide-line px-5">{snapshot.recent.map(({ sale }) => <li key={sale.id} className="py-4"><Link className="block break-all text-xs font-semibold text-brand underline" to={`/penjualan/${sale.id}`}>{sale.receiptNumber}</Link><div className="mt-2 flex flex-wrap justify-between gap-2 text-xs"><time dateTime={sale.createdAt}>{new Date(sale.createdAt).toLocaleString('id-ID')} · Tunai</time><strong>{money(sale.total)}</strong></div></li>)}</ul>}</section>
        <div className="space-y-6"><StockList title="Produk stok menipis" rows={snapshot.lowStock} /><StockList title="Produk stok habis" rows={snapshot.outOfStock} /></div>
      </div>
      {!!snapshot.uninitialized && <p className="mt-5 flex items-center gap-2 text-xs text-warning"><AlertTriangle size={16} aria-hidden="true" />{snapshot.uninitialized} produk belum mempunyai stok awal; tidak dihitung sebagai stok habis.</p>}
    </>}
    <p className="mt-5 text-xs leading-5 text-ink-muted">Dashboard hanya-baca. QRIS dan Bon belum aktif; halaman Laporan masih memakai data DEMO.</p>
  </>
}
