import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DexieProductImportRepository } from '../src/data/dexieProductImportRepository'
import { ProductImportService } from '../src/services/productImportOperations'
import { IMPORT_COLUMNS, type ImportCell } from '../src/domain/productImport'
import { previewProductImport } from '../src/domain/productImportRules'
import { productTemplate, readProductExcel, validateXlsxArchive, MAX_EXCEL_BYTES } from '../src/services/productExcel'
import { creditFixture, businessSnapshot } from './credit-fixtures'
import { checkoutFixture } from './checkout-fixtures'
import writeExcel from 'write-excel-file/universal'

const sampleRow = (): ImportCell[] => ['BBM-BARU', 'Bensin impor uji', 'Kategori uji', 'l', 'BBM', 10000, 5, 'Botol 1,5 L', 'botol', 1.5, 18000, 'TETAP', 'IMPORT-001', '00123456789']
const rows = (entries: ImportCell[][] = [sampleRow()]): ImportCell[][] => [[...IMPORT_COLUMNS], ...entries]
const service = (db: Parameters<typeof businessSnapshot>[0]) => new ProductImportService(new DexieProductImportRepository(db))

test('preview BBM botol 1,5 dan jeriken 5: satu produk dua varian tanpa write', async () => {
  const f = await creditFixture()
  try {
    const second = sampleRow(); second[7] = 'Jeriken 5 L'; second[8] = 'jeriken'; second[9] = 5; second[10] = 60000; second[12] = 'IMPORT-002'; second[13] = '001111'
    const before = await businessSnapshot(f.db), preview = await service(f.db).preview(rows([sampleRow(), second]))
    assert.deepEqual(preview.issues, []); assert.equal(preview.products, 1); assert.equal(preview.variants, 2)
    assert.equal(preview.drafts[0].variants[0].quantityInBaseUnit, 1500); assert.equal(preview.drafts[0].variants[1].quantityInBaseUnit, 5000)
    assert.deepEqual(await businessSnapshot(f.db), before)
  } finally { await f.db.delete() }
})
const invalidCases: [string, number, ImportCell, RegExp][] = [
  ['harga negatif', 10, -1, /tidak negatif/], ['harga pecahan', 10, 1.5, /Rupiah bulat/], ['harga teks', 10, '15000', /harus berupa angka/],
  ['konversi nol', 9, 0, /lebih dari nol/], ['konversi negatif', 9, -1, /tidak negatif/], ['konversi terlalu presisi', 9, 1.0001, /tiga angka/],
  ['kolom nama kosong', 1, '', /wajib berupa teks/], ['harga boolean', 10, true, /harus berupa angka/], ['barcode angka', 13, 123, /format Teks/],
  ['satuan tidak ada', 8, 'karton-tidak-ada', /belum tersedia/], ['kategori tidak ada', 2, 'Tidak ada', /Kategori belum/],
  ['harga NaN', 10, NaN, /harus berupa angka/], ['harga infinity', 10, Infinity, /harus berupa angka/],
  ['mode bebas pada kemasan', 11, 'BEBAS', /Jumlah aktual/], ['jenis tidak dikenal', 4, 'MINUMAN', /UMUM atau BBM/],
]
for (const [label, column, value, message] of invalidCases) test(`validasi impor: ${label}, nomor baris tepat`, () => {
  const row = sampleRow(); row[column] = value
  const preview = previewProductImport(rows([row]), checkoutFixture().catalog)
  assert.equal(preview.issues[0].row, 2); assert.match(preview.issues[0].message, message)
})
test('satuan dasar dan jual sama wajib konversi 1; jenis berbeda tidak dipaksakan', () => {
  const row = sampleRow(); row[8] = 'l'; row[9] = 1.5
  assert.match(previewProductImport(rows([row]), checkoutFixture().catalog).issues[0].message, /sama wajib 1/)
  row[9] = 1; row[11] = 'BEBAS'; assert.equal(previewProductImport(rows([row]), checkoutFixture().catalog).issues.length, 0)
})
test('duplikat barcode/SKU dalam file dan master lama termasuk nonaktif ditolak', () => {
  const catalog = checkoutFixture().catalog
  for (const column of [12, 13]) {
    const first = sampleRow(), second = sampleRow(); second[7] = 'Varian lain'; second[column === 12 ? 13 : 12] = 'UNIQUE'
    assert.match(previewProductImport(rows([first, second]), catalog).issues[0].message, /duplikat/)
    const old = sampleRow(); old[column] = column === 12 ? catalog.variants[0].sku! : catalog.variants[0].barcode!
    catalog.variants[0].isActive = false
    assert.match(previewProductImport(rows([old]), catalog).issues[0].message, /duplikat/)
  }
})
test('nama produk lama dan metadata antarvarian bertentangan ditolak tanpa overwrite', () => {
  const catalog = checkoutFixture().catalog, old = sampleRow(); old[1] = catalog.products[0].name
  assert.match(previewProductImport(rows([old]), catalog).issues[0].message, /sudah tersedia/)
  const second = sampleRow(); second[5] = 9000; second[12] = 'OTHER'; second[13] = 'OTHER'
  assert.match(previewProductImport(rows([sampleRow(), second]), catalog).issues[0].message, /harus sama/)
})
test('header, file kosong dan batas 500 baris diperiksa sebelum impor', () => {
  const catalog = checkoutFixture().catalog
  assert.ok(previewProductImport([], catalog).issues.length)
  const wrong = rows(); wrong[0][0] = 'Kolom salah'; assert.match(previewProductImport(wrong, catalog).issues[0].message, /template/)
  assert.match(previewProductImport(rows(Array.from({ length: 501 }, sampleRow)), catalog).issues[0].message, /500/)
})
test('konfirmasi eksplisit wajib; preview bukan perubahan database', async () => {
  const f = await creditFixture()
  try {
    const importer = service(f.db), before = await businessSnapshot(f.db), preview = await importer.preview(rows())
    await assert.rejects(importer.confirm(preview, false), /centang/); assert.deepEqual(await businessSnapshot(f.db), before)
    assert.equal(await importer.confirm(preview, true), 1)
    assert.equal(await f.db.products.count(), 2); assert.equal(await f.db.inventoryBalances.count(), 1)
    assert.equal(await f.db.sales.count(), 0); assert.equal(await f.db.units.count(), f.catalog.units.length)
    assert.equal((await f.db.variants.where('barcode').equals('00123456789').first())?.quantityInBaseUnit, 1500)
  } finally { await f.db.delete() }
})
test('semua baris dibatalkan bila ada satu kesalahan; double confirm hanya satu commit', async () => {
  const f = await creditFixture()
  try {
    const importer = service(f.db), bad = sampleRow(); bad[10] = -1
    const before = await businessSnapshot(f.db), invalid = await importer.preview(rows([sampleRow(), bad]))
    await assert.rejects(importer.confirm(invalid, true)); assert.deepEqual(await businessSnapshot(f.db), before)
    const valid = await importer.preview(rows())
    const outcomes = await Promise.allSettled([importer.confirm(valid, true), importer.confirm(valid, true)])
    assert.equal(outcomes.filter((x) => x.status === 'fulfilled').length, 1); assert.equal(await f.db.products.count(), 2)
  } finally { await f.db.delete() }
})
test('preview yang diubah pemanggil atau dibuat sendiri tidak dapat mengganti data rencana', async () => {
  const f = await creditFixture()
  try {
    const importer = service(f.db), preview = await importer.preview(rows())
    preview.drafts[0].name = 'Nama dimanipulasi'; preview.drafts[0].variants[0].sellingPrice = 1
    await assert.rejects(importer.confirm(structuredClone(preview), true), /preview/)
    await importer.confirm(preview, true)
    assert.equal(await f.db.products.filter((p) => p.name === 'Nama dimanipulasi').count(), 0)
    assert.equal((await f.db.variants.where('sku').equals('IMPORT-001').first())?.sellingPrice, 18000)
  } finally { await f.db.delete() }
})
test('perubahan master setelah preview ditolak di dalam transaksi tanpa commit sebagian', async () => {
  const f = await creditFixture()
  try {
    const importer = service(f.db), preview = await importer.preview(rows())
    await f.db.products.update(f.product.id, { name: 'Edit tab lain' }); const before = await businessSnapshot(f.db)
    await assert.rejects(importer.confirm(preview, true), /berubah sejak preview/)
    assert.deepEqual(await businessSnapshot(f.db), before)
  } finally { await f.db.delete() }
})
test('fault pada produk kedua me-rollback seluruh produk/varian; data lama tetap identik', async () => {
  const f = await creditFixture()
  try {
    const importer = service(f.db), second = sampleRow(); second[0] = 'SECOND'; second[1] = 'Produk kedua'; second[12] = 'OTHER'; second[13] = 'OTHER'
    const preview = await importer.preview(rows([sampleRow(), second])), before = await businessSnapshot(f.db)
    const fail = (_key: unknown, obj: { name?: string }) => { if (obj.name === 'Produk kedua') throw new Error('fault import second') }
    f.db.products.hook('creating', fail)
    await assert.rejects(importer.confirm(preview, true)); f.db.products.hook('creating').unsubscribe(fail)
    assert.deepEqual(await businessSnapshot(f.db), before)
    assert.equal(await importer.confirm(await importer.preview(rows([sampleRow(), second])), true), 2)
  } finally { await f.db.delete() }
})
test('template Excel .xlsx dapat dibaca ulang dan header tepat tanpa data contoh otomatis', async () => {
  const blob = await productTemplate(), data = await readProductExcel({ name: 'template.xlsx', size: blob.size, arrayBuffer: () => blob.arrayBuffer() })
  assert.deepEqual(data, [[...IMPORT_COLUMNS]])
})
test('file Excel nyata mempertahankan barcode nol awal dan nilai desimal sebelum preview', async () => {
  const blob = await writeExcel(rows(), { sheet: 'Produk' }).toBlob()
  const data = await readProductExcel({ name: 'valid.xlsx', size: blob.size, arrayBuffer: () => blob.arrayBuffer() })
  assert.equal(data[1][13], '00123456789'); assert.equal(data[1][9], 1.5)
  assert.equal(previewProductImport(data, checkoutFixture().catalog).issues.length, 0)
})
test('format rusak, ekstensi lama, terlalu besar, ZIP terpotong dan banyak sheet ditolak', async () => {
  const invalid = new Uint8Array([1, 2, 3]).buffer
  assert.throws(() => validateXlsxArchive(invalid))
  await assert.rejects(readProductExcel({ name: 'file.xls', size: 3, arrayBuffer: async () => invalid }), /\.xlsx/)
  await assert.rejects(readProductExcel({ name: 'file.xlsx', size: MAX_EXCEL_BYTES + 1, arrayBuffer: async () => invalid }), /2 MB/)
  await assert.rejects(readProductExcel({ name: 'file.xlsx', size: 3, arrayBuffer: async () => invalid }))
  const multiple = await writeExcel([{ sheet: 'Produk', data: rows() }, { sheet: 'Lain', data: [['x']] }]).toBlob()
  await assert.rejects(readProductExcel({ name: 'multiple.xlsx', size: multiple.size, arrayBuffer: () => multiple.arrayBuffer() }), /satu lembar/)
})
test('arsip dengan ukuran pengembangan tidak wajar ditolak sebelum parser Excel', async () => {
  const blob = await productTemplate(), buffer = await blob.arrayBuffer(), view = new DataView(buffer)
  let offset = 0
  while (view.getUint32(offset, true) !== 0x02014b50) offset++
  view.setUint32(offset + 24, 30 * 1024 * 1024, true)
  assert.throws(() => validateXlsxArchive(buffer), /terlalu besar/)
})

for (const [label, base, selling, conversion, mode] of [['beras kilogram bebas', 'kg', 'kg', 1, 'BEBAS'], ['mi dus isi 40 bungkus', 'bungkus', 'dus', 40, 'TETAP']] as const) {
  test(`impor satuan sah: ${label}`, () => {
    const row = sampleRow(); row[1] = label; row[3] = base; row[4] = 'UMUM'; row[8] = selling; row[9] = conversion; row[11] = mode
    const preview = previewProductImport(rows([row]), checkoutFixture().catalog)
    assert.deepEqual(preview.issues, []); assert.equal(preview.drafts[0].variants[0].quantityInBaseUnit, conversion * 1000)
  })
}
test('integrasi impor → stok → checkout → snapshot HPP mempertahankan master lama', async () => {
  const f = await creditFixture()
  try {
    const importer = service(f.db), original = await f.db.products.get(f.product.id)
    await importer.confirm(await importer.preview(rows()), true)
    const variant = (await f.db.variants.where('sku').equals('IMPORT-001').first())!, product = (await f.db.products.get(variant.productId))!
    await f.inventory.execute({ operationId: crypto.randomUUID(), productId: product.id, movementType: 'OPENING_BALANCE', inputUnitId: product.baseUnitId, inputQuantity: 20000, reason: 'Stok uji impor' })
    const quote = await f.checkout.preview([{ variantId: variant.id, quantity: 1000 }])
    const command = { payloadVersion: 1 as const, checkoutOperationId: crypto.randomUUID(), paymentMethod: 'CASH' as const, lines: quote.lines, expectedTotal: quote.total, cashReceived: 20000 }
    await f.checkout.prepare(command); const result = await f.checkout.execute(command)
    assert.equal(result.sale.total, 18000); assert.equal(result.items[0].quantityBase, 1500)
    assert.equal((await f.db.inventoryBalances.get(product.id))!.quantityBase, 18500)
    assert.equal((await f.db.saleItemCosts.get(result.items[0].id))!.totalCost, 15000)
    assert.deepEqual(await f.db.products.get(f.product.id), original)
  } finally { await f.db.delete() }
})
