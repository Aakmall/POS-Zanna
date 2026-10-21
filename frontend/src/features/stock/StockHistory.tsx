import { useState } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { useStockHistory } from '../../hooks/useStockHistory'
import { useInventory } from '../../hooks/useInventory'
import { quantityText } from '../../domain/quantity'
import { movementLabels } from '../../domain/inventoryRules'
import { historicalUnitIssue } from '../../domain/inventoryReview'

const timestamp = (value: string) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value))
export function StockHistory({ productId, onClose }: { productId: string; onClose: () => void }) {
  const { catalog } = useInventory()
  const { records, status, error, retry } = useStockHistory(productId)
  const [limit, setLimit] = useState(50)
  const name = catalog.products.find((item) => item.id === productId)?.name ?? 'Produk'
  return <Dialog title={`Riwayat stok · ${name}`} mode="local" wide onClose={onClose}>
    <p className="mb-5 text-xs leading-5 text-ink-muted">Terbaru di atas. Nama dan konversi di setiap catatan adalah snapshot saat mutasi. Riwayat bersifat baca saja; koreksi dilakukan melalui mutasi baru.</p>
    {status === 'loading' ? <p role="status">Membaca ledger lokal…</p> : status === 'error' ? <div role="alert"><p className="mb-3 text-sm text-danger">{error}</p><Button onClick={retry}>Coba baca ulang</Button></div> : !records.length ? <EmptyState title="Belum ada mutasi" description="Atur stok awal untuk membuat saldo dan catatan pertama." /> : <>
      <ol className="space-y-4">{records.slice(0, limit).map((record) => <li key={record.id} className="rounded-xl border border-line p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{movementLabels[record.movementType]}</h3><time dateTime={record.createdAt} className="text-xs text-ink-muted">{timestamp(record.createdAt)}</time></div>
        <p className="mt-2 text-xs text-ink-muted">{record.productName}</p><p className={`mt-3 font-semibold ${record.quantityDeltaBase < 0 ? 'text-danger' : 'text-success'}`}>{record.quantityDeltaBase >= 0 ? '+' : '−'}{quantityText(Math.abs(record.quantityDeltaBase))} {record.conversionSnapshot.baseUnit.name}</p>
        {historicalUnitIssue(record, catalog) && <p className="mt-3 rounded-lg bg-warning-soft p-3 text-xs leading-6 text-warning"><strong>Perlu review historis: </strong>{historicalUnitIssue(record, catalog)}</p>}
        <p className="mt-2 text-xs leading-6 text-ink-muted">Saldo {quantityText(record.quantityBeforeBase)} → {quantityText(record.quantityAfterBase)} {record.conversionSnapshot.baseUnit.name}<br />Input {quantityText(record.inputQuantity)} {record.conversionSnapshot.inputUnit.name} · isi 1 = {quantityText(record.conversionSnapshot.quantityInBaseUnit)} {record.conversionSnapshot.baseUnit.name}{record.conversionSnapshot.variantName ? ` · ${record.conversionSnapshot.variantName}` : ''}</p>
        <p className="mt-3 break-words text-xs leading-6">Alasan: {record.reason || 'Tidak ada catatan tambahan'}</p>
        <details className="mt-2 text-[11px] text-ink-muted"><summary className="min-h-11 cursor-pointer py-3">Detail audit</summary><p className="break-all leading-6">Mutasi: {record.id}<br />Operasi: {record.operationId}<br />Sumber konversi: {record.conversionSnapshot.source}<br />Pencatat: belum ada autentikasi</p></details>
      </li>)}</ol><p className="mt-4 text-xs text-ink-muted">{Math.min(limit, records.length)} dari {records.length} mutasi.</p>{records.length > limit && <Button className="mt-4 w-full" variant="secondary" onClick={() => setLimit((value) => value + 50)}>Tampilkan lebih banyak</Button>}
    </>}
  </Dialog>
}
