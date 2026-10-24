import { userError } from '../../lib/userError'
import { ValidationError } from '../../domain/errors'
import { useRef, useState } from 'react'
import { BACKUP_TABLES, MAX_BACKUP_BYTES, type RestorePreview } from '../../domain/backup'
import { backupService } from '../../services/backupService'
import type { BackupService } from '../../services/backupOperations'
import { appSafety, type AppSafety } from '../../services/appSafety'
import { downloadBlob } from '../../services/reportExport'
import { Button } from '../../components/ui/Button'

const labels = ['Produk', 'Kategori', 'Satuan', 'Varian', 'Saldo stok', 'Riwayat stok', 'Penjualan', 'Barang terjual', 'Permintaan checkout', 'Pelanggan', 'Tagihan Bon', 'Cicilan/pelunasan', 'Permintaan pembayaran', 'Modal historis']
export function BackupPanel({ hasCart, service = backupService, safety = appSafety }: { hasCart: boolean; service?: BackupService; safety?: AppSafety }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [preview, setPreview] = useState<RestorePreview | null>(null), [confirmation, setConfirmation] = useState(''), [approved, setApproved] = useState(false), [fileName, setFileName] = useState('')
  const guard = useRef(false)
  async function create() {
    if (guard.current) return
    guard.current = true; setBusy(true); setError(''); setNotice('')
    try { const result = await service.create(); downloadBlob(new Blob([result.text], { type: 'application/json;charset=utf-8' }), result.name); setNotice('File cadangan telah dibuat dan diperiksa. Selesaikan unduhan, lalu simpan file di tempat aman. Aplikasi tidak dapat memastikan file sudah tersimpan di media Anda.') }
    catch (cause) { setError(userError(cause, 'Cadangan belum berhasil dibuat. Data sumber tidak diubah.')) }
    finally { guard.current = false; setBusy(false) }
  }
  async function inspect(file: File | undefined) {
    if (guard.current) return
    setPreview(null); setConfirmation(''); setApproved(false); setFileName(file?.name ?? ''); setError(''); setNotice('')
    if (!file) return
    guard.current = true; setBusy(true)
    try { if (!file.name.toLowerCase().endsWith('.json') || file.size > MAX_BACKUP_BYTES) throw new ValidationError('Pilih cadangan POS-Zanna .json maksimal 50 MB.'); setPreview(await service.inspect(await file.text())) }
    catch (cause) { setError(userError(cause, 'Cadangan belum dapat diperiksa. Tidak ada data yang diubah.')) }
    finally { guard.current = false; setBusy(false) }
  }
  async function restore() {
    if (guard.current || !preview || !approved || confirmation !== 'PULIHKAN DATA') return
    if (hasCart) { setError('Keranjang masih berisi barang. Selesaikan atau kosongkan keranjang terlebih dahulu.'); return }
    guard.current = true; setBusy(true); setError('')
    try { await service.restore(preview, confirmation); setNotice('Pemulihan berhasil dan diperiksa. Muat ulang aplikasi sebelum melanjutkan.'); setPreview(null) }
    catch (cause) { setError(`${userError(cause, 'Pemulihan gagal. Data semula tetap utuh. Periksa ulang file.')} Tidak ada pemulihan sebagian. Periksa ulang file untuk mencoba lagi.`); setPreview(null); setApproved(false); setConfirmation('') }
    finally { guard.current = false; setBusy(false) }
  }
  return <div className="space-y-6"><div><h2 className="text-lg font-semibold">Backup &amp; Pemulihan</h2><p className="mt-2 text-sm leading-6 text-ink-muted">Data di perangkat berbeda dari file cadangan. Buat cadangan secara berkala dan simpan salinannya di media yang aman. Status terhubung jaringan tidak berarti data sudah dicadangkan.</p></div>
    <p className="rounded-xl bg-warning-soft p-4 text-sm leading-6 text-warning">Cadangan berisi transaksi, pelanggan dan keuangan. File belum dienkripsi dan fitur belum dilindungi login/izin pemilik. Jangan bagikan file sensitif atau memakai aplikasi ini untuk operasional banyak pengguna.</p>
    <section className="rounded-xl border border-line p-4"><h3 className="font-semibold">1. Cadangkan data sekarang</h3><p className="mt-2 text-sm leading-6 text-ink-muted">Seluruh 14 jenis data disalin dalam satu kondisi yang konsisten. Pembuatan cadangan tidak mengubah data sumber. Simpan file ini sebelum memulihkan cadangan lain.</p><Button className="mt-4" disabled={busy} onClick={() => void create()}>Cadangkan Data</Button></section>
    <section className="space-y-4 rounded-xl border border-line p-4"><h3 className="font-semibold">2. Periksa cadangan yang akan dipulihkan</h3><p className="text-sm leading-6 text-ink-muted">Pilih file hanya memeriksa isinya. Pemulihan akan mengganti seluruh data saat ini, tanpa menggabungkannya. Tutup tab/jendela aplikasi lain dan selesaikan transaksi tertunda.</p>
      <label><span className="field-label">Pilih File Cadangan</span><input className="field" type="file" accept=".json,application/json" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; void inspect(file) }} /></label><p className="text-xs text-ink-muted">File diperiksa otomatis setelah dipilih. Maksimal 50 MB, format cadangan versi 1/skema 5.</p>
      {fileName && <p className="break-all text-xs text-ink-muted">File: {fileName}</p>}
      {preview && <><p className="text-sm font-semibold">Cadangan {new Date(preview.createdAt).toLocaleString('id-ID')} · Semua relasi dan keutuhan file telah diperiksa.</p><div className="table-scroll max-h-80" tabIndex={0} role="region" aria-label="Perbandingan data cadangan"><table className="data-table"><thead><tr><th scope="col">Jenis data</th><th scope="col">Sekarang</th><th scope="col">Cadangan</th></tr></thead><tbody>{BACKUP_TABLES.map((key, i) => <tr key={key}><td>{labels[i]}</td><td>{preview.currentCounts[key]}</td><td>{preview.counts[key]}</td></tr>)}</tbody></table></div>
        {!!preview.pendingOperations && <p className="rounded-xl bg-warning-soft p-3 text-sm text-warning">Cadangan memuat {preview.pendingOperations} operasi tertunda. Setelah pemulihan, gunakan Periksa hasil/pemulihan operasi. Tidak ada transaksi yang dijalankan otomatis.</p>}
        <label className="flex min-h-12 items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 size-5 shrink-0" checked={approved} disabled={busy} onChange={(e) => setApproved(e.target.checked)} /><span>Saya telah menyimpan file cadangan data sekarang, membaca perbandingan, dan menyetujui penggantian seluruh data pada perangkat/origin ini.</span></label>
        <label><span className="field-label">Ketik PULIHKAN DATA untuk konfirmasi</span><input className="field" autoComplete="off" value={confirmation} disabled={busy} onChange={(e) => setConfirmation(e.target.value)} /></label>
        <Button variant="danger" disabled={busy || !approved || confirmation !== 'PULIHKAN DATA' || !safety.canMaintain() || hasCart} onClick={() => void restore()}>Konfirmasi Pemulihan</Button>
      </>}
      {!safety.canMaintain() && <p className="text-sm leading-6 text-warning">Pemulihan aman tersedia pada build aplikasi melalui HTTPS/localhost setelah aset offline siap, dengan browser yang mendukung perlindungan antar-tab. Jalankan production preview untuk pengujian.</p>}{hasCart && <p className="text-sm text-warning">Keranjang harus kosong sebelum pemulihan.</p>}
    </section>
    {busy && <p role="status" className="text-sm text-brand">Memeriksa, mencadangkan atau memulihkan data. Tunggu hingga selesai…</p>}{error && <p role="alert" className="rounded-xl bg-danger-soft p-4 text-sm text-danger">{error}</p>}{notice && <p role="status" className="rounded-xl bg-success-soft p-4 text-sm text-success">{notice}</p>}
  </div>
}
