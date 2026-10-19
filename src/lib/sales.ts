import type { DemoSale } from '../types/pos'

export function summarizeSales(sales: DemoSale[]) {
  const revenue = sales.reduce((sum, sale) => sum + sale.total, 0)
  const cost = sales.reduce((sum, sale) => sum + sale.cost, 0)
  return { revenue, profit: revenue - cost, count: sales.length, average: sales.length ? Math.round(revenue / sales.length) : 0 }
}
export function groupSalesByDay(sales: DemoSale[]) {
  const days = new Map<string, number>()
  sales.forEach((sale) => days.set(sale.date, (days.get(sale.date) ?? 0) + sale.total))
  return [...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({ date, total }))
}
