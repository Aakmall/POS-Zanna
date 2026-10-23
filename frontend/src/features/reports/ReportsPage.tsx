import { useRef, useState } from 'react'
import { Download } from 'lucide-react'
import type { ReportRequest } from '../../domain/reporting'
import type { ReportingService } from '../../services/reportingOperations'
import { reportingService } from '../../services/reportingService'
import { creditCsv, downloadBlob, profitCsv, salesCsv } from '../../services/reportExport'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import { money } from '../../lib/format'
import { ReportFilters } from './ReportFilters'
import { ReportSummary } from './ReportSummary'
import { ReportChart } from './ReportChart'
import { SalesReportTable } from './SalesReportTable'
import { ProfitSummary } from './ProfitSummary'
import { ReceivablesReport } from './ReceivablesReport'
import { useProfit, useReport } from './useReport'

export function ReportsPage({ service = reportingService }: { service?: ReportingService }) {
  const [request, setRequest] = useState<ReportRequest>({ preset: 'today', method: 'ALL' }), [tab, setTab] = useState('sales')
  const { report, error, retry } = useReport(service, request), { profit, error: profitError } = useProfit(service, report)
  const [exporting, setExporting] = useState(false), [notice, setNotice] = useState(''), [exportError, setExportError] = useState(''), exportGuard = useRef(false)
  async function exportReport() {
    if (!report || exportGuard.current || tab === 'profit' && !profit) return
    exportGuard.current = true; setExporting(true); setExportError(''); setNotice('')
    try {
      const value = tab === 'credit' ? creditCsv(report) : tab === 'profit' ? profitCsv(report, profit!) : salesCsv(report)
      downloadBlob(new Blob([value], { type: 'text/csv;charset=utf-8' }), `zanna-${tab}-${report.window.startDate}-${report.window.endDate}.csv`)
      await new Promise((resolve) => window.setTimeout(resolve, 300))
      setNotice('File CSV telah disiapkan. Buka unduhan untuk melihat hasil; CSV dapat dibuka di Excel.')
    } catch { setExportError('File belum berhasil disiapkan. Coba ekspor ulang.') }
    finally { exportGuard.current = false; setExporting(false) }
  }
  return <><PageHeader title="Laporan" description="Penjualan, uang diterima, laba kotor dan piutang dari transaksi tersimpan." action={<Button variant="secondary" onClick={() => void exportReport()} disabled={!report || exporting || tab === 'profit' && !profit}><Download size={17} aria-hidden="true" />{exporting ? 'Menyiapkan…' : 'Ekspor CSV'}</Button>} />
    <ReportFilters value={request} onChange={setRequest} />
    <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Jenis laporan">{[['sales', 'Penjualan'], ['profit', 'Laba Kotor'], ['credit', 'Piutang']].map(([key, label]) => <Button key={key} variant={tab === key ? 'primary' : 'secondary'} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</Button>)}</div>
    {notice && <p role="status" className="mb-4 rounded-xl bg-success-soft p-3 text-sm text-success">{notice}</p>}{exportError && <p role="alert" className="mb-4 text-sm text-danger">{exportError}</p>}
    {error ? <div className="panel p-5"><p role="alert" className="text-sm text-danger">{error}</p><Button className="mt-4" onClick={retry}>Coba lagi</Button></div> : !report ? <p role="status" className="panel p-5">Membaca laporan…</p> : <>
      <ReportSummary report={report} />
      <p className="mb-5 text-xs leading-5 text-ink-muted">Penjualan tunai {money(report.cashSales)} · Bon {money(report.bonSales)} · Cicilan diterima {money(report.creditReceipts)}. Uang diterima = tunai sesudah kembalian + cicilan dalam periode, bukan omzet tambahan. Semua angka mengikuti metode terpilih; piutang saat ini tetap seluruh tanggal.</p>
      {tab === 'sales' && <div className="space-y-6"><ReportChart report={report} /><SalesReportTable report={report} /></div>}
      {tab === 'profit' && <div className="space-y-5"><ProfitSummary profit={profit} error={profitError} />{profit && <div className="table-scroll" tabIndex={0} role="region" aria-label="Rincian laba kotor"><table className="data-table"><thead><tr><th scope="col">Struk</th><th scope="col">Penjualan dengan modal</th><th scope="col">Harga Modal</th><th scope="col">Laba diketahui</th><th scope="col">Kelengkapan</th></tr></thead><tbody>{profit.rows.map((row) => <tr key={row.saleId}><td>{row.receiptNumber}</td><td>{money(row.knownRevenue)}</td><td>{money(row.cost)}</td><td>{money(row.profit)}</td><td>{row.missingItems ? `Parsial: ${row.missingItems} baris tanpa modal` : 'Lengkap'}</td></tr>)}</tbody></table>{!profit.rows.length && <p className="p-5 text-sm text-ink-muted">Belum ada transaksi pada periode ini.</p>}</div>}</div>}
      {tab === 'credit' && <ReceivablesReport report={report} />}
    </>}
    <p className="mt-5 text-xs leading-5 text-warning">Mode pengembangan: laporan dan modal belum dibatasi hak akses pemilik. Gunakan data uji yang tidak sensitif.</p>
  </>
}
