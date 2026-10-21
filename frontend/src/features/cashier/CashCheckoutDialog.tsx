import { useState } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { calculateChange } from '../../domain/checkoutMath'
import { quantityText } from '../../domain/quantity'
import { money, parseWholeAmount } from '../../lib/format'
import type { CashState, CheckoutController } from './checkoutController'
import { SaleReceipt } from './SaleReceipt'

export function CashCheckoutDialog({ state, controller }: { state: CashState; controller: CheckoutController }) {
  const [cash, setCash] = useState('')
  const received = parseWholeAmount(cash)
  let change: number | null = null
  try { if (received !== null && state.quote) change = calculateChange(received, state.quote.total) } catch { /* Invalid input disables submission. */ }
  const command = state.command
  return <Dialog title={state.status === 'success' ? 'Struk pembayaran tunai' : 'Pembayaran Tunai'} mode="local" onClose={() => controller.close()}>
    {state.status === 'success' && state.result ? <><SaleReceipt result={state.result} /><Button className="mt-6 w-full" onClick={() => controller.close()}>Tutup struk</Button></> : <div className="space-y-4" data-checkout-status={state.status} aria-busy={state.busy}>
      {state.quote && <><ul className="divide-y divide-line">{state.quote.items.map((item) => <li key={item.variantId} className="py-3 text-sm"><p className="font-semibold">{item.productNameSnapshot} · {item.variantNameSnapshot}</p><div className="mt-1 flex justify-between gap-3 text-xs text-ink-muted"><span>{quantityText(item.quantity)} {item.unitSnapshot.name} × {money(item.unitPriceSnapshot)}</span><strong className="text-ink">{money(item.lineTotal)}</strong></div></li>)}</ul><div className="rounded-xl bg-surface-muted p-4"><p className="text-xs text-ink-muted">Subtotal {money(state.quote.subtotal)} · Tanpa pajak/diskon</p><p className="mt-2 text-2xl font-bold">Total {money(state.quote.total)}</p></div></>}
      {command ? <div className="rounded-xl border border-line p-4 text-sm"><p className="font-semibold">Konfirmasi tersimpan / pemulihan</p><ul className="mt-2 space-y-1 text-xs">{command.lines.map((line) => <li key={line.variantId}>{quantityText(line.quantity)} satuan jual · varian <span className="break-all">{line.variantId}</span> · {money(line.expected.unitPrice)} / satuan</li>)}</ul><p className="mt-2">Total disetujui: {money(command.expectedTotal)}</p><p>Uang diterima: {money(command.cashReceived)}</p><p className="mt-2 break-all text-[10px] text-ink-muted">ID: {command.checkoutOperationId}</p></div> : state.quote && <form onSubmit={(event) => { event.preventDefault(); if (received !== null && change !== null) void controller.confirm(received) }} className="space-y-3">
        <label className="field-label" htmlFor="cash">Uang diterima (Rp)</label><input id="cash" className="field" inputMode="numeric" autoComplete="off" value={cash} disabled={state.busy || state.status !== 'editing'} onChange={(event) => setCash(event.target.value)} aria-describedby="cash-help" />
        <p id="cash-help" className="text-xs text-ink-muted">Rupiah bulat tanpa titik atau koma, maksimal Rp1.000.000.000.</p>
        <Button variant="secondary" disabled={state.busy || state.status !== 'editing'} onClick={() => setCash(String(state.quote!.total))}>Uang pas</Button>
        <p className="text-sm">Kembalian: <strong>{change === null ? '—' : money(change)}</strong></p>
        {cash && change === null && <p role="alert" className="text-xs text-danger">Uang harus valid dan minimal sebesar total pembayaran.</p>}
        <Button type="submit" className="w-full" disabled={state.busy || state.status !== 'editing' || change === null}>Konfirmasi pembayaran tunai</Button>
      </form>}
      {state.busy && <p role="status" className="text-sm text-brand">{state.status === 'preparing' ? 'Menyiapkan intent…' : state.status === 'processing' ? 'Menyimpan pembayaran dan stok…' : 'Memeriksa penyimpanan…'}</p>}
      {state.message && <p role="alert" className="rounded-xl bg-warning-soft p-3 text-sm leading-6 text-warning">{state.code && <strong>{state.code} · </strong>}{state.message}</p>}
      {state.status === 'uncertain' && <p className="text-xs leading-5 text-ink-muted">Modal tetap terbuka sampai status dapat diperiksa. Jangan menerima pembayaran ulang atau menghapus data browser.</p>}
      {command && !state.busy && state.status !== 'uncertain' && <Button className="w-full" onClick={() => void controller.resume()}>Lanjutkan request yang sama</Button>}
      {(command || state.status === 'uncertain') && <Button className="w-full" variant="secondary" disabled={state.busy} onClick={() => void controller.check()}>Periksa hasil transaksi</Button>}
      {command && state.status !== 'uncertain' && <Button className="w-full" variant="secondary" disabled={state.busy} onClick={() => void controller.cancel()}>Batalkan intent untuk koreksi</Button>}
      {!command && state.status === 'rejected' && <Button className="w-full" disabled={state.busy} onClick={() => void controller.refreshQuote()}>Tinjau ulang harga dan stok</Button>}
    </div>}
  </Dialog>
}
