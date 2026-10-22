# POS-Zanna — Project Backlog

Pembaruan 22 Oktober 2026, setelah finalisasi gabungan 4.6 + 4.7. Daftar ini berisi optimisasi/nonkritis yang ditunda agar roadmap inti berjalan. Bug kritis uang/stok/atomicity/kehilangan data tidak boleh hanya dipindahkan ke daftar ini untuk menyatakan langkah selesai.

| ID | Kategori/prioritas | Temuan aktual | Tindak lanjut ketika waktunya tepat |
| --- | --- | --- | --- |
| BL-001 | Performa, nonblocking | Vite memperingatkan chunk utama 558,59 kB (>500 kB), gzip 167,85 kB pada final Fase 4; setelah UX satuan 565,03 kB, gzip 169,81 kB; build tetap lulus | Optimasi bundle sengaja ditunda sesuai arahan finalisasi; jangan menaikkan threshold untuk menyembunyikan warning |
| BL-002 | Performa data, nonblocking | Riwayat per produk dibaca seluruhnya lalu ditampilkan bertahap 50 baris | Evaluasi pagination memakai indeks productId+createdAt pada data besar, pertahankan snapshot dan urutan audit |
| BL-003 | Performa checkout, nonblocking | context membaca seluruh master/balance dalam transaksi; listUnresolved memeriksa tiap PREPARED | Ukur dengan katalog/intent realistis; pertimbangkan bulkGet/query terarah tanpa memindahkan validasi keluar transaksi |
| BL-004 | UX audit, enhancement | SALE memiliki saleId/saleItemId dan reason nomor struk; detail ledger UI belum menampilkan semua referensi penjualan | Tambahkan akses audit/receipt saat scope UI penjualan disetujui; tidak mengedit histori |
| BL-005 | UX recovery, enhancement | Summary intent menampilkan UUID varian dan nilai konfirmasi karena intent v1 tidak menyimpan snapshot nama; struk committed sudah memakai snapshot SaleItem | Tambahkan presentasi referensi produk yang jelas tanpa mengganti payload/expected tersimpan atau menganggap nama katalog sekarang sebagai histori |
| BL-006 | UX quantity, minor | Jumlah item launcher masih menjumlah satuan jual yang dapat berbeda (kemasan/L/kg); pecahan memakai tampilan number bawaan | Evaluasi label jumlah baris dan format lokal konsisten, tanpa mengubah scaled quantity di domain |
| BL-007 | Selesai sebagian pada 4.5 | Riwayat penjualan committed dan pencarian struk kini tersedia pada /penjualan, independen dari pointer checkout | Sisa UX opsional: evaluasi pembukaan otomatis struk terakhir saat session dipulihkan; tidak mengubah recovery uncertain |
| BL-008 | Performa query, nonblocking | Riwayat memakai indeks createdAt dan limit pageSize+1; substring receipt dan skip tie timestamp dapat memindai banyak header | Ukur pada volume realistis; pertimbangkan jalur indeks receipt untuk pencarian lengkap atau compound cursor bila kebutuhan nyata, tanpa memuat seluruh SaleItem |
| BL-009 | UX riwayat, enhancement | Filter URL dipertahankan, tetapi posisi scroll dan halaman load more kembali ke awal setelah navigasi; jumlah baris tidak ada pada header Sale | Evaluasi restore posisi dan count yang diperoleh secara benar bila dibutuhkan; jangan menambah angka dummy atau query seluruh SaleItem hanya untuk label daftar |
| BL-010 | Performa Dashboard, nonblocking | Dashboard memvalidasi seluruh graph Sale tujuh hari dan lima recent, lalu membaca products/units/balances dalam satu transaksi r; liveQuery membaca ulang saat data terkait berubah | Ukur pada volume realistis sebelum query/cache/incremental aggregation; jangan mengorbankan atomic snapshot atau menambah schema tanpa kebutuhan |
| BL-011 | UX Dashboard, minor | Top products dipisah berdasarkan satuan jual snapshot, stok menampilkan lima contoh per status dan jumlah total, pergantian hari diperiksa tiap 30 detik/focus | Evaluasi detail presentasi dan timezone perangkat berubah tanpa tanggal berganti bila dibutuhkan; tidak mencampur kuantitas berbeda unit |

## Penyempurnaan form satuan produk (22 Oktober 2026)

| ID | Kategori/prioritas | Temuan / batasan | Tindak lanjut ketika diperlukan |
| --- | --- | --- | --- |
| BL-012 | Bantuan input, minor | Peringatan nama mengenali ukuran eksplisit berat/volume dan padanan baku; nama multipack/rentang/singkatan lain dapat ambigu | Evaluasi contoh nama pengguna sebelum memperluas pengenalan. Tetap nonblocking, jangan menjadikan nama sumber konversi atau mengubah isi otomatis |
| BL-013 | UX satuan, minor | Master saat ini menyediakan 10 satuan; form memakai izin kemasan dan satuan yang sudah ada, tanpa membuat master otomatis | Jika ada kebutuhan satuan baru, rancang pengelolaan master dan persetujuan eksplisit pada scope terpisah; jangan menebak kapasitas dari nama |
| BL-014 | Validasi perangkat, pending pengguna | Form baru lulus tes DOM otomatis; tampilan native, keyboard desimal, gulir dialog tablet dan pembaca layar belum diuji manual | Jalankan checklist pada panduan satuan produk; tidak menganggap jsdom sebagai bukti responsivitas visual |
| BL-015 | Harness tes, minor | Suite penuh lulus 201/201, tetapi harness DOM riwayat mencetak TypeError FormData Node/jsdom; tes DOM lama juga sesekali mencetak warning React act | Selaraskan globals FormData dengan window jsdom dan batas act pada harness, lalu pastikan diagnostic bersih; tidak mengubah runtime aplikasi atau menganggap diagnostic sebagai bukti kegagalan browser |

Panduan dan audit perubahan: [Satuan dan varian produk](USER-GUIDE-PRODUCT-UNITS.md). Pengaturan baru tidak memperbaiki transaksi/saldo lama otomatis; harga per satuan jual perlu diperiksa pengguna setelah mengganti cara menjual.

## Roadmap terpisah, belum diimplementasikan

Langkah 4.4 sudah mengintegrasikan UI tunai/receipt/recovery aktif per tab, menjaga UUID saat uncertain dan freeze/clear cart berdasarkan kepemilikan. Pengguna melaporkan checkout bensin dan produk lain telah diuji manual. Langkah 4.5 menambahkan [riwayat dan struk hanya-baca](PHASE-4-5-SALES-HISTORY.md). Pengujian visual/native browser/tablet 4.5 masih pending oleh pengguna. Tidak ada kelanjutan fase berikutnya tanpa persetujuan.

Backup/restore, autentikasi owner, pembatalan/retur, laporan HPP, PWA, backend dan sinkronisasi tetap memerlukan fase/aturan sendiri. IndexedDB lokal belum menjadi backup permanen. Jurnal UI tetap memakai sessionStorage per tab + localStorage per operasi/last receipt untuk checkout. Riwayat membaca Sale melalui service dan dapat membuka struk lama walaupun pointer checkout tidak tersedia. Dashboard kini nyata/live, halaman Laporan tetap DEMO. Lihat [laporan final](PHASE-4-FINAL-REPORT.md). Pengujian native Dashboard baru masih pending; Fase 5 belum diimplementasikan.
