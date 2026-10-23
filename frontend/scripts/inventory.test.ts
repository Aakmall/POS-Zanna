import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { Dexie } from 'dexie'
import { ZannaDatabase, PRODUCT_SCHEMA_V1 } from '../src/data/database'
import { DexieProductRepository } from '../src/data/dexieProductRepository'
import { DexieInventoryRepository } from '../src/data/dexieInventoryRepository'
import { InventoryService } from '../src/services/inventoryOperations'
import type { InventoryCommand, MovementType } from '../src/domain/inventory'
import type { Product, ProductVariant, Category } from '../src/domain/product'
import { builtinUnits } from '../src/data/units'
import { stockStatus } from '../src/domain/inventoryRules'
import { projectCatalog } from '../src/services/catalogRepository'
import { quoteCart, setCartQuantity } from '../src/features/cashier/cartLogic'
import { inventoryInputOptions } from '../src/services/inventoryInputs'
import { historicalUnitIssue, productUnitIssues } from '../src/domain/inventoryReview'
import { validateProduct, validateVariantUnit } from '../src/domain/validation'

const databases: ZannaDatabase[] = []
after(async () => { for (const db of databases) await db.delete() })
async function fixture(baseCode = 'bungkus') {
  const db = new ZannaDatabase(`inventory-test-${crypto.randomUUID()}`)
  databases.push(db)
  const products = new DexieProductRepository(db)
  await products.initialize()
  const category = await products.saveCategory('Inventory test')
  const snapshot = await products.getSnapshot()
  const unit = (code: string) => snapshot.units.find((item) => item.code === code)!.id
  const product = await products.saveProduct({ name: 'Barang uji', categoryId: category.id, baseUnitId: unit(baseCode), unitPolicy: { kind: ['l', 'ml'].includes(baseCode) ? 'fuel' : 'general', allowedPackagingUnitIds: (['l', 'ml'].includes(baseCode) ? ['botol', 'jeriken'] : ['dus']).map(unit) }, costPrice: null, costKnown: false, minimumStock: 5000, isActive: true, variants: [{ name: 'Standar', sellingUnitId: unit(baseCode), quantityInBaseUnit: 1000, sellingPrice: 13000, saleMode: 'fixed', isActive: true }] })
  const repository = new DexieInventoryRepository(db)
  const service = new InventoryService(repository)
  const command = (type: MovementType, quantity: number, extra: Partial<InventoryCommand> = {}): InventoryCommand => ({ operationId: crypto.randomUUID(), productId: product.id, movementType: type, inputQuantity: quantity, inputUnitId: product.baseUnitId, reason: type.startsWith('ADJUSTMENT') ? 'Koreksi penghitungan' : '', ...extra })
  return { db, products, product, repository, service, unit, command }
}
async function assertLedger(f: Awaited<ReturnType<typeof fixture>>, expected: number) {
  const balances = await f.service.getBalances(), records = await f.service.getHistory(f.product.id)
  assert.equal(balances[0].quantityBase, expected)
  assert.equal(records.reduce((sum, item) => sum + item.quantityDeltaBase, 0), expected)
  for (const record of records) assert.equal(record.quantityBeforeBase + record.quantityDeltaBase, record.quantityAfterBase)
}

test('NOT_INITIALIZED berbeda dari nol; stok awal 0 sah dan hanya sekali', async () => {
  const f = await fixture()
  assert.equal(stockStatus(undefined, null), 'NOT_INITIALIZED')
  assert.equal((await f.service.getBalances()).length, 0)
  await f.service.execute(f.command('OPENING_BALANCE', 0))
  const balance = (await f.service.getBalances())[0]
  assert.equal(stockStatus(balance, 5000), 'OUT_OF_STOCK')
  assert.equal((await f.service.getHistory(f.product.id))[0].movementType, 'OPENING_BALANCE')
  await assert.rejects(f.service.execute(f.command('OPENING_BALANCE', 30000)), /sudah diatur/)
  await assertLedger(f, 0)
})
test('stok awal 30, masuk 10, koreksi keluar 2 menghasilkan 38 dan ledger konsisten', async () => {
  const f = await fixture()
  await f.service.execute(f.command('OPENING_BALANCE', 30000))
  await f.service.execute(f.command('STOCK_IN', 10000))
  await f.service.execute(f.command('ADJUSTMENT_OUT', 2000))
  await assertLedger(f, 38000)
  assert.deepEqual((await f.service.getHistory(f.product.id)).map((item) => item.movementType), ['ADJUSTMENT_OUT', 'STOCK_IN', 'OPENING_BALANCE'])
})
test('stok masuk sebelum awal ditolak; jumlah nol/negatif dan alasan kosong ditolak', async () => {
  const f = await fixture()
  await assert.rejects(f.service.execute(f.command('STOCK_IN', 1000)), /stok awal terlebih dahulu/)
  await assert.rejects(f.service.execute(f.command('OPENING_BALANCE', -1)), /tidak negatif/)
  await f.service.execute(f.command('OPENING_BALANCE', 30000))
  for (const type of ['STOCK_IN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT'] as const) await assert.rejects(f.service.execute(f.command(type, 0)), /lebih besar/)
  await assert.rejects(f.service.execute(f.command('ADJUSTMENT_OUT', 1000, { reason: '  ' })), /Alasan koreksi/)
  await assert.rejects(f.service.execute(f.command('ADJUSTMENT_IN', 1000, { reason: '' })), /Alasan koreksi/)
  await assertLedger(f, 30000)
})
test('koreksi masuk bekerja, keluar berlebihan ditolak tanpa mutasi parsial', async () => {
  const f = await fixture()
  await f.service.execute(f.command('OPENING_BALANCE', 30000))
  await f.service.execute(f.command('ADJUSTMENT_IN', 10000))
  await assert.rejects(f.service.execute(f.command('ADJUSTMENT_OUT', 41000)), /melebihi saldo/)
  await assertLedger(f, 40000)
  assert.equal((await f.service.getHistory(f.product.id)).length, 2)
})
test('idempotency atomik: request sama paralel tidak menggandakan, isi berbeda ditolak', async () => {
  const f = await fixture()
  await f.service.execute(f.command('OPENING_BALANCE', 30000))
  const request = f.command('STOCK_IN', 10000)
  const results = await Promise.all([f.service.execute(request), f.service.execute(request)])
  assert.equal(results.filter((item) => item.duplicate).length, 1)
  assert.equal(results[0].movement.id, results[1].movement.id)
  await assert.rejects(f.service.execute({ ...request, inputQuantity: 20000 }), /isi berbeda/)
  await f.service.execute(f.command('STOCK_IN', 1000))
  const retry = await f.service.execute(request)
  assert.equal(retry.duplicate, true)
  assert.equal(retry.movement.quantityAfterBase, 40000)
  await assertLedger(f, 41000)
})
test('operasi masuk bersamaan tidak lost update; keluar bersamaan tidak negatif', async () => {
  const f = await fixture()
  await f.service.execute(f.command('OPENING_BALANCE', 30000))
  const other = new ZannaDatabase(f.db.name)
  const otherService = new InventoryService(new DexieInventoryRepository(other))
  try {
    await Promise.all([f.service.execute(f.command('STOCK_IN', 10000)), otherService.execute(f.command('STOCK_IN', 5000))])
    await assertLedger(f, 45000)
    const attempts = await Promise.allSettled([f.service.execute(f.command('ADJUSTMENT_OUT', 30000)), otherService.execute(f.command('ADJUSTMENT_OUT', 30000))])
    assert.equal(attempts.filter((item) => item.status === 'fulfilled').length, 1)
    await assertLedger(f, 15000)
  } finally { other.close() }
})
test('dua operasi stok awal bersamaan hanya membuat satu saldo awal', async () => {
  const f = await fixture()
  const attempts = await Promise.allSettled([f.service.execute(f.command('OPENING_BALANCE', 30000)), f.service.execute(f.command('OPENING_BALANCE', 40000))])
  assert.equal(attempts.filter((item) => item.status === 'fulfilled').length, 1)
  assert.equal((await f.service.getHistory(f.product.id)).length, 1)
})
test('2 dus isi 40 = 80 bungkus; snapshot konversi tidak berubah setelah edit varian', async () => {
  const f = await fixture()
  const before = await f.products.getSnapshot()
  const product = await f.products.saveProduct({ ...f.product, expectedUpdatedAt: f.product.updatedAt, variants: [...before.variants, { name: 'Dus isi 40', sellingUnitId: f.unit('dus'), quantityInBaseUnit: 40000, sellingPrice: 500000, saleMode: 'fixed', isActive: true }] })
  const catalog = await f.products.getSnapshot()
  const variant = catalog.variants.find((item) => item.name === 'Dus isi 40')!
  const opening = f.command('OPENING_BALANCE', 2000, { inputUnitId: f.unit('dus'), variantId: variant.id })
  await f.service.execute(opening)
  await assertLedger(f, 80000)
  await f.products.saveProduct({ ...product, expectedUpdatedAt: product.updatedAt, variants: catalog.variants.map((item) => item.id === variant.id ? { ...item, quantityInBaseUnit: 24000, name: 'Dus isi 24' } : item) })
  const record = (await f.service.getHistory(product.id))[0]
  assert.equal(record.conversionSnapshot.quantityInBaseUnit, 40000)
  assert.equal(record.conversionSnapshot.variantName, 'Dus isi 40')
  assert.equal(historicalUnitIssue(record, await f.products.getSnapshot()), null)
  assert.equal((await f.service.execute(opening)).duplicate, true)
  await assert.rejects(f.service.execute(f.command('STOCK_IN', 1000, { inputUnitId: f.unit('dus'), variantId: variant.id, expectedFactorBase: 40000 })), /Konversi telah berubah/)
})
test('1 kg = 1000 gram dan 1,5 L = 1500 ml tanpa floating point', async () => {
  const mass = await fixture('g')
  await mass.service.execute(mass.command('OPENING_BALANCE', 1000, { inputUnitId: mass.unit('kg') }))
  await assertLedger(mass, 1_000_000)
  const volume = await fixture('ml')
  await volume.service.execute(volume.command('OPENING_BALANCE', 1500, { inputUnitId: volume.unit('l') }))
  await assertLedger(volume, 1_500_000)
})
test('bensin 50 L − 1,5 L = 48,5 L; skala lama liter dan base ml tetap benar', async () => {
  const ml = await fixture('ml')
  await ml.service.execute(ml.command('OPENING_BALANCE', 50000, { inputUnitId: ml.unit('l') }))
  await ml.service.execute(ml.command('ADJUSTMENT_OUT', 1500, { inputUnitId: ml.unit('l') }))
  await assertLedger(ml, 48_500_000)
  const liter = await fixture('l')
  await liter.service.execute(liter.command('OPENING_BALANCE', 50000))
  await liter.service.execute(liter.command('ADJUSTMENT_OUT', 1500))
  await assertLedger(liter, 48500)
})
test('solar volume aktual dan jeriken berisi eksplisit, tanpa kapasitas otomatis', async () => {
  const f = await fixture('l')
  await f.service.execute(f.command('OPENING_BALANCE', 18375))
  await assert.rejects(f.service.execute(f.command('STOCK_IN', 1000, { inputUnitId: f.unit('jeriken') })), /wajib ditentukan/)
  await f.service.execute(f.command('STOCK_IN', 2000, { inputUnitId: f.unit('jeriken'), customQuantityInBaseUnit: 18500 }))
  await assertLedger(f, 55375)
})
test('lintas dimensi, konversi nol/negatif, pecahan diskret dan presisi ilegal ditolak', async () => {
  const f = await fixture('pcs')
  await assert.rejects(f.service.execute(f.command('OPENING_BALANCE', 1000, { inputUnitId: f.unit('l') })), /tidak kompatibel/)
  for (const value of [0, -1000]) await assert.rejects(f.service.execute(f.command('OPENING_BALANCE', 1000, { inputUnitId: f.unit('dus'), customQuantityInBaseUnit: value })), /Faktor konversi/)
  await assert.rejects(f.service.execute(f.command('OPENING_BALANCE', 1500)), /bilangan bulat/)
  await assert.rejects(f.service.execute(f.command('OPENING_BALANCE', 1000, { inputUnitId: f.unit('dus'), customQuantityInBaseUnit: 500 })), /pecahan satuan dasar/)
  const volume = await fixture('l')
  await assert.rejects(volume.service.execute(volume.command('OPENING_BALANCE', 1, { inputUnitId: volume.unit('ml') })), /presisi/)
  assert.equal((await f.service.getBalances()).length, 0)
})
test('rollback ketika ledger gagal: saldo awal maupun update tidak tersimpan sebagian', async () => {
  const f = await fixture()
  const fail = () => { throw new Error('Simulasi penulisan ledger gagal') }
  f.db.stockMovements.hook('creating', fail)
  await assert.rejects(f.service.execute(f.command('OPENING_BALANCE', 30000)), /ledger gagal/)
  assert.equal((await f.service.getBalances()).length, 0)
  assert.equal((await f.service.getHistory(f.product.id)).length, 0)
  f.db.stockMovements.hook('creating').unsubscribe(fail)
  await f.service.execute(f.command('OPENING_BALANCE', 30000))
  f.db.stockMovements.hook('creating', fail)
  await assert.rejects(f.service.execute(f.command('STOCK_IN', 10000)), /ledger gagal/)
  f.db.stockMovements.hook('creating').unsubscribe(fail)
  await assertLedger(f, 30000)
})
test('status minimum stok dan optimistic guard saldo', async () => {
  const f = await fixture()
  await f.service.execute(f.command('OPENING_BALANCE', 5000))
  const balance = (await f.service.getBalances())[0]
  assert.equal(stockStatus(balance, 5000), 'LOW_STOCK')
  assert.equal(stockStatus(balance, null), 'IN_STOCK')
  assert.equal(stockStatus(balance, 4000), 'IN_STOCK')
  await assert.rejects(f.service.execute(f.command('ADJUSTMENT_OUT', 1000, { expectedBeforeBase: 6000 })), /Saldo telah berubah/)
  await assertLedger(f, 5000)
})
test('saldo/ledger tetap ada setelah reopen dan katalog membatasi stok bersama varian', async () => {
  const f = await fixture('l')
  const old = await f.products.getSnapshot()
  await f.products.saveProduct({ ...f.product, expectedUpdatedAt: f.product.updatedAt, variants: [old.variants[0], { name: 'Botol 1,5 L', sellingUnitId: f.unit('botol'), quantityInBaseUnit: 1500, sellingPrice: 20000, saleMode: 'fixed', isActive: true }] })
  await f.service.execute(f.command('OPENING_BALANCE', 3000))
  f.db.close()
  const reopened = new ZannaDatabase(f.db.name)
  try {
    const repo = new DexieInventoryRepository(reopened)
    const balances = await repo.getBalances()
    assert.equal(balances[0].quantityBase, 3000)
    assert.equal((await repo.getHistory(f.product.id)).length, 1)
    const items = projectCatalog(await new DexieProductRepository(reopened).getSnapshot(), balances)
    const liter = items.find((item) => item.quantityInBaseUnit === 1000)!, bottle = items.find((item) => item.quantityInBaseUnit === 1500)!
    assert.equal(bottle.stock, 2)
    let cart = setCartQuantity([], bottle, 1, items)
    cart = setCartQuantity(cart, liter, 1, items)
    assert.equal(quoteCart(cart, items).valid, true)
    assert.deepEqual(setCartQuantity(cart, liter, 2, items), cart)
    assert.equal(quoteCart([{ variantId: bottle.id, quantity: 2 }, { variantId: liter.id, quantity: 1 }], items).valid, false)
    assert.equal((await repo.getBalances())[0].quantityBase, 3000)
  } finally { reopened.close() }
})
test('migrasi v1 → v4 mempertahankan seluruh master/barcode/skala dan tidak seed stok nol', async () => {
  const name = `migration-test-${crypto.randomUUID()}`
  const old = new Dexie(name)
  old.version(1).stores(PRODUCT_SCHEMA_V1)
  const stamp = '2026-10-20T00:00:00.000Z'
  const category: Category = { id: crypto.randomUUID(), name: 'BBM lama', nameKey: 'bbm lama', isActive: true, createdAt: stamp, updatedAt: stamp }
  const liter = builtinUnits.find((item) => item.code === 'l')!, bottle = builtinUnits.find((item) => item.code === 'botol')!
  const product: Product = { id: crypto.randomUUID(), name: 'Bensin lama', categoryId: category.id, baseUnitId: liter.id, costPrice: null, costKnown: false, minimumStock: 5000, isActive: true, isDemo: false, createdAt: stamp, updatedAt: stamp }
  const variant: ProductVariant = { id: crypto.randomUUID(), productId: product.id, name: '1,5 L', sellingUnitId: bottle.id, quantityInBaseUnit: 1500, sellingPrice: null, barcode: '000123456', sku: 'OLD-1', isActive: true, saleMode: 'fixed', createdAt: stamp, updatedAt: stamp }
  await old.transaction('rw', old.tables, async () => { await old.table('units').bulkAdd(builtinUnits); await old.table('categories').add(category); await old.table('products').add(product); await old.table('variants').add(variant) })
  old.close()
  const upgraded = new ZannaDatabase(name); databases.push(upgraded)
  await upgraded.open()
  assert.equal(upgraded.verno, 5)
  assert.deepEqual(await upgraded.products.toArray(), [product])
  assert.deepEqual(await upgraded.variants.toArray(), [variant])
  assert.deepEqual(await upgraded.categories.toArray(), [category])
  assert.deepEqual(await upgraded.units.toArray(), builtinUnits)
  assert.equal(await upgraded.inventoryBalances.count(), 0)
  assert.equal(await upgraded.stockMovements.count(), 0)
  assert.equal(await upgraded.sales.count(), 0)
  assert.equal(await upgraded.saleItems.count(), 0)
  assert.equal(await upgraded.checkoutIntents.count(), 0)
})

test('hardening Solar: service, preview dan repository menolak 10 Sachet / Bungkus untuk semua mutasi', async () => {
  const f = await fixture('l')
  await f.products.saveProduct({ ...f.product, name: 'Solar', expectedUpdatedAt: f.product.updatedAt, unitPolicy: { kind: 'fuel', allowedPackagingUnitIds: [f.unit('jeriken')] }, variants: (await f.products.getSnapshot()).variants })
  for (const type of ['OPENING_BALANCE', 'STOCK_IN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT'] as const) {
    if (type === 'STOCK_IN') await f.service.execute(f.command('OPENING_BALANCE', 200000))
    const beforeBalance = await f.service.getBalances(), beforeHistory = await f.service.getHistory(f.product.id)
    for (const code of ['sachet', 'bungkus', 'botol', 'dus']) {
      const command = f.command(type, 10000, { inputUnitId: f.unit(code), customQuantityInBaseUnit: 12000 })
      const catalog = await f.products.getSnapshot()
      assert.throws(() => f.service.preview(command, catalog, beforeBalance[0]), /tidak diizinkan/)
      await assert.rejects(f.service.execute(command), /tidak diizinkan/)
      await assert.rejects(f.repository.apply(command), /tidak diizinkan/)
    }
    assert.deepEqual(await f.service.getBalances(), beforeBalance)
    assert.deepEqual(await f.service.getHistory(f.product.id), beforeHistory)
  }
})

test('hardening Solar: liter/ml serta jeriken eksplisit valid; faktor salah tidak menulis parsial', async () => {
  const f = await fixture('l')
  await f.service.execute(f.command('OPENING_BALANCE', 1000))
  await f.service.execute(f.command('STOCK_IN', 1500000, { inputUnitId: f.unit('ml') }))
  await assert.rejects(f.service.execute(f.command('STOCK_IN', 1000, { inputUnitId: f.unit('jeriken') })), /wajib ditentukan/)
  for (const factor of [0, -1000, 0.5, NaN, Infinity]) await assert.rejects(f.repository.apply(f.command('STOCK_IN', 1000, { inputUnitId: f.unit('jeriken'), customQuantityInBaseUnit: factor })), /Faktor konversi/)
  await assert.rejects(f.repository.apply(f.command('STOCK_IN', 500, { inputUnitId: f.unit('jeriken'), customQuantityInBaseUnit: 18500 })), /bilangan bulat/)
  await assertLedger(f, 2500)
  await f.service.execute(f.command('STOCK_IN', 2000, { inputUnitId: f.unit('jeriken'), customQuantityInBaseUnit: 18500 }))
  await assertLedger(f, 39500)
})

test('hardening Bensin: botol 1 / 1,5 / 5 L berbagi satu saldo; varian Sachet lama diblokir', async () => {
  const f = await fixture('l'), snapshot = await f.products.getSnapshot()
  await f.products.saveProduct({ ...f.product, expectedUpdatedAt: f.product.updatedAt, variants: [snapshot.variants[0], ...[1000, 1500, 5000].map((factor) => ({ name: `Botol ${factor / 1000} L`, sellingUnitId: f.unit('botol'), quantityInBaseUnit: factor, sellingPrice: 20000, saleMode: 'fixed' as const, isActive: true }))] })
  const valid = await f.products.getSnapshot()
  for (const variant of valid.variants.filter((variant) => variant.sellingUnitId === f.unit('botol'))) await f.service.execute(f.command((await f.service.getBalances()).length ? 'STOCK_IN' : 'OPENING_BALANCE', 1000, { inputUnitId: variant.sellingUnitId, variantId: variant.id }))
  await assertLedger(f, 7500)
  assert.equal((await f.service.getBalances()).length, 1)
  const oldVariant = { ...valid.variants[0], id: crypto.randomUUID(), name: 'Sachet lama', sellingUnitId: f.unit('sachet'), quantityInBaseUnit: 12000 }
  await f.db.variants.add(oldVariant) // Deliberate legacy fixture, never a production repair.
  await assert.rejects(f.repository.apply(f.command('STOCK_IN', 10000, { inputUnitId: oldVariant.sellingUnitId, variantId: oldVariant.id })), /tidak diizinkan/)
  const catalog = await f.products.getSnapshot()
  assert.equal(inventoryInputOptions(catalog, f.product.id).some((option) => option.variantId === oldVariant.id || option.unitId === f.unit('sachet')), false)
  assert.equal(projectCatalog(catalog, await f.service.getBalances()).some((item) => item.id === oldVariant.id), false)
  await assertLedger(f, 7500)
})

test('hardening master: BBM wajib volume dan tidak dapat mengizinkan Sachet melalui allowlist', async () => {
  const f = await fixture('l'), catalog = await f.products.getSnapshot()
  const draft = { ...f.product, expectedUpdatedAt: f.product.updatedAt, variants: catalog.variants }
  await assert.rejects(f.products.saveProduct({ ...draft, unitPolicy: { kind: 'fuel', allowedPackagingUnitIds: [f.unit('sachet')] } }), /Daftar kemasan/)
  const invalid = { ...draft, variants: [{ ...catalog.variants[0], sellingUnitId: f.unit('sachet'), quantityInBaseUnit: 12000 }] }
  assert.throws(() => validateProduct(invalid, catalog), /tidak diizinkan/)
  assert.throws(() => validateVariantUnit(f.product, invalid.variants[0], catalog.units), /tidak diizinkan/)
  await assert.rejects(f.products.saveProduct(invalid), /tidak diizinkan/)
  const count = await fixture('pcs'), countCatalog = await count.products.getSnapshot()
  await assert.rejects(count.products.saveProduct({ ...count.product, expectedUpdatedAt: count.product.updatedAt, unitPolicy: { kind: 'fuel', allowedPackagingUnitIds: [] }, variants: countCatalog.variants }), /BBM wajib.*VOLUME/)
  assert.deepEqual(await f.products.getSnapshot(), catalog)
})

test('hardening produk lain: kemasan sah tidak diblokir global; izin bersifat per produk', async () => {
  const f = await fixture('g'), old = await f.products.getSnapshot()
  const product = await f.products.saveProduct({ ...f.product, expectedUpdatedAt: f.product.updatedAt, name: 'Bumbu bubuk', unitPolicy: { kind: 'general', allowedPackagingUnitIds: [f.unit('sachet')] }, variants: [...old.variants, { name: 'Sachet 12 gram', sellingUnitId: f.unit('sachet'), quantityInBaseUnit: 12000, sellingPrice: 1000, saleMode: 'fixed', isActive: true }] })
  await f.service.execute(f.command('OPENING_BALANCE', 10000, { inputUnitId: f.unit('sachet'), customQuantityInBaseUnit: 12000 }))
  await assertLedger(f, 120000)
  await assert.rejects(f.service.execute(f.command('STOCK_IN', 1000, { inputUnitId: f.unit('botol'), customQuantityInBaseUnit: 10000 })), /tidak diizinkan/)
  const catalog = await f.products.getSnapshot()
  assert.ok(inventoryInputOptions(catalog, product.id).some((option) => option.unitId === f.unit('sachet')))
  assert.ok(projectCatalog(catalog, await f.service.getBalances()).some((item) => item.name.includes('Sachet')))
  await assert.rejects(f.service.execute(f.command('STOCK_IN', 1000, { inputUnitId: f.unit('l') })), /tidak kompatibel/)
})

test('hardening legacy: tidak ada policy berarti kemasan tambahan diblokir, metrik tetap eksplisit', async () => {
  const f = await fixture('l')
  const legacy = { ...f.product }; delete legacy.unitPolicy
  await f.db.products.put(legacy)
  const before = await f.products.getSnapshot()
  assert.ok(productUnitIssues(legacy, before).length)
  await assert.rejects(f.service.execute(f.command('OPENING_BALANCE', 10000, { inputUnitId: f.unit('sachet'), customQuantityInBaseUnit: 12000 })), /Tinjau kebijakan/)
  await assert.rejects(f.products.saveProduct({ ...legacy, expectedUpdatedAt: legacy.updatedAt, variants: before.variants }), /Tinjau dan simpan/)
  assert.deepEqual(await f.db.products.get(legacy.id), legacy)
  await f.service.execute(f.command('OPENING_BALANCE', 1000))
  await f.service.execute(f.command('STOCK_IN', 1000000, { inputUnitId: f.unit('ml') }))
  await assertLedger(f, 2000)
  await f.products.setProductActive(legacy.id, false, legacy.updatedAt)
  assert.equal((await f.db.products.get(legacy.id))?.unitPolicy, undefined)
  assert.equal((await f.db.products.get(legacy.id))?.isActive, false)
})

test('hardening historis: snapshot Sachet dan saldo lama utuh; review dan koreksi memakai mutasi baru', async () => {
  const f = await fixture('l')
  const result = await f.service.execute(f.command('OPENING_BALANCE', 120000))
  const record = { ...result.movement, inputQuantity: 10000, conversionSnapshot: { ...result.movement.conversionSnapshot, inputUnit: (await f.products.getSnapshot()).units.find((unit) => unit.id === f.unit('sachet'))!, quantityInBaseUnit: 12000, source: 'custom' as const } }
  await f.db.stockMovements.put(record) // Construct the exact pre-hardening bug in a TEST database only.
  const legacy = { ...f.product }; delete legacy.unitPolicy
  await f.db.products.put(legacy)
  const oldBalance = await f.service.getBalances(), oldHistory = await f.service.getHistory(f.product.id)
  assert.match(historicalUnitIssue(record, await f.products.getSnapshot())!, /belum ditinjau/)
  f.db.close(); await f.db.open()
  const catalog = await f.products.getSnapshot()
  await f.products.saveProduct({ ...legacy, expectedUpdatedAt: legacy.updatedAt, unitPolicy: { kind: 'fuel', allowedPackagingUnitIds: [f.unit('jeriken')] }, variants: catalog.variants })
  assert.deepEqual(await f.service.getBalances(), oldBalance)
  assert.deepEqual(await f.service.getHistory(f.product.id), oldHistory)
  assert.match(historicalUnitIssue(record, await f.products.getSnapshot())!, /Sachet tidak diizinkan/)
  assert.equal(record.conversionSnapshot.quantityInBaseUnit, 12000)
  await f.service.execute(f.command('ADJUSTMENT_OUT', 100000, { reason: 'Stock opname: fisik 20 L, koreksi catatan lama' }))
  assert.deepEqual((await f.service.getHistory(f.product.id)).find((entry) => entry.id === record.id), record)
  await assertLedger(f, 20000)
})

test('hardening kebijakan berubah: varian lama dapat diarsipkan, history valid tidak tergantung faktor sekarang', async () => {
  const f = await fixture('l'), old = await f.products.getSnapshot()
  const product = await f.products.saveProduct({ ...f.product, expectedUpdatedAt: f.product.updatedAt, variants: [...old.variants, { name: 'Botol 1,5 L', sellingUnitId: f.unit('botol'), quantityInBaseUnit: 1500, sellingPrice: 1000, saleMode: 'fixed', isActive: true }] })
  const catalog = await f.products.getSnapshot(), bottle = catalog.variants.find((variant) => variant.name === 'Botol 1,5 L')!
  const command = f.command('OPENING_BALANCE', 1000, { inputUnitId: bottle.sellingUnitId, variantId: bottle.id })
  const record = (await f.service.execute(command)).movement
  await f.products.saveProduct({ ...product, expectedUpdatedAt: product.updatedAt, unitPolicy: { kind: 'fuel', allowedPackagingUnitIds: [f.unit('jeriken')] }, variants: catalog.variants.map((variant) => variant.id === bottle.id ? { ...variant, isActive: false } : variant) })
  assert.match(historicalUnitIssue(record, await f.products.getSnapshot())!, /Botol tidak diizinkan/)
  await assert.rejects(f.repository.apply(f.command('STOCK_IN', 1000, { inputUnitId: bottle.sellingUnitId, variantId: bottle.id })), /tidak diizinkan/)
  assert.equal((await f.service.execute(command)).duplicate, true) // Retry old success never writes again.
  const archived = await f.products.getSnapshot(), current = archived.products[0]
  await assert.rejects(f.products.saveProduct({ ...current, expectedUpdatedAt: current.updatedAt, variants: archived.variants.map((variant) => variant.id === bottle.id ? { ...variant, quantityInBaseUnit: -1000 } : variant) }), /Konversi wajib positif/)
  await assertLedger(f, 1500)
})
