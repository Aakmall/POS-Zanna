import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { ZannaDatabase } from '../src/data/database'
import { DexieProductRepository } from '../src/data/dexieProductRepository'
import { DexieInventoryRepository } from '../src/data/dexieInventoryRepository'
import { InventoryService } from '../src/services/inventoryOperations'

test('DOM form produk: edit lama tidak menulis diam-diam, peringatan nonblocking, kemasan eksplisit dan langsung otomatis', { timeout: 20000 }, async () => {
  const dom = new JSDOM('<!doctype html><body><div id="root"></div></body>', { url: 'http://localhost/' }), browser = dom.window
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLDialogElement', 'Event', 'MouseEvent'] as const) Object.defineProperty(globalThis, key, { value: key === 'window' ? browser : browser[key], configurable: true })
  Object.defineProperty(globalThis, 'navigator', { value: browser.navigator, configurable: true })
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  browser.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  browser.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  const { act } = await import('react'), { createRoot } = await import('react-dom/client')
  const { DemoProvider } = await import('../src/app/DemoProvider')
  const { useDemoStore } = await import('../src/hooks/useDemoStore')
  const { ProductForm } = await import('../src/features/products/ProductForm')
  const db = new ZannaDatabase(`product-units-ui-${crypto.randomUUID()}`)
  const repository = new DexieProductRepository(db), inventory = new InventoryService(new DexieInventoryRepository(db))
  await repository.initialize()
  const category = await repository.saveCategory('BBM')
  const units = (await repository.getSnapshot()).units, unit = (code: string) => units.find((entry) => entry.code === code)!
  const product = await repository.saveProduct({ name: 'Bensin lama', categoryId: category.id, baseUnitId: unit('l').id, unitPolicy: { kind: 'fuel', allowedPackagingUnitIds: [unit('botol').id, unit('jeriken').id] }, costPrice: null, costKnown: false, minimumStock: 5000, isActive: true, variants: [
    { name: 'Bensin 1,5 liter', sellingUnitId: unit('l').id, quantityInBaseUnit: 1000, sellingPrice: 10000, saleMode: 'variable', isActive: true },
    { name: 'Botol tersimpan', sellingUnitId: unit('botol').id, quantityInBaseUnit: 1500, sellingPrice: 15000, saleMode: 'fixed', isActive: true },
    { name: 'Mililiter tersimpan', sellingUnitId: unit('ml').id, quantityInBaseUnit: 1, sellingPrice: 10, saleMode: 'variable', isActive: true },
  ] })
  const root = createRoot(browser.document.getElementById('root')!)
  let savedName = '', closed = false, generation = 0
  function ReadyForm({ productId }: { productId: string | null }) {
    const store = useDemoStore()
    if (store.status !== 'ready') return null
    return <ProductForm product={store.snapshot.products.find((entry) => entry.id === productId) ?? null} onClose={() => { closed = true }} onSaved={(name) => { savedName = name }} />
  }
  const wait = async (condition: () => boolean) => {
    for (let count = 0; count < 100; count++) { if (condition()) return; await act(async () => { await new Promise((resolve) => setTimeout(resolve, 15)) }) }
    assert.fail(`Form tidak mencapai state yang diharapkan: ${browser.document.body.textContent}`)
  }
  const mount = async (productId: string | null) => {
    savedName = ''; closed = false
    await act(async () => root.render(<DemoProvider key={++generation} repository={repository} inventory={inventory}><ReadyForm productId={productId} /></DemoProvider>))
    await wait(() => !!browser.document.querySelector('dialog form'))
  }
  const fieldset = (name: string) => Array.from(browser.document.querySelectorAll('dialog fieldset')).find((element) => element.querySelector('legend')?.textContent === name)!
  const field = <T extends HTMLInputElement | HTMLSelectElement>(scope: ParentNode, text: string) => Array.from(scope.querySelectorAll('label')).find((label) => label.querySelector('input,select') && label.textContent!.startsWith(text))!.querySelector<T>('input,select')!
  const input = (element: HTMLInputElement, value: string) => {
    Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value')!.set!.call(element, value)
    element.dispatchEvent(new browser.Event('input', { bubbles: true }))
  }
  const select = (element: HTMLSelectElement, value: string) => { element.value = value; element.dispatchEvent(new browser.Event('change', { bubbles: true })) }
  const submit = () => browser.document.querySelector('dialog form')!.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true }))
  const allData = async () => Object.fromEntries(await Promise.all(db.tables.map(async (table) => [table.name, await table.toArray()])))
  try {
    const before = await allData(), beforeVariants = await db.variants.toArray()
    await mount(product.id)
    assert.match(browser.document.querySelector('dialog [role="status"]')!.textContent!, /pengaturan saat ini 1 Liter/)
    assert.equal(fieldset('Bensin 1,5 liter').textContent!.includes('Isi per kemasan'), false)
    assert.equal(field<HTMLSelectElement>(fieldset('Bensin 1,5 liter'), 'Mode jumlah').value, 'variable')
    assert.equal(field<HTMLInputElement>(fieldset('Botol tersimpan'), 'Isi per kemasan').value, '1.5')
    assert.equal(field<HTMLSelectElement>(fieldset('Mililiter tersimpan'), 'Cara menjual').value, 'metric')
    assert.match(fieldset('Mililiter tersimpan').textContent!, /0,001 Liter/)
    assert.deepEqual(await allData(), before) // Mount and advisory rendering perform no writes.
    await act(async () => browser.document.querySelector<HTMLButtonElement>('dialog button[aria-label="Tutup dialog"]')!.click())
    assert.equal(closed, true); assert.deepEqual(await allData(), before)

    await mount(product.id)
    await act(async () => input(field<HTMLInputElement>(browser.document, 'Nama produk'), 'Bensin diperbarui'))
    await act(async () => { submit() })
    await wait(() => savedName === 'Bensin diperbarui') // Size warning cannot block a legitimate direct-volume variant.
    const nonTimestamp = (entry: typeof beforeVariants[number]) => ({ ...entry, updatedAt: '' })
    assert.deepEqual((await db.variants.toArray()).map(nonTimestamp), beforeVariants.map(nonTimestamp))
    assert.deepEqual(await db.units.toArray(), before.units)
    for (const table of ['inventoryBalances', 'stockMovements', 'sales', 'saleItems', 'checkoutIntents']) assert.deepEqual((await allData())[table], before[table])

    await mount(product.id)
    await act(async () => select(field<HTMLSelectElement>(fieldset('Bensin 1,5 liter'), 'Cara menjual'), 'packaging'))
    assert.equal(field<HTMLInputElement>(fieldset('Bensin 1,5 liter'), 'Isi per kemasan').value, '')
    await act(async () => select(field<HTMLSelectElement>(fieldset('Bensin 1,5 liter'), 'Jenis kemasan'), unit('botol').id))
    const contents = field<HTMLInputElement>(fieldset('Bensin 1,5 liter'), 'Isi per kemasan')
    assert.equal(contents.value, ''); assert.equal(contents.required, true)
    const mode = field<HTMLSelectElement>(fieldset('Bensin 1,5 liter'), 'Mode jumlah')
    assert.equal(mode.value, 'fixed'); assert.equal(mode.querySelector<HTMLOptionElement>('option[value="variable"]')!.disabled, true)
    await act(async () => input(contents, '1,5'))
    assert.match(fieldset('Bensin 1,5 liter').textContent!, /1 Botol berisi 1,5 Liter/)
    assert.match(fieldset('Bensin 1,5 liter').textContent!, /Menjual 2 Botol mengurangi stok 3 Liter/)
    assert.equal(fieldset('Bensin 1,5 liter').querySelector('[role="status"]'), null)
    await act(async () => { submit() }); await wait(() => savedName === 'Bensin diperbarui')
    const changed = (await db.variants.toArray()).find((entry) => entry.name === 'Bensin 1,5 liter')!
    assert.equal(changed.sellingUnitId, unit('botol').id); assert.equal(changed.quantityInBaseUnit, 1500); assert.equal(changed.saleMode, 'fixed')
    assert.equal('unitEntry' in changed, false) // Presentation state never enters IndexedDB.
    assert.equal(await db.units.count(), 10)

    await mount(null)
    await act(async () => input(field<HTMLInputElement>(browser.document, 'Nama produk'), 'Solar langsung'))
    await act(async () => select(field<HTMLSelectElement>(browser.document, 'Satuan stok dasar'), unit('l').id))
    await act(async () => select(field<HTMLSelectElement>(browser.document, 'Jenis persediaan'), 'fuel'))
    await act(async () => select(field<HTMLSelectElement>(fieldset('Standar'), 'Mode jumlah'), 'variable'))
    assert.equal(fieldset('Standar').textContent!.includes('Isi per kemasan'), false)
    await act(async () => { submit() }); await wait(() => savedName === 'Solar langsung')
    const solar = (await db.products.toArray()).find((entry) => entry.name === 'Solar langsung')!
    const solarVariant = (await db.variants.toArray()).find((entry) => entry.productId === solar.id)!
    assert.equal(solarVariant.sellingUnitId, unit('l').id); assert.equal(solarVariant.quantityInBaseUnit, 1000); assert.equal(solarVariant.saleMode, 'variable')
    assert.deepEqual(solar.unitPolicy?.allowedPackagingUnitIds, [])

    // An already-invalid same-unit legacy factor stays visible until an explicit correction.
    await db.variants.update(solarVariant.id, { quantityInBaseUnit: 1500 })
    const oldInvalid = await allData()
    await mount(solar.id)
    assert.equal(field<HTMLSelectElement>(fieldset('Standar'), 'Cara menjual').value, 'legacy')
    assert.equal(field<HTMLInputElement>(fieldset('Standar'), 'Isi tersimpan').value, '1.5')
    assert.deepEqual(await allData(), oldInvalid)
    await act(async () => select(field<HTMLSelectElement>(fieldset('Standar'), 'Cara menjual'), 'direct'))
    assert.deepEqual(await allData(), oldInvalid) // Even explicit draft edits wait for Save.
    await act(async () => { submit() }); await wait(() => savedName === 'Solar langsung')
    assert.equal((await db.variants.get(solarVariant.id))!.quantityInBaseUnit, 1000)
    assert.equal(db.verno, 4)
  } finally { await act(async () => root.unmount()); await db.delete(); dom.window.close() }
})
