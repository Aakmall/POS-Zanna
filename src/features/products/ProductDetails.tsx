import { Dialog } from '../../components/ui/Dialog'
import { useDemoStore } from '../../hooks/useDemoStore'
import { money } from '../../lib/format'
import { quantityText } from '../../domain/quantity'
import type { Product } from '../../domain/product'

export function ProductDetails({ product: selected, onClose }: { product: Product; onClose: () => void }) {
  const { snapshot } = useDemoStore()
  const product = snapshot.products.find((item) => item.id === selected.id) ?? selected
  const base = snapshot.units.find((item) => item.id === product.baseUnitId)
  return <Dialog mode="local" title={product.name} onClose={onClose} wide>
    <dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-ink-muted">Kategori</dt><dd className="mt-1 font-semibold">{snapshot.categories.find((item) => item.id === product.categoryId)?.name}</dd></div><div><dt className="text-ink-muted">Sumber / status</dt><dd className="mt-1 font-semibold">{product.isDemo ? 'DEMO' : 'Data lokal'} · {product.isActive ? 'Aktif' : 'Nonaktif'}</dd></div><div><dt className="text-ink-muted">Modal per {base?.name}</dt><dd className="mt-1 font-semibold">{product.costPrice === null ? 'Belum diketahui' : money(product.costPrice)}</dd></div><div><dt className="text-ink-muted">Stok minimum</dt><dd className="mt-1 font-semibold">{product.minimumStock === null ? 'Belum diatur' : `${quantityText(product.minimumStock)} ${base?.name}`}</dd></div></dl>
    <p className="mt-5 break-all rounded-xl bg-canvas p-3 text-xs text-ink-muted">UUID produk: {product.id}<br />Dibuat: {product.createdAt}<br />Diubah: {product.updatedAt}</p>
    <h3 className="mt-6 mb-3 font-semibold">Varian jual</h3><ul className="space-y-3">{snapshot.variants.filter((item) => item.productId === product.id).map((variant) => <li key={variant.id} className="rounded-xl border border-line p-4 text-sm"><p className="font-semibold">{variant.name} · {variant.isActive ? 'Aktif' : 'Nonaktif'}</p><p className="mt-2 text-ink-muted">{variant.sellingPrice === null ? 'Harga belum diatur' : money(variant.sellingPrice)} / {snapshot.units.find((item) => item.id === variant.sellingUnitId)?.name}</p><p className="mt-2 text-xs text-ink-muted">Isi: {quantityText(variant.quantityInBaseUnit)} {base?.name} · {variant.saleMode === 'variable' ? 'Jumlah aktual (belum tersedia di Kasir)' : 'Satuan tetap'}</p><p className="mt-2 break-all text-xs text-ink-muted">SKU: {variant.sku ?? '—'} · Barcode: {variant.barcode ?? '—'}</p></li>)}</ul>
    <p className="mt-5 text-xs leading-5 text-warning">Harga modal belum dilindungi hak akses owner. IndexedDB bukan backup permanen.</p>
  </Dialog>
}
