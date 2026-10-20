import { useState } from 'react'
import { Banknote, ChartNoAxesCombined, ReceiptText } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { SalesChart } from '../../components/ui/SalesChart'
import { EmptyState } from '../../components/ui/EmptyState'
import { demoSales } from '../../mocks/business'
import { displayDate, money } from '../../lib/format'
import { summarizeSales } from '../../lib/sales'

export function ReportsPage() {
  const [start, setStart] = useState('2026-10-13')
  const [end, setEnd] = useState('2026-10-19')
  const valid = !!start && !!end && start <= end
  const sales = valid ? demoSales.filter((sale) => sale.date >= start && sale.date <= end) : []
  const summary = summarizeSales(sales)
  return <><PageHeader title="Laporan" description="Baca ringkasan omzet dan laba kotor dari data ilustrasi, tanpa transaksi nyata." />
    <div className="panel mb-6 flex flex-wrap items-end gap-4 p-5"><label className="min-w-44 flex-1"><span className="field-label">Tanggal mulai</span><input type="date" className="field" value={start} onChange={(event) => setStart(event.target.value)} /></label><label className="min-w-44 flex-1"><span className="field-label">Tanggal akhir</span><input type="date" className="field" value={end} onChange={(event) => setEnd(event.target.value)} /></label><Button variant="secondary" onClick={() => { setStart('2026-10-13'); setEnd('2026-10-19') }}>Rentang sampel</Button><p className="w-full text-xs text-ink-muted">Sampel tetap tersedia pada 13–19 Oktober 2026. Perubahan filter langsung memperbarui ringkasan.</p></div>
    {!valid ? <p role="alert" className="panel p-6 text-sm text-danger">Isi kedua tanggal. Tanggal mulai tidak boleh melewati tanggal akhir.</p> : <><div className="mb-6 grid gap-4 sm:grid-cols-3"><StatCard label="Omzet DEMO" value={money(summary.revenue)} note="Total nilai penjualan sampel" icon={Banknote} /><StatCard label="Laba kotor DEMO" value={money(summary.profit)} note="Omzet − modal contoh; belum biaya operasional" icon={ChartNoAxesCombined} /><StatCard label="Transaksi DEMO" value={String(summary.count)} note="Jumlah baris dalam rentang terpilih" icon={ReceiptText} /></div><SalesChart sales={sales} />
      <section className="mt-6"><h2 className="mb-4 font-semibold">Rincian transaksi contoh</h2>{!sales.length ? <div className="panel"><EmptyState title="Tidak ada transaksi contoh" description="Pilih rentang tanggal yang mencakup sampel 13–19 Oktober 2026." /></div> : <div className="table-scroll" tabIndex={0} role="region" aria-label="Rincian laporan demo"><table className="data-table"><thead><tr><th scope="col">Referensi DEMO</th><th scope="col">Tanggal</th><th scope="col">Metode</th><th scope="col">Omzet</th><th scope="col">Laba kotor</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td className="font-semibold">{sale.id}</td><td>{displayDate(sale.date)}</td><td>{sale.method}</td><td>{money(sale.total)}</td><td className="text-success">{money(sale.total - sale.cost)}</td></tr>)}</tbody></table></div>}</section>
    </>}
    <p className="mt-5 text-xs leading-5 text-ink-muted">Angka laporan tidak berasal dari checkout Kasir, produk yang diedit, atau bon sesi. Seluruh modal di sini adalah nilai ilustrasi; bukan perhitungan laba usaha sebenarnya.</p>
  </>
}
