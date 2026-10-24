import { Component, type PropsWithChildren } from 'react'
import { Link } from 'react-router'
import { Button } from './Button'

export class PageErrorBoundary extends Component<PropsWithChildren<{ scope?: 'app' | 'page' }>, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }

  render() {
    if (!this.state.failed) return this.props.children
    return <section role="alert" className="panel m-4 space-y-4 p-6">
      <h1 className="text-lg font-semibold">Halaman belum dapat ditampilkan</h1>
      <p className="text-sm leading-6 text-ink-muted">Ada bagian aplikasi yang gagal dimuat. Periksa jaringan atau kesiapan offline, lalu buka kembali halaman ini. Jangan hapus data browser.</p>
      <p className="text-sm leading-6 text-ink-muted">Jika pembayaran sempat dikonfirmasi, periksa pemulihan transaksi atau riwayat sebelum membuat pembayaran baru. Memuat ulang akan menutup form dan mengosongkan keranjang yang belum disimpan.</p>
      <div className="flex flex-wrap items-center gap-4">
        {this.props.scope !== 'app' && <Link className="text-sm font-semibold text-brand underline" to="/dashboard">Kembali ke Dashboard</Link>}
        <Button variant="secondary" onClick={() => {
          if (window.confirm('Muat ulang aplikasi? Form dan keranjang yang belum disimpan akan ditutup. Transaksi tersimpan tetap ada; periksa pemulihan sebelum membayar ulang.')) window.location.reload()
        }}>Muat ulang aplikasi</Button>
      </div>
    </section>
  }
}
