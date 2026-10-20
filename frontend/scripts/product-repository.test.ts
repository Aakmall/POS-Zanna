import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { ZannaDatabase } from '../src/data/database'
import { DexieProductRepository } from '../src/data/dexieProductRepository'
import type { ProductDraft } from '../src/domain/product'
import { projectCatalog } from '../src/services/catalogRepository'
import { parseQuantity, parseRupiah } from '../src/domain/quantity'

const databases: ZannaDatabase[] = []
after(async () => { for (const db of databases) await db.delete() })
async function setup() {
  const db = new ZannaDatabase(`test-${crypto.randomUUID()}`)
  databases.push(db)
  const repository = new DexieProductRepository(db)
  await repository.initialize()
  const category = await repository.saveCategory('Sembako')
  const snapshot = await repository.getSnapshot()
  const unit = (code: string) => snapshot.units.find((item) => item.code === code)!.id
  const draft = (): ProductDraft => ({
    name: 'Beras lokal', categoryId: category.id, baseUnitId: unit('kg'), costPrice: null, costKnown: false,
    minimumStock: null, isActive: true,
    variants: [{ name: 'Standar', sellingUnitId: unit('kg'), quantityInBaseUnit: 1000, sellingPrice: 15000, saleMode: 'fixed', isActive: true }],
  })
  return { db, repository, draft, unit }
}

test('inisialisasi hanya satuan, database produk kosong dan tidak seed otomatis', async () => {
  const { repository } = await setup()
  await repository.initialize()
  const snapshot = await repository.getSnapshot()
  assert.equal(snapshot.products.length, 0)
  assert.equal(snapshot.variants.length, 0)
  assert.equal(snapshot.units.length, 10)
  assert.equal(snapshot.categories.length, 1)
})
test('produk tanpa barcode/modal tersimpan, UUID stabil, dibaca kembali setelah database ditutup', async () => {
  const { repository, draft, db } = await setup()
  const product = await repository.saveProduct(draft())
  assert.match(product.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.equal(product.costPrice, null)
  assert.equal(product.costKnown, false)
  db.close()
  const reopened = new ZannaDatabase(db.name)
  const persisted = new DexieProductRepository(reopened)
  await persisted.initialize()
  const snapshot = await persisted.getSnapshot()
  assert.equal(snapshot.products[0].id, product.id)
  assert.equal(snapshot.variants[0].barcode, undefined)
  assert.equal(projectCatalog(snapshot)[0].price, 15000)
  reopened.close()
})
test('edit atomik produk dan varian, timestamp dan identitas dipertahankan', async () => {
  const { repository, draft } = await setup()
  const product = await repository.saveProduct(draft())
  const before = await repository.getSnapshot()
  const updated = await repository.saveProduct({ ...draft(), id: product.id, expectedUpdatedAt: product.updatedAt, name: 'Beras diperbarui', costPrice: 12000, costKnown: true, variants: [{ ...before.variants[0], sellingPrice: 17000 }] })
  assert.equal(updated.id, product.id)
  assert.equal(updated.createdAt, product.createdAt)
  assert.notEqual(updated.updatedAt, product.updatedAt)
  const snapshot = await repository.getSnapshot()
  assert.equal(snapshot.variants.length, 1)
  assert.equal(snapshot.variants[0].id, before.variants[0].id)
  assert.equal(projectCatalog(snapshot)[0].name, 'Beras diperbarui')
  assert.equal(projectCatalog(snapshot)[0].price, 17000)
  await assert.rejects(repository.saveProduct({ ...draft(), id: product.id, expectedUpdatedAt: product.updatedAt }), /tab lain/)
})
test('nonaktifkan tanpa hard delete; katalog aktif mengecualikan master/varian nonaktif', async () => {
  const { repository, draft } = await setup()
  const product = await repository.saveProduct(draft())
  await repository.setProductActive(product.id, false, product.updatedAt)
  const snapshot = await repository.getSnapshot()
  assert.equal(snapshot.products.length, 1)
  assert.equal(snapshot.variants.length, 1)
  assert.equal(projectCatalog(snapshot).filter((item) => item.isActive).length, 0)
  await repository.setProductActive(product.id, true, snapshot.products[0].updatedAt)
  const fresh = await repository.getSnapshot()
  await repository.saveProduct({ ...fresh.products[0], expectedUpdatedAt: fresh.products[0].updatedAt, variants: [{ ...fresh.variants[0], isActive: false }, { name: 'Baru', sellingUnitId: draft().baseUnitId, quantityInBaseUnit: 1000, sellingPrice: 20000, saleMode: 'fixed', isActive: true }] })
  const active = projectCatalog(await repository.getSnapshot()).filter((item) => item.isActive)
  assert.equal(active.length, 1)
  assert.match(active[0].name, /Baru/)
})
test('validasi nama kosong, harga negatif, kategori/unit invalid, modal tidak konsisten', async () => {
  const { repository, draft } = await setup()
  await assert.rejects(repository.saveProduct({ ...draft(), name: '  ' }), /Nama produk/)
  const negative = draft(); negative.variants[0].sellingPrice = -1
  await assert.rejects(repository.saveProduct(negative), /Harga jual/)
  await assert.rejects(repository.saveProduct({ ...draft(), categoryId: 'missing' }), /kategori/)
  await assert.rejects(repository.saveProduct({ ...draft(), baseUnitId: 'missing' }), /Satuan dasar/)
  await assert.rejects(repository.saveProduct({ ...draft(), costPrice: 0, costKnown: false }), /Modal/)
  assert.equal((await repository.getSnapshot()).products.length, 0)
})
test('barcode dan SKU unik lintas varian, termasuk produk nonaktif', async () => {
  const { repository, draft } = await setup()
  const first = draft(); first.variants[0].sku = 'unik-1'; first.variants[0].barcode = '001234'
  const product = await repository.saveProduct(first)
  await repository.setProductActive(product.id, false, product.updatedAt)
  const duplicateBarcode = draft(); duplicateBarcode.variants[0].barcode = '001234'
  await assert.rejects(repository.saveProduct(duplicateBarcode), /Barcode harus unik/)
  const duplicateSku = draft(); duplicateSku.variants[0].sku = ' UNIK-1 '
  await assert.rejects(repository.saveProduct(duplicateSku), /SKU harus unik/)
  await repository.saveProduct(draft())
  assert.equal((await repository.getSnapshot()).products.length, 2)
})
test('konversi baku gram, kemasan 1,5 L, dan penolakan lintas dimensi/nol', async () => {
  const { repository, draft, unit } = await setup()
  const gram = draft(); gram.variants[0] = { ...gram.variants[0], sellingUnitId: unit('g'), quantityInBaseUnit: 1 }
  await repository.saveProduct(gram)
  const incompatible = draft(); incompatible.variants[0].sellingUnitId = unit('l')
  await assert.rejects(repository.saveProduct(incompatible), /Satuan berat/)
  const zero = draft(); zero.variants[0].quantityInBaseUnit = 0
  await assert.rejects(repository.saveProduct(zero), /Konversi wajib positif/)
  const wrong = draft(); wrong.variants[0] = { ...wrong.variants[0], sellingUnitId: unit('g'), quantityInBaseUnit: 1000 }
  await assert.rejects(repository.saveProduct(wrong), /faktor baku/)
  const fuel = draft(); fuel.baseUnitId = unit('l'); fuel.variants[0] = { ...fuel.variants[0], sellingUnitId: unit('botol'), quantityInBaseUnit: 1500, sellingPrice: null }
  const product = await repository.saveProduct(fuel)
  assert.equal((await repository.getSnapshot()).variants.find((item) => item.productId === product.id)?.quantityInBaseUnit, 1500)
})
test('nilai rupiah dan kuantitas diparse tanpa salah ribuan/floating point', () => {
  assert.equal(parseRupiah('15.000'), 15000)
  assert.equal(parseRupiah('15000'), 15000)
  for (const value of ['-1', '15.50', '1,5', '1e3', 'NaN']) assert.equal(parseRupiah(value), null)
  assert.equal(parseQuantity('1,5'), 1500)
  assert.equal(parseQuantity('0.001'), 1)
  assert.equal(parseQuantity('0.0001'), null)
})
test('seed eksplisit idempoten, berlabel DEMO, dan tidak menimpa produk pengguna', async () => {
  const { repository, draft } = await setup()
  const user = await repository.saveProduct(draft())
  assert.equal(await repository.seedDemo(), 12)
  const before = await repository.getSnapshot()
  assert.equal(await repository.seedDemo(), 0)
  const afterSeed = await repository.getSnapshot()
  assert.deepEqual(afterSeed.products, before.products)
  assert.equal(afterSeed.products.filter((item) => item.isDemo).length, 12)
  assert.equal(afterSeed.products.find((item) => item.id === user.id)?.isDemo, false)
  assert.equal(afterSeed.variants.length, 16)
})
test('konflik SKU ketika seed membatalkan seluruh seed, tidak menghapus data pengguna', async () => {
  const { repository, draft } = await setup()
  const custom = draft(); custom.variants[0].sku = 'BM-004'
  const user = await repository.saveProduct(custom)
  await assert.rejects(repository.seedDemo(), /SKU harus unik/)
  const snapshot = await repository.getSnapshot()
  assert.equal(snapshot.products.length, 1)
  assert.equal(snapshot.products[0].id, user.id)
  assert.equal(snapshot.categories.length, 1)
})
test('kategori dinonaktifkan hanya jika tidak ada produk aktif', async () => {
  const { repository, draft } = await setup()
  const product = await repository.saveProduct(draft())
  await assert.rejects(repository.setCategoryActive(product.categoryId, false), /produk aktif/)
  await repository.setProductActive(product.id, false, product.updatedAt)
  await repository.setCategoryActive(product.categoryId, false)
  const snapshot = await repository.getSnapshot()
  await assert.rejects(repository.setProductActive(product.id, true, snapshot.products[0].updatedAt), /kategori/)
})
test('pembacaan live repository memberi katalog terbaru setelah perubahan', async () => {
  const { repository, draft } = await setup()
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => { stop(); reject(new Error('Live query timeout')) }, 3000)
    const stop = repository.subscribe((snapshot) => {
      if (snapshot.products.length === 1) { clearTimeout(timeout); stop(); assert.equal(projectCatalog(snapshot)[0].price, 15000); resolve() }
    }, reject)
    void repository.saveProduct(draft()).catch(reject)
  })
})
