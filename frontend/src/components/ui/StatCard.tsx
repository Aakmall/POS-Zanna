import type { LucideIcon } from 'lucide-react'

interface Props {
  label: string
  value: string
  note: string
  icon: LucideIcon
}

export function StatCard({ label, value, note, icon: Icon }: Props) {
  return (
    <article className="panel p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon size={21} strokeWidth={1.6} aria-hidden="true" /></span>
        <div className="min-w-0"><p className="text-xs leading-5 text-ink-muted">{label}</p><p className="mt-2 break-words text-2xl font-semibold tracking-tight text-ink tabular-nums">{value}</p></div>
      </div>
      <p className="mt-5 border-t border-line pt-3 text-[11px] leading-5 text-ink-muted">{note}</p>
    </article>
  )
}
