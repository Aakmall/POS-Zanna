import type { CatalogSnapshot, ProductDraft } from './product'
export const IMPORT_COLUMNS = ['Kode Produk', 'Nama Produk', 'Kategori', 'Satuan Dasar', 'Jenis Produk', 'Harga Modal', 'Stok Minimum', 'Nama Varian', 'Satuan Jual', 'Isi Satuan Dasar', 'Harga Jual', 'Mode Jumlah', 'SKU', 'Barcode'] as const
export type ImportCell = string | number | boolean | Date | null
export interface ImportIssue { row: number; message: string }
export interface ImportPreview { rows: number; products: number; variants: number; issues: readonly ImportIssue[]; drafts: readonly ProductDraft[]; catalogFingerprint: string }
export interface ProductImportRepository { snapshot(): Promise<CatalogSnapshot>; commit(preview: ImportPreview): Promise<number> }

export function catalogFingerprint(snapshot: CatalogSnapshot): string {
  return JSON.stringify([snapshot.products, snapshot.categories, snapshot.units, snapshot.variants].map((rows) => [...rows].sort((a, b) => a.id.localeCompare(b.id))))
}
