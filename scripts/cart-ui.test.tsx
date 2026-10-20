import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { ZannaDatabase } from '../src/data/database'
import { DexieProductRepository } from '../src/data/dexieProductRepository'

test('DOM: produk tersimpan muncul; desktop/drawer berbagi keranjang pada empat viewport', { timeout: 15000 }, async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' })
  const browser = dom.window
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLDialogElement', 'Event', 'MouseEvent'] as const) Object.defineProperty(globalThis, key, { value: key === 'window' ? browser : browser[key], configurable: true })
  Object.defineProperty(globalThis, 'navigator', { value: browser.navigator, configurable: true })
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  let width = 1366
  const media = new browser.EventTarget()
  const mql = Object.assign(media, { media: '(min-width: 1024px)', onchange: null, get matches() { return width >= 1024 }, addListener() {}, removeListener() {} })
  Object.defineProperty(mql, 'matches', { get: () => width >= 1024 })
  browser.matchMedia = () => mql as unknown as MediaQueryList
  browser.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); this.querySelector<HTMLButtonElement>('button')?.focus() }
  browser.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  const React = await import('react')
  const { act } = React
  const { createRoot } = await import('react-dom/client')
  const { MemoryRouter } = await import('react-router')
  const { DemoProvider } = await import('../src/app/DemoProvider')
  const { CashierPage } = await import('../src/features/cashier/CashierPage')
  const db = new ZannaDatabase(`ui-test-${crypto.randomUUID()}`)
  const repository = new DexieProductRepository(db)
  await repository.initialize()
  const category = await repository.saveCategory('Uji')
  const snapshot = await repository.getSnapshot()
  await repository.saveProduct({ name: 'Produk Uji', categoryId: category.id, baseUnitId: snapshot.units[0].id, costPrice: null, costKnown: false, minimumStock: null, isActive: true, variants: [{ name: 'Standar', sellingUnitId: snapshot.units[0].id, quantityInBaseUnit: 1000, sellingPrice: 15000, saleMode: 'fixed', isActive: true }] })
  const root = createRoot(browser.document.getElementById('root')!)
  const wait = async (condition: () => boolean) => {
    for (let attempt = 0; attempt < 60; attempt++) {
      if (condition()) return
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
    }
    assert.fail('DOM tidak mencapai state yang diharapkan')
  }
  try {
    await act(async () => { root.render(<MemoryRouter initialEntries={['/kasir']}><DemoProvider repository={repository}><main id="operasional" tabIndex={-1}><CashierPage /></main></DemoProvider></MemoryRouter>) })
    await wait(() => !!browser.document.querySelector('[aria-label="Tambah Produk Uji"]'))
    assert.equal(browser.document.querySelector('.cart-launcher'), null)
    assert.equal(Array.from(browser.document.querySelectorAll<HTMLButtonElement>('.cart-panel button')).find((button) => button.textContent?.startsWith('Bayar '))?.disabled, true)
    await act(async () => { browser.document.querySelector<HTMLButtonElement>('.product-add')!.click() })
    assert.match(browser.document.querySelector('.cart-panel')!.textContent!, /1 item/)
    for (const viewport of [{ w: 768, h: 1024 }, { w: 390, h: 844 }]) {
      await act(async () => { width = viewport.w; Object.defineProperty(browser, 'innerHeight', { value: viewport.h, configurable: true }); media.dispatchEvent(new browser.Event('change')) })
      const launcher = browser.document.querySelector<HTMLButtonElement>('.cart-launcher button')!
      assert.ok(launcher)
      assert.match(launcher.textContent!, /Keranjang & Bayar \(1\)/)
      assert.match(launcher.textContent!.replace(/\s/g, ''), /Rp15\.000/)
      launcher.focus()
      await act(async () => { launcher.click() })
      const dialog = browser.document.querySelector('dialog')!
      assert.ok(dialog.hasAttribute('open'))
      assert.equal(browser.document.querySelectorAll('.cart-panel').length, 1)
      assert.match(dialog.textContent!, /Produk Uji/)
      await act(async () => { dialog.querySelector<HTMLButtonElement>('[aria-label="Tambah Produk Uji"]')!.click() })
      assert.match(launcher.textContent!, /Keranjang & Bayar \(2\)/)
      assert.match(launcher.textContent!.replace(/\s/g, ''), /Rp30\.000/)
      await act(async () => { dialog.querySelector<HTMLButtonElement>('[aria-label="Kurangi Produk Uji"]')!.click() })
      await act(async () => { dialog.dispatchEvent(new browser.Event('cancel', { cancelable: true })) })
      assert.equal(browser.document.querySelector('dialog'), null)
      assert.equal(browser.document.activeElement, launcher)

      // Akses atas katalog juga membuka keranjang yang sama hingga modal pembayaran.
      const headerCart = browser.document.querySelector<HTMLButtonElement>('[aria-label="Buka keranjang dan pembayaran"]')!
      assert.ok(headerCart)
      await act(async () => { headerCart.focus(); headerCart.click() })
      const cartDialog = browser.document.querySelector('dialog')!
      const payButton = Array.from(cartDialog.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.startsWith('Bayar '))!
      assert.ok(payButton)
      assert.equal(payButton.disabled, false)
      await act(async () => { payButton.click() })
      const paymentDialog = browser.document.querySelector('dialog')!
      assert.match(paymentDialog.textContent!, /Pembayaran Tunai/)
      assert.ok(paymentDialog.querySelector('input#cash'))
      assert.match(paymentDialog.textContent!.replace(/\s/g, ''), /Rp15\.000/)
      await act(async () => { paymentDialog.querySelector<HTMLButtonElement>('[aria-label="Tutup dialog"]')!.click() })
      assert.equal(browser.document.querySelector('dialog'), null)
      assert.match(launcher.textContent!, /Keranjang & Bayar \(1\)/)
    }
    for (const viewport of [1024, 1366]) {
      await act(async () => { width = viewport; media.dispatchEvent(new browser.Event('change')) })
      assert.equal(browser.document.querySelector('.cart-launcher'), null)
      assert.equal(browser.document.querySelectorAll('.cart-panel').length, 1)
      assert.match(browser.document.querySelector('.cart-panel')!.textContent!, /1 item/)
    }
    const product = (await repository.getSnapshot()).products[0]
    const current = await repository.getSnapshot()
    await act(async () => { await repository.saveProduct({ ...product, expectedUpdatedAt: product.updatedAt, variants: [{ ...current.variants[0], sellingPrice: 20000 }] }) })
    await wait(() => browser.document.querySelector('.cart-panel')!.textContent!.replace(/\s/g, '').includes('Rp20.000'))
    const updated = (await repository.getSnapshot()).products[0]
    await act(async () => { await repository.setProductActive(updated.id, false, updated.updatedAt) })
    await wait(() => !browser.document.querySelector('.product-add'))
    assert.match(browser.document.querySelector('.cart-panel')!.textContent!, /nonaktif/)
  } finally {
    await act(async () => root.unmount())
    await db.delete()
    dom.window.close()
  }
})
