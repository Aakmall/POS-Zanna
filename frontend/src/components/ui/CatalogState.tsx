import { useDemoStore } from '../../hooks/useDemoStore'
import { Button } from './Button'
import { EmptyState } from './EmptyState'

export function CatalogState() {
  const { status, reload, error } = useDemoStore()
  if (status === 'error') return <div className="panel" role="alert"><EmptyState title="Data lokal gagal dimuat" description={`${error} Periksa izin penyimpanan browser. Muat ulang tidak menghapus data.`} action={<Button onClick={reload}>Coba baca ulang</Button>} /></div>
  return <div className="panel p-6" role="status"><p className="mb-5 text-sm text-ink-muted">Membaca katalog IndexedDB…</p><div className="grid grid-cols-2 gap-4 sm:grid-cols-3">{[1, 2, 3].map((id) => <div key={id} className="h-40 rounded-xl bg-surface-muted motion-safe:animate-pulse" />)}</div></div>
}
