import { useId } from 'react'
import type { ProductUnitPolicy, Unit } from '../../domain/product'
import { parseQuantity, quantityText } from '../../domain/quantity'
import { Button } from '../../components/ui/Button'
import { unitAllowed } from '../../domain/unitPolicy'
import { directUnitPatch, metricUnitPatch, packagingUnitPatch, stockImpact, variantSizeWarning, variantUnitEntry, type VariantUnitValue } from './variantUnits'

export interface VariantFormValue extends VariantUnitValue {
  key: string; id?: string; name: string; sku: string; barcode: string
  price: string; isActive: boolean
}
export function VariantFields({ value, units, baseId, unitPolicy, onChange, onRemove }: {
  value: VariantFormValue; units: Unit[]; baseId: string; unitPolicy: ProductUnitPolicy
  onChange: (patch: Partial<VariantFormValue>) => void; onRemove?: () => void
}) {
  const descriptionId = useId(), warningId = useId()
  const base = units.find((item) => item.id === baseId)
  const selling = units.find((item) => item.id === value.sellingUnitId)
  const allowed = base ? units.filter((unit) => unitAllowed({ unitPolicy }, base, unit, units)) : []
  const packaging = allowed.filter((unit) => unit.isPackaging && unit.id !== baseId)
  const metric = allowed.filter((unit) => !unit.isPackaging && unit.id !== baseId && unit.dimension !== 'count')
  const entry = variantUnitEntry(value, base, units)
  const selectedAllowed = allowed.some((unit) => unit.id === value.sellingUnitId)
  const variableAllowed = base && selling && base.dimension !== 'count' && !selling.isPackaging && base.dimension === selling.dimension && entry !== 'packaging'
  const impact = base ? stockImpact(value, base, unitPolicy, units) : null
  const warning = base ? variantSizeWarning(value.name, value, base, units) : null
  const contents = parseQuantity(value.quantity)

  return <fieldset className="rounded-panel border border-line bg-canvas p-4">
    <legend className="px-2 text-xs font-semibold">{value.name || 'Varian baru'}</legend>
    <div className="grid gap-4 sm:grid-cols-2">
      <label><span className="field-label">Nama varian *</span><input className="field" value={value.name} maxLength={80} required aria-describedby={warning ? warningId : undefined} onChange={(event) => onChange({ name: event.target.value })} /></label>
      <label><span className="field-label">Harga jual (Rp) per 1 {selling?.name ?? 'satuan jual'}</span><input className="field" inputMode="numeric" value={value.price} placeholder="Kosong = belum diatur" onChange={(event) => onChange({ price: event.target.value })} /></label>
      <label><span className="field-label">SKU (opsional)</span><input className="field" value={value.sku} maxLength={60} onChange={(event) => onChange({ sku: event.target.value })} /></label>
      <label><span className="field-label">Barcode (opsional)</span><input className="field" value={value.barcode} maxLength={80} onChange={(event) => onChange({ barcode: event.target.value })} /></label>
      <label className="sm:col-span-2"><span className="field-label">Cara menjual *</span><select className="field" value={entry} aria-describedby={descriptionId} onChange={(event) => {
        if (!base) return
        if (event.target.value === 'direct') onChange(directUnitPatch(base, value.saleMode))
        if (event.target.value === 'packaging') onChange(packagingUnitPatch())
        if (event.target.value === 'metric' && metric[0]) onChange(metricUnitPatch(base, metric[0], value.saleMode))
      }}>
        {entry === 'legacy' && <option value="legacy" disabled>Konfigurasi tersimpan · perlu review</option>}
        <option value="direct">Dijual langsung berdasarkan satuan dasar ({base?.name})</option>
        <option value="packaging">Dijual dalam kemasan dengan isi tertentu</option>
        {!!metric.length && <optgroup label="Lanjutan: ukuran baku"><option value="metric">Satuan ukur lain (misalnya Gram atau Mililiter)</option></optgroup>}
      </select></label>
      <p id={descriptionId} className="text-xs leading-6 text-ink-muted sm:col-span-2">{entry === 'direct' ? `Stok dicatat dalam ${base?.name}. Satuan jual sama dengan satuan stok, sehingga faktor konversi otomatis 1. Nama varian tidak menentukan ukuran kemasan.` : entry === 'packaging' ? `Pilih kemasan yang sudah diizinkan di atas, lalu tulis isinya dalam ${base?.name}. Isi kemasan berbeda dari jumlah yang dibeli pelanggan.` : entry === 'metric' ? 'Faktor satuan ukur baku dihitung otomatis. Pilihan lanjutan ini tetap tersedia untuk Gram/Mililiter dan konfigurasi lama.' : 'Nilai lama tetap ditampilkan tanpa perubahan otomatis. Periksa satuan dan isi, pilih cara menjual yang benar, atau nonaktifkan varian lama yang tidak sesuai.'} Saat mengganti satuan jual, periksa kembali harga; harga tidak dihitung ulang otomatis.</p>
      {entry !== 'direct' && <>
        <label><span className="field-label">{entry === 'packaging' ? 'Jenis kemasan *' : 'Satuan jual *'}</span><select className="field" required value={value.sellingUnitId} onChange={(event) => {
          const selected = units.find((unit) => unit.id === event.target.value)
          if (!base || !selected) return
          if (selected.id === base.id) onChange(directUnitPatch(base, value.saleMode))
          else if (selected.isPackaging) onChange(packagingUnitPatch(selected.id))
          else onChange(metricUnitPatch(base, selected, value.saleMode))
        }}>
          {!selectedAllowed && value.sellingUnitId && <option value={value.sellingUnitId} disabled>{selling?.name ?? 'Satuan lama'} · perlu review</option>}
          <option value="" disabled>Pilih {entry === 'packaging' ? 'kemasan' : 'satuan jual'}</option>
          {(entry === 'packaging' ? packaging : entry === 'metric' ? metric : allowed).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
        </select>{entry === 'packaging' && !packaging.length && <span className="text-xs text-warning">Belum ada kemasan yang diizinkan. Centang kemasan yang sesuai pada bagian Izin kemasan tambahan di atas.</span>}{!selectedAllowed && selling && <span className="text-xs text-warning">Pilih satuan yang diizinkan atau nonaktifkan varian lama ini.</span>}</label>
        {entry !== 'metric' && <label><span className="field-label">{entry === 'packaging' ? `Isi per kemasan (${base?.name}) *` : `Isi tersimpan (${base?.name}) *`}</span><input className="field" value={value.quantity} inputMode="decimal" required aria-describedby={descriptionId} placeholder="Contoh: 1,5" onChange={(event) => onChange({ quantity: event.target.value })} /><span className="text-xs text-ink-muted">{entry === 'packaging' && selling && contents !== null ? `1 ${selling.name} berisi ${quantityText(contents)} ${base?.name}` : `Gunakan satuan stok ${base?.name}; maksimal 3 angka di belakang koma.`}</span></label>}
      </>}
      <label><span className="field-label">Mode jumlah</span><select className="field" value={value.saleMode} onChange={(event) => onChange({ saleMode: event.target.value === 'variable' ? 'variable' : 'fixed' })}><option value="fixed">Jumlah tetap (fixed)</option><option value="variable" disabled={!variableAllowed}>Berat / volume aktual (variable)</option></select><span className="mt-1 block text-xs leading-5 text-ink-muted">{entry === 'packaging' ? 'Kemasan dijual utuh. Isi per kemasan tetap; pelanggan dapat membeli beberapa kemasan.' : variableAllowed ? 'Jumlah tetap: tambah per satuan jual. Jumlah aktual: isi berat/volume yang dibeli di Kasir, misalnya 1,5 Liter.' : 'Satuan jumlah seperti Botol/Bungkus dijual utuh, bukan pecahan.'}</span></label>
      <label className="flex min-h-12 items-center gap-3 pt-5 text-sm"><input className="size-5 accent-brand" type="checkbox" checked={value.isActive} onChange={(event) => onChange({ isActive: event.target.checked })} />Varian aktif</label>
    </div>
    <div aria-live="polite" aria-atomic="true" className="mt-4 rounded-xl border border-line bg-surface p-3 text-sm leading-6">
      <p className="font-semibold">Dampak pada stok</p>
      {impact?.issue ? <p className="text-warning">{impact.issue}</p> : impact?.lines.map((line) => <p key={line}>{line}</p>)}
      {entry === 'metric' && contents !== null && <p className="text-xs text-ink-muted">1 {selling?.name} = {quantityText(contents)} {base?.name} (ukuran baku).</p>}
      <p className="mt-1 text-xs text-ink-muted">Simulasi pengaturan; stok baru berkurang setelah checkout tunai berhasil.</p>
    </div>
    {warning && <p id={warningId} role="status" className="mt-3 rounded-lg bg-warning-soft p-3 text-sm leading-6 text-warning">{warning}</p>}
    {onRemove && <Button variant="danger" className="mt-4" onClick={onRemove}>Buang baris baru</Button>}
    {value.id && <p className="mt-3 text-xs leading-5 text-ink-muted">Varian tersimpan tidak dihapus permanen. Hilangkan centang aktif untuk menonaktifkannya.</p>}
  </fieldset>
}
