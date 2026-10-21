import type { StockStatus } from '../../domain/inventory'
import { stockStatusLabels } from '../../domain/inventoryRules'

export function StockBadge({ status }: { status: StockStatus }) {
  const tone = status === 'NOT_INITIALIZED' ? 'bg-surface-muted text-ink-muted' : status === 'OUT_OF_STOCK' ? 'bg-danger-soft text-danger' : status === 'LOW_STOCK' ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success'
  return <span className={`pill ${tone}`}>{stockStatusLabels[status]}</span>
}
