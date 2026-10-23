import { localDatabase } from '../data/localDatabase'
import { DexieCustomerRepository } from '../data/dexieCustomerRepository'
import { CustomerService } from './customerOperations'

export const customerService = new CustomerService(new DexieCustomerRepository(localDatabase))
