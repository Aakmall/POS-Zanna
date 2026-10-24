import { userError } from '../../lib/userError'
import { useRef, useState } from 'react'
import type { ImportPreview } from '../../domain/productImport'
import type { Unit } from '../../domain/product'
import type { ProductImportService } from '../../services/productImportOperations'
import { productImportService } from '../../services/productImportService'
import { productTemplate, readProductExcel } from '../../services/productExcel'
import { downloadBlob } from '../../services/reportExport'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { quantityText } from '../../domain/quantity'
import { money } from '../../lib/format'

export function ProductImportDialog({ onClose, onSaved, units, service = productImportService }: { onClose: () => void; onSaved: (count: number) => void; units: readonly Unit[]; service?: ProductImportService }) {
  const [preview, setPreview] = useState<ImportPreview | null>(null), [fileName, setFileName] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [confirmed, setConfirmed] = useState(false)
  const guard = useRef(false)
  async function template() {
    if (guard.current) return
    guard.current = true; setBusy(true); setError('')
    try { downloadBlob(await productTemplate(), 'zanna-template-produk.xlsx') }
    catch { setError('Template belum berhasil diunduh. Coba lagi.') }
    finally { guard.current = false; setBusy(false) }
  }
  async function choose(file: File | undefined) {
    if (guard.current) return
    setPreview(null); setConfirmed(false); setError(''); setFileName(file?.name ?? '')
    if (!file) return
    guard.current = true; setBusy(true)
    try { setPreview(await service.preview(await readProductExcel(file))) }
    catch (cause) { setError(userError(cause, 'File belum dapat dibaca. Perbaiki lalu pilih ulang file.')) }
    finally { guard.current = false; setBusy(false) }
  }
  async function commit() {
    if (guard.current || !preview || !confirmed || preview.issues.length) return
    guard.current = true; setBusy(true); setError('')
    try { const count = await service.confirm(preview, confirmed); onSaved(count) }
    catch (cause) { setError(`${userError(cause, 'Impor belum berhasil. Pilih ulang file dan periksa kembali.')} Tidak ada impor sebagian. Pilih ulang file untuk mencoba lagi.`); setPreview(null); setConfirmed(false) }
    finally { guard.current = false; setBusy(false) }
  }
  return <Dialog title="Impor Excel Produk" mode="local" wide onClose={() => { if (!busy) onClose() }}><div className="space-y-5">
    <ol className="flex flex-wrap gap-2 text-xs text-ink-muted"><li>1. Unduh template</li><li>→ 2. Pilih file</li><li>→ 3. Periksa preview</li><li>→ 4. Konfirmasi</li></ol>
    <p className="text-sm leading-6 text-ink-muted">Hanya menambah produk baru, tidak menimpa produk lama atau menambah stok. Siapkan kategori terlebih dahulu. Satu baris untuk satu varian; gunakan Kode Produk sama untuk varian yang berbagi stok.</p>
    <Button variant="secondary" disabled={busy} onClick={() => void template()}>Unduh template Excel</Button>
    <details className="rounded-xl border border-line p-4 text-xs leading-6"><summary className="min-h-11 cursor-pointer font-semibold">Petunjuk pengisian kolom</summary><p>Wajib: Kode Produk (teks), Nama Produk, Kategori yang sudah aktif, Satuan Dasar (kode), Jenis Produk UMUM/BBM, Nama Varian, Satuan Jual (kode), Isi Satuan Dasar, Harga Jual, Mode Jumlah TETAP/BEBAS. Modal, stok minimum, SKU dan barcode opsional.</p><p>Harga: angka Rupiah bulat, misalnya 15000, tanpa Rp. Isi satuan: angka maksimal 3 desimal sesuai pengaturan Excel, misalnya 1,5 Liter per Botol. Kosongkan modal jika tidak diketahui; nol berarti modal benar-benar nol. SKU/barcode wajib berformat Teks agar nol awal tetap ada.</p><p>Kode satuan: {units.map((u) => `${u.code} = ${u.name}`).join('; ')}.</p><p>Contoh: Bensin kemasan memakai dasar l, jual botol, isi 1,5, mode TETAP, jenis BBM. Solar bebas memakai dasar l, jual l, isi 1, mode BEBAS. Untuk mi dasar bungkus, jual dus, isi sesuai jumlah bungkus per dus.</p><p>Maksimal 500 baris, satu lembar, .xlsx tanpa sandi maksimal 2 MB. Semua varian dengan Kode Produk sama harus memiliki nama, kategori, dasar, jenis, modal dan stok minimum yang sama. Kode Produk hanya untuk pengelompokan file, bukan SKU atau ID lama.</p></details>
    <label><span className="field-label">Pilih file Excel</span><input className="field" type="file" accept=".xlsx" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void choose(file) }} /></label>
    {fileName && <p className="break-all text-xs text-ink-muted">File: {fileName}</p>}{busy && <p role="status" className="text-sm text-brand">Memproses file atau menyimpan produk…</p>}
    {error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p>}
    {preview && <><p className="text-sm font-semibold">Preview: {preview.products} produk · {preview.variants} varian · {preview.rows} baris diperiksa</p>
      {!!preview.issues.length && <div role="alert" className="rounded-xl bg-danger-soft p-4 text-sm text-danger"><p className="font-semibold">Impor belum dapat dilakukan. Perbaiki seluruh kesalahan dan pilih ulang file.</p><ul className="mt-2 max-h-52 list-disc overflow-y-auto pl-5">{preview.issues.map((issue, i) => <li key={`${issue.row}-${i}`}>Baris {issue.row}: {issue.message}</li>)}</ul></div>}
      <div className="table-scroll max-h-72" tabIndex={0} role="region" aria-label="Preview impor produk"><table className="data-table"><thead><tr><th scope="col">Produk / varian</th><th scope="col">Harga jual</th><th scope="col">Modal per satuan dasar</th><th scope="col">Dampak stok per penjualan</th><th scope="col">SKU / barcode</th></tr></thead><tbody>{preview.drafts.flatMap((draft, i) => draft.variants.map((variant, j) => <tr key={`${i}-${j}`}><td>{draft.name}<br />{variant.name}</td><td>{money(variant.sellingPrice!)}</td><td>{draft.costPrice === null ? 'Belum diketahui' : money(draft.costPrice)}</td><td>1 {units.find((u) => u.id === variant.sellingUnitId)?.name} = {quantityText(variant.quantityInBaseUnit)} {units.find((u) => u.id === draft.baseUnitId)?.name}</td><td>{variant.sku ?? '—'} / {variant.barcode ?? '—'}</td></tr>))}</tbody></table></div>
      {!preview.issues.length && <label className="flex min-h-12 items-start gap-3 rounded-xl bg-warning-soft p-4 text-sm leading-6"><input type="checkbox" className="mt-1 size-5 shrink-0" checked={confirmed} disabled={busy} onChange={(e) => setConfirmed(e.target.checked)} /><span>Saya telah memeriksa seluruh produk, harga dan isi satuan. Saya menyetujui penambahan {preview.products} produk baru. Stok awal akan diatur terpisah melalui menu Stok.</span></label>}
    </>}
    <p className="text-xs text-warning">Akses impor belum dibatasi pemilik selama pengembangan. Gunakan file uji tanpa data sensitif.</p>
    <div className="flex flex-wrap justify-end gap-3"><Button variant="secondary" disabled={busy} onClick={onClose}>Batal</Button><Button disabled={busy || !preview || !!preview.issues.length || !confirmed} onClick={() => void commit()}>{busy ? 'Memproses…' : 'Konfirmasi impor'}</Button></div>
  </div></Dialog>
}
