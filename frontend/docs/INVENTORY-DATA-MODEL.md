# Inventory Data Model — Fase 3

Status: operasi persediaan lokal sudah diimplementasikan. Kasir/pembayaran tetap DEMO. Tidak ada backend, PostgreSQL, sinkronisasi, sale movement, retur, PWA, atau deployment.

## Keputusan kompatibilitas

**Pembaruan 21 Oktober 2026:** [Business Logic Hardening](PHASE-3-BUSINESS-HARDENING.md) menambahkan Product.unitPolicy dan izin kemasan per produk. Base/metrik kompatibel tetap tersedia pada legacy; kemasan tambahan membutuhkan review eksplisit. Profile fuel wajib volume dan hanya Botol/Jeriken yang diizinkan. Skema tetap v2; tidak ada backfill atau perubahan ledger/saldo. Bagian sumber konversi di bawah selalu tunduk pada policy tersebut.

Database tetap `zanna-cell-db`. Skema Fase 2 versi 1 menyimpan products/categories/units/variants. Versi 2 menambahkan inventoryBalances dan stockMovements tanpa menghapus atau menulis ulang master. Tidak ada perubahan UUID, barcode, harga, satuan dasar, quantityInBaseUnit, atau minimumStock lama. Tidak ada seed saldo nol.

Skala tetap **1000 integer per satuan dasar**. Produk lama berdasar Liter tetap Liter: saldo 50 L disimpan 50000, koreksi 1,5 L sebagai −1500, hasil 48500 = 48,5 L. Produk berdasar Mililiter menyimpan 50 L sebagai 50000000 = 50000 mL. Dua representasi tersebut tidak boleh dipertukarkan tanpa memperhatikan baseUnitId. Migrasi tidak memaksa seluruh BBM ke mL.

Minimum stok juga tetap dalam skala 1000 satuan dasar. Data lama tidak dibulatkan atau diperbaiki diam-diam. Validasi baru menolak konversi/minimum pecahan pada satuan diskret saat produk disimpan, dan menolak konversi inventory yang tidak sah. Jika konfigurasi lama memiliki pecahan diskret, pengguna perlu meninjau varian tersebut secara eksplisit; saldo/master tidak dihapus atau direinterpretasi.

## Tabel baru

### InventoryBalance — satu saldo per produk

| Field | Makna |
| --- | --- |
| productId | UUID Product, primary key; menjamin satu baris per master |
| quantityBase | Saldo scaled integer nonnegatif dalam satuan dasar Product |
| initializedAt | ISO UTC ketika stok awal dibuat, tidak diganti oleh stok masuk/koreksi |
| updatedAt | ISO UTC operasi terakhir, monoton untuk produk yang sama |

Tidak adanya baris berarti NOT_INITIALIZED. Adanya baris dengan quantityBase 0 berarti OUT_OF_STOCK. Varian tidak memiliki saldo fisik sendiri. Product tidak ditambahkan field saldo kedua.

### StockMovement — ledger append-only pada kontrak aplikasi

| Field | Makna |
| --- | --- |
| id | UUID mutasi stabil |
| operationId | UUID intent operasi, unique index untuk idempotency |
| productId / productName | Relasi master dan snapshot nama saat mutasi |
| movementType | OPENING_BALANCE, STOCK_IN, ADJUSTMENT_IN, ADJUSTMENT_OUT |
| quantityDeltaBase | Perubahan bertanda dalam scaled base unit |
| quantityBeforeBase / quantityAfterBase | Saldo sebelum/sesudah operasi |
| inputQuantity | Jumlah yang dimasukkan, scaled integer pada input unit |
| conversionSnapshot | Snapshot satuan dasar/input, faktor, sumber, serta identitas/nama varian bila dipakai |
| reason | Catatan maksimal 300 karakter; wajib untuk koreksi |
| createdBy | null; tidak ada identitas operator tepercaya sebelum autentikasi |
| createdAt | ISO UTC waktu mutasi |
| requestFingerprint | Deskripsi permintaan ternormalisasi untuk membandingkan retry dengan operasi lama |

`requestFingerprint` bukan hash keamanan atau tanda tangan. Aplikasi tidak menyediakan update/delete movement. Pengguna yang menguasai browser/DevTools masih dapat mengubah data lokal; ledger tidak diklaim tamper-proof.

Index v2:

```ts
this.version(2).stores({
  inventoryBalances: 'productId, updatedAt',
  stockMovements: 'id, productId, &operationId, [productId+createdAt], createdAt',
})
```

Deklarasi versi 1 tetap dipertahankan sebagai `PRODUCT_SCHEMA_V1`. Versi 2 hanya menambah tabel; Dexie membuat store baru dalam transaksi upgrade, tanpa data migration callback yang mengubah master. Ini mengikuti [mekanisme versioning Dexie](https://dexie.org/docs/Version/Version.stores%28%29). Bila upgrade gagal, database tidak direset; error ditampilkan. Tab lama ditutup koneksinya saat versionchange dan perlu dimuat ulang.

## Invariant dan aturan operasi

- `quantityAfterBase = quantityBeforeBase + quantityDeltaBase`.
- Saldo tidak negatif, integer aman, maksimal 1000000000000 scaled base unit (= 1 miliar satuan dasar).
- Setiap perubahan saldo memiliki tepat satu ledger baru.
- Stok awal boleh nol, hanya sekali. Saldo baru tidak dapat diciptakan oleh STOCK_IN atau ADJUSTMENT.
- STOCK_IN dan koreksi menerima input positif. Jenis koreksi menentukan tanda, bukan input negatif.
- Semua alasan koreksi wajib, tidak hanya koreksi keluar.
- Produk nonaktif tetap dapat memiliki persediaan dan dikoreksi; mutasi tidak mengaktifkannya kembali untuk penjualan.
- Satuan dasar produk tersimpan tetap terkunci oleh aturan Fase 2.
- Tidak ada hard delete, reset, clear, auto-zero, atau perubahan ledger melalui UI.

Jenis SALE/SALE_REVERSAL/RETURN belum diterima oleh validator. Fase berikutnya harus memperluas domain dan aturan atomiknya secara eksplisit; jangan mengirim string jenis baru tanpa implementasi.

## Konversi dan presisi

`parseQuantity` mengubah teks ke integer sebelum aritmetika. Contoh 1,5 => 1500; harga tetap integer rupiah terpisah dari kuantitas.

Empat sumber konversi:

1. **base**: input sama dengan satuan dasar, faktor 1000.
2. **metric**: konversi baku berat/volume kompatibel, misalnya liter↔ml dan kg↔gram. Count tidak disetarakan otomatis dengan kemasan lain.
3. **variant**: isi dari varian aktif milik produk itu sendiri, misalnya dus isi 40; faktor dan nama disalin ke ledger.
4. **custom**: kemasan manual dengan isi wajib, misalnya 2 jeriken masing-masing 18,5 L. Tidak menyimpan kapasitas global jeriken dan tidak menebak isi.

Perhitungan menggunakan BigInt sementara:

```ts
const numerator = BigInt(inputQuantity) * BigInt(conversion.quantityInBaseUnit)
if (numerator % BigInt(QUANTITY_SCALE) !== 0n) {
  throw new ValidationError('Hasil konversi lebih kecil dari presisi satuan dasar. Pilih jumlah/satuan yang dapat disimpan tepat.')
}
const result = numerator / BigInt(QUANTITY_SCALE)
```

Hasil baru dikembalikan menjadi Number setelah batas integer diperiksa. Database/kontrak menyimpan number integer, bukan BigInt. Tidak ada pembulatan tersembunyi. Input satuan count/kemasan wajib bulat; base count juga wajib menghasilkan jumlah bulat. Untuk sebagian isi botol/jeriken, masukkan volume aktual dengan Liter/Mililiter, bukan 0,5 botol yang ambigu.

Contoh berskala:

| Masukan | Dasar | Input scaled | Faktor scaled | Hasil scaled | Tampilan |
| --- | --- | ---: | ---: | ---: | --- |
| 2 dus isi 40 | Bungkus | 2000 | 40000 | 80000 | 80 bungkus |
| 1 kg | Gram | 1000 | 1000000 | 1000000 | 1000 gram |
| 1,5 L | Mililiter | 1500 | 1000000 | 1500000 | 1500 ml |
| 50 L | Liter | 50000 | 1000 | 50000 | 50 L |
| 1,5 L koreksi keluar | Liter | 1500 | 1000 | −1500 | −1,5 L |
| 2 jeriken isi 18,5 L | Liter | 2000 | 18500 | 37000 | 37 L |

Bensin 1/1,5/5 L berbagi satu saldo Product. Harga bensin tetap dari pemilik atau null. Solar Rp13.000/L hanya harga sample master yang dapat diedit; inventory sama sekali tidak menggunakan harga untuk menghitung volume. Solar bisa dimasukkan sebagai volume aktual seperti 18,375 L. Penjualan volume aktual tetap fase transaksi mendatang.

## Atomicity, concurrency, idempotency

`DexieInventoryRepository.apply` menjalankan satu transaksi read/write yang meliputi master relasi, inventoryBalances, dan stockMovements:

1. Salin permintaan agar objek pemanggil tidak berubah ketika operasi async berlangsung.
2. Validasi bentuk perintah; periksa operationId di dalam transaksi.
3. Jika ID sudah ada dan fingerprint sama, kembalikan movement lama dengan duplicate true, tanpa menulis saldo lagi.
4. ID sama dengan isi berbeda ditolak.
5. Baca master, konfigurasi satuan/varian, dan saldo terkini di dalam transaksi.
6. Jalankan `previewMovement`: aturan inisialisasi, jumlah, alasan, konversi, batas saldo, dan optimistic guard.
7. Buat metadata/snapshot dan tulis balance serta ledger.
8. Promise berhasil hanya setelah transaksi commit; error dari salah satu penulisan membatalkan semuanya.

Tidak ada request network di dalam transaksi. Cakupan tabel read/write yang tumpang tindih menyerialkan operasi lokal, termasuk dari koneksi/tab lain pada origin sama. Dua stok masuk tidak membaca saldo lama lalu menimpa hasil satu sama lain; dua koreksi keluar tidak boleh menghasilkan stok negatif.

Form menyimpan satu operationId untuk satu intent. Double submit tidak hanya ditangani tombol disabled: unique index dan pemeriksaan dalam transaksi menjadi pengaman terakhir. Setelah error, tombol retry memakai perintah yang sama. Mengubah isian menciptakan operationId baru. Retry lama yang berhasil setelah ada mutasi lain mengembalikan hasil historisnya, bukan mengembalikan saldo terkini ke masa lalu.

`expectedBeforeBase` dan `expectedFactorBase` pada form menjaga agar hasil konfirmasi yang terlihat tidak berubah diam-diam sebelum commit. Jika tab lain mengubah saldo/konversi, form diminta ditutup/dibuka ulang. Pemanggil internal tanpa optimistic guard tetap dihitung berdasarkan saldo paling baru dalam transaksi. Batas ini dibuktikan melalui tes paralel, bukan klaim setara database server tanpa batasan.

## Read model dan Kasir DEMO

`inventoryBalances` adalah satu sumber saldo. React menerima observasi balances dari repository, bukan salinan saldo yang dapat diedit secara lokal. Kartu produk merupakan proyeksi:

- stok varian tetap = floor(quantityBase / quantityInBaseUnit),
- saldo dasar tetap dibawa untuk menjelaskan persediaan fisik,
- status dihitung dari saldo master dan minimumStock, bukan jumlah kemasan hasil floor,
- semua varian yang menunjuk productId sama dijumlahkan kebutuhan dasarnya di keranjang.

Contoh 3 L: 1 botol 1,5 L + 1 kemasan 1 L = 2,5 L sah. Menambah satu kemasan 1 L lagi ditolak walaupun masing-masing varian secara terpisah tampak tersedia. Saldo yang tersisa belum cukup untuk satu kemasan tidak otomatis berarti stok fisik nol.

Produk NOT_INITIALIZED tidak dapat ditambahkan ke keranjang baru. Stok habis dan varian tanpa harga ditandai jelas. Keranjang tidak membuat reservasi atau movement. Modal pembayaran DEMO juga tidak menulis saldo/ledger; jika saldo menjadi tidak cukup setelah koreksi dari tab/menu lain, validitas keranjang dihitung ulang.

Halaman Produk/detail menampilkan saldo dari inventory, bukan field baru pada Product. Dashboard memakai status stok per Product, tanpa menghitung setiap varian sebagai persediaan terpisah. Penjualan/laporan tetap sample DEMO yang terpisah.

## Future Backend & Synchronization — konseptual saja

IndexedDB/Dexie tetap penyimpanan lokal. Spring Boot kelak menyediakan REST API; PostgreSQL adalah database pusat di belakang backend. Browser tidak boleh mengakses PostgreSQL langsung.

Fase khusus nanti harus menentukan push/pull, retry, idempotency lintas perangkat, conflict resolution, dan reconciliation. Operasi stok menjelaskan **peristiwa**, sedangkan balance adalah **snapshot saldo hasil peristiwa**. Mengirim snapshot saldo saja tidak cukup untuk menggabungkan dua perangkat yang sama-sama mengubah persediaan.

operationId lokal membantu mendefinisikan identitas intent, tetapi belum menjamin deduplikasi server. UUID/timestamp/snapshot saat ini adalah fondasi kontrak, bukan implementasi sync. Tidak ada outbox, queue, sync metadata, endpoint, background sync, atau resolver yang ditambahkan.

Fase 4 perlu merancang penyimpanan penjualan dan SALE movement secara atomik, idempotency checkout, pembatalan/retur, serta perhitungan volume/harga yang tepat. Semua itu belum diimplementasikan.

## Batas penyimpanan dan offline

Operasi inventory tidak mengakses internet dan dapat dipakai ketika frontend sudah tersedia dari server lokal/LAN atau sudah dimuat di browser. Tidak ada PWA/service worker: cold start/reload saat frontend tidak dapat dimuat belum dijamin. Jangan menafsirkan penyimpanan lokal sebagai instalasi offline mandiri.

IndexedDB terikat origin dan dapat terhapus lewat site data, mode privat, eviction, atau kerusakan perangkat. Backup/restore belum tersedia; Git tidak menyimpan isi database browser. Harga modal dan ledger tidak dilindungi autentikasi owner yang tepercaya. Tidak ada pengujian manual browser/tablet oleh agen pada fase ini.
