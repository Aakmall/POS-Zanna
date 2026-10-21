import { useEffect, useState } from 'react'
import type { StockMovement } from '../domain/inventory'
import { useInventory } from './useInventory'

export function useStockHistory(productId: string) {
  const { service } = useInventory()
  const [records, setRecords] = useState<StockMovement[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => service.subscribeHistory(productId, (result) => { setRecords(result); setStatus('ready'); setError('') },
    (cause) => { setStatus('error'); setError(cause instanceof Error ? cause.message : 'Riwayat tidak dapat dibaca.') }), [service, productId, attempt])
  return { records, status, error, retry: () => { setStatus('loading'); setAttempt((value) => value + 1) } }
}
