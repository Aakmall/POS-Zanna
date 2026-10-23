import { CreditError, type CreditPaymentCommand, type CreditPaymentResult, type Receivable } from '../../domain/credit'
import { copyCreditPaymentCommand } from '../../domain/creditRules'
import { createUuid } from '../../domain/id'
import type { CreditService } from '../../services/creditOperations'
import type { PaymentRecoveryStore } from './paymentRecovery'

export type PaymentClient = Pick<CreditService, 'prepare' | 'execute' | 'getPayment' | 'cancel' | 'listUnresolved'>
export interface PaymentState {
  ready: boolean; open: boolean; busy: boolean
  status: 'idle' | 'editing' | 'saving' | 'pending' | 'uncertain' | 'success'
  receivable: Receivable | null; command: CreditPaymentCommand | null; result: CreditPaymentResult | null
  pending: readonly CreditPaymentCommand[]; error: string
}
export class CreditPaymentController {
  private state: PaymentState = { ready: false, open: false, busy: false, status: 'idle', receivable: null, command: null, result: null, pending: [], error: '' }
  private listeners = new Set<() => void>()
  private readonly client: PaymentClient
  private readonly storage: PaymentRecoveryStore
  private started = false
  constructor(client: PaymentClient, storage: PaymentRecoveryStore) { this.client = client; this.storage = storage }
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  get locked() { return !this.state.ready || this.state.open || this.state.busy || !!this.state.command || this.state.pending.length > 0 || this.state.status === 'uncertain' }
  private patch(patch: Partial<PaymentState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach((listener) => listener()) }
  private fail(cause: unknown) {
    const business = cause instanceof CreditError && !['STORAGE_ERROR', 'INTEGRITY_ERROR'].includes(cause.code)
    this.patch({ open: true, busy: false, status: business ? (this.state.command ? 'pending' : 'editing') : 'uncertain', error: business ? cause.message : 'Hasil pembayaran belum dapat dipastikan. Jangan menerima uang ulang atau membuat pembayaran pengganti. Periksa hasil dengan ID yang sama.' })
  }
  private success(result: CreditPaymentResult) {
    try { this.storage.resolve(result.payment.operationId) } catch { /* Durable old ID still safely reopens this same payment. */ }
    this.patch({ ready: true, open: true, busy: false, status: 'success', command: null, result, receivable: null, error: '', pending: this.state.pending.filter((command) => command.operationId !== result.payment.operationId) })
  }
  async boot() { if (this.started) return; this.started = true; await this.check() }
  async check() {
    if (this.state.busy) return
    this.patch({ busy: true })
    try {
      const pending = new Map(this.storage.pending().map((command) => [command.operationId, command]))
      for (const intent of await this.client.listUnresolved()) pending.set(intent.operationId, copyCreditPaymentCommand(intent.command))
      this.patch({ pending: [...pending.values()], ready: true })
      const command = this.state.command
      if (command) {
        const result = await this.client.getPayment(command.operationId)
        if (result) { this.success(result); return }
        this.patch({ busy: false, open: true, status: 'pending', error: 'Belum ada pembayaran tersimpan. Lanjutkan request yang sama atau batalkan intent sebelum meninjau ulang nominal.' })
      } else this.patch({ busy: false, status: 'idle', open: false, error: '' })
    } catch (cause) { this.fail(cause) }
  }
  begin(receivable: Receivable) {
    if (this.locked || receivable.balance <= 0) return
    this.patch({ open: true, status: 'editing', receivable: { ...receivable }, result: null, error: '' })
  }
  async confirm(amount: number) {
    if (this.state.busy || this.state.command || this.state.status !== 'editing' || !this.state.receivable) return
    let command: CreditPaymentCommand
    try { command = copyCreditPaymentCommand({ payloadVersion: 1, operationId: createUuid(), receivableId: this.state.receivable.id, amount, expectedBalance: this.state.receivable.balance }) }
    catch (cause) { this.fail(cause); return }
    this.patch({ command, busy: true, status: 'saving', error: '' })
    try { this.storage.save(command) } catch (cause) { this.fail(cause); return }
    await this.run(command)
  }
  private async run(command: CreditPaymentCommand) {
    try {
      this.patch({ busy: true, status: 'saving', error: '' })
      await this.client.prepare(command)
      this.success(await this.client.execute(command))
    } catch (cause) { this.fail(cause) }
  }
  async resume() {
    if (this.state.busy || !this.state.command || this.state.status !== 'pending') return
    try { this.storage.save(this.state.command) } catch (cause) { this.fail(cause); return }
    await this.run(this.state.command)
  }
  async select(value: CreditPaymentCommand) {
    if (!this.state.ready || this.state.open || this.state.busy || this.state.command || this.state.status === 'uncertain') return
    const command = copyCreditPaymentCommand(value)
    this.patch({ command, open: true, receivable: null, result: null, status: 'pending', error: '' })
    await this.check()
  }
  async cancel() {
    if (this.state.busy || !this.state.command) return
    const command = this.state.command
    this.patch({ busy: true })
    try {
      const result = await this.client.cancel(command)
      if (result) { this.success(result); return }
      this.storage.resolve(command.operationId)
      this.patch({ busy: false, open: false, command: null, receivable: null, status: 'idle', error: '', pending: this.state.pending.filter((entry) => entry.operationId !== command.operationId) })
    } catch (cause) { this.fail(cause) }
  }
  close() { if (this.state.busy || this.state.command || this.state.status === 'uncertain') return; this.patch({ open: false, status: 'idle', receivable: null, result: null, error: '' }) }
  async receipt(operationId: string) {
    if (this.locked) return
    this.patch({ busy: true })
    try {
      const result = await this.client.getPayment(operationId)
      if (!result) throw new CreditError('INTEGRITY_ERROR', 'Bukti pembayaran tidak ditemukan.')
      this.success(result)
    } catch (cause) { this.fail(cause) }
  }
}
