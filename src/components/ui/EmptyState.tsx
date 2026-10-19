import { PackageSearch } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
    <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand"><PackageSearch size={25} aria-hidden="true" /></span>
    <h2 className="font-semibold text-ink">{title}</h2><p className="mt-2 mb-5 max-w-sm text-sm leading-6 text-ink-muted">{description}</p>{action}
  </div>
}
