import { useSyncExternalStore } from 'react'
import { Link } from 'react-router'
import { pwaRuntime } from './pwaRuntime'
export function PwaStatus() {
  const state = useSyncExternalStore(pwaRuntime.subscribe, pwaRuntime.getSnapshot)
  return <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-5 py-2 text-xs text-ink-muted" aria-label="Status jaringan aplikasi"><p><span className={`mr-2 inline-block size-2 rounded-full ${state.online ? 'bg-success' : 'bg-warning'}`} aria-hidden="true" />{state.online ? 'Terhubung jaringan' : 'Aplikasi sedang offline'} · Data tetap di perangkat. Jaringan bukan tanda cadangan.</p>{state.updateAvailable && <Link className="inline-flex min-h-11 items-center font-semibold text-brand underline" to="/pengaturan?bagian=app">Pembaruan tersedia → Pengaturan</Link>}</div>
}
