import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { JSDOM } from 'jsdom'
import type { ReactNode } from 'react'
import { creditFixture, businessSnapshot } from './credit-fixtures'
import { checkoutFixture } from './checkout-fixtures'
import { DexieProductRepository } from '../src/data/dexieProductRepository'
import { localDatabase } from '../src/data/localDatabase'
import { ValidationError } from '../src/domain/errors'
import { userError } from '../src/lib/userError'

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://pos.test/' }), browser = dom.window
for (const key of ['window', 'document', 'HTMLElement', 'HTMLDialogElement', 'Event', 'MouseEvent'] as const) Object.defineProperty(globalThis, key, { value: key === 'window' ? browser : browser[key], configurable: true })
Object.defineProperty(globalThis, 'navigator', { value: browser.navigator, configurable: true })
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
browser.scrollTo = () => {}
browser.matchMedia = () => Object.assign(new browser.EventTarget(), { matches: true }) as unknown as MediaQueryList
browser.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
browser.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
const { act, lazy } = await import('react'), { createRoot } = await import('react-dom/client')
const { MemoryRouter, Routes, Route, Link } = await import('react-router')
const { AppRoutes } = await import('../src/app/routes'), { PageOutlet } = await import('../src/components/layout/PageOutlet')
const { DemoProvider } = await import('../src/app/DemoProvider'), { useDemoStore } = await import('../src/hooks/useDemoStore')
const { ProductForm } = await import('../src/features/products/ProductForm'), { CategoryManager } = await import('../src/features/products/CategoryManager')
const { StockMovementForm } = await import('../src/features/stock/StockMovementForm'), { CustomerForm } = await import('../src/features/credit/CustomerForm')
const { CatalogState } = await import('../src/components/ui/CatalogState'), { PwaRuntime } = await import('../src/pwa/pwaRuntime')
const { BackupPanel } = await import('../src/features/settings/BackupPanel')
const { BackupService } = await import('../src/services/backupOperations')
after(() => { localDatabase.close(); browser.close() })
const text = () => browser.document.body.textContent ?? ''
const button = (label: string) => [...browser.document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === label)!
async function wait(predicate: () => boolean) {
  for (let i = 0; i < 180; i++) { if (predicate()) return; await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)) }) }
  assert.fail(text())
}
async function mount(node: ReactNode, initial = '/', caught?: (cause: unknown) => void) {
  const container = browser.document.createElement('div'); browser.document.body.append(container)
  const root = createRoot(container, { onCaughtError: caught })
  await act(async () => root.render(<MemoryRouter initialEntries={[initial]}>{node}</MemoryRouter>))
  return { async close() { await act(async () => root.unmount()); container.remove() } }
}
function field(label: string) { return [...browser.document.querySelectorAll('label')].find((entry) => entry.textContent?.startsWith(label))!.querySelector<HTMLInputElement>('input')! }
async function input(element: HTMLInputElement, value: string) {
  await act(async () => { Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value')!.set!.call(element, value); element.dispatchEvent(new browser.Event('input', { bubbles: true })) })
}
function submitTwice() { const form = browser.document.querySelector('form')!; for (let i = 0; i < 2; i++) form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true })) }
function deferred() { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done }); return { promise, resolve } }
function Ready({ children }: { children: ReactNode }) { return useDemoStore().status === 'ready' ? children : <CatalogState /> }
async function formFixture() {
  const f = await creditFixture(checkoutFixture('pcs', 'fixed')), repository = new DexieProductRepository(f.db)
  const wrap = (children: ReactNode) => <DemoProvider repository={repository} inventory={f.inventory} checkout={f.checkout} customers={f.customers}><Ready>{children}</Ready></DemoProvider>
  return { ...f, repository, wrap }
}

test('error UI hanya menampilkan pesan validasi aplikasi, bukan detail IndexedDB atau exception tak dikenal', () => {
  assert.equal(userError(new ValidationError('Barcode harus unik.'), 'Aman'), 'Barcode harus unik.')
  for (const error of [new DOMException('IDBTransaction objectStore secret', 'UnknownError'), new Error('internal database stack'), 'raw']) assert.equal(userError(error, 'Coba baca ulang tanpa menghapus data.'), 'Coba baca ulang tanpa menghapus data.')
})

test('Suspense menampilkan loading Indonesia; menu masih dapat berpindah dari halaman tertunda', async () => {
  const pending = deferred(), Slow = lazy(async () => { await pending.promise; return { default: () => <p>Halaman siap</p> } })
  const ui = await mount(<Routes><Route element={<><Link to="/cepat">Buka cepat</Link><PageOutlet /></>}><Route index element={<Slow />} /><Route path="cepat" element={<p>Halaman cepat</p>} /></Route></Routes>)
  try {
    assert.match(browser.document.querySelector('[role="status"]')!.textContent!, /Memuat halaman/)
    await act(async () => browser.document.querySelector<HTMLAnchorElement>('a')!.click())
    assert.match(text(), /Halaman cepat/)
    await act(async () => pending.resolve())
    assert.doesNotMatch(text(), /Halaman siap/)
  } finally { await ui.close() }
})

test('lazy import gagal: boundary memberi tindakan aman, menyembunyikan stack dan pulih saat pindah route', async () => {
  const Broken = lazy(() => Promise.reject(new Error('Failed to fetch dynamically imported module /secret.js'))), caught: unknown[] = []
  const ui = await mount(<Routes><Route element={<PageOutlet />}><Route index element={<Broken />} /><Route path="dashboard" element={<p>Dashboard kembali</p>} /></Route></Routes>, '/', (error) => { caught.push(error) })
  try {
    await wait(() => !!browser.document.querySelector('[role="alert"]'))
    assert.equal(caught.length, 1); assert.match(text(), /Jangan hapus data browser/); assert.doesNotMatch(text(), /secret.js|Failed to fetch/)
    assert.match(text(), /periksa pemulihan transaksi/i)
    let confirmations = 0
    browser.confirm = () => { confirmations++; return false }
    await act(async () => button('Muat ulang aplikasi').click()); assert.equal(confirmations, 1)
    await act(async () => browser.document.querySelector<HTMLAnchorElement>('a[href="/dashboard"]')!.click())
    assert.match(text(), /Dashboard kembali/); assert.equal(browser.document.querySelector('[role="alert"]'), null)
  } finally { await ui.close() }
})

test('render halaman gagal juga ditangkap boundary, tanpa menjalankan ulang tindakan bisnis', async () => {
  function BrokenRender(): ReactNode { throw new Error('Internal render exception') }
  const caught: unknown[] = []
  const ui = await mount(<Routes><Route element={<PageOutlet />}><Route index element={<BrokenRender />} /></Route></Routes>, '/', (cause) => { caught.push(cause) })
  try { assert.equal(caught.length, 1); assert.match(text(), /Halaman belum dapat ditampilkan/); assert.doesNotMatch(text(), /Internal render exception/) }
  finally { await ui.close() }
})

test('route nyata lazy: seluruh menu terbuka, keranjang tetap ada setelah navigasi, tanpa transaksi atau perubahan stok', async () => {
  const f = await creditFixture(checkoutFixture('pcs', 'fixed'))
  for (const table of localDatabase.tables) await table.bulkAdd(await f.db.table(table.name).toArray())
  const ui = await mount(<AppRoutes />, '/kasir')
  try {
    await wait(() => browser.document.querySelector<HTMLButtonElement>('.product-add')?.disabled === false && !text().includes('Memeriksa transaksi belum selesai'))
    await act(async () => browser.document.querySelector<HTMLButtonElement>('.product-add')!.click())
    assert.match(browser.document.querySelector('.cart-panel')!.textContent!, /1 item/)
    const before = await businessSnapshot(localDatabase)
    const pages = [
      ['/produk', 'Tambah produk'], ['/stok', 'Stok'], ['/bon', 'Tambah pelanggan'], ['/laporan', 'Ekspor CSV'],
      ['/penjualan', 'Riwayat'], ['/pengaturan', 'Informasi warung'], ['/dashboard', 'Penjualan periode'],
    ]
    for (const [path, expected] of pages) {
      await act(async () => browser.document.querySelector<HTMLAnchorElement>(`nav[aria-label="Navigasi operasional"] a[href="${path}"]`)!.click())
      await wait(() => (browser.document.getElementById('operasional')?.textContent ?? '').includes(expected))
    }
    await act(async () => browser.document.querySelector<HTMLAnchorElement>('nav[aria-label="Navigasi operasional"] a[href="/kasir"]')!.click())
    await wait(() => !!browser.document.querySelector('.cart-panel'))
    assert.match(browser.document.querySelector('.cart-panel')!.textContent!, /1 item/)
    assert.deepEqual(await businessSnapshot(localDatabase), before)
  } finally { await ui.close(); await f.db.delete() }
})

test('produk: bantuan harga/barcode sesuai domain dan dua submit pada tick sama hanya menyimpan sekali', async () => {
  const f = await formFixture(), release = deferred(), save = f.repository.saveProduct.bind(f.repository)
  let calls = 0, saved = 0
  f.repository.saveProduct = async (draft) => { calls++; await release.promise; return save(draft) }
  const ui = await mount(f.wrap(<ProductForm product={null} onClose={() => {}} onSaved={() => { saved++ }} />))
  try {
    await wait(() => !!browser.document.querySelector('dialog form'))
    await input(field('Nama produk'), 'Produk baru')
    await input(field('Modal per 1'), '-100'); assert.equal(field('Modal per 1').getAttribute('aria-invalid'), 'true')
    await act(async () => submitTwice()); assert.equal(calls, 0)
    await input(field('Modal per 1'), '')
    await input(field('Harga jual'), '1,5'); assert.equal(field('Harga jual').getAttribute('aria-invalid'), 'true')
    await act(async () => submitTwice()); assert.equal(calls, 0)
    await input(field('Harga jual'), '15.000'); await input(field('Barcode'), 'tidak sah!')
    assert.equal(field('Barcode').getAttribute('aria-invalid'), 'true')
    await act(async () => submitTwice()); assert.equal(calls, 0); assert.match(text(), /Barcode harus unik/)
    await input(field('Barcode'), 'PHASE8-001')
    await act(async () => submitTwice()); assert.equal(calls, 1); assert.equal(button('Menyimpan…').disabled, true)
    await act(async () => release.resolve()); await wait(() => saved === 1)
    assert.equal(await f.db.products.count(), 2); assert.equal(await f.db.sales.count(), 0)
    assert.equal((await f.db.products.toArray()).find((product) => product.name === 'Produk baru')!.costPrice, null)
  } finally { await ui.close(); await f.db.delete() }
})

test('produk: kegagalan penyimpanan terlihat, draft tetap ada, retry eksplisit dan tidak menciptakan data palsu', async () => {
  const f = await formFixture(), save = f.repository.saveProduct.bind(f.repository)
  f.repository.saveProduct = async () => { throw new DOMException('IDBTransaction capacity internal', 'QuotaExceededError') }
  let saved = 0
  const ui = await mount(f.wrap(<ProductForm product={null} onClose={() => {}} onSaved={() => { saved++ }} />))
  try {
    await wait(() => !!browser.document.querySelector('dialog form')); await input(field('Nama produk'), 'Draft tetap ada')
    const before = await businessSnapshot(f.db)
    await act(async () => submitTwice()); await wait(() => !!browser.document.querySelector('[role="alert"]'))
    assert.match(text(), /Periksa izin dan ruang penyimpanan/); assert.doesNotMatch(text(), /IDBTransaction|capacity internal/)
    assert.equal(field('Nama produk').value, 'Draft tetap ada'); assert.deepEqual(await businessSnapshot(f.db), before)
    f.repository.saveProduct = save
    await act(async () => submitTwice()); await wait(() => saved === 1)
    assert.equal(await f.db.products.count(), 2)
  } finally { await ui.close(); await f.db.delete() }
})

test('kategori: submit berulang sebelum render hanya memanggil repository sekali', async () => {
  const f = await formFixture(), release = deferred(), save = f.repository.saveCategory.bind(f.repository); let calls = 0
  f.repository.saveCategory = async (name, id) => { calls++; await release.promise; return save(name, id) }
  const ui = await mount(f.wrap(<CategoryManager onClose={() => {}} />))
  try {
    await wait(() => !!browser.document.querySelector('dialog form')); await input(field('Kategori baru'), 'Baru')
    await act(async () => submitTwice()); assert.equal(calls, 1)
    await act(async () => release.resolve()); await wait(() => text().includes('Kategori tersimpan'))
    assert.equal(await f.db.categories.count(), 2)
  } finally { await ui.close(); await f.db.delete() }
})

test('stok: submit berulang hanya menulis satu mutasi dengan konversi dan saldo tetap tepat', async () => {
  const f = await formFixture(), release = deferred(), execute = f.inventory.execute.bind(f.inventory); let calls = 0, saved = 0
  f.inventory.execute = async (command) => { calls++; await release.promise; return execute(command) }
  const ui = await mount(f.wrap(<StockMovementForm productId={f.product.id} initialType="STOCK_IN" onClose={() => {}} onSaved={() => { saved++ }} />))
  try {
    await wait(() => !!browser.document.querySelector('dialog form')); await input(field('Jumlah'), '2')
    await act(async () => submitTwice()); assert.equal(calls, 1)
    await act(async () => release.resolve()); await wait(() => saved === 1)
    assert.equal((await f.db.inventoryBalances.get(f.product.id))!.quantityBase, 102000)
    assert.equal(await f.db.stockMovements.count(), 2)
  } finally { await ui.close(); await f.db.delete() }
})

test('pelanggan: pesan validasi tetap jelas, storage error tidak bocor dan submit tidak ganda', async () => {
  const f = await formFixture(), release = deferred(); let calls = 0
  f.customers.save = async () => { calls++; await release.promise; throw new Error('IDB raw internal stack') }
  const ui = await mount(<CustomerForm customer={null} service={f.customers} onClose={() => {}} onSaved={() => assert.fail()} />)
  try {
    await input(field('Nama pelanggan'), 'Nama tetap'); await act(async () => submitTwice()); assert.equal(calls, 1)
    await act(async () => release.resolve()); await wait(() => !!browser.document.querySelector('[role="alert"]'))
    assert.match(text(), /Periksa penyimpanan browser/); assert.doesNotMatch(text(), /raw internal/); assert.equal(field('Nama pelanggan').value, 'Nama tetap')
  } finally { await ui.close(); await f.db.delete() }
})

test('katalog gagal membuka IndexedDB: error dengan baca ulang, bukan data nol atau reset', async () => {
  const f = await formFixture(); f.repository.initialize = async () => { throw new DOMException('IDB open denied secret', 'SecurityError') }
  const ui = await mount(f.wrap(<p>Data siap</p>))
  try {
    await wait(() => !!browser.document.querySelector('[role="alert"]'))
    assert.match(text(), /Coba baca ulang/); assert.doesNotMatch(text(), /secret|Data siap/)
    const before = await businessSnapshot(f.db)
    f.repository.initialize = async () => {}
    await act(async () => button('Coba baca ulang').click()); await wait(() => text().includes('Data siap'))
    assert.deepEqual(await businessSnapshot(f.db), before)
  } finally { await ui.close(); await f.db.delete() }
})

test('backup gagal membaca storage: tindakan jelas, tidak membuat file atau melakukan restore', async () => {
  let writes = 0
  const service = new BackupService({ async read() { throw new DOMException('IDB read internal details', 'UnknownError') }, async replace() { writes++ } }, { exclusive: (action) => action(), checkRecovery() {}, restored() { writes++ } })
  const ui = await mount(<BackupPanel hasCart={false} service={service} />)
  try {
    await act(async () => button('Cadangkan Data').click()); await wait(() => !!browser.document.querySelector('[role="alert"]'))
    assert.match(text(), /Cadangan belum berhasil dibuat/); assert.doesNotMatch(text(), /internal details/); assert.equal(writes, 0)
  } finally { await ui.close() }
})

test('PWA: pemeriksaan cache yang gagal membatalkan status siap; pemeriksaan berikut dapat pulih', async () => {
  const runtime = new PwaRuntime(); let ready = true, probe: (() => Promise<number>) | undefined
  const active = { postMessage(_message: unknown, ports: readonly MessagePort[]) { ports[0].postMessage({ ready, count: 1, version: 'test' }); ports[0].close() } }
  const registration = Object.assign(new browser.EventTarget(), { active, waiting: null })
  const container = { register: async () => registration, ready: Promise.resolve(registration) } as unknown as ServiceWorkerContainer
  await runtime.start(true, true, container, (value) => { probe = value })
  assert.equal(runtime.getSnapshot().ready, true)
  ready = false; await assert.rejects(probe!(), /Aset offline belum lengkap/)
  assert.equal(runtime.getSnapshot().ready, false); assert.match(runtime.getSnapshot().message, /Sambungkan jaringan/)
  ready = true; assert.equal(await probe!(), 1); assert.equal(runtime.getSnapshot().ready, true)
})
