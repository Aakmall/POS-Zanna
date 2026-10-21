import type { ProductUnitPolicy, Unit } from '../../domain/product'
import { dimensionLabels, packagingPermittedByKind, policyKindLabels } from '../../domain/unitPolicy'

export function UnitPolicyFields({ value, units, baseId, onChange }: {
  value: ProductUnitPolicy; units: Unit[]; baseId: string; onChange: (policy: ProductUnitPolicy) => void
}) {
  const base = units.find((unit) => unit.id === baseId)
  const choices = units.filter((unit) => unit.id !== baseId && packagingPermittedByKind(value.kind, unit))
  return <fieldset className="space-y-3 rounded-xl border border-line p-4">
    <legend className="px-2 text-sm font-semibold">Kebijakan satuan dan kemasan</legend>
    <label><span className="field-label">Jenis persediaan</span><select className="field" value={value.kind} onChange={(event) => {
      const kind = event.target.value === 'fuel' ? 'fuel' : 'general'
      onChange({ kind, allowedPackagingUnitIds: value.allowedPackagingUnitIds.filter((id) => units.some((unit) => unit.id === id && packagingPermittedByKind(kind, unit))) })
    }}>{Object.entries(policyKindLabels).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label>
    <p className="text-xs leading-6 text-ink-muted">Dimensi fisik dari satuan dasar: <strong>{base ? dimensionLabels[base.dimension] : 'Belum dipilih'}</strong>. BBM wajib VOLUME (Liter/Mililiter). Beras menggunakan MASS; mi per bungkus menggunakan COUNT. Nama produk tidak menentukan aturan.</p>
    {value.kind === 'fuel' && base?.dimension !== 'volume' && <p role="alert" className="text-sm text-danger">Pilih satuan dasar Liter/Mililiter untuk BBM. Satuan dasar produk tersimpan tidak dapat diubah; tinjau produk lama sebelum melanjutkan.</p>}
    <p className="text-xs leading-6 text-ink-muted">Centang hanya kemasan tambahan yang sah untuk produk ini. Satuan dasar dan ukuran baku sejenis tersedia tanpa centang. Izin kemasan tidak menentukan kapasitas; isi tetap wajib dinyatakan.</p>
    <div className="grid gap-2 sm:grid-cols-3">{choices.map((unit) => <label key={unit.id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-brand" checked={value.allowedPackagingUnitIds.includes(unit.id)} onChange={(event) => onChange({ ...value, allowedPackagingUnitIds: event.target.checked ? [...value.allowedPackagingUnitIds, unit.id] : value.allowedPackagingUnitIds.filter((id) => id !== unit.id) })} />{unit.name}</label>)}</div>
  </fieldset>
}
