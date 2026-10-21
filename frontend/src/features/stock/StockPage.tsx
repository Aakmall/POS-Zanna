import { useState } from 'react'
import { AlertTriangle, History, Package, PackageX, Plus, SlidersHorizontal, Warehouse } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '../../components/ui/PageHeader'
import { CatalogState } from '../../components/ui/CatalogState'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { StatCard } from '../../components/ui/StatCard'
import { StockBadge } from '../../components/ui/StockBadge'
import { useInventory } from '../../hooks/useInventory'
import { quantityText } from '../../domain/quantity'
import { movementLabels, stockStatusLabels } from '../../domain/inventoryRules'
import type { MovementType } from '../../domain/inventory'
import { StockMovementForm } from './StockMovementForm'
import { StockHistory } from './StockHistory'
import { UnitPolicyNotice } from '../../components/ui/UnitPolicyNotice'

export function StockPage() {
  const { rows, catalog, status } = useInventory()
  const [query, setQuery] = useState(''), [category, setCategory] = useState('all'), [statusFilter, setStatusFilter] = useState('all')
  const [editing, setEditing] = useState<{ productId: string; type: MovementType } | null>(null)
  const [history, setHistory] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const filtered = rows.filter((row) => row.product.name.toLocaleLowerCase('id').includes(query.trim().toLocaleLowerCase('id')) && (category === 'all' || row.product.categoryId === category) && (statusFilter === 'all' || row.status === statusFilter))
  const totals = { tracked: rows.filter((row) => row.balance).length, empty: rows.filter((row) => row.status === 'OUT_OF_STOCK').length, low: rows.filter((row) => row.status === 'LOW_STOCK').length, unknown: rows.filter((row) => row.status === 'NOT_INITIALIZED').length }
  return <>
    <PageHeader title="Persediaan warung" description="Catat stok awal, barang masuk, dan koreksi dengan ledger lokal. Seluruh varian berbagi saldo produk dalam satuan dasar." />
    {notice && <p role="status" className="mb-5 rounded-xl bg-success-soft p-4 text-sm leading-6 text-success">{notice}</p>}
    {status !== 'ready' ? <CatalogState /> : <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Produk dilacak" value={String(totals.tracked)} note="Master dengan stok awal, termasuk stok nol" icon={Warehouse} /><StatCard label="Stok habis" value={String(totals.empty)} note="Sudah diatur dan saldo nol" icon={PackageX} /><StatCard label="Stok menipis" value={String(totals.low)} note="Positif dan ≤ minimum yang ditetapkan" icon={AlertTriangle} /><StatCard label="Belum diatur" value={String(totals.unknown)} note="Belum ada saldo; berbeda dari nol" icon={Package} /></div>
      <div className="panel mb-5 grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]"><label><span className="sr-only">Cari persediaan produk</span><input className="field" placeholder="Cari nama produk…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label><span className="sr-only">Kategori persediaan</span><select className="field" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Semua kategori</option>{catalog.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span className="sr-only">Status persediaan</span><select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Semua status</option>{Object.entries(stockStatusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
      {!filtered.length ? <div className="panel"><EmptyState title="Tidak ada persediaan yang cocok" description="Tambahkan produk di master atau ubah filter. Produk baru tidak diisi stok nol secara otomatis." action={<Link className="btn btn-primary" to="/produk">Kelola produk</Link>} /></div> : <div className="table-scroll" tabIndex={0} role="region" aria-label="Daftar inventory lokal, geser untuk melihat seluruh tindakan"><table className="data-table"><thead><tr><th scope="col">Produk / kategori</th><th scope="col">Saldo dasar</th><th scope="col">Minimum</th><th scope="col">Status</th><th scope="col">Tindakan</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.product.id}>
        <td><p className="font-semibold">{row.product.name}</p><p className="mt-1 text-xs text-ink-muted">{row.category?.name} · {row.product.isDemo ? 'DEMO' : 'LOKAL'}{!row.product.isActive ? ' · Produk nonaktif' : ''}</p><UnitPolicyNotice product={row.product} /></td>
        <td><p className="font-semibold tabular-nums">{row.balance ? quantityText(row.balance.quantityBase) : '—'}</p><p className="mt-1 text-xs text-ink-muted">{row.baseUnit?.name}</p></td>
        <td>{row.product.minimumStock === null ? 'Belum diatur' : quantityText(row.product.minimumStock)}</td><td><StockBadge status={row.status} /></td>
        <td><div className="flex flex-wrap gap-2">{!row.balance ? <Button variant="secondary" onClick={() => setEditing({ productId: row.product.id, type: 'OPENING_BALANCE' })} aria-label={`Atur stok awal ${row.product.name}`}><Plus size={16} aria-hidden="true" />Atur Stok Awal</Button> : <><Button variant="secondary" onClick={() => setEditing({ productId: row.product.id, type: 'STOCK_IN' })} aria-label={`Tambah stok ${row.product.name}`}><Plus size={16} aria-hidden="true" />Tambah Stok</Button><Button variant="secondary" onClick={() => setEditing({ productId: row.product.id, type: 'ADJUSTMENT_OUT' })} aria-label={`Koreksi stok ${row.product.name}`}><SlidersHorizontal size={16} aria-hidden="true" />Koreksi</Button></>}<Button variant="ghost" aria-label={`Lihat riwayat ${row.product.name}`} onClick={() => setHistory(row.product.id)}><History size={18} aria-hidden="true" />Riwayat</Button></div></td>
      </tr>)}</tbody></table></div>}
      <p className="mt-5 text-xs leading-6 text-ink-muted">Mutasi ini benar-benar mengubah persediaan lokal, termasuk pada produk berlabel DEMO. Koreksi wajib beralasan; riwayat tidak diedit/dihapus. Checkout tunai Kasir mengurangi stok dengan ledger penjualan. Produk nonaktif tetap dapat memiliki persediaan fisik.</p>
    </>}
    {editing && <StockMovementForm key={`${editing.productId}-${editing.type}`} productId={editing.productId} initialType={editing.type} onClose={() => setEditing(null)} onSaved={({ movement, duplicate }) => { setNotice(`${movementLabels[movement.movementType]} ${movement.productName} ${duplicate ? 'sudah pernah diproses; tidak digandakan' : 'tersimpan'}. Saldo setelah operasi: ${quantityText(movement.quantityAfterBase)} ${movement.conversionSnapshot.baseUnit.name}.`); setEditing(null) }} />}
    {history && <StockHistory key={history} productId={history} onClose={() => setHistory(null)} />}
  </>
}
