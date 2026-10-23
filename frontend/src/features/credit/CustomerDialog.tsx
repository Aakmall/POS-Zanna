import type { Customer } from '../../domain/customer'
import type { Receivable } from '../../domain/credit'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { money } from '../../lib/format'

export function CustomerDialog({ customer, receivables, onClose, onEdit, onDetail }: { customer: Customer; receivables: readonly Receivable[]; onClose: () => void; onEdit: () => void; onDetail: (id: string) => void }) {
  const debts = receivables.filter((entry) => entry.customerId === customer.id)
  return <Dialog title={customer.name} mode="local" onClose={onClose}>
    <dl className="space-y-3 text-sm"><div><dt className="text-xs text-ink-muted">Status</dt><dd>{customer.isActive ? 'Aktif' : 'Diarsipkan · tidak bisa membuat Bon baru'}</dd></div><div><dt className="text-xs text-ink-muted">Telepon</dt><dd>{customer.phone || 'Belum diisi'}</dd></div><div><dt className="text-xs text-ink-muted">Alamat</dt><dd className="whitespace-pre-wrap">{customer.address || 'Belum diisi'}</dd></div><div><dt className="text-xs text-ink-muted">Catatan</dt><dd className="whitespace-pre-wrap">{customer.note || 'Belum diisi'}</dd></div><div><dt className="text-xs text-ink-muted">Sisa Utang seluruh tagihan</dt><dd className="mt-1 text-2xl font-bold text-brand">{money(debts.reduce((sum, entry) => sum + entry.balance, 0))}</dd></div></dl>
    <Button variant="secondary" className="mt-5" onClick={onEdit}>Edit / arsipkan pelanggan</Button>
    <h3 className="mt-6 text-sm font-semibold">Riwayat tagihan</h3>
    {!debts.length ? <p className="mt-3 text-sm text-ink-muted">Pelanggan ini belum mempunyai Bon.</p> : <ul className="mt-2 divide-y divide-line">{debts.map((debt) => <li key={debt.id} className="space-y-2 py-3"><p className="break-all text-xs">{debt.receiptNumber}</p><p className="text-sm">Sisa Utang {money(debt.balance)} · {debt.status === 'PAID' ? 'Lunas' : debt.status === 'PARTIAL' ? 'Sebagian dibayar' : 'Belum dibayar'}</p><Button variant="secondary" onClick={() => onDetail(debt.id)}>Lihat tagihan</Button></li>)}</ul>}
  </Dialog>
}
