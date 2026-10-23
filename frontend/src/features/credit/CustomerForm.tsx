import { useRef, useState } from 'react'
import type { Customer } from '../../domain/customer'
import type { CustomerService } from '../../services/customerOperations'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'

export function CustomerForm({ customer, service, onClose, onSaved }: { customer: Customer | null; service: CustomerService; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(customer?.name ?? ''), [phone, setPhone] = useState(customer?.phone ?? '')
  const [address, setAddress] = useState(customer?.address ?? ''), [note, setNote] = useState(customer?.note ?? '')
  const [active, setActive] = useState(customer?.isActive ?? true), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const guard = useRef(false)
  return <Dialog title={customer ? 'Edit pelanggan' : 'Tambah pelanggan'} mode="local" onClose={() => { if (!guard.current) onClose() }}>
    <form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault(); if (guard.current) return
      guard.current = true; setBusy(true); setError('')
      try { await service.save({ id: customer?.id, expectedUpdatedAt: customer?.updatedAt, name, phone, address, note, isActive: active }); onSaved() }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Gagal menyimpan pelanggan. Coba lagi.') }
      finally { guard.current = false; setBusy(false) }
    }}>
      <fieldset disabled={busy} className="space-y-4">
        <label className="block"><span className="field-label">Nama pelanggan *</span><input className="field" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="block"><span className="field-label">Telepon (opsional)</span><input className="field" inputMode="tel" maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
        <label className="block"><span className="field-label">Alamat (opsional)</span><textarea className="field min-h-20" maxLength={300} value={address} onChange={(event) => setAddress(event.target.value)} /></label>
        <label className="block"><span className="field-label">Catatan (opsional)</span><textarea className="field min-h-20" maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-brand" checked={active} onChange={(event) => setActive(event.target.checked)} />Pelanggan aktif</label>
        <p className="text-xs leading-5 text-ink-muted">Nonaktifkan untuk mengarsipkan pelanggan. Histori Bon dan pembayaran tetap tersimpan; cicilan tagihan lama tetap dapat diterima.</p>
      </fieldset>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-3"><Button variant="secondary" disabled={busy} onClick={onClose}>Batal</Button><Button type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan pelanggan'}</Button></div>
    </form>
  </Dialog>
}
