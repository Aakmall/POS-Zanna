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
}

export function CartPanel({ quote, method, onMethodChange, onChange, onRemove, onClear, onPay }: Props) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="panel cart-panel">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-5">
        <div><h2 id={titleId} className="font-semibold text-ink">Keranjang belanja</h2><p className="mt-1 text-xs text-ink-muted">Pesanan baru · {quote.itemCount} item</p></div>
        <span className="pill bg-brand-soft text-brand">DEMO</span>
      </div>
      <div className="cart-items">
        {!quote.lines.length ? (
          <div className="cart-empty">
            <span className="mb-4 flex size-20 items-center justify-center rounded-full bg-brand-soft text-brand"><ShoppingBag size={35} strokeWidth={1.3} aria-hidden="true" /></span>
            <h3 className="text-sm font-semibold">Siap melayani belanja?</h3>
            <p className="mt-2 max-w-52 text-xs leading-6 text-ink-muted">Tambahkan produk dari katalog. Belanja pilihan Anda akan muncul di sini.</p>
          </div>
        ) : quote.lines.map(({ product, quantity, amount }) => (
          <div key={product.id} className="border-b border-line py-4 last:border-0">
            <div className="flex items-start gap-3">
              <ProductMark product={product} small />
              <div className="min-w-0 flex-1"><p className="text-[13px] leading-5 font-semibold">{product.name}</p><p className="mt-1 text-[11px] text-ink-muted">{product.price === null ? 'Harga belum diatur' : money(product.price)} / {product.unit}</p></div>
              <button type="button" className="cart-remove" aria-label={`Hapus ${product.name}`} onClick={() => onRemove(product.id)}><Trash2 size={16} strokeWidth={1.7} aria-hidden="true" /></button>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="quantity-control">
                <button type="button" aria-label={`Kurangi ${product.name}`} onClick={() => onChange(product, quantity - 1)}><Minus size={14} aria-hidden="true" /></button>
                <span key={quantity} className="quantity-value">{quantity}</span>
                <button type="button" aria-label={`Tambah ${product.name}`} onClick={() => onChange(product, quantity + 1)} disabled={(product.stock !== null && quantity >= product.stock) || quantity >= 1_000_000 || product.price === null || product.isActive === false}><Plus size={14} aria-hidden="true" /></button>
              </div>
              <p className="text-[13px] font-semibold tabular-nums">{money(amount)}</p>
            </div>
            {product.stock !== null && quantity > product.stock && <p className="mt-2 text-xs text-danger">Kuantitas melebihi stok DEMO. Kurangi atau hapus produk.</p>}
            {product.isActive === false && <p className="mt-2 text-xs text-danger">Produk/varian nonaktif. Hapus dari keranjang sebelum melanjutkan.</p>}
          </div>
        ))}
      </div>
      <div className="mt-auto border-t border-line p-5">
        <div className="flex justify-between text-xs text-ink-muted"><span>Subtotal</span><span className="tabular-nums">{money(quote.total)}</span></div>
        <p className="mt-2 text-[10px] text-ink-muted">Tanpa pajak atau diskon pada simulasi ini.</p>
        <p className="mt-2 text-[10px] leading-5 text-ink-muted">Nama dan harga mengikuti master lokal terbaru. Periksa kembali total sebelum Bayar. Keranjang hanya di memori; stok tidak diubah.</p>
        <div className="my-4 flex flex-wrap justify-between gap-2 border-t border-dashed border-line pt-4"><span className="text-sm font-semibold">Total belanja</span><span className="text-xl font-bold tracking-tight tabular-nums">{money(quote.total)}</span></div>
        {quote.itemCount > 0 && !quote.valid && <p className="mb-4 rounded-lg bg-danger-soft p-3 text-xs leading-5 text-danger" role="alert">Harga, stok, atau katalog tidak valid. Sesuaikan atau kosongkan keranjang.</p>}
        <div className="mb-4 grid grid-cols-3 gap-2" role="group" aria-label="Metode pembayaran DEMO">
          {([{ name: 'Tunai', icon: Banknote }, { name: 'QRIS', icon: QrCode }, { name: 'Bon', icon: CreditCard }] as const).map(({ name, icon: Icon }) => (
            <button key={name} type="button" aria-pressed={method === name} onClick={() => onMethodChange(name)} className={`payment-method ${method === name ? 'payment-method-active' : ''}`}><Icon size={17} strokeWidth={1.7} aria-hidden="true" />{name}</button>
          ))}
        </div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
          <Button variant="secondary" onClick={onClear} disabled={!quote.itemCount} aria-label="Kosongkan keranjang" className="px-3 text-xs">Kosongkan</Button>
          <Button onClick={onPay} disabled={!quote.valid} className="min-w-0 px-2 text-xs">Bayar {money(quote.total)}</Button>
        </div>
        <p className="mt-3 text-center text-[10px] leading-5 text-ink-muted">Pembayaran simulasi · Tidak memproses uang</p>
      </div>
    </section>
  )
}

