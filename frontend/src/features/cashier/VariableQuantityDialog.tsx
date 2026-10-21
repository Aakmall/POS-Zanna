import { useState } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { parseQuantity, quantityInput } from '../../domain/quantity'
import type { CartLine, CatalogItem } from '../../types/pos'
import { setCartQuantity } from './cartLogic'

export function VariableQuantityDialog({ product, cart, products, onSave, onClose }: { product: CatalogItem; cart: CartLine[]; products: CatalogItem[]; onSave: (quantity: number) => void; onClose: () => void }) {
  const [text, setText] = useState(() => String(cart.find((line) => line.variantId === product.id)?.quantity ?? 1))
  const scaled = parseQuantity(text)
  const quantity = scaled === null ? null : Number(quantityInput(scaled))
  const candidate = quantity === null ? cart : setCartQuantity(cart, product, quantity, products)
  const valid = quantity !== null && quantity > 0 && candidate !== cart
  return <Dialog title="Jumlah volume / berat" mode="local" onClose={onClose}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (valid && quantity !== null) onSave(quantity) }}><p className="text-sm font-semibold">{product.name}</p><label htmlFor="variable-quantity" className="field-label">Jumlah ({product.unit})</label><input id="variable-quantity" className="field" inputMode="decimal" value={text} onChange={(event) => setText(event.target.value)} autoComplete="off" /><p className="text-xs leading-5 text-ink-muted">Masukkan jumlah aktual maksimal tiga desimal, misalnya 1,5. Konversi mengikuti satuan varian; stok dipakai bersama varian lain.</p>{!valid && <p role="alert" className="text-xs text-danger">Jumlah tidak valid, melampaui stok bersama, atau tidak dapat dikonversi tepat ke satuan dasar.</p>}<Button type="submit" className="w-full" disabled={!valid}>Simpan jumlah</Button></form></Dialog>
}
