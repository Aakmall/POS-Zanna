import { userError } from '../../lib/userError'
import { useEffect, useState } from 'react'
import type { CreditOverview, ReceivableDetail } from '../../domain/credit'
import type { CreditService } from '../../services/creditOperations'

export function useCreditOverview(service: CreditService) {
  const [data, setData] = useState<CreditOverview | null>(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0)
  useEffect(() => service.subscribe((next) => { setData(next); setError('') }, (cause) => { setData(null); setError(userError(cause, 'Bon belum dapat dibaca. Coba lagi tanpa menghapus data browser.')) }), [service, attempt])
  return { data, error, retry: () => { setData(null); setError(''); setAttempt((value) => value + 1) } }
}
export function useReceivableDetail(id: string, service: CreditService) {
  const [data, setData] = useState<ReceivableDetail | null>(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    service.detail(id).then((next) => { if (active) { setData(next); setError('') } }).catch((cause: unknown) => { if (active) { setData(null); setError(userError(cause, 'Tagihan belum dapat dibaca. Tutup dan buka kembali, atau coba lagi.')) } })
    return () => { active = false }
  }, [id, service, attempt])
  return { data, error, retry: () => { setData(null); setError(''); setAttempt((value) => value + 1) } }
}
