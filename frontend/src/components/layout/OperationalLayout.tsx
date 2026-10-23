import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { Bell, ChevronLeft, ChevronRight, FlaskConical, Menu, Search, ShoppingBag } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { navigation } from '../../app/navigation'
import { DemoProvider } from '../../app/DemoProvider'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'

const pageDescriptions: Record<string, string> = {
  '/dashboard': 'Lihat ringkasan dan aktivitas warung Anda.',
  '/kasir': 'Pilih produk dan layani belanja dengan lebih mudah.',
  '/produk': 'Semua kebutuhan warung, dalam satu katalog.',
  '/stok': 'Persediaan yang tertata untuk usaha sehari-hari.',
  '/penjualan': 'Riwayat transaksi tunai dan struk tersimpan di perangkat ini.',
  '/bon': 'Rincian pelanggan dan bon dalam satu tempat.',
  '/laporan': 'Kenali irama penjualan dari data contoh.',
  '/pengaturan': 'Sesuaikan ruang kerja warung Anda.',
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Navigasi operasional" className="space-y-1.5">
      {navigation.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} onClick={onNavigate} aria-label={label} title={label}
          className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}>
          <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
          <span className="sidebar-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export function OperationalLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [search, setSearch] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const main = useRef<HTMLElement>(null)
  const previousPath = useRef(location.pathname)
  const current = navigation.find((item) => item.to === location.pathname || (item.to === '/penjualan' && location.pathname.startsWith('/penjualan/')))

  useEffect(() => {
    document.title = `${current?.label ?? 'Halaman tidak ditemukan'} | Zanna-Cell`
    if (previousPath.current !== location.pathname) {
      main.current?.focus()
      window.scrollTo(0, 0)
      previousPath.current = location.pathname
    }
  }, [current, location.pathname])

  function searchProducts(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    navigate(`/kasir${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''}`)
  }

  return (
    <DemoProvider catalogEnabled={!(location.pathname === '/bon' || location.pathname === '/dashboard' || location.pathname === '/penjualan' || location.pathname.startsWith('/penjualan/'))}>
      <div className={`operational-shell ${collapsed ? 'is-collapsed' : ''}`}>
        <a href="#operasional" className="skip-link">Lewati ke konten utama</a>
        <aside className="operational-sidebar">
          <Link to="/" className="sidebar-brand" aria-label="Zanna-Cell, halaman welcome" title="Zanna-Cell">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/30"><ShoppingBag size={24} strokeWidth={1.6} aria-hidden="true" /></span>
            <span className="sidebar-label text-xl font-semibold tracking-tight">Zanna-Cell<span className="mt-1 block text-[10px] font-normal tracking-widest text-sidebar-muted uppercase">Ruang usaha Anda</span></span>
          </Link>
          <Navigation />
          <div className="mt-auto pt-8">
            <div className="sidebar-demo mb-4 rounded-xl border border-white/25 p-3.5">
              <FlaskConical size={20} className="mb-2" aria-hidden="true" />
              <p className="text-xs font-semibold">Tunai &amp; Bon · IndexedDB</p>
              <p className="mt-1.5 text-[11px] leading-5 text-sidebar-muted">Penjualan, pelanggan, cicilan dan stok tersimpan di perangkat ini. Dashboard nyata. Laporan masih DEMO.</p>
            </div>
            <div className="sidebar-user flex items-center gap-3 rounded-xl bg-black/10 p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/90 text-xs font-bold text-brand" aria-hidden="true">OD</span>
              <div className="sidebar-label min-w-0"><p className="text-xs font-semibold">Operator Demo</p><p className="mt-1 text-[10px] text-sidebar-muted">Pemilik · akun ilustrasi</p></div>
            </div>
          </div>
          <button type="button" onClick={() => setCollapsed((value) => !value)} className="sidebar-collapse"
            aria-label={collapsed ? 'Perluas sidebar' : 'Ringkas sidebar'} aria-expanded={!collapsed}>
            {collapsed ? <ChevronRight size={17} aria-hidden="true" /> : <><ChevronLeft size={17} aria-hidden="true" /><span className="sidebar-label text-xs">Ringkas menu</span></>}
          </button>
        </aside>

        <div className="operational-content min-w-0">
          <header className="operational-topbar">
            <div className="flex min-w-0 items-center gap-3">
              <Button variant="ghost" className="shrink-0 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Buka navigasi" aria-expanded={menuOpen}><Menu size={21} aria-hidden="true" /></Button>
              <div className="min-w-0"><p className="text-base font-semibold tracking-tight text-ink sm:text-lg">{location.pathname === '/dashboard' ? 'Selamat datang, Operator' : current?.label ?? 'Halaman tidak ditemukan'}</p><p className="mt-1 hidden text-xs leading-5 text-ink-muted sm:block">{pageDescriptions[location.pathname] ?? 'Kembali ke ruang kerja Zanna-Cell.'}</p></div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-4">
              <form onSubmit={searchProducts} role="search" className="topbar-search relative hidden xl:block">
                <label htmlFor="workspace-search" className="sr-only">Cari produk di kasir</label>
                <Search size={17} className="pointer-events-none absolute top-3.5 left-3 text-ink-muted" aria-hidden="true" />
                <input id="workspace-search" className="field w-60 bg-surface pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari produk di kasir…" />
              </form>
              <span className="pill border border-brand/15 bg-brand-soft text-brand">POS LOKAL</span>
              <span title="Notifikasi belum tersedia"><button type="button" disabled className="flex size-11 cursor-not-allowed items-center justify-center rounded-xl text-ink-muted opacity-50" aria-label="Notifikasi belum tersedia"><Bell size={21} strokeWidth={1.7} aria-hidden="true" /></button></span>
              <div className="hidden items-center gap-2 border-l border-line pl-4 sm:flex"><span className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand" aria-hidden="true">OD</span><span className="hidden text-xs font-medium text-ink 2xl:block">Operator Demo</span></div>
            </div>
          </header>
          <main ref={main} id="operasional" tabIndex={-1} className="operational-main">
            <Outlet />
          </main>
          <footer className="operational-footer"><span>Zanna-Cell <span aria-hidden="true">·</span> POS-Zanna / Fase 5</span><span>Tunai &amp; Bon IndexedDB · Laporan DEMO</span></footer>
        </div>

        <nav aria-label="Navigasi cepat" className="mobile-nav fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-line bg-surface px-2 pt-2 lg:hidden">
          {navigation.slice(0, 3).map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `flex min-h-14 min-w-16 flex-col items-center justify-center gap-1 rounded-xl px-3 text-[11px] font-semibold ${isActive ? 'bg-brand-soft text-brand' : 'text-ink-muted'}`}><Icon size={21} strokeWidth={1.7} aria-hidden="true" />{label}</NavLink>)}
          <Button variant="ghost" onClick={() => setMenuOpen(true)} aria-label="Buka semua menu" aria-haspopup="dialog" aria-expanded={menuOpen} className={`flex-col gap-1 text-[11px] ${navigation.slice(3).some((item) => item.to === location.pathname) ? 'bg-brand-soft text-brand' : ''}`}><Menu size={21} aria-hidden="true" />Menu</Button>
        </nav>
        {menuOpen && <Dialog title="Menu Zanna-Cell" onClose={() => setMenuOpen(false)}><div className="mobile-menu rounded-panel bg-sidebar p-3"><Navigation onNavigate={() => setMenuOpen(false)} /></div><Link to="/" onClick={() => setMenuOpen(false)} className="mt-4 inline-flex min-h-12 items-center text-sm font-semibold text-brand">Kembali ke halaman welcome</Link></Dialog>}
      </div>
    </DemoProvider>
  )
}
