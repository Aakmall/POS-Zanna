import sprite from '../../assets/product-placeholders.svg'
import type { Category, Product, ProductIllustration } from '../../types/pos'

const fallback: Record<Category, ProductIllustration> = {
  Sembako: 'rice', Makanan: 'noodles', Minuman: 'water', Bensin: 'fuel', Solar: 'diesel', Eceran: 'sachet',
}
const tones: Record<Category, string> = {
  Sembako: 'bg-[#f5f4ee]', Makanan: 'bg-[#faf2ec]', Minuman: 'bg-[#eef5f6]',
  Bensin: 'bg-[#f7f4e9]', Solar: 'bg-[#eef4f1]', Eceran: 'bg-[#f4f0f6]',
}

export function ProductArtwork({ product, className = '' }: { product: Product; className?: string }) {
  return (
    <span aria-hidden="true" className={`product-artwork ${tones[product.category]} ${className}`}>
      <svg viewBox="0 0 200 150" focusable="false" className="size-full">
        <use href={`${sprite}#${product.illustration ?? fallback[product.category]}`} />
      </svg>
    </span>
  )
}
