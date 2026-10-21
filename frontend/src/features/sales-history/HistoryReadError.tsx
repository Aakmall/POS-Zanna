import { Button } from '../../components/ui/Button'
import type { SalesHistoryError } from '../../domain/salesHistory'

export function HistoryReadError({ error, onRetry, busy = false }: { error: SalesHistoryError; onRetry: () => void; busy?: boolean }) {
  return <div className="mb-5 rounded-panel border border-danger/20 bg-danger-soft p-5">
    <p className="text-sm font-semibold text-danger" role="alert">{error.code === 'INTEGRITY_ERROR' ? 'Data transaksi tidak konsisten' : error.code === 'INVALID_FILTER' ? 'Periksa filter pencarian' : 'Riwayat tidak dapat dibaca'}</p>
    <p className="mt-2 text-sm leading-6 text-danger">{error.message}</p>
    {error.code !== 'INVALID_FILTER' && <Button variant="secondary" className="mt-3" disabled={busy} onClick={onRetry}>Coba lagi</Button>}
  </div>
}
