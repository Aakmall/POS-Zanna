import { Banknote, CreditCard, Minus, Plus, QrCode, ShoppingBag, Trash2 } from 'lucide-react'
import { useId } from 'react'
import { Button } from '../../components/ui/Button'
import { ProductMark } from '../../components/ui/ProductMark'
import { money } from '../../lib/format'
import type { PaymentMethod, CatalogItem } from '../../types/pos'
import type { CartQuote } from './cartLogic'

interface Props {
  quote: CartQuote
  method: PaymentMethod
  onMethodChange: (method: PaymentMethod) => void
  onChange: (product: CatalogItem, quantity: number) => void
  onRemove: (id: string) => void
  onClear: () => void
  onPay: () => void
  canIncrease: (product: CatalogItem) => boolean
  locked?: boolean
  onVariable: (product: CatalogItem) => void
}

export function CartPanel({ quote, method, onMethodChange, onChange, onRemove, onClear, onPay, canIncrease, locked = false, onVariable }: Props) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="panel cart-panel">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-5">
        <div><h2 id={titleId} className="font-semibold text-ink">Keranjang belanja</h2><p className="mt-1 text-xs text-ink-muted">Pesanan baru · {quote.itemCount} item</p></div>
        <span className="pill bg-brand-soft text-brand">Tunai / Bon lokal</span>
      </div>
      <div className="cart-items">
        {!quote.lines.length ? (
          <div className="cart-empty">
            <span className="mb-4 flex size-20 items-center justify-center rounded-full bg-brand-soft text-brand"><ShoppingBag size={35} strokeWidth={1.3} aria-hidden="true" /></span>
            <h3 className="text-sm font-semibold">Siap melayani belanja?</h3>
            <p className="mt-2 max-w-52 text-xs leading-6 text-ink-muted">Tambahkan produk dari katalog. Belanja pilihan Anda akan muncul di sini.</p>
          </div>
        ) : quote.lines.map(({ product, quantity, amount, issues }) => (
          <div key={product.id} className="border-b border-line py-4 last:border-0">
            <div className="flex items-start gap-3">
              <ProductMark product={product} small />
              <div className="min-w-0 flex-1"><p className="text-[13px] leading-5 font-semibold">{product.name}</p><p className="mt-1 text-[11px] text-ink-muted">{product.price === null ? 'Harga belum diatur' : money(product.price)} / {product.unit}</p></div>
              <button type="button" className="cart-remove" disabled={locked} aria-label={`Hapus ${product.name}`} onClick={() => onRemove(product.id)}><Trash2 size={16} strokeWidth={1.7} aria-hidden="true" /></button>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              {product.saleMode === 'variable' ? <Button variant="secondary" className="text-xs" disabled={locked} onClick={() => onVariable(product)}>Atur jumlah: {quantity} {product.unit}</Button> : <div className="quantity-control">
                <button type="button" disabled={locked} aria-label={`Kurangi ${product.name}`} onClick={() => onChange(product, quantity - 1)}><Minus size={14} aria-hidden="true" /></button>
                <span key={quantity} className="quantity-value">{quantity}</span>
                <button type="button" aria-label={`Tambah ${product.name}`} onClick={() => onChange(product, quantity + 1)} disabled={locked || !canIncrease(product)}><Plus size={14} aria-hidden="true" /></button>
              </div>}
              <p className="text-[13px] font-semibold tabular-nums">{money(amount)}</p>
            </div>
            {issues.map((issue) => <p key={issue} className="mt-2 text-xs text-danger">{issue}</p>)}
          </div>
        ))}
      </div>
      <div className="mt-auto border-t border-line p-5">
        <div className="flex justify-between text-xs text-ink-muted"><span>Subtotal</span><span className="tabular-nums">{money(quote.total)}</span></div>
        <p className="mt-2 text-[10px] text-ink-muted">Tanpa pajak atau diskon.</p>
        <p className="mt-2 text-[10px] leading-5 text-ink-muted">Harga dan stok diperiksa ulang saat konfirmasi. Keranjang belum mereservasi stok.</p>
        {quote.sharedIssue && <p role="alert" className="mt-2 text-xs text-danger">{quote.sharedIssue}</p>}
        <div className="my-4 flex flex-wrap justify-between gap-2 border-t border-dashed border-line pt-4"><span className="text-sm font-semibold">Total belanja</span><span className="text-xl font-bold tracking-tight tabular-nums">{money(quote.total)}</span></div>
        {quote.itemCount > 0 && !quote.valid && <p className="mb-4 rounded-lg bg-danger-soft p-3 text-xs leading-5 text-danger" role="alert">Harga, stok, atau katalog tidak valid. Sesuaikan atau kosongkan keranjang.</p>}
        <div className="mb-4 grid grid-cols-3 gap-2" role="group" aria-label="Metode pembayaran">
          {([{ name: 'Tunai', icon: Banknote }, { name: 'QRIS', icon: QrCode }, { name: 'Bon', icon: CreditCard }] as const).map(({ name, icon: Icon }) => (
            <button key={name} type="button" disabled={locked || name === 'QRIS'} title={name === 'QRIS' ? 'DEMO dinonaktifkan; belum memproses pembayaran' : name === 'Bon' ? 'Bon / Bayar Nanti untuk pelanggan aktif' : 'Pembayaran tunai tersimpan lokal'} aria-pressed={method === name} onClick={() => onMethodChange(name)} className={`payment-method ${method === name ? 'payment-method-active' : ''}`}><Icon size={17} strokeWidth={1.7} aria-hidden="true" />{name}{name === 'QRIS' && ' DEMO'}</button>
          ))}
        </div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
          <Button variant="secondary" onClick={onClear} disabled={locked || !quote.itemCount} aria-label="Kosongkan keranjang" className="px-3 text-xs">Kosongkan</Button>
          <Button onClick={onPay} disabled={locked || !quote.valid || method === 'QRIS' || (method === 'Bon' && quote.total <= 0)} className="min-w-0 px-2 text-xs">{method === 'Bon' ? 'Catat Bon' : 'Bayar'} {money(quote.total)}</Button>
        </div>
        <p className="mt-3 text-center text-[10px] leading-5 text-ink-muted">Tunai dan Bon tersimpan di perangkat ini. Bon tidak menerima uang saat checkout. QRIS DEMO dinonaktifkan.</p>
      </div>
    </section>
  )
}
