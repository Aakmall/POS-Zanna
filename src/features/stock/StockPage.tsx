import { useState } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '../../components/ui/PageHeader'
import { CatalogState } from '../../components/ui/CatalogState'
import { EmptyState } from '../../components/ui/EmptyState'
import { useDemoStore } from '../../hooks/useDemoStore'
import { quantityText } from '../../domain/quantity'

export function StockPage() {
  const { snapshot, status } = useDemoStore()
  const [query, setQuery] = useState('')
  const products = snapshot.products.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))
  return <><PageHeader title="Stok" description="Batas minimum berasal dari master produk lokal. Saldo stok, ledger, dan penyesuaian persediaan belum dibuat pada Fase 2." />
    <p className="mb-5 rounded-xl bg-warning-soft p-4 text-sm leading-6 text-warning">Stok saat ini belum dicatat. Menambah produk atau menyelesaikan pembayaran DEMO tidak menambah/mengurangi stok. Tidak ada indikator stok rendah yang dihitung dari angka fiktif.</p>
    {status !== 'ready' ? <CatalogState /> : <><label className="mb-5 block"><span className="sr-only">Cari produk stok</span><input className="field" placeholder="Cari produk…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>{!products.length ? <div className="panel"><EmptyState title="Belum ada produk yang cocok" description="Kelola katalog lokal terlebih dahulu." action={<Link className="btn btn-primary" to="/produk">Kelola produk</Link>} /></div> : <div className="table-scroll" tabIndex={0} role="region" aria-label="Konfigurasi stok minimum"><table className="data-table"><thead><tr><th scope="col">Produk</th><th scope="col">Satuan dasar</th><th scope="col">Batas minimum</th><th scope="col">Stok saat ini</th></tr></thead><tbody>{products.map((item) => <tr key={item.id}><td className="font-semibold">{item.name}</td><td>{snapshot.units.find((unit) => unit.id === item.baseUnitId)?.name}</td><td>{item.minimumStock === null ? 'Belum diatur' : quantityText(item.minimumStock)}</td><td className="text-ink-muted">Belum dicatat</td></tr>)}</tbody></table></div>}</>}
  </>
}
