# POS-Zanna — Project Backlog

Pembaruan 23 Oktober 2026, setelah Fase 6. Daftar ini berisi optimisasi/nonkritis dan keputusan penundaan yang eksplisit. Bug kritis uang/stok/atomicity/kehilangan data tidak boleh hanya dipindahkan ke daftar ini untuk menyatakan langkah selesai. Autentikasi ditunda oleh pengguna: aplikasi hanya development/testing, belum operasional multiuser.

| ID | Kategori/prioritas | Temuan aktual | Tindak lanjut ketika waktunya tepat |
| --- | --- | --- | --- |
| BL-001 | Performa, nonblocking | Vite memperingatkan chunk utama 558,59 kB pada final Fase 4; setelah UX satuan 565,03 kB; final Fase 5 606,28 kB (>500 kB), gzip 179,24 kB; build tetap lulus | Optimasi bundle sengaja ditunda sesuai arahan finalisasi; jangan menaikkan threshold untuk menyembunyikan warning |
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
| BL-015 | Harness tes, diperbaiki sebagian pada Fase 5 | Globals FormData harness riwayat kini memakai jsdom; TypeError FormData tidak muncul. Final 260/260 lulus; suite Bon 59/59 bersih. Suite penuh masih sesekali mencetak warning act dari harness DemoProvider lama | Lengkapi batas act/settling pada harness lama jika diperbaiki; jangan menyembunyikan diagnostic atau mengubah runtime aplikasi demi tes |

Panduan dan audit perubahan: [Satuan dan varian produk](USER-GUIDE-PRODUCT-UNITS.md). Pengaturan baru tidak memperbaiki transaksi/saldo lama otomatis; harga per satuan jual perlu diperiksa pengguna setelah mengganti cara menjual.

## Finalisasi Fase 5 — nonkritis

| ID | Kategori/prioritas | Temuan aktual | Tindak lanjut |
| --- | --- | --- | --- |
| BL-016 | Performa piutang, nonblocking | Overview memvalidasi seluruh graph tagihan/pembayaran; pelanggan/tagihan belum dipaginasi. Scope transaksi pembayaran luas untuk memastikan snapshot konsisten | Ukur dengan data realistis, rancang pagination/query terarah tanpa memperlemah integritas atau memindahkan validasi saldo keluar transaksi |
| BL-017 | UX piutang, minor | Detail tagihan dibaca on-demand; tutup/buka ulang untuk perubahan tab lain. Filter daftar berada di state halaman | Evaluasi live detail dan persist filter bila dibutuhkan; expectedBalance tetap melindungi konfirmasi usang |
| BL-018 | UX pembayaran, kebutuhan masa depan | Pembayaran per tagihan dengan nominal tepat; belum ada bayar gabungan, uang muka checkout, bunga/denda, koreksi/refund atau edit bukti | Tetapkan kebijakan audit pada fase tersendiri sebelum implementasi; jangan mengubah event pembayaran lama |
| BL-019 | Validasi native, pending pengguna | Bon/cicilan/recovery lulus pengujian otomatis; tampilan/fokus/keyboard/upgrade pada tablet operasional belum diuji manual | Jalankan checklist PHASE-5-FINAL-REPORT.md sebelum menutup validasi pengguna dan commit/push |

Fase 5 membuat pelanggan/Bon/cicilan nyata secara lokal. Omzet Dashboard mencakup CASH + BON; penerimaan kas terpisah belum menjadi metrik Dashboard. Dokumentasi: [PHASE-5-FINAL-REPORT.md](PHASE-5-FINAL-REPORT.md).

## Roadmap terpisah, belum diimplementasikan

Langkah 4.4 sudah mengintegrasikan UI tunai/receipt/recovery aktif per tab, menjaga UUID saat uncertain dan freeze/clear cart berdasarkan kepemilikan. Pengguna melaporkan checkout bensin dan produk lain telah diuji manual. Langkah 4.5 menambahkan [riwayat dan struk hanya-baca](PHASE-4-5-SALES-HISTORY.md). Pengujian visual/native browser/tablet 4.5 masih pending oleh pengguna. Tidak ada kelanjutan fase berikutnya tanpa persetujuan.

Backup/restore, autentikasi owner, pembatalan/retur, PWA, backend dan sinkronisasi tetap memerlukan fase/aturan sendiri. IndexedDB lokal belum backup permanen. Dashboard/Laporan/HPP nyata pada Fase 6; modal lama tanpa snapshot tetap parsial. Pengujian Fase 6 native menunggu pengguna. Fase 7 belum dimulai.

## Fase 6 — tindak lanjut dan batas yang disepakati

| ID | Kategori/prioritas | Temuan aktual | Tindak lanjut |
| --- | --- | --- | --- |
| BL-020 | Keamanan, ditunda eksplisit pengguna | Tidak ada PIN/login/role/guard OWNER. Laba/modal dan impor terbuka untuk development/testing | Fase Authentication & Authorization tersendiri; izin rancangan reports.profit.view, products.import.confirm, products.cost.view wajib ditegakkan pada service/API/ekspor; belum siap operasional multiuser |
| BL-021 | Performa laporan, nonblocking | Query memvalidasi graph transaksi/Bon dan daftar belum dipaginasi; custom dibatasi 366 hari | Ukur dengan data realistis sebelum indeks/pagination/worker; jangan memperlemah integritas |
| BL-022 | HPP historis, batas data | Transaksi sebelum snapshot v5 tidak mempunyai modal sah; laba parsial | Jangan backfill dari harga master terbaru. Jika diperlukan koreksi historis, tetapkan sumber bukti dan kebijakan audit terpisah |
| BL-023 | UX impor, kebutuhan masa depan | Impor create-only, 500 baris/2 MB/satu lembar; kategori/satuan harus tersedia; tidak ada update master atau impor stok | Evaluasi update berbasis identitas dan jurnal durable impor bila dibutuhkan. Respons commit yang tidak terlihat diperiksa lewat daftar produk, bukan retry buta |
| BL-024 | Ekspor, nonblocking | CSV memakai koma/UTF-8; sebagian Excel perlu memilih delimiter saat membuka. Piutang mengekspor seluruh tagihan, bukan filter pencarian/status lokal | Pertimbangkan ekspor XLSX laporan atau penyelarasan filter ekspor lokal jika pengguna membutuhkannya; ekspor laporan bukan backup |
| BL-025 | Validasi native Fase 6, pending pengguna | Tes otomatis lulus; tampilan/file picker/unduhan/keyboard tablet belum diuji agen | Ikuti PHASE-6-MANUAL-TEST-GUIDE, hanya fitur baru/terdampak |
| BL-026 | Informasi lama, minor | ProductDetails masih memiliki teks mode variable lama yang menyebut belum tersedia di Kasir | Rapikan label pada tahap kosmetik terpisah; logika variable tidak diubah Fase 6 |

Peringatan bundle utama >500 kB (BL-001) tetap terlihat; Excel memakai dynamic import. Warning React act pada harness CreditPage/DemoProvider dapat muncul di suite penuh (BL-015); jangan disembunyikan. Hasil dan ukuran build aktual: [validasi Fase 6](PHASE-6-VALIDATION-REPORT.md).
