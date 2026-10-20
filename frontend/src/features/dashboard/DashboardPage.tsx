import { AlertTriangle, ArrowRight, Banknote, PackageCheck, ReceiptText, ShoppingBasket, Users } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { ProductMark } from '../../components/ui/ProductMark'
import { demoCustomers, demoSales } from '../../mocks/business'
import { displayDate, money } from '../../lib/format'
import { summarizeSales } from '../../lib/sales'
import { useDemoStore } from '../../hooks/useDemoStore'

export function DashboardPage() {
  const { products, status } = useDemoStore()
  const sampleDate = '2026-10-19'
  const sales = demoSales.filter((sale) => sale.date === sampleDate)
  const summary = summarizeSales(sales)
  const lowStock = products.filter((product) => product.stock !== null && product.stock <= product.minimumStock).sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))

  return (
    <>
      <PageHeader title="Ringkasan warung" description="Gambaran penjualan dan persediaan untuk membantu langkah berikutnya. Semua data adalah DEMO."
        action={<span className="inline-flex min-h-11 items-center rounded-control border border-line bg-surface px-4 text-xs text-ink-muted">19 Oktober 2026 · Sampel tetap</span>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Penjualan" value={money(summary.revenue)} note="Sampel 19 Okt 2026 · DEMO" icon={Banknote} />
        <StatCard label="Total Transaksi" value={String(summary.count)} note="Transaksi contoh, bukan hasil checkout" icon={ReceiptText} />
        <StatCard label="Jumlah Pelanggan" value={String(demoCustomers.length)} note="Pelanggan fiktif dalam data contoh" icon={Users} />
        <StatCard label="Produk Stok Rendah" value="—" note="Belum dihitung · saldo stok belum dibuat" icon={AlertTriangle} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="panel min-w-0 overflow-hidden" aria-labelledby="activity-title">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div><h2 id="activity-title" className="text-sm font-semibold">Transaksi terbaru</h2><p className="mt-1 text-[11px] text-ink-muted">Aktivitas ilustrasi · 13–19 Oktober 2026</p></div>
            <Link to="/laporan" className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-brand">Lihat laporan <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Daftar transaksi contoh">
            <table className="data-table"><thead><tr><th scope="col">Transaksi / pelanggan</th><th scope="col">Metode</th><th scope="col">Total DEMO</th></tr></thead>
              <tbody>{[...demoSales].reverse().slice(0, 5).map((sale) => <tr key={sale.id}>
                <td><p className="text-xs font-semibold">{sale.id}</p><p className="mt-1.5 text-[11px] text-ink-muted">{sale.customer}</p><p className="mt-1 text-[10px] text-ink-muted">{displayDate(sale.date)}</p></td>
                <td><span className={`pill ${sale.method === 'Bon' ? 'bg-warning-soft text-warning' : 'bg-brand-soft text-brand'}`}>{sale.method}</span></td>
                <td className="text-xs font-semibold tabular-nums">{money(sale.total)}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <p className="border-t border-line px-5 py-4 text-[11px] leading-5 text-ink-muted">Transaksi ilustrasi ini tidak berubah ketika Anda menyelesaikan pembayaran DEMO di Kasir.</p>
        </section>

        <section className="panel overflow-hidden" aria-labelledby="stock-title">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4"><div><h2 id="stock-title" className="text-sm font-semibold">Persediaan perlu perhatian</h2><p className="mt-1 text-[11px] text-ink-muted">Jaga kebutuhan warung tetap tersedia.</p></div><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning"><PackageCheck size={18} aria-hidden="true" /></span></div>
          {status !== 'ready' ? <p role="status" className="p-6 text-sm leading-6 text-ink-muted">{status === 'loading' ? 'Membaca katalog lokal…' : 'Katalog lokal gagal dimuat. Buka halaman Stok untuk mencoba lagi.'}</p> : lowStock.length === 0 ? <div className="p-6 text-sm leading-6 text-ink-muted">Saldo stok belum dicatat. Siapkan batas minimum pada master produk; inventory ledger tersedia pada fase berikutnya.</div> : (
            <ul className="divide-y divide-line px-5">{lowStock.slice(0, 5).map((product) => <li key={product.id} className="flex items-center gap-3 py-4">
              <ProductMark product={product} small />
              <div className="min-w-0 flex-1"><h3 className="text-xs font-semibold">{product.name}</h3><p className="mt-1.5 text-[11px] text-ink-muted">Minimum {product.minimumStock} {product.unit}</p></div>
              <span className={`pill shrink-0 ${product.stock === 0 ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning'}`}>{product.stock === 0 ? 'Habis' : `${product.stock} ${product.unit}`}</span>
            </li>)}</ul>
          )}
          <Link to="/stok" className="flex min-h-14 items-center justify-center gap-2 border-t border-line text-xs font-semibold text-brand hover:bg-brand-soft">Kelola stok contoh <ArrowRight size={15} aria-hidden="true" /></Link>
        </section>
      </div>

      <section className="mt-6 flex flex-wrap items-center justify-between gap-5 rounded-panel border border-brand/15 bg-brand-soft p-5 sm:p-6">
        <div className="flex items-center gap-4"><span className="hidden size-12 shrink-0 items-center justify-center rounded-xl bg-white text-brand sm:flex"><ShoppingBasket size={25} strokeWidth={1.5} aria-hidden="true" /></span><div><h2 className="text-sm font-semibold">Siap mencoba alur belanja?</h2><p className="mt-1.5 text-xs leading-6 text-ink-muted">Pilih produk, susun keranjang, dan simulasikan pembayaran.</p></div></div>
        <Link className="btn btn-primary text-xs" to="/kasir">Buka kasir DEMO <ArrowRight size={16} aria-hidden="true" /></Link>
      </section>
    </>
  )
}
