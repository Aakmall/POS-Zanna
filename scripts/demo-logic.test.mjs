import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'

// Gunakan compiler yang sudah tersedia; tanpa framework/dependency testing tambahan.
async function loadSource(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
  })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}
const { quoteCart, setCartQuantity } = await loadSource('../src/features/cashier/cartLogic.ts')
const { parseWholeAmount } = await loadSource('../src/lib/format.ts')
const { summarizeSales, groupSalesByDay } = await loadSource('../src/lib/sales.ts')
const { demoProducts } = await loadSource('../src/mocks/products.ts')
const { demoSales } = await loadSource('../src/mocks/business.ts')
const rice = demoProducts.find((product) => product.id === 'p1')

test('kuantitas dibatasi stok, bilangan bulat, dan harga yang telah diatur', () => {
  const cart = setCartQuantity([], rice, 2)
  assert.equal(cart[0].quantity, 2)
  assert.deepEqual(setCartQuantity(cart, rice, 43), cart)
  assert.deepEqual(setCartQuantity(cart, rice, 1.5), cart)
  assert.deepEqual(setCartQuantity(cart, rice, -1), cart)
  assert.deepEqual(setCartQuantity([], demoProducts.find((product) => product.id === 'p10'), 1), [])
  assert.deepEqual(setCartQuantity([], demoProducts.find((product) => product.id === 'p9'), 1), [])
  assert.deepEqual(setCartQuantity(cart, { ...rice, price: null }, 0), [])
})
test('subtotal dan total sesuai harga per satuan, termasuk solar', () => {
  const quote = quoteCart([{ productId: 'p1', quantity: 2 }, { productId: 'p13', quantity: 3 }], demoProducts)
  assert.equal(quote.total, 69000)
  assert.equal(quote.itemCount, 5)
  assert.equal(quote.valid, true)
})
test('kuantitas tetap bisa dikurangi setelah stok atau harga berubah', () => {
  const cart = [{ productId: rice.id, quantity: 5 }]
  const changed = { ...rice, stock: 2, price: null }
  const reduced = setCartQuantity(cart, changed, 4)
  assert.equal(reduced[0].quantity, 4)
  assert.equal(quoteCart(reduced, [changed]).valid, false)
  assert.deepEqual(setCartQuantity(cart, changed, 6), cart)
  assert.deepEqual(setCartQuantity(reduced, changed, 0), [])
})
test('checkout ditolak untuk produk hilang, harga belum diatur, stok berubah, dan keranjang kosong', () => {
  assert.equal(quoteCart([], demoProducts).valid, false)
  assert.equal(quoteCart([{ productId: 'missing', quantity: 1 }], demoProducts).valid, false)
  assert.equal(quoteCart([{ productId: 'p10', quantity: 1 }], demoProducts).valid, false)
  assert.equal(quoteCart([{ productId: 'p1', quantity: 3 }], [{ ...rice, stock: 2 }]).valid, false)
  assert.equal(quoteCart([{ productId: 'p1', quantity: 2 }], [{ ...rice, price: Number.MAX_SAFE_INTEGER }]).valid, false)
})
test('isian uang menolak pecahan, eksponen, negatif, kosong, dan angka tidak aman', () => {
  assert.equal(parseWholeAmount('50000'), 50000)
  assert.equal(parseWholeAmount('0'), 0)
  for (const input of ['', '-1', '1.5', '50.000', '1e6', 'NaN', '9007199254740992']) assert.equal(parseWholeAmount(input), null)
})
test('ringkasan laporan dan pengelompokan harian cocok dengan sampel', () => {
  const today = demoSales.filter((sale) => sale.date === '2026-10-19')
  assert.deepEqual(summarizeSales(today), { revenue: 161000, profit: 37500, count: 2, average: 80500 })
  assert.deepEqual(groupSalesByDay(today), [{ date: '2026-10-19', total: 161000 }])
  assert.deepEqual(summarizeSales([]), { revenue: 0, profit: 0, count: 0, average: 0 })
})
