import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { JSDOM } from 'jsdom'
import { CreditError } from '../src/domain/credit'
import { DexieCreditRepository } from '../src/data/dexieCreditRepository'
import { DexieProductRepository } from '../src/data/dexieProductRepository'
import { CreditService } from '../src/services/creditOperations'
import { browserCheckoutSession } from '../src/features/cashier/checkoutSession'
import { bonCommand, businessSnapshot, creditFixture } from './credit-fixtures'
import { checkoutFixture } from './checkout-fixtures'

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' }), browser = dom.window
for (const key of ['window', 'document', 'HTMLElement', 'HTMLDialogElement', 'HTMLInputElement', 'Event', 'MouseEvent', 'FormData'] as const) Object.defineProperty(globalThis, key, { value: key === 'window' ? browser : browser[key], configurable: true })
Object.defineProperty(globalThis, 'navigator', { value: browser.navigator, configurable: true }); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
browser.scrollTo = () => {}
let width = 1366
browser.matchMedia = () => Object.assign(new browser.EventTarget(), { get matches() { return width >= 1024 }, media: '(min-width: 1024px)', onchange: null, addListener() {}, removeListener() {} }) as unknown as MediaQueryList
browser.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
browser.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
const { act } = await import('react'), { createRoot } = await import('react-dom/client')
const { MemoryRouter } = await import('react-router')
const { CreditPage } = await import('../src/features/credit/CreditPage')
const { AppRoutes } = await import('../src/app/routes')
const { DemoProvider } = await import('../src/app/DemoProvider')
const { CashierPage } = await import('../src/features/cashier/CashierPage')
after(() => dom.window.close())
const text = () => browser.document.body.textContent ?? ''
const button = (label: string) => { const element = [...browser.document.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent === label); assert.ok(element, `Tombol ${label}`); return element }
async function click(label: string) { await act(async () => button(label).click()) }
async function wait(condition: () => boolean) {
  for (let i = 0; i < 150; i++) { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) }); if (condition()) return }
  assert.fail(`DOM tidak mencapai kondisi: ${text().slice(-1800)}`)
}
function field<T extends HTMLInputElement | HTMLSelectElement>(label: string, scope: ParentNode = browser.document): T {
  const element = [...scope.querySelectorAll('label')].find((item) => item.textContent!.startsWith(label))?.querySelector<T>('input,select')
  assert.ok(element, `Field ${label}`); return element
}
async function input(element: HTMLInputElement, value: string) { await act(async () => { Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value')!.set!.call(element, value); element.dispatchEvent(new browser.Event('input', { bubbles: true })) }) }
async function select(element: HTMLSelectElement, value: string) { await act(async () => { element.value = value; element.dispatchEvent(new browser.Event('change', { bubbles: true })) }) }
async function setup(bon = false) {
  browser.localStorage.clear(); browser.sessionStorage.clear(); width = 1366
  const f = await creditFixture(checkoutFixture('l', 'fixed')), credit = new CreditService(new DexieCreditRepository(f.db))
  if (bon) { const command = await bonCommand(f, [{ variantId: f.variant.id, quantity: 1000 }]); await f.checkout.prepare(command); await f.checkout.execute(command) }
  return { ...f, credit }
}
type Fixture = Awaited<ReturnType<typeof setup>>
async function mount(f: Fixture, options: { cashier?: boolean; route?: string; service?: CreditService } = {}) {
  const container = browser.document.createElement('div'); browser.document.body.append(container); const root = createRoot(container)
  const service = options.service ?? f.credit
  await act(async () => root.render(<MemoryRouter initialEntries={[options.route ?? '/bon']}>{options.cashier ? <DemoProvider repository={new DexieProductRepository(f.db)} inventory={f.inventory} checkout={f.checkout} customers={f.customers}><CashierPage /></DemoProvider> : options.route ? <AppRoutes credit={service} customers={f.customers} /> : <CreditPage service={service} customers={f.customers} />}</MemoryRouter>))
  return { unmount: async () => { await act(async () => root.unmount()); container.remove() } }
}
test('DOM pelanggan tambah/edit/arsip/cari/detail: data nyata tersimpan, tagihan lama tetap', async () => {
  const f = await setup(true), ui = await mount(f)
  try {
    await wait(() => text().includes('Bu Sari') && text().includes('Tagihan Bon'))
    await click('Tambah pelanggan'); await input(field('Nama pelanggan', browser.document.querySelector('dialog')!), 'Pak Budi')
    await input(field('Telepon', browser.document.querySelector('dialog')!), '089999')
    await click('Simpan pelanggan'); await wait(() => !browser.document.querySelector('dialog') && text().includes('Pak Budi'))
    await input(field('Cari pelanggan'), '089999'); assert.equal(browser.document.querySelector('[aria-label="Detail pelanggan Bu Sari"]'), null)
    await act(async () => browser.document.querySelector<HTMLButtonElement>('[aria-label="Detail pelanggan Pak Budi"]')!.click())
    await click('Edit / arsipkan pelanggan'); await input(field('Nama pelanggan', browser.document.querySelector('dialog')!), 'Budi baru')
    await act(async () => browser.document.querySelector<HTMLInputElement>('dialog input[type="checkbox"]')!.click())
    await click('Simpan pelanggan'); await wait(() => !browser.document.querySelector('dialog') && text().includes('Budi baru'))
    await act(async () => {
      const budi = (await f.customers.list()).find((customer) => customer.phone === '089999')!
      assert.equal(budi.name, 'Budi baru'); assert.equal(budi.isActive, false)
      assert.equal(await f.db.receivables.count(), 1); assert.equal((await f.credit.overview()).totalOutstanding, 13000)
    })
    await input(field('Cari pelanggan'), ''); await select(field('Status pelanggan'), 'archived')
    assert.ok(browser.document.querySelector('[aria-label="Detail pelanggan Budi baru"]'))
    assert.equal(browser.document.querySelector('[aria-label="Detail pelanggan Bu Sari"]'), null)
  } finally { await ui.unmount(); await f.db.delete() }
})
test('DOM Bon nyata: pilih pelanggan wajib, double-click satu Sale/tagihan, QRIS tetap disabled pada tablet', async () => {
  const f = await setup(); width = 768
  const ui = await mount(f, { cashier: true })
  try {
    await wait(() => !!browser.document.querySelector('.product-add') && !browser.document.querySelector<HTMLButtonElement>('.product-add')!.disabled)
    await act(async () => browser.document.querySelector<HTMLButtonElement>('.product-add')!.click())
    await act(async () => browser.document.querySelector<HTMLButtonElement>('[aria-label="Buka keranjang dan pembayaran"]')!.click())
    assert.equal(button('QRIS DEMO').disabled, true); await click('Bon')
    const pay = [...browser.document.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent!.startsWith('Catat Bon '))!
    assert.ok(pay); await act(async () => pay.click())
    await wait(() => !!browser.document.querySelector('option[value="' + f.customer.id + '"]'))
    assert.equal(button('Konfirmasi Bon / Bayar Nanti').disabled, true)
    assert.equal(browser.document.querySelector('#cash'), null)
    await select(field('Pelanggan aktif'), f.customer.id)
    const confirm = button('Konfirmasi Bon / Bayar Nanti')
    await act(async () => { confirm.click(); confirm.click(); confirm.click() })
    await wait(() => !!browser.document.querySelector('[aria-label="Struk penjualan tersimpan"]'))
    assert.match(text(), /Bon \/ Bayar Nanti/); assert.match(text(), /Bu Sari/)
    assert.equal(await f.db.sales.count(), 1); assert.equal(await f.db.receivables.count(), 1)
    assert.equal((await f.db.inventoryBalances.get(f.product.id))!.quantityBase, 99000)
    await click('Tutup struk'); await click('Buka struk terakhir')
    await wait(() => text().includes('Total Utang saat pembelian')); assert.equal(await f.db.sales.count(), 1)
  } finally { await ui.unmount(); await f.db.delete() }
})
test('DOM checkout Bon recovery v2 setelah refresh: tidak menerima uang, memakai ID sama', async () => {
  const f = await setup(), command = await bonCommand(f, [{ variantId: f.variant.id, quantity: 1000 }])
  await f.checkout.prepare(command); browserCheckoutSession.write({ active: command, lastId: null })
  const ui = await mount(f, { cashier: true })
  try {
    await wait(() => text().includes('Konfirmasi tersimpan / pemulihan'))
    assert.equal(await f.db.sales.count(), 0); assert.match(text(), /Pelanggan: Bu Sari/); assert.equal(browser.document.querySelector('#cash'), null)
    await click('Lanjutkan request yang sama'); await wait(() => !!browser.document.querySelector('[aria-label="Struk penjualan tersimpan"]'))
    assert.equal((await f.db.sales.toArray())[0].checkoutOperationId, command.checkoutOperationId)
    assert.equal(await f.db.receivables.count(), 1)
  } finally { await ui.unmount(); await f.db.delete() }
})
test('DOM cicilan/pelunasan: bukti bisa dibuka kembali, Lunas dan saldo live, stok tetap', async () => {
  const f = await setup(true), ui = await mount(f)
  try {
    await wait(() => !!browser.document.querySelector('[data-receivable-id]'))
    const beforeStock = await f.db.inventoryBalances.toArray(), beforeLedger = await f.db.stockMovements.toArray()
    await click('Lihat tagihan & struk'); await wait(() => text().includes('Belum ada pembayaran.'))
    await click('Bayar Cicilan'); await input(field('Nominal cicilan'), '5000')
    const confirm = button('Konfirmasi pembayaran Bon'); await act(async () => { confirm.click(); confirm.click() })
    await wait(() => !!browser.document.querySelector('[aria-label="Bukti pembayaran Bon tersimpan"]'))
    assert.equal(await f.db.creditPayments.count(), 1)
    const debt = (await f.db.receivables.toArray())[0]; assert.equal(debt.status, 'PARTIAL'); assert.equal(debt.balance, 8000)
    await click('Tutup bukti pembayaran'); await click('Lihat tagihan & struk'); await wait(() => text().includes('Buka bukti pembayaran'))
    await click('Buka bukti pembayaran'); await wait(() => !!browser.document.querySelector('[aria-label="Bukti pembayaran Bon tersimpan"]'))
    assert.equal(await f.db.creditPayments.count(), 1)
    await click('Tutup bukti pembayaran'); await click('Lihat tagihan & struk'); await wait(() => text().includes('Bayar Cicilan'))
    await click('Bayar Cicilan'); await click('Isi pelunasan penuh'); await click('Konfirmasi pembayaran Bon')
    await wait(() => !!browser.document.querySelector('[aria-label="Bukti pembayaran Bon tersimpan"]'))
    assert.equal((await f.db.receivables.get(debt.id))!.status, 'PAID')
    await click('Tutup bukti pembayaran'); await select(field('Status tagihan'), 'PAID')
    await wait(() => text().includes('Lunas'))
    assert.equal((await f.credit.overview()).totalOutstanding, 0)
    assert.deepEqual(await f.db.inventoryBalances.toArray(), beforeStock); assert.deepEqual(await f.db.stockMovements.toArray(), beforeLedger)
  } finally { await ui.unmount(); await f.db.delete() }
})
test('DOM route /bon detail struk pada empat viewport: pembacaan tidak mengubah seluruh tabel', async () => {
  const f = await setup(true), debt = (await f.db.receivables.toArray())[0]
  try {
    const before = await businessSnapshot(f.db)
    for (const size of [390, 768, 1024, 1366]) {
      width = size
      const ui = await mount(f, { route: `/bon?tagihan=${debt.id}` })
      try { await wait(() => !!browser.document.querySelector('[aria-label="Struk penjualan tersimpan"]')); assert.match(text(), /Bu Sari/); assert.equal(await f.db.creditPayments.count(), 0) }
      finally { await ui.unmount() }
    }
    assert.deepEqual(await businessSnapshot(f.db), before)
  } finally { await f.db.delete() }
})
test('DOM Bon loading/error/retry: kegagalan penyimpanan tidak disamarkan menjadi piutang nol', async () => {
  const f = await setup(true), repo = new DexieCreditRepository(f.db), original = repo.subscribe.bind(repo)
  repo.subscribe = () => () => {}
  let ui = await mount(f, { service: new CreditService(repo) })
  try { assert.match(text(), /Membaca pelanggan dan Bon/); assert.equal(browser.document.querySelector('[data-receivable-id]'), null) }
  finally { await ui.unmount() }
  repo.subscribe = (_next, error) => { error(new CreditError('STORAGE_ERROR', 'Penyimpanan uji tidak terbaca')); return () => {} }
  ui = await mount(f, { service: new CreditService(repo) })
  try {
    await wait(() => text().includes('Penyimpanan uji tidak terbaca')); assert.equal(browser.document.querySelector('[data-receivable-id]'), null)
    repo.subscribe = original; await click('Coba lagi'); await wait(() => !!browser.document.querySelector('[data-receivable-id]'))
    assert.equal((await f.credit.overview()).totalOutstanding, 13000)
  } finally { await ui.unmount(); await f.db.delete() }
})
test('DOM cicilan response-lost lalu refresh: pulihkan bukti tersimpan tanpa pembayaran kedua', async () => {
  const f = await setup(true), execute = f.credit.execute.bind(f.credit)
  f.credit.execute = async (command) => { await execute(command); throw new CreditError('STORAGE_ERROR', 'Response hilang sesudah commit') }
  let ui = await mount(f)
  try {
    await wait(() => !!browser.document.querySelector('[data-receivable-id]'))
    await click('Lihat tagihan & struk'); await wait(() => text().includes('Bayar Cicilan'))
    await click('Bayar Cicilan'); await input(field('Nominal cicilan'), '5000'); await click('Konfirmasi pembayaran Bon')
    await wait(() => browser.document.querySelector('[data-payment-status]')?.getAttribute('data-payment-status') === 'uncertain')
    const payment = (await f.db.creditPayments.toArray())[0]; assert.ok(payment)
    await ui.unmount(); f.credit.execute = execute
    ui = await mount(f)
    await wait(() => [...browser.document.querySelectorAll('button')].some((element) => element.textContent!.startsWith('Pulihkan pembayaran ')))
    const recover = [...browser.document.querySelectorAll<HTMLButtonElement>('button')].find((element) => element.textContent!.startsWith('Pulihkan pembayaran '))!
    await act(async () => recover.click())
    await wait(() => !!browser.document.querySelector('[aria-label="Bukti pembayaran Bon tersimpan"]'))
    assert.match(text(), new RegExp(payment.receiptNumber)); assert.equal(await f.db.creditPayments.count(), 1)
    assert.equal((await f.credit.overview()).totalOutstanding, 8000)
  } finally { await ui.unmount(); await f.db.delete() }
})
test('DOM direct link tagihan tidak valid menampilkan error, tidak meruntuhkan halaman atau mengubah DB', async () => {
  const f = await setup(true), before = await businessSnapshot(f.db), ui = await mount(f, { route: '/bon?tagihan=bukan-uuid' })
  try { await wait(() => text().includes('harus UUID')); assert.match(text(), /Pelanggan & Bon/); assert.deepEqual(await businessSnapshot(f.db), before) }
  finally { await ui.unmount(); await f.db.delete() }
})
