import { useRef, useState } from 'react'
import { userError } from '../../lib/userError'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { useDemoStore } from '../../hooks/useDemoStore'
import type { Category } from '../../domain/product'

export function CategoryManager({ onClose }: { onClose: () => void }) {
  const { snapshot, repository } = useDemoStore()
  const [name, setName] = useState(''), [editing, setEditing] = useState<string | undefined>()
  const [confirm, setConfirm] = useState<Category | null>(null)
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false)
  const guard = useRef(false)
  async function run(action: () => Promise<unknown>) {
    if (guard.current) return
    guard.current = true; setBusy(true); setError('')
    try { await action(); setName(''); setEditing(undefined); setConfirm(null); setNotice('Kategori tersimpan di IndexedDB.') }
    catch (cause) { setError(userError(cause, 'Kategori belum berhasil disimpan. Periksa penyimpanan browser lalu coba lagi.')) }
    finally { guard.current = false; setBusy(false) }
  }
  return <Dialog mode="local" title="Kelola kategori" onClose={() => { if (!guard.current) onClose() }}>
    <form className="mb-5 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void run(() => repository.saveCategory(name, editing)) }}><label className="min-w-40 flex-1"><span className="field-label">{editing ? 'Ubah nama kategori' : 'Kategori baru'}</span><input className="field" value={name} required maxLength={60} onChange={(event) => setName(event.target.value)} disabled={busy} /></label><Button type="submit" disabled={busy}>Simpan</Button>{editing && <Button variant="secondary" onClick={() => { setEditing(undefined); setName('') }}>Batal edit</Button>}</form>
    {error && <p role="alert" className="mb-4 text-sm text-danger">{error}</p>}{notice && <p role="status" className="mb-4 text-xs text-success">{notice}</p>}
    {confirm && <div className="mb-4 rounded-xl bg-warning-soft p-4 text-sm"><p>{confirm.isActive ? 'Nonaktifkan' : 'Aktifkan'} kategori {confirm.name}?</p><div className="mt-3 flex gap-2"><Button onClick={() => void run(() => repository.setCategoryActive(confirm.id, !confirm.isActive))} disabled={busy}>Ya, lanjutkan</Button><Button variant="secondary" onClick={() => setConfirm(null)} disabled={busy}>Batal</Button></div></div>}
    <ul className="divide-y divide-line">{snapshot.categories.map((category) => <li key={category.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><span className="text-sm">{category.name} <span className="text-xs text-ink-muted">({category.isActive ? 'aktif' : 'nonaktif'})</span></span><div className="flex gap-2"><Button variant="ghost" onClick={() => { setEditing(category.id); setName(category.name) }} disabled={busy} aria-label={`Edit kategori ${category.name}`}>Edit</Button><Button variant="secondary" onClick={() => setConfirm(category)} disabled={busy} aria-label={`${category.isActive ? 'Nonaktifkan' : 'Aktifkan'} kategori ${category.name}`}>{category.isActive ? 'Nonaktifkan' : 'Aktifkan'}</Button></div></li>)}</ul>
    {!snapshot.categories.length && <p className="text-sm text-ink-muted">Belum ada kategori. Tambahkan kategori pertama untuk mulai membuat produk.</p>}
  </Dialog>
}
