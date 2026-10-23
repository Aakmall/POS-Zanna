import type { ImportCell, ImportPreview, ProductImportRepository } from '../domain/productImport'
import { previewProductImport } from '../domain/productImportRules'

export class ProductImportService {
  private readonly repository: ProductImportRepository
  // Only previews produced by this service instance can be confirmed once.
  private readonly previews = new WeakMap<ImportPreview, ImportPreview>()
  constructor(repository: ProductImportRepository) { this.repository = repository }
  async preview(rows: readonly (readonly ImportCell[])[]): Promise<ImportPreview> {
    const input = structuredClone(rows), snapshot = await this.repository.snapshot()
    const preview = previewProductImport(input, snapshot)
    this.previews.set(preview, structuredClone(preview))
    return preview
  }
  // Future permission: products.import.confirm. No permission claim in development.
  async confirm(preview: ImportPreview, explicitlyConfirmed: boolean): Promise<number> {
    const trusted = this.previews.get(preview)
    if (!explicitlyConfirmed || !trusted || trusted.issues.length || !trusted.drafts.length) throw new Error('Periksa preview tanpa kesalahan dan centang persetujuan impor terlebih dahulu.')
    // Consume BEFORE awaiting to prevent concurrent/double submit. Re-preview after any failure.
    this.previews.delete(preview)
    return this.repository.commit(trusted)
  }
}
