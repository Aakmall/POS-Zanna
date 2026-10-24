import { ValidationError } from '../domain/errors'
export interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
export interface PwaState { online: boolean; ready: boolean; canInstall: boolean; installed: boolean; updateAvailable: boolean; busy: boolean; message: string }
export function workerMessage(worker: ServiceWorker, type: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel(), timer = window.setTimeout(() => { channel.port1.close(); reject(new ValidationError('Aplikasi offline belum siap diperiksa. Tunggu sebentar lalu coba lagi.')) }, 4000)
    channel.port1.onmessage = (event: MessageEvent<unknown>) => { window.clearTimeout(timer); channel.port1.close(); resolve(event.data) }
    worker.postMessage({ type }, [channel.port2])
  })
}
export function appStatus(value: unknown): value is { ready: boolean; count: number; version: string } {
  return !!value && typeof value === 'object' && 'ready' in value && typeof value.ready === 'boolean' && 'count' in value && Number.isSafeInteger(value.count) && 'version' in value && typeof value.version === 'string'
}
export class PwaRuntime {
  private readonly listeners = new Set<() => void>()
  private state: PwaState = { online: true, ready: false, canInstall: false, installed: false, updateAvailable: false, busy: false, message: '' }
  private registration?: ServiceWorkerRegistration
  private promptEvent?: InstallPrompt
  private started = false
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private change(value: Partial<PwaState>) { this.state = { ...this.state, ...value }; for (const listener of this.listeners) listener() }
  async start(enabled: boolean, secure: boolean, container: ServiceWorkerContainer | undefined, setProbe: (probe: () => Promise<number>) => void): Promise<void> {
    if (this.started) return
    this.started = true
    const network = () => this.change({ online: navigator.onLine })
    network(); window.addEventListener('online', network); window.addEventListener('offline', network)
    this.change({ installed: window.matchMedia?.('(display-mode: standalone)').matches ?? false })
    window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); this.promptEvent = event as InstallPrompt; this.change({ canInstall: true }) })
    window.addEventListener('appinstalled', () => { this.promptEvent = undefined; this.change({ installed: true, canInstall: false }) })
    if (!enabled || !secure || !container) { this.change({ message: 'Instalasi dan persiapan offline tersedia pada build aplikasi melalui HTTPS atau localhost. Jaringan LAN HTTP biasa belum mendukungnya.' }); return }
    try {
      const registration = await container.register('/sw.js', { scope: '/', updateViaCache: 'none' }); this.registration = registration
      const waiting = () => this.change({ updateAvailable: !!registration.waiting })
      waiting()
      registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', waiting))
      const ready = await container.ready
      const probe = async () => {
        try {
          const worker = ready.active ?? container.controller
          if (!worker) throw new ValidationError('Aset offline belum siap.')
          const status = await workerMessage(worker, 'APP_STATUS')
          if (!appStatus(status) || !status.ready) throw new ValidationError('Aset offline belum lengkap.')
          this.change({ ready: true, message: '' }); return status.count
        } catch {
          const message = 'Aset offline belum lengkap. Sambungkan jaringan dan muat ulang sebelum pemulihan/pembaruan.'
          this.change({ ready: false, message })
          throw new ValidationError(message)
        }
      }
      await probe(); setProbe(probe)
      window.addEventListener('online', () => { void registration.update().catch(() => this.change({ message: 'Pemeriksaan pembaruan belum berhasil. Periksa jaringan lalu buka ulang aplikasi setelah pekerjaan selesai.' })) })
    } catch { this.change({ message: 'Persiapan offline belum berhasil. Data lokal tetap ada; sambungkan jaringan dan buka ulang aplikasi.' }) }
  }
  async install(): Promise<void> {
    if (!this.promptEvent || this.state.busy) return
    const prompt = this.promptEvent; this.promptEvent = undefined; this.change({ busy: true, canInstall: false })
    try { await prompt.prompt(); const result = await prompt.userChoice; this.change({ message: result.outcome === 'accepted' ? 'Permintaan instalasi diterima. Selesaikan petunjuk browser.' : 'Instalasi dibatalkan. Aplikasi masih dapat dipakai melalui browser.' }) }
    catch { this.change({ message: 'Instalasi belum tersedia. Gunakan menu browser jika pilihan Pasang aplikasi tersedia.' }) }
    finally { this.change({ busy: false }) }
  }
  async activateUpdate(onAccepted: () => void = () => {}): Promise<void> {
    const waiting = this.registration?.waiting
    if (!waiting || this.state.busy) throw new ValidationError('Belum ada pembaruan yang siap diterapkan.')
    this.change({ busy: true })
    try {
      const result = await workerMessage(waiting, 'ACTIVATE_UPDATE')
      if (!result || typeof result !== 'object' || !('accepted' in result) || result.accepted !== true) throw new ValidationError('Tutup jendela aplikasi lain sebelum memperbarui.')
      // Once activation is accepted, the old page must remain read-only even if
      // activation later times out. It may no longer have matching lazy assets.
      onAccepted()
      if (waiting.state !== 'activated') await new Promise<void>((resolve, reject) => {
        const done = () => { if (waiting.state === 'activated') { window.clearTimeout(timer); waiting.removeEventListener('statechange', done); resolve() } }
        const timer = window.setTimeout(() => { waiting.removeEventListener('statechange', done); reject(new ValidationError('Pembaruan belum selesai. Tutup lalu buka kembali setelah menyelesaikan pekerjaan.')) }, 10000)
        waiting.addEventListener('statechange', done)
      })
      this.change({ updateAvailable: false })
    } finally { this.change({ busy: false }) }
  }
}
export const pwaRuntime = new PwaRuntime()
