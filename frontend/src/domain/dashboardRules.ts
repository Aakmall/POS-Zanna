import { CheckoutError } from './checkout'
import type { DashboardData, DashboardDay, DashboardSnapshot, DashboardStock, DashboardTopProduct, DashboardWindow } from './dashboard'
import { MAX_STOCK_BASE, stockStatus } from './inventoryRules'
import { assertText, assertUnitSnapshot, assertUuid, unitSnapshotKey } from './checkoutValidation'

export function localDateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
export function dashboardWindow(now = new Date()): DashboardWindow {
  if (!Number.isFinite(now.getTime())) throw new CheckoutError('INVALID_REQUEST', 'Tanggal Dashboard tidak valid.')
  const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 6)
  const days = Array.from({ length: 7 }, (_, index) => { const day = new Date(start); day.setDate(day.getDate() + index); return localDateKey(day) })
  const end = new Date(now); end.setDate(end.getDate() + 1); end.setHours(0, 0, 0, 0)
  return { days, fromInclusive: start.toISOString(), toExclusive: end.toISOString() }
}
function add(a: number, b: number) {
  const value = BigInt(a) + BigInt(b)
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new CheckoutError('INTEGRITY_ERROR', 'Agregat Dashboard melampaui presisi angka yang didukung.')
  return Number(value)
}
export function summarizeDashboard(data: DashboardData, window: DashboardWindow): DashboardSnapshot {
  const days: DashboardDay[] = window.days.map((date) => ({ date, revenue: 0, transactions: 0, itemRows: 0 }))
  const top = new Map<string, DashboardTopProduct>()
  for (const { sale, items } of data.period) {
    const day = days.find((entry) => entry.date === localDateKey(new Date(sale.createdAt)))
    if (!day) throw new CheckoutError('INTEGRITY_ERROR', 'Transaksi berada di luar periode Dashboard.')
    day.revenue = add(day.revenue, sale.total); day.transactions++; day.itemRows += items.length
    for (const item of items) {
      const key = JSON.stringify([item.productId, unitSnapshotKey(item.unitSnapshot)])
      const row = top.get(key) ?? { key, name: item.productNameSnapshot, unit: item.unitSnapshot, quantity: 0, revenue: 0, itemRows: 0 }
      row.name = item.productNameSnapshot // Repository visits the period oldest → newest; no current-master lookup.
      row.quantity = add(row.quantity, item.quantity); row.revenue = add(row.revenue, item.lineTotal); row.itemRows++
      top.set(key, row)
    }
  }
  const lowStock: DashboardStock[] = [], outOfStock: DashboardStock[] = []
  let uninitialized = 0
  for (const product of data.products) {
    assertUuid(product.id, 'ID produk'); assertText(product.name, 'Nama produk')
    const balance = data.balances.find((entry) => entry.productId === product.id)
    if (!balance) { uninitialized++; continue }
    if (!Number.isSafeInteger(balance.quantityBase) || balance.quantityBase < 0 || balance.quantityBase > MAX_STOCK_BASE ||
      (product.minimumStock !== null && (!Number.isSafeInteger(product.minimumStock) || product.minimumStock < 0))) throw new CheckoutError('INTEGRITY_ERROR', 'Saldo atau batas stok tidak valid.')
    const unit = data.units.find((entry) => entry.id === product.baseUnitId)
    assertUnitSnapshot(unit)
    const row = { productId: product.id, name: product.name, active: product.isActive, quantityBase: balance.quantityBase, minimumStock: product.minimumStock, unit: unit.name }
    const status = stockStatus(balance, product.minimumStock)
    if (status === 'LOW_STOCK') lowStock.push(row)
    if (status === 'OUT_OF_STOCK') outOfStock.push(row)
  }
  const order = (a: DashboardStock, b: DashboardStock) => a.name.localeCompare(b.name, 'id') || a.productId.localeCompare(b.productId)
  return { today: days[6], days, recent: data.recent, topProducts: [...top.values()].sort((a, b) => b.revenue - a.revenue || a.key.localeCompare(b.key)).slice(0, 5),
    lowStock: lowStock.sort(order), outOfStock: outOfStock.sort(order), uninitialized }
}
