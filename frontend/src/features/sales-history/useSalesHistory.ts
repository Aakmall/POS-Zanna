import { useEffect, useMemo, useRef, useState } from 'react'
import type { Sale } from '../../domain/sale'
import { SalesHistoryError, type SalesHistoryCursor, type SalesHistoryFilters, type SalesHistoryReader } from '../../domain/salesHistory'

interface State {
  key: string; status: 'loading' | 'ready' | 'error'; sales: readonly Sale[]
  nextCursor: SalesHistoryCursor | null; loadingMore: boolean; error: SalesHistoryError | null
}
const empty: State = { key: '', status: 'loading', sales: [], nextCursor: null, loadingMore: false, error: null }
export function historyReadError(cause: unknown) {
  return cause instanceof SalesHistoryError ? cause : new SalesHistoryError('STORAGE_ERROR', 'Riwayat belum dapat dibaca dari penyimpanan perangkat. Coba lagi tanpa menghapus data browser.')
}
export function useSalesHistory(filters: SalesHistoryFilters, service: SalesHistoryReader) {
  const { receipt, startDate, endDate } = filters
  const request = useMemo(() => ({ receipt, startDate, endDate }), [receipt, startDate, endDate])
  const [attempt, setAttempt] = useState(0)
  const key = JSON.stringify([request, attempt])
  const [state, setState] = useState<State>(empty)
  const epoch = useRef<{ active: boolean } | null>(null), moreBusy = useRef(false)
  const loadedCursor = useRef<SalesHistoryCursor | null>(null)
  useEffect(() => {
    let active = true
    const generation = { active: true }
    epoch.current = generation; moreBusy.current = false; loadedCursor.current = null
    Promise.resolve().then(() => service.list(request)).then((page) => {
      if (active) setState({ key, status: 'ready', sales: page.sales, nextCursor: page.nextCursor, loadingMore: false, error: null })
    }, (cause: unknown) => { if (active) setState({ ...empty, key, status: 'error', error: historyReadError(cause) }) })
    return () => { active = false; generation.active = false }
  }, [service, request, key])
  async function loadMore() {
    if (moreBusy.current || state.key !== key || !state.nextCursor || loadedCursor.current === state.nextCursor || !epoch.current?.active) return
    moreBusy.current = true
    const currentEpoch = epoch.current
    setState((previous) => ({ ...previous, loadingMore: true, error: null }))
    try {
      const page = await service.list({ ...request, cursor: state.nextCursor })
      if (currentEpoch.active) {
        loadedCursor.current = state.nextCursor // Guard clicks before the new cursor has rendered.
        setState((previous) => ({ ...previous, sales: [...previous.sales, ...page.sales], nextCursor: page.nextCursor, loadingMore: false }))
      }
    } catch (cause) { if (currentEpoch.active) setState((previous) => ({ ...previous, loadingMore: false, error: historyReadError(cause) })) }
    finally { if (currentEpoch.active) moreBusy.current = false }
  }
  return { ...(state.key === key ? state : empty), loadMore, retry: () => setAttempt((value) => value + 1) }
}
