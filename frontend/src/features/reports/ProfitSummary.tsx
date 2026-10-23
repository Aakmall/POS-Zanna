import type { ProfitReport } from '../../domain/reporting'
import { money } from '../../lib/format'
export function ProfitSummary({ profit, error }: { profit: ProfitReport | null; error: string }) {
  return <section className="panel p-5" aria-label="Laba kotor"><h2 className="text-sm font-semibold">Laba Kotor {profit && !profit.complete ? '· Parsial' : ''}</h2><p className="mt-2 text-xs leading-5 text-ink-muted">Penjualan dikurangi harga modal saat dijual, belum dikurangi biaya operasional. Diskon belum tersedia; nilai penjualan memakai total baris tersimpan.</p>
    <p className="mt-2 text-xs text-warning">Akses terbuka untuk pengembangan. Pembatasan khusus pemilik belum diterapkan.</p>
    {error ? <p role="alert" className="mt-4 text-sm text-danger">{error}</p> : !profit ? <p role="status" className="mt-4 text-sm text-ink-muted">Membaca harga modal transaksi…</p> : <>
      {!profit.complete && <p role="status" className="mt-4 rounded-xl bg-warning-soft p-3 text-sm text-warning">{profit.missingItems} baris tidak memiliki harga modal saat dijual. Penjualan dan modal baris tersebut dikecualikan dari laba yang diketahui. Transaksi lama tidak dihitung ulang memakai modal terbaru.</p>}
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3"><div><dt className="text-ink-muted">Penjualan dengan modal</dt><dd className="mt-1 font-semibold">{money(profit.knownRevenue)}</dd></div><div><dt className="text-ink-muted">Harga Modal / HPP</dt><dd className="mt-1 font-semibold">{money(profit.cost)}</dd></div><div><dt className="text-ink-muted">{profit.complete ? 'Laba kotor' : 'Laba kotor diketahui'}</dt><dd className="mt-1 font-semibold">{money(profit.profit)}</dd></div></dl>
    </>}
  </section>
}
