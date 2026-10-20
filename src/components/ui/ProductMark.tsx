import type { CatalogItem } from '../../types/pos'
import { ProductArtwork } from './ProductArtwork'

export function ProductMark({ product, small = false }: { product: CatalogItem; small?: boolean }) {
  return <ProductArtwork product={product} className={small ? 'size-12 rounded-lg' : 'size-16 rounded-xl'} />
}

