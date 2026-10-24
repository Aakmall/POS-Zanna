import { useState } from 'react'
import { DatabaseBackup, FlaskConical, Info, Printer, Store, Users, MonitorDown } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import { useDemoStore } from '../../hooks/useDemoStore'
import { BackupPanel } from './BackupPanel'
import { AppOfflinePanel } from './AppOfflinePanel'

const sections = [
  { id: 'store', label: 'Informasi warung', icon: Store },
  { id: 'users', label: 'Pengguna', icon: Users },
  { id: 'printer', label: 'Printer', icon: Printer },
  { id: 'backup', label: 'Backup & Pemulihan', icon: DatabaseBackup },
  { id: 'app', label: 'Aplikasi & Offline', icon: MonitorDown },
  { id: 'about', label: 'Informasi aplikasi', icon: Info },
] as const
type Section = typeof sections[number]['id']

export function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('bagian')
  const section: Section = sections.some((item) => item.id === requested) ? requested as Section : 'store'
  const setSection = (value: Section) => setParams({ bagian: value })
  const { cart } = useDemoStore()
  const [name, setName] = useState('Zanna-Cell')
  const [address, setAddress] = useState('Alamat warung contoh — belum diatur')
  const [paper, setPaper] = useState('58')
  const [notice, setNotice] = useState('')
  return <><PageHeader title="Pengaturan" description="Cadangan, pemulihan, instalasi dan offline. Informasi warung/printer masih simulasi." />
    <div className="grid items-start gap-6 xl:grid-cols-[230px_minmax(0,1fr)]"><nav aria-label="Bagian pengaturan" className="panel flex flex-wrap gap-2 p-3 xl:flex-col">{sections.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={section === id} onClick={() => { setSection(id); setNotice('') }} className={`flex min-h-12 items-center gap-2 rounded-control px-3 text-left text-sm font-medium ${section === id ? 'bg-brand-soft text-brand' : 'text-ink-muted hover:bg-surface-muted'}`}><Icon size={17} aria-hidden="true" />{label}</button>)}</nav>
      <section className="panel p-5 sm:p-7" aria-label={sections.find((item) => item.id === section)?.label}>
        {notice && <p role="status" className="mb-5 rounded-xl bg-success-soft p-4 text-sm text-success">{notice}</p>}
        {section === 'store' && <form className="max-w-xl space-y-5" onSubmit={(event) => { event.preventDefault(); if (name.trim().length < 2 || !address.trim()) { setNotice('Isi nama warung minimal 2 karakter dan alamat yang tidak kosong.'); return } setNotice('Informasi warung disimpan dalam simulasi halaman ini. Header aplikasi tetap memakai identitas Zanna-Cell.'); }}><div><h2 className="text-lg font-semibold">Informasi warung</h2><p className="mt-2 text-sm leading-6 text-ink-muted">Pratinjau form identitas usaha untuk fase integrasi berikutnya.</p></div><label className="block"><span className="field-label">Nama tampilan warung</span><input className="field" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={80} /></label><label className="block"><span className="field-label">Alamat contoh</span><textarea className="field" value={address} onChange={(event) => setAddress(event.target.value)} required rows={3} maxLength={240} /></label><Button type="submit">Simpan simulasi</Button></form>}
        {section === 'users' && <div><h2 className="text-lg font-semibold">Pengguna</h2><p className="mt-2 text-sm leading-6 text-ink-muted">Belum ada autentikasi atau pengelolaan hak akses.</p><div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line p-5"><div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand"><Users size={20} aria-hidden="true" /></span><div><h3 className="text-sm font-semibold">Operator Demo</h3><p className="mt-1 text-xs text-ink-muted">Identitas ilustrasi, tanpa akun login</p></div></div><span className="pill bg-surface-muted text-ink-muted">Peran contoh: pemilik</span></div></div>}
        {section === 'printer' && <div className="max-w-xl"><h2 className="text-lg font-semibold">Printer struk</h2><p className="mt-2 text-sm leading-6 text-ink-muted">Rancangan preferensi cetak. Tidak ada perangkat yang dihubungkan.</p><label className="mt-6 block"><span className="field-label">Lebar kertas contoh</span><select className="field" value={paper} onChange={(event) => setPaper(event.target.value)}><option value="58">58 mm</option><option value="80">80 mm</option></select></label><div className="mt-5 flex flex-wrap gap-3"><Button onClick={() => setNotice(`Preferensi ${paper} mm dipilih pada simulasi. Tidak disimpan permanen.`)}>Simpan simulasi</Button><Button variant="secondary" onClick={() => setNotice(`Uji cetak ${paper} mm hanya simulasi UI. Tidak ada data dikirim ke printer.`)}><Printer size={17} aria-hidden="true" />Simulasi uji cetak</Button></div></div>}
        {section === 'backup' && <BackupPanel hasCart={cart.length > 0} />}
        {section === 'app' && <AppOfflinePanel hasCart={cart.length > 0} />}
        {section === 'about' && <div><FlaskConical size={36} className="mb-4 text-brand" aria-hidden="true" /><h2 className="text-lg font-semibold">Zanna-Cell</h2><p className="mt-2 text-sm text-ink-muted">POS-Zanna · Fase 7 · Laporan dan Produk Lokal</p><dl className="mt-6 grid gap-5 text-sm sm:grid-cols-2"><div><dt className="text-ink-muted">Mode aplikasi</dt><dd className="mt-1 font-semibold">Pengembangan lokal / hak akses belum diterapkan</dd></div><div><dt className="text-ink-muted">Penyimpanan</dt><dd className="mt-1 font-semibold">Master, inventory, penjualan IndexedDB; keranjang di memori</dd></div><div><dt className="text-ink-muted">Backend Spring Boot</dt><dd className="mt-1 font-semibold">Belum diimplementasikan</dd></div><div><dt className="text-ink-muted">PWA dan offline</dt><dd className="mt-1 font-semibold">Tersedia pada build/HTTPS; perlu aset awal</dd></div></dl></div>}
      </section>
    </div>
  </>
}
