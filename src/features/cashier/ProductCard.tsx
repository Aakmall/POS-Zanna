import { Check, Plus } from 'lucide-react'
import { money } from '../../lib/format'
import type { Product } from '../../types/pos'
import { ProductArtwork } from '../../components/ui/ProductArtwork'

interface Props {
  product: Product
  quantity: number
  justAdded: boolean
  onAdd: () => void
}

export function ProductCard({ product, quantity, justAdded, onAdd }: Props) {
  const unavailable = product.price === null || quantity >= product.stock
  const stockLabel = product.stock === 0 ? 'Stok habis' : `Stok ${product.stock}`
  return (
    <article className={`product-card ${justAdded ? 'product-card-added' : ''}`}>
      <div className="relative">
        <ProductArtwork product={product} className="product-card-art" />
        <span className={`product-stock ${product.stock === 0 ? 'bg-danger-soft text-danger' : product.stock <= product.minimumStock ? 'bg-warning-soft text-warning' : 'bg-white/95 text-ink-muted'}`}>{stockLabel}</span>
        {quantity > 0 && <span key={quantity} className="product-count" aria-label={`${quantity} di keranjang`}>{quantity}</span>}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="mb-1 text-[10px] text-ink-muted">{product.category}</p>
        <h3 className="min-h-10 text-[13px] leading-5 font-semibold text-ink">{product.name}</h3>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-1 pt-3">
          <div className="min-w-0">
            <p className={`text-[13px] font-bold ${product.price === null ? 'max-w-24 text-warning' : 'text-ink'}`}>{product.price === null ? 'Harga belum diatur' : money(product.price)}</p>
            <p className="mt-1 text-[10px] text-ink-muted">/ {product.unit}</p>
          </div>
          <button type="button" onClick={onAdd} disabled={unavailable}
            aria-label={`Tambah ${product.name}${product.price === null ? ', harga belum diatur' : product.stock === 0 ? ', stok habis' : ''}`}
            className="product-add">
            {justAdded ? <Check size={19} aria-hidden="true" /> : <Plus size={19} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </article>
  )
}
