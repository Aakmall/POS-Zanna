import type { CatalogSnapshot, ProductDraft } from './product'
import { IMPORT_COLUMNS, catalogFingerprint, type ImportCell, type ImportPreview, type ImportIssue } from './productImport'
import { nameKey, validateProduct } from './validation'
import { parseQuantity } from './quantity'

export function previewProductImport(rows: readonly (readonly ImportCell[])[], catalog: CatalogSnapshot): ImportPreview {
  const issues: ImportIssue[] = [], groups = new Map<string, { draft: ProductDraft; rows: number[]; metadata: string }>()
  const result = (): ImportPreview => ({ rows: Math.max(0, rows.length - 1), products: groups.size, variants: [...groups.values()].reduce((n, g) => n + g.draft.variants.length, 0), issues, drafts: [...groups.values()].map((g) => g.draft), catalogFingerprint: catalogFingerprint(catalog) })
  if (rows.length < 2 || rows.length > 501) { issues.push({ row: 1, message: 'Isi 1–500 baris produk dalam satu file.' }); return result() }
  if (rows[0].length !== IMPORT_COLUMNS.length || IMPORT_COLUMNS.some((header, index) => rows[0][index] !== header)) { issues.push({ row: 1, message: 'Judul atau urutan kolom berbeda. Gunakan template yang disediakan tanpa mengganti judul.' }); return result() }
  const seenSku = new Set(catalog.variants.flatMap((v) => v.sku ? [v.sku.trim().toUpperCase()] : [])), seenBarcode = new Set(catalog.variants.flatMap((v) => v.barcode ? [v.barcode] : [])), seenName = new Map<string, string>()
  for (let index = 1; index < rows.length; index++) {
    const row = rows[index], rowNumber = index + 1
    if (row.every((cell) => cell === null || cell === '')) continue
    try {
      if (row.length > IMPORT_COLUMNS.length) throw new Error('Ada isi di luar kolom template.')
      const text = (column: number, required = true): string => {
        const value = row[column]
        if ((value === null || value === undefined || value === '') && !required) return ''
        if (typeof value !== 'string' || (required && !value.trim())) throw new Error(`${IMPORT_COLUMNS[column]} wajib berupa teks${required ? ' dan diisi' : ''}. Gunakan format Teks untuk SKU/barcode.`)
        return value.trim()
      }
      const number = (column: number, optional = false): number | null => {
        const value = row[column]
        if ((value === null || value === undefined || value === '') && optional) return null
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`${IMPORT_COLUMNS[column]} harus berupa angka tidak negatif, tanpa Rp atau pemisah ribuan dalam teks.`)
        return value
      }
      const amount = (column: number, optional = false) => {
        const value = number(column, optional)
        if (value !== null && (!Number.isSafeInteger(value) || value > 1_000_000_000)) throw new Error(`${IMPORT_COLUMNS[column]} harus Rupiah bulat, maksimal 1 miliar.`)
        return value
      }
      const quantity = (column: number, optional = false) => {
        const value = number(column, optional), parsed = value === null ? null : parseQuantity(String(value))
        if (value !== null && parsed === null) throw new Error(`${IMPORT_COLUMNS[column]} maksimal tiga angka di belakang koma.`)
        return parsed
      }
      const key = text(0), name = text(1), categoryName = text(2), baseCode = text(3).toLowerCase(), kind = text(4).toUpperCase()
      if (key.length > 60) throw new Error('Kode Produk maksimal 60 karakter.')
      if (catalog.products.some((p) => nameKey(p.name) === nameKey(name))) throw new Error('Nama produk sudah tersedia. Impor hanya menambah produk baru; edit produk lama melalui menu Produk.')
      const previousKey = seenName.get(nameKey(name))
      if (previousKey && previousKey !== key) throw new Error('Nama produk yang sama harus memakai Kode Produk yang sama di dalam file.')
      const category = catalog.categories.find((c) => c.nameKey === nameKey(categoryName) && c.isActive), base = catalog.units.find((u) => u.code === baseCode)
      if (!category) throw new Error('Kategori belum tersedia atau nonaktif. Buat/aktifkan melalui menu Kategori dahulu.')
      if (!base) throw new Error('Kode Satuan Dasar belum tersedia. Gunakan kode pada petunjuk template.')
      if (!['UMUM', 'BBM'].includes(kind)) throw new Error('Jenis Produk harus UMUM atau BBM.')
      const costPrice = amount(5, true), minimumStock = quantity(6, true), variantName = text(7), selling = catalog.units.find((u) => u.code === text(8).toLowerCase()), conversion = quantity(9), sellingPrice = amount(10), mode = text(11).toUpperCase(), sku = text(12, false).toUpperCase(), barcode = text(13, false)
      if (!selling) throw new Error('Kode Satuan Jual belum tersedia.')
      if (conversion === null || conversion <= 0) throw new Error('Isi Satuan Dasar harus lebih dari nol.')
      if (!['TETAP', 'BEBAS'].includes(mode)) throw new Error('Mode Jumlah harus TETAP atau BEBAS (volume/berat).')
      if (sku && seenSku.has(sku)) throw new Error('SKU duplikat di file atau produk yang sudah ada, termasuk nonaktif.')
      if (barcode && seenBarcode.has(barcode)) throw new Error('Barcode duplikat di file atau produk yang sudah ada, termasuk nonaktif.')
      const metadata = JSON.stringify([name, category.id, base.id, kind, costPrice, minimumStock])
      const group = groups.get(key) ?? { draft: { name, categoryId: category.id, baseUnitId: base.id, costPrice, costKnown: costPrice !== null, minimumStock, isActive: true, unitPolicy: { kind: kind === 'BBM' ? 'fuel' : 'general', allowedPackagingUnitIds: [] }, variants: [] }, rows: [], metadata }
      if (group.metadata !== metadata) throw new Error('Nama/kategori/satuan dasar/jenis/modal/stok minimum harus sama untuk semua varian dengan Kode Produk sama.')
      const draft = structuredClone(group.draft)
      if (selling.isPackaging && selling.id !== base.id && !draft.unitPolicy!.allowedPackagingUnitIds.includes(selling.id)) draft.unitPolicy!.allowedPackagingUnitIds.push(selling.id)
      draft.variants.push({ name: variantName, sellingUnitId: selling.id, quantityInBaseUnit: conversion, sellingPrice, saleMode: mode === 'BEBAS' ? 'variable' : 'fixed', isActive: true, ...(sku ? { sku } : {}), ...(barcode ? { barcode } : {}) })
      validateProduct(draft, catalog)
      groups.set(key, { draft, rows: [...group.rows, rowNumber], metadata }); seenName.set(nameKey(name), key)
      if (sku) seenSku.add(sku)
      if (barcode) seenBarcode.add(barcode)
    } catch (cause) { issues.push({ row: rowNumber, message: cause instanceof Error ? cause.message : 'Baris tidak dapat dibaca.' }) }
  }
  if (!groups.size && !issues.length) issues.push({ row: 2, message: 'Tidak ada baris produk yang diisi.' })
  return result()
}
