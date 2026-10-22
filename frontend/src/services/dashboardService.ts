import { localDatabase } from '../data/localDatabase'
import { DexieDashboardRepository } from '../data/dexieDashboardRepository'
import { DashboardService } from './dashboardOperations'

export const dashboardService = new DashboardService(new DexieDashboardRepository(localDatabase))
