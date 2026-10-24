import { userError } from '../../lib/userError'
import { useEffect, useState } from 'react'
import type { Customer } from '../../domain/customer'
import { customerService } from '../../services/customerService'
import type { CustomerService } from '../../services/customerOperations'

export function useCustomers(service: CustomerService = customerService) {
  const [customers, setCustomers] = useState<readonly Customer[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState(''), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    return service.subscribe((rows) => { setCustomers(rows); setStatus('ready'); setError('') }, (cause) => {
      setStatus('error'); setError(userError(cause, 'Pelanggan belum dapat dibaca. Coba lagi tanpa menghapus data browser.'))
    })
  }, [service, attempt])
  return { customers, status, error, retry: () => { setStatus('loading'); setAttempt((value) => value + 1) } }
}
