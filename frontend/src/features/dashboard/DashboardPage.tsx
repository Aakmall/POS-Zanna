import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { money } from '../../lib/format'
import { quantityText } from '../../domain/quantity'
import type { DashboardStock } from '../../domain/dashboard'
import type { ReportRequest } from '../../domain/reporting'
import type { DashboardService } from '../../services/dashboardOperations'
import { dashboardService } from '../../services/dashboardService'
import { ReportFilters } from '../reports/ReportFilters'
import { ReportSummary } from '../reports/ReportSummary'
import { ReportChart } from '../reports/ReportChart'
import { ProfitSummary } from '../reports/ProfitSummary'
import { SalesReportTable } from '../reports/SalesReportTable'
import { useProfit, useReport } from '../reports/useReport'

function StockList({ title, rows }: { title: string; rows: readonly DashboardStock[] }) {
  return <section className="panel overflow-hidden" aria-label={title}><h2 className="border-b border-line px-5 py-4 text-sm font-semibold">{title} · {rows.length} produk</h2>
    {!rows.length ? <p className="p-5 text-sm text-ink-muted">Tidak ada produk pada status ini.</p> : <ul className="divide-y divide-line px-5">{rows.slice(0, 5).map((row) => <li key={row.productId} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><h3 className="text-xs font-semibold">{row.name}{!row.active && ' · Nonaktif'}</h3><p className="mt-1 text-[11px] text-ink-muted">Minimum {row.minimumStock === null ? 'belum diatur' : `${quantityText(row.minimumStock)} ${row.unit}`}</p></div><span className="pill bg-warning-soft text-warning">{quantityText(row.quantityBase)} {row.unit}</span></li>)}</ul>}
    <Link to="/stok" className="flex min-h-12 items-center justify-center gap-2 border-t border-line text-xs font-semibold text-brand">Lihat persediaan <ArrowRight size={15} aria-hidden="true" /></Link>
  </section>
}
export function DashboardPage({ service = dashboardService }: { service?: DashboardService }) {
  const [request, setRequest] = useState<ReportRequest>({ preset: 'week', method: 'ALL' })
  const { report, error, retry } = useReport(service.reports, request), { profit, error: profitError } = useProfit(service.reports, report)
  return <>
    <PageHeader title="Ringkasan warung" description="Penjualan, penerimaan uang dan persediaan nyata. Lihat rincian lengkap di menu Laporan." action={<Button variant="secondary" onClick={retry}>Muat ulang</Button>} />
    <ReportFilters value={request} onChange={setRequest} />
    {error ? <div className="panel p-6"><p role="alert" className="text-sm text-danger">{error}</p><Button className="mt-4" onClick={retry}>Coba lagi</Button></div> : !report ? <p role="status" className="panel p-6 text-sm text-ink-muted">Membaca Dashboard…</p> : <>
      <ReportSummary report={report} />
      <p className="mb-5 text-xs leading-5 text-ink-muted">Tunai {money(report.cashSales)} · Bon {money(report.bonSales)} · Cicilan diterima {money(report.creditReceipts)}. Cicilan bukan penjualan baru. Tunai dihitung sesudah kembalian. Zona waktu perangkat · Diperbarui otomatis.</p>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <ReportChart report={report} />
        <section className="panel p-5" aria-label="Produk terlaris"><h2 className="text-sm font-semibold">Produk terlaris</h2><p className="mt-1 mb-4 text-xs leading-5 text-ink-muted">Periode terpilih · berdasarkan penjualan · jumlah dipisahkan per satuan jual</p>{!report.topProducts.length ? <p className="text-sm text-ink-muted">Belum ada penjualan pada periode ini.</p> : <ol className="divide-y divide-line">{report.topProducts.map((row) => <li key={row.key} className="flex flex-wrap justify-between gap-3 py-3"><div><h3 className="text-xs font-semibold">{row.name}</h3><p className="mt-1 text-xs text-ink-muted">{quantityText(row.quantity)} {row.unit.name} · {row.itemRows} baris</p></div><strong className="text-sm">{money(row.revenue)}</strong></li>)}</ol>}</section>
        <SalesReportTable report={report} limit={5} />
        <div className="space-y-6"><StockList title="Produk stok menipis" rows={report.lowStock} /><StockList title="Produk stok habis" rows={report.outOfStock} /></div>
        <div className="xl:col-span-2"><ProfitSummary profit={profit} error={profitError} /></div>
      </div>
      {!!report.uninitialized && <p className="mt-5 text-xs text-warning">{report.uninitialized} produk belum mempunyai stok awal; tidak dihitung sebagai stok habis.</p>}
      <Link to="/laporan" className="mt-5 inline-flex min-h-12 items-center font-semibold text-brand underline">Buka laporan lengkap dan ekspor</Link>
    </>}
    <p className="mt-5 text-xs leading-5 text-ink-muted">Dashboard hanya membaca data. QRIS belum aktif. Laba/modal terbuka untuk pengembangan; pembatasan khusus pemilik belum diterapkan.</p>
  </>
}
