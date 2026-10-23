import { IMPORT_COLUMNS, type ImportCell } from '../domain/productImport'

export const MAX_EXCEL_BYTES = 2 * 1024 * 1024
// Bound declared expanded ZIP size before handing the file to the XLSX parser.
export function validateXlsxArchive(buffer: ArrayBuffer): void {
  const data = new DataView(buffer)
  if (data.byteLength > MAX_EXCEL_BYTES || data.byteLength < 22) throw new Error('Pilih file .xlsx yang valid, maksimal 2 MB.')
  let end = data.byteLength - 22
  while (end >= Math.max(0, data.byteLength - 65557) && data.getUint32(end, true) !== 0x06054b50) end--
  if (end < Math.max(0, data.byteLength - 65557)) throw new Error('File Excel rusak atau bukan format .xlsx. Simpan ulang memakai template.')
  const count = data.getUint16(end + 10, true), size = data.getUint32(end + 12, true), start = data.getUint32(end + 16, true)
  if (data.getUint16(end + 4, true) || data.getUint16(end + 6, true) || count > 1000 || count === 0 || start + size > end) throw new Error('Struktur file Excel tidak didukung. Gunakan template sederhana satu lembar.')
  let offset = start, total = 0
  for (let i = 0; i < count; i++) {
    if (offset + 46 > start + size || data.getUint32(offset, true) !== 0x02014b50 || data.getUint16(offset + 8, true) & 1) throw new Error('File Excel rusak atau dilindungi sandi. Gunakan file tanpa sandi.')
    total += data.getUint32(offset + 24, true)
    if (total > 20 * 1024 * 1024) throw new Error('Isi file Excel terlalu besar. Pisahkan menjadi file yang lebih kecil.')
    offset += 46 + data.getUint16(offset + 28, true) + data.getUint16(offset + 30, true) + data.getUint16(offset + 32, true)
  }
  if (offset !== start + size) throw new Error('Struktur file Excel tidak lengkap. Simpan ulang file.')
}
export async function readProductExcel(file: Pick<File, 'name' | 'size' | 'arrayBuffer'>): Promise<ImportCell[][]> {
  if (!file.name.toLowerCase().endsWith('.xlsx') || file.size > MAX_EXCEL_BYTES) throw new Error('Gunakan file .xlsx maksimal 2 MB. Format .xls, CSV, dan file bersandi tidak diterima untuk impor.')
  const buffer = await file.arrayBuffer()
  validateXlsxArchive(buffer)
  try {
    const { default: readExcel } = await import('read-excel-file/universal')
    const sheets = await readExcel(buffer)
    if (sheets.length !== 1 || sheets[0].data.length > 501) throw new Error('Gunakan tepat satu lembar dengan maksimal 500 baris produk.')
    return sheets[0].data.map((row) => row.map((cell): ImportCell => {
      if (cell === null || typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean' || cell instanceof Date) return cell
      throw new Error('Tipe isi sel tidak didukung.')
    }))
  } catch (cause) { throw new Error(cause instanceof Error && cause.message.startsWith('Gunakan tepat') ? cause.message : 'File belum dapat dibaca. Gunakan template .xlsx tanpa sandi dan simpan ulang.', { cause }) }
}
export async function productTemplate(): Promise<Blob> {
  const { default: writeExcel } = await import('write-excel-file/universal')
  return writeExcel([[...IMPORT_COLUMNS]], { sheet: 'Produk', stickyRowsCount: 1, columns: IMPORT_COLUMNS.map(() => ({ width: 22 })) }).toBlob()
}
