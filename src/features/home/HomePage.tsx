import { ArrowDown, ArrowUpRight, Check, Layers3, ScanLine, Store, Tablet, WandSparkles } from 'lucide-react'
import { Link } from 'react-router'

const principles = [
  { icon: WandSparkles, number: '01', title: 'Sederhana sejak awal', description: 'Tampilan yang jernih, bahasa yang akrab, dan ruang untuk hal yang paling penting.' },
  { icon: Tablet, number: '02', title: 'Nyaman di setiap layar', description: 'Tata letak yang menyesuaikan ruang kerja, dari layar ponsel hingga tablet dan desktop.' },
  { icon: Layers3, number: '03', title: 'Tumbuh secara bertahap', description: 'Fondasi yang konsisten untuk menyambut kebutuhan usaha pada pengembangan berikutnya.' },
]

export function HomePage() {
  return (
    <div>
      <div className="mb-7 flex items-center gap-2 text-xs text-ink-muted">
        <span className="h-px w-6 bg-brand" aria-hidden="true" />
        RUANG USAHA, LEBIH TERTATA
      </div>
      <section aria-labelledby="welcome-title" className="relative isolate overflow-hidden rounded-panel bg-sidebar p-7 text-white shadow-panel sm:p-10 xl:p-12">
        <div className="relative z-10 max-w-xl lg:max-w-[70%] xl:max-w-[65%]">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-teal-100">
            <span className="size-1.5 rounded-full bg-teal-100" aria-hidden="true" /> Selamat datang di Zanna-Cell
          </span>
          <h1 id="welcome-title" className="mt-6 text-4xl leading-[1.15] font-semibold tracking-tight sm:text-5xl xl:text-[3.5rem]">Awal yang rapi.<br /><span className="text-teal-100">Usaha yang berarti.</span></h1>
          <p className="mt-6 max-w-md text-sm leading-7 text-slate-300 sm:text-base">Ruang kerja sederhana untuk warung campuran Anda. Dibangun bertahap agar setiap langkah terasa lebih mudah.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3"><Link to="/kasir" className="inline-flex min-h-12 items-center gap-3 rounded-control bg-white px-5 py-3 text-sm font-semibold text-navy transition-colors hover:bg-teal-50">Coba kasir DEMO <ArrowUpRight size={17} aria-hidden="true" /></Link><a href="#arah-pengembangan" className="inline-flex min-h-12 items-center gap-3 rounded-control px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10">
            Kenali Zanna-Cell <ArrowDown size={17} aria-hidden="true" />
          </a></div>
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -bottom-20 hidden size-96 items-center justify-center rounded-full border border-white/10 lg:flex">
          <div className="flex size-72 items-center justify-center rounded-full border border-white/10">
            <div className="flex size-48 items-center justify-center rounded-full bg-white/5">
              <Store size={88} strokeWidth={1} className="text-teal-100/70" />
            </div>
          </div>
          <span className="absolute top-14 right-24 rounded-2xl border border-white/15 bg-sidebar p-4 text-teal-100"><ScanLine size={26} strokeWidth={1.5} /></span>
        </div>
      </section>
      <section id="arah-pengembangan" aria-labelledby="principles-title" className="scroll-mt-6 pt-10 sm:pt-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-widest text-brand uppercase">Dirancang dengan tujuan</p>
            <h2 id="principles-title" className="mt-2 text-2xl font-semibold tracking-tight text-ink">Fokus pada keseharian usaha.</h2>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">Satu fondasi, banyak kemungkinan <ArrowUpRight size={15} aria-hidden="true" /></span>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {principles.map(({ icon: Icon, number, title, description }) => (
            <article key={number} className="rounded-panel border border-line bg-surface p-6">
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand"><Icon size={21} strokeWidth={1.75} aria-hidden="true" /></span>
                <span className="font-mono text-xs text-ink-muted">{number}</span>
              </div>
              <h3 className="mt-6 text-base font-semibold text-ink">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-ink-muted">{description}</p>
            </article>
          ))}
        </div>
      </section>
      <aside aria-label="Tahap pengembangan aplikasi" className="mt-6 flex items-start gap-4 rounded-panel border border-line bg-surface-muted p-5 sm:p-6">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-brand"><Check size={16} aria-hidden="true" /></span>
        <div>
          <h2 className="text-sm font-semibold text-ink">Fase 1: kenali ruang operasional</h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">Coba halaman Kasir dan menu operasional dengan data contoh. Seluruh pembayaran adalah simulasi DEMO, tanpa transaksi nyata atau penyimpanan permanen.</p>
        </div>
      </aside>
    </div>
  )
}

