import { useDemoStore } from '../../hooks/useDemoStore'
import { Button } from './Button'
import { EmptyState } from './EmptyState'

export function CatalogState() {
  const { status, reload } = useDemoStore()
  if (status === 'error') return <div className="panel" role="alert"><EmptyState title="Katalog demo gagal dimuat" description="Ini state error simulasi. Coba muat ulang katalog; perubahan produk sesi akan dikembalikan ke data awal." action={<Button onClick={reload}>Muat ulang katalog demo</Button>} /></div>
  return <div className="panel p-6" role="status"><p className="mb-5 text-sm text-ink-muted">Menyiapkan katalog DEMO…</p><div className="grid grid-cols-2 gap-4 sm:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((id) => <div key={id} className="h-40 rounded-xl bg-surface-muted motion-safe:animate-pulse" />)}</div></div>
}
