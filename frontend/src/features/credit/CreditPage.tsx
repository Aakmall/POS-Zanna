import { useEffect, useState, useSyncExternalStore } from 'react'
import { useSearchParams } from 'react-router'
import { CreditCard, Plus, Users, Wallet } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { money } from '../../lib/format'
import type { Customer } from '../../domain/customer'
import type { ReceivableStatus } from '../../domain/credit'
import type { CustomerService } from '../../services/customerOperations'
import type { CreditService } from '../../services/creditOperations'
import { customerService } from '../../services/customerService'
import { creditService } from '../../services/creditService'
import { CustomerForm } from './CustomerForm'
import { CustomerDialog } from './CustomerDialog'
import { ReceivableDialog } from './ReceivableDialog'
import { receivableLabels } from './creditLabels'
import { CreditPaymentController } from './paymentController'
import { browserPaymentRecovery, type PaymentRecoveryStore } from './paymentRecovery'
import { CreditPaymentDialog } from './CreditPaymentDialog'
import { useCreditOverview } from './useCredit'

export function CreditPage({ customers = customerService, service = creditService, recovery = browserPaymentRecovery }: { customers?: CustomerService; service?: CreditService; recovery?: PaymentRecoveryStore }) {
  const { data, error, retry } = useCreditOverview(service)
  const [params, setParams] = useSearchParams(), selectedId = params.get('pelanggan'), debtId = params.get('tagihan')
  const [query, setQuery] = useState(''), [active, setActive] = useState('all'), [status, setStatus] = useState<ReceivableStatus | 'all'>('all'), [filterCustomer, setFilterCustomer] = useState('')
  const [editor, setEditor] = useState<{ customer: Customer | null } | null>(null), [notice, setNotice] = useState('')
  const [controller] = useState(() => new CreditPaymentController(service, recovery))
  const payment = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  useEffect(() => { void controller.boot() }, [controller])
  const closeDetail = () => setParams({})
  const selected = data?.customers.find((customer) => customer.id === selectedId)
  const term = query.trim().toLocaleLowerCase('id')
  const matches = (text: string) => text.toLocaleLowerCase('id').includes(term)
  const shownCustomers = data?.customers.filter((customer) => matches(`${customer.name} ${customer.phone}`) && (active === 'all' || customer.isActive === (active === 'active'))) ?? []
  const shownDebts = data?.receivables.filter((debt) => {
    const customer = data.customers.find((entry) => entry.id === debt.customerId)
    return matches(`${customer?.name ?? ''} ${customer?.phone ?? ''} ${debt.customerSnapshot.name} ${debt.receiptNumber}`) && (active === 'all' || customer?.isActive === (active === 'active')) && (!filterCustomer || debt.customerId === filterCustomer) && (status === 'all' || debt.status === status)
  }) ?? []
  return <>
    <PageHeader title="Pelanggan & Bon" description="Pelanggan, tagihan dan pembayaran nyata di perangkat ini. Cicilan menambah penerimaan kas, bukan omzet penjualan baru." action={<Button onClick={() => setEditor({ customer: null })} disabled={payment.open}><Plus size={17} aria-hidden="true" />Tambah pelanggan</Button>} />
    {notice && <p role="status" className="mb-4 rounded-xl bg-success-soft p-3 text-sm text-success">{notice}</p>}
    <div className="mb-5 flex flex-wrap gap-2"><Button variant="secondary" onClick={retry}>Muat ulang Bon</Button>{payment.pending.map((command) => <Button key={command.operationId} variant="secondary" disabled={payment.open || payment.busy || !payment.ready} onClick={() => { closeDetail(); void controller.select(command) }}>Pulihkan pembayaran {command.operationId.slice(0, 8)} · {money(command.amount)}</Button>)}</div>
    {!!payment.pending.length && <p className="mb-4 text-sm text-warning">Periksa seluruh pembayaran yang belum selesai di atas sebelum menerima cicilan baru.</p>}
    {!payment.ready && !payment.open && <p role="status" className="mb-4 text-sm text-ink-muted">Memeriksa pembayaran belum selesai…</p>}
    {error ? <div className="panel p-5"><p role="alert" className="text-sm text-danger">{error}</p><Button className="mt-3" onClick={retry}>Coba lagi</Button></div> : !data ? <p role="status" className="panel p-5 text-sm text-ink-muted">Membaca pelanggan dan Bon…</p> : <>
      <div className="mb-6 grid gap-4 sm:grid-cols-3"><StatCard label="Total Utang" value={money(data.totalOutstanding)} note="Sisa seluruh tagihan, termasuk pelanggan diarsipkan" icon={CreditCard} /><StatCard label="Pelanggan" value={String(data.customers.length)} note={`${data.customers.filter((customer) => customer.isActive).length} aktif`} icon={Users} /><StatCard label="Tagihan belum lunas" value={String(data.receivables.filter((debt) => debt.status !== 'PAID').length)} note="Belum dibayar dan sebagian dibayar" icon={Wallet} /></div>
      <div className="panel mb-6 grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <label><span className="field-label">Cari pelanggan / nomor struk</span><input className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nama, telepon atau nomor struk…" /></label>
        <label><span className="field-label">Status pelanggan</span><select className="field" value={active} onChange={(event) => setActive(event.target.value)}><option value="all">Semua pelanggan</option><option value="active">Aktif</option><option value="archived">Diarsipkan</option></select></label>
        <label><span className="field-label">Tagihan pelanggan</span><select className="field" value={filterCustomer} onChange={(event) => setFilterCustomer(event.target.value)}><option value="">Semua pelanggan</option>{data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{!customer.isActive && ' · Diarsipkan'}</option>)}</select></label>
        <label><span className="field-label">Status tagihan</span><select className="field" value={status} onChange={(event) => setStatus(event.target.value as ReceivableStatus | 'all')}><option value="all">Semua status</option>{Object.entries(receivableLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </div>
      <section aria-label="Daftar pelanggan"><h2 className="mb-3 font-semibold">Pelanggan</h2>{!shownCustomers.length ? <div className="panel"><EmptyState title={data.customers.length ? 'Pelanggan tidak ditemukan' : 'Belum ada pelanggan'} description="Tambahkan pelanggan atau ubah pencarian dan filter." /></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{shownCustomers.map((customer) => <article className="panel p-5" key={customer.id}><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{customer.name}</h3><span className="pill bg-surface-muted text-ink-muted">{customer.isActive ? 'Aktif' : 'Diarsipkan'}</span></div><p className="mt-2 text-xs text-ink-muted">{customer.phone || 'Telepon belum diisi'}</p><p className="mt-4 text-xs text-ink-muted">Sisa Utang</p><p className="mt-1 text-xl font-bold">{money(data.receivables.filter((debt) => debt.customerId === customer.id).reduce((sum, debt) => sum + debt.balance, 0))}</p><Button variant="secondary" className="mt-4" disabled={payment.open} onClick={() => setParams({ pelanggan: customer.id })} aria-label={`Detail pelanggan ${customer.name}`}>Detail pelanggan</Button></article>)}</div>}</section>
      <section aria-label="Daftar tagihan Bon" className="mt-7"><h2 className="mb-3 font-semibold">Tagihan Bon</h2>{!shownDebts.length ? <div className="panel"><EmptyState title="Belum ada tagihan yang sesuai" description="Checkout Bon dari Kasir akan muncul di sini. Coba ubah filter jika sudah mempunyai tagihan." /></div> : <ol className="space-y-3">{shownDebts.map((debt) => <li key={debt.id} className="panel grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto]" data-receivable-id={debt.id}><div className="min-w-0"><p className="font-semibold">{debt.customerSnapshot.name}</p><p className="mt-2 break-all text-xs text-ink-muted">{debt.receiptNumber}</p><p className="mt-2 text-xs text-ink-muted">{new Date(debt.createdAt).toLocaleString('id-ID')} · Jatuh tempo {debt.dueDate ?? 'tidak ditentukan'}</p><span className={`pill mt-3 ${debt.status === 'PAID' ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'}`}>{receivableLabels[debt.status]}</span></div><div className="flex flex-wrap items-center justify-between gap-3 sm:flex-col sm:items-end"><div><p className="text-xs text-ink-muted">Sisa Utang</p><p className="mt-1 text-xl font-bold">{money(debt.balance)}</p><p className="mt-1 text-xs text-ink-muted">Utang awal {money(debt.originalAmount)}</p></div><Button variant="secondary" disabled={payment.open} onClick={() => setParams({ tagihan: debt.id })}>Lihat tagihan &amp; struk</Button></div></li>)}</ol>}</section>
    </>}
    {selectedId && !selected && data && <p role="alert" className="mt-4 text-sm text-danger">Pelanggan tidak ditemukan. <button type="button" className="min-h-11 underline" onClick={closeDetail}>Tutup detail</button></p>}
    {selected && !editor && !payment.open && <CustomerDialog customer={selected} receivables={data?.receivables ?? []} onClose={closeDetail} onEdit={() => { closeDetail(); setEditor({ customer: selected }) }} onDetail={(id) => setParams({ tagihan: id })} />}
    {editor && <CustomerForm customer={editor.customer} service={customers} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setNotice('Pelanggan tersimpan di perangkat ini.'); retry() }} />}
    {debtId && !payment.open && <ReceivableDialog key={debtId} id={debtId} service={service} onClose={closeDetail} locked={controller.locked} onPay={(debt) => { closeDetail(); controller.begin(debt) }} onReceipt={(id) => { closeDetail(); void controller.receipt(id) }} />}
    {payment.open && <CreditPaymentDialog state={payment} controller={controller} />}
    <p className="mt-6 text-xs leading-5 text-ink-muted">Arsip pelanggan mempertahankan histori. Pembayaran dicatat per tagihan, tanpa bunga atau penggabungan otomatis. Omzet = penjualan tunai + Bon; cicilan hanya menambah penerimaan kas. Data lokal belum mempunyai backup otomatis.</p>
  </>
}
