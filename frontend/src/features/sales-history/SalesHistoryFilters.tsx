import { useState, type SubmitEvent } from 'react'
import { Search } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import type { SalesHistoryFilters as Filters } from '../../domain/salesHistory'

export function SalesHistoryFilters({ initial, onApply, onReset }: { initial: Filters; onApply: (filters: Filters) => void; onReset: () => void }) {
  const [draft, setDraft] = useState(initial)
  function submit(event: SubmitEvent<HTMLFormElement>) { event.preventDefault(); onApply(draft) }
  return <form onSubmit={submit} className="panel mb-5 p-5" aria-label="Filter riwayat penjualan">
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <div><label htmlFor="history-receipt" className="field-label">Cari nomor struk</label><input id="history-receipt" className="field" type="search" maxLength={100} placeholder="Nomor atau sebagian nomor struk…" value={draft.receipt} onChange={(event) => setDraft({ ...draft, receipt: event.target.value })} /></div>
      <div><label htmlFor="history-start" className="field-label">Tanggal mulai</label><input id="history-start" type="date" min="1000-01-01" max="9998-12-31" className="field" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} /></div>
      <div><label htmlFor="history-end" className="field-label">Tanggal akhir</label><input id="history-end" type="date" min="1000-01-01" max="9998-12-31" className="field" value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} /></div>
    </div>
    <div className="mt-4 flex flex-wrap gap-2"><Button type="submit"><Search size={16} aria-hidden="true" />Terapkan filter</Button><Button variant="secondary" onClick={() => { setDraft({ receipt: '', startDate: '', endDate: '' }); onReset() }}>Reset filter</Button></div>
    <p className="mt-3 text-xs leading-5 text-ink-muted">Tanggal mengikuti zona waktu perangkat. Seluruh hari pada tanggal akhir disertakan.</p>
  </form>
}
