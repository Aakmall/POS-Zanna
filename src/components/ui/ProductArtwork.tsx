import sprite from '../../assets/product-placeholders.svg'
import type { CatalogItem, ProductIllustration } from '../../types/pos'

const fallback: Record<string, ProductIllustration> = {
  Sembako: 'rice', Makanan: 'noodles', Minuman: 'water', Bensin: 'fuel', Solar: 'diesel', Eceran: 'sachet',
}
const tones: Record<string, string> = {
  Sembako: 'bg-[#f5f4ee]', Makanan: 'bg-[#faf2ec]', Minuman: 'bg-[#eef5f6]',
  Bensin: 'bg-[#f7f4e9]', Solar: 'bg-[#eef4f1]', Eceran: 'bg-[#f4f0f6]',
}

export function ProductArtwork({ product, className = '' }: { product: CatalogItem; className?: string }) {
  return (
    <span aria-hidden="true" className={`product-artwork ${tones[product.category] ?? 'bg-surface-muted'} ${className}`}>
      <svg viewBox="0 0 200 150" focusable="false" className="size-full">
        <use href={`${sprite}#${product.illustration ?? fallback[product.category] ?? 'sachet'}`} />
      </svg>
    </span>
  )
}

