import { useEffect, useRef, useState } from 'react'
import { Banknote, Check, Printer, QrCode } from 'lucide-react'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { money } from '../../lib/format'
import { demoCustomers } from '../../mocks/business'
import type { PaymentMethod } from '../../types/pos'
import type { CartQuote } from './cartLogic'

// Legacy QRIS/Bon simulation only. CashierPage currently disables both methods.
// Real CASH must exclusively use CashCheckoutDialog → CheckoutController → CheckoutService.
export function PaymentDialog({ method, quote, onClose, onComplete }: { method: Exclude<PaymentMethod, 'Tunai'>; quote: CartQuote; onClose: () => void; onComplete: () => void }) {
  const [customer, setCustomer] = useState('')
  const [status, setStatus] = useState<'idle' | 'processing' | 'success'>('idle')
  const [error, setError] = useState('')
  const [printNote, setPrintNote] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const completed = useRef(false)
  const currentQuote = useRef(quote)
  const [resultTotal, setResultTotal] = useState<number | null>(null)
  useEffect(() => { currentQuote.current = quote }, [quote])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  function finish() {
    if (status === 'success' && !completed.current) { completed.current = true; onComplete() }
    else onClose()
  }
  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status !== 'idle') return
    if (!quote.valid) { setError('Keranjang tidak valid. Periksa kembali harga dan stok.'); return }
    if (method === 'Bon' && !customer) { setError('Pilih pelanggan contoh untuk simulasi bon.'); return }
    setError(''); setStatus('processing')
    const signature = JSON.stringify(quote.lines.map((line) => [line.variantId, line.quantity, line.product.price, line.product.isActive, line.product.quantityInBaseUnit, line.product.stockBase]))
    timer.current = window.setTimeout(() => {
      const latest = currentQuote.current
      const latestSignature = JSON.stringify(latest.lines.map((line) => [line.variantId, line.quantity, line.product.price, line.product.isActive, line.product.quantityInBaseUnit, line.product.stockBase]))
      if (!latest.valid || signature !== latestSignature) { setError('Master atau keranjang berubah. Periksa kembali total dan konfirmasi ulang.'); setStatus('idle'); return }
      setResultTotal(quote.total); setStatus('success')
    }, 700)
  }
  return <Dialog title={status === 'success' ? 'Simulasi selesai' : `Pembayaran ${method}`} onClose={finish}>
    {status === 'success' ? <div className="text-center"><span className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-success-soft text-success"><Check size={30} aria-hidden="true" /></span>
      <h3 className="text-xl font-semibold" role="status">Berhasil disimulasikan · DEMO</h3><p className="mt-3 text-sm leading-6 text-ink-muted">Tidak ada pembayaran nyata atau transaksi tersimpan. Stok dan daftar bon tidak berubah.</p>
      <p className="my-6 text-3xl font-bold text-brand">{money(resultTotal ?? 0)}</p>
      {printNote && <p role="status" className="mb-4 rounded-xl bg-brand-soft p-3 text-sm text-brand">Cetak struk hanya simulasi. Tidak ada perintah yang dikirim ke printer.</p>}
      <div className="grid gap-3"><Button variant="secondary" onClick={() => setPrintNote(true)}><Printer size={18} aria-hidden="true" />Simulasikan cetak struk</Button><Button onClick={finish}>Selesai tanpa struk</Button></div>
    </div> : <form onSubmit={submit} className="space-y-5">
      <div className="rounded-xl bg-surface-muted p-5"><p className="text-xs text-ink-muted">Total simulasi · {quote.itemCount} item</p><p className="mt-2 text-3xl font-bold tracking-tight text-ink">{money(quote.total)}</p></div>
      {method === 'QRIS' && <div className="rounded-xl border border-dashed border-line p-5 text-center"><QrCode size={60} strokeWidth={1} className="mx-auto mb-3 text-ink-muted" aria-hidden="true" /><p className="text-sm font-semibold">Pratinjau QRIS DEMO</p><p className="mt-2 text-xs leading-5 text-ink-muted">Ikon ini bukan kode pembayaran. Tidak dapat dipindai dan tidak terhubung ke penyedia QRIS.</p></div>}
      {method === 'Bon' && <div><label htmlFor="credit-customer" className="field-label">Pelanggan contoh</label><select id="credit-customer" className="field" value={customer} onChange={(event) => setCustomer(event.target.value)} disabled={status === 'processing'}><option value="">Pilih pelanggan</option>{demoCustomers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><p className="mt-2 text-xs leading-5 text-ink-muted">Simulasi ini tidak menambahkan utang ke daftar Bon Pelanggan.</p></div>}
      {error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p>}
      <p className="text-xs leading-5 text-ink-muted">DEMO: konfirmasi hanya menampilkan hasil simulasi, tanpa memproses uang.</p>
      <Button type="submit" className="w-full" disabled={status === 'processing' || !quote.valid}><Banknote size={18} aria-hidden="true" />{status === 'processing' ? 'Memproses simulasi…' : 'Konfirmasi simulasi'}</Button>
      {status === 'processing' && <p role="status" className="text-center text-xs text-ink-muted">Menyiapkan hasil DEMO…</p>}
    </form>}
  </Dialog>
}
