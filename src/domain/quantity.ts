import { QUANTITY_SCALE } from './product'

// Parse decimal text before arithmetic; all stored quantities are scaled integers.
export function parseQuantity(value: string): number | null {
  if (!/^\d+(?:[.,]\d{1,3})?$/.test(value.trim())) return null
  const [whole, fraction = ''] = value.trim().replace(',', '.').split('.')
  const result = Number(whole) * QUANTITY_SCALE + Number(fraction.padEnd(3, '0'))
  return Number.isSafeInteger(result) ? result : null
}
export function quantityInput(value: number) { return (value / QUANTITY_SCALE).toFixed(3).replace(/\.?0+$/, '') || '0' }
export function quantityText(value: number) { return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(value / QUANTITY_SCALE) }
export function parseRupiah(value: string): number | null {
  const text = value.trim()
  if (!/^(?:\d+|[1-9]\d{0,2}(?:\.\d{3})+)$/.test(text)) return null
  const result = Number(text.replaceAll('.', ''))
  return Number.isSafeInteger(result) && result <= 1_000_000_000 ? result : null
}
