import type { Product } from '../../domain/product'
import { productUnitIssues } from '../../domain/inventoryReview'
import { useDemoStore } from '../../hooks/useDemoStore'

export function UnitPolicyNotice({ product }: { product: Product }) {
  const { snapshot } = useDemoStore()
  const issues = productUnitIssues(product, snapshot)
  if (!issues.length) return null
  return <details className="mt-3 text-xs leading-6 text-warning"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Perlu review satuan/kemasan</summary><ul className="list-disc space-y-1 pl-4">{issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul><p className="mt-2">Tinjau melalui Edit produk. Kemasan yang tidak sah diblokir; saldo dan riwayat lama tetap dipertahankan.</p></details>
}
