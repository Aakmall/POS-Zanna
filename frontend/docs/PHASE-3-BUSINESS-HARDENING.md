# Fase 3 — Hardening satuan dan kemasan

Tanggal: 21 Oktober 2026. Hanya perbaikan domain produk/inventory lokal. Tidak ada checkout nyata, backend, PostgreSQL, sinkronisasi, reset database, commit, atau push.

## 1. Audit dan akar penyebab

Audit mencakup Product/ProductVariant/Unit, quantityInBaseUnit, parser kuantitas, form produk/varian, form mutasi, service/repository, skema Dexie, proyeksi Kasir, dan conversionSnapshot/ledger. Sebelum hardening:

1. `sachet` adalah satuan referensi global di `src/data/units.ts`: dimension count, isPackaging true. Bukan nama varian atau label Solar yang salah dipetakan.
2. `inventoryInputOptions` menawarkan **semua** kemasan global sebagai “isi manual” serta semua varian aktif tanpa pemeriksaan semantik produk.
3. `resolveConversion` menerima faktor positif untuk kemasan mana pun; belum memeriksa apakah kemasan diizinkan bagi produk.
4. `validateConversion` mengizinkan kemasan lintas dimensi melalui isPackaging. Ini diperlukan untuk botol→liter/sachet→gram, tetapi belum dilengkapi aturan bisnis per produk.
5. VariantFields menawarkan semua unit, Product belum punya kebijakan kemasan, dan projectCatalog belum menyaring varian yang tidak sesuai secara bisnis.

Akibatnya 10 Sachet × isi 12 Liter = 120 Liter dapat disimpan. Mengganti label saja tidak menyelesaikan penyebab. Dua jalur lama memungkinkan kasus itu: kemasan manual dan varian berkemasan Sachet.

Agen tidak membaca IndexedDB browser pengguna. Jalur persis catatan Solar Anda dapat diperiksa lewat Detail audit → `conversionSnapshot.source`: custom berarti isi manual; variant berarti konfigurasi varian. Snapshot tidak diubah untuk menyembunyikan masalah.

Working tree awal sudah berisi implementasi Fase 3 belum di-commit; semuanya dipertahankan. Laporan tanggal 20 Oktober merupakan baseline sebelum hardening ini.

## 2. Unit ukur, packaging, dimensi, dan aturan bisnis

**Unit of measure** adalah ukuran baku: kg/gram untuk MASS dan liter/ml untuk VOLUME. Union `UnitDimension` bernilai count/mass/volume. Dimensi stok mengikuti satuan dasar: mi per Bungkus => COUNT, beras per Kg/Gram => MASS, BBM per Liter/ml => VOLUME.

**Packaging** adalah wadah/bentuk. Jeriken tidak selalu 20 L, dus tidak selalu 40 bungkus. Botol/Jeriken/Sachet memakai dimension count untuk menghitung wadah, tetapi isi wadah bisa dipetakan ke stok mass/volume melalui faktor eksplisit.

**Dimension validation** memastikan ukuran dan angka kompatibel: kg→gram baku; kg→liter ditolak; kemasan harus bulat; faktor positif dan hasil tepat.

**Business validation** memastikan bentuk kemasan sah untuk produk. Sachet dengan isi 12 L dapat dihitung secara matematika, tetapi tidak sah untuk produk jenis BBM. Sachet 12 gram bumbu bisa sah pada produk umum yang mengizinkannya. Memblokir sachet secara global akan merusak produk tersebut.

## 3. Metadata minimal dan aturan

Product dan ProductDraft mempunyai field unitPolicy. Field opsional pada tipe memungkinkan record legacy dibaca; saveProduct baru/hasil review tetap mewajibkan policy valid:

```ts
interface ProductUnitPolicy {
  kind: 'general' | 'fuel'
  allowedPackagingUnitIds: UUID[]
}
```

Daftar mereferensikan UUID unit. Dimensi tidak diduplikasi: baseUnitId menunjuk Unit.dimension. Jenis fuel wajib mempunyai base satuan ukur VOLUME. Tidak ada pemeriksaan nama/kategori seperti product.name === 'Solar'. Mengganti nama tidak mengubah aturan tersimpan.

| Konfigurasi | Unit yang sah |
| --- | --- |
| Semua produk | Base unit itu sendiri dengan faktor tepat 1 |
| Base MASS/VOLUME | Ukuran baku berdimensi sama dengan faktor baku |
| kind general | Kemasan tambahan yang UUID-nya ada pada allowlist produk |
| kind fuel | Base VOLUME; hanya Botol/Jeriken yang juga tercantum pada allowlist |
| Policy belum ada | Base/metrik kompatibel tersedia; seluruh kemasan tambahan diblokir sampai review |
| Kemasan manual | Tetap wajib isi positif/valid/eksplisit; izin bukan kapasitas default |

Solar yang hanya mengizinkan Jeriken tidak otomatis mengizinkan Botol. Bensin dapat mengizinkan Botol/Jeriken dengan varian botol 1/1,5/5 L; satu saldo Product tetap dipakai bersama.

Seed baru memberi Solar kind fuel + Jeriken, Bensin fuel + Botol/Jeriken, mi contoh + Dus. Seed tidak menimpa metadata produk demo lama yang sudah ada. Produk baru lain dikonfigurasi pemilik melalui editor kebijakan.

Varian aktif wajib valid. Varian legacy yang tidak sesuai dapat **dinonaktifkan dengan unit/faktor/mode lama tetap sama**; identitas/barcode tetap ada untuk audit. Mengubah faktor arsip menjadi nilai tidak sah tetap ditolak. Produk legacy juga dapat dinonaktifkan tanpa menebak policy; aktivasi kembali membutuhkan konfigurasi valid.

## 4. File dan fungsi aktual

Path relatif terhadap frontend. File baru khusus hardening:

| File | Fungsi |
| --- | --- |
| src/domain/errors.ts | ValidationError bersama; diekspor ulang oleh validation.ts agar import lama tetap bekerja tanpa circular dependency |
| src/domain/unitPolicy.ts | packagingPermittedByKind, validateUnitPolicy, assertUnitAllowed, unitAllowed: satu aturan izin kemasan |
| src/domain/inventoryReview.ts | productUnitIssues dan historicalUnitIssue: diagnosis baca saja |
| src/features/products/UnitPolicyFields.tsx | Pilihan jenis persediaan, informasi dimensi, checkbox kemasan |
| src/components/ui/UnitPolicyNotice.tsx | Peringatan review pada Produk/Stok/form mutasi |
| docs/PHASE-3-BUSINESS-HARDENING.md | Laporan dan pembelajaran ini |

File diperbarui:

| File | Perubahan hardening |
| --- | --- |
| src/domain/product.ts | UnitDimension, ProductUnitPolicy, field pada Product/ProductDraft |
| src/domain/validation.ts | validateVariantUnit/variantUnitIssue, pemeriksaan policy di validateProduct, konversi unit sama wajib 1, aturan arsip legacy |
| src/domain/inventoryRules.ts | resolveConversion memanggil assertUnitAllowed/validateVariantUnit |
| src/data/dexieProductRepository.ts | Simpan salinan policy; validasi ulang pada saveProduct; arsip produk tetap memungkinkan |
| src/data/demoSeed.ts | Policy eksplisit untuk seed baru |
| src/features/products/ProductForm.tsx | Editor policy, konfirmasi review legacy, validateProduct sebelum submit |
| src/features/products/VariantFields.tsx | Pilihan mengikuti policy; unit lama tidak sah disabled dan ditandai perlu review |
| src/services/inventoryInputs.ts | Memfilter unit, varian, dan kemasan manual memakai aturan bersama |
| src/services/catalogRepository.ts | Menyaring varian invalid sebelum proyeksi/ketersediaan Kasir |
| src/components/ui/ProductStock.tsx | Peringatan review tanpa sumber saldo kedua |
| src/features/stock/StockPage.tsx | Peringatan konfigurasi pada baris produk |
| src/features/stock/StockMovementForm.tsx | Peringatan review; menerima pilihan unit yang sudah difilter |
| src/features/stock/StockHistory.tsx | Peringatan historis; angka/unit/nama tetap dari snapshot |
| scripts/inventory.test.ts | Delapan tes hardening dan pemeriksaan snapshot setelah edit faktor |
| scripts/product-repository.test.ts | Fixture draft memakai policy eksplisit |
| scripts/cart-ui.test.tsx | Fixture valid; regresi drawer/pembayaran DEMO dipertahankan |
| scripts/stock-ui.test.tsx | Alur review legacy, blokir varian aktif invalid, arsip, dan pilihan unit Solar |
| README.md, docs/INVENTORY-DATA-MODEL.md, docs/PHASE-3-INVENTORY-LEARNING.md, docs/PHASE-3-REPORT.md | Link hardening dan penjelasan baseline sebelumnya |

InventoryService, DexieInventoryRepository, dan skema tidak memerlukan aturan salinan baru: pemanggilan domain yang sudah ada otomatis menjalankan validasi yang diperketat. Tidak ada dependency/lockfile baru atau perombakan desain.

## 5. Alur validasi konsisten

Master:

```text
ProductForm → validateProduct → validateUnitPolicy + validateVariantUnit
            → DexieProductRepository.saveProduct → validasi ulang dalam transaksi
```

VariantFields menyaring dropdown lewat unitAllowed. Dropdown bukan pengaman terakhir: pemanggilan saveProduct langsung tetap ditolak bila melanggar aturan.

Mutasi:

```text
StockMovementForm → inventoryInputOptions → unitAllowed / variantUnitIssue
                 → InventoryService.preview → previewMovement → resolveConversion
                 → InventoryService.execute → DexieInventoryRepository.apply
                 → baca master terbaru di transaksi → previewMovement
                 → resolveConversion → assertUnitAllowed + validateVariantUnit
                 → konversi → balance + ledger → commit
```

preview menjalankan domain untuk pratinjau. execute memvalidasi struktur perintah lalu mendelegasikan pemeriksaan terhadap master terbaru pada repository. Validasi otoritatif sengaja **di dalam transaksi**, bukan query service di luar transaksi yang bisa kedaluwarsa. Request lewat execute ataupun apply langsung tetap melalui aturan sama, sebelum balance.put/stockMovements.add.

Scope transaksi dan unique operationId tidak berubah. Retry operasi sukses lama mengembalikan hasil lama tanpa menulis walaupun policy sekarang berubah; ini deduplikasi keberhasilan lama, bukan izin membuat mutasi baru.

Kasir: projectCatalog → variantUnitIssue → hanya varian valid menjadi CatalogItem. Item lama di keranjang yang kini tidak sah tidak mendapat proyeksi valid dan tidak bisa dipakai melanjutkan pembayaran DEMO. Tidak ada checkout nyata.

## 6. Dampak data lama dan database

Versi Dexie tetap **2**. Policy adalah properti non-indexed dalam object Product, bukan tabel/index baru. Tidak dibutuhkan version upgrade, migration callback, atau backfill. Metadata disimpan hanya ketika pemilik menyimpan produk atau membuat seed baru secara eksplisit.

unitPolicy undefined pada legacy tetap dibaca dan diberi warning. Aplikasi tidak menebak izin dari nama/kategori/varian/ledger lama. Menyimpan hasil review tidak mengubah balance, minimumStock, baseUnitId, UUID, barcode, atau StockMovement lama.

historicalUnitIssue membaca unit/faktor dari snapshot, menilai kesesuaian dengan policy **saat ini**, memeriksa presisi/delta, lalu mengembalikan pesan atau null. Tanpa policy, hasilnya kebutuhan review, bukan vonis semua riwayat salah. Edit faktor varian kini tidak mengganti snapshot lama atau otomatis membuat histori tidak sah.

Warning “tidak sesuai kebijakan saat ini” bukan bukti aturan tersebut berlaku pada tanggal kejadian. Ini alat audit pemilik, tanpa flag permanen, penulisan ulang movement, atau koreksi saldo otomatis.

## 7. Review Solar dan koreksi saldo oleh pemilik

1. Produk → Edit Solar. Periksa dasar aktual. Jika Liter/ml, pilih **BBM** dan izinkan **Jeriken** jika benar digunakan. Jangan izinkan Botol bila tidak diperlukan.
2. Periksa varian. Sachet tidak dapat tetap aktif pada BBM. Nonaktifkan dengan konfigurasi historis tetap sama, atau perbaiki unit/faktor berdasarkan pengetahuan fisik yang benar.
3. Konfirmasikan review legacy lalu simpan. Ini tidak menyesuaikan saldo.
4. Buka Riwayat → Detail audit. Catatan 10 Sachet × 12 Liter tetap tampil bersama warning; tidak diganti menjadi Jeriken agar terlihat benar.
5. Hitung/ukur fisik dan bandingkan dengan saldo. Jangan menafsirkan 10 Sachet sebagai 10 L atau 10 Jeriken tanpa bukti.
6. Contoh **hanya jika fisik benar-benar 20 L dan saldo sekarang 120 L**: koreksi keluar **100 L**, dengan alasan yang mengacu pada stock opname dan ID catatan lama. Preview 120→20 L, lalu konfirmasi. Jika fisik lebih tinggi, koreksi masuk sebesar selisih.
7. Ledger tetap mempunyai awal +120 L dan catatan baru −100 L yang menjelaskan perbaikan; balance menjadi 20 L. Jangan membuat stok awal kedua, menghapus database, atau mengedit angka langsung melalui DevTools.

Jika dasar legacy ternyata salah dimensi (misalnya Solar berdasar Pcs), aplikasi tidak menerjemahkannya otomatis ke Liter. Jangan koreksi menggunakan satuan rekaan. Nonaktifkan konfigurasi yang salah, dokumentasikan hasil ukur, dan tentukan penanganan master bersama pemilik. Tidak ada transfer/migrasi antarproduk otomatis.

## 8. Tests dan hasil pemeriksaan

Delapan tes tambahan inventory:

1. Solar: semua jenis mutasi menolak Sachet/Bungkus/Dus/Botol tak diizinkan pada preview, service, repository; saldo/ledger tidak berubah.
2. Liter/ml dan jeriken eksplisit sah; kapasitas kosong/nol/negatif/non-integer scaled/NaN/Infinity serta jumlah pecahan wadah ditolak tanpa data parsial.
3. Botol bensin 1/1,5/5 L memakai satu balance; varian Sachet legacy disaring dari stok/Kasir dan request langsung ditolak.
4. Master BBM wajib volume; allowlist tidak dapat menyelundupkan Sachet; validateProduct dan saveProduct sama-sama menolak.
5. Sachet sah untuk bumbu gram; izin antarproduk tidak diwariskan; lintas dimensi tetap ditolak.
6. Legacy tidak ditulis ulang, kemasan tambahan diblokir, metrik kompatibel tetap tersedia, arsip produk tetap bekerja.
7. Snapshot kasus 10 Sachet/120 L dan balance tetap utuh setelah reopen/review; koreksi dilakukan dengan movement baru.
8. Policy baru dapat mengarsipkan varian lama, melarang operasi baru, dan tetap menduplikasi retry sukses; faktor arsip negatif ditolak.

Tes DOM Stok diperluas: editor policy legacy, penolakan varian aktif invalid, arsip dan simpan review, dropdown Solar hanya Liter/ml/Jeriken, kapasitas manual kosong/wajib. Tes snapshot Dus juga memastikan edit faktor sekarang tidak menafsirkan ulang histori.

Seluruh regresi CRUD/barcode/kategori, rollback, idempotency, dua koneksi bersamaan, shared stock, serta drawer empat breakpoint dijalankan memakai Node/fake-indexeddb/jsdom. Database tes terisolasi; cleanup hanya menyentuh emulator, bukan IndexedDB pengguna.

```powershell
cd C:\04-Project-TOKO\POS-Zanna\frontend
npm run lint
npm run typecheck
npm test
npm run test:inventory
npm run build
```

Hasil pemeriksaan akhir:

| Perintah | Hasil |
| --- | --- |
| npm run lint | Lulus, exit 0 |
| npm run typecheck | Aplikasi, konfigurasi Vite, dan tests lulus, exit 0 |
| npm test | 44 berhasil, 0 gagal, 0 skipped |
| npm run test:inventory | 24 berhasil, 0 gagal |
| npm run build | Lulus, exit 0; JS 507,80 kB / gzip 154,20 kB; CSS 38,38 kB |
| git diff --check | Bersih; staging tetap kosong |

Tes DOM baru sempat gagal pada dua putaran karena snapshot fixture belum lengkap dan selector checkbox memilih label dropdown. Wait dan selector diperbaiki, lalu 44 tes lulus; tidak ada tes gagal yang di-skip/dinonaktifkan.

Build mempunyai warning chunk utama melewati 500 kB. Ini bukan kegagalan kompilasi; batas warning tidak dinaikkan untuk menyembunyikannya. Pemisahan bundle dapat dievaluasi terpisah; routing tidak dirombak pada perbaikan domain ini.

## 9. Checklist manual — belum diuji agen

- [ ] Solar legacy tetap mempunyai saldo/ledger sama setelah dibuka; warning terlihat.
- [ ] Edit Solar: BBM, dasar Liter/ml, hanya Jeriken; arsip Sachet lama dan konfirmasi review.
- [ ] Sachet/Bungkus/Dus/Botol tak diizinkan tidak tersedia pada awal/masuk/koreksi Solar.
- [ ] Liter/ml bekerja; Jeriken membutuhkan isi eksplisit tanpa kapasitas default.
- [ ] Histori tetap menunjukkan snapshot asli dan warning; perubahan master tidak mengubah saldo.
- [ ] Koreksi stock opname menciptakan movement baru beserta alasan.
- [ ] Bensin botol 1/1,5/5 L berbagi saldo; beras kg/gram dan mi bungkus/dus sesuai policy.
- [ ] Produk umum yang mengizinkan Sachet tetap bisa memakainya.
- [ ] Kasir menyaring varian tak sah; Keranjang & Bayar pada tablet tetap tersedia.
- [ ] Refresh mempertahankan policy/master/saldo/ledger dan Console tanpa error.

## 10. Risiko dan batasan

Pemilik tetap memilih jenis produk/kemasan yang benar: nama “Solar” tidak otomatis mengklasifikasikan record sebagai fuel. Produk lama, termasuk demo, wajib ditinjau. Fuel saat ini mendukung Botol/Jeriken; wadah BBM lain perlu perluasan aturan eksplisit.

Policy bukan autentikasi atau proteksi terhadap pemilik akses DevTools. Repository boundary berarti API repository aplikasi, bukan penghalang penulisan manual ke store browser. Tidak ada backup, API, PWA, atau sync baru. Warning historis adalah penilaian saat baca, bukan audit server. Agen tidak mengakses/memperbaiki database browser pengguna.

Pekerjaan berhenti pada hardening Fase 3 dan menunggu evaluasi pengguna.
