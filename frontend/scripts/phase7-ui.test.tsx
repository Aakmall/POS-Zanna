import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { JSDOM } from 'jsdom'
import { creditFixture, businessSnapshot } from './credit-fixtures'
import { BackupService } from '../src/services/backupOperations'
import { DexieBackupRepository } from '../src/data/dexieBackupRepository'
import { AppSafety } from '../src/services/appSafety'
import { canonical } from '../src/domain/backupFormat'
import { localDatabase } from '../src/data/localDatabase'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://pos.test/' }), browser = dom.window
for (const key of ['window', 'document', 'HTMLElement', 'HTMLDialogElement', 'Event', 'MouseEvent'] as const) Object.defineProperty(globalThis, key, { value: key === 'window' ? browser : browser[key], configurable: true })
Object.defineProperty(globalThis, 'navigator', { value: browser.navigator, configurable: true })
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
browser.HTMLAnchorElement.prototype.click = function () {}
const urls = { create: URL.createObjectURL, revoke: URL.revokeObjectURL }, downloads: Blob[] = []
URL.createObjectURL = (blob) => { if (blob instanceof Blob) downloads.push(blob); return 'blob:backup-test' }; URL.revokeObjectURL = () => {}
const { act } = await import('react'), { createRoot } = await import('react-dom/client'), { MemoryRouter } = await import('react-router')
const { BackupPanel } = await import('../src/features/settings/BackupPanel'), { PwaStatus } = await import('../src/pwa/PwaStatus')
const { PwaRuntime, pwaRuntime } = await import('../src/pwa/pwaRuntime')
after(() => { localDatabase.close(); URL.createObjectURL = urls.create; URL.revokeObjectURL = urls.revoke; browser.close() })
const text = () => browser.document.body.textContent ?? ''
const button = (label: string) => [...browser.document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === label)!
async function wait(predicate: () => boolean) { for (let i = 0; i < 150; i++) { if (predicate()) return; await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)) }) }; assert.fail(text()) }
async function mount(node: Parameters<ReturnType<typeof createRoot>['render']>[0]) {
  const container = browser.document.createElement('div'); browser.document.body.append(container); const root = createRoot(container)
  await act(async () => root.render(<MemoryRouter>{node}</MemoryRouter>))
  return { async close() { await act(async () => root.unmount()); container.remove() } }
}
function safety() { const value = new AppSafety(() => ({ async request(_name, _options, callback) { return callback({}) } })); value.setClientProbe(async () => 1); return value }
function backup(db: Awaited<ReturnType<typeof creditFixture>>['db'], restored = () => {}) { return new BackupService(new DexieBackupRepository(db), { exclusive: (fn) => fn(), checkRecovery() {}, restored }) }
async function file(text: string) { const input = browser.document.querySelector<HTMLInputElement>('input[type="file"]')!; Object.defineProperty(input, 'files', { configurable: true, value: [{ name: 'test.json', size: text.length, text: async () => text }] }); await act(async () => input.dispatchEvent(new browser.Event('change', { bubbles: true }))) }
async function approve() {
  await act(async () => browser.document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
  const input = browser.document.querySelector<HTMLInputElement>('input[autocomplete="off"]')!
  await act(async () => { Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value')!.set!.call(input, 'PULIHKAN DATA'); input.dispatchEvent(new browser.Event('input', { bubbles: true })) })
}
test('DOM backup/restore: unduhan terverifikasi, preview read-only, ketik konfirmasi dan double-submit', async () => {
  const source = await creditFixture(), target = await creditFixture(), exported = await backup(source.db).create()
  let restored = 0
  const service = backup(target.db, () => { restored++ }), ui = await mount(<BackupPanel hasCart={false} service={service} safety={safety()} />)
  try {
    const before = await businessSnapshot(target.db)
    await act(async () => button('Cadangkan Data').click()); await wait(() => text().includes('File cadangan telah dibuat'))
    assert.match(await downloads.at(-1)!.text(), /POS_ZANNA_BACKUP/)
    await file(exported.text); await wait(() => text().includes('Semua relasi dan keutuhan'))
    assert.deepEqual(await businessSnapshot(target.db), before); assert.equal(button('Konfirmasi Pemulihan').disabled, true)
    await approve(); assert.equal(button('Konfirmasi Pemulihan').disabled, false)
    await act(async () => { button('Konfirmasi Pemulihan').click(); button('Konfirmasi Pemulihan').click() }); await wait(() => restored === 1)
    assert.equal(canonical(await businessSnapshot(target.db)), canonical(exported.file.data))
  } finally { await ui.close(); await source.db.delete(); await target.db.delete() }
})
test('DOM file rusak tidak mengubah data atau membuka tombol konfirmasi', async () => {
  const f = await creditFixture(), ui = await mount(<BackupPanel hasCart={false} service={backup(f.db)} safety={safety()} />)
  try { const before = await businessSnapshot(f.db); await file('broken json'); await wait(() => !!browser.document.querySelector('[role="alert"]')); assert.equal(button('Konfirmasi Pemulihan'), undefined); assert.deepEqual(await businessSnapshot(f.db), before) }
  finally { await ui.close(); await f.db.delete() }
})
test('DOM keranjang belum kosong memblokir pemulihan walaupun preview dan konfirmasi valid', async () => {
  const f = await creditFixture(), service = backup(f.db), exported = await service.create(), ui = await mount(<BackupPanel hasCart service={service} safety={safety()} />)
  try { const before = await businessSnapshot(f.db); await file(exported.text); await wait(() => text().includes('Semua relasi dan keutuhan')); await approve(); assert.equal(button('Konfirmasi Pemulihan').disabled, true); assert.match(text(), /Keranjang harus kosong/); assert.deepEqual(await businessSnapshot(f.db), before) }
  finally { await ui.close(); await f.db.delete() }
})
test('PWA runtime mendaftarkan sw produksi, memeriksa kesiapan, prompt instalasi dan update eksplisit', async () => {
  const runtime = new PwaRuntime(), active = new browser.EventTarget(), waiting = new browser.EventTarget()
  Object.assign(waiting, { state: 'installed' })
  const reply = (data: { type: string }, ports: readonly MessagePort[]) => {
    ports[0].postMessage(data.type === 'APP_STATUS' ? { ready: true, count: 1, version: 'build' } : { accepted: true }); ports[0].close()
    if (data.type === 'ACTIVATE_UPDATE') queueMicrotask(() => { Object.assign(waiting, { state: 'activated' }); waiting.dispatchEvent(new browser.Event('statechange')) })
  }
  Object.assign(active, { postMessage: reply }); Object.assign(waiting, { postMessage: reply })
  const registration = Object.assign(new browser.EventTarget(), { active, waiting, installing: null, async update() {} })
  let registrations = 0, probe: (() => Promise<number>) | undefined
  const container = { async register(path: string, options: RegistrationOptions) { assert.equal(path, '/sw.js'); assert.equal(options.updateViaCache, 'none'); registrations++; return registration }, ready: Promise.resolve(registration) } as unknown as ServiceWorkerContainer
  await runtime.start(true, true, container, (value) => { probe = value })
  assert.equal(registrations, 1); assert.equal(runtime.getSnapshot().ready, true); assert.equal(runtime.getSnapshot().updateAvailable, true); assert.equal(await probe!(), 1)
  let prompts = 0; const event = new browser.Event('beforeinstallprompt', { cancelable: true })
  Object.assign(event, { async prompt() { prompts++ }, userChoice: Promise.resolve({ outcome: 'dismissed' }) }); browser.dispatchEvent(event)
  assert.equal(event.defaultPrevented, true); await runtime.install(); assert.equal(prompts, 1); assert.equal(runtime.getSnapshot().canInstall, false)
  let accepted = 0; await runtime.activateUpdate(() => { accepted++ }); assert.equal(accepted, 1); assert.equal(runtime.getSnapshot().updateAvailable, false)
})
test('PWA dev/insecure tidak register SW; indikator offline tidak mengklaim cadangan/sinkronisasi', async () => {
  const runtime = new PwaRuntime()
  await runtime.start(false, false, undefined, () => assert.fail())
  assert.equal(runtime.getSnapshot().ready, false); assert.equal(runtime.getSnapshot().canInstall, false)
  await pwaRuntime.start(false, false, undefined, () => assert.fail())
  const ui = await mount(<PwaStatus />)
  try {
    await act(async () => { Object.defineProperty(browser.navigator, 'onLine', { configurable: true, value: false }); browser.dispatchEvent(new browser.Event('offline')) })
    assert.match(text(), /Aplikasi sedang offline/); assert.match(text(), /bukan tanda cadangan/); assert.doesNotMatch(text(), /Data sudah tersinkronisasi/)
  } finally { await ui.close() }
})
