import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import type { Receivable } from '../../domain/credit'
import type { CreditService } from '../../services/creditOperations'
import { money } from '../../lib/format'
import { SaleReceipt } from '../cashier/SaleReceipt'
import { useReceivableDetail } from './useCredit'
import { receivableLabels } from './creditLabels'

export function ReceivableDialog({ id, service, onClose, onPay, onReceipt, locked }: { id: string; service: CreditService; onClose: () => void; onPay: (receivable: Receivable) => void; onReceipt: (operationId: string) => void; locked: boolean }) {
  const { data, error, retry } = useReceivableDetail(id, service)
  return <Dialog title="Detail tagihan Bon" mode="local" onClose={onClose}>
    {error ? <div><p role="alert" className="text-sm text-danger">{error}</p><Button variant="secondary" className="mt-3" onClick={retry}>Coba lagi</Button></div> : !data ? <p role="status" className="text-sm text-ink-muted">Membaca tagihan dan pembayaran…</p> : <div className="space-y-6">
      <div className="rounded-xl bg-brand-soft p-4"><p className="text-sm font-semibold">{data.receivable.customerSnapshot.name} · {receivableLabels[data.receivable.status]}</p><p className="mt-2 text-xs text-ink-muted">Sisa Utang terkini</p><p className="mt-1 text-2xl font-bold text-brand">{money(data.receivable.balance)}</p><p className="mt-2 text-xs">Utang awal {money(data.receivable.originalAmount)} · Dibayar {money(data.receivable.totalPaid)}</p><p className="mt-2 text-xs">Jatuh tempo: {data.receivable.dueDate ?? 'Tidak ditentukan'}</p></div>
      {data.receivable.balance > 0 && <Button className="w-full" disabled={locked} onClick={() => onPay(data.receivable)}>Bayar Cicilan</Button>}
      <section aria-label="Riwayat pembayaran Bon"><h3 className="mb-3 font-semibold">Riwayat pembayaran</h3>{!data.payments.length ? <p className="text-sm text-ink-muted">Belum ada pembayaran.</p> : <ul className="divide-y divide-line">{data.payments.map((payment) => <li key={payment.id} className="space-y-2 py-3 text-sm"><p className="font-semibold">{money(payment.amount)} · Tunai</p><p className="text-xs text-ink-muted">{new Date(payment.createdAt).toLocaleString('id-ID')} · Sisa setelah pembayaran ini {money(payment.balanceAfter)}</p><Button variant="secondary" disabled={locked} onClick={() => onReceipt(payment.operationId)}>Buka bukti pembayaran</Button></li>)}</ul>}</section>
      <div className="border-t border-line pt-5"><h3 className="mb-4 font-semibold">Struk pembelian historis</h3><SaleReceipt result={data.sale} /></div>
      <p className="text-xs leading-5 text-ink-muted">Tagihan hanya-baca. Riwayat pembayaran tidak dapat diedit atau dihapus melalui aplikasi. Tutup lalu buka kembali untuk membaca saldo terbaru.</p>
    </div>}
  </Dialog>
}
