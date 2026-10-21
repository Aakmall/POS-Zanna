# Laporan Fase 3 — Zanna-Cell

Implementasi lokal selesai. Hasil otomatis di bawah dijalankan pada 20 Oktober 2026. Pengujian manual browser/tablet belum dilakukan oleh agen dan menunggu evaluasi pengguna.

**Catatan versi:** laporan ini adalah baseline Fase 3 sebelum hardening. Perbaikan policy satuan/kemasan, dampak data legacy, dan hasil pemeriksaan terbaru tanggal 21 Oktober 2026 ada di [Business Logic Hardening](PHASE-3-BUSINESS-HARDENING.md).

## 1. Ringkasan hasil

Persediaan lokal menggantikan halaman stok konfigurasi lama: saldo per produk, empat jenis mutasi, ledger, konversi, status, dan integrasi Produk/Kasir. Semua mutasi memakai transaksi atomik dan identitas operasi. Checkout tetap DEMO.

## 2. Audit awal

Repository tunggal di `C:/04-Project-TOKO/POS-Zanna`; branch `master`, HEAD awal `d1e02d9`. Working tree dan staging awal bersih. Tidak dibuat repository/branch baru. React 19, TypeScript 6, Vite 8, Tailwind 4, Dexie 4.4.6. Skema awal v1 empat tabel. Kuantitas/faktor/minimum sudah berskala 1000 dan dipertahankan. Satuan dasar sudah dikunci pada produk tersimpan. Baseline lint, TypeScript aplikasi, build, dan 19 tes lulus.

## 3. Fitur berfungsi

- Stok awal sekali per produk, termasuk nilai nol; belum diatur tetap berbeda dengan habis.
- Stok masuk positif, koreksi masuk/keluar dengan alasan wajib, konfirmasi keluar, dan penolakan stok negatif.
- Pratinjau satuan/faktor serta saldo sebelum/sesudah; konversi dasar, metrik, varian, dan kemasan manual.
- Ringkasan aktual, pencarian nama, filter kategori/status, minimum stok nullable.
- Riwayat dengan nama/satuan/faktor historis, alasan, waktu, serta identitas operasi; tanpa edit/hapus melalui UI.
- Loading/error/empty/success feedback dan retry dengan operationId yang sama.
- Saldo dan status di Produk/detail/Kasir; batas keranjang mempertimbangkan seluruh varian dari produk yang sama.

## 4. Database sebelum/sesudah

| Versi aplikasi | Tabel |
| --- | --- |
| 1 | products, categories, units, variants |
| 2 | Semua tabel v1 + inventoryBalances + stockMovements |

Nama database tetap `zanna-cell-db`. Identitas, barcode, konfigurasi, harga, dan makna kuantitas lama tidak ditulis ulang.

## 5. Migrasi Dexie

`src/data/database.ts` mempertahankan deklarasi v1 lalu menambahkan version(2).stores untuk dua tabel baru. Tidak ada reset, clear, penghapusan database pengguna, atau saldo nol otomatis. Integration test membuat fixture v1 di fake-indexeddb dan memastikan seluruh master tetap sama setelah dibuka melalui kelas v2. Error membuka/upgrade ditampilkan oleh provider; tidak diselesaikan dengan menghapus data. Tab versi lama perlu dimuat ulang jika koneksinya ditutup saat versionchange.

## 6. Struktur domain

`InventoryBalance` menyimpan productId (primary key), quantityBase, initializedAt, updatedAt. Ketiadaan baris berarti NOT_INITIALIZED.

`StockMovement` menyimpan id, operationId unik, productId, snapshot productName, movementType, delta/before/after dalam base unit, inputQuantity, conversionSnapshot, reason, createdBy null, createdAt, serta requestFingerprint. Kontrak `InventoryRepository` menyediakan baca, subscribe, dan apply; tidak menyediakan edit/hapus ledger. Penjelasan field lengkap di [model inventory](INVENTORY-DATA-MODEL.md).

## 7. Strategi satuan

Skala tetap 1000 per satuan dasar. `parseQuantity` menerima maksimal tiga desimal. Perkalian fixed-point memakai BigInt sementara, hasil harus tepat dan kembali menjadi integer Number aman. Count/kemasan wajib bulat; hasil base diskret juga harus bulat. Harga tidak terlibat dalam perhitungan stok.

Konversi kg/gram dan L/ml mengikuti dimensi. Isi dus atau jeriken wajib konfigurasi varian atau masukan eksplisit. Produk lama berdasar Liter tetap Liter, bukan diam-diam diubah menjadi ml. Bensin berbagi saldo antara varian 1/1,5/5 L. Solar menerima volume aktual dan isi jeriken berbeda; Rp13.000/L hanya sample harga master yang bisa diedit pemilik. Snapshot ledger mempertahankan faktor lama setelah varian diedit.

## 8. Atomic transaction

Repository melakukan baca saldo/master → validasi/konversi → hitung → tulis balance → tambah movement dalam satu transaksi read/write dengan scope tabel yang sesuai. Error membatalkan semuanya. Tidak ada operasi network di dalam transaksi. Transaksi dengan scope bertumpang tindih menyerialkan operasi lokal sehingga tidak lost update atau negatif akibat dua koneksi. Guard saldo/faktor mencegah hasil konfirmasi berubah diam-diam sebelum commit.

## 9. Pencegahan duplikasi

Form membuat UUID untuk satu intent. Retry memakai perintah lama; edit isian membuat UUID baru. Repository memeriksa operationId dalam transaksi dan membandingkan fingerprint isi. Request identik mengembalikan movement lama tanpa menulis; ID sama dengan isi berbeda ditolak. Unique index menjadi pengaman tambahan. Tombol disabled bukan satu-satunya perlindungan. Fingerprint bukan tanda tangan keamanan.

## 10. Integrasi halaman

`DemoProvider` mengobservasi master dan balances dari satu database. `useInventory` menyusun data halaman; `useStockHistory` mengobservasi riwayat. Produk/detail memakai `ProductStock`. Kasir memproyeksikan stok kemasan dengan floor(saldo/faktor), membawa saldo dasar, dan menjumlahkan kebutuhan semua varian di keranjang. Status fisik tidak disamakan dengan jumlah kemasan hasil floor. Produk belum diatur/habis tidak dapat ditambahkan. Drawer dan state keranjang tunggal dipertahankan. Menambah keranjang atau menjalankan pembayaran DEMO tidak menulis saldo/ledger.

## 11. File dibuat/diubah

Path berikut relatif terhadap `frontend/`. Tanggung jawab setiap file penting dan hubungan fungsi dijelaskan pada [panduan belajar](PHASE-3-INVENTORY-LEARNING.md).

### Baru — 18 file

```text
docs/INVENTORY-DATA-MODEL.md
docs/PHASE-3-INVENTORY-LEARNING.md
docs/PHASE-3-REPORT.md
scripts/inventory.test.ts
scripts/stock-ui.test.tsx
src/components/ui/ProductStock.tsx
src/components/ui/StockBadge.tsx
src/data/dexieInventoryRepository.ts
src/data/localDatabase.ts
src/domain/inventory.ts
src/domain/inventoryRules.ts
src/features/stock/StockHistory.tsx
src/features/stock/StockMovementForm.tsx
src/hooks/useInventory.ts
src/hooks/useStockHistory.ts
src/services/inventoryInputs.ts
src/services/inventoryOperations.ts
src/services/inventoryService.ts
```

### Diubah — 27 file

```text
README.md
docs/PHASE-2-LEARNING.md
docs/PRODUCT-DATA-MODEL.md
package.json
scripts/cart-ui.test.tsx
src/app/DemoProvider.tsx
src/app/demoContext.ts
src/components/layout/AppLayout.tsx
src/components/layout/OperationalLayout.tsx
src/data/database.ts
src/data/demoSeed.ts
src/domain/validation.ts
src/features/cashier/CartPanel.tsx
src/features/cashier/CashierPage.tsx
src/features/cashier/PaymentDialog.tsx
src/features/cashier/ProductCard.tsx
src/features/cashier/cartLogic.ts
src/features/cashier/useCart.ts
src/features/dashboard/DashboardPage.tsx
src/features/home/HomePage.tsx
src/features/products/ProductDetails.tsx
src/features/products/ProductsPage.tsx
src/features/settings/SettingsPage.tsx
src/features/stock/StockPage.tsx
src/services/catalogRepository.ts
src/services/productRepository.ts
src/types/pos.ts
```

`dist/` dihasilkan melalui build dan diabaikan Git. Root `.gitignore` tidak diubah. Tidak ada file backend yang disentuh.

## 12. Dependency

Tidak ada package/dependency baru atau perubahan lockfile. Menggunakan Dexie, Node test runner, tsx, fake-indexeddb, dan jsdom yang sudah ada. package.json menambahkan scripts test:inventory/test:unit dan memasukkan dua suite baru pada npm test.

## 13. Git status

Branch tetap `master`. Perubahan Fase 3 berada di working tree: 27 modified dan 18 untracked; staging kosong. Tidak ada commit, push, reset, penghapusan file tracked, atau destructive Git command. Data IndexedDB pengguna bukan bagian repository dan tidak dapat dipulihkan lewat Git.

## 14. ESLint

`npm run lint` lulus, exit 0, tanpa error/warning ESLint.

## 15. TypeScript

`npx tsc --noEmit -p tsconfig.app.json` lulus. `npm run typecheck` juga lulus untuk tsconfig.app, tsconfig.node, dan tsconfig.tests. Tidak ada pelonggaran strict atau any baru untuk menghindari error.

## 16. Automated tests

`npm test`: **36 berhasil, 0 gagal, 0 skipped**. Meliputi logika DEMO, CRUD master, keunikan barcode/SKU, inventory, migrasi v1→v2, rollback, dua koneksi bersamaan, deduplikasi, snapshot, reopen, batas stok bersama, DOM form Stok, dan akses keranjang pada empat lebar.

Transparansi: putaran awal Fase 3 sempat 34/35 lulus; satu tes gagal karena validasi service dilempar sinkron sebelum promise. `execute` dibuat async untuk kontrak error konsisten. Setelah perbaikan dan penambahan tes DOM form, seluruh 36 lulus. Runner sempat terhalang pembatasan OS sandbox; eksekusi lokal yang diizinkan kemudian menyelesaikan semua tes. Database tes adalah fake-indexeddb terisolasi; cleanup tes tidak menyentuh database browser pengguna.

## 17. Production build

`npm run build` lulus (TypeScript build + Vite). Output JS 499,77 kB (gzip 151,97 kB), CSS 38,10 kB (gzip 8,29 kB). Tidak ada warning build. Bundle saat ini masih satu chunk utama; pemisahan rute dapat dipertimbangkan jika ukuran bertambah. Build bukan bukti pengujian visual.

## 18. Risiko, keterbatasan, TODO

- Belum diuji visual/manual pada browser atau tablet Android; evaluasi pengguna masih diperlukan.
- IndexedDB dapat terhapus/evicted, bukan backup permanen. Backup/restore belum tersedia.
- Tidak ada autentikasi owner tepercaya atau ledger anti-manipulasi terhadap akses DevTools.
- PWA/service worker belum dibuat. Operasi lokal tidak butuh API/internet ketika frontend tersedia; cold start/reload tanpa server/aset belum dijamin.
- Riwayat ditampilkan per 50 baris, tetapi subscription membaca seluruh riwayat satu produk. Query/pagination skala besar belum menjadi kebutuhan fase ini.
- Tidak ada reservasi keranjang; stok diperiksa ulang jika berubah. Penjualan volume variabel, SALE/RETURN, checkout sungguhan, backend, sinkronisasi, printer/scanner, dan deployment belum dibuat sesuai batas fase.
- Timestamp memakai jam perangkat, bukan jam server tepercaya. Data legacy pecahan diskret tidak diubah otomatis; konfigurasi tersebut perlu ditinjau pengguna sebelum digunakan.

## 19. Dokumentasi pembelajaran

[PHASE-3-INVENTORY-LEARNING.md](PHASE-3-INVENTORY-LEARNING.md) memuat 20 konsep, pengertian/masalah/contoh/kode/risiko, peta file, interface/class, parameter/return, potongan kode nyata, alur sukses/gagal, perintah Git/test, DevTools, dan lima latihan. [INVENTORY-DATA-MODEL.md](INVENTORY-DATA-MODEL.md) memuat kontrak data dan keputusan arsitektur. README diperbarui; dokumen Fase 2 ditandai sebagai catatan historis.

## 20. Checklist manual — belum dinyatakan lulus

- [ ] Data produk/kategori/satuan/varian/barcode Fase 2 tetap tersedia setelah upgrade.
- [ ] Produk baru Belum diatur; stok awal 0/30 berhasil dan tidak dapat dibuat dua kali.
- [ ] Tambah 10 menghasilkan 40; koreksi keluar 2 dengan alasan/konfirmasi menghasilkan 38; koreksi masuk juga bekerja.
- [ ] Nol/negatif tidak sah, alasan kosong, dan keluar berlebihan ditolak tanpa saldo/ledger parsial.
- [ ] Riwayat bertambah; faktor historis tetap benar setelah edit varian.
- [ ] Dua dus isi 40 = 80; kg/gram serta bensin 50 L − 1,5 L = 48,5 L benar.
- [ ] Solar menerima volume aktual dan jeriken berisi manual tanpa kapasitas rekaan.
- [ ] Minimum null, rendah, habis, tersedia, dan belum diatur sesuai.
- [ ] Refresh/tutup-buka pada origin sama mempertahankan master, saldo dan ledger.
- [ ] Kasir membaca stok bersama; tambah item/pembayaran DEMO tidak mengurangi saldo.
- [ ] Keranjang & Bayar dapat diakses pada 390×844, 768×1024, 1024×768, dan 1366×768; scroll, fokus, keyboard Android dan safe-area nyaman.
- [ ] Tidak ada error Console browser.

## 21. Ringkasan konsep

Balance menjawab “berapa tersedia sekarang”; movement menjawab “apa yang mengubahnya”; ledger menyusun jejak mutasi. Base unit/fixed-point menyamakan aritmetika; snapshot menjaga arti masa lalu. Atomicity menjaga dua tabel tetap konsisten; idempotency menjaga satu intent tidak terhitung dua kali; concurrency menjaga operasi berbeda tidak saling menimpa. Repository/service memisahkan penyimpanan dari UI. Migrasi additive menjaga data lama.

## 22. Persiapan teknis Fase 4 — belum diimplementasikan

Domain dan repository dapat diperluas secara eksplisit untuk penjualan, SALE, pembatalan/retur, dan transaksi atomik yang menggabungkan penjualan dengan ledger. Perlu aturan harga-volume, idempotency checkout, serta pengujian kegagalan transaksi. UUID, operationId, timestamp, snapshot, dan repository menjadi fondasi; belum ada fitur checkout nyata.

Spring Boot REST API, PostgreSQL, push/pull, retry, conflict handling, dan reconciliation tetap rencana fase khusus setelah backend tersedia. Browser tidak mengakses PostgreSQL langsung. **Pekerjaan berhenti pada Fase 3 dan menunggu evaluasi pengguna.**
