# Panduan satuan dan varian produk

Panduan Zanna-Cell, 22 Oktober 2026. Pengaturan ini berlaku untuk transaksi berikutnya. Mengubah master produk tidak menghitung ulang transaksi atau mutasi stok yang sudah terjadi.

## 1. Mulai dari cara menghitung stok

**Satuan stok dasar** adalah satuan untuk mencatat seluruh persediaan produk. Semua varian produk menggunakan stok yang sama.

Contoh: stok bensin 20 Liter. Varian Botol 1,5 Liter dan Jeriken 5 Liter mengambil dari 20 Liter yang sama. Tidak perlu membuat stok fisik terpisah untuk setiap varian.

Pilih satuan dasar dengan benar ketika membuat produk. Satuan dasar produk yang sudah disimpan tetap terkunci agar riwayat stok tidak berubah arti.

**Nama varian hanya label.** Menulis “Bensin 1,5 liter” tidak otomatis mengatur isi botol. Pengaturan satuan dan isi menjadi dasar perhitungan.

## 2. Dua cara menjual

### Dijual langsung berdasarkan satuan dasar

Gunakan ketika satuan penjualan sama dengan satuan stok. Contoh: Solar per Liter, beras per Kilogram, minuman per Botol, atau mi per Bungkus.

- Pilih **Dijual langsung berdasarkan satuan dasar** pada Cara menjual.
- Sistem menggunakan faktor 1 secara otomatis. Anda tidak perlu mengisi konversi.
- Harga jual berlaku untuk **1 satuan jual** yang tertulis di label harga.
- Pilih Mode jumlah yang sesuai, seperti penjelasan di bawah.

Jika stok minuman dihitung dalam Botol, penjualan langsung 1 Botol mengurangi 1 Botol. Kapasitas minuman 600 ml pada label tidak menjadikan stoknya dihitung dalam Liter.

### Dijual dalam kemasan dengan isi tertentu

Gunakan ketika satu kemasan berisi beberapa satuan stok, atau berisi berat/volume tertentu. Contoh: Botol berisi 1,5 Liter bensin, Jeriken berisi 5 Liter, atau Dus berisi 40 Bungkus mi.

1. Pada **Izin kemasan tambahan**, centang jenis kemasan yang sesuai. Untuk BBM, pilih jenis persediaan BBM; kemasan yang diizinkan adalah Botol/Jeriken sesuai pilihan Anda.
2. Pada varian, pilih **Dijual dalam kemasan dengan isi tertentu**.
3. Pilih **Jenis kemasan** dari satuan yang sudah tersedia.
4. Isi **Isi per kemasan** dalam satuan stok dasar yang disebutkan. Gunakan koma atau titik untuk desimal, maksimal tiga angka di belakang koma.
5. Baca ringkasan **Dampak pada stok**, lalu periksa harga **per satu kemasan** sebelum menyimpan.

Tidak ada isi default ketika Anda berpindah ke kemasan atau memilih jenis kemasan lain. Isi wajib ditulis sendiri. Centang izin Botol tidak menentukan berapa Liter isi botol. Form tidak membuat master satuan baru.

Contoh tampilan:

> 1 Botol berisi 1,5 Liter  
> Menjual 1 Botol mengurangi stok 1,5 Liter  
> Menjual 2 Botol mengurangi stok 3 Liter

Ringkasan ini hanya simulasi. Mengetik atau menyimpan pengaturan varian tidak mengurangi stok. Stok berkurang setelah checkout tunai berhasil.

## 3. Mode jumlah berbeda dari isi kemasan

| Mode | Kapan digunakan | Contoh |
| --- | --- | --- |
| Jumlah tetap (fixed) | Pelanggan membeli satuan utuh | 1 Botol, 2 Jeriken, 3 Bungkus; Solar per Liter utuh juga dapat memakai fixed |
| Berat / volume aktual (variable) | Pelanggan membeli berat/volume yang dapat pecahan | Solar 1,25 Liter atau beras 0,5 Kilogram |

Botol yang berisi **1,5 Liter** tetap memakai **fixed**: jumlah botolnya utuh, sedangkan isinya 1,5 Liter. Pelanggan membeli 2 Botol, bukan memasukkan 3 Liter sebagai jumlah botol.

Mode variable hanya tersedia untuk satuan ukur berat/volume yang kompatibel. Jika ingin menjual 0,5 Liter dari stok bensin, gunakan varian langsung per Liter dengan variable. Jangan memakai pecahan Botol/Jeriken/Dus.

Harga variable adalah harga per 1 satuan jual. Misalnya harga Solar per Liter, kemudian jumlah yang dibeli diisi di Kasir. Isi per kemasan dan jumlah yang dibeli adalah dua hal berbeda.

## 4. Contoh pengaturan

Angka berikut adalah contoh panduan; tidak dimasukkan otomatis ke database Anda.

| Produk / varian | Satuan stok dasar | Jenis persediaan / izin tambahan | Cara menjual / satuan jual | Isi per kemasan | Mode jumlah | Dampak stok |
| --- | --- | --- | --- | --- | --- | --- |
| Bensin botol 1,5 L | Liter | BBM / Botol | Kemasan / Botol | 1,5 Liter | fixed | 2 Botol mengurangi 3 Liter |
| Bensin jeriken 5 L | Liter | BBM / Jeriken | Kemasan / Jeriken | 5 Liter | fixed | 1 Jeriken mengurangi 5 Liter |
| Solar per liter | Liter | BBM / tidak perlu tambahan | Langsung / Liter | Otomatis 1 | variable | 1,25 Liter mengurangi 1,25 Liter |
| Beras per kilogram | Kilogram | Umum / tidak perlu tambahan | Langsung / Kilogram | Otomatis 1 | variable | 0,5 Kilogram mengurangi 0,5 Kilogram |
| Minuman per botol | Botol | Umum / tidak perlu tambahan | Langsung / Botol | Otomatis 1 | fixed | 2 Botol mengurangi 2 Botol |
| Mi instan per bungkus | Bungkus | Umum / Dus jika juga dijual dus | Langsung / Bungkus | Otomatis 1 | fixed | 2 Bungkus mengurangi 2 Bungkus |
| Mi instan per dus | Bungkus | Umum / Dus | Kemasan / Dus | Contoh 40 Bungkus; sesuaikan isi nyata | fixed | 2 Dus mengurangi 80 Bungkus |

Bensin Botol dan Jeriken sebaiknya menjadi varian dari **satu produk Bensin** apabila mengambil dari stok yang sama. Mi Bungkus dan Dus juga menjadi varian dari satu produk jika memakai stok bersama.

Untuk stok satuan jumlah seperti Botol/Bungkus, isi tambahan harus bulat. Dus tidak dapat berisi 1,5 Bungkus. Untuk Liter/Kilogram, pecahan isi diperbolehkan sesuai presisi sistem.

## 5. Pilihan lanjutan: satuan ukur baku

Pada stok berat/volume tersedia kelompok **Lanjutan: ukuran baku**. Contoh: stok dalam Kilogram, tetapi varian dijual per Gram. Sistem menggunakan faktor baku: 1 Gram = 0,001 Kilogram. Faktor ini tidak perlu diketik.

Pilihan ini dipertahankan untuk kompatibilitas konfigurasi yang sudah ada dan kebutuhan satuan ukur lain. Gram bukan kemasan. Liter dan Kilogram tidak dapat saling ditukar.

## 6. Memahami peringatan nama

Jika nama “Bensin 1,5 liter” tetapi pengaturannya langsung 1 Liter, form memberi peringatan. Periksa maksud penjualan Anda:

- Jika yang dijual adalah Botol 1,5 Liter, pilih kemasan Botol dan isi 1,5 Liter.
- Jika memang dijual per Liter dengan jumlah aktual di Kasir, konfigurasi dapat tetap dipakai. Ubah nama agar lebih jelas jika diperlukan.

Peringatan tidak menolak penyimpanan dan tidak mengubah isi, satuan, mode, atau harga. Nama bukan sumber kebenaran. Validasi satuan/angka yang benar-benar tidak sah tetap dapat menolak penyimpanan.

Deteksi nama hanya mengenali ukuran eksplisit pada dimensi yang sama: L/Liter/Litre, ml/Mililiter/Milliliter, kg/Kilogram, g/gr/Gram, tanpa membedakan huruf besar. Ukuran ekuivalen seperti 1500 ml dan 1,5 Liter dianggap sama. Nama tanpa ukuran, singkatan lain, ukuran lintas dimensi, atau jumlah isi yang belum valid tidak ditebak.

Nama rumit seperti multipack, rentang ukuran, atau penulisan ribuan dapat menimbulkan bantuan yang kurang tepat. Selalu periksa pengaturan sebenarnya; jangan mengandalkan peringatan sebagai pemeriksaan lengkap.

## 7. Mengedit produk lama dengan aman

1. Membuka form dan menutupnya tidak mengubah nilai tersimpan.
2. Mengubah nama produk tidak otomatis menyesuaikan satuan, isi, atau mode varian. Peringatan nama juga tidak melakukan penyesuaian.
3. Botol 1,5 Liter yang sudah benar tetap memakai 1,5 Liter ketika dibuka kembali. Varian Gram/Mililiter tetap memakai faktor dan mode tersimpannya.
4. Jika memilih **Langsung** secara eksplisit, satuan jual berubah menjadi satuan dasar dan faktor menjadi 1 pada draf form. Jika memilih **Kemasan**, jenis dan isi perlu dipilih/diisi kembali, dan jumlah menjadi fixed. Mengganti jenis kemasan juga mengosongkan isi agar kapasitas tidak ditebak.
5. **Harga tidak dihitung ulang otomatis.** Setelah mengganti satuan jual, periksa apakah harga sudah sesuai per Botol/Jeriken/Liter dan sebagainya.
6. Perubahan draf baru disimpan saat menekan **Simpan ke perangkat**. Batal tidak menyimpan.
7. Konfigurasi lama yang tidak valid tetap terlihat sebagai perlu review; tidak diam-diam dibetulkan. Perbaiki dengan tindakan eksplisit. Varian lama yang tidak sesuai juga dapat dinonaktifkan dengan nilai konversi/mode lama dipertahankan sesuai aturan arsip yang sudah ada.
8. Produk yang belum mempunyai kebijakan satuan tetap memerlukan peninjauan dan konfirmasi sebelum disimpan.

Tidak ada migrasi, reset data, atau pengubahan saldo akibat form baru. Jika penjualan sebelumnya sudah tercatat dengan pengaturan yang keliru, mengedit varian hanya memperbaiki transaksi **berikutnya**. Riwayat tetap menyimpan snapshot lama. Tinjau saldo nyata melalui prosedur inventory yang sudah ada; form tidak memperbaiki histori atau saldo secara otomatis.

## 8. Checklist pemeriksaan manual

Pengujian browser/tablet dilakukan oleh pengguna; tes otomatis tidak membuktikan tata letak atau keyboard Android.

- Buka Tambah/Edit produk pada desktop, tablet potret/lanskap, dan mobile. Periksa teks, gulir dialog, label harga, tombol simpan/batal, dan keyboard angka desimal.
- Atur Bensin stok Liter dengan izin Botol/Jeriken. Buat dua varian pada contoh di atas; pastikan satu dan dua kemasan menampilkan dampak yang tepat sebelum menyimpan.
- Pastikan tipe kemasan dan isi tidak terisi sendiri saat beralih dari Langsung atau mengganti Botol menjadi Jeriken.
- Buka kembali varian lama yang benar; bandingkan satuan, isi, mode dan harga. Buka lalu Batal; data harus sama.
- Coba nama Bensin 1,5 liter dengan satuan langsung Liter. Peringatan harus muncul, tetapi konfigurasi sah tetap dapat disimpan tanpa berubah otomatis.
- Coba Solar/beras variable, minuman langsung Botol, dan mi Bungkus/Dus. Untuk checkout percobaan, gunakan data/uji yang memang Anda izinkan karena checkout mencatat penjualan nyata.
- Jika melakukan checkout pada data uji: 2 Botol 1,5 Liter harus mengurangi stok 3 Liter, 1 Jeriken 5 Liter mengurangi 5 Liter. Lihat ledger dan struk; jangan menguji dengan menghapus database operasional.
- Periksa keyboard Tab, label form dan pembacaan ringkasan dengan teknologi bantu bila tersedia. Animasi baru tidak ditambahkan.

## 9. Catatan implementasi dan audit

Perubahan terbatas pada presentasi form dan bantuan pengguna. Domain `Product`, `ProductVariant`, `ProductUnitPolicy` dan `Unit`, repository, CheckoutService, InventoryBalance, StockMovement, Sale/SaleItem serta schema Dexie v3 tidak diubah.

| File | Tanggung jawab |
| --- | --- |
| `src/features/products/ProductForm.tsx` | Menjaga draf/edit lama; menjelaskan stok dasar; mereset pilihan hanya pada perubahan dasar produk baru yang dilakukan pengguna; submit tetap melalui validasi/repository yang sama |
| `src/features/products/UnitPolicyFields.tsx` | Penjelasan izin kemasan, checkbox persetujuan jenis yang sudah ada, aturan BBM tetap dari domain |
| `src/features/products/VariantFields.tsx` | Cara menjual, jenis/isi kemasan, mode fixed/variable, harga per satuan, ringkasan stok dan peringatan nama |
| `src/features/products/variantUnits.ts` | Helper presentasi murni: mengenali konfigurasi lama tanpa mutasi; perubahan draf eksplisit; dampak stok; deteksi ukuran untuk bantuan |
| `scripts/product-units.test.ts` | Tes pilihan/validasi/peringatan dan integrasi repository → inventory → checkout → snapshot historis pada fake-indexeddb |
| `scripts/product-units-ui.test.tsx` | Tes DOM jsdom: buka/batal tanpa write, edit nama mempertahankan varian, warning nonblocking, isi wajib eksplisit, langsung otomatis, dan review faktor legacy |
| `package.json` | Memasukkan tes baru ke suite utama dan menyediakan `npm run test:product-units` |

`unitEntry` adalah penanda pilihan sementara di draf UI, bukan field database. Saat membuka form, cara menjual diturunkan dari ID satuan dan faktor tersimpan. Tidak ada effect yang menulis ulang nilai lama. Nilai konversi salah pada satuan dasar yang sama masuk tampilan review, bukan otomatis menjadi 1.

Alur tetap: input UI → draf dengan `sellingUnitId`, `quantityInBaseUnit`, `saleMode` → `validateProduct` → `repository.saveProduct` → Dexie. Isi 1,5 disimpan sebagai integer berskala 1500. Ringkasan memanggil `validateVariantUnit` dan `convertInventoryQuantity` yang sudah dipakai domain, bukan rumus stok baru. Helper nama tidak dipakai pada alur submit, inventory, atau checkout.

Penggantian ke satuan ukur baku lewat tindakan pengguna menghitung faktor baku yang sudah berlaku. Membuka varian baku tidak menghitung ulang nilai tersimpan. Mengganti izin tidak mengubah varian lama otomatis: konfigurasi yang menjadi tidak sah harus ditinjau atau dinonaktifkan.

Tes integrasi menggunakan hasil pengaturan UI untuk membuat Bensin, stok awal 20 Liter, menjual 2 Botol 1,5 Liter + 1 Jeriken 5 Liter + 1,25 Liter aktual. Total konsumsi 9,25 Liter, saldo akhir 10,75 Liter. Tes juga memeriksa retry idempoten, tiga ledger SALE, schema tetap v3, jumlah master unit tetap, dan edit isi berikutnya tidak mengubah SaleItem/ledger lama.

## 10. Hasil verifikasi dan batasan

Verifikasi dijalankan pada 22 Oktober 2026:

| Perintah | Hasil |
| --- | --- |
| `npm run lint` | Lulus, exit 0; tanpa error/warning ESLint |
| `npm run typecheck` | Lulus, exit 0; app, konfigurasi Node dan skrip tes |
| `npm run test:product-units` | 16 lulus, 0 gagal; mencakup 15 tes baru serta tes DOM Stok/review legacy yang sudah ada |
| `npm test` | **201 lulus, 0 gagal**, 0 skipped/cancelled; 186 tes sebelumnya + 15 tes baru. Suite penuh dijalankan ulang setelah koreksi klasifikasi konfigurasi legacy, hasil tetap 201/201 |
| `npm run build` | Lulus, exit 0; Vite 8.3.4, JS 565,03 kB (gzip 169,81 kB), CSS 39,47 kB (gzip 8,48 kB) |

Suite penuh tetap mencakup inventory, unit policy, konversi, shared stock antarvarian, domain/service/UI checkout, idempotency/concurrency/rollback, migrasi lama, riwayat, struk dan Dashboard. Tes migrasi yang sudah ada hanya dijalankan pada database tes; perubahan UX ini tidak menambahkan atau menjalankan migrasi pada data pengguna.

Catatan output: build masih memperingatkan chunk >500 kB (BL-001). Suite tes lulus, tetapi harness DOM riwayat mencetak diagnostic TypeError `FormData` akibat perbedaan global Node/jsdom, dan tes DOM lama dapat mencetak warning React `act` (BL-015). Ini dicatat sebagai perbaikan harness terpisah; hasil exit/assertion lulus tidak berarti semua diagnostic tes bersih. Tidak ada klaim bahwa diagnostic tersebut merupakan bug browser produksi.

Masalah UX yang diperbaiki: konversi tidak lagi ditanyakan pada penjualan langsung; isi kemasan wajib eksplisit; label harga menyebut satuan jual; nama berukuran yang tidak cocok diberi bantuan; fixed/variable tidak lagi berlabel fitur mendatang; konfigurasi lama tidak dinormalisasi pada mount. Konfigurasi legacy antarunit jumlah yang tidak kompatibel tetap tampil sebagai perlu review, bukan keliru dianggap ukuran baku.

Tidak ditemukan regresi kritis inventory/checkout pada pengujian ini. Tidak ada dependency baru, pengujian manual browser/tablet, commit/push, atau implementasi fase berikutnya.

Batasan yang tetap ada: bantuan nama bukan parser ukuran lengkap; harga perlu ditinjau setelah mengganti satuan; konfigurasi lama yang salah tidak diperbaiki massal; transaksi/saldo terdahulu tetap perlu ditinjau jika dahulu memakai isi keliru. Penyempurnaan nonkritis dicatat pada [Project Backlog](PROJECT-BACKLOG.md).
