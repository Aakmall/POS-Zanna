import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { parseWholeAmount } from '../../lib/format'
import type { Product } from '../../types/pos'

export function StockAdjustment({ product, onClose, onSave }: { product: Product; onClose: () => void; onSave: (stock: number, reason: string) => void }) {
  const [quantity, setQuantity] = useState(String(product.stock))
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  return <Dialog title="Penyesuaian stok demo" onClose={onClose}><form className="space-y-5" onSubmit={(event) => {
    event.preventDefault()
    const stock = parseWholeAmount(quantity)
    if (stock === null || stock > 1000000 || !reason.trim()) { setError('Isi stok akhir dengan angka bulat 0–1.000.000 dan alasan penyesuaian.'); return }
    if (stock === product.stock) { setError('Stok akhir masih sama dengan stok saat ini.'); return }
    onSave(stock, reason.trim())
  }}><div className="rounded-xl bg-surface-muted p-4"><p className="font-semibold">{product.name}</p><p className="mt-1 text-sm text-ink-muted">Stok saat ini: {product.stock} {product.unit}</p></div>
    <label className="block"><span className="field-label">Stok akhir ({product.unit})</span><input className="field" value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="numeric" required /></label>
    <label className="block"><span className="field-label">Alasan penyesuaian</span><textarea className="field" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={200} placeholder="Contoh: koreksi hitung stok DEMO" required /></label>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}<p className="text-xs leading-5 text-ink-muted">Mengubah stok contoh pada sesi ini saja. Bukan pencatatan stok permanen.</p><Button type="submit" className="w-full">Terapkan simulasi</Button>
  </form></Dialog>
}
