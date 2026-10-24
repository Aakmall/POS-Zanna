export interface SafetyLocks {
  request<T>(name: string, options: { mode: 'shared' | 'exclusive'; ifAvailable: true }, callback: (lock: unknown | null) => Promise<T>): Promise<T>
}
export interface SafetyState { reloadRequired: boolean; busy: boolean; message: string }
export class AppSafety {
  private readonly locks: () => SafetyLocks | undefined
  private readonly listeners = new Set<() => void>()
  private state: SafetyState = { reloadRequired: false, busy: false, message: '' }
  private releaseTab?: () => void
  private tabJob?: Promise<void>
  private ready?: Promise<void>
  private clientProbe?: () => Promise<number>
  constructor(locks: () => SafetyLocks | undefined) { this.locks = locks }
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private change(value: Partial<SafetyState>) { this.state = { ...this.state, ...value }; for (const listener of this.listeners) listener() }
  setClientProbe(probe: () => Promise<number>) { this.clientProbe = probe }
  canMaintain() { return !!this.locks() && !!this.clientProbe }
  async start(): Promise<void> {
    if (this.ready) return this.ready
    const locks = this.locks()
    if (!locks) return
    this.ready = new Promise<void>((resolve) => {
      this.tabJob = locks.request('pos-zanna.app-tabs.v1', { mode: 'shared', ifAvailable: true }, async (lock) => {
        if (!lock) { this.change({ reloadRequired: true, message: 'Aplikasi dibuka saat pemulihan atau pembaruan berlangsung. Muat ulang sebelum melanjutkan.' }); resolve(); return }
        await new Promise<void>((release) => { this.releaseTab = release; resolve() })
      }).catch(() => { this.change({ reloadRequired: true, message: 'Perlindungan antar-tab tidak tersedia. Tutup lalu buka kembali aplikasi.' }); resolve() })
    })
    return this.ready
  }
  stop() { this.releaseTab?.(); this.releaseTab = undefined }
  async write<T>(operation: () => Promise<T>): Promise<T> {
    await this.start()
    if (this.state.reloadRequired || this.state.busy) throw new Error('Selesaikan pemulihan/pembaruan dan muat ulang aplikasi sebelum menyimpan data.')
    const locks = this.locks()
    if (!locks) return operation() // Normal local operations remain available; restore is disabled.
    return locks.request('pos-zanna.business-writes.v1', { mode: 'shared', ifAvailable: true }, async (lock) => {
      if (!lock || this.state.reloadRequired || this.state.busy) throw new Error('Pemulihan/pembaruan sedang berlangsung. Data belum disimpan; muat ulang setelah selesai.')
      return operation()
    })
  }
  async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.canMaintain()) throw new Error('Pemulihan/pembaruan aman memerlukan aplikasi build pada HTTPS atau localhost, browser dengan perlindungan antar-tab, dan aset offline yang sudah siap.')
    await this.start()
    if (this.state.reloadRequired || this.state.busy) throw new Error('Aplikasi perlu dimuat ulang atau masih memproses pekerjaan lain.')
    this.change({ busy: true }); this.stop(); await this.tabJob
    try {
      return await this.locks()!.request('pos-zanna.app-tabs.v1', { mode: 'exclusive', ifAvailable: true }, async (tabLock) => {
        if (!tabLock) throw new Error('Tutup semua tab/jendela POS-Zanna lainnya, lalu periksa ulang cadangan atau pembaruan.')
        if (await this.clientProbe!() !== 1) throw new Error('Masih ada tab/jendela aplikasi lain, termasuk versi lama. Tutup semuanya selain jendela ini.')
        return this.locks()!.request('pos-zanna.business-writes.v1', { mode: 'exclusive', ifAvailable: true }, async (lock) => {
          if (!lock) throw new Error('Masih ada penyimpanan transaksi aktif. Tunggu hingga selesai lalu periksa ulang.')
          return operation()
        })
      })
    } finally {
      this.change({ busy: false }); this.ready = undefined
      if (!this.state.reloadRequired) await this.start()
    }
  }
  restored() { this.change({ reloadRequired: true, message: 'Data berhasil dipulihkan dan diperiksa. Muat ulang aplikasi untuk memakai data hasil pemulihan.' }) }
  updateReady() { this.change({ reloadRequired: true, message: 'Pembaruan disetujui. Muat ulang untuk menggunakan versi aplikasi baru.' }) }
}
export const appSafety = new AppSafety(() => typeof navigator !== 'undefined' ? navigator.locks : undefined)
