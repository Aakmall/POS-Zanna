import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router'
import { PageErrorBoundary } from '../ui/PageErrorBoundary'

export function PageOutlet() {
  const { pathname } = useLocation()
  return <PageErrorBoundary key={pathname}>
    <Suspense fallback={<div className="panel p-6" role="status" aria-live="polite"><p className="font-semibold">Memuat halaman…</p><p className="mt-2 text-sm text-ink-muted">Menyiapkan tampilan. Menu tetap dapat digunakan.</p></div>}>
      <Outlet />
    </Suspense>
  </PageErrorBoundary>
}
