# Fase 6 — Dashboard, laporan, HPP, ekspor dan impor Excel

Implementasi 23 Oktober 2026. Status: selesai dengan catatan autentikasi ditunda atas keputusan eksplisit pengguna; validasi manual Fase 6 menunggu pengguna. Lihat [hasil validasi](PHASE-6-VALIDATION-REPORT.md) dan [panduan manual](PHASE-6-MANUAL-TEST-GUIDE.md).

## 1. Audit dan keputusan scope

Fondasi Fase 5 dipertahankan: pelanggan/Bon/cicilan, checkout atomik CASH/BON, inventory bersama, intent/fingerprint/recovery, struk/riwayat, Dashboard nyata dan 260 tes. Working tree awal bersih. Dokumentasi Fase 5, validasinya, model produk/inventory serta source repository/service/domain diperiksa. Tidak ditemukan PRD/roadmap terpisah bernama demikian; roadmap tersedia pada README dan PROJECT-BACKLOG.

Perbedaan dokumentasi/implementasi yang dikonfirmasi sebelum bekerja:

- Dashboard sudah nyata; Laporan masih memakai demoSales. Halaman Laporan diganti pembacaan transaksi sah.
- Harga modal master tersedia per satuan dasar, tetapi SaleItem belum menyimpan modal saat dijual. Tidak sah menghitung ulang laba historis memakai master terbaru.
- Identitas Pemilik/Operator Demo hanya ilustrasi; tidak ada autentikasi/hak akses. Setelah ditanyakan, pengguna memutuskan menunda seluruh autentikasi dan membuka fitur Fase 6 untuk development/testing. Ketentuan ini menggantikan acceptance awal OWNER-only; tidak ada klaim perlindungan sensitif.
- Label fase lama pada informasi aplikasi/welcome/layout diperbarui agar sesuai fitur nyata saat ini. Dokumen fase sebelumnya tetap referensi historis.

Tidak ada backend, PostgreSQL, cloud, sinkronisasi, backup otomatis, PWA, retur/refund, QRIS nyata, commit/push atau implementasi Fase 7.

## 2. Fitur dan peta perubahan UI

| No. | Halaman/Menu | Fitur yang dibuat atau diubah | Lokasi di aplikasi | Jenis perubahan |
| --- | --- | --- | --- | --- |
| 1 | Dashboard | Periode Hari Ini, 7 Hari Terakhir, Bulan Ini, Rentang Tanggal; filter Tunai/Bon | Dashboard → Periode / Metode pembayaran | DIPERBARUI |
| 2 | Dashboard | Penjualan, transaksi/baris item, uang diterima, piutang, grafik, terlaris, stok, transaksi terbaru | Dashboard → kartu dan bagian ringkasan | DIPERBARUI |
| 3 | Dashboard | Laba kotor lengkap/parsial dari snapshot modal | Dashboard → Laba Kotor | BARU |
| 4 | Laporan | Laporan penjualan nyata, periode/metode, grafik dan tautan struk | Laporan → Penjualan → klik nomor struk | DIPERBARUI |
| 5 | Laporan | HPP/laba dan kelengkapan modal per transaksi | Laporan → Laba Kotor | BARU |
| 6 | Laporan | Total Bon/dibayar/sisa saat ini, cari/status, pembayaran dalam periode | Laporan → Piutang → nomor tagihan/bukti → Pelanggan & Bon | BARU |
| 7 | Laporan | Unduh CSV sesuai tab dan periode/metode | Laporan → pilih tab/filter → Ekspor CSV | BARU |
| 8 | Produk | Template .xlsx, petunjuk, preview, kesalahan per baris, persetujuan impor | Produk → Impor Excel → Unduh template / Pilih file → centang persetujuan → Konfirmasi impor | BARU |
| 9 | Informasi aplikasi | Status Fase 6/laporan nyata/hak akses belum tersedia | Welcome; sidebar/footer; Pengaturan → Informasi aplikasi / Backup | DIPERBARUI |
| 10 | Laporan/Dashboard | Error penyimpanan terlihat dan dapat dicoba ulang | Laporan/Dashboard → Coba lagi saat pembacaan gagal | DIPERBAIKI |
| 11 | Checkout/database | Snapshot modal baru, tabel additive, rumus integer; tanpa perubahan rumus harga/konversi/stok | Tidak ada tombol baru; dipakai saat penjualan baru berhasil | INTERNAL SAJA |
| 12 | Impor | Rencana preview, deteksi perubahan master, transaksi tunggal dan cegah submit ganda | Internal; hasil terlihat pada modal impor | INTERNAL SAJA |

## 3. Arsitektur dan file penting

```text
Dashboard / ReportsPage / ProductImportDialog
  → hooks dan application service
    → kontrak domain + aturan murni
      → repository Dexie
        → IndexedDB lokal zanna-cell-db
```

| File/kelompok | Fungsi |
| --- | --- |
| domain/reporting.ts | Kontrak periode, data laporan, snapshot modal dan hasil laba |
| domain/reportingRules.ts | Kalender lokal, agregasi integer, pemisahan kas/penjualan, snapshot HPP, kelengkapan modal |
| data/dexieReportingRepository.ts | Baca konsisten transaksi/Bon/stok dan snapshot biaya; subscribe perubahan tanpa write |
| services/reportingOperations.ts, reportingService.ts | Entry point laporan dan laba; composition root lokal; titik izin masa depan |
| services/reportExport.ts | CSV per tab, escape kutip/baris/formula dan unduhan browser |
| features/reports/* | Filter, kartu, grafik, tabel, laba, piutang, loading/error/retry dan koordinasi ekspor |
| features/dashboard/DashboardPage.tsx | Memakai komponen/service laporan yang sama; stok/terlaris tetap dipisahkan menurut satuan |
| services/dashboardOperations.ts, domain/dashboard.ts, data/dexieDashboardRepository.ts | Pertahankan API Dashboard lama untuk regresi, sediakan adapter laporan dari database yang sama |
| domain/dashboardRules.ts | Penentuan hari terakhir digeneralisasi untuk periode variabel; aturan ranking/stok lama tetap |
| domain/productImport.ts, productImportRules.ts | Format 14 kolom, kelompok produk/varian, kesalahan baris, validasi domain dan sidik kondisi master |
| services/productExcel.ts | Baca .xlsx dan template; pembatasan ukuran/lembar/struktur arsip sebelum parser |
| services/productImportOperations.ts | Preview tanpa write, salinan rencana privat, konfirmasi eksplisit satu kali |
| data/dexieProductImportRepository.ts | Periksa ulang master dan semua draft dalam transaksi; pakai saveProduct yang sudah stabil |
| features/products/ProductImportDialog.tsx | Alur template → file → preview → kesalahan/persetujuan → hasil |
| data/database.ts, dexieCheckoutRepository.ts | v5 additive dan write snapshot modal dalam commit checkout yang sama |
| scripts/phase6-reporting.test.ts, product-import.test.ts, phase6-ui.test.tsx | Pengujian laporan/HPP/migrasi, impor/rollback/Excel nyata dan DOM |

Daftar seluruh file dan statusnya ada pada [laporan validasi](PHASE-6-VALIDATION-REPORT.md). Tidak ada write Dexie langsung pada komponen baru.

## 4. Periode, uang, penjualan dan piutang

- Periode menggunakan hari kalender zona waktu perangkat, awal inklusif dan hari setelah tanggal akhir eksklusif; bukan potong tanggal UTC atau durasi tetap 24 jam. Tersedia hari ini, tujuh hari termasuk hari ini, bulan ini sampai hari ini, dan custom maksimal 366 hari.
- Sumber penjualan adalah Sale COMPLETED beserta SaleItem/intent/ledger yang lolos validasi checkout. Laporan memverifikasi graph Bon melalui repository yang sudah ada.
- Penjualan = CASH + BON sesuai tanggal penjualan dan filter metode. Cicilan tidak menambah jumlah transaksi, item, atau penjualan.
- Uang diterima = CASH sesudah kembalian (Sale.total) + CreditPayment.amount menurut tanggal pembayaran. Bon belum dibayar tidak dianggap kas. Pembayaran tagihan lama pada periode kini tetap penerimaan uang, walaupun penjualannya di luar periode.
- Filter Tunai hanya menampilkan penjualan tunai dan mengecualikan cicilan. Filter Bon memasukkan penjualan Bon dan cicilan yang diterima pada periode. Semua metode menjumlah keduanya; label UI dan CSV menyatakan aturan ini.
- Total Bon, Sudah Dibayar, dan Sisa Piutang adalah saldo seluruh tagihan **saat ini**, tanpa filter tanggal/metode penjualan. Bukan snapshot saldo pada akhir periode. Pencarian/status pada tab Piutang menyaring daftar layar; CSV piutang mengekspor seluruh tagihan dan cicilan yang cocok dengan filter tanggal/metode utama, bukan pencarian/status lokal tabel.
- Riwayat/detail menggunakan tautan ke halaman Fase 5 yang sudah ada. Membaca laporan, membuka detail, atau ekspor tidak menulis stok/tagihan.
- Uang tetap integer Rupiah. Agregasi memakai BigInt sementara dengan pemeriksaan safe integer. Quantity tidak menjumlah Liter, Kilogram, Botol atau Bungkus menjadi satu angka; ranking berdasarkan penjualan dengan unit snapshot terpisah.
- Laporan live diperbarui setelah checkout, pembayaran atau mutasi stok; perubahan hari diperiksa saat fokus/jeda 30 detik. Detail tagihan lama tetap mengikuti pola on-demand Fase 5.

## 5. Snapshot harga modal dan laba kotor

Database tetap zanna-cell-db. Deklarasi v1–v4 tidak diganti. **v5 menambahkan saleItemCosts** dengan primary key saleItemId dan indeks saleId; total 14 store. Tidak ada upgrade callback yang menulis ulang transaksi/master lama, clear/reset atau estimasi backfill.

Setiap penjualan baru CASH/BON menyimpan satu snapshot per SaleItem dalam transaksi checkout yang sama:

```text
saleItemId / saleId
costPerBaseUnit: integer Rupiah atau null
totalCost: integer Rupiah atau null
policy: BASE_HALF_UP_V1
```

Modal diambil dari Product.costPrice pada commit, per satuan dasar produk. HPP baris = round-half-up(quantityBase × costPerBaseUnit / 1000), memakai BigInt. Botol 1,5 Liter dengan modal Rp10.000/Liter menghasilkan HPP Rp15.000; Jeriken 5 Liter Rp50.000. Quantity stok dan rumus subtotal checkout tidak berubah. Harga master boleh berubah sesudahnya tanpa mengubah snapshot.

Laba kotor diketahui = jumlah lineTotal untuk baris bermodal lengkap − jumlah HPP baris tersebut. Semua Sale lama tanpa snapshot dan snapshot baru null dihitung sebagai baris tanpa modal, **bukan modal nol**. Baris tersebut dikecualikan dari kedua sisi laba dan UI/CSV ditandai PARSIAL. Modal eksplisit nol tetap data lengkap. Jika snapshot biaya yang tersedia tidak konsisten dengan SaleItem, laporan laba gagal dengan pesan error dan tidak memperbaiki histori.

Diskon belum ada pada domain checkout; lineTotal adalah nilai penjualan sah yang digunakan. Tidak mengurangkan diskon fiktif atau biaya operasional. Ini estimasi laba kotor berdasarkan modal master saat commit, bukan FIFO, average inventory valuation, laba bersih, atau laporan akuntansi pembelian.

Replay checkout lama tidak membuat snapshot baru dan tidak mengubah histori. Kegagalan write snapshot modal membatalkan Sale/Item/Bon/stock movement/balance/intent commit bersama-sama. Tidak ada biaya yang ditambahkan pada respons struk publik lama; laporan membaca tabel biaya secara terpisah.

## 6. Impor Excel dan integritas

Impor adalah **create-only**. Tidak ada update/upsert produk lama, impor stok awal, penghapusan master atau pembuatan satuan/kategori otomatis. Pengguna membuat kategori aktif melalui menu Kategori; kode satuan merujuk master yang sudah tersedia. Produk baru aktif dan bukan data DEMO. StockBalance belum dibuat; atur stok awal melalui menu Stok.

Satu file .xlsx, tepat satu lembar, maksimal 2 MB dan 500 baris data. Struktur ZIP diperiksa sebelum parser: central directory, jumlah entry, sandi/arsip multi-disk dan jumlah ukuran isi yang dideklarasikan maksimal 20 MB. Ini pembatasan format/sumber daya, bukan klaim sandbox untuk segala file berbahaya. Library Excel dimuat saat diperlukan.

Template berisi judul saja, tanpa produk contoh yang dapat tidak sengaja diimpor. Urutan 14 kolom wajib tetap. Kode Produk mengelompokkan beberapa varian dalam file; bukan ID PostgreSQL, bukan SKU dan tidak disimpan sebagai identitas produk. UUID domain tetap dibuat oleh repository.

Validasi semua baris meliputi tipe sel, kolom wajib, Rupiah integer/nonnegatif, barcode teks/nol awal/keunikan termasuk arsip, SKU UPPERCASE, konversi positif/skala maksimal tiga desimal, dimensi/satuan/policy BBM, mode tetap/bebas, konflik nama master dan kesamaan metadata antarvarian. Nama varian tidak menentukan kapasitas. Modal/stok minimum/SKU/barcode opsional; harga jual wajib.

Pilih file hanya membaca/validasi. UI menampilkan ringkasan produk/varian, harga, modal, konversi dan kesalahan bernomor baris; satu kesalahan mengunci seluruh impor. Pengguna wajib mencentang persetujuan sebelum Konfirmasi impor.

Service menyimpan salinan privat preview dalam WeakMap, sehingga modifikasi objek UI tidak mengubah rencana. Preview dikonsumsi sebelum await untuk mencegah dua konfirmasi. Di transaksi rw empat master store, sidik kondisi master dibandingkan ulang; perubahan sejak preview mewajibkan pilih ulang file. saveProduct dipakai di dalam transaksi yang sama. Kegagalan produk/varian mana pun membatalkan seluruh impor; data lama identik. Tidak ada partial commit.

Jika respons hilang setelah commit, jangan mengulang secara buta: muat ulang daftar produk dan periksa nama/barcode. Preview baru akan menolak nama/identifier yang sudah ada, sehingga tidak melakukan overwrite atau membuat ulang produk tersebut. Impor belum memiliki jurnal durable seperti checkout; ini batas UX yang didokumentasikan.

## 7. Ekspor

Laporan → pilih tab → Ekspor CSV. File UTF-8 BOM, quoting koma/kutip/baris baru; teks yang dapat dibaca sebagai formula diberi awalan apostrof. Nilai angka tetap angka integer. CSV dapat dibuka Excel; tipe delimiter/penyajian mengikuti aplikasi pembukanya. Tidak menambah penjualan atau mengubah saldo.

Penjualan dan laba diekspor terpisah; CSV penjualan tidak menyisipkan modal/laba. CSV laba memuat status lengkap/parsial dan baris tanpa modal. CSV piutang memuat seluruh saldo terkini dan daftar pembayaran pada periode/metode utama. Ini ekspor laporan, **bukan backup lengkap atau format restore**. Tombol dan guard sinkron mencegah ekspor berulang saat sedang diproses.

## 8. Authentication & Authorization — Deferred

**Pembatasan OWNER belum diterapkan.** Atas keputusan pengguna, tidak ada PIN, login, sesi, role palsu atau mekanisme izin sementara. Seluruh fitur terbuka untuk development/testing. Label Pemilik/Operator Demo pada layout lama tetap ilustrasi, bukan identitas tepercaya.

**Aplikasi belum siap digunakan secara operasional oleh banyak pengguna.** Jangan menggunakan data toko sensitif dalam demo/pengujian publik. IndexedDB/localStorage tetap dapat diakses pengguna perangkat; tidak ada enkripsi aplikasi atau otoritas server.

Rancangan izin masa depan, belum menjadi keamanan berfungsi:

| Izin rancangan | Titik integrasi masa depan |
| --- | --- |
| reports.profit.view | ReportingService.profit, profitCsv/endpoint ekspor laba, Dashboard/ReportsPage → ProfitSummary |
| products.import.confirm | ProductImportService.confirm dan endpoint impor atomik backend; UI konfirmasi tetap hanya lapisan UX |
| products.cost.view | Pembacaan master/modal pada form/detail produk, preview impor dan snapshot biaya laporan |

Pada fase Authentication & Authorization, Spring Boot harus memverifikasi identitas/izin pada API dan ekspor; PostgreSQL tidak diakses browser. Guard UI saja tidak cukup. Tentukan juga perubahan harga modal dan provisioning perangkat/offline sesuai model ancaman saat itu. Tidak ada implementasi backend/permission pada Fase 6 ini.

## 9. Validasi, risiko dan status

Dependensi baru hanya **read-excel-file 9.3.12** dan **write-excel-file 4.1.1** beserta dependensi transitifnya. Proyek sebelumnya tidak memiliki pembaca/penulis .xlsx. API universal mengikuti [dokumentasi pembaca](https://github.com/catamphetamine/read-excel-file/blob/master/README.md) dan [penulis](https://github.com/catamphetamine/write-excel-file); modul diimpor dinamis. Instalasi npm melaporkan 0 kerentanan saat dijalankan, bukan jaminan keamanan di masa depan.

Hasil aktual, daftar file, catatan warning, dan bug yang diperbaiki ada pada [PHASE-6-VALIDATION-REPORT.md](PHASE-6-VALIDATION-REPORT.md). Panduan manual baru/terdampak saja ada pada [PHASE-6-MANUAL-TEST-GUIDE.md](PHASE-6-MANUAL-TEST-GUIDE.md).

Risiko tersisa: akses sensitif terbuka sesuai keputusan pengguna; data historis modal tidak lengkap; pembacaan seluruh graph/daftar belum dipaginasi untuk data besar; IndexedDB bukan backup; impor create-only terbatas; bundle/harness warning dicatat pada backlog. Tidak ada uji manual/native/tablet oleh agen.

Fase 6 selesai dengan catatan tersebut dan siap diuji pengguna, bukan pernyataan siap operasional multiuser. Fase 7 dan Authentication & Authorization belum dimulai; tunggu evaluasi. Tidak ada commit/push otomatis.
