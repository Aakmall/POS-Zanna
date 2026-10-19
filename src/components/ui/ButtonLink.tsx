import { Link, type LinkProps } from 'react-router'

export function ButtonLink({ children, ...props }: Omit<LinkProps, 'className'>) {
  return (
    <Link
      {...props}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-brand px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
    >
      {children}
    </Link>
  )
}
