import { useRef, useState, useSyncExternalStore } from 'react'
import { pwaRuntime } from '../../pwa/pwaRuntime'
import { appSafety } from '../../services/appSafety'
import { backupService } from '../../services/backupService'
import { Button } from '../../components/ui/Button'

export function AppOfflinePanel({ hasCart }: { hasCart: boolean }) {
  const state = useSyncExternalStore(pwaRuntime.subscribe, pwaRuntime.getSnapshot), [approved, setApproved] = useState(false), [error, setError] = useState(''), guard = useRef(false)
  async function update() {
    if (guard.current || !approved || hasCart) return
    guard.current = true; setError('')
    try { await appSafety.exclusive(async () => { await backupService.assertIdle(); await pwaRuntime.activateUpdate(() => appSafety.updateReady()) }) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Pembaruan belum dapat diterapkan. Coba lagi setelah pekerjaan selesai.') }
    finally { guard.current = false }
  }
  return <div className="space-y-5"><h2 className="text-lg font-semibold">Aplikasi &amp; Offline</h2><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-ink-muted">Jaringan</dt><dd className="mt-1 font-semibold">{state.online ? 'Terhubung' : 'Aplikasi sedang offline'}</dd></div><div><dt className="text-ink-muted">Aset aplikasi</dt><dd className="mt-1 font-semibold">{state.ready ? 'Siap untuk dibuka offline' : 'Belum siap / perlu build dan koneksi awal'}</dd></div></dl>
    <p className="text-sm leading-6 text-ink-muted">Produk, stok, transaksi, pelanggan, Bon, cicilan dan laporan tetap memakai data di perangkat ini. Aset aplikasi disimpan terpisah agar dapat dibuka kembali tanpa internet. Ini bukan sinkronisasi cloud atau cadangan data; perangkat lain tidak menerima data otomatis.</p>
    {state.installed ? <p role="status" className="text-sm text-success">Aplikasi sedang dipakai sebagai aplikasi terpasang.</p> : state.canInstall ? <Button disabled={state.busy} onClick={() => void pwaRuntime.install()}>Pasang POS-Zanna</Button> : <p className="rounded-xl bg-surface-muted p-4 text-sm leading-6 text-ink-muted">Jika browser menyediakan pilihan instalasi, buka menu browser → Pasang aplikasi atau Tambahkan ke layar utama. Tombol instalasi hanya muncul ketika browser mendukungnya. Gunakan HTTPS atau localhost; alamat LAN HTTP biasa belum mendukung PWA.</p>}
    {state.message && <p role="status" className="text-sm text-ink-muted">{state.message}</p>}
    <section className="space-y-4 rounded-xl border border-line p-4"><h3 className="font-semibold">Pembaruan aplikasi</h3>{state.updateAvailable ? <><p className="text-sm leading-6 text-ink-muted">Pembaruan tersedia. Selesaikan pekerjaan, kosongkan keranjang dan tutup jendela POS-Zanna lainnya. Pembaruan tidak menghapus data toko dan tidak dijalankan otomatis.</p><label className="flex min-h-12 items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 size-5" checked={approved} onChange={(e) => setApproved(e.target.checked)} /><span>Semua pekerjaan selesai dan saya menyetujui pembaruan serta muat ulang aplikasi.</span></label><Button disabled={!approved || hasCart || state.busy || !appSafety.canMaintain()} onClick={() => void update()}>Terapkan Pembaruan</Button></> : <p className="text-sm text-ink-muted">Belum ada pembaruan yang menunggu. Aplikasi memeriksa versi saat dibuka dan ketika jaringan kembali tersedia.</p>}{hasCart && <p className="text-sm text-warning">Keranjang masih berisi barang. Selesaikan atau kosongkan sebelum memperbarui.</p>}{error && <p role="alert" className="text-sm text-danger">{error}</p>}</section>
  </div>
}
