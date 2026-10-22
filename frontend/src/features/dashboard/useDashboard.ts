import { useEffect, useState } from 'react'
import type { DashboardSnapshot } from '../../domain/dashboard'
import { localDateKey } from '../../domain/dashboardRules'
import { CheckoutError } from '../../domain/checkout'
import type { DashboardService } from '../../services/dashboardOperations'

export function useDashboard(service: DashboardService) {
  const [day, setDay] = useState(() => localDateKey(new Date()))
  const [attempt, setAttempt] = useState(0)
  const key = `${day}:${attempt}`
  const [state, setState] = useState<{ key: string; snapshot: DashboardSnapshot | null; error: string }>({ key: '', snapshot: null, error: '' })
  useEffect(() => {
    const check = () => setDay(localDateKey(new Date()))
    const timer = window.setInterval(check, 30000)
    window.addEventListener('focus', check); document.addEventListener('visibilitychange', check)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check) }
  }, [])
  useEffect(() => service.subscribe(new Date(), (snapshot) => setState({ key, snapshot, error: '' }), (cause) => setState({ key, snapshot: null,
    error: cause instanceof CheckoutError ? cause.message : 'Dashboard tidak dapat dibaca. Periksa penyimpanan perangkat dan coba lagi.' })), [service, key])
  return { snapshot: state.key === key ? state.snapshot : null, error: state.key === key ? state.error : '', retry: () => setAttempt((value) => value + 1) }
}
