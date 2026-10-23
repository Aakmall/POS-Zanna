import { localDatabase } from '../data/localDatabase'
import { DexieCreditRepository } from '../data/dexieCreditRepository'
import { CreditService } from './creditOperations'

export const creditService = new CreditService(new DexieCreditRepository(localDatabase))
