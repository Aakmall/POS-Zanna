import { ValidationError } from '../domain/errors'
import { CHECKOUT_RECOVERY_PREFIX, CHECKOUT_SESSION_KEY, LAST_RECEIPT_KEY } from '../features/cashier/checkoutSession'
import { PAYMENT_RECOVERY_PREFIX } from '../features/credit/paymentRecovery'

export function checkBrowserRecovery(): void {
  const session = window.sessionStorage.getItem(CHECKOUT_SESSION_KEY)
  if (session) {
    const value: unknown = JSON.parse(session)
    if (!value || typeof value !== 'object' || !('active' in value) || value.active !== null) throw new ValidationError('Tutup atau selesaikan pemulihan checkout sebelum mengganti data atau memperbarui aplikasi.')
  }
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (key?.startsWith(CHECKOUT_RECOVERY_PREFIX) || key?.startsWith(PAYMENT_RECOVERY_PREFIX)) throw new ValidationError('Masih ada jurnal transaksi/pembayaran. Gunakan Periksa hasil atau pemulihan terlebih dahulu.')
  }
}
export function clearBrowserRecovery(): void {
  // Called only AFTER a successful restore. Business data and unrelated preferences stay untouched.
  window.sessionStorage.removeItem(CHECKOUT_SESSION_KEY)
  window.localStorage.removeItem(LAST_RECEIPT_KEY)
}
