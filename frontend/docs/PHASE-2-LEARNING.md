# Panduan Belajar Fase 2

Dokumen ini adalah catatan **Fase 2**. Untuk inventory dan skema v2 gunakan [Panduan Belajar Fase 3](PHASE-3-INVENTORY-LEARNING.md); penjelasan skema v1 di sini adalah konteks sebelum penambahan inventory.

Baca sambil membuka kode. Semua yang ditandai “berfungsi” sudah diimplementasikan; rencana backend/sinkronisasi tidak memiliki implementasi.

## 1. Peta file penting

| File | Fungsi |
| --- | --- |
| src/domain/product.ts | Bentuk Product, Category, Unit, ProductVariant, draft input, snapshot, dan konstanta skala kuantitas. Tidak mengimpor Dexie. |
| src/domain/quantity.ts | parseRupiah mengubah teks 15.000 menjadi integer 15000. parseQuantity mengubah 1,5 menjadi integer 1500. quantityInput/quantityText mengembalikan tampilan. |
| src/domain/validation.ts | Menolak nama kosong, harga/relasi/konversi invalid, SKU/barcode duplikat. validateConversion menjelaskan batas antar-dimensi dan kemasan. |
| src/domain/id.ts | Membuat UUID v4, termasuk fallback getRandomValues untuk HTTP jaringan lokal. Tidak memakai nomor urut array. |
| src/domain/productRepository.ts | Kontrak metode baca/simpan/aktifkan/kategori/seed/subscribe. React bergantung pada kontrak ini. |
| src/data/database.ts | Nama database dan skema Dexie versi 1, empat object store dan index. Ini tempat migrasi skema ditambahkan kelak. |
| src/data/units.ts | Daftar referensi satuan dan UUID stabil. Ini bukan produk demo atau saldo stok. |
| src/data/dexieProductRepository.ts | Implementasi kontrak: transaksi atomik, validasi ulang, UUID, metadata, arsip, keunikan, seed, liveQuery. |
| src/data/demoSeed.ts | Menyusun draft sampel hanya ketika Isi Data Demo dipanggil. Bensin menjadi satu master dengan tiga varian. |
| src/services/productRepository.ts | Composition root: menghubungkan interface dengan implementasi Dexie lokal. Titik pemilihan adapter di masa depan. |
| src/services/catalogRepository.ts | projectCatalog menggabungkan master, kategori, satuan, varian menjadi CatalogItem untuk UI Kasir. Tidak menyimpan salinan database. |
| src/app/DemoProvider.tsx | Membuka repository, berlangganan snapshot, menangani loading/error, dan menyimpan satu keranjang DEMO dalam memori. |
| src/app/demoContext.ts / hooks/useDemoStore.ts | Membagikan snapshot, repository interface, status, dan keranjang ke komponen. |
| src/features/products/ProductsPage.tsx | Daftar/filter/pencarian, pemilihan editor/detail, konfirmasi aktivasi dan seed eksplisit. |
| src/features/products/ProductForm.tsx | Form master: teks input, parsing uang/kuantitas, status busy/error, pemanggilan saveProduct. |
| src/features/products/VariantFields.tsx | Form tiap varian: SKU/barcode, satuan, konversi, harga, mode jumlah, status. |
| src/features/products/CategoryManager.tsx | Tambah/edit/aktifkan kategori melalui repository, dengan konfirmasi perubahan status. |
| src/features/products/ProductDetails.tsx | Melihat UUID, metadata, modal, konversi dan varian tanpa mengubahnya. |
| src/hooks/useWideCashier.ts | Satu sumber keputusan panel desktop atau drawer pada breakpoint 1024px. |
| src/features/cashier/CashierPage.tsx | Memakai katalog lokal; hanya merender satu panel keranjang. Tombol layar sempit dipasang ke body melalui portal. |
| src/features/cashier/useCart.ts / cartLogic.ts | Kuantitas dan total dari satu state. Data transaksi tidak disimpan ke IndexedDB. |
| src/features/cashier/CartPanel.tsx | Tampilan item, kontrol jumlah, total, metode, tombol Bayar. Tidak memiliki state keranjang lain. |
| src/features/cashier/PaymentDialog.tsx | Simulasi tunai/QRIS/bon. Mendeteksi perubahan master ketika proses demo berjalan dan tidak mencatat penjualan. |
| src/components/ui/Dialog.tsx | Native dialog, Escape/backdrop, penguncian scroll, fokus kembali, ukuran viewport dan mode label local/demo. |
| src/features/stock/StockPage.tsx | Menampilkan batas minimum dari master. Tidak mengarang saldo atau membuat ledger. |
| scripts/product-repository.test.ts | Pengujian repository nyata menggunakan IndexedDB tiruan untuk lingkungan Node. |
| scripts/cart-ui.test.tsx | Menguji DOM React, breakpoint tiruan, katalog dan state keranjang. Bukan screenshot/browser layout. |
| scripts/demo-logic.test.mjs | Pengujian hitungan keranjang dan ringkasan data demo yang sudah ada. |

## 2. Empat model dalam contoh sehari-hari

**Product** adalah barangnya: “Mi instan”. Master menyebut kategori Makanan, stok dasar Bungkus, dan modal per satu Bungkus. Product tidak perlu mengetahui cara semua kemasan dijual melalui field harga ganda.

**Category** mengelompokkan produk, misalnya Makanan, Minuman, atau kategori buatan Anda. Relasi memakai categoryId, sehingga mengganti nama kategori tidak mengganti identitasnya.

**Unit** menjelaskan makna satuan. Kg dan gram berdimensi berat; liter dan mililiter berdimensi volume. Dus adalah kemasan: isinya perlu dikonfigurasi per produk, bukan diasumsikan selalu 12/24/40.

**ProductVariant** adalah penawaran jual: “Per bungkus” dan “Dus isi 40”. Keduanya menunjuk Product yang sama. Isi bungkus 1 disimpan sebagai 1000; isi dus 40 sebagai 40000. Masing-masing boleh memiliki harga, SKU, barcode, dan status aktif sendiri.

Contoh bensin: satu Product berdasar Liter dengan varian botol 1 L (1000), botol 1,5 L (1500), jeriken 5 L (5000). Harga boleh null. Contoh solar: per liter Rp13.000. Model variable menyiapkan jumlah aktual, tetapi input volume transaksi belum dibangun.

## 3. Alur simpan: Component → Repository → Dexie → IndexedDB

1. Pengguna mengisi ProductForm. State form masih berupa teks agar input dapat diedit dengan nyaman.
2. Saat Simpan, parseRupiah dan parseQuantity mengubah teks ke integer. Ini mencegah salah mengartikan harga ribuan sebagai pecahan.
3. Form memanggil `repository.saveProduct(draft)`. Komponen tidak mengenal tabel Dexie.
4. DexieProductRepository membuka transaksi, membaca relasi dan varian yang sudah ada, lalu menjalankan validateProduct. Validasi UI saja tidak cukup karena tab lain dapat mengubah data.
5. UUID hanya dibuat untuk objek baru. createdAt dipertahankan saat edit; updatedAt diperbarui.
6. Product dan semua varian ditulis melalui Dexie ke object store IndexedDB. Bila satu penulisan gagal, seluruh transaksi dibatalkan.
7. Setelah transaksi selesai, liveQuery di dalam repository membaca snapshot terbaru.
8. DemoProvider menerima snapshot, dan React merender ulang Produk, Stok, serta proyeksi katalog Kasir.

Tidak ada HTTP request, server Java, PostgreSQL, localStorage master, atau pembayaran dalam alur ini.

## 4. Alur baca setelah refresh

State React lama hilang saat refresh, tetapi database browser pada origin yang sama tetap tersedia. Provider memanggil initialize untuk memastikan referensi satuan, lalu subscribe/getSnapshot membaca empat store. Yang Anda lihat pada katalog adalah hasil pembacaan database, bukan seed ulang.

Seed sampel tidak berjalan di initialize. Hanya tombol Isi Data Demo yang memanggil seedDemo. Memanggil tombol lagi tidak menimpa nama/harga sampel yang sudah diedit.

Keranjang berbeda: ia sengaja hanya state React dan kembali kosong setelah refresh. Membayar DEMO tidak menambah riwayat penjualan atau mengurangi stok. Dashboard/laporan tetap sampel yang terpisah.

## 5. Contoh pemanggilan sederhana

Di dalam komponen yang berada di DemoProvider:

```tsx
const { repository } = useDemoStore()

async function readProducts() {
  const snapshot = await repository.getSnapshot()
  console.log(snapshot.products)
}
```

Membaca satu produk tidak memerlukan API Dexie pada komponen:

```ts
const snapshot = await repository.getSnapshot()
const product = snapshot.products.find((item) => item.id === productId)
const variants = snapshot.variants.filter((item) => item.productId === productId)
```

Untuk menonaktifkan melalui repository:

```ts
if (product) {
  await repository.setProductActive(product.id, false, product.updatedAt)
}
```

Kode contoh memerlukan variable productId yang Anda pilih dan penanganan error di pemanggil. Pada UI sebenarnya konfirmasi sudah tersedia. Contoh tambah produk lengkap ada di PRODUCT-DATA-MODEL.md.

## 6. Bagian yang berkaitan dengan backend kelak

Buka `domain/productRepository.ts`: ini kontrak yang dipakai React. Buka `services/productRepository.ts`: di sinilah adapter lokal dipilih. Buka `domain/product.ts`: identitas, harga integer, kuantitas integer, dan relasi dapat menjadi bahan kontrak API.

Spring Boot kelak menyediakan REST API menuju PostgreSQL. Adapter HTTP dan sinkronisasi belum ada. Local repository tidak boleh diganti sembarangan menjadi remote-only karena tujuan offline-first memerlukan aturan khusus push/pull, retry/idempotensi, konflik, dan reconciliation.

Jangan menambahkan password PostgreSQL atau koneksi SQL ke React. Pembatasan akses owner untuk modal belum bisa dijamin oleh UI frontend.

## 7. Sudah berfungsi dan masih direncanakan

| Sudah berfungsi | Belum diimplementasikan |
| --- | --- |
| Master Product/Category/Unit/Variant di IndexedDB | Backend Spring Boot / PostgreSQL |
| Tambah/edit/detail/aktif/nonaktif produk | REST API / autentikasi owner |
| Kategori, SKU/barcode unik dan validasi konversi | Push/pull, sync engine, resolver, reconciliation |
| Seed eksplisit dengan marker dan anti-duplikasi | Ledger dan saldo stok, pengurangan stok otomatis |
| Katalog lokal dan keranjang DEMO responsif | Penjualan/pembayaran/bon nyata |
| Konfigurasi varian dan mode jumlah aktual | Input dan hitung transaksi volume/berat aktual |
| Versioning skema v1 | Backup/restore, PWA offline, printer/scanner |

## 8. Tiga latihan kecil

### Latihan 1 — Buktikan persistence dan identitas

Tambahkan kategori “Latihan”, lalu produk “Korek latihan” berdasar Pcs, modal kosong, harga jual `1.500`, varian Standar tanpa barcode. Buka detail dan catat UUID. Refresh pada alamat yang sama, lalu cari lagi.

Hasil yang diharapkan: harga Rp1.500, modal Belum diketahui, UUID tidak berubah, produk masih ada. Keranjang DEMO justru kosong setelah refresh. Jangan menghapus site data selama latihan.

### Latihan 2 — Pahami kemasan dan validasi

Buat “Mi latihan” berdasar Bungkus. Tambahkan varian per bungkus (isi 1, harga 3.500) dan Dus (isi 40, harga contoh 135.000). Periksa detail: konversi tersimpan 1000 dan 40000. Lalu coba membuat konversi Kg ke Liter pada produk lain.

Hasil yang diharapkan: kemasan dus bisa disimpan; lintas dimensi tanpa kemasan ditolak. Nilai harga tersebut hanya contoh latihan, bukan harga warung Anda.

### Latihan 3 — Telusuri perubahan katalog dan keranjang

Masukkan produk latihan ke keranjang, pindah ke Produk dan ubah harga, lalu kembali ke Kasir. Periksa total yang mengikuti master terbaru. Nonaktifkan produk dengan konfirmasi, kembali ke Kasir, lalu lihat item lama di keranjang.

Hasil yang diharapkan: produk tidak ditawarkan sebagai item baru; item lama ditandai tidak valid sampai dihapus. Data produk tetap dapat dilihat lewat filter Nonaktif. Tidak ada transaksi atau pengurangan stok yang tersimpan.

Setelah latihan, nonaktifkan produk latihan bila tidak diperlukan. Jangan membuat backend atau sinkronisasi sebagai bagian latihan ini.
