import type { Product } from '../../domain/product'
import { quantityText } from '../../domain/quantity'
import { useDemoStore } from '../../hooks/useDemoStore'
import { StockBadge } from './StockBadge'
import { stockStatus } from '../../domain/inventoryRules'
import { UnitPolicyNotice } from './UnitPolicyNotice'

export function ProductStock({ product }: { product: Product }) {
  const { inventoryBalances, snapshot } = useDemoStore()
  const balance = inventoryBalances.find((item) => item.productId === product.id)
  const unit = snapshot.units.find((item) => item.id === product.baseUnitId)
  return <div><p className="mb-2 text-xs font-semibold">{balance ? `${quantityText(balance.quantityBase)} ${unit?.name ?? ''}` : '—'}</p><StockBadge status={stockStatus(balance, product.minimumStock)} /><UnitPolicyNotice product={product} /></div>
}
