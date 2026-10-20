import type { PropsWithChildren } from 'react'

export function Badge({ children }: PropsWithChildren) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-muted px-3 py-1.5 text-xs font-semibold text-ink-muted">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
      {children}
    </span>
  )
}
