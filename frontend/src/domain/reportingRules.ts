import { ValidationError } from './errors'
import { CheckoutError } from './checkout'
import type { Product } from './product'
import type { SaleItem } from './sale'
import type { ReportRequest, ReportWindow, ReportingData, SalesReport, ProfitReport, SaleItemCost, ProfitRow } from './reporting'
import { createSalesHistoryQuery } from './salesHistoryQuery'
import { dashboardWindow, localDateKey, summarizeDashboard } from './dashboardRules'

export function sumMoney(values: readonly number[]): number {
  let total = 0n
  for (const value of values) {
    if (!Number.isSafeInteger(value)) throw new ValidationError('Nilai laporan tidak valid.')
    total += BigInt(value)
  }
  if (total > BigInt(Number.MAX_SAFE_INTEGER) || total < BigInt(Number.MIN_SAFE_INTEGER)) throw new ValidationError('Nilai laporan terlalu besar untuk ditampilkan dengan tepat.')
  return Number(total)
}
export function reportWindow(request: ReportRequest, now = new Date()): ReportWindow {
  if (!Number.isFinite(now.getTime()) || !['today', 'week', 'month', 'custom'].includes(request.preset) || !['ALL', 'CASH', 'BON'].includes(request.method ?? 'ALL')) throw new ValidationError('Pilihan periode atau pembayaran tidak valid.')
  const start = new Date(now); start.setHours(0, 0, 0, 0)
  if (request.preset === 'week') start.setDate(start.getDate() - 6)
  if (request.preset === 'month') start.setDate(1)
  const startDate = request.preset === 'custom' ? request.startDate ?? '' : localDateKey(start)
  const endDate = request.preset === 'custom' ? request.endDate ?? '' : localDateKey(now)
  if (!startDate || !endDate) throw new ValidationError('Isi tanggal mulai dan tanggal akhir.')
  const query = createSalesHistoryQuery({ startDate, endDate })
  const day = new Date(query.fromInclusive!), end = new Date(query.toExclusive!), days: string[] = []
  while (day < end) {
    if (days.length >= 366) throw new ValidationError('Pilih rentang maksimal 366 hari. Ekspor beberapa periode untuk rentang lebih panjang.')
    days.push(localDateKey(day)); day.setDate(day.getDate() + 1); day.setHours(0, 0, 0, 0)
  }
  return { startDate, endDate, fromInclusive: query.fromInclusive!, toExclusive: query.toExclusive!, days, method: request.method ?? 'ALL' }
}
export function summarizeReport(data: ReportingData, window: ReportWindow): SalesReport {
  const inPeriod = (date: string) => date >= window.fromInclusive && date < window.toExclusive
  const ids = new Set<string>()
  for (const result of data.period) {
    if (ids.has(result.sale.id) || result.sale.status !== 'COMPLETED' || !inPeriod(result.sale.createdAt)) throw new ValidationError('Data penjualan laporan tidak konsisten.')
    ids.add(result.sale.id)
  }
  const sales = data.period.filter(({ sale }) => window.method === 'ALL' || sale.paymentMethod === window.method)
  const payments = window.method === 'CASH' ? [] : data.payments.filter((payment) => inPeriod(payment.createdAt))
  const paymentIds = new Set<string>()
  for (const payment of payments) { if (paymentIds.has(payment.id)) throw new ValidationError('Pembayaran laporan duplikat.'); paymentIds.add(payment.id) }
  const stock = summarizeDashboard({ ...data, period: [], recent: [] }, dashboardWindow())
  // Reuse the existing snapshot/unit-aware ranking, with the selected calendar days.
  const ranked = summarizeDashboard({ ...data, period: sales, recent: [] }, { ...window, days: window.days })
  const cashSales = sumMoney(sales.filter(({ sale }) => sale.paymentMethod === 'CASH').map(({ sale }) => sale.total))
  const bonSales = sumMoney(sales.filter(({ sale }) => sale.paymentMethod === 'BON').map(({ sale }) => sale.total))
  const creditReceipts = sumMoney(payments.map((payment) => payment.amount))
  return { window, sales: [...sales].reverse(), transactions: sales.length, itemRows: sales.reduce((n, sale) => n + sale.items.length, 0),
    revenue: sumMoney([cashSales, bonSales]), cashSales, bonSales, creditReceipts, moneyReceived: sumMoney([cashSales, creditReceipts]),
    days: window.days.map((date) => { const rows = sales.filter(({ sale }) => localDateKey(new Date(sale.createdAt)) === date); return { date, revenue: sumMoney(rows.map(({ sale }) => sale.total)), transactions: rows.length } }),
    topProducts: ranked.topProducts, lowStock: stock.lowStock, outOfStock: stock.outOfStock, uninitialized: stock.uninitialized,
    receivables: data.receivables, payments, totalBon: sumMoney(data.receivables.map((r) => r.originalAmount)), totalPaid: sumMoney(data.receivables.map((r) => r.totalPaid)), outstanding: sumMoney(data.receivables.map((r) => r.balance)) }
}
export function itemCost(item: SaleItem, product: Pick<Product, 'costKnown' | 'costPrice'>): SaleItemCost {
  if (typeof product.costKnown !== 'boolean' || product.costKnown !== (product.costPrice !== null)) throw new CheckoutError('INTEGRITY_ERROR', 'Status harga modal produk tidak konsisten.')
  const cost = product.costKnown ? product.costPrice : null
  if (cost !== null && (!Number.isSafeInteger(cost) || cost < 0 || cost > 1_000_000_000)) throw new CheckoutError('INTEGRITY_ERROR', 'Harga modal produk tidak valid. Periksa pengaturan produk sebelum menjual.')
  if (product.costKnown && cost === null) throw new CheckoutError('INTEGRITY_ERROR', 'Status harga modal produk tidak konsisten.')
  const totalCost = cost === null ? null : Number((BigInt(item.quantityBase) * BigInt(cost) + 500n) / 1000n)
  if (totalCost !== null && !Number.isSafeInteger(totalCost)) throw new CheckoutError('INTEGRITY_ERROR', 'Total modal melampaui batas angka yang didukung.')
  return { saleItemId: item.id, saleId: item.saleId, costPerBaseUnit: cost, totalCost, policy: 'BASE_HALF_UP_V1' }
}
export function summarizeProfit(report: SalesReport, costs: readonly SaleItemCost[]): ProfitReport {
  const indexed = new Map<string, SaleItemCost>()
  for (const cost of costs) { if (indexed.has(cost.saleItemId)) throw new ValidationError('Catatan harga modal duplikat.'); indexed.set(cost.saleItemId, cost) }
  const rows: ProfitRow[] = report.sales.map(({ sale, items }) => {
    let missingItems = 0
    const known: { revenue: number; cost: number }[] = []
    for (const item of items) {
      const snapshot = indexed.get(item.id)
      if (!snapshot) { missingItems++; continue }
      const expected = itemCost(item, { costKnown: snapshot.costPerBaseUnit !== null, costPrice: snapshot.costPerBaseUnit })
      if (snapshot.saleId !== sale.id || snapshot.policy !== expected.policy || snapshot.totalCost !== expected.totalCost) throw new ValidationError('Catatan harga modal transaksi tidak konsisten.')
      if (snapshot.totalCost === null) missingItems++
      else known.push({ revenue: item.lineTotal, cost: snapshot.totalCost })
    }
    const knownRevenue = sumMoney(known.map((row) => row.revenue)), cost = sumMoney(known.map((row) => row.cost))
    return { saleId: sale.id, receiptNumber: sale.receiptNumber, revenue: sale.total, knownRevenue, cost, profit: sumMoney([knownRevenue, -cost]), missingItems }
  })
  const missingItems = rows.reduce((n, row) => n + row.missingItems, 0)
  return { rows, knownRevenue: sumMoney(rows.map((row) => row.knownRevenue)), cost: sumMoney(rows.map((row) => row.cost)), profit: sumMoney(rows.map((row) => row.profit)), missingItems, complete: missingItems === 0 }
}
