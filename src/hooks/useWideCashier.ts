import { useSyncExternalStore } from 'react'

export const CASHIER_MEDIA = '(min-width: 1024px)'
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(CASHIER_MEDIA)
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}

export function useWideCashier() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(CASHIER_MEDIA).matches, () => false)
}
