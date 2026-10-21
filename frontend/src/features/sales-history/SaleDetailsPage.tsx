import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import type { SalesHistoryReader } from '../../domain/salesHistory'
import { salesHistoryService } from '../../services/salesHistoryService'
import { useSaleDetails } from './useSaleDetails'
import { SaleDetails } from './SaleDetails'
import { HistoryReadError } from './HistoryReadError'

export function SaleDetailsPage({ service = salesHistoryService }: { service?: SalesHistoryReader }) {
  const { saleId = '' } = useParams()
  const [params] = useSearchParams()
  const detail = useSaleDetails(saleId, service)
  return <>
    <PageHeader title="Detail Penjualan" description="Struk dari snapshot saat transaksi disimpan. Perubahan master produk tidak mengubah rincian ini." action={<Link className="btn btn-secondary text-xs" to={`/penjualan${params.size ? `?${params.toString()}` : ''}`}><ArrowLeft size={16} aria-hidden="true" />Kembali ke riwayat</Link>} />
    {detail.status === 'loading' && <p role="status" className="panel p-6 text-sm text-ink-muted">Membaca struk tersimpan…</p>}
    {detail.error?.code === 'NOT_FOUND' ? <div className="panel"><EmptyState title="Transaksi tidak ditemukan" description={detail.error.message} /></div> : detail.error && <HistoryReadError error={detail.error} onRetry={detail.retry} />}
    {detail.status === 'ready' && detail.result && <SaleDetails result={detail.result} />}
  </>
}
