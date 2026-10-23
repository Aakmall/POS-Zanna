import { Banknote, ReceiptText, Wallet, BookOpen } from 'lucide-react'
import { StatCard } from '../../components/ui/StatCard'
import { money } from '../../lib/format'
import type { SalesReport } from '../../domain/reporting'

export function ReportSummary({ report }: { report: SalesReport }) {
  return <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <div data-metric="revenue"><StatCard label="Penjualan periode" value={money(report.revenue)} note="Tunai + Bon terpilih; bukan laba" icon={Banknote} /></div>
    <div data-metric="transactions"><StatCard label="Jumlah transaksi" value={String(report.transactions)} note={`${report.itemRows} baris item · bukan gabungan satuan`} icon={ReceiptText} /><span data-metric="items" className="sr-only">{report.itemRows}</span></div>
    <div data-metric="received"><StatCard label="Uang diterima" value={money(report.moneyReceived)} note="Tunai bersih + cicilan pada periode/filter" icon={Wallet} /></div>
    <div data-metric="outstanding"><StatCard label="Sisa piutang saat ini" value={money(report.outstanding)} note="Seluruh pelanggan dan tanggal" icon={BookOpen} /></div>
  </div>
}
