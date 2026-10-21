import { localDatabase } from '../data/localDatabase'
import { DexieCheckoutRepository } from '../data/dexieCheckoutRepository'
import { CheckoutService } from './checkoutOperations'

// Composition only. No UI import and no prepare/execute on application startup in step 4.3.
export const checkoutService = new CheckoutService(new DexieCheckoutRepository(localDatabase))
