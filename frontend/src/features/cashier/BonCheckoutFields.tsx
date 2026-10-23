import { useState } from 'react'
import { Link } from 'react-router'
import { customerSnapshot } from '../../domain/customer'
import { Button } from '../../components/ui/Button'
import { useCustomers } from '../credit/useCustomers'
import type { CustomerService } from '../../services/customerOperations'
import type { CashState, CheckoutController } from './checkoutController'

export function BonCheckoutFields({ state, controller, customers }: { state: CashState; controller: CheckoutController; customers?: CustomerService }) {
  const list = useCustomers(customers), [customerId, setCustomerId] = useState(''), [dueDate, setDueDate] = useState('')
  const active = list.customers.filter((customer) => customer.isActive), selected = active.find((customer) => customer.id === customerId)
  return <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (selected) void controller.confirmBon(customerSnapshot(selected), dueDate || null) }}>
    {list.status === 'loading' ? <p role="status" className="text-sm text-ink-muted">Membaca pelanggan…</p> : list.status === 'error' ? <div><p role="alert" className="text-sm text-danger">{list.error}</p><Button variant="secondary" onClick={list.retry}>Muat ulang pelanggan</Button></div> : <>
      <label className="block"><span className="field-label">Pelanggan aktif *</span><select className="field" required value={customerId} disabled={state.busy || state.status !== 'editing'} onChange={(event) => setCustomerId(event.target.value)}><option value="">Pilih pelanggan untuk Bon</option>{active.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ''}</option>)}</select></label>
      {!active.length && <p className="text-sm text-ink-muted">Belum ada pelanggan aktif. <Link to="/bon" className="font-semibold text-brand underline">Tambahkan pelanggan di Pelanggan &amp; Bon</Link>, lalu kembali ke Kasir.</p>}
      <label className="block"><span className="field-label">Jatuh tempo (opsional)</span><input className="field" type="date" value={dueDate} disabled={state.busy || state.status !== 'editing'} onChange={(event) => setDueDate(event.target.value)} /></label>
    </>}
    <p className="rounded-xl bg-warning-soft p-3 text-sm leading-6 text-warning">Bon mencatat seluruh total sebagai utang pelanggan dan mengurangi stok. Tidak menerima uang sekarang. Cicilan atau pelunasan dicatat terpisah di Pelanggan &amp; Bon.</p>
    <Button type="submit" className="w-full" disabled={state.busy || state.status !== 'editing' || list.status !== 'ready' || !selected || !state.quote || state.quote.total <= 0}>Konfirmasi Bon / Bayar Nanti</Button>
  </form>
}
