import type { ReactNode } from 'react'

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div>
    <p className="eyebrow mb-2">Zanna-Cell / Ruang kerja</p><h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h1>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">{description}</p></div>{action}</div>
}
