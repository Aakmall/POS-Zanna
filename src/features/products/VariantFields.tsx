import type { Unit } from '../../domain/product'
import { quantityInput } from '../../domain/quantity'
import { Button } from '../../components/ui/Button'

export interface VariantFormValue {
  key: string; id?: string; name: string; sku: string; barcode: string; sellingUnitId: string
  quantity: string; price: string; saleMode: 'fixed' | 'variable'; isActive: boolean
}
export function VariantFields({ value, units, baseId, onChange, onRemove }: {
  value: VariantFormValue; units: Unit[]; baseId: string
  onChange: (patch: Partial<VariantFormValue>) => void; onRemove?: () => void
}) {
  const base = units.find((item) => item.id === baseId)
  return <fieldset className="rounded-panel border border-line bg-canvas p-4">
    <legend className="px-2 text-xs font-semibold">{value.name || 'Varian baru'}</legend>
    <div className="grid gap-4 sm:grid-cols-2">
      <label><span className="field-label">Nama varian *</span><input className="field" value={value.name} maxLength={80} required onChange={(event) => onChange({ name: event.target.value })} /></label>
      <label><span className="field-label">Harga jual (Rp)</span><input className="field" inputMode="numeric" value={value.price} placeholder="Kosong = belum diatur" onChange={(event) => onChange({ price: event.target.value })} /></label>
      <label><span className="field-label">SKU (opsional)</span><input className="field" value={value.sku} maxLength={60} onChange={(event) => onChange({ sku: event.target.value })} /></label>
      <label><span className="field-label">Barcode (opsional)</span><input className="field" value={value.barcode} maxLength={80} onChange={(event) => onChange({ barcode: event.target.value })} /></label>
      <label><span className="field-label">Satuan jual *</span><select className="field" value={value.sellingUnitId} onChange={(event) => {
        const selling = units.find((item) => item.id === event.target.value)
        onChange({ sellingUnitId: event.target.value, ...(!selling?.isPackaging && selling && base && selling.dimension === base.dimension ? { quantity: quantityInput(selling.factor * 1000 / base.factor) } : {}) })
      }}>{units.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label><span className="field-label">Isi 1 satuan jual = … {base?.name}</span><input className="field" value={value.quantity} inputMode="decimal" required onChange={(event) => onChange({ quantity: event.target.value })} /></label>
      <label><span className="field-label">Mode jumlah</span><select className="field" value={value.saleMode} onChange={(event) => onChange({ saleMode: event.target.value === 'variable' ? 'variable' : 'fixed' })}><option value="fixed">Kemasan / satuan tetap</option><option value="variable">Berat / volume aktual (fase mendatang)</option></select></label>
      <label className="flex min-h-12 items-center gap-3 pt-5 text-sm"><input className="size-5 accent-brand" type="checkbox" checked={value.isActive} onChange={(event) => onChange({ isActive: event.target.checked })} />Varian aktif</label>
    </div>
    {onRemove && <Button variant="danger" className="mt-4" onClick={onRemove}>Buang baris baru</Button>}
    {value.id && <p className="mt-3 text-xs leading-5 text-ink-muted">Varian tersimpan tidak dihapus permanen. Hilangkan centang aktif untuk menonaktifkannya.</p>}
  </fieldset>
}
