import { useId } from 'react'
import type { ReportPreset, ReportRequest, ReportMethod } from '../../domain/reporting'

export function ReportFilters({ value, onChange }: { value: ReportRequest; onChange: (request: ReportRequest) => void }) {
  const id = useId()
  return <fieldset className="panel mb-5 grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4"><legend className="sr-only">Filter periode dan pembayaran</legend>
    <label><span className="field-label">Periode</span><select className="field" value={value.preset} onChange={(e) => onChange({ ...value, preset: e.target.value as ReportPreset })}><option value="today">Hari Ini</option><option value="week">7 Hari Terakhir</option><option value="month">Bulan Ini</option><option value="custom">Rentang Tanggal</option></select></label>
    <label><span className="field-label">Metode pembayaran</span><select className="field" value={value.method ?? 'ALL'} onChange={(e) => onChange({ ...value, method: e.target.value as ReportMethod })}><option value="ALL">Tunai + Bon</option><option value="CASH">Tunai</option><option value="BON">Bon / Bayar Nanti</option></select></label>
    {value.preset === 'custom' && <><label><span className="field-label">Tanggal mulai</span><input type="date" className="field" value={value.startDate ?? ''} onChange={(e) => onChange({ ...value, startDate: e.target.value })} aria-describedby={id} /></label><label><span className="field-label">Tanggal akhir</span><input type="date" className="field" value={value.endDate ?? ''} onChange={(e) => onChange({ ...value, endDate: e.target.value })} aria-describedby={id} /></label></>}
    <p id={id} className="text-xs leading-5 text-ink-muted sm:col-span-2 xl:col-span-4">Tanggal mengikuti zona waktu perangkat, termasuk seluruh tanggal akhir. Maksimal 366 hari. Saldo piutang dan stok menunjukkan keadaan saat ini.</p>
  </fieldset>
}
