import { useState, type SubmitEvent } from 'react'
import { Plus } from 'lucide-react'
import type { Product, ProductDraft, ProductUnitPolicy } from '../../domain/product'
import { parseQuantity, parseRupiah, quantityInput } from '../../domain/quantity'
import { createUuid } from '../../domain/id'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { useDemoStore } from '../../hooks/useDemoStore'
import { VariantFields, type VariantFormValue } from './VariantFields'
import { UnitPolicyFields } from './UnitPolicyFields'
import { validateProduct } from '../../domain/validation'

export function ProductForm({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: (name: string) => void }) {
  const { snapshot, repository } = useDemoStore()
  const [name, setName] = useState(product?.name ?? '')
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? snapshot.categories.find((item) => item.isActive)?.id ?? '')
  const [baseId, setBaseId] = useState(product?.baseUnitId ?? snapshot.units.find((item) => item.code === 'pcs')?.id ?? '')
  const [cost, setCost] = useState(product?.costPrice === null || !product ? '' : String(product.costPrice))
  const [minimum, setMinimum] = useState(product?.minimumStock === null || !product ? '' : quantityInput(product.minimumStock))
  const [isActive, setActive] = useState(product?.isActive ?? true)
  const [unitPolicy, setUnitPolicy] = useState<ProductUnitPolicy>(() => product?.unitPolicy ? { ...product.unitPolicy, allowedPackagingUnitIds: [...product.unitPolicy.allowedPackagingUnitIds] } : { kind: 'general', allowedPackagingUnitIds: [] })
  const [reviewed, setReviewed] = useState(!!product?.unitPolicy || !product)
  const blankVariant = (): VariantFormValue => ({ key: createUuid(), name: 'Standar', sku: '', barcode: '', sellingUnitId: baseId, quantity: '1', price: '', saleMode: 'fixed', isActive: true })
  const [variants, setVariants] = useState<VariantFormValue[]>(() => product
    ? snapshot.variants.filter((item) => item.productId === product.id).map((item) => ({ key: item.id, id: item.id, name: item.name, sku: item.sku ?? '', barcode: item.barcode ?? '', sellingUnitId: item.sellingUnitId, quantity: quantityInput(item.quantityInBaseUnit), price: item.sellingPrice === null ? '' : String(item.sellingPrice), saleMode: item.saleMode, isActive: item.isActive }))
    : [blankVariant()])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!reviewed) { setError('Konfirmasikan hasil peninjauan kebijakan satuan produk lama terlebih dahulu.'); return }
    const costPrice = cost.trim() ? parseRupiah(cost) : null
    const minimumStock = minimum.trim() ? parseQuantity(minimum) : null
    if ((cost.trim() && costPrice === null) || (minimum.trim() && minimumStock === null)) { setError('Modal atau batas stok tidak valid. Harga rupiah bulat; kuantitas maksimal 3 desimal.'); return }
    const converted = variants.map((item) => ({ item, quantity: parseQuantity(item.quantity), price: item.price.trim() ? parseRupiah(item.price) : null }))
    if (converted.some(({ item, quantity, price }) => quantity === null || (item.price.trim() && price === null))) { setError('Periksa konversi dan harga setiap varian. Konversi maksimal 3 desimal; harga tidak menerima pecahan/negatif.'); return }
    const draft: ProductDraft = {
      id: product?.id, expectedUpdatedAt: product?.updatedAt, name, categoryId, baseUnitId: baseId,
      costPrice, costKnown: costPrice !== null, minimumStock, isActive, unitPolicy,
      variants: converted.map(({ item, quantity, price }) => ({ id: item.id, name: item.name, sku: item.sku, barcode: item.barcode, sellingUnitId: item.sellingUnitId, quantityInBaseUnit: quantity!, sellingPrice: price, saleMode: item.saleMode, isActive: item.isActive })),
    }
    try { validateProduct(draft, snapshot) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Konfigurasi produk tidak valid.'); return }
    setBusy(true)
    try { const saved = await repository.saveProduct(draft); onSaved(saved.name) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Gagal menyimpan. Periksa izin atau kapasitas penyimpanan browser.') }
    finally { setBusy(false) }
  }

  return <Dialog title={product ? 'Edit produk lokal' : 'Tambah produk lokal'} mode="local" wide onClose={() => { if (!busy) onClose() }}>
    <form onSubmit={submit} className="space-y-6">
      <fieldset disabled={busy} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="field-label">Nama produk *</span><input className="field" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label><span className="field-label">Kategori *</span><select className="field" required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Pilih kategori</option>{snapshot.categories.filter((item) => item.isActive || item.id === categoryId).map((item) => <option key={item.id} value={item.id}>{item.name}{!item.isActive ? ' (nonaktif)' : ''}</option>)}</select></label>
          <label><span className="field-label">Satuan stok dasar *</span><select className="field" required disabled={!!product} value={baseId} onChange={(event) => { setBaseId(event.target.value); setUnitPolicy((policy) => ({ ...policy, allowedPackagingUnitIds: policy.allowedPackagingUnitIds.filter((id) => id !== event.target.value) })); setVariants((items) => items.map((item) => ({ ...item, sellingUnitId: event.target.value, quantity: '1', saleMode: 'fixed' }))) }}>{snapshot.units.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select></label>
          <label><span className="field-label">Modal per 1 satuan dasar (Rp)</span><input className="field" inputMode="numeric" value={cost} onChange={(event) => setCost(event.target.value)} placeholder="Kosong = belum diketahui" /></label>
          <label><span className="field-label">Batas stok minimum (satuan dasar)</span><input className="field" inputMode="decimal" value={minimum} onChange={(event) => setMinimum(event.target.value)} placeholder="Opsional, contoh 1,5" /></label>
        </div>
        <p className="text-xs leading-5 text-ink-muted">Modal kosong disimpan sebagai null, bukan nol. Harga menerima 15000 atau 15.000 (Rp15.000). Konversi/kuantitas menerima 1,5 atau 1.5. Satuan dasar terkunci setelah produk disimpan.</p>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-brand" checked={isActive} onChange={(event) => setActive(event.target.checked)} />Produk aktif</label>
        <UnitPolicyFields value={unitPolicy} units={snapshot.units} baseId={baseId} onChange={setUnitPolicy} />
        {product && !product.unitPolicy && <div className="rounded-xl bg-warning-soft p-4 text-sm leading-6 text-warning"><p>Produk lama belum memiliki kebijakan kemasan. Pilih jenis persediaan dan kemasan yang benar. Varian yang tidak sesuai harus diperbaiki atau dinonaktifkan. Saldo dan ledger lama tidak diubah.</p><label className="mt-3 flex min-h-11 items-center gap-3"><input type="checkbox" className="size-5" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />Saya telah meninjau dimensi dan kemasan produk ini.</label></div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5"><h3 className="font-semibold">Varian jual</h3><Button variant="secondary" onClick={() => setVariants((items) => [...items, { ...blankVariant(), name: '' }])} disabled={variants.length >= 20}><Plus size={17} aria-hidden="true" />Tambah varian</Button></div>
        <p className="text-xs leading-5 text-ink-muted">Barcode dan SKU hanya milik varian, unik termasuk yang nonaktif. Kemasan (dus/botol/jeriken) memerlukan isi eksplisit. Berat ↔ volume tidak diperbolehkan. Mode jumlah aktual mendukung input berat/volume maksimal tiga desimal pada checkout tunai.</p>
        {variants.map((variant, index) => <VariantFields key={variant.key} value={variant} units={snapshot.units} baseId={baseId} unitPolicy={unitPolicy} onChange={(patch) => setVariants((items) => items.map((item, position) => position === index ? { ...item, ...patch } : item))} onRemove={!variant.id && variants.length > 1 ? () => setVariants((items) => items.filter((_, position) => position !== index)) : undefined} />)}
      </fieldset>
      <p className="rounded-lg bg-warning-soft p-3 text-xs leading-5 text-warning">Harga modal terlihat pada browser ini. Pembatasan akses owner belum tersedia dan belum dilindungi autentikasi backend.</p>
      {error && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose} disabled={busy}>Batal</Button><Button type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan ke perangkat'}</Button></div>
    </form>
  </Dialog>
}
