import { userError } from '../../lib/userError'
import { useEffect, useState } from 'react'
import type { ProfitReport, ReportRequest, SalesReport } from '../../domain/reporting'
import { localDateKey } from '../../domain/dashboardRules'
import type { ReportingService } from '../../services/reportingOperations'

export function useReport(service: ReportingService, request: ReportRequest) {
  const [day, setDay] = useState(() => localDateKey(new Date())), [attempt, setAttempt] = useState(0)
  const filterKey = JSON.stringify(request), key = `${filterKey}:${day}:${attempt}`
  const [state, setState] = useState<{ key: string; report: SalesReport | null; error: string }>({ key: '', report: null, error: '' })
  useEffect(() => {
    const check = () => setDay(localDateKey(new Date())), timer = window.setInterval(check, 30000)
    window.addEventListener('focus', check)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', check) }
  }, [])
  useEffect(() => {
    let active = true, unsubscribe: (() => void) | undefined
    const fail = (cause: unknown) => { if (active) setState({ key, report: null, error: userError(cause, 'Laporan belum dapat dibaca. Coba lagi tanpa menghapus data perangkat.') }) }
    try { unsubscribe = service.subscribe(JSON.parse(filterKey) as ReportRequest, new Date(), (report) => { if (active) setState({ key, report, error: '' }) }, fail) }
    catch (cause) { fail(cause) }
    return () => { active = false; unsubscribe?.() }
  }, [service, key, filterKey])
  return { report: state.key === key ? state.report : null, error: state.key === key ? state.error : '', retry: () => setAttempt((n) => n + 1) }
}
export function useProfit(service: ReportingService, report: SalesReport | null) {
  const [state, setState] = useState<{ report: SalesReport; profit: ProfitReport | null; error: string } | null>(null)
  useEffect(() => {
    if (!report) return
    let active = true
    service.profit(report).then((profit) => { if (active) setState({ report, profit, error: '' }) }).catch((cause: unknown) => { if (active) setState({ report, profit: null, error: userError(cause, 'Harga modal belum dapat dibaca. Coba baca ulang laporan; laba tidak dihitung dari data yang belum tersedia.') }) })
    return () => { active = false }
  }, [report, service])
  return { profit: state?.report === report ? state?.profit ?? null : null, error: state?.report === report ? state?.error ?? '' : '' }
}
