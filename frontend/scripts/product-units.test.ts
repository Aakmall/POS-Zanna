import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { builtinUnits } from '../src/data/units'
import { ZannaDatabase } from '../src/data/database'
import { DexieProductRepository } from '../src/data/dexieProductRepository'
import { DexieInventoryRepository } from '../src/data/dexieInventoryRepository'
import { DexieCheckoutRepository } from '../src/data/dexieCheckoutRepository'
import { InventoryService } from '../src/services/inventoryOperations'
import { CheckoutService } from '../src/services/checkoutOperations'
import { parseQuantity } from '../src/domain/quantity'
import { validateVariantUnit } from '../src/domain/validation'
import type { ProductUnitPolicy, VariantDraft } from '../src/domain/product'
import { directUnitPatch, packagingUnitPatch, stockImpact, variantSizeWarning, variantUnitEntry } from '../src/features/products/variantUnits'

const unit = (code: string) => builtinUnits.find((entry) => entry.code === code)!
const fuel: ProductUnitPolicy = { kind: 'fuel', allowedPackagingUnitIds: [unit('botol').id, unit('jeriken').id] }
const general: ProductUnitPolicy = { kind: 'general', allowedPackagingUnitIds: [unit('dus').id] }
function bottle(contents: string) { return { ...packagingUnitPatch(unit('botol').id), quantity: contents } }

for (const code of ['l', 'kg', 'botol', 'bungkus']) test(`penjualan langsung ${code}: konversi 1 tanpa isi manual, mode tetap kompatibel`, () => {
  const base = unit(code), value = directUnitPatch(base, 'variable')
  assert.equal(parseQuantity(value.quantity), 1000)
  assert.equal(value.sellingUnitId, base.id)
  assert.equal(value.saleMode, base.dimension === 'count' ? 'fixed' : 'variable')
  assert.equal(stockImpact(value, base, code === 'l' ? fuel : general, builtinUnits).lines[1], `Menjual 2 ${base.name} mengurangi stok 2 ${base.name}`)
})

for (const [code, contents, second] of [['botol', '1,5', '3'], ['jeriken', '5', '10']]) test(`kemasan ${code} ${contents} L: dua kemasan mengurangi ${second} Liter`, () => {
  const value = { ...packagingUnitPatch(unit(code).id), quantity: contents }
  assert.equal(value.saleMode, 'fixed')
  const impact = stockImpact(value, unit('l'), fuel, builtinUnits)
  assert.equal(impact.issue, null)
  assert.deepEqual(impact.lines, [`Menjual 1 ${unit(code).name} mengurangi stok ${contents} Liter`, `Menjual 2 ${unit(code).name} mengurangi stok ${second} Liter`])
})

test('satuan jual sama dengan dasar wajib 1; data lama salah tidak dinormalisasi saat dibaca', () => {
  const value = { sellingUnitId: unit('l').id, quantity: '1.5', saleMode: 'fixed' as const }
  const before = structuredClone(value)
  assert.equal(variantUnitEntry(value, unit('l'), builtinUnits), 'legacy')
  assert.match(stockImpact(value, unit('l'), fuel, builtinUnits).issue!, /sama wajib 1/)
  assert.throws(() => validateVariantUnit({ baseUnitId: unit('l').id, unitPolicy: fuel }, { sellingUnitId: value.sellingUnitId, quantityInBaseUnit: 1500, saleMode: value.saleMode }, builtinUnits), /sama wajib 1/)
  assert.deepEqual(value, before)
  assert.equal(variantUnitEntry({ ...value, sellingUnitId: unit('pcs').id, quantity: '1' }, unit('bungkus'), builtinUnits), 'legacy')
  assert.equal(variantUnitEntry({ ...value, sellingUnitId: 'satuan-tidak-ditemukan' }, unit('l'), builtinUnits), 'legacy')
})

test('nama 1,5 liter dengan konfigurasi 1 Liter memberi bantuan tanpa mengubah nilai', () => {
  const value = directUnitPatch(unit('l'), 'variable'), before = structuredClone(value)
  assert.match(variantSizeWarning('Bensin 1,5 liter', value, unit('l'), builtinUnits)!, /pengaturan saat ini 1 Liter/)
  assert.equal(stockImpact(value, unit('l'), fuel, builtinUnits).issue, null)
  assert.deepEqual(value, before)
})

test('nama dengan isi benar dan satuan ukur ekuivalen tidak memberi peringatan', () => {
  for (const name of ['Bensin 1,5 liter', 'Bensin 1.5 L', 'Bensin 1500 ml', 'Bensin 1,5L / 1500 mililiter']) assert.equal(variantSizeWarning(name, bottle('1,5'), unit('l'), builtinUnits), null)
  const rice = { sellingUnitId: unit('dus').id, quantity: '5', saleMode: 'fixed' as const }
  assert.equal(variantSizeWarning('Beras 5000 gram', rice, unit('kg'), builtinUnits), null)
  assert.match(variantSizeWarning('Beras 2 kg', rice, unit('kg'), builtinUnits)!, /pengaturan saat ini 5 Kilogram/)
})

test('nama tanpa ukuran, beda dimensi, dan isi belum valid tidak ditebak sebagai kapasitas', () => {
  for (const name of ['Bensin eceran', 'Seri 123', 'Bensin 5 kg']) assert.equal(variantSizeWarning(name, bottle('1'), unit('l'), builtinUnits), null)
  assert.equal(variantSizeWarning('Bensin 5L', bottle(''), unit('l'), builtinUnits), null)
  assert.match(variantSizeWarning('Bensin 5L', bottle('1,5'), unit('l'), builtinUnits)!, /5 Liter/)
})

test('izin kemasan tetap eksplisit; faktor baku Gram lama dibaca tanpa perubahan', () => {
  const denied = stockImpact(bottle('1,5'), unit('l'), { ...fuel, allowedPackagingUnitIds: [] }, builtinUnits)
  assert.match(denied.issue!, /Botol tidak diizinkan/)
  assert.deepEqual(packagingUnitPatch(), { unitEntry: 'packaging', sellingUnitId: '', quantity: '', saleMode: 'fixed' })
  const gram = { sellingUnitId: unit('g').id, quantity: '0.001', saleMode: 'variable' as const }
  const before = structuredClone(gram)
  assert.equal(variantUnitEntry(gram, unit('kg'), builtinUnits), 'metric')
  assert.equal(stockImpact(gram, unit('kg'), general, builtinUnits).issue, null)
  assert.deepEqual(gram, before)
})

test('kemasan tetap terpisah dari volume aktual; pecahan isi satuan diskret tetap ditolak', () => {
  assert.match(stockImpact({ ...bottle('1,5'), saleMode: 'variable' }, unit('l'), fuel, builtinUnits).issue!, /Jumlah aktual hanya/)
  assert.equal(stockImpact(directUnitPatch(unit('l'), 'variable'), unit('l'), fuel, builtinUnits).issue, null)
  assert.match(stockImpact({ ...packagingUnitPatch(unit('dus').id), quantity: '1,5' }, unit('bungkus'), general, builtinUnits).issue!, /diskret/)
})

test('isi kosong, nol, negatif, terlalu presisi, dan terlalu besar tidak menampilkan simulasi sah', () => {
  for (const contents of ['', '0', '-1', '1,2345', '1000001']) {
    const impact = stockImpact(bottle(contents), unit('l'), fuel, builtinUnits)
    assert.ok(impact.issue); assert.deepEqual(impact.lines, [])
  }
})

test('integrasi pengaturan form → repository → inventory/checkout: Botol 1,5 dan Jeriken 5 berbagi stok, snapshot lama tetap', async () => {
  const db = new ZannaDatabase(`product-unit-integration-${crypto.randomUUID()}`)
  try {
    const repository = new DexieProductRepository(db), inventory = new InventoryService(new DexieInventoryRepository(db)), checkout = new CheckoutService(new DexieCheckoutRepository(db))
    await repository.initialize()
    const category = await repository.saveCategory('BBM')
    const values = [bottle('1,5'), { ...packagingUnitPatch(unit('jeriken').id), quantity: '5' }, directUnitPatch(unit('l'), 'variable')]
    const variants: VariantDraft[] = values.map((value, index) => ({ name: ['Bensin 1,5 L', 'Bensin 5 L', 'Liter aktual'][index], sellingUnitId: value.sellingUnitId, quantityInBaseUnit: parseQuantity(value.quantity)!, saleMode: value.saleMode, sellingPrice: [15000, 50000, 10000][index], isActive: true }))
    const product = await repository.saveProduct({ name: 'Bensin', categoryId: category.id, baseUnitId: unit('l').id, unitPolicy: fuel, costPrice: null, costKnown: false, minimumStock: null, isActive: true, variants })
    assert.equal(await db.units.count(), builtinUnits.length)
    assert.equal(db.verno, 3)
    await inventory.execute({ operationId: crypto.randomUUID(), productId: product.id, movementType: 'OPENING_BALANCE', inputQuantity: 20000, inputUnitId: unit('l').id, reason: 'Stok tes' })
    const stored = (await repository.getSnapshot()).variants
    const byName = (name: string) => stored.find((variant) => variant.name === name)!
    const quote = await checkout.preview([{ variantId: byName('Bensin 1,5 L').id, quantity: 2000 }, { variantId: byName('Bensin 5 L').id, quantity: 1000 }, { variantId: byName('Liter aktual').id, quantity: 1250 }])
    const command = { payloadVersion: 1 as const, checkoutOperationId: crypto.randomUUID(), paymentMethod: 'CASH' as const, lines: quote.lines, expectedTotal: quote.total, cashReceived: 100000 }
    await checkout.prepare(command)
    const result = await checkout.execute(command)
    assert.equal(result.sale.total, 92500)
    assert.deepEqual(result.items.map((item) => item.quantityBase), [3000, 5000, 1250])
    assert.equal((await db.inventoryBalances.get(product.id))!.quantityBase, 10750)
    assert.equal((await db.stockMovements.toArray()).filter((movement) => movement.movementType === 'SALE').length, 3)
    assert.equal((await checkout.execute(command)).duplicate, true)
    assert.equal((await db.inventoryBalances.get(product.id))!.quantityBase, 10750)
    const oldItems = await db.saleItems.toArray(), oldLedger = await db.stockMovements.toArray()
    await repository.saveProduct({ ...product, expectedUpdatedAt: product.updatedAt, variants: stored.map((variant) => ({ ...variant, quantityInBaseUnit: variant.name === 'Bensin 1,5 L' ? 2000 : variant.quantityInBaseUnit })) })
    assert.deepEqual(await db.saleItems.toArray(), oldItems)
    assert.deepEqual(await db.stockMovements.toArray(), oldLedger)
    assert.deepEqual((await checkout.getResult(command.checkoutOperationId))!.items, result.items)
    assert.equal((await db.inventoryBalances.get(product.id))!.quantityBase, 10750)
  } finally { await db.delete() }
})
