# POS-Zanna — Project Backlog

Pembaruan 22 Oktober 2026, setelah Langkah 4.5. Daftar ini berisi optimisasi/nonkritis yang ditunda agar roadmap inti berjalan. Bug kritis uang/stok/atomicity/kehilangan data tidak boleh hanya dipindahkan ke daftar ini untuk menyatakan langkah selesai.

| ID | Kategori/prioritas | Temuan aktual | Tindak lanjut ketika waktunya tepat |
| --- | --- | --- | --- |
| BL-001 | Performa, nonblocking | Vite memperingatkan chunk utama 554,07 kB (>500 kB), gzip 166,08 kB setelah riwayat penjualan 4.5, build tetap lulus | Evaluasi lazy route/code splitting setelah alur inti stabil; jangan menaikkan threshold untuk menyembunyikan warning |
| BL-002 | Performa data, nonblocking | Riwayat per produk dibaca seluruhnya lalu ditampilkan bertahap 50 baris | Evaluasi pagination memakai indeks productId+createdAt pada data besar, pertahankan snapshot dan urutan audit |
| BL-003 | Performa checkout, nonblocking | context membaca seluruh master/balance dalam transaksi; listUnresolved memeriksa tiap PREPARED | Ukur dengan katalog/intent realistis; pertimbangkan bulkGet/query terarah tanpa memindahkan validasi keluar transaksi |
| BL-004 | UX audit, enhancement | SALE memiliki saleId/saleItemId dan reason nomor struk; detail ledger UI belum menampilkan semua referensi penjualan | Tambahkan akses audit/receipt saat scope UI penjualan disetujui; tidak mengedit histori |
| BL-005 | UX recovery, enhancement | Summary intent menampilkan UUID varian dan nilai konfirmasi karena intent v1 tidak menyimpan snapshot nama; struk committed sudah memakai snapshot SaleItem | Tambahkan presentasi referensi produk yang jelas tanpa mengganti payload/expected tersimpan atau menganggap nama katalog sekarang sebagai histori |
| BL-006 | UX quantity, minor | Jumlah item launcher masih menjumlah satuan jual yang dapat berbeda (kemasan/L/kg); pecahan memakai tampilan number bawaan | Evaluasi label jumlah baris dan format lokal konsisten, tanpa mengubah scaled quantity di domain |
| BL-007 | Selesai sebagian pada 4.5 | Riwayat penjualan committed dan pencarian struk kini tersedia pada /penjualan, independen dari pointer checkout | Sisa UX opsional: evaluasi pembukaan otomatis struk terakhir saat session dipulihkan; tidak mengubah recovery uncertain |
| BL-008 | Performa query, nonblocking | Riwayat memakai indeks createdAt dan limit pageSize+1; substring receipt dan skip tie timestamp dapat memindai banyak header | Ukur pada volume realistis; pertimbangkan jalur indeks receipt untuk pencarian lengkap atau compound cursor bila kebutuhan nyata, tanpa memuat seluruh SaleItem |
| BL-009 | UX riwayat, enhancement | Filter URL dipertahankan, tetapi posisi scroll dan halaman load more kembali ke awal setelah navigasi; jumlah baris tidak ada pada header Sale | Evaluasi restore posisi dan count yang diperoleh secara benar bila dibutuhkan; jangan menambah angka dummy atau query seluruh SaleItem hanya untuk label daftar |

## Roadmap terpisah, belum diimplementasikan

Langkah 4.4 sudah mengintegrasikan UI tunai/receipt/recovery aktif per tab, menjaga UUID saat uncertain dan freeze/clear cart berdasarkan kepemilikan. Pengguna melaporkan checkout bensin dan produk lain telah diuji manual. Langkah 4.5 menambahkan [riwayat dan struk hanya-baca](PHASE-4-5-SALES-HISTORY.md). Pengujian visual/native browser/tablet 4.5 masih pending oleh pengguna. Tidak ada kelanjutan fase berikutnya tanpa persetujuan.

Backup/restore, autentikasi owner, pembatalan/retur, laporan HPP, PWA, backend dan sinkronisasi tetap memerlukan fase/aturan sendiri. IndexedDB lokal belum menjadi backup permanen. Jurnal UI tetap memakai sessionStorage per tab + localStorage per operasi/last receipt untuk checkout. Riwayat 4.5 membaca Sale melalui service dan dapat membuka struk lama walaupun pointer checkout tidak tersedia. Dashboard/laporan tetap DEMO. Tidak ada implementasi tambahan atas item roadmap terpisah ini pada 4.5.
