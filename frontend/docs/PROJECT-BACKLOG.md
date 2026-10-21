# POS-Zanna — Project Backlog

Pembaruan 21 Oktober 2026, setelah Langkah 4.4. Daftar ini berisi optimisasi/nonkritis yang ditunda agar roadmap inti berjalan. Bug kritis uang/stok/atomicity/kehilangan data tidak boleh hanya dipindahkan ke daftar ini untuk menyatakan langkah selesai.

| ID | Kategori/prioritas | Temuan aktual | Tindak lanjut ketika waktunya tepat |
| --- | --- | --- | --- |
| BL-001 | Performa, nonblocking | Vite memperingatkan chunk utama 541,49 kB (>500 kB), gzip 162,56 kB setelah integrasi checkout UI, build tetap lulus | Evaluasi lazy route/code splitting setelah alur inti stabil; jangan menaikkan threshold untuk menyembunyikan warning |
| BL-002 | Performa data, nonblocking | Riwayat per produk dibaca seluruhnya lalu ditampilkan bertahap 50 baris | Evaluasi pagination memakai indeks productId+createdAt pada data besar, pertahankan snapshot dan urutan audit |
| BL-003 | Performa checkout, nonblocking | context membaca seluruh master/balance dalam transaksi; listUnresolved memeriksa tiap PREPARED | Ukur dengan katalog/intent realistis; pertimbangkan bulkGet/query terarah tanpa memindahkan validasi keluar transaksi |
| BL-004 | UX audit, enhancement | SALE memiliki saleId/saleItemId dan reason nomor struk; detail ledger UI belum menampilkan semua referensi penjualan | Tambahkan akses audit/receipt saat scope UI penjualan disetujui; tidak mengedit histori |
| BL-005 | UX recovery, enhancement | Summary intent menampilkan UUID varian dan nilai konfirmasi karena intent v1 tidak menyimpan snapshot nama; struk committed sudah memakai snapshot SaleItem | Tambahkan presentasi referensi produk yang jelas tanpa mengganti payload/expected tersimpan atau menganggap nama katalog sekarang sebagai histori |
| BL-006 | UX quantity, minor | Jumlah item launcher masih menjumlah satuan jual yang dapat berbeda (kemasan/L/kg); pecahan memakai tampilan number bawaan | Evaluasi label jumlah baris dan format lokal konsisten, tanpa mengubah scaled quantity di domain |
| BL-007 | UX struk, enhancement | Struk terakhir dibuka otomatis saat session direstore; daftar seluruh penjualan committed belum tersedia | Rancang histori penjualan tersimpan dan pencarian nomor struk pada scope berikut; jangan memakai data DEMO sebagai histori nyata |

## Roadmap terpisah, belum diimplementasikan

Langkah 4.4 sudah mengintegrasikan UI tunai/receipt/recovery aktif per tab, menjaga UUID saat uncertain dan freeze/clear cart berdasarkan kepemilikan. Lihat [dokumentasi dan checklist manual](PHASE-4-4-CASHIER-INTEGRATION.md). Pengujian visual/native browser/tablet masih pending oleh pengguna. Fase 4.5 belum dijalankan dan membutuhkan persetujuan.

Backup/restore, autentikasi owner, pembatalan/retur, laporan HPP, PWA, backend dan sinkronisasi tetap memerlukan fase/aturan sendiri. IndexedDB lokal belum menjadi backup permanen. Jurnal UI kini memakai sessionStorage per tab + localStorage per operasi/last receipt sehingga tab ditutup tetap dapat dipulihkan. Jika semua pointer lokal dihapus sementara Sale masih ada, UI belum mempunyai pencarian seluruh histori penjualan. Tidak ada implementasi tambahan atas item roadmap ini pada 4.4.
