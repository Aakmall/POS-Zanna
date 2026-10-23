import type { ProfitReport, ReportRequest, ReportingRepository, SalesReport } from '../domain/reporting'
import { reportWindow, summarizeProfit, summarizeReport } from '../domain/reportingRules'

export class ReportingService {
  private readonly repository: ReportingRepository
  constructor(repository: ReportingRepository) { this.repository = repository }
  async read(request: ReportRequest, now = new Date()): Promise<SalesReport> {
    const window = reportWindow(request, now)
    return summarizeReport(await this.repository.read(window), window)
  }
  // Future permission: reports.profit.view (currently open for development by user decision).
  async profit(report: SalesReport): Promise<ProfitReport> {
    return summarizeProfit(report, await this.repository.readCosts(report.sales.map(({ sale }) => sale.id)))
  }
  subscribe(request: ReportRequest, now: Date, next: (report: SalesReport) => void, error: (cause: unknown) => void) {
    const window = reportWindow(request, now)
    return this.repository.subscribe(window, (data) => { try { next(summarizeReport(data, window)) } catch (cause) { error(cause) } }, error)
  }
}
