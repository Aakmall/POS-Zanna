# Zanna-Cell — POS-Zanna

Sistem Kasir Warung Campuran. **Fase 6: Dashboard/laporan nyata, HPP dan laba kotor historis, piutang, ekspor CSV serta impor produk Excel dengan preview dan konfirmasi atomik**. Schema Dexie v5 additive mempertahankan data lama. Omzet = CASH + BON COMPLETED; cicilan bukan penjualan baru. Modal transaksi lama yang tidak tersedia ditandai parsial, bukan direka dari master terkini. QRIS tetap nonaktif. Lihat [laporan Fase 6](docs/PHASE-6-FINAL-REPORT.md), [hasil validasi](docs/PHASE-6-VALIDATION-REPORT.md) dan [panduan manual fitur baru](docs/PHASE-6-MANUAL-TEST-GUIDE.md).

**Authentication & Authorization — Deferred:** atas keputusan pengguna, seluruh fitur terbuka untuk development/testing tanpa login, PIN atau role sementara. Laba/modal dan impor belum dilindungi izin OWNER. Belum siap operasional banyak pengguna; jangan memakai data sensitif untuk demo publik.

## Menjalankan proyek

Gunakan Node.js 22.13+ pada lini 22 atau LTS 24+ yang kompatibel. Lingkungan implementasi: Node 22.18.0, npm 10.9.3.

```powershell
cd C:\04-Project-TOKO\POS-Zanna\frontend
npm ci
npm run dev
```

Buka alamat yang ditampilkan Vite, biasanya http://localhost:5173. Untuk tablet pada LAN yang sama:

```powershell
npm run dev -- --host 0.0.0.0
```

Gunakan alamat Network dari terminal. **localhost, IP LAN, port, profil browser, dan perangkat berbeda mempunyai penyimpanan berbeda.** Data belum disinkronkan. Operasi persediaan tidak memerlukan API/internet setelah frontend tersedia; membuka ulang aplikasi tanpa server/aset yang tersedia belum dijamin karena PWA/service worker belum dibuat.

## Alur penggunaan lokal

1. Buka `/produk`, buat kategori dan produk beserta satuan dasar/varian. Pilih jenis persediaan dan kemasan yang sah; BBM wajib dasar Liter/ml. Produk lama perlu review kebijakan sebelum kemasan tambahan dipakai lagi. Database baru mulai tanpa produk; **Isi Data Demo** hanya berjalan atas tindakan dan konfirmasi pengguna.
2. Buka `/stok`. Produk lama maupun baru berstatus **Belum diatur** sampai stok awal dibuat. Stok awal 0 diperbolehkan dan berbeda dengan belum diatur.
3. Atur stok awal sekali. Selanjutnya gunakan Tambah Stok atau Koreksi Stok. Koreksi wajib alasan; koreksi keluar memerlukan konfirmasi dan tidak boleh melebihi saldo.
4. Pilih satuan yang sesuai dan periksa pratinjau konversi. Isi dus/jeriken ditentukan pengguna atau konfigurasi varian, bukan ditebak aplikasi.
5. Buka Riwayat untuk melihat saldo sebelum/sesudah, alasan, UUID operasi, dan snapshot konversi. Tidak ada edit/hapus ledger melalui UI.
6. Produk dan Kasir membaca saldo yang sama. Varian berbagi stok dasar produk; menambah keranjang belum mereservasi/mengurangi stok. Fixed memakai jumlah kemasan bulat; variable memakai input volume/berat maksimal tiga desimal.
7. Pilih Bayar → tinjau preview → isi uang diterima → konfirmasi tunai. Sukses menampilkan struk tersimpan, mengurangi stok, dan mengosongkan hanya keranjang terkait. Struk terakhir dapat dibuka kembali.
8. Jika ada intent belum selesai setelah refresh, periksa hasil lalu lanjutkan request yang sama atau batalkan untuk koreksi. Status **uncertain** harus diperiksa; jangan menerima pembayaran ulang/membuat ID baru atau menghapus site data.
9. Buka **Riwayat Penjualan** di sidebar/Menu atau `/penjualan`. Cari nomor struk, atur tanggal lalu Terapkan filter; gunakan Muat lebih banyak untuk halaman berikutnya. Lihat struk membuka detail tersimpan tanpa membuat transaksi atau mengurangi stok. Reset filter mengembalikan daftar tanpa pencarian.
10. Buka `/dashboard` untuk omzet/transaksi/baris item hari ini, tujuh hari kalender lokal, recent, top products dan stok. Omzet bukan laba; ranking berdasarkan omzet dengan quantity dipisahkan per satuan jual. Pembacaan tidak mengurangi stok, dan perubahan checkout/inventory memicu pembaruan otomatis.
11. Tambah pelanggan aktif di `/bon`. Di Kasir pilih Bon → Catat Bon → pilih pelanggan/jatuh tempo opsional → konfirmasi. Seluruh total menjadi utang, tanpa menerima uang saat checkout; stok berkurang satu kali.
12. Di `/bon`, buka tagihan → Bayar Cicilan → isi nominal atau pelunasan penuh → konfirmasi uang yang diterima. Sisa Utang/status dan bukti tersimpan diperbarui atomik, tanpa pengurangan stok atau omzet kedua. Bukti dapat dibuka dari riwayat pembayaran tagihan.
13. Jika pembayaran terputus, gunakan Pulihkan pembayaran dan Periksa hasil dahulu. Cicilan baru dikunci sampai operasi lama ditangani. Jangan menerima uang ulang atau menghapus site data ketika hasil belum pasti.

Pada layar di bawah 1024px, gunakan **Keranjang & Bayar** di bagian atas katalog atau tombol tetap di atas navigasi bawah. Keduanya membuka drawer dengan keranjang yang sama.

## Pemeriksaan kode

```powershell
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run typecheck
npm run test:unit
npm run test:inventory
npm run test:checkout
npm run test:checkout-ui
npm run test:sales-history
npm run test:phase4-final
npm run test:credit
npm run test:phase6
npm test
npm run build
```

`typecheck` mencakup aplikasi, konfigurasi Vite, dan tests. `npm test` menjalankan seluruh tes logika, repository, migrasi, dan DOM memakai Node runner, tsx, fake-indexeddb, serta jsdom. Database tes memakai fake-indexeddb terisolasi, bukan IndexedDB browser pengguna. Build menghasilkan `dist/`; edit sumber `src/`, bukan hasil build. `npm run preview` menyajikan hasil build. Hosting SPA memerlukan fallback rute ke `index.html`.

Tes DOM mensimulasikan breakpoint 390, 768, 1024, dan 1366px. Ini bukan pengujian visual browser/Android. Fokus native, keyboard virtual, safe-area, overlap, dan tampilan tablet tetap diperiksa manual oleh pengguna.

## Teknologi

React 19, TypeScript 6 strict, Vite 8, Tailwind CSS 4, React Router 7, Lucide React, Dexie **4.4.6**, read-excel-file **9.3.12** dan write-excel-file **4.1.1**. Paket Excel dimuat saat impor/template dibutuhkan. State memakai React context/hooks. Backend Java Spring Boot dan PostgreSQL dibuat pada fase terpisah.

## Halaman

| Rute | Perilaku |
| --- | --- |
| `/` | Welcome dan akses fitur lokal / Kasir |
| `/dashboard` | Periode/metode, penjualan/kas/piutang, grafik tanggal, terlaris/stok, transaksi terbaru dan laba kotor lengkap/parsial |
| `/produk` | CRUD master lokal, kategori, varian, barcode/SKU, status aktif, saldo dan status stok |
| `/stok` | Saldo aktual, stok awal/masuk, koreksi masuk/keluar, ledger, pencarian/filter |
| `/kasir` | Checkout tunai/Bon atomik, input fixed/variable, struk digital dan recovery; QRIS tetap nonaktif |
| `/penjualan` | Riwayat transaksi nyata hanya-baca, cari nomor struk, tanggal lokal dan load more |
| `/penjualan/:saleId` | Detail snapshot dan struk lama, termasuk setelah produk diarsipkan |
| `/bon` | Pelanggan aktif/arsip, tagihan, cicilan/pelunasan, bukti, ringkasan dan recovery nyata; detail dapat dibuka dengan `?tagihan=<id>` |
| `/laporan` | Tab Penjualan, Laba Kotor, Piutang; filter tanggal/metode, detail dan Ekspor CSV |
| `/pengaturan` | Rancangan preferensi, printer, backup, dan informasi aplikasi |
| Rute lainnya | 404 sisi klien |

## Struktur

```text
frontend/
├── docs/
│   ├── PHASE-5-FINAL-REPORT.md
│   ├── PHASE-4-FINAL-REPORT.md
│   ├── PHASE-4-5-SALES-HISTORY.md
│   ├── PHASE-4-4-CASHIER-INTEGRATION.md
│   ├── PHASE-4-3-CHECKOUT-SERVICE.md
│   ├── PROJECT-BACKLOG.md
│   ├── PHASE-4-2-DOMAIN-DATABASE.md
│   ├── PHASE-4-1-CHECKOUT-DESIGN.md
│   ├── PHASE-3-BUSINESS-HARDENING.md
│   ├── INVENTORY-DATA-MODEL.md
│   ├── PHASE-3-INVENTORY-LEARNING.md
│   ├── PHASE-3-REPORT.md
│   ├── PRODUCT-DATA-MODEL.md       # Referensi master / riwayat Fase 2
│   └── PHASE-2-LEARNING.md
├── scripts/                      # Logika, repository, migrasi, dan tes DOM
├── src/
│   ├── app/                      # Router, context, subscription master/saldo
│   ├── assets/                   # Ilustrasi SVG lokal
│   ├── components/{layout,ui}/    # Layout dan komponen bersama
│   ├── data/                     # Dexie v1→v2→v3→v4→v5, singleton DB, adapter repository
│   ├── domain/                   # Model, kontrak, validasi, aturan konversi
│   ├── features/                 # Produk, Stok, Kasir, dan halaman pendukung
│   ├── hooks/                    # Inventory, riwayat, breakpoint Kasir
│   ├── lib/                      # Formatting dan agregasi demo
│   ├── mocks/                    # Sampel eksplisit / laporan fiktif
│   ├── services/                 # Inventory/checkout service, pilihan satuan, composition root
│   ├── styles/                   # Tokens, base, responsive retail
│   ├── types/                    # Read model dan tipe UI
│   └── main.tsx
└── package.json
```

## Database dan integritas

Database tetap **`zanna-cell-db`**. Skema v1 (`products`, `categories`, `units`, `variants`) dipertahankan. Skema v2 menambahkan `inventoryBalances` dan `stockMovements` tanpa menghapus/mereset data lama, mengubah UUID/barcode, atau otomatis memberi stok nol.

**Schema v3** menambahkan `sales`, `saleItems`, `checkoutIntents` dan indeks relasi `saleId`/`saleItemId` pada ledger. Deklarasi v1/v2 tetap. Engine menegakkan relasi dan menulis Sale, semua item, ledger SALE, saldo serta intent COMMITTED dalam satu transaksi. UI memanggil service, tidak menulis Dexie langsung. Fase 4.4 dan 4.5 tidak mengubah schema/database version atau menghapus data.

**Schema v4** menambah `customers`, `receivables`, `creditPayments`, `creditPaymentIntents` dan indeks metode Sale. Tidak ada reset/backfill data lama. CASH v1/fingerprint lama tetap; BON v2 mengikat snapshot pelanggan dan jatuh tempo. Checkout Bon menulis Sale/Item/SALE/saldo/tagihan/intent atomik. Pembayaran Bon menulis bukti immutable + projection saldo/status + intent atomik; saldo diverifikasi terhadap Sale dan seluruh event pembayaran. Pelanggan diarsipkan tetap dapat melunasi tagihan lama. Jurnal pembayaran durable per operationId di localStorage mendukung recovery tanpa autoexecute.

**Schema v5** hanya menambah `saleItemCosts`. Penjualan baru menyimpan harga modal per satuan dasar/HPP baris secara atomik dengan checkout; transaksi lama tidak ditulis ulang. HPP half-up integer memakai quantityBase. Produk → Impor Excel menambah produk/varian baru dalam satu transaksi setelah preview dan persetujuan; tanpa update produk lama, pembuatan satuan/kategori, atau perubahan stok otomatis.

`CheckoutService` menyediakan preview/prepare/execute/getResult/listUnresolved/cancel. prepare membekukan request; execute membaca ulang master/saldo dan commit atomik; replay sukses mengembalikan snapshot lama tanpa write kedua. Tidak ada auto-execute saat aplikasi dibuka. `npm run test:checkout` menguji domain/migration/service pada database terisolasi.

Penunjuk checkout aktif disimpan **per tab** dalam sessionStorage, dengan jurnal pemulihan durable **per ID operasi** di localStorage sebelum prepare/execute. ID struk terakhir juga disimpan lokal agar dapat dibuka setelah tab ditutup. Semua pointer diperiksa melalui CheckoutService; IndexedDB tetap otoritas penjualan. Cart yang belum dikonfirmasi masih di memori dan tidak dipulihkan otomatis. Intent PREPARED juga ditemukan melalui listUnresolved. Halaman Riwayat membaca Sale langsung melalui service hanya-baca dan tidak memerlukan pointer checkout untuk membuka struk lama.

SalesHistoryService memakai query header berindeks createdAt, urutan createdAt/ID terbaru dan halaman 20 (maksimal 50). Tanggal mengikuti zona waktu perangkat dan mencakup seluruh hari akhir. Detail memakai getResult yang sama dengan checkout agar snapshot, SaleItem, intent dan ledger tervalidasi tanpa membaca ulang master. Daftar tidak memuat seluruh SaleItem atau mengarang jumlah item.

Identitas memakai UUID; waktu ISO UTC; harga integer rupiah; kuantitas integer berskala **1000 per satuan dasar** sesuai Fase 2. `minimumStock` menggunakan skala yang sama; `null` berarti belum diatur. Satuan dasar tidak dapat diganti setelah produk dibuat. Stok diskret tidak menerima pecahan. Perhitungan konversi memakai BigInt sementara untuk validasi presisi; nilai tersimpan tetap number integer aman.

Setiap perubahan saldo dan penambahan ledger berada dalam satu transaksi Dexie. `operationId` unik dan fingerprint input mencegah operasi identik diproses dua kali, termasuk retry. Snapshot menyimpan konversi saat kejadian sehingga edit varian tidak mengubah arti riwayat lama. Tidak ada saldo fisik kedua pada Product atau varian.

## Dokumentasi pembelajaran

- [Fase 6: arsitektur, laporan/HPP, ekspor, impor dan autentikasi ditunda](docs/PHASE-6-FINAL-REPORT.md)
- [Fase 6: validasi otomatis dan daftar file](docs/PHASE-6-VALIDATION-REPORT.md)
- [Fase 6: panduan manual khusus fitur baru/terdampak](docs/PHASE-6-MANUAL-TEST-GUIDE.md)
- [Fase 5 lengkap: pelanggan, Bon, cicilan, database v4, audit, hasil tes, panduan dan latihan](docs/PHASE-5-FINAL-REPORT.md)
- [Panduan satuan produk: penjualan langsung, kemasan, isi, contoh bensin/solar/beras/minuman/mi, kompatibilitas edit dan audit UX](docs/USER-GUIDE-PRODUCT-UNITS.md)
- [Final Fase 4: gabungan Dashboard 4.6 + audit 4.7, seluruh alur, tes, backlog, checklist dan kesiapan Fase 5](docs/PHASE-4-FINAL-REPORT.md)
- [Fase 4 · Langkah 4.5: arsitektur riwayat, query/cursor, timezone, snapshot, tes dan latihan](docs/PHASE-4-5-SALES-HISTORY.md)
- [Fase 4 · Langkah 4.4: integrasi UI tunai, scaled quantity, receipt, recovery, pengujian dan latihan](docs/PHASE-4-4-CASHIER-INTEGRATION.md)
- [Fase 4 · Langkah 4.3: service atomik, ledger, idempotency, concurrency, rollback dan recovery](docs/PHASE-4-3-CHECKOUT-SERVICE.md)
- [Project Backlog: optimisasi/nonkritis yang ditunda](docs/PROJECT-BACKLOG.md)
- [Fase 4 · Langkah 4.2: domain, kalkulator, migrasi v3, hasil tes, lima latihan dan DevTools](docs/PHASE-4-2-DOMAIN-DATABASE.md)
- [Fase 4 · Langkah 4.1: audit dan desain checkout tunai, belum diimplementasikan](docs/PHASE-4-1-CHECKOUT-DESIGN.md)
- [Hardening satuan/kemasan: policy per produk, review legacy, dan koreksi saldo](docs/PHASE-3-BUSINESS-HARDENING.md)
- [Laporan Fase 3: 22 bagian, perubahan, hasil pemeriksaan, batasan](docs/PHASE-3-REPORT.md)
- [Panduan belajar: 20 konsep, file/fungsi, alur, perintah, DevTools, lima latihan, checklist manual](docs/PHASE-3-INVENTORY-LEARNING.md)
- [Kontrak inventory, fixed-point, migrasi, concurrency, Future Backend & Synchronization](docs/INVENTORY-DATA-MODEL.md)
- [Model master produk Fase 2](docs/PRODUCT-DATA-MODEL.md)
- [Panduan belajar Fase 2](docs/PHASE-2-LEARNING.md)

## Pemeriksaan manual pengguna

Pengguna menyatakan pengujian manual Fase 1–5 sudah dilakukan. Fase 6 hanya meminta pengujian fitur baru/terdampak melalui [panduan manual Fase 6](docs/PHASE-6-MANUAL-TEST-GUIDE.md): filter/laporan/ekspor, impor valid/invalid, satu integrasi snapshot modal dan Bon/cicilan, serta sampel data lama. Gunakan origin/profil uji untuk transaksi contoh; jangan mengulang semua alur lama atau menghapus data operasional. Tes jsdom bukan pengujian visual/native browser/tablet.

## Keterbatasan dan tahap berikutnya

IndexedDB bukan backup permanen: penghapusan site data, eviction, mode privat, atau kerusakan perangkat dapat menghilangkan data. Backup/restore dan autentikasi tepercaya belum tersedia. Pembatasan UI bukan proteksi owner terhadap pengguna yang menguasai browser/DevTools. Ledger tidak memiliki audit server atau proteksi kriptografis.

Belum ada autentikasi/hak akses, reservasi stok keranjang, retur/pembatalan penjualan, supplier/pembelian, QRIS nyata, scanner/printer, PWA, deployment, Spring Boot, PostgreSQL, atau sinkronisasi. Dashboard dan Laporan nyata. HPP lama tanpa snapshot tetap parsial; laba belum biaya operasional. Impor hanya produk baru dengan kategori/satuan tersedia, maksimal 500 baris/2 MB/satu lembar .xlsx; ekspor laporan CSV bukan backup. Pembayaran Bon belum mendukung uang muka, bayar gabungan, refund atau edit/hapus bukti. Query graph/daftar belum dipaginasi untuk data besar; risiko dan warning tercatat pada backlog.

**Fase 6 selesai dengan catatan akses sensitif terbuka dan menunggu pengujian manual pengguna.** Fase 7 serta Authentication & Authorization belum dimulai. Tidak ada commit/push otomatis; lakukan sendiri setelah menerima hasil dan validasi manual.
