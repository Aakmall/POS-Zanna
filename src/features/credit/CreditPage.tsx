import { useState } from 'react'
import { CreditCard, Users, Wallet } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { demoCustomers } from '../../mocks/business'
import { money } from '../../lib/format'
import type { DemoCustomer } from '../../types/pos'
import { CustomerDialog } from './CustomerDialog'

const balanceOf = (customer: DemoCustomer) => customer.entries.reduce((sum, entry) => sum + entry.amount, 0) - customer.paid
export function CreditPage() {
  const [customers, setCustomers] = useState(() => demoCustomers.map((customer) => ({ ...customer })))
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const current = customers.find((customer) => customer.id === selected)
  const filtered = customers.filter((customer) => customer.name.toLowerCase().includes(query.trim().toLowerCase()))
  return <><PageHeader title="Pelanggan & Bon" description="Ruang untuk melihat saldo dan mencoba pembayaran cicilan dengan pelanggan fiktif." />
    <div className="mb-6 grid gap-4 sm:grid-cols-3"><StatCard label="Sisa bon DEMO" value={money(customers.reduce((sum, customer) => sum + balanceOf(customer), 0))} note="Jumlah saldo pelanggan contoh" icon={CreditCard} /><StatCard label="Pelanggan contoh" value={String(customers.length)} note="Nama dan kontak adalah ilustrasi" icon={Users} /><StatCard label="Masih memiliki bon" value={String(customers.filter((customer) => balanceOf(customer) > 0).length)} note="Pelanggan dengan saldo lebih dari nol" icon={Wallet} /></div>
    {notice && <p role="status" className="mb-5 rounded-xl bg-success-soft p-4 text-sm text-success">{notice}</p>}
    <div className="panel mb-5 p-4"><label htmlFor="customer-search" className="sr-only">Cari pelanggan contoh</label><input id="customer-search" className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama pelanggan…" /></div>
    {!filtered.length ? <div className="panel"><EmptyState title="Pelanggan tidak ditemukan" description="Coba nama pelanggan contoh lainnya." /></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((customer) => <article key={customer.id} className="panel p-5"><div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand" aria-hidden="true">{customer.name.split(' ').map((word) => word[0]).join('')}</span><div><h2 className="font-semibold">{customer.name}</h2><p className="mt-1 text-xs text-ink-muted">{customer.phone} · contoh</p></div></div><div className="my-6"><p className="text-xs text-ink-muted">Sisa bon DEMO</p><p className="mt-2 text-2xl font-semibold">{money(balanceOf(customer))}</p></div><div className="flex items-center justify-between gap-3"><span className={`pill ${balanceOf(customer) > 0 ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success'}`}>{balanceOf(customer) > 0 ? 'Belum lunas' : 'Lunas'}</span><Button variant="secondary" onClick={() => setSelected(customer.id)} aria-label={`Lihat rincian bon ${customer.name}`}>Rincian</Button></div></article>)}</div>}
    <p className="mt-5 text-xs leading-5 text-ink-muted">Saldo dan cicilan sesi halaman ini akan kembali ke sampel ketika Anda meninggalkan halaman. Checkout Bon di Kasir tidak mengubah data ini.</p>
    {current && <CustomerDialog customer={current} onClose={() => setSelected(null)} onPay={(amount) => { setCustomers((items) => items.map((customer) => customer.id === current.id ? { ...customer, paid: customer.paid + amount } : customer)); setNotice(`Cicilan ${money(amount)} untuk ${current.name} berhasil disimulasikan. Tidak ada pembayaran nyata.`); setSelected(null) }} />}
  </>
}


