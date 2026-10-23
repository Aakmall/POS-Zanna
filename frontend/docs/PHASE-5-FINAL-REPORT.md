# Fase 5 lengkap — Pelanggan, Bon, pembayaran piutang dan audit

Implementasi 22–23 Oktober 2026. POS-Zanna / Zanna-Cell. Cakupan 5.1–5.5 dikerjakan berurutan dalam satu pengerjaan, tanpa subfase tambahan, dependency baru, backend, sinkronisasi, commit/push atau Fase 6.

## 1. Audit awal dan hasil fitur

Source dan dokumentasi Fase 3–4 diperiksa: unit policy/konversi, InventoryBalance/StockMovement, domain dan engine checkout, intent/recovery, riwayat/struk, Dashboard, schema dan backlog. Kondisi aktual sebelum pekerjaan: schema v3, checkout CASH nyata, Dashboard nyata, 201 tes setelah UX satuan. Halaman Pelanggan & Bon masih menggunakan `demoCustomers` di state React dan tidak terkait Sale; tombol Bon dinonaktifkan. Tidak ada master pelanggan atau tagihan persisten.

| Bagian | Fitur yang diimplementasikan |
| --- | --- |
| 5.1 | Pelanggan UUID dengan nama wajib, telepon/alamat/catatan opsional, timestamp, tambah/edit/cari/detail, aktif/arsip dan optimistic guard edit |
| 5.2 | Bon / Bayar Nanti dari Kasir; wajib pelanggan aktif; preview stok/harga yang sama dengan CASH; Sale/Item/SALE/balance/tagihan/intent atomik; struk Bon dan recovery |
| 5.3 | Cicilan/pelunasan tunai per tagihan; nominal integer positif; batas saldo; UNPAID/PARTIAL/PAID; bukti immutable; intent/idempotency/rollback/concurrency; jurnal recovery |
| 5.4 | Pelanggan dan total utang nyata, tagihan semua status, filter/pencarian, jatuh tempo opsional, barang dan struk historis, daftar pembayaran dan pembukaan ulang bukti, loading/error/empty/retry |
| 5.5 | Tes migrasi, integrasi Bon/cicilan, recovery/controller/DOM, regresi CASH/inventory/riwayat/Dashboard, dokumentasi dan checklist manual |

Tidak ada API hapus permanen pelanggan, tagihan atau pembayaran. Arsip tidak menghapus histori dan tidak memindahkan piutang ke pelanggan lain. Nama/nomor telepon tidak menjadi identitas; nama sama diperbolehkan dengan UUID berbeda.

## 2. Arsitektur dan pembagian tanggung jawab

```text
Komponen React / hooks
  → CustomerService / CheckoutService / CreditService
    → interface repository di domain
      → adapter Dexie
        → IndexedDB lokal zanna-cell-db
```

Komponen tidak menulis Dexie langsung. Context Kasir menerima CustomerService agar pemilihan pelanggan memakai database yang sama dan bisa diinjeksi saat tes. State cart/controller tetap dipertahankan ketika berpindah halaman. Route Bon tidak menjalankan inisialisasi/subscription master produk yang tidak dibutuhkan.

| File/fungsi penting | Tanggung jawab |
| --- | --- |
| `domain/customer.ts`, `customerRules.ts` | Customer/Draft/Snapshot, kontrak repository, validasi teks/metadata/jatuh tempo dan identitas snapshot |
| `domain/credit.ts` | Receivable, CreditPayment, CreditPaymentIntent/Command/Result, status, error, kontrak CreditRepository dan read model |
| `domain/creditRules.ts` | `copyCreditPaymentCommand`, fingerprint, status, nomor bukti, `newReceivable`, `validateReceivableGraph` |
| `domain/checkout.ts`, `checkoutRequest.ts` | CASH v1 tetap; BON v2 dengan snapshot pelanggan/jatuh tempo; salinan immutable dan fingerprint canonical |
| `domain/checkoutRules.ts`, `sale.ts`, `saleRules.ts`, `checkoutIntegrity.ts` | Validasi tunai/Bon, snapshot dan kesesuaian intent; rumus harga/quantity tetap |
| `data/database.ts` | Deklarasi v1–v3 tetap, migrasi additive v4 dan indeks baru |
| `data/dexieCustomerRepository.ts` | Daftar/liveQuery dan simpan pelanggan; konflik timestamp ditolak, tanpa hard delete |
| `data/dexieCheckoutRepository.ts` | Commit CASH/Bon atomik, validasi pelanggan di dalam transaksi, satu tagihan per Sale dan pemeriksaan graph historis |
| `data/dexieCreditRepository.ts` | Overview/detail konsisten, prepare/execute/cancel, bukti/recovery, validasi saldo dan transaksi pembayaran atomik |
| `services/{customer,credit}Operations.ts` | Service aplikasi atas kontrak repository; input disalin dan divalidasi sebelum async boundary |
| `services/{customer,credit}Service.ts` | Composition root memakai singleton `localDatabase` |
| `features/cashier/BonCheckoutFields.tsx` | Pelanggan aktif, jatuh tempo dan konfirmasi Bon tanpa input uang |
| `features/cashier/{CashCheckoutDialog,checkoutController,SaleReceipt}.tsx/.ts` | Controller/jurnal checkout lama dipakai juga untuk Bon; struk membedakan utang awal dan pembayaran tunai |
| `features/credit/CreditPage.tsx` | Ringkasan, pelanggan, tagihan/filter, routing detail query dan koordinasi dialog |
| `features/credit/{CustomerForm,CustomerDialog,ReceivableDialog}.tsx` | Form/detail pelanggan, barang/struk/tagihan dan daftar pembayaran |
| `features/credit/{useCustomers,useCredit}.ts` | Subscription daftar/ringkasan; baca detail dengan guard respons setelah unmount; loading/error/retry |
| `features/credit/{paymentController,paymentRecovery}.ts` | Guard sinkron double-click, UUID stabil, jurnal durable sebelum write, recovery tanpa autoexecute |
| `features/credit/CreditPaymentDialog.tsx`, `creditLabels.ts` | Konfirmasi cicilan, nominal valid, pelunasan penuh, bukti historis dan label sederhana |
| `data/dexieSalesHistoryRepository.ts`, halaman riwayat/struk | Scope baca diperluas untuk graph Bon; snapshot tetap, tidak menulis stok |
| `features/dashboard/DashboardPage.tsx` | Omzet tunai + Bon dengan label yang benar; pembayaran piutang tidak dihitung sebagai penjualan baru |
| `app/{DemoProvider,demoContext,routes}.tsx/.ts`, layout/home/settings | Injeksi service, route dan informasi fitur nyata terkini |
| `scripts/credit*.test.*`, `bon-checkout.test.ts`, `credit-fixtures.ts` | Tes master/migration, Bon, pembayaran, controller/recovery dan DOM terisolasi |

Dialog simulasi pembayaran lama `features/cashier/PaymentDialog.tsx` yang tidak digunakan dihapus agar tidak menjadi jalur Bon fiktif. UI pelanggan lama diganti pembaca/writer service nyata. Mock untuk laporan yang masih DEMO tetap terpisah.

## 3. Database v4 dan kompatibilitas

Nama database tetap **zanna-cell-db**. Versi v4 menambah empat store sehingga total 13; tidak ada upgrade callback yang mengubah baris lama, reset, clear database, atau backfill saldo/tagihan.

| Store baru | Kunci/indeks utama |
| --- | --- |
| customers | id (UUID), name, updatedAt |
| receivables | id; unique saleId; unique checkoutOperationId; customerId, status, createdAt, customerId+createdAt, dueDate |
| creditPayments | id; unique operationId; unique receiptNumber; receivableId/customerId/saleId/createdAt, receivableId+createdAt |
| creditPaymentIntents | operationId; status, receivableId, createdAt; unique paymentId bila ada |

Indeks `sales.paymentMethod` ditambahkan untuk membaca penjualan Bon. Indeks unique lama tetap berlaku. IndexedDB tidak menyediakan foreign key SQL: validasi graph dan batas transaksi repository tetap wajib.

**Customer:** UUID stabil, teks nama/kontak/alamat/catatan, isActive, createdAt/updatedAt ISO UTC. Edit memakai expectedUpdatedAt; data tab lain tidak ditimpa diam-diam. Telepon disimpan sebagai string agar nol awal tetap ada. Tidak ada customer saldo yang dapat diedit manual.

**Sale Bon:** paymentMethod BON, total positif, cashReceived/changeAmount = 0, customerSnapshot dan dueDate. SaleItem/konversi/harga tetap snapshot. Sale CASH lama tidak ditambah field baru atau diubah. Nomor struk penjualan tetap format ZC lama.

**Receivable:** satu per Sale Bon, UUID sendiri, saleId/checkoutOperationId/customerId, snapshot pelanggan dan nomor struk, nilai awal, totalPaid/balance/status, createdAt/updatedAt dan jatuh tempo nullable. ID tagihan tidak bergantung urutan/ID lokal PostgreSQL.

**CreditPayment:** event pembayaran tunai immutable dengan operationId unik, amount, before/after, relasi tagihan/Sale/pelanggan, snapshot pelanggan saat pembelian, waktu, fingerprint dan nomor bukti ZCP. Tidak ada public update/delete pembayaran.

**PaymentIntent:** PREPARED/COMMITTED/CANCELLED dengan command/fingerprint. Intent bukan pembayaran uang dan tidak mengubah saldo. COMMITTED wajib menunjuk bukti pembayaran.

Command CASH tetap **payloadVersion 1** dengan representasi fingerprint lama persis. BON memakai **payloadVersion 2** sehingga customer/dueDate ikut terikat fingerprint tanpa merusak intent CASH lama. Jurnal checkout v1 dapat memuat command v1 atau v2; key lama dipertahankan.

Tes upgrade mencakup fixture v3 literal, kesamaan sembilan tabel lama, serta Sale CASH dan intent PREPARED v1 yang valid. Setelah upgrade, struk lama dapat dibaca, replay tetap duplicate, dan intent CASH lama dapat diselesaikan tanpa pelanggan/tagihan baru. Tes migrasi v1/v2 lama disesuaikan untuk versi target terbaru; assertion integritas datanya dipertahankan.

Tab dengan versi lama ditutup saat versionchange. Muat ulang tab tersebut untuk memakai versi baru; jangan menghapus site data jika upgrade menunggu koneksi/tab lama.

## 4. Alur checkout Bon

1. Buat pelanggan aktif melalui Pelanggan & Bon.
2. Susun keranjang dengan satuan/konversi yang sudah disetujui. Semua varian tetap berbagi InventoryBalance produk.
3. Pilih Bon, baca preview, pilih pelanggan aktif dan jatuh tempo opsional. Tidak ada input pembayaran tunai.
4. Konfirmasi membuat UUID checkout sekali dan command v2 immutable. Jurnal disimpan sebelum prepare/execute.
5. prepare menyimpan PREPARED, bukan Sale atau reservasi stok.
6. execute berada dalam satu transaksi **rw 13 store**: periksa replay, baca master dan stok terbaru, validasi expected harga/faktor/total, periksa pelanggan aktif serta snapshot/versinya.
7. Buat Sale COMPLETED, SaleItem, satu SALE movement per item, saldo stok akhir per produk, satu Receivable UNPAID dan intent COMMITTED.
8. Baca ulang graph tersimpan sebelum mengembalikan sukses. Kegagalan salah satu write meng-abort seluruh efek bisnis.
9. UI menampilkan struk Bon; hanya keranjang milik checkout itu yang dibersihkan. Struk dapat dibuka dari Kasir, Riwayat Penjualan, atau detail tagihan.

Status COMPLETED berarti barang sudah dijual, bukan utangnya sudah lunas. Struk Bon selalu menunjukkan **utang awal saat pembelian**; sisa terkini ada di tagihan. Mengedit master/pelanggan setelahnya tidak mengubah snapshot historis.

Tidak ada pembayaran awal/campuran saat Bon, bunga, diskon, QRIS, atau penjualan Bon Rp0. Total Bon wajib positif; barang gratis dengan total Rp0 tetap dapat memakai CASH sesuai aturan sebelumnya.

## 5. Alur cicilan dan pelunasan

1. Buka tagihan → baca barang, utang awal, sudah dibayar, Sisa Utang dan pembayaran sebelumnya.
2. Tekan Bayar Cicilan. Isi nominal positif atau Isi pelunasan penuh; periksa uang dan tagihan sebelum konfirmasi.
3. Buat satu operationId pembayaran; command berisi tagihan, amount, dan expectedBalance yang terlihat pengguna. Simpan jurnal durable terlebih dahulu.
4. prepare membekukan intent pembayaran. execute menjalankan transaksi **rw delapan store** yang diperlukan untuk memvalidasi graph. Tidak mencakup InventoryBalance atau master produk; tidak menulis ulang Sale/Item/ledger stok.
5. Periksa pembayaran lama sebelum saldo terkini. Retry sama mengembalikan bukti lama; isi berbeda dengan ID sama ditolak.
6. Baca dan periksa konsistensi tagihan terhadap Sale, semua pembayaran dan intent. Saldo harus sama dengan expectedBalance; nominal tidak boleh melampaui saldo.
7. Tambah CreditPayment, perbarui projection tagihan dan tulis intent COMMITTED dalam transaksi yang sama. Baca ulang hasil untuk memastikan yang dikembalikan memang tersimpan.
8. Tampilkan bukti. Daftar/ringkasan diperbarui melalui liveQuery. Detail tagihan dapat ditutup lalu dibuka ulang untuk membaca snapshot saldo terbaru.

Pelanggan yang diarsipkan tetap boleh membayar tagihan lama. Arsip hanya melarang Bon baru. Uang integer Rupiah, batas per transaksi/tagihan/pembayaran Rp1 miliar. Pembayaran harus tepat sebesar nominal yang dicatat, tanpa mekanisme kembalian pembayaran piutang.

## 6. Sumber kebenaran dan integritas saldo

**Utang awal berasal dari Sale.total. Pembayaran immutable adalah sumber pengurangnya.** Receivable.balance/totalPaid/status adalah projection yang disimpan agar UI mudah membaca, tetapi tidak dipercaya tanpa pemeriksaan:

```text
originalAmount = Sale.total
totalPaid      = jumlah seluruh CreditPayment.amount yang valid
balance        = originalAmount - totalPaid
status         = UNPAID jika belum dibayar
                 PARTIAL jika 0 < dibayar < total
                 PAID jika dibayar = total
```

`validateReceivableGraph` memeriksa relasi, snapshot, nominal, rantai before/after dan timestamp, fingerprint, unique identity, serta intent COMMITTED untuk setiap pembayaran. Intent COMMITTED tanpa bukti juga ditolak. updatedAt projection harus sama dengan peristiwa terakhir. Tagihan tanpa Sale, Sale Bon tanpa tagihan, atau CASH dengan tagihan menjadi error integritas.

Overview membandingkan penjualan Bon berindeks dengan daftar tagihan dan memeriksa pelanggan/graph. Pembaca tidak membuat koreksi otomatis. Korupsi tidak disamarkan sebagai saldo nol atau receipt parsial. Aggregate seluruh tagihan memakai BigInt lalu diperiksa terhadap safe integer, bukan dibatasi Rp1 miliar untuk total semua pelanggan.

## 7. Idempotency, concurrency, rollback dan recovery

- UUID operasi dibuat sekali di controller. Guard sinkron mencegah klik berulang sebelum React merender disabled. Unique index dan pemeriksaan fingerprint di transaksi menjadi pengaman terakhir.
- Scope rw yang bersinggungan menyerialkan koneksi/tab lokal. Dua Bon yang berebut stok tidak dapat oversell. Dua cicilan dengan expectedBalance sama hanya salah satunya dapat commit; yang kedua mendapat BALANCE_CHANGED dan harus ditinjau ulang, walaupun nominal gabungan mungkin masih muat.
- Pengembalian hasil lama terjadi sebelum pemeriksaan master/saldo terbaru, sehingga replay setelah pelanggan diarsip/utang kemudian dilunasi tetap mengembalikan bukti historis yang sama tanpa write kedua.
- Error pada tagihan/item/ledger/saldo/intent checkout atau pada bukti/projection/intent pembayaran membatalkan seluruh transaksi terkait. Intent PREPARED sebelumnya tetap ada untuk recovery.
- Jurnal pembayaran memakai `zanna-cell.credit-payment.v1.<operationId>` di localStorage, satu key per operasi agar tidak menimpa jurnal tab lain. IndexedDB tetap otoritas, bukan localStorage.
- Saat halaman Bon dibuka, gabungkan jurnal dengan intent PREPARED persisten. **Tidak autoexecute.** Tombol Pulihkan memeriksa hasil dengan ID lama. Operasi belum selesai mengunci cicilan baru sampai diperiksa/diselesaikan/dibatalkan.
- Jika hasil belum pasti, modal tetap terbuka, tidak menerima uang lagi, tidak membuat UUID pengganti. Periksa hasil dahulu, lalu lanjutkan request identik jika belum tercatat. Jika write jurnal gagal, tidak prepare/execute.
- Cancel pembayaran/checkout diserialkan dengan execute. Cancel committed mengembalikan bukti, bukan undo uang/stok. Cancel pembayaran sebelum prepare juga membuat tombstone CANCELLED sehingga late retry tidak hidup kembali.
- Jurnal yang gagal dibersihkan setelah sukses masih menunjuk pembayaran yang sama; refresh dapat membuka bukti lama tanpa efek keuangan kedua. Bukti juga dapat dibuka melalui riwayat tagihan meskipun jurnal sudah bersih.

Ini pengaman satu origin/perangkat, bukan sinkronisasi/server atau jaminan terhadap kerusakan fisik media dan manipulasi DevTools.

## 8. Omzet, penerimaan kas dan total piutang

| Istilah | Definisi |
| --- | --- |
| Omzet | Sum Sale.total COMPLETED CASH + BON; bukan laba |
| Penerimaan kas | Sum nilai penjualan CASH + pembayaran piutang tunai; untuk CASH nilai bersih = cashReceived − changeAmount = Sale.total |
| Total Utang / piutang | Sum sisa semua tagihan Bon yang tervalidasi, termasuk pelanggan diarsipkan |

Contoh tes: Bon Rp19.500 dan penjualan CASH Rp13.000 menghasilkan omzet **Rp32.500**. Cicilan Rp5.000 membuat sisa Bon **Rp14.500**, penerimaan kas **Rp18.000**, tetapi omzet tetap **Rp32.500**. Setelah Bon lunas, piutang nol dan omzet tetap sama. Pembayaran piutang bukan Sale baru.

Dashboard membaca Sale/Item, sehingga CASH + BON dihitung sekali. Label diperbarui; Dashboard belum menampilkan metrik penerimaan kas. Tidak mengganti label omzet untuk angka kas. Pelanggan & Bon menampilkan total piutang; halaman Laporan tetap DEMO.

## 9. Pengujian dan audit integrasi

Rangkaian yang diaudit: Produk → Stok → Keranjang → Preview → Checkout Bon → Sale/Item → SALE ledger → InventoryBalance → Piutang → Cicilan → Pelunasan → Bukti/Struk → Riwayat → Dashboard.

| Area | Bukti otomatis |
| --- | --- |
| Pelanggan | Tambah/edit/reopen, kontak opsional, arsip/aktif kembali, nama sama dengan UUID berbeda, konflik edit |
| Migrasi | v3 literal sembilan store tetap, unique index, empat store baru kosong; committed/PREPARED CASH v1 valid tetap dapat dibaca/retry; regresi v1/v2 tetap |
| Bon | Pelanggan aktif wajib, perubahan pelanggan/harga/faktor, stok tidak cukup, dua varian stok bersama, dua checkout berebut stok |
| Atomic checkout | Fault injection tagihan/item/movement/balance/intent, perbandingan seluruh tabel sebelum/sesudah |
| Retry/recovery checkout | Eksekusi paralel satu ID, reopen PREPARED/committed, cancel, fingerprint CASH lama dan Bon baru, DOM command v2 setelah refresh |
| Cicilan | Sebagian/penuh, semua status, nol/negatif/pecahan/NaN/Infinity/berlebih ditolak, expectedBalance, dua koneksi bersamaan |
| Atomic payment | Fault pada bukti/projection/intent, retry sama/payload berbeda, tidak menyentuh stok/Sale/Item/intent checkout |
| Historis/integritas | Nama pelanggan arsip/edit tetap snapshot, before/after dan total konsisten, corrupt saldo/pembayaran/intent diblokir tanpa repair |
| UI/recovery pembayaran | Double-click, response-lost, refresh, jurnal gagal/rusak, cancel sebelum prepare, receipt reopen, direct link invalid sebagai error |
| Riwayat/ringkasan | Beberapa pelanggan termasuk arsip, UNPAID/PARTIAL/PAID, filter/detail, read-only seluruh tabel |
| Dashboard | CASH + BON, pelunasan bukan omzet kedua, jumlah transaksi tetap, saldo stok tetap saat pembayaran |
| Responsivitas struktural | DOM Kasir tablet dan route Bon pada 390/768/1024/1366; tidak mengklaim uji visual/native |

Hasil verifikasi akhir (selesai 23 Oktober 2026):

| Perintah | Hasil aktual |
| --- | --- |
| `npm run lint` | Lulus, exit 0, tidak ada error/warning ESLint |
| `npm run typecheck` | Lulus, exit 0: aplikasi, konfigurasi Node/Vite dan seluruh tes |
| `npm test` | **260 lulus, 0 gagal, 0 skipped/cancelled** |
| `npm run test:credit` | **59 lulus, 0 gagal** |
| `npm run test:inventory` | **24 lulus, 0 gagal** |
| `npm run build` | Lulus, exit 0; Vite 8.3.4, 2055 modules |
| `git diff --check` | Tidak ada error whitespace |

Baseline 201 + 59 tes baru = **260 tes unik**. Suite khusus adalah subset suite penuh dan tidak dijumlah ulang. Rincian baru: 7 master/migrasi, 17 checkout Bon, 21 pembayaran/integrasi, 6 controller/recovery, 8 DOM. Tidak ada penghapusan assertion finansial baseline untuk membuat tes lulus; target versi schema disesuaikan ke v4 dan tes tombol Bon lama diganti sesuai perilaku Bon nyata, sementara QRIS tetap disabled.

Build: JS **606,28 kB** (gzip **179,24 kB**), CSS **39,67 kB** (gzip **8,51 kB**). Warning chunk >500 kB tetap terlihat, tidak disembunyikan atau dioptimalkan di luar scope. Suite khusus Bon terakhir tidak mencetak diagnostic act/FormData; suite penuh masih sesekali mencetak warning React act dari harness DemoProvider lama, dengan seluruh assertion dan exit tetap lulus. TypeError FormData lama tidak muncul. Tindak lanjut harness nonkritis ada di backlog.

Semua DB tes memakai fake-indexeddb bernama tes acak pada proses terisolasi. Cleanup tes tidak menghapus IndexedDB browser pengguna. Tidak ada pengujian manual browser/tablet oleh agen.

## 10. Perbaikan dan temuan audit

- Halaman Bon fiktif, dialog cicilan state-only, serta metode Bon nonaktif diganti jalur persistensi nyata yang sama dengan checkout tunai.
- Pemisahan versi command dan fingerprint CASH lama mencegah intent/recovery lama menjadi tidak terbaca setelah penambahan pelanggan Bon.
- Scope baca struk/riwayat diperluas agar validasi graph tagihan/pembayaran tidak menimbulkan subtransaction di luar scope.
- Omzet/Dashboard/struk tidak menganggap semua Sale tunai atau mengartikan COMPLETED sebagai utang lunas.
- Pembayaran memeriksa saldo dari event dan projection, bukan mengurangi angka UI; pembayaran lama/cancel mempunyai hasil idempoten.
- Direct link tagihan tidak valid ditangani sebagai error Promise, bukan exception sinkron yang meruntuhkan effect/halaman.
- Harness riwayat menggunakan FormData jsdom agar tidak mencetak exception FormData Node. Assertion baseline tetap dipertahankan.
- Kesalahan skrip penggantian teks saat pengerjaan dipulihkan pada file terdampak saja sebelum pemeriksaan berikutnya; diff diperiksa ulang. Tidak ada perbaikan dengan reset database atau penghapusan histori pengguna.

## 11. Panduan pengguna awam

1. Buka **Pelanggan & Bon → Tambah pelanggan**. Isi nama dan kontak yang diperlukan. Simpan. Gunakan pencarian, Detail pelanggan, lalu Edit / arsipkan pelanggan untuk perubahan; arsip mempertahankan utang dan histori.
2. Di Kasir, masukkan barang dengan jumlah/kemasan benar. Pilih **Bon**, lalu **Catat Bon**. Pilih pelanggan aktif dan jatuh tempo bila diperlukan. Periksa total, lalu **Konfirmasi Bon / Bayar Nanti**.
3. Struk Bon menunjukkan utang awal. Jangan menganggap barang sudah dibayar karena status penjualannya COMPLETED. Tidak ada uang yang dicatat saat checkout ini.
4. Saat pelanggan membayar, buka tagihan pada Pelanggan & Bon. Pilih **Bayar Cicilan**, masukkan uang tepat yang diterima, atau **Isi pelunasan penuh**. Pastikan benar, kemudian konfirmasi sekali.
5. Baca bukti tersimpan. **Sisa setelah pembayaran ini** adalah saldo historis saat pembayaran itu, bukan saldo terkini setelah pembayaran lain. Sisa terkini ada pada tagihan.
6. Buka lagi tagihan untuk Riwayat pembayaran → **Buka bukti pembayaran**. Struk pembelian historis juga ada di detail tagihan dan Riwayat Penjualan.
7. Jika proses terputus, gunakan **Pulihkan pembayaran** atau pemulihan intent checkout. **Periksa hasil** dahulu. Jangan menerima uang lagi, membuat transaksi pengganti, atau menghapus data browser ketika status belum pasti.
8. Jika saldo/harga/pelanggan berubah, batalkan intent yang belum commit, baca ulang data, lalu konfirmasi sesuai nilai terbaru. Pembatalan intent bukan pembatalan penjualan/pembayaran yang sudah berhasil.

Mulai proyek dengan `cd C:\04-Project-TOKO\POS-Zanna\frontend` lalu `npm run dev`. Gunakan origin/profil browser yang sama agar membaca database operasional yang sama. Panduan kemasan tetap di [USER-GUIDE-PRODUCT-UNITS.md](USER-GUIDE-PRODUCT-UNITS.md).

## 12. Checklist validasi manual pengguna

- [ ] Gunakan origin lama, pastikan master/saldo/struk/intent CASH tetap ada setelah upgrade. Muat ulang tab versi lama bila perlu; jangan clear data.
- [ ] Tambah/edit/cari/detail pelanggan. Arsip pelanggan yang mempunyai Bon; histori dan Total Utang tetap, pelanggan tidak tersedia untuk Bon baru, pelunasan lama tetap bisa.
- [ ] Checkout Bon pada data uji yang memang diizinkan: mi per Bungkus/Dus, bensin Botol/Jeriken berbagi stok, Solar/Liter dan beras/Kilogram variable. Cocokkan harga, total, pengurangan stok, tagihan dan nomor struk.
- [ ] Pilihan pelanggan wajib, tidak ada input uang checkout Bon, QRIS tetap disabled. Periksa Bon Rp0 tidak tersedia.
- [ ] Buat cicilan dan pelunasan di data uji; cocokkan Total Utang, saldo/status, riwayat dan bukti. Angka nol/negatif/berlebih tidak dapat dikonfirmasi.
- [ ] Dashboard menambah omzet satu kali saat Bon, tanpa bertambah lagi saat cicilan/pelunasan. Riwayat membedakan CASH/Bon; struk lama tidak mengambil nama/harga master terbaru.
- [ ] Dalam skenario refresh terkontrol yang wajar, gunakan recovery ID lama; tidak ada penjualan/tagihan/pembayaran ganda. Jangan memakai uang operasional atau merusak DB untuk fault injection.
- [ ] Buka ulang bukti dan struk dari data tersimpan. Reading/navigasi tidak mengubah stok.
- [ ] Periksa pencarian nama/telepon/struk, pelanggan aktif/arsip, filter pelanggan/status tagihan, empty/loading/error/retry dan direct link `/bon?tagihan=<id>`.
- [ ] Uji 390×844, tablet 768×1024/1024×768 dan desktop 1366×768: drawer Kasir, Menu, scroll dialog panjang, tombol, fokus Tab/Escape, kontras dan keyboard Android angka/tanggal.
- [ ] Jangan menandai checklist native lulus berdasarkan tes DOM. Pengujian power loss/eviction/media rusak tidak disimulasikan sebagai jaminan durability fisik.

## 13. Risiko dan backlog

IndexedDB/localStorage belum backup permanen; clear site data, eviction, mode privat, kerusakan perangkat atau origin berbeda dapat menghilangkan/menyembunyikan data. Tidak ada backend, waktu server, autentikasi owner atau proteksi terhadap DevTools. Informasi pelanggan tersimpan lokal tanpa enkripsi aplikasi. Jangan menyamakan Git dengan backup database browser.

Overview Bon memeriksa seluruh tagihan beserta graph, daftar pelanggan/tagihan belum dipaginasi, dan pembayaran memakai scope transaksi baca/validasi yang luas. Utamakan integritas; ukur performa pada data realistis sebelum optimasi. Detail tagihan adalah pembacaan on-demand; tutup/buka ulang untuk pembaruan dari tab lain. Jatuh tempo hanya informasi kalender, tanpa bunga/denda/notifikasi otomatis.

Pembayaran dicatat per tagihan, tanpa pembayaran gabungan, uang muka saat checkout, retur/refund, penghapusan piutang, atau edit/hapus pembayaran salah. Wajib memeriksa konfirmasi sebelum menerima/mencatat uang. Fitur koreksi membutuhkan kebijakan/fase terpisah.

Bundle masih dapat memperingatkan >500 kB; tidak dioptimalkan atau threshold disembunyikan pada fase ini. Pengujian native pengguna masih pending. Lihat [PROJECT-BACKLOG.md](PROJECT-BACKLOG.md).

## 14. Materi pembelajaran setelah website selesai

Baca berurutan: customer.ts → credit.ts → checkoutRequest.ts → dexieCheckoutRepository.commit → creditRules.validateReceivableGraph → dexieCreditRepository.execute → paymentController → CreditPage/ReceivableDialog.

- **UUID versus nama:** dua pelanggan bernama Sari tetap berbeda. Catatan pelanggan bukan saldo piutang. Snapshot mengabadikan nama saat pembelian, sementara master bisa diedit.
- **Sale versus tagihan versus pembayaran:** Sale adalah peristiwa barang dijual, tagihan adalah hak menagih/projection saldo, pembayaran adalah event penerimaan uang. Mencampur ketiganya membuat omzet atau stok tercatat dua kali.
- **Atomicity:** `.transaction('rw', ...)` menjamin seluruh event/projection/intent commit atau semuanya rollback. Jangan menangkap error write di dalam transaksi lalu tetap mengembalikan sukses.
- **Idempotency:** operationId yang sama + fingerprint sama mengembalikan bukti lama. ID sama dengan isi berbeda ditolak. Tombstone CANCELLED menahan retry terlambat.
- **Concurrency:** disabled button hanya UX. Repository membaca saldo terbaru di dalam transaksi dan memeriksa expectedBalance untuk mencegah dua tab sama-sama membayar saldo lama.
- **Projection:** balance cepat dibaca tetapi tetap diperiksa terhadap event historis. Kerusakan dilaporkan, tidak diperbaiki otomatis dari angka UI.
- **Promise/effect:** service mengembalikan penolakan Promise untuk URL salah; hook membersihkan respons setelah unmount. localStorage hanya jurnal, bukan otoritas pembayaran.

Contoh baca tanpa write:

```ts
const overview = await creditService.overview()
console.log(overview.totalOutstanding)
if (overview.receivables[0]) {
  const detail = await creditService.detail(overview.receivables[0].id)
  console.log(detail.receivable.status, detail.payments.length)
}
```

Latihan menggunakan fixture tes, bukan memanipulasi database operasional:

1. Pada tes cicilan, hitung manual Rp19.500 − Rp5.000 − Rp14.500. Jelaskan tiga status dan bandingkan bukti pertama dengan saldo terkini.
2. Telusuri satu operationId pada jurnal, intent dan bukti; jalankan retry dan ubah nominal dengan ID sama. Jelaskan mengapa yang kedua ditolak.
3. Baca tes rollback dan pembayaran paralel. Sebutkan tabel yang boleh berubah pada pembayaran, lalu buktikan InventoryBalance/StockMovement/Sale tetap sama.
4. Baca tes migrasi v3 dan jelaskan mengapa menambahkan customer ke fingerprint CASH lama akan merusak recovery.
5. Hitung contoh omzet/kas/piutang pada bagian 8 dan temukan query Dashboard yang hanya membaca Sale, bukan menjumlah pembayaran.

## 15. Batas selesai dan kesiapan Fase 6

**Fase 5.1–5.5 selesai secara teknis berdasarkan seluruh pemeriksaan otomatis di bagian 9. Tidak ada bug kritis transaksi/piutang yang diketahui tersisa dari cakupan audit tersebut.** Penutupan validasi pengguna dan kesiapan memulai Fase 6 menunggu hasil checklist manual; pekerjaan Fase 6 belum dimulai.

Tidak ada backend Spring Boot/PostgreSQL, sinkronisasi, backup otomatis, QRIS nyata, retur/refund, PWA atau printer fisik. Setelah validasi manual berhasil, lakukan commit dan push GitHub sendiri. Agen berhenti dan menunggu evaluasi.
