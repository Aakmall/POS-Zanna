import { ArrowUpRight, House, Store } from 'lucide-react'
import { NavLink, Outlet, Link } from 'react-router'
import { Badge } from '../ui/Badge'
import { useEffect } from 'react'

export function AppLayout() {
  useEffect(() => { document.title = 'Zanna-Cell | Sistem Kasir Warung Campuran' }, [])
  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <a href="#konten-utama" className="skip-link">Lewati ke konten utama</a>
      <aside className="flex flex-col border-b border-line bg-surface px-5 py-5 lg:sticky lg:top-0 lg:h-svh lg:border-r lg:border-b-0 lg:px-6 lg:py-8">
        <NavLink to="/" aria-label="Zanna-Cell, halaman awal" className="flex min-h-12 items-center gap-3 rounded-control">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-navy text-white">
            <Store size={23} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-lg font-bold tracking-tight text-ink">Zanna<span className="text-brand">-Cell</span></span>
            <span className="block text-xs text-ink-muted">Ruang usaha Anda</span>
          </span>
        </NavLink>
        <nav aria-label="Navigasi utama" className="mt-6 lg:mt-12">
          <p className="mb-3 hidden pl-3 text-[10px] font-bold tracking-[0.18em] text-ink-muted uppercase lg:block">Ruang kerja</p>
          <NavLink
            to="/"
            end
            className={({ isActive }) => `flex min-h-12 items-center gap-3 rounded-control px-3 text-sm font-semibold transition-colors ${isActive ? 'bg-brand-soft text-brand' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'}`}
          >
            <House size={19} aria-hidden="true" /> Beranda
          </NavLink>
        </nav>
        <Link to="/kasir" className="btn btn-primary mt-3">Buka kasir DEMO</Link>
        <div className="mt-auto hidden border-t border-line pt-5 lg:block">
          <p className="text-xs font-semibold text-ink">Dibangun selangkah demi selangkah.</p>
          <p className="mt-2 text-xs leading-5 text-ink-muted">Fondasi yang sederhana untuk kebutuhan warung sehari-hari.</p>
          <span className="mt-5 block text-[10px] font-medium tracking-widest text-ink-muted uppercase">POS-Zanna · Fase 3</span>
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-5 py-4 sm:px-8 xl:px-12">
          <p className="text-sm font-medium text-ink-muted">Sistem Kasir Warung Campuran</p>
          <Badge>Master lokal / Kasir DEMO</Badge>
        </header>
        <main id="konten-utama" tabIndex={-1} className="mx-auto w-full max-w-[1320px] flex-1 px-5 py-8 outline-none sm:px-8 sm:py-10 xl:px-12 xl:py-12">
          <Outlet />
        </main>
        <footer className="mx-5 flex flex-wrap items-center justify-between gap-2 border-t border-line py-5 text-xs text-ink-muted sm:mx-8 xl:mx-12">
          <p>Zanna-Cell <span aria-hidden="true" className="px-2">/</span> Bertumbuh bersama usaha Anda.</p>
          <span className="inline-flex items-center gap-1">Langkah awal yang baik <ArrowUpRight size={14} aria-hidden="true" /></span>
        </footer>
      </div>
    </div>
  )
}
