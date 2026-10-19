import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { useDemoStore } from '../../hooks/useDemoStore'
import { parseWholeAmount } from '../../lib/format'
import { demoId } from '../../lib/demoId'
import { categories, type Product } from '../../types/pos'

export function ProductForm({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: (name: string) => void }) {
  const { products, saveProduct } = useDemoStore()
  const [error, setError] = useState('')
  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name') ?? '').trim()
    const sku = String(data.get('sku') ?? '').trim().toUpperCase()
    const unit = String(data.get('unit') ?? '').trim()
    const category = categories.find((item) => item === data.get('category'))
    const rawPrice = String(data.get('price') ?? '').trim()
    const price = rawPrice === '' ? null : parseWholeAmount(rawPrice)
    const stock = parseWholeAmount(String(data.get('stock') ?? ''))
    const minimumStock = parseWholeAmount(String(data.get('minimumStock') ?? ''))
    if (name.length < 2 || !sku || !unit || !category || stock === null || minimumStock === null || stock > 1000000 || minimumStock > 1000000 || (rawPrice !== '' && (price === null || price > 1000000000))) { setError('Periksa semua isian. Harga harus rupiah bulat (maks. 1 miliar), stok dan batas minimum 0–1.000.000.'); return }
    if (products.some((item) => item.sku.toUpperCase() === sku && item.id !== product?.id)) { setError('Kode produk sudah digunakan. Pakai kode yang berbeda.'); return }
    saveProduct({ id: product?.id ?? demoId('product'), name, sku, unit, category, price, stock, minimumStock, cost: product?.cost ?? null, symbol: product?.symbol ?? name.slice(0, 2).toUpperCase(), illustration: category === product?.category ? product.illustration : undefined })
    onSaved(name)
  }
  return <Dialog title={product ? 'Edit produk demo' : 'Tambah produk demo'} onClose={onClose} wide>
    <form onSubmit={submit} className="space-y-5">
      <p className="text-sm leading-6 text-ink-muted">Perubahan dibagikan ke katalog Kasir dan Stok selama sesi. Tidak disimpan ke database.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className="field-label">Nama produk</span><input name="name" className="field" defaultValue={product?.name} required minLength={2} maxLength={80} /></label>
        <label><span className="field-label">Kode produk</span><input name="sku" className="field" defaultValue={product?.sku} required maxLength={30} placeholder="Contoh: SB-004" /></label>
        <label><span className="field-label">Kategori</span><select name="category" className="field" defaultValue={product?.category ?? categories[0]}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label><span className="field-label">Harga jual DEMO (Rp)</span><input name="price" className="field" inputMode="numeric" defaultValue={product?.price ?? ''} placeholder="Kosong = belum diatur" aria-describedby="price-help" /></label>
        <label><span className="field-label">Satuan</span><input name="unit" className="field" defaultValue={product?.unit} required maxLength={30} placeholder="Contoh: bungkus" /></label>
        <label><span className="field-label">Stok contoh</span><input name="stock" className="field" inputMode="numeric" defaultValue={product?.stock ?? 0} required /></label>
        <label><span className="field-label">Batas stok rendah</span><input name="minimumStock" className="field" inputMode="numeric" defaultValue={product?.minimumStock ?? 5} required /></label>
      </div>
      <p id="price-help" className="text-xs leading-5 text-ink-muted">Harga boleh kosong; produk tanpa harga tidak dapat ditambahkan ke keranjang. Isi angka bulat tanpa pemisah ribuan.</p>
      {error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap justify-end gap-3"><Button variant="secondary" onClick={onClose}>Batal</Button><Button type="submit">Simpan simulasi</Button></div>
    </form>
  </Dialog>
}
