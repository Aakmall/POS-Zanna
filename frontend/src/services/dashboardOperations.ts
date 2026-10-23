import type { DashboardRepository, DashboardSnapshot } from '../domain/dashboard'
import { dashboardWindow, summarizeDashboard } from '../domain/dashboardRules'
import { ReportingService } from './reportingOperations'

export class DashboardService {
  private readonly repository: DashboardRepository
  readonly reports: ReportingService
  constructor(repository: DashboardRepository) { this.repository = repository; this.reports = new ReportingService(repository.reporting) }
  async read(now = new Date()) { const window = dashboardWindow(now); return summarizeDashboard(await this.repository.read(window), window) }
  subscribe(now: Date, next: (snapshot: DashboardSnapshot) => void, error: (cause: unknown) => void) {
    const window = dashboardWindow(now)
    return this.repository.subscribe(window, (data) => { try { next(summarizeDashboard(data, window)) } catch (cause) { error(cause) } }, error)
  }
}
