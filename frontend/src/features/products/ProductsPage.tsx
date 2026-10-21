import { useState } from 'react'
import { Eye, Pencil, Plus, Power, Tags } from 'lucide-react'
import { useDemoStore } from '../../hooks/useDemoStore'
import type { Product } from '../../domain/product'
import { money } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { CatalogState } from '../../components/ui/CatalogState'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProductForm } from './ProductForm'
import { CategoryManager } from './CategoryManager'
import { ProductDetails } from './ProductDetails'
import { ProductStock } from '../../components/ui/ProductStock'

export function ProductsPage() {
  const { snapshot, status, repository } = useDemoStore()
  const [query, setQuery] = useState(''), [category, setCategory] = useState('all'), [filterStatus, setFilterStatus] = useState('all')
  const [editor, setEditor] = useState<{ product: Product | null } | null>(null)
  const [details, setDetails] = useState<Product | null>(null)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [confirm, setConfirm] = useState<Product | 'seed' | null>(null)
  const [notice, setNotice] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const needle = query.trim().toLocaleLowerCase('id')
  const products = snapshot.products.filter((product) => {
    const variants = snapshot.variants.filter((item) => item.productId === product.id)
    const matches = [product.name, ...variants.flatMap((item) => [item.sku ?? '', item.barcode ?? ''])].some((value) => value.toLocaleLowerCase('id').includes(needle))
    return matches && (category === 'all' || category === product.categoryId) && (filterStatus === 'all' || product.isActive === (filterStatus === 'active'))
  }).sort((a, b) => a.name.localeCompare(b.name, 'id'))

  async function performConfirmed() {
    if (!confirm) return
    setBusy(true); setError('')
    try {
      if (confirm === 'seed') { const count = await repository.seedDemo(); setNotice(`${count} produk DEMO baru ditambahkan. Data yang sudah ada tidak ditimpa.`) }
      else { await repository.setProductActive(confirm.id, !confirm.isActive, confirm.updatedAt); setNotice(`${confirm.name} ${confirm.isActive ? 'dinonaktifkan' : 'diaktifkan'} di perangkat ini.`) }
      setConfirm(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Data tidak berhasil disimpan.') }
    finally { setBusy(false) }
  }

  return <>
    <PageHeader title="Produk" description="Master produk tersimpan di browser ini melalui IndexedDB. Transaksi dan pembayaran tetap DEMO."
      action={<div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={status !== 'ready'} onClick={() => setCategoriesOpen(true)}><Tags size={17} aria-hidden="true" />Kategori</Button><Button disabled={status !== 'ready'} onClick={() => setEditor({ product: null })}><Plus size={17} aria-hidden="true" />Tambah produk</Button></div>} />
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-panel border border-brand/15 bg-brand-soft p-4 text-xs leading-5 text-brand"><p>Data lokal nyata · Tidak otomatis menjadi transaksi · Bukan backup permanen</p><Button variant="secondary" className="text-xs" disabled={status !== 'ready'} onClick={() => { setError(''); setConfirm('seed') }}>Isi Data Demo</Button></div>
    {notice && <p role="status" className="mb-4 rounded-xl bg-success-soft p-4 text-sm text-success">{notice}</p>}
    {status !== 'ready' ? <CatalogState /> : <>
      <div className="panel mb-5 grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <label><span className="sr-only">Cari nama, SKU, atau barcode</span><input className="field" placeholder="Cari nama, SKU, atau barcode…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label><span className="sr-only">Filter kategori</span><select className="field" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Semua kategori</option>{snapshot.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label><span className="sr-only">Filter status</span><select className="field" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}><option value="all">Semua status</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select></label>
      </div>
      {!products.length ? <div className="panel"><EmptyState title={snapshot.products.length ? 'Tidak ada produk yang cocok' : 'Mulai katalog warung Anda'} description="Tambahkan kategori dan produk sendiri, atau isi data DEMO secara eksplisit untuk mencoba. Tidak ada produk yang ditanam otomatis." action={<Button onClick={() => snapshot.categories.some((item) => item.isActive) ? setEditor({ product: null }) : setCategoriesOpen(true)}>{snapshot.categories.some((item) => item.isActive) ? 'Tambah produk' : 'Tambah kategori'}</Button>} /></div> : (
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Produk lokal, geser horizontal bila diperlukan"><table className="data-table"><thead><tr><th scope="col">Produk</th><th scope="col">Kategori / satuan dasar</th><th scope="col">Varian / harga jual</th><th scope="col">Persediaan</th><th scope="col">Status</th><th scope="col">Tindakan</th></tr></thead><tbody>{products.map((product) => {
          const variants = snapshot.variants.filter((item) => item.productId === product.id)
          return <tr key={product.id}><td><p className="font-semibold">{product.name}</p><span className={`pill mt-2 ${product.isDemo ? 'bg-warning-soft text-warning' : 'bg-brand-soft text-brand'}`}>{product.isDemo ? 'DEMO' : 'LOKAL'}</span></td><td><p>{snapshot.categories.find((item) => item.id === product.categoryId)?.name}</p><p className="mt-1 text-xs text-ink-muted">Dasar: {snapshot.units.find((item) => item.id === product.baseUnitId)?.name}</p></td><td><p>{variants.length} varian</p><p className="mt-1 text-xs text-ink-muted">{variants[0]?.sellingPrice == null ? 'Harga belum diatur' : `Varian pertama: ${money(variants[0].sellingPrice)}`}</p></td><td><ProductStock product={product} /></td><td><span className={`pill ${product.isActive ? 'bg-success-soft text-success' : 'bg-surface-muted text-ink-muted'}`}>{product.isActive ? 'Aktif' : 'Nonaktif'}</span></td><td><div className="flex gap-1"><Button variant="ghost" aria-label={`Detail ${product.name}`} onClick={() => setDetails(product)}><Eye size={17} aria-hidden="true" /></Button><Button variant="ghost" aria-label={`Edit ${product.name}`} onClick={() => setEditor({ product })}><Pencil size={17} aria-hidden="true" /></Button><Button variant="ghost" aria-label={`${product.isActive ? 'Nonaktifkan' : 'Aktifkan'} ${product.name}`} onClick={() => { setError(''); setConfirm(product) }}><Power size={17} aria-hidden="true" /></Button></div></td></tr>
        })}</tbody></table></div>
      )}
    </>}
    {editor && <ProductForm product={editor.product} onClose={() => setEditor(null)} onSaved={(name) => { setNotice(`${name} tersimpan di IndexedDB. Data tetap tersedia setelah refresh pada origin yang sama.`); setEditor(null) }} />}
    {details && <ProductDetails product={details} onClose={() => setDetails(null)} />}
    {categoriesOpen && <CategoryManager onClose={() => setCategoriesOpen(false)} />}
    {confirm && <Dialog title={confirm === 'seed' ? 'Isi Data Demo?' : `${confirm.isActive ? 'Nonaktifkan' : 'Aktifkan'} produk?`} mode="local" onClose={() => { if (!busy) setConfirm(null) }}><p className="text-sm leading-6 text-ink-muted">{confirm === 'seed' ? 'Menambahkan contoh berlabel DEMO, termasuk varian bensin dan satuan kemasan. Tidak menimpa data pengguna dan tidak menduplikasi seed yang sudah ada. Konflik SKU akan membatalkan seluruh seed.' : `${confirm.name} akan ${confirm.isActive ? 'disembunyikan dari katalog aktif' : 'ditampilkan kembali jika kategori dan varian aktif'}. Produk tidak dihapus permanen.`}</p>{error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}<div className="mt-6 flex flex-wrap justify-end gap-3"><Button variant="secondary" onClick={() => setConfirm(null)} disabled={busy}>Batal</Button><Button onClick={() => void performConfirmed()} disabled={busy}>{busy ? 'Menyimpan…' : 'Ya, lanjutkan'}</Button></div></Dialog>}
  </>
}
