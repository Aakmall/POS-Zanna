import { useState } from 'react'
import { AlertTriangle, Package, SlidersHorizontal, Warehouse } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { CatalogState } from '../../components/ui/CatalogState'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { useDemoStore } from '../../hooks/useDemoStore'
import type { Product } from '../../types/pos'
import { StockAdjustment } from './StockAdjustment'
import { demoId } from '../../lib/demoId'

export function StockPage() {
  const { products, status, adjustStock } = useDemoStore()
  const [query, setQuery] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [selected, setSelected] = useState<Product | null>(null)
  const [history, setHistory] = useState<{ id: string; name: string; before: number; after: number; reason: string }[]>([])
  const low = products.filter((product) => product.stock <= product.minimumStock)
  const filtered = products.filter((product) => product.name.toLowerCase().includes(query.trim().toLowerCase()) && (!lowOnly || product.stock <= product.minimumStock))
  return <><PageHeader title="Stok" description="Pantau persediaan contoh dan coba penyesuaian stok selama sesi DEMO." />
    {status !== 'ready' ? <CatalogState /> : <>
      <div className="mb-6 grid gap-4 sm:grid-cols-3"><StatCard label="Produk terdaftar" value={String(products.length)} note="Jenis produk dalam katalog sesi" icon={Package} /><StatCard label="Perlu perhatian" value={String(low.length)} note="Stok di bawah atau sama dengan batas" icon={AlertTriangle} /><StatCard label="Stok tersedia" value={String(products.filter((product) => product.stock > 0).length)} note="Jenis produk dengan stok di atas nol" icon={Warehouse} /></div>
      <div className="panel mb-5 flex flex-wrap items-center gap-4 p-4"><label className="min-w-48 flex-1"><span className="sr-only">Cari produk stok</span><input className="field" placeholder="Cari nama produk…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="flex min-h-12 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={lowOnly} onChange={(event) => setLowOnly(event.target.checked)} className="size-5 accent-brand" />Hanya stok rendah</label></div>
      {!filtered.length ? <div className="panel"><EmptyState title="Tidak ada produk yang cocok" description="Ubah pencarian atau nonaktifkan filter stok rendah." /></div> : <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabel stok demo"><table className="data-table"><thead><tr><th scope="col">Produk</th><th scope="col">Stok saat ini</th><th scope="col">Batas minimum</th><th scope="col">Status</th><th scope="col">Penyesuaian</th></tr></thead><tbody>{filtered.map((product) => <tr key={product.id}><td><p className="font-semibold">{product.name}</p><p className="mt-1 text-xs text-ink-muted">{product.sku}</p></td><td className="font-semibold tabular-nums">{product.stock} <span className="font-normal text-ink-muted">{product.unit}</span></td><td>{product.minimumStock} {product.unit}</td><td><span className={`pill ${product.stock === 0 ? 'bg-danger-soft text-danger' : product.stock <= product.minimumStock ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success'}`}>{product.stock === 0 ? 'Habis' : product.stock <= product.minimumStock ? 'Stok rendah' : 'Tersedia'}</span></td><td><Button variant="secondary" onClick={() => setSelected(product)} aria-label={`Sesuaikan stok ${product.name}`}><SlidersHorizontal size={16} aria-hidden="true" />Sesuaikan</Button></td></tr>)}</tbody></table></div>}
      <section className="panel mt-6 p-5"><h2 className="font-semibold">Penyesuaian pada sesi halaman ini</h2>{!history.length ? <p className="mt-3 text-sm text-ink-muted">Belum ada penyesuaian. Riwayat ini hanya rancangan UI DEMO.</p> : <ul className="mt-4 space-y-3">{history.map((entry) => <li key={entry.id} className="rounded-xl bg-surface-muted p-4 text-sm"><p className="font-semibold">{entry.name} <span className="ml-2 font-normal text-ink-muted">{entry.before} → {entry.after}</span></p><p className="mt-1 break-words text-ink-muted">{entry.reason}</p></li>)}</ul>}</section>
    </>}
    {selected && <StockAdjustment product={selected} onClose={() => setSelected(null)} onSave={(stock, reason) => { adjustStock(selected.id, stock); setHistory((items) => [{ id: demoId('stock'), name: selected.name, before: selected.stock, after: stock, reason }, ...items]); setSelected(null) }} />}
  </>
}
