import { useEffect, useSyncExternalStore } from 'react'
import { useDemoStore } from '../../hooks/useDemoStore'

export function useCashCheckout() {
  const { checkoutController: controller } = useDemoStore()
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  useEffect(() => { void controller.boot() }, [controller])
  return { controller, state, locked: controller.locked }
}
