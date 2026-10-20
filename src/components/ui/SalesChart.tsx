import { displayDate, money } from '../../lib/format'
import type { DemoSale } from '../../types/pos'
import { groupSalesByDay } from '../../lib/sales'
import { EmptyState } from './EmptyState'

export function SalesChart({ sales }: { sales: DemoSale[] }) {
  const days = groupSalesByDay(sales)
  const maximum = Math.max(...days.map((day) => day.total), 1)
  return <section className="panel p-5 sm:p-6" aria-label="Grafik omzet demo"><div className="mb-6 flex items-start justify-between gap-3"><div><h2 className="font-semibold">Irama penjualan</h2><p className="mt-1 text-xs text-ink-muted">Omzet per hari · sampel DEMO</p></div><span className="pill bg-brand-soft text-brand">Rupiah</span></div>
    {!days.length ? <EmptyState title="Belum ada data pada rentang ini" description="Pilih tanggal 13–19 Oktober 2026 untuk melihat sampel laporan." /> : <ul className="space-y-4">{days.map(({ date, total }) => <li key={date}><div className="mb-2 flex items-center justify-between gap-3 text-xs"><span className="text-ink-muted">{displayDate(date)}</span><span className="font-semibold tabular-nums">{money(total)}</span></div><div aria-hidden="true" className="h-3 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-brand" style={{ width: `${(total / maximum) * 100}%` }} /></div></li>)}</ul>}
  </section>
}

