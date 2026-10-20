import { useEffect, useState, type PropsWithChildren } from 'react'
import { productRepository } from '../services/productRepository'
import { projectCatalog } from '../services/catalogRepository'
import type { CartLine } from '../types/pos'
import type { CatalogSnapshot } from '../domain/product'
import type { ProductRepository } from '../domain/productRepository'
import { DemoContext, type DemoStore } from './demoContext'

const empty: CatalogSnapshot = { products: [], categories: [], units: [], variants: [] }
export function DemoProvider({ children, repository = productRepository }: PropsWithChildren<{ repository?: ProductRepository }>) {
  const [snapshot, setSnapshot] = useState<CatalogSnapshot>(empty)
  const [cart, setCart] = useState<CartLine[]>([])
  const [status, setStatus] = useState<DemoStore['status']>('loading')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    const fail = (cause: unknown) => { if (active) { setStatus('error'); setError(cause instanceof Error ? cause.message : 'Penyimpanan browser tidak dapat dibuka.') } }
    repository.initialize().then(() => {
      if (!active) return
      unsubscribe = repository.subscribe((result) => {
        if (active) { setSnapshot(result); setStatus('ready'); setError('') }
      }, fail)
    }).catch(fail)
    return () => { active = false; unsubscribe?.() }
  }, [repository, attempt])
  const store: DemoStore = {
    snapshot, repository, products: projectCatalog(snapshot), cart, setCart, status, error,
    reload: () => { setStatus('loading'); setAttempt((value) => value + 1) },
    simulateError: () => { setStatus('error'); setError('Ini error tampilan simulasi. Data IndexedDB tidak diubah.') },
  }
  return <DemoContext.Provider value={store}>{children}</DemoContext.Provider>
}
