import { displayDate, money } from '../../lib/format'
import type { SalesReport } from '../../domain/reporting'
export function ReportChart({ report }: { report: SalesReport }) {
  const maximum = Math.max(1, ...report.days.map((day) => day.revenue))
  return <section className="panel p-5" aria-label={report.days.length === 7 ? 'Penjualan tujuh hari' : 'Penjualan berdasarkan tanggal'}><h2 className="text-sm font-semibold">Penjualan berdasarkan tanggal</h2><p className="mt-1 mb-5 text-xs text-ink-muted">{displayDate(report.window.startDate)} – {displayDate(report.window.endDate)} · Rupiah</p>
    <ul className="max-h-96 space-y-4 overflow-y-auto">{report.days.map((day) => <li key={day.date}><div className="mb-1 flex flex-wrap justify-between gap-2 text-xs"><span>{displayDate(day.date)} · {day.transactions} transaksi</span><strong>{money(day.revenue)}</strong></div><div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-surface-muted"><div className="h-full bg-brand" style={{ width: `${day.revenue / maximum * 100}%` }} /></div></li>)}</ul>
  </section>
}
