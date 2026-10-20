import { ArrowLeft, MapPinOff } from 'lucide-react'
import { ButtonLink } from '../../components/ui/ButtonLink'

export function NotFoundPage() {
  return (
    <section aria-labelledby="not-found-title" className="flex min-h-[60svh] flex-col items-center justify-center text-center">
      <span className="mb-6 flex size-16 items-center justify-center rounded-panel bg-brand-soft text-brand"><MapPinOff size={30} aria-hidden="true" /></span>
      <p className="text-sm font-semibold tracking-widest text-brand">404</p>
      <h1 id="not-found-title" className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Halaman tidak ditemukan</h1>
      <p className="mt-4 mb-8 max-w-sm text-sm leading-6 text-ink-muted">Alamat yang Anda buka belum tersedia. Kembali ke beranda untuk melihat halaman awal Zanna-Cell.</p>
      <ButtonLink to="/"><ArrowLeft size={18} aria-hidden="true" /> Kembali ke beranda</ButtonLink>
    </section>
  )
}
