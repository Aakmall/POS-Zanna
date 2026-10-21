# POS-Zanna — Project Backlog

Pembaruan 21 Oktober 2026, setelah Langkah 4.3. Daftar ini berisi optimisasi/nonkritis yang ditunda agar roadmap inti berjalan. Bug kritis uang/stok/atomicity/kehilangan data tidak boleh hanya dipindahkan ke daftar ini untuk menyatakan langkah selesai.

| ID | Kategori/prioritas | Temuan aktual | Tindak lanjut ketika waktunya tepat |
| --- | --- | --- | --- |
| BL-001 | Performa, nonblocking | Vite memperingatkan chunk utama 508,18 kB (>500 kB), build tetap lulus | Evaluasi lazy route/code splitting setelah alur inti stabil; jangan menaikkan threshold untuk menyembunyikan warning |
| BL-002 | Performa data, nonblocking | Riwayat per produk dibaca seluruhnya lalu ditampilkan bertahap 50 baris | Evaluasi pagination memakai indeks productId+createdAt pada data besar, pertahankan snapshot dan urutan audit |
| BL-003 | Performa checkout, nonblocking | context membaca seluruh master/balance dalam transaksi; listUnresolved memeriksa tiap PREPARED | Ukur dengan katalog/intent realistis; pertimbangkan bulkGet/query terarah tanpa memindahkan validasi keluar transaksi |
| BL-004 | UX audit, enhancement | SALE memiliki saleId/saleItemId dan reason nomor struk; detail ledger UI belum menampilkan semua referensi penjualan | Tambahkan akses audit/receipt saat scope UI penjualan disetujui; tidak mengedit histori |

## Roadmap terpisah, belum diimplementasikan

Langkah 4.4: integrasi UI tunai/receipt/recovery aktif per tab, menjaga UUID saat uncertain, freeze/clear cart setelah commit, pengujian manual browser/tablet. Ini langkah berikut yang membutuhkan evaluasi dan persetujuan, bukan bug yang dibiarkan pada engine.

Backup/restore, autentikasi owner, pembatalan/retur, laporan HPP, PWA, backend dan sinkronisasi tetap memerlukan fase/aturan sendiri. IndexedDB lokal belum menjadi backup permanen. Tidak ada implementasi tambahan atas item roadmap ini pada 4.3.
