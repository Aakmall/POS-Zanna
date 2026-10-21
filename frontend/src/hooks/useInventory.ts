import { useDemoStore } from './useDemoStore'
import { stockStatus } from '../domain/inventoryRules'
import { useMemo } from 'react'

export function useInventory() {
  const { snapshot, inventoryBalances, inventoryService, status, error, reload } = useDemoStore()
  const rows = useMemo(() => snapshot.products.map((product) => {
    const balance = inventoryBalances.find((item) => item.productId === product.id)
    return { product, balance, status: stockStatus(balance, product.minimumStock),
      baseUnit: snapshot.units.find((item) => item.id === product.baseUnitId),
      category: snapshot.categories.find((item) => item.id === product.categoryId) }
  }).sort((a, b) => a.product.name.localeCompare(b.product.name, 'id')), [snapshot, inventoryBalances])
  return { rows, balances: inventoryBalances, service: inventoryService, catalog: snapshot, status, error, reload }
}
