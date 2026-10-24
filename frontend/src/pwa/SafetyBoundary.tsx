import { useSyncExternalStore, type PropsWithChildren } from 'react'
import { appSafety } from '../services/appSafety'
import { Button } from '../components/ui/Button'
export function SafetyBoundary({ children }: PropsWithChildren) {
  const state = useSyncExternalStore(appSafety.subscribe, appSafety.getSnapshot)
  const blocked = state.busy || state.reloadRequired
  return <><div inert={blocked}>{children}</div>{blocked && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-canvas/95 p-5"><section className="panel max-w-lg p-6" aria-label="Keamanan data aplikasi"><h2 className="text-lg font-semibold">{state.reloadRequired ? 'Muat ulang aplikasi' : 'Sedang memproses'}</h2><p role="status" className="mt-3 text-sm leading-6 text-ink-muted">{state.message || 'Pemulihan atau pembaruan sedang diproses. Tunggu hingga selesai; jangan menutup aplikasi.'}</p>{state.reloadRequired && <Button className="mt-5" disabled={state.busy} onClick={() => window.location.reload()}>Muat ulang sekarang</Button>}</section></div>}</>
}
