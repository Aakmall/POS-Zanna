import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { JSDOM } from 'jsdom'
import { historyFixture, historySale, historySnapshot } from './sales-history-fixtures'
import { DexieReportingRepository } from '../src/data/dexieReportingRepository'
import { ReportingService } from '../src/services/reportingOperations'
import { DexieProductImportRepository } from '../src/data/dexieProductImportRepository'
import { ProductImportService } from '../src/services/productImportOperations'
import { IMPORT_COLUMNS } from '../src/domain/productImport'
import { creditFixture } from './credit-fixtures'
import { localDatabase } from '../src/data/localDatabase'
import writeExcel from 'write-excel-file/universal'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' }), browser = dom.window
for (const key of ['window', 'document', 'HTMLElement', 'HTMLDialogElement', 'Event', 'MouseEvent'] as const) Object.defineProperty(globalThis, key, { value: key === 'window' ? browser : browser[key], configurable: true })
Object.defineProperty(globalThis, 'navigator', { value: browser.navigator, configurable: true })
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
browser.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
browser.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
const downloads: Blob[] = []
const originalUrl = URL.createObjectURL, originalRevoke = URL.revokeObjectURL
URL.createObjectURL = (blob) => { if (blob instanceof Blob) downloads.push(blob); return 'blob:test-export' }; URL.revokeObjectURL = () => {}
browser.HTMLAnchorElement.prototype.click = function () {}
const { act } = await import('react'), { createRoot } = await import('react-dom/client'), { MemoryRouter } = await import('react-router')
const { ReportsPage } = await import('../src/features/reports/ReportsPage'), { ProductImportDialog } = await import('../src/features/products/ProductImportDialog')
after(() => { URL.createObjectURL = originalUrl; URL.revokeObjectURL = originalRevoke; localDatabase.close(); browser.close() })
const text = () => browser.document.body.textContent ?? ''
const button = (label: string) => [...browser.document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === label)!
async function wait(predicate: () => boolean) { for (let i = 0; i < 150; i++) { if (predicate()) return; await act(async () => { await new Promise((resolve) => setTimeout(resolve, 15)) }) }; assert.fail(text()) }
async function mount(node: Parameters<ReturnType<typeof createRoot>['render']>[0]) {
  const container = browser.document.createElement('div'); browser.document.body.append(container); const root = createRoot(container)
  await act(async () => root.render(<MemoryRouter>{node}</MemoryRouter>))
  return { async close() { await act(async () => root.unmount()); container.remove() } }
}
test('DOM laporan: data nyata, periode/metode, laba parsial, piutang, CSV dan tidak menulis', async () => {
  const f = historyFixture(); await historySale(f.db, new Date().toISOString())
  const before = await historySnapshot(f.db), ui = await mount(<ReportsPage service={new ReportingService(new DexieReportingRepository(f.db))} />)
  try {
    await wait(() => !!browser.document.querySelector('[data-metric="revenue"]'))
    assert.match(text(), /Rp\s*19\.500/); assert.doesNotMatch(text(), /Laba kotor DEMO|Transaksi DEMO/)
    await act(async () => button('Laba Kotor').click()); await wait(() => text().includes('1 baris tidak memiliki'))
    assert.match(text(), /Parsial/); assert.match(text(), /Pembatasan khusus pemilik belum diterapkan/)
    await act(async () => button('Piutang').click()); assert.match(text(), /Piutang saat ini/)
    await act(async () => button('Penjualan').click())
    const selects = browser.document.querySelectorAll<HTMLSelectElement>('select')
    await act(async () => { selects[1].value = 'BON'; selects[1].dispatchEvent(new browser.Event('change', { bubbles: true })) })
    await wait(() => text().includes('Belum ada transaksi tersimpan'))
    await act(async () => button('Ekspor CSV').click()); await wait(() => text().includes('File CSV telah disiapkan'))
    assert.match(await downloads.at(-1)!.text(), /Laporan penjualan/)
    await act(async () => { selects[0].value = 'custom'; selects[0].dispatchEvent(new browser.Event('change', { bubbles: true })) })
    await wait(() => text().includes('Isi tanggal mulai'))
    assert.equal(browser.document.querySelector('[data-metric="revenue"]'), null)
    assert.deepEqual(await historySnapshot(f.db), before)
  } finally { await ui.close(); await f.db.delete() }
})
test('DOM impor: preview tanpa write, konfirmasi wajib, double-click hanya satu penyimpanan', async () => {
  const f = await creditFixture(), importer = new ProductImportService(new DexieProductImportRepository(f.db))
  let saved = 0
  const ui = await mount(<ProductImportDialog units={f.catalog.units} service={importer} onClose={() => {}} onSaved={(n) => { saved += n }} />)
  try {
    const blob = await writeExcel([[...IMPORT_COLUMNS], ['NEW', 'Bensin impor DOM', 'Kategori uji', 'l', 'BBM', 10000, 5, 'Botol 1,5 L', 'botol', 1.5, 18000, 'TETAP', 'NEW-DOM', '00123']], { sheet: 'Produk' }).toBlob()
    const input = browser.document.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(input, 'files', { configurable: true, value: [{ name: 'products.xlsx', size: blob.size, arrayBuffer: () => blob.arrayBuffer() }] })
    const before = await historySnapshot(f.db)
    await act(async () => input.dispatchEvent(new browser.Event('change', { bubbles: true })))
    await wait(() => text().includes('Preview: 1 produk'))
    assert.match(text(), /1 Botol = 1,5 Liter/); assert.match(text(), /18\.000/)
    assert.deepEqual(await historySnapshot(f.db), before); assert.equal(button('Konfirmasi impor').disabled, true)
    await act(async () => browser.document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
    await act(async () => { button('Konfirmasi impor').click(); button('Konfirmasi impor').click() })
    await wait(() => saved === 1)
    assert.equal(await f.db.products.count(), 2); assert.equal(await f.db.inventoryBalances.count(), 1)
  } finally { await ui.close(); await f.db.delete() }
})
test('DOM impor rusak: nomor baris kesalahan terlihat dan konfirmasi tetap terkunci', async () => {
  const f = await creditFixture(), importer = new ProductImportService(new DexieProductImportRepository(f.db)), ui = await mount(<ProductImportDialog units={f.catalog.units} service={importer} onClose={() => {}} onSaved={() => assert.fail('must not save')} />)
  try {
    const blob = await writeExcel([[...IMPORT_COLUMNS], ['NEW', 'Bensin salah', 'Kategori uji', 'l', 'BBM', 10000, 5, 'Botol', 'botol', 0, -1, 'TETAP', '', '']], { sheet: 'Produk' }).toBlob()
    const input = browser.document.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(input, 'files', { configurable: true, value: [{ name: 'bad.xlsx', size: blob.size, arrayBuffer: () => blob.arrayBuffer() }] })
    const before = await historySnapshot(f.db)
    await act(async () => input.dispatchEvent(new browser.Event('change', { bubbles: true })))
    await wait(() => text().includes('Baris 2:'))
    assert.equal(button('Konfirmasi impor').disabled, true); assert.equal(browser.document.querySelector('input[type="checkbox"]'), null)
    assert.deepEqual(await historySnapshot(f.db), before)
  } finally { await ui.close(); await f.db.delete() }
})
