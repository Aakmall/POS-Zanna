import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AppSafety, type SafetyLocks } from '../src/services/appSafety'

class TestLocks implements SafetyLocks {
  private held = new Map<string, Set<{ mode: 'shared' | 'exclusive' }>>()
  async request<T>(name: string, options: { mode: 'shared' | 'exclusive'; ifAvailable: true }, callback: (lock: unknown | null) => Promise<T>): Promise<T> {
    const held = this.held.get(name) ?? new Set<{ mode: 'shared' | 'exclusive' }>()
    if (held.size && (options.mode === 'exclusive' || [...held].some((l) => l.mode === 'exclusive'))) return callback(null)
    const token = { mode: options.mode }; held.add(token); this.held.set(name, held)
    try { return await callback({ name }) } finally { held.delete(token) }
  }
}
const create = (locks = new TestLocks(), count = 1) => { const safety = new AppSafety(() => locks); safety.setClientProbe(async () => count); return safety }
function deferred() { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done }); return { resolve, promise } }
test('browser tanpa Web Locks: operasi biasa tersedia, pemulihan ditolak fail-safe', async () => {
  const safety = new AppSafety(() => undefined)
  assert.equal(await safety.write(async () => 7), 7); assert.equal(safety.canMaintain(), false)
  await assert.rejects(safety.exclusive(async () => 1), /HTTPS|browser/)
})
test('dua tab aplikasi: restore/update ditolak, shared writes normal tetap dapat berjalan', async () => {
  const locks = new TestLocks(), first = create(locks), second = create(locks)
  try {
    await first.start(); await second.start()
    await assert.rejects(first.exclusive(async () => assert.fail('must not restore')), /tab\/jendela/)
    assert.equal(await first.write(async () => 1), 1); assert.equal(await second.write(async () => 2), 2)
  } finally { first.stop(); second.stop() }
})
test('probe service worker mendeteksi jendela versi lama yang belum memakai lock', async () => {
  const safety = create(new TestLocks(), 2)
  try { await safety.start(); await assert.rejects(safety.exclusive(async () => assert.fail()), /versi lama/) }
  finally { safety.stop() }
})
test('transaksi aktif memblokir maintenance; tidak menunggu lalu menimpa diam-diam', async () => {
  const safety = create(), started = deferred(), release = deferred()
  try {
    await safety.start()
    const write = safety.write(async () => { started.resolve(); await release.promise; return 1 }); await started.promise
    await assert.rejects(safety.exclusive(async () => assert.fail()), /transaksi aktif/)
    release.resolve(); await write
    assert.equal(await safety.exclusive(async () => 2), 2)
  } finally { release.resolve(); safety.stop() }
})
test('restore eksklusif menolak write/double action dan tab baru sampai reload', async () => {
  const locks = new TestLocks(), owner = create(locks), opened = create(locks)
  try {
    await owner.start()
    await owner.exclusive(async () => {
      await assert.rejects(owner.write(async () => 1), /muat ulang/)
      await assert.rejects(owner.exclusive(async () => 2), /masih memproses/)
      await opened.start(); assert.equal(opened.getSnapshot().reloadRequired, true)
      owner.restored()
    })
    await assert.rejects(owner.write(async () => 1), /muat ulang/)
    await assert.rejects(opened.write(async () => 1), /muat ulang/)
  } finally { owner.stop(); opened.stop() }
})
test('kegagalan restore tidak memblokir aplikasi selamanya dan listener mendapat status', async () => {
  const safety = create(), states: boolean[] = [], unsubscribe = safety.subscribe(() => states.push(safety.getSnapshot().busy))
  try {
    await assert.rejects(safety.exclusive(async () => { throw new Error('rollback') }), /rollback/)
    assert.equal(await safety.write(async () => 9), 9); assert.ok(states.includes(true)); assert.equal(safety.getSnapshot().busy, false)
  } finally { unsubscribe(); safety.stop() }
})
