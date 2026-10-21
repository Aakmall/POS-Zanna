import { useEffect, useState } from 'react'
import type { CheckoutResult } from '../../domain/checkout'
import type { SalesHistoryError, SalesHistoryReader } from '../../domain/salesHistory'
import { historyReadError } from './useSalesHistory'

interface State { key: string; status: 'loading' | 'ready' | 'error'; result: CheckoutResult | null; error: SalesHistoryError | null }
const empty: State = { key: '', status: 'loading', result: null, error: null }
export function useSaleDetails(saleId: string, service: SalesHistoryReader) {
  const [attempt, setAttempt] = useState(0)
  const key = JSON.stringify([saleId, attempt])
  const [state, setState] = useState<State>(empty)
  useEffect(() => {
    let active = true
    Promise.resolve().then(() => service.getDetail(saleId)).then((result) => {
      if (active) setState({ key, status: 'ready', result, error: null })
    }, (cause: unknown) => { if (active) setState({ key, status: 'error', result: null, error: historyReadError(cause) }) })
    return () => { active = false }
  }, [service, saleId, key])
  return { ...(state.key === key ? state : empty), retry: () => setAttempt((value) => value + 1) }
}
