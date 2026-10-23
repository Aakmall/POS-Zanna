import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { money } from '../../lib/format'
import { parseRupiah } from '../../domain/quantity'
import type { CreditPayment } from '../../domain/credit'
import type { CreditPaymentController, PaymentState } from './paymentController'

export function CreditPaymentReceipt({ payment }: { payment: CreditPayment }) {
  return <section aria-label="Bukti pembayaran Bon tersimpan" className="space-y-4 text-sm">
    <h3 className="text-xl font-bold">Zanna-Cell · Bukti pembayaran Bon</h3>
    <dl className="space-y-2"><div><dt className="text-xs text-ink-muted">Nomor bukti</dt><dd className="break-all font-semibold">{payment.receiptNumber}</dd></div><div><dt className="text-xs text-ink-muted">Struk pembelian</dt><dd className="break-all">{payment.saleReceiptNumber}</dd></div><div><dt className="text-xs text-ink-muted">Pelanggan saat pembelian</dt><dd>{payment.customerSnapshot.name}</dd></div><div><dt className="text-xs text-ink-muted">Tanggal pembayaran</dt><dd>{new Date(payment.createdAt).toLocaleString('id-ID')}</dd></div><div className="flex justify-between"><dt>Metode</dt><dd>Tunai</dd></div><div className="flex justify-between"><dt>Sisa sebelum pembayaran</dt><dd>{money(payment.balanceBefore)}</dd></div><div className="flex justify-between text-lg font-bold text-brand"><dt>Dibayar</dt><dd>{money(payment.amount)}</dd></div><div className="flex justify-between font-semibold"><dt>Sisa setelah pembayaran ini</dt><dd>{money(payment.balanceAfter)}</dd></div></dl>
    <p className="text-xs leading-5 text-ink-muted">Bukti historis, bukan saldo terkini. Pembayaran ini tidak menambah omzet atau mengurangi stok lagi.</p>
  </section>
}
export function CreditPaymentDialog({ state, controller }: { state: PaymentState; controller: CreditPaymentController }) {
  const [amount, setAmount] = useState(''), parsed = parseRupiah(amount)
  const valid = parsed !== null && parsed > 0 && !!state.receivable && parsed <= state.receivable.balance
  return <Dialog title={state.result ? 'Bukti pembayaran Bon' : 'Bayar Cicilan'} mode="local" onClose={() => controller.close()}>
    <div className="space-y-4" data-payment-status={state.status} aria-busy={state.busy}>
      {state.result ? <><CreditPaymentReceipt payment={state.result.payment} /><Button className="w-full" onClick={() => controller.close()}>Tutup bukti pembayaran</Button></> : <>
        {state.command ? <div className="rounded-xl bg-surface-muted p-4 text-sm"><p className="font-semibold">Konfirmasi pembayaran tersimpan</p><p className="mt-2">Nominal: {money(state.command.amount)}</p><p>Sisa utang saat konfirmasi: {money(state.command.expectedBalance)}</p><p className="mt-2 break-all text-xs">ID: {state.command.operationId}</p></div> : state.receivable && <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (valid && parsed !== null) void controller.confirm(parsed) }}>
          <div className="rounded-xl bg-surface-muted p-4"><p className="font-semibold">{state.receivable.customerSnapshot.name}</p><p className="mt-2 text-sm">Sisa Utang: <strong>{money(state.receivable.balance)}</strong></p><p className="mt-2 break-all text-xs text-ink-muted">{state.receivable.receiptNumber}</p></div>
          <label className="block"><span className="field-label">Nominal cicilan tunai (Rp)</span><input className="field" inputMode="numeric" required disabled={state.busy} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Contoh: 25000" /></label>
          <Button variant="secondary" disabled={state.busy} onClick={() => setAmount(String(state.receivable!.balance))}>Isi pelunasan penuh</Button>
          {amount && !valid && <p role="alert" className="text-sm text-danger">Isi rupiah bulat lebih dari nol dan tidak melebihi Sisa Utang.</p>}
          <p className="text-xs leading-5 text-ink-muted">Pastikan uang sudah diterima sebelum konfirmasi. Sistem mencatat nominal tepat tanpa kembalian. Jika proses terputus, periksa hasil pembayaran ini sebelum menerima uang lagi.</p>
          <Button type="submit" className="w-full" disabled={!valid || state.busy}>Konfirmasi pembayaran Bon</Button>
        </form>}
        {state.busy && <p role="status" className="text-sm text-brand">Memeriksa atau menyimpan pembayaran…</p>}
        {state.error && <p role="alert" className="rounded-xl bg-warning-soft p-3 text-sm leading-6 text-warning">{state.error}</p>}
        {(state.command || state.status === 'uncertain') && <Button variant="secondary" className="w-full" disabled={state.busy} onClick={() => void controller.check()}>Periksa hasil pembayaran</Button>}
        {state.command && state.status === 'pending' && <Button className="w-full" disabled={state.busy} onClick={() => void controller.resume()}>Lanjutkan pembayaran yang sama</Button>}
        {state.command && state.status !== 'uncertain' && <Button variant="secondary" className="w-full" disabled={state.busy} onClick={() => void controller.cancel()}>Batalkan intent pembayaran</Button>}
      </>}
    </div>
  </Dialog>
}
