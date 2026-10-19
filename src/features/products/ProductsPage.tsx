import { useState } from 'react'
import { Pencil, Plus, Search } from 'lucide-react'
import { useDemoStore } from '../../hooks/useDemoStore'
import { categories, type Product } from '../../types/pos'
import { money } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { CatalogState } from '../../components/ui/CatalogState'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProductMark } from '../../components/ui/ProductMark'
import { ProductForm } from './ProductForm'

export function ProductsPage() {
  const { products, status } = useDemoStore()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Semua')
  const [editor, setEditor] = useState<{ product: Product | null } | null>(null)
  const [notice, setNotice] = useState('')
  const filtered = products.filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(query.trim().toLowerCase()) && (category === 'Semua' || product.category === category))
  return <>
    <PageHeader title="Produk" description="Katalog yang tertata, lebih mudah ditemukan. Semua harga dan stok adalah data contoh." action={<Button onClick={() => setEditor({ product: null })} disabled={status !== 'ready'}><Plus size={18} aria-hidden="true" />Tambah produk</Button>} />
    {notice && <p role="status" className="mb-5 rounded-xl bg-success-soft p-4 text-sm text-success">{notice}</p>}
    <div className="panel mb-5 flex flex-wrap gap-3 p-4"><div className="relative min-w-48 flex-1"><Search size={18} className="absolute top-4 left-3 text-ink-muted" aria-hidden="true" /><label htmlFor="catalog-search" className="sr-only">Cari nama atau kode produk</label><input id="catalog-search" className="field pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama atau kode produk…" /></div><label><span className="sr-only">Kategori produk</span><select className="field" value={category} onChange={(event) => setCategory(event.target.value)}><option>Semua</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label></div>
    {status !== 'ready' ? <CatalogState /> : !filtered.length ? <div className="panel"><EmptyState title="Tidak ada produk yang cocok" description="Ubah kata pencarian atau kategori untuk melihat produk lainnya." action={<Button variant="secondary" onClick={() => { setQuery(''); setCategory('Semua') }}>Reset filter</Button>} /></div> : <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabel produk demo, geser horizontal pada layar sempit"><table className="data-table"><caption className="sr-only">{filtered.length} produk DEMO</caption><thead><tr><th scope="col">Produk</th><th scope="col">Kategori</th><th scope="col">Harga DEMO</th><th scope="col">Stok</th><th scope="col">Aksi</th></tr></thead><tbody>{filtered.map((product) => <tr key={product.id}><td><div className="flex items-center gap-3"><ProductMark product={product} small /><div><p className="font-semibold">{product.name}</p><p className="mt-1 text-xs text-ink-muted">{product.sku}</p></div></div></td><td className="text-ink-muted">{product.category}</td><td><span className={product.price === null ? 'text-warning' : 'font-semibold'}>{product.price === null ? 'Harga belum diatur' : money(product.price)}</span><p className="mt-1 text-xs text-ink-muted">/ {product.unit}</p></td><td>{product.stock} {product.unit}</td><td><Button variant="ghost" aria-label={`Edit ${product.name}`} onClick={() => setEditor({ product })}><Pencil size={16} aria-hidden="true" />Edit</Button></td></tr>)}</tbody></table></div>}
    <p className="mt-4 text-xs text-ink-muted">Perubahan hanya berlaku sampai halaman dimuat ulang. Harga bensin boleh tetap kosong.</p>
    {editor && <ProductForm product={editor.product} onClose={() => setEditor(null)} onSaved={(name) => { setNotice(`${name} berhasil diperbarui dalam sesi DEMO.`); setEditor(null) }} />}
  </>
}
