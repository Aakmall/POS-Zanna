# Fase 8 — Stabilisasi frontend, performa dan UX

24 Oktober 2026. **Selesai dengan Catatan:** implementasi dan validasi otomatis selesai; pengujian manual Fase 7–8 ditunda oleh pengguna. Bukan pernyataan siap produksi atau siap operasional multiuser. Tidak memulai Fase 9, backend, autentikasi atau sinkronisasi; tidak commit/push.

## Audit dan prioritas

Baseline Git `e19768010c3192a10f50cb871b537e604e8ecdbe`, working tree bersih. Source aktual, laporan/validasi Fase 5–7, routing/context, model dan adapter Dexie, recovery, tooling PWA, forms dan konfigurasi diperiksa. Tidak ada AGENTS.md di repository. Baseline dieksekusi: 363/363 tes, build berhasil, JS utama 671,66 kB dan warning >500 kB. Warning `act` tidak muncul pada baseline ini.

| Prioritas | Temuan dan keputusan | Risiko/kompleksitas |
| --- | --- | --- |
| 1 | Semua halaman diimpor eager; tunda sembilan halaman operasional. Pertahankan layout/provider dan identitas checkout | Sedang: navigasi, recovery dan precache harus diuji |
| 2 | Belum ada render/chunk error boundary. Tambahkan fallback dengan navigasi dan reload eksplisit | Sedang: reload dapat menutup draft/cart, sehingga perlu konfirmasi |
| 3 | Produk/kategori/konfirmasi produk hanya mengandalkan busy state; stok guard juga membaca state. Tambahkan ref sinkron sebelum await | Rendah: tidak mengubah domain/idempotency repository |
| 4 | Beberapa UI membocorkan exception penyimpanan mentah. Bedakan pesan validasi aplikasi dari exception tak dikenal | Sedang: pesan validasi yang bermanfaat wajib dipertahankan |
| 5 | Pemeriksaan cache berikutnya dapat gagal sementara indikator ready tetap true. Batalkan status ready pada kegagalan | Rendah: pengaman maintenance tetap memeriksa worker sebelum menulis |
| 6 | Validasi harga/modal/barcode baru terlihat saat submit; teks detail variable dan riwayat ketinggalan | Rendah: bantuan langsung tanpa mengubah aturan atau nilai draft |

Tidak melakukan redesign, refactor controller/transaksi, penggantian library, optimasi query spekulatif atau perubahan perhitungan. Tidak ada dependency baru/dihapus. Pemeriksaan `npm ls --depth=0` tidak menemukan dependency hilang/invalid. Tidak mengklaim audit kerentanan jaringan baru.

## Implementasi dan lokasi UI

| No. | Menu/Halaman | Fitur yang Diubah | Lokasi di Website | Jenis Perubahan |
| --- | --- | --- | --- | --- |
| 1 | Semua menu operasional | Sebelum: semua kode sejak startup. Sesudah: halaman dimuat sesuai navigasi, fallback “Memuat halaman…” | Dashboard/Kasir/Produk/Stok/Riwayat/Pelanggan & Bon/Laporan/Pengaturan | DIPERBARUI |
| 2 | Semua halaman | Sebelum: render/import gagal berpotensi blank. Sesudah: petunjuk, Kembali ke Dashboard dan Muat ulang aplikasi dengan konfirmasi | Muncul hanya bila pemuatan/render gagal; bukan menu baru | BARU |
| 3 | Produk | Bantuan harga jual/modal/barcode saat mengetik, aria-invalid/deskripsi dan border error | Produk → Tambah produk atau Edit → Modal / Varian jual | DIPERBARUI |
| 4 | Produk dan kategori | Mencegah dua submit dalam tick yang sama; dialog simpan tetap terkunci saat proses | Produk → Tambah/Edit; Kategori → Simpan; konfirmasi aktif/nonaktif/Isi Data Demo | DIPERBAIKI |
| 5 | Stok | Guard sinkron simpan mutasi/koreksi; retry memakai request yang sama | Stok → Tambah Stok / Koreksi Stok | DIPERBAIKI |
| 6 | Katalog, pelanggan, laporan, backup/impor | Sebelum: sebagian error native mentah. Sesudah: pesan aplikasi dengan petunjuk; draft dipertahankan | Error baca katalog/riwayat stok/Bon/laporan, simpan produk/pelanggan, impor, Backup & Pemulihan | DIPERBAIKI |
| 7 | Produk dan Riwayat | Variable dijelaskan sebagai berat/volume aktual; teks Laporan DEMO dihapus; riwayat mencakup Bon | Produk → Detail → Varian jual; Riwayat Penjualan → penjelasan bawah/empty state | DIPERBAIKI |
| 8 | Pengaturan | Ready offline dibatalkan jika probe cache gagal; kegagalan memeriksa update kini diberi pesan | Pengaturan → Aplikasi & Offline → Aset aplikasi / pesan status | DIPERBAIKI |
| 9 | Welcome/footer/about | Penanda Fase 8 | Halaman awal, footer, Pengaturan → Informasi aplikasi | DIPERBARUI |
| 10 | Internal | Kelompok chunk, pengukuran bundle dan tes produksi | Tidak ada tombol baru | INTERNAL SAJA |

Fallback tidak menjalankan ulang checkout/cicilan/impor/restore. React.lazy menyimpan promise yang ditolak; karena itu tidak menawarkan retry import palsu yang hanya merender lazy component yang sama. Pengguna dapat berpindah route atau menyetujui reload, dengan informasi dampak draft/cart dan pemeriksaan recovery. Boundary hanya menangani render/lazy; validasi domain, catch operasi async, jurnal dan transaksi atomik tetap bertugas sendiri.

## Arsitektur dan file penting

```text
App → BrowserRouter → PageErrorBoundary(app) → SafetyBoundary → AppRoutes
  layout operasional → DemoProvider (tetap hidup)
    menu + PageOutlet → PageErrorBoundary(pathname) → Suspense → halaman lazy

form/hook → service → repository interface → adapter Dexie → IndexedDB v5
  error validasi aplikasi → userError → pesan aman untuk UI
  exception native/tak dikenal → userError → petunjuk fallback

Vite → 1 entry + 9 halaman + 1 shared + 2 Excel → daftar precache SW
```

| File/kelompok | Fungsi |
| --- | --- |
| `src/app/routes.tsx` | React.lazy di tingkat modul, mempertahankan semua path/props injeksi service |
| `src/app/App.tsx` | Boundary luar melindungi kegagalan render layout/provider; tetap di dalam router |
| `src/components/layout/PageOutlet.tsx` | Suspense Indonesia dan boundary per pathname; navigasi menu tidak ikut tersuspensi |
| `src/components/ui/PageErrorBoundary.tsx` | Fallback render/lazy; detail exception tidak ditampilkan; reload atas konfirmasi |
| `src/lib/userError.ts` | Hanya ValidationError/SalesHistoryError aplikasi diteruskan; exception lain memakai fallback |
| `src/features/products/{ProductForm,VariantFields,CategoryManager,ProductsPage}.tsx` | Guard simpan, bantuan input dan aksesibilitas; domain tetap memvalidasi sebelum write |
| `src/features/stock/StockMovementForm.tsx` | Guard sebelum await; operationId dan retry request sama dipertahankan |
| `src/app/DemoProvider.tsx`, hooks Bon/pelanggan/laporan/stok | Pesan error storage tidak mentah; error tetap error, bukan metrik/katalog nol palsu |
| Backup/import/report rules, repository dan service yang tercantum dalam validasi | `Error` buatan aplikasi menjadi `ValidationError`; hanya klasifikasi, kondisi/payload/rules sama |
| `src/pwa/pwaRuntime.ts` | Menurunkan ready ketika probe gagal, pesan update check gagal; tidak mengubah strategi cache |
| `vite.config.ts` | Pengelompokan initial core dan shared pages, tanpa mengubah chunk warning limit |
| `scripts/measure-bundle.mjs` | Build write:false dengan config asli, ukuran raw/gzip, graph static imports dan atribusi modul |
| `scripts/phase8-ui.test.tsx` | 13 tes Fase 8: pending/reject/render/navigasi/cart/forms/double-submit/storage/PWA |
| `scripts/dashboard-ui.test.tsx` | Menunggu metrik atau error nyata, termasuk penantian lazy page, bukan hanya absennya teks loading lama |
| `scripts/pwa-production.test.ts` | Seluruh JS emitted wajib di precache; HTTP+offline emulator dan eksekusi ESM hasil build |

## Pengukuran performa

Tidak memakai analyzer/dependency baru. Kontribusi modul sebelum minify: React DOM sekitar 536,8 kB, fitur aplikasi 294,6 kB, Dexie 132,5 kB, penulis Excel 113,9 kB, router 93,7 kB, domain 93,1 kB, pembaca Excel 85,6 kB. Angka kontribusi bukan ukuran unduhan dan tidak boleh dijumlahkan dengan hasil minify. Excel sudah dynamic sebelum Fase 8; tidak mengklaim optimasi tersebut baru.

| Metrik | Sebelum | Sesudah |
| --- | ---: | ---: |
| JS entry/initial static closure | 671.664 byte | 470.723 byte (**−29,92%**) |
| Gzip pengukuran Node zlib yang sama | 196.876 byte | 146.470 byte (**−25,60%**) |
| JS request untuk entry saja | 1 | 1 |
| Cold Dashboard, termasuk static dependencies halaman | 671.664 byte / 1 request | 524.996 byte / 3 request |
| Cold Kasir | 671.664 byte / 1 request | 549.356 byte / 3 request |
| Seluruh JS termasuk Excel | 786.809 byte / 4 file | 795.430 byte / 13 file |
| Gzip seluruh JS, jumlah per file | 229.087 byte | 243.269 byte |
| CSS log Vite | 40,50 kB | 40,62 kB |
| SW log Vite | 2,39 kB | 2,71 kB |

Log Vite memakai pelaporan gzip sendiri: entry **671,66 → 470,72 kB**, gzip **198,40 → 147,80 kB**. Tabel byte memakai `Buffer.byteLength` dan `gzipSync` default Node secara konsisten; jangan mencampur kedua seri pengukuran. kB = 1.000 byte.

Trade-off: total JS naik 1,10% raw / 6,19% gzip akibat batas chunk, helper dan stabilisasi tambahan. Pembukaan pertama halaman operasional memakai entry + shared + halaman; berikutnya modul yang sama digunakan ulang. Percobaan default menghasilkan 33 chunk termasuk helper/ikon sangat kecil; pengelompokan menghasilkan 13: entry, sembilan halaman, satu shared, dua Excel. Shared juga membawa beberapa helper Excel/UI lebih dini; dipilih untuk membatasi request dan menjaga aturan bundler tanpa pemecahan per ikon. Tidak menaikkan threshold warning, menghapus diagnostic atau memasukkan library optimasi.

Pengukuran tidak membuktikan LCP/INP/FPS, durasi startup atau kecepatan tablet. Tidak melakukan benchmark runtime/browser atau mengklaim render lebih sedikit. Query graph penuh, pagination dan ukuran backup besar tetap backlog yang perlu volume nyata.

Reproduksi dari `frontend`:

```powershell
npm ci
npm run build
npm run measure:bundle -- docs/performance/phase8-recheck.json
```

Artefak [sebelum](performance/phase8-before.json) direkam sebelum perubahan source/config; [sesudah](performance/phase8-after.json) dari working tree akhir pada HEAD yang sama. Untuk mengulang baseline, gunakan salinan terpisah source HEAD di atas dengan lockfile sama dan script pengukur ini; jangan mengembalikan working tree aktif. Build pengukur tidak menulis/mengganti dist. Waktu build bukan benchmark karena cache dan beban mesin berubah.

## Dampak PWA dan integritas data

Plugin yang ada sudah menyusun precache dari seluruh bundle; tidak perlu mengganti service worker atau format cache. Setelah splitting, **20 aset** termasuk seluruh 13 JS diprecache. Versi hash berubah mengikuti isi aset. Persiapan offline tetap mengunduh seluruh aset di background: total transfer/penyimpanan cache bukan turun 29,92%. UI route loading hanya menunda evaluasi/pemuatan halaman; instalasi SW tetap lengkap agar halaman yang belum pernah dibuka bisa tersedia offline setelah siap.

Update tetap menunggu persetujuan, satu window, keranjang kosong/recovery selesai dan lock; tidak reload paksa. Cache gagal berarti belum siap, bukan menghapus data. Kegagalan update check kini terlihat. Perbaikan ready bekerja ketika probe dijalankan, bukan pemantauan cache eviction terus-menerus; belum ada janji cache selalu tersedia. HTTPS/localhost dan root origin tetap prasyarat.

Dexie schema **v5/14 tabel**, database, UUID, domain types, format backup **v1/appVersion phase-7/schema5**, snapshot modal/historis, journal, transaksi atomic, fingerprint, idempotency, konversi dan perhitungan uang tidak diubah. `phase-7` pada metadata backup adalah kompatibilitas format, bukan label UI; sengaja tidak diganti ke phase-8. Tidak menyentuh IndexedDB browser pengguna. Pengujian memakai fake-indexeddb terisolasi.

Audit forms: produk/varian tetap memakai parseRupiah/parseQuantity dan validateProduct termasuk barcode unik, unitPolicy serta legacy edit; inventory preview dan repository tetap memeriksa konversi/balance; pelanggan divalidasi service+repository; checkout/cicilan tetap controller guard+stable operationId+intent+atomic write; impor tetap preview privat sekali pakai+konfirmasi+fingerprint master+transaksi. Ref guard UI hanya tambahan, bukan pengganti validasi/integritas domain.

## QA, risiko dan langkah berikutnya

Hasil eksekusi, masalah saat pengembangan dan seluruh file ada pada [validasi Fase 8](PHASE-8-VALIDATION-REPORT.md). **376 tes source + 2 integrasi produksi = 378 lulus, 0 gagal/skip** pada hasil final; lint/typecheck/build lulus. Tidak ada warning act pada baseline dan regresi akhir yang dicatat. Boundary test menangkap error yang sengaja diinjeksi melalui onCaughtError dan mengassert-nya, tidak memfilter console/warning.

[Checklist manual](PHASE-8-MANUAL-TEST-GUIDE.md) memisahkan A Fase 7 tertunda, B perubahan Fase 8, C integrasi langsung saja. Seluruhnya **belum dijalankan**, tidak diminta sekarang. Emulator HTTP/cache dan JSDOM tidak mewakili native SW/instalasi, layout, keyboard atau tablet.

Risiko tersisa: belum ada autentikasi/hak OWNER; backup sensitif tidak terenkripsi; IndexedDB/cache bisa dihapus/evict oleh platform; HTTPS tablet belum disediakan; pengaturan warung/printer masih simulasi; data besar belum dipaginasi; kegagalan entry JS sebelum React hidup tidak dapat ditangani boundary React. Tidak ada bug kritis dalam scope yang diketahui masih terbuka dari pengujian ini; bukan jaminan seluruh keadaan perangkat telah teruji.

## Kesiapan backend masa depan — dokumentasi saja

- Repository interface/service tetap titik integrasi, komponen tidak menulis PostgreSQL/API langsung. Adapter remote nanti tidak boleh mengganti transaksi lintas tabel dengan beberapa request tanpa kontrak atomik.
- Authentication & Authorization masih ditunda. Spring Boot harus menegakkan izin, termasuk reports.profit.view, products.cost.view, products.import.confirm, backups.export dan backups.restore. Boundary/lock/label Operator Demo bukan keamanan.
- Sinkronisasi memerlukan push/pull, idempotency server, konflik master/ledger, reconciliation, identitas perangkat dan kebijakan offline tersendiri. Jangan menggabungkan ulang event pembayaran/penjualan sebagai data mutable.
- Versioning schema dan format cadangan harus dirancang bersama kompatibilitas build/SW aktif. Perubahan schema/backup memerlukan audit, migrasi eksplisit, regression fixture lama dan persetujuan sesuai instruksi pengguna.
- PostgreSQL hanya di belakang Spring Boot. Belum ada backend, fake API, login/PIN, role sementara atau cloud sync.

Materi belajar: telusuri `routes.tsx → PageOutlet → halaman`; bandingkan fallback loading dengan error; periksa ref guard sebelum await di ProductForm; ikuti userError yang mempertahankan validasi namun mengganti exception native; jalankan pengukur dan bandingkan initialJs dengan allJs untuk memahami mengapa code splitting tidak mengurangi total cache.

Rekomendasi: simpan status manual tertunda; setelah pengguna memilih waktunya, jalankan checklist terfokus dan tinjau keamanan/deployment sebelum operasional. Ruang lingkup fase berikutnya menunggu instruksi, tanpa implementasi Fase 9.

Referensi primer: [React.lazy](https://react.dev/reference/react/lazy), [React error boundary](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary), [Vite load errors](https://vite.dev/guide/build#load-error-handling), serta deklarasi CodeSplittingGroup dari Rolldown terpasang. Promise lazy ditolak ditangani boundary dan cache promise tidak diperlakukan sebagai retry baru.
