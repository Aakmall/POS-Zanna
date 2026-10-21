import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { ZannaDatabase } from '../src/data/database'
import { DexieProductRepository } from '../src/data/dexieProductRepository'
import { DexieInventoryRepository } from '../src/data/dexieInventoryRepository'
import { InventoryService } from '../src/services/inventoryOperations'

test('DOM Stok dan hardening: mutasi, form review legacy, arsip varian, pilihan kemasan BBM', { timeout: 15000 }, async () => {
  const dom = new JSDOM('<!doctype html><body><div id="root"></div></body>', { url: 'http://localhost/' })
  const browser = dom.window
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLDialogElement', 'Event', 'MouseEvent'] as const) Object.defineProperty(globalThis, key, { value: key === 'window' ? browser : browser[key], configurable: true })
  Object.defineProperty(globalThis, 'navigator', { value: browser.navigator, configurable: true })
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  browser.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); this.querySelector<HTMLButtonElement>('button')?.focus() }
  browser.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  const React = await import('react'), { act } = React
  const { createRoot } = await import('react-dom/client')
  const { MemoryRouter } = await import('react-router')
  const { DemoProvider } = await import('../src/app/DemoProvider')
  const { StockPage } = await import('../src/features/stock/StockPage')
  const { ProductForm } = await import('../src/features/products/ProductForm')
  const db = new ZannaDatabase(`stock-ui-test-${crypto.randomUUID()}`)
  const repository = new DexieProductRepository(db), inventory = new InventoryService(new DexieInventoryRepository(db))
  await repository.initialize()
  const category = await repository.saveCategory('Makanan')
  const snapshot = await repository.getSnapshot(), unit = snapshot.units.find((item) => item.code === 'bungkus')!
  const product = await repository.saveProduct({ name: 'Mi uji', categoryId: category.id, baseUnitId: unit.id, unitPolicy: { kind: 'general', allowedPackagingUnitIds: [] }, costPrice: null, costKnown: false, minimumStock: 5000, isActive: true, variants: [{ name: 'Standar', sellingUnitId: unit.id, quantityInBaseUnit: 1000, sellingPrice: 3500, saleMode: 'fixed', isActive: true }] })
  const root = createRoot(browser.document.getElementById('root')!)
  const wait = async (condition: () => boolean) => {
    for (let count = 0; count < 80; count++) { if (condition()) return; await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) }) }
    assert.fail('State halaman Stok tidak tercapai')
  }
  const button = (label: string) => browser.document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
  const inputQuantity = (value: string) => {
    const input = browser.document.querySelector<HTMLInputElement>('dialog input')!
    Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new browser.Event('input', { bubbles: true }))
  }
  const submit = () => browser.document.querySelector('dialog form')!.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true }))
  try {
    await act(async () => root.render(<MemoryRouter><DemoProvider repository={repository} inventory={inventory}><main id="operasional" tabIndex={-1}><StockPage /></main></DemoProvider></MemoryRouter>))
    await wait(() => !!button('Atur stok awal Mi uji'))
    await act(async () => button('Atur stok awal Mi uji').click())
    await act(async () => inputQuantity('30'))
    await act(async () => { submit() })
    await wait(() => !browser.document.querySelector('dialog'))
    assert.equal((await inventory.getBalances())[0].quantityBase, 30000)
    await wait(() => !!button('Tambah stok Mi uji'))
    await act(async () => button('Tambah stok Mi uji').click())
    await act(async () => inputQuantity('10'))
    await act(async () => { submit(); submit() })
    await wait(() => !browser.document.querySelector('dialog'))
    assert.equal((await inventory.getBalances())[0].quantityBase, 40000)
    assert.equal((await inventory.getHistory(product.id)).length, 2)
    await act(async () => button('Koreksi stok Mi uji').click())
    await act(async () => {
      inputQuantity('2')
      const textarea = browser.document.querySelector<HTMLTextAreaElement>('dialog textarea')!
      Object.getOwnPropertyDescriptor(browser.HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Barang rusak')
      textarea.dispatchEvent(new browser.Event('input', { bubbles: true }))
    })
    await act(async () => { submit() })
    assert.equal((await inventory.getBalances())[0].quantityBase, 40000)
    const confirm = Array.from(browser.document.querySelectorAll<HTMLButtonElement>('dialog button')).find((item) => item.textContent === 'Ya, kurangi stok')!
    assert.ok(confirm)
    await act(async () => confirm.click())
    await wait(() => !browser.document.querySelector('dialog'))
    assert.equal((await inventory.getBalances())[0].quantityBase, 38000)
    assert.equal((await inventory.getHistory(product.id)).length, 3)
    await act(async () => button('Lihat riwayat Mi uji').click())
    await wait(() => !!browser.document.querySelector('dialog ol'))
    assert.match(browser.document.querySelector('dialog')!.textContent!, /Barang rusak/)
    assert.match(browser.document.querySelector('dialog')!.textContent!, /Stok awal/)
    await act(async () => browser.document.querySelector<HTMLButtonElement>('dialog button[aria-label="Tutup dialog"]')!.click())
    await act(async () => button('Koreksi stok Mi uji').click())
    await act(async () => {
      inputQuantity('50')
      const textarea = browser.document.querySelector<HTMLTextAreaElement>('dialog textarea')!
      Object.getOwnPropertyDescriptor(browser.HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Terlalu banyak')
      textarea.dispatchEvent(new browser.Event('input', { bubbles: true }))
    })
    await act(async () => { submit() })
    assert.match(browser.document.querySelector('dialog [role="alert"]')!.textContent!, /melebihi saldo/)
    assert.equal((await inventory.getBalances())[0].quantityBase, 38000)
    assert.equal((await inventory.getHistory(product.id)).length, 3)
    await act(async () => browser.document.querySelector<HTMLButtonElement>('dialog button[aria-label="Tutup dialog"]')!.click())

    // Reproduce a legacy master in this isolated TEST database; production does not rewrite it.
    const units = snapshot.units, unitId = (code: string) => units.find((item) => item.code === code)!.id
    let solar: typeof product | undefined
    await act(async () => {
      solar = await repository.saveProduct({ ...product, id: undefined, name: 'Solar legacy', baseUnitId: unitId('l'), unitPolicy: { kind: 'fuel', allowedPackagingUnitIds: [unitId('jeriken')] }, variants: [{ name: 'Liter', sellingUnitId: unitId('l'), quantityInBaseUnit: 1000, sellingPrice: 13000, saleMode: 'fixed', isActive: true }] })
      delete solar.unitPolicy
      await db.products.put(solar)
      await db.variants.add({ ...(await repository.getSnapshot()).variants.find((item) => item.productId === solar!.id)!, id: crypto.randomUUID(), name: 'Sachet lama', sellingUnitId: unitId('sachet'), quantityInBaseUnit: 12000 })
    })
    await wait(() => !!button('Atur stok awal Solar legacy'))
    await wait(() => browser.document.body.textContent!.includes('Sachet lama:'))
    let savedName = ''
    await act(async () => root.render(<MemoryRouter><DemoProvider repository={repository} inventory={inventory}><main id="operasional" tabIndex={-1}><ProductForm product={solar!} onClose={() => {}} onSaved={(name) => { savedName = name }} /></main></DemoProvider></MemoryRouter>))
    const policySelect = Array.from(browser.document.querySelectorAll<HTMLSelectElement>('dialog select')).find((select) => select.closest('label')?.textContent?.includes('Jenis persediaan'))!
    await act(async () => { policySelect.value = 'fuel'; policySelect.dispatchEvent(new browser.Event('change', { bubbles: true })) })
    const labelInput = (text: string) => Array.from(browser.document.querySelectorAll<HTMLLabelElement>('dialog label')).find((label) => label.querySelector('input[type="checkbox"]') && label.textContent?.includes(text))!.querySelector<HTMLInputElement>('input')!
    assert.equal(browser.document.querySelector('dialog')!.textContent!.includes('Sachet · perlu review'), true)
    await act(async () => { labelInput('Jeriken').click(); labelInput('Saya telah meninjau').click() })
    await act(async () => { submit() })
    assert.equal(savedName, '')
    assert.match(browser.document.querySelector('dialog [role="alert"]')!.textContent!, /Sachet tidak diizinkan/)
    const oldVariant = Array.from(browser.document.querySelectorAll<HTMLFieldSetElement>('dialog fieldset')).find((fieldset) => fieldset.querySelector('legend')?.textContent === 'Sachet lama')!
    assert.equal(oldVariant.querySelector<HTMLOptionElement>('option[disabled]')!.textContent?.includes('Sachet'), true)
    await act(async () => oldVariant.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
    await act(async () => { submit(); await new Promise((resolve) => setTimeout(resolve, 30)) })
    await wait(() => savedName === 'Solar legacy')
    const reviewed = (await repository.getSnapshot()).products.find((item) => item.id === solar!.id)!
    assert.deepEqual(reviewed.unitPolicy, { kind: 'fuel', allowedPackagingUnitIds: [unitId('jeriken')] })
    assert.equal((await inventory.getBalances()).length, 1)

    await act(async () => root.render(<MemoryRouter><DemoProvider repository={repository} inventory={inventory}><main id="operasional" tabIndex={-1}><StockPage /></main></DemoProvider></MemoryRouter>))
    await wait(() => !!button('Atur stok awal Solar legacy'))
    await act(async () => button('Atur stok awal Solar legacy').click())
    const inputUnits = browser.document.querySelector<HTMLSelectElement>('dialog select')!
    const optionText = Array.from(inputUnits.options).map((option) => option.textContent).join('|')
    assert.match(optionText, /Liter/); assert.match(optionText, /Mililiter/); assert.match(optionText, /Jeriken/)
    assert.doesNotMatch(optionText, /Sachet|Bungkus|Botol|Dus/)
    await act(async () => { inputUnits.value = `custom:${unitId('jeriken')}`; inputUnits.dispatchEvent(new browser.Event('change', { bubbles: true })) })
    const customInput = browser.document.querySelector<HTMLInputElement>('dialog input[placeholder="Contoh: 18,5"]')!
    assert.ok(customInput)
    assert.equal(customInput.value, '') // Capacity is required and never guessed.
    assert.equal(customInput.required, true)
  } finally { await act(async () => root.unmount()); await db.delete(); dom.window.close() }
})
