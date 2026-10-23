import { CheckoutError, type CheckoutCommand, type CheckoutQuote, type CheckoutResult, type CheckoutSelection } from '../../domain/checkout'
import { calculateChange } from '../../domain/checkoutMath'
import { copyCheckoutCommand } from '../../domain/checkoutRequest'
import { createUuid } from '../../domain/id'
import type { CheckoutService } from '../../services/checkoutOperations'
import type { CheckoutSession, CheckoutSessionStore } from './checkoutSession'
import type { CustomerSnapshot } from '../../domain/customer'

export type CashStatus = 'editing' | 'preparing' | 'processing' | 'success' | 'rejected' | 'uncertain'
interface RecoverableCheckout { checkoutOperationId: string; command: CheckoutCommand }
export interface CashState {
  paymentMethod: 'CASH' | 'BON'
  status: CashStatus; open: boolean; busy: boolean; ready: boolean
  quote: CheckoutQuote | null; command: CheckoutCommand | null; result: CheckoutResult | null
  unresolved: readonly RecoverableCheckout[]; message: string; code: string
}
export type CheckoutClient = Pick<CheckoutService, 'preview' | 'prepare' | 'execute' | 'getResult' | 'listUnresolved' | 'cancel'>
const initial: CashState = { paymentMethod: 'CASH', status: 'editing', open: false, busy: false, ready: false, quote: null, command: null, result: null, unresolved: [], message: '', code: '' }

// External store owned by the provider: synchronous guards also cover clicks before React renders.
export class CheckoutController {
  private state: CashState = initial
  private listeners = new Set<() => void>()
  private journal: CheckoutSession = { active: null, lastId: null }
  private started = false
  private journalLoaded = false
  private selections: readonly CheckoutSelection[] = []
  private clearOwnedCart: (() => void) | null = null
  private client: CheckoutClient
  private storage: CheckoutSessionStore
  constructor(client: CheckoutClient, storage: CheckoutSessionStore) { this.client = client; this.storage = storage }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  getSnapshot = () => this.state
  private patch(value: Partial<CashState>) { this.state = { ...this.state, ...value }; this.listeners.forEach((listener) => listener()) }
  get locked() { return !this.state.ready || this.state.busy || !!this.state.command || this.state.status === 'uncertain' }
  private save(active: CheckoutCommand | null, lastId = this.journal.lastId) {
    const next = { active, lastId }; this.storage.write(next); this.journal = next
  }
  private fail(cause: unknown, forceUncertain = false) {
    const business = !forceUncertain && cause instanceof CheckoutError && cause.code !== 'STORAGE_ERROR' && cause.code !== 'INTEGRITY_ERROR'
    this.patch({ status: business ? 'rejected' : 'uncertain', busy: false, open: true,
      code: cause instanceof CheckoutError ? cause.code : 'STORAGE_ERROR',
      message: business ? cause.message : 'Status transaksi belum dapat dipastikan. Jangan ulangi dengan transaksi baru. Periksa kembali penyimpanan dan hasil transaksi ini.' })
  }
  private success(result: CheckoutResult) {
    // A failed journal update leaves the active ID recoverable, never creates a replacement ID.
    try { this.save(null, result.sale.checkoutOperationId); this.storage.resolve?.(result.sale.checkoutOperationId) } catch {
      // Keep memory current; the old persisted active ID still recovers this same Sale on reload.
      this.journal = { active: null, lastId: result.sale.checkoutOperationId }
    }
    if (this.state.command?.checkoutOperationId === result.sale.checkoutOperationId) this.clearOwnedCart?.()
    this.clearOwnedCart = null
    this.patch({ paymentMethod: result.sale.paymentMethod, status: 'success', busy: false, open: true, ready: true, result, command: null, quote: null, message: '', code: '',
      unresolved: this.state.unresolved.filter((intent) => intent.checkoutOperationId !== result.sale.checkoutOperationId) })
  }
  async boot() {
    if (this.started) return
    this.started = true
    await this.check()
  }
  async check() {
    if (this.state.busy) return
    this.patch({ busy: true })
    try {
      const startup = !this.journalLoaded
      if (!this.journalLoaded) { this.journal = this.storage.read(); this.journalLoaded = true }
      const command = this.state.command ?? this.journal.active
      const id = command?.checkoutOperationId ?? (startup ? this.journal.lastId : null)
      const result = id ? await this.client.getResult(id) : null
      const pending = this.storage.pending?.() ?? []
      const intents = await this.client.listUnresolved()
      const operations = new Map<string, RecoverableCheckout>()
      for (const entry of pending) operations.set(entry.checkoutOperationId, { checkoutOperationId: entry.checkoutOperationId, command: entry })
      for (const intent of intents) operations.set(intent.checkoutOperationId, intent)
      const unresolved = [...operations.values()]
      this.patch({ unresolved, ready: true })
      if (result) { this.success(result); return }
      if (command) {
        this.patch({ paymentMethod: command.paymentMethod, command, quote: null, status: 'rejected', open: true, busy: false, code: '',
          message: 'Belum ada penjualan tersimpan untuk ID ini. Lanjutkan request yang sama atau batalkan secara eksplisit sebelum mengubah belanja.' })
      } else this.patch({ busy: false, status: 'editing', message: '', code: '' })
    } catch (cause) { this.fail(cause, true) }
  }
  async begin(selections: readonly CheckoutSelection[], clearOwnedCart: () => void, paymentMethod: 'CASH' | 'BON' = 'CASH') {
    if (this.locked || this.state.open) return
    this.selections = selections.map((line) => ({ ...line }))
    this.clearOwnedCart = clearOwnedCart
    this.patch({ paymentMethod, open: true, busy: true, status: 'editing', quote: null, result: null, message: '', code: '' })
    try { this.patch({ quote: await this.client.preview(this.selections), busy: false }) }
    catch (cause) { this.fail(cause) }
  }
  async refreshQuote() {
    if (this.state.busy || this.state.command || this.state.status === 'uncertain') return
    this.patch({ busy: true, quote: null, message: '', code: '' })
    try { this.patch({ quote: await this.client.preview(this.selections), status: 'editing', busy: false }) }
    catch (cause) { this.fail(cause) }
  }
  async confirm(cashReceived: number) {
    if (this.state.paymentMethod !== 'CASH' || this.state.busy || this.state.command || !this.state.quote || this.state.status !== 'editing') return
    let command: CheckoutCommand
    try {
      calculateChange(cashReceived, this.state.quote.total)
      command = copyCheckoutCommand({ payloadVersion: 1, checkoutOperationId: createUuid(), paymentMethod: 'CASH',
        lines: this.state.quote.lines, expectedTotal: this.state.quote.total, cashReceived })
    } catch (cause) { this.fail(cause); return }
    this.patch({ command, status: 'preparing', busy: true })
    try { this.save(command) } catch (cause) { this.fail(cause); return }
    await this.run(command)
  }
  async confirmBon(customer: CustomerSnapshot, dueDate: string | null) {
    if (this.state.paymentMethod !== 'BON' || this.state.busy || this.state.command || !this.state.quote || this.state.status !== 'editing') return
    let command: CheckoutCommand
    try {
      command = copyCheckoutCommand({ payloadVersion: 2, paymentMethod: 'BON', checkoutOperationId: createUuid(), lines: this.state.quote.lines,
        expectedTotal: this.state.quote.total, cashReceived: 0, customer, dueDate })
    } catch (cause) { this.fail(cause); return }
    this.patch({ command, status: 'preparing', busy: true })
    try { this.save(command) } catch (cause) { this.fail(cause); return }
    await this.run(command)
  }
  private async run(command: CheckoutCommand) {
    try {
      this.patch({ busy: true, status: 'preparing', message: '', code: '' })
      await this.client.prepare(command)
      this.patch({ status: 'processing' })
      this.success(await this.client.execute(command))
    } catch (cause) { this.fail(cause) }
  }
  async resume() {
    if (this.state.busy || !this.state.command || this.state.status === 'uncertain') return
    try { this.save(this.state.command) } catch (cause) { this.fail(cause); return }
    await this.run(this.state.command)
  }
  async select(intent: RecoverableCheckout) {
    if (this.locked || this.state.open) return
    this.clearOwnedCart = null // Recovery must NEVER clear a new in-memory cart.
    const command = copyCheckoutCommand(intent.command)
    this.patch({ paymentMethod: command.paymentMethod, command, open: true, quote: null, result: null, status: 'rejected', message: 'Intent belum selesai. Periksa hasil sebelum melanjutkan.', code: '' })
    try { this.save(command) } catch (cause) { this.fail(cause); return }
    await this.check()
  }
  async cancel() {
    if (this.state.busy || !this.state.command) return
    const command = this.state.command
    this.patch({ busy: true })
    try {
      // Both reads and cancel serialize with checkout. A committed Sale can never be undone here.
      const result = await this.client.getResult(command.checkoutOperationId)
      if (result) { this.success(result); return }
      let cancellation
      try {
        cancellation = await this.client.cancel(command.checkoutOperationId)
      } catch (cause) {
        if (!(cause instanceof CheckoutError) || cause.code !== 'INTENT_REQUIRED') throw cause
        // Persist a cancellation even if prepare never completed. Another tab may hold this ID.
        // This closes the gap where a late prepare could revive an apparently cancelled request.
        try { await this.client.prepare(command) }
        catch (prepareCause) { if (!(prepareCause instanceof CheckoutError) || prepareCause.code !== 'INTENT_CANCELLED') throw prepareCause }
        cancellation = await this.client.cancel(command.checkoutOperationId)
      }
      if (cancellation.status === 'COMMITTED') { this.success(cancellation.result); return }
      this.save(null)
      this.storage.resolve?.(command.checkoutOperationId)
      this.patch({ command: null, quote: null, busy: false, status: 'rejected', message: 'Intent dibatalkan. Keranjang tetap tersedia. Tinjau harga dan konfirmasi ulang.', code: '',
        unresolved: this.state.unresolved.filter((intent) => intent.checkoutOperationId !== command.checkoutOperationId) })
    } catch (cause) { this.fail(cause) }
  }
  close() {
    if (this.state.busy || this.state.command || this.state.status === 'uncertain') return
    this.clearOwnedCart = null
    this.patch({ open: false, quote: null, status: 'editing', message: '', code: '' })
  }
  async reopenReceipt() {
    if (this.locked || this.state.open) return
    if (this.state.result) { this.patch({ open: true, status: 'success' }); return }
    if (!this.journal.lastId) return
    this.patch({ busy: true })
    try {
      const result = await this.client.getResult(this.journal.lastId)
      if (result) this.success(result)
      else this.patch({ busy: false })
    } catch (cause) { this.fail(cause) }
  }
}
