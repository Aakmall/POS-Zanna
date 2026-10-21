import { useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { productRepository } from '../services/productRepository'
import { projectCatalog } from '../services/catalogRepository'
import type { CartLine } from '../types/pos'
import type { CatalogSnapshot } from '../domain/product'
import type { ProductRepository } from '../domain/productRepository'
import { DemoContext, type DemoStore } from './demoContext'
import { inventoryService as defaultInventoryService } from '../services/inventoryService'
import type { InventoryService } from '../services/inventoryOperations'
import type { InventoryBalance } from '../domain/inventory'

const empty: CatalogSnapshot = { products: [], categories: [], units: [], variants: [] }
export function DemoProvider({ children, repository = productRepository, inventory = defaultInventoryService }: PropsWithChildren<{ repository?: ProductRepository; inventory?: InventoryService }>) {
  const [snapshot, setSnapshot] = useState<CatalogSnapshot>(empty)
  const [cart, setCart] = useState<CartLine[]>([])
  const [status, setStatus] = useState<DemoStore['status']>('loading')
  const [error, setError] = useState('')
  const [balances, setBalances] = useState<InventoryBalance[]>([])
  const [balanceStatus, setBalanceStatus] = useState<DemoStore['status']>('loading')
  const [balanceError, setBalanceError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    let unsubscribeBalances: (() => void) | undefined
    const fail = (cause: unknown) => { if (active) { setStatus('error'); setError(cause instanceof Error ? cause.message : 'Penyimpanan browser tidak dapat dibuka.') } }
    repository.initialize().then(() => {
      if (!active) return
      unsubscribe = repository.subscribe((result) => {
        if (active) { setSnapshot(result); setStatus('ready'); setError('') }
      }, fail)
      unsubscribeBalances = inventory.subscribeBalances((result) => {
        if (active) { setBalances(result); setBalanceStatus('ready'); setBalanceError('') }
      }, (cause) => { if (active) { setBalanceStatus('error'); setBalanceError(cause instanceof Error ? cause.message : 'Saldo persediaan gagal dibaca.') } })
    }).catch(fail)
    return () => { active = false; unsubscribe?.(); unsubscribeBalances?.() }
  }, [repository, inventory, attempt])
  const combinedStatus = status === 'error' || balanceStatus === 'error' ? 'error' : status === 'ready' && balanceStatus === 'ready' ? 'ready' : 'loading'
  const products = useMemo(() => projectCatalog(snapshot, balances), [snapshot, balances])
  const store: DemoStore = {
    snapshot, repository, inventoryBalances: balances, inventoryService: inventory,
    products, cart, setCart, status: combinedStatus, error: error || balanceError,
    reload: () => { setStatus('loading'); setBalanceStatus('loading'); setAttempt((value) => value + 1) },
    simulateError: () => { setStatus('error'); setError('Ini error tampilan simulasi. Data IndexedDB tidak diubah.') },
  }
  return <DemoContext.Provider value={store}>{children}</DemoContext.Provider>
}
