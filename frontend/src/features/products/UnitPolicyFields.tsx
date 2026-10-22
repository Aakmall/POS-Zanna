import type { ProductUnitPolicy, Unit } from '../../domain/product'
import { dimensionLabels, packagingPermittedByKind, policyKindLabels } from '../../domain/unitPolicy'

export function UnitPolicyFields({ value, units, baseId, onChange }: {
  value: ProductUnitPolicy; units: Unit[]; baseId: string; onChange: (policy: ProductUnitPolicy) => void
}) {
  const base = units.find((unit) => unit.id === baseId)
  const choices = units.filter((unit) => unit.id !== baseId && packagingPermittedByKind(value.kind, unit))
  return <fieldset className="space-y-3 rounded-xl border border-line p-4">
    <legend className="px-2 text-sm font-semibold">Satuan dan izin kemasan</legend>
    <label><span className="field-label">Jenis persediaan</span><select className="field" value={value.kind} onChange={(event) => {
      const kind = event.target.value === 'fuel' ? 'fuel' : 'general'
      onChange({ kind, allowedPackagingUnitIds: value.allowedPackagingUnitIds.filter((id) => units.some((unit) => unit.id === id && packagingPermittedByKind(kind, unit))) })
    }}>{Object.entries(policyKindLabels).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label>
    <p className="text-xs leading-6 text-ink-muted">Stok dihitung dalam <strong>{base?.name ?? 'satuan yang dipilih'}</strong> ({base ? dimensionLabels[base.dimension] : 'belum dipilih'}). Untuk bensin/solar pilih BBM dengan satuan dasar Liter atau Mililiter. Berat tidak dapat diubah menjadi volume.</p>
    {value.kind === 'fuel' && base?.dimension !== 'volume' && <p role="alert" className="text-sm text-danger">Pilih satuan dasar Liter/Mililiter untuk BBM. Satuan dasar produk tersimpan tidak dapat diubah; tinjau produk lama sebelum melanjutkan.</p>}
    <p className="text-sm font-semibold">Izin kemasan tambahan (opsional)</p>
    <p className="text-xs leading-6 text-ink-muted">Jika produk dijual dalam kemasan lain, centang jenisnya di sini sebelum mengatur varian. Contoh: stok bensin dalam Liter, izinkan Botol dan Jeriken. Centang ini hanya memberi izin; isi setiap kemasan diatur pada varian. Penjualan langsung dalam {base?.name} tidak memerlukan centang. Pilihan memakai satuan yang sudah tersedia, tanpa membuat satuan baru.</p>
    <div className="grid gap-2 sm:grid-cols-3">{choices.map((unit) => <label key={unit.id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-brand" checked={value.allowedPackagingUnitIds.includes(unit.id)} onChange={(event) => onChange({ ...value, allowedPackagingUnitIds: event.target.checked ? [...value.allowedPackagingUnitIds, unit.id] : value.allowedPackagingUnitIds.filter((id) => id !== unit.id) })} />{unit.name}</label>)}</div>
  </fieldset>
}
