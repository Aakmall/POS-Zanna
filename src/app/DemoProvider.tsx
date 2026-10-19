import { useEffect, useState, type PropsWithChildren } from 'react'
import { demoCatalogRepository } from '../services/catalogRepository'
import type { CartLine, Product } from '../types/pos'
import { DemoContext, type DemoStore } from './demoContext'

export function DemoProvider({ children }: PropsWithChildren) {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartLine[]>([])
  const [status, setStatus] = useState<DemoStore['status']>('loading')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    // Jeda lokal agar state loading DEMO dapat dilihat, tanpa request jaringan.
    const timer = window.setTimeout(() => {
      demoCatalogRepository.list().then((items) => {
        if (active) { setProducts(items); setStatus('ready') }
      }).catch(() => { if (active) setStatus('error') })
    }, 450)
    return () => { active = false; window.clearTimeout(timer) }
  }, [attempt])
  const store: DemoStore = {
    products, cart, setCart, status,
    reload: () => { setStatus('loading'); setAttempt((value) => value + 1) },
    simulateError: () => setStatus('error'),
    saveProduct: (product) => setProducts((items) => items.some((item) => item.id === product.id)
      ? items.map((item) => item.id === product.id ? product : item) : [...items, product]),
    adjustStock: (id, stock) => setProducts((items) => items.map((item) => item.id === id ? { ...item, stock } : item)),
  }
  return <DemoContext.Provider value={store}>{children}</DemoContext.Provider>
}
