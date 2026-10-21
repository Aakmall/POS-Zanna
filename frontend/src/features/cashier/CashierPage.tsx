import { useEffect, useRef, useState } from 'react'
import { ScanLine, Search, ShoppingBag } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { Link } from 'react-router'
import { createPortal } from 'react-dom'
import { CASHIER_MEDIA, useWideCashier } from '../../hooks/useWideCashier'
import { type PaymentMethod, type CatalogItem } from '../../types/pos'
import { useDemoStore } from '../../hooks/useDemoStore'
import { money } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { CatalogState } from '../../components/ui/CatalogState'
import { Dialog } from '../../components/ui/Dialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { CartPanel } from './CartPanel'
import { ProductCard } from './ProductCard'
import { PaymentDialog } from './PaymentDialog'
import { useCart } from './useCart'

export function CashierPage() {
  const { products, snapshot, status, simulateError } = useDemoStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const [category, setCategory] = useState('Semua')
  const categories = snapshot.categories.filter((item) => item.isActive).map((item) => item.name)
  const [drawer, setDrawer] = useState(false)
  const wide = useWideCashier()
  const [scanner, setScanner] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('Tunai')
  const [payment, setPayment] = useState<PaymentMethod | null>(null)
  const [feedback, setFeedback] = useState('Pilih produk untuk mulai menyusun belanja.')
  const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null)
  const feedbackTimer = useRef<number | undefined>(undefined)
  const cart = useCart(products)
  const quote = { ...cart.quote, valid: cart.quote.valid && status === 'ready' }
  const filtered = products.filter((product) => product.isActive !== false && `${product.name} ${product.sku} ${product.barcode ?? ''}`.toLocaleLowerCase('id').includes(query.trim().toLocaleLowerCase('id')) && (category === 'Semua' || category === product.category))

  useEffect(() => () => window.clearTimeout(feedbackTimer.current), [])
  useEffect(() => {
    const media = window.matchMedia(CASHIER_MEDIA)
    const closeOnWide = () => { if (media.matches) setDrawer(false) }
    media.addEventListener('change', closeOnWide)
    return () => media.removeEventListener('change', closeOnWide)
  }, [])

  function updateQuery(value: string) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      if (value) next.set('q', value)
      else next.delete('q')
      return next
    }, { replace: true })
  }

  function addProduct(product: CatalogItem) {
    if (!cart.canAdd(product)) { setFeedback('Stok belum diatur, tidak cukup, atau varian belum dapat dibeli. Periksa halaman Stok dan keranjang.'); return }
    cart.add(product)
    setRecentlyAdded(product.id)
    setFeedback(`${product.name} ditambahkan ke keranjang DEMO.${!wide ? ' Ketuk Keranjang & Bayar untuk melihat belanja dan melakukan pembayaran simulasi.' : ''}`)
    window.clearTimeout(feedbackTimer.current)
    feedbackTimer.current = window.setTimeout(() => setRecentlyAdded(null), 1000)
  }

  const panel = (
    <CartPanel quote={quote} method={selectedMethod} onMethodChange={setSelectedMethod} canIncrease={cart.canAdd}
      onChange={(product, quantity) => { cart.change(product, quantity); setFeedback(quantity === 0 ? `${product.name} dihapus dari keranjang.` : `Jumlah ${product.name} diperbarui.`) }}
      onRemove={(id) => { cart.remove(id); setFeedback('Produk dihapus dari keranjang DEMO.') }}
      onClear={() => { cart.clear(); setRecentlyAdded(null); setFeedback('Keranjang DEMO telah dikosongkan.') }}
      onPay={() => { setDrawer(false); setPayment(selectedMethod) }} />
  )

  return (
    <>
      <h1 className="sr-only">Kasir Zanna-Cell — simulasi DEMO</h1>
      <div className="cashier-layout">
        {wide && <div className="cashier-cart-desktop">{panel}</div>}
        <section aria-labelledby="catalog-title" className="panel catalog-panel">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div><h2 id="catalog-title" className="font-semibold">Katalog produk</h2><p className="mt-1 text-xs text-ink-muted">Kebutuhan warung, tinggal pilih.</p></div>
            <div className="flex flex-wrap gap-2">
              {!wide && <Button aria-label="Buka keranjang dan pembayaran" aria-haspopup="dialog" aria-expanded={drawer} onClick={() => setDrawer(true)} className="px-3 text-xs"><ShoppingBag size={18} aria-hidden="true" />Keranjang &amp; Bayar ({cart.quote.itemCount})</Button>}
              <Button variant="secondary" onClick={() => setScanner(true)} className="px-3 text-xs"><ScanLine size={18} strokeWidth={1.7} aria-hidden="true" />Scan barcode</Button>
            </div>
          </div>
          <label htmlFor="product-search" className="sr-only">Cari nama produk</label>
          <div className="relative mb-4"><Search size={18} className="pointer-events-none absolute top-4 left-3.5 text-ink-muted" aria-hidden="true" /><input id="product-search" className="field bg-canvas pl-11" placeholder="Cari nama produk…" value={query} onChange={(event) => updateQuery(event.target.value)} /></div>
          <div className="category-chips" role="group" aria-label="Filter kategori">
            {(['Semua', ...categories] as const).map((item) => <button type="button" key={item} onClick={() => setCategory(item)} aria-pressed={category === item} className={`category-chip ${category === item ? 'category-chip-active' : ''}`}>{item}</button>)}
          </div>
          <div className="my-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-muted"><span>{status === 'ready' ? `${filtered.length} varian` : 'Katalog'} · Master lokal / Kasir DEMO</span><span>Ilustrasi kategori</span></div>
          {status !== 'ready' ? <CatalogState /> : !filtered.length ? <EmptyState title="Belum ada varian aktif yang cocok" description="Tambahkan produk lokal, aktifkan varian, atau ubah pencarian dan kategori." action={<div className="flex flex-wrap justify-center gap-2"><Link className="btn btn-primary" to="/produk">Kelola produk</Link><Button variant="secondary" onClick={() => { updateQuery(''); setCategory('Semua') }}>Reset pencarian</Button></div>} /> : (
            <div className="product-grid">
              {filtered.map((product) => <ProductCard key={product.id} product={product} quantity={cart.cart.find((line) => line.variantId === product.id)?.quantity ?? 0} canAdd={cart.canAdd(product)} justAdded={recentlyAdded === product.id} onAdd={() => addProduct(product)} />)}
            </div>
          )}
          <p role="status" aria-live="polite" aria-atomic="true" className="mt-4 rounded-lg bg-brand-soft px-3 py-2.5 text-xs leading-5 text-brand">{feedback}</p>
          <p className="mt-4 text-[11px] leading-5 text-ink-muted">Master dan stok dibaca dari IndexedDB. Kasir tetap DEMO, tanpa transaksi tersimpan atau perubahan stok. <Link to="/stok" className="font-semibold text-brand underline">Atur stok awal di halaman Stok</Link> sebelum menambah produk. Varian tanpa harga/jumlah aktual belum dapat dibeli.</p>
          <details className="mt-4 border-t border-line pt-3 text-xs text-ink-muted"><summary className="min-h-11 cursor-pointer py-3 font-medium">Skenario simulasi</summary><p className="mb-3 leading-5">Coba tampilan gagal dimuat. Baca ulang tidak mengubah atau menghapus master lokal.</p><Button variant="secondary" className="text-xs" onClick={simulateError} disabled={status !== 'ready'}>Coba state error</Button></details>
        </section>
      </div>
      {!wide && createPortal(<div className="cart-launcher"><Button aria-haspopup="dialog" aria-expanded={drawer} className="w-full justify-between gap-3 shadow-panel" onClick={() => setDrawer(true)}><span className="inline-flex items-center gap-2"><ShoppingBag size={19} className="shrink-0" aria-hidden="true" /><span className="text-left"><span className="block text-sm">Keranjang &amp; Bayar ({cart.quote.itemCount})</span><span className="mt-0.5 block text-[11px] font-normal">{cart.quote.itemCount ? 'Ketuk untuk rincian dan pembayaran' : 'Tambahkan produk untuk mulai belanja'}</span></span></span><span className="shrink-0 text-sm tabular-nums">{money(cart.quote.total)}</span></Button></div>, document.body)}
      <div className="h-20 lg:hidden" />
      {!wide && drawer && <Dialog title="Keranjang & Pembayaran" sheet onClose={() => setDrawer(false)}>{panel}</Dialog>}
      {scanner && <Dialog title="Scan barcode belum tersedia" onClose={() => setScanner(false)}><ScanLine size={40} className="mb-4 text-brand" aria-hidden="true" /><p className="text-sm leading-6 text-ink-muted">Kamera dan pemindai barcode belum diimplementasikan. Gunakan pencarian nama produk untuk simulasi.</p><Button className="mt-6 w-full" onClick={() => setScanner(false)}>Mengerti</Button></Dialog>}
      {payment && <PaymentDialog method={payment} quote={quote} onClose={() => setPayment(null)} onComplete={() => { cart.clear(); setPayment(null); setFeedback('Simulasi pembayaran selesai. Keranjang siap untuk belanja berikutnya.') }} />}
    </>
  )
}
