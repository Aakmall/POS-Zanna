import type { ProfitReport, SalesReport } from '../domain/reporting'

export type ExportCell = string | number
export function csv(rows: readonly (readonly ExportCell[])[]): string {
  return '\uFEFF' + rows.map((row) => row.map((cell) => {
    const raw = String(cell)
    // Spreadsheet formulas must stay text, including control/whitespace prefixes.
    const first = Array.from(raw).find((character) => character.codePointAt(0)! > 32 && character.trim() !== '')
    const safe = typeof cell === 'string' && first && '=+@-'.includes(first) ? `'${raw}` : raw
    return `"${safe.replaceAll('"', '""')}"`
  }).join(',')).join('\r\n') + '\r\n'
}
export function salesCsv(report: SalesReport): string {
  return csv([
    ['Laporan penjualan', report.window.startDate, report.window.endDate, report.window.method],
    ['Penjualan', report.revenue], ['Penjualan tunai (sesudah kembalian)', report.cashSales], ['Penjualan Bon', report.bonSales],
    ['Cicilan diterima pada periode', report.creditReceipts], ['Uang diterima pada periode', report.moneyReceived],
    ['Struk', 'Waktu lokal', 'Metode', 'Pelanggan saat dijual', 'Penjualan (Rp)', 'Baris item'],
    ...report.sales.map(({ sale, items }) => [sale.receiptNumber, new Date(sale.createdAt).toLocaleString('id-ID'), sale.paymentMethod, sale.customerSnapshot?.name ?? '', sale.total, items.length]),
  ])
}
// Future permission: reports.profit.view on both screen AND this service entry point.
export function profitCsv(report: SalesReport, profit: ProfitReport): string {
  return csv([['Laba kotor', report.window.startDate, report.window.endDate], ['Kelengkapan', profit.complete ? 'Lengkap' : 'PARSIAL: baris tanpa modal dikecualikan'],
    ['Penjualan dengan modal', profit.knownRevenue], ['Harga modal tersimpan', profit.cost], ['Laba kotor diketahui', profit.profit],
    ['Struk', 'Penjualan', 'Penjualan dengan modal', 'Harga modal', 'Laba kotor diketahui', 'Baris tanpa modal'],
    ...profit.rows.map((row) => [row.receiptNumber, row.revenue, row.knownRevenue, row.cost, row.profit, row.missingItems])])
}
export function creditCsv(report: SalesReport): string {
  return csv([['Piutang saat ini (semua tanggal)'], ['Total Bon', report.totalBon], ['Sudah dibayar sepanjang waktu', report.totalPaid], ['Sisa piutang', report.outstanding],
    ['Cicilan diterima pada periode', report.window.startDate, report.window.endDate, report.creditReceipts],
    ['Struk', 'Pelanggan saat dijual', 'Total Bon', 'Sudah dibayar', 'Sisa utang', 'Status', 'Jatuh tempo'],
    ...report.receivables.map((r) => [r.receiptNumber, r.customerSnapshot.name, r.originalAmount, r.totalPaid, r.balance, r.status, r.dueDate ?? '']),
    ['Bukti cicilan pada periode'], ['Bukti', 'Struk penjualan', 'Pelanggan', 'Waktu lokal', 'Nominal'],
    ...report.payments.map((p) => [p.receiptNumber, p.saleReceiptNumber, p.customerSnapshot.name, new Date(p.createdAt).toLocaleString('id-ID'), p.amount])])
}
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = filename; document.body.append(link)
  try { link.click() } finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000) }
}
