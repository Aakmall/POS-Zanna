import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { displayDate, money, parseWholeAmount } from '../../lib/format'
import type { DemoCustomer } from '../../types/pos'

export function CustomerDialog({ customer, onClose, onPay }: { customer: DemoCustomer; onClose: () => void; onPay: (amount: number) => void }) {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const total = customer.entries.reduce((sum, entry) => sum + entry.amount, 0)
  const balance = total - customer.paid
  return <Dialog title={`Bon · ${customer.name}`} onClose={onClose}>
    <div className="rounded-xl bg-surface-muted p-5"><p className="text-xs text-ink-muted">Sisa bon contoh</p><p className="mt-2 text-3xl font-bold text-ink">{money(balance)}</p><p className="mt-2 text-xs text-ink-muted">Sudah dibayar contoh: {money(customer.paid)}</p></div>
    <h3 className="mt-6 mb-3 text-sm font-semibold">Rincian utang DEMO</h3><ul className="divide-y divide-line">{customer.entries.map((entry) => <li key={entry.id} className="py-3"><div className="flex justify-between gap-3 text-xs"><span className="text-ink-muted">{displayDate(entry.date)}</span><strong>{money(entry.amount)}</strong></div><p className="mt-2 text-sm">{entry.description}</p></li>)}</ul>
    {balance > 0 ? <form className="mt-5 space-y-4 border-t border-line pt-5" onSubmit={(event) => {
      event.preventDefault()
      const payment = parseWholeAmount(amount)
      if (payment === null || payment <= 0 || payment > balance) { setError('Isi cicilan rupiah bulat lebih dari nol dan tidak melebihi sisa bon.'); return }
      onPay(payment)
    }}><label className="block"><span className="field-label">Simulasi cicilan tunai (Rp)</span><input className="field" inputMode="numeric" placeholder="Contoh: 25000" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>{error && <p role="alert" className="text-sm text-danger">{error}</p>}<p className="text-xs leading-5 text-ink-muted">Hanya mengurangi saldo contoh di halaman ini, tanpa menerima uang atau menyimpan pembayaran nyata.</p><Button type="submit" className="w-full">Simulasikan pembayaran cicilan</Button></form> : <p role="status" className="mt-5 rounded-xl bg-success-soft p-4 text-sm text-success">Bon contoh ini sudah lunas.</p>}
  </Dialog>
}
