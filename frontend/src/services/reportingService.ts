import { localDatabase } from '../data/localDatabase'
import { DexieReportingRepository } from '../data/dexieReportingRepository'
import { ReportingService } from './reportingOperations'

export const reportingService = new ReportingService(new DexieReportingRepository(localDatabase))
