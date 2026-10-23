# Panduan pengujian manual Fase 6

Status: **belum dijalankan oleh agen**. Pengguna melakukan Manual Browser Testing dan Tablet Testing. Automated Tests dijalankan agen dan hasilnya terpisah pada [laporan validasi](PHASE-6-VALIDATION-REPORT.md).

## 1. Fitur dan lokasi

| Fitur | Lokasi | Jenis |
| --- | --- | --- |
| Periode, metode, penjualan, kas, piutang, grafik, terlaris | Dashboard → filter dan kartu | DIPERBARUI |
| Laba kotor ringkas | Dashboard → Laba Kotor | BARU |
| Laporan nyata dan detail | Laporan → Penjualan → nomor struk | DIPERBARUI |
| HPP/laba lengkap atau parsial | Laporan → Laba Kotor | BARU |
| Piutang, status/pencarian, pembayaran | Laporan → Piutang → nomor tagihan/bukti | BARU |
| Unduh CSV | Laporan → tab terkait → Ekspor CSV | BARU |
| Template, preview, validasi dan impor | Produk → Impor Excel | BARU |
| Penanda Fase 6 dan laporan nyata | Welcome; footer; Pengaturan → Informasi aplikasi / Backup | DIPERBARUI |
| Snapshot modal dalam commit checkout | Tidak ada tombol tambahan; terjadi pada penjualan baru | INTERNAL SAJA |

## 2. Persiapan aman

Fase 1–5 sudah diuji manual oleh pengguna menurut instruksi Fase 6. Tidak perlu mengulangi semua alurnya.

Gunakan profil browser uji atau origin khusus yang berbeda dari origin operasional. Contoh terminal kedua pada frontend:

```powershell
npm run dev -- --port 5174 --strictPort
```

Buka alamat **http://localhost:5174** yang ditampilkan terminal. Port 5174 menyimpan data uji terpisah dari port 5173. Pastikan ini memang origin uji baru yang belum pernah dipakai untuk data penting. Jangan clear/reset data di origin lama. Pada tablet, alamat LAN juga merupakan origin tersendiri; jangan menganggap datanya otomatis sama dengan localhost.

Seluruh langkah yang menulis produk, stok, pelanggan atau transaksi contoh di bawah hanya untuk origin/profil uji. Jangan membuat transaksi uang nyata demi menguji laporan. Hak akses belum tersedia: gunakan nama pelanggan dan data barang rekaan tanpa informasi sensitif. Jangan mempublikasikan data asli.

Siapkan kategori **Uji Fase 6** melalui Produk → Kategori. Unduh template Excel dan isi contoh berikut, satu baris per varian. Harga/isi menggunakan sel angka Excel; Kode Produk, SKU dan Barcode menggunakan sel Teks. Tanda koma desimal mengikuti pengaturan Excel, bukan teks Rupiah.

| Kode Produk | Nama Produk | Kategori | Satuan Dasar | Jenis Produk | Harga Modal | Stok Minimum | Nama Varian | Satuan Jual | Isi Satuan Dasar | Harga Jual | Mode Jumlah | SKU | Barcode |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UJI-BENSIN | Bensin Uji F6 | Uji Fase 6 | l | BBM | 10000 | 5 | Botol 1,5 L | botol | 1,5 | 18000 | TETAP | UJI-BOTOL | 001500 |
| UJI-BENSIN | Bensin Uji F6 | Uji Fase 6 | l | BBM | 10000 | 5 | Jeriken 5 L | jeriken | 5 | 60000 | TETAP | UJI-JERIKEN | 005000 |
| UJI-SOLAR | Solar Uji F6 | Uji Fase 6 | l | BBM | 10000 | 5 | Per Liter | l | 1 | 13000 | BEBAS | UJI-SOLAR | 001300 |
| UJI-BERAS | Beras Uji F6 | Uji Fase 6 | kg | UMUM | 12000 | 5 | Per Kilogram | kg | 1 | 15000 | BEBAS | UJI-BERAS | 001200 |
| UJI-MI | Mi Uji F6 | Uji Fase 6 | bungkus | UMUM | 2500 | 5 | Bungkus | bungkus | 1 | 3000 | TETAP | UJI-MI | 000300 |
| UJI-MI | Mi Uji F6 | Uji Fase 6 | bungkus | UMUM | 2500 | 5 | Dus 40 | dus | 40 | 120000 | TETAP | UJI-MI-DUS | 040300 |

Untuk contoh modal tidak lengkap, buat produk **Tanpa Modal Uji F6**, biarkan modal kosong, satuan bungkus, harga jual Rp3.000. Jangan mengubah data operasional untuk menyiapkan skenario ini.

## 3. Manual Browser Testing — hanya Fase 6/terdampak

### Pengujian: kondisi laporan kosong

- [ ] Selesai diperiksa.
- Lokasi: origin uji baru → Dashboard dan Laporan.
- Persiapan: belum ada penjualan.
- Langkah: buka Dashboard; pilih Hari Ini lalu 7 Hari Terakhir. Buka Laporan → Penjualan, Laba Kotor, Piutang.
- Hasil yang diharapkan: angka nol yang sesuai, grafik hari tetap ada, pesan belum ada transaksi/tagihan; tidak ada transaksi DEMO atau laba rekaan.
- Tanda gagal: angka transaksi muncul tanpa data, loading tidak selesai, layar rusak atau pesan DEMO sebagai laporan produksi.
- Prioritas: WAJIB.

### Pengujian: template dan preview tanpa perubahan data

- [ ] Selesai diperiksa.
- Lokasi: Produk → Impor Excel.
- Persiapan: kategori Uji Fase 6 tersedia; file enam baris contoh di atas sudah disimpan .xlsx dengan satu lembar.
- Langkah: unduh template, periksa 14 judul kolom. Isi file, pilih file tersebut, periksa ringkasan dan harga/isi/barcode. Belum mencentang persetujuan. Tekan Batal, lalu buka daftar Produk.
- Hasil yang diharapkan: preview 4 produk/6 varian; Botol = 1,5 Liter, Jeriken = 5 Liter, Dus = 40 Bungkus; barcode 001500 tetap berawalan nol. Tidak ada produk ditambah saat file dipilih atau modal dibatalkan.
- Tanda gagal: produk muncul sebelum konfirmasi, isi berubah menjadi 1 Liter, barcode kehilangan nol, atau harga dibaca sebagai pecahan.
- Prioritas: WAJIB.

### Pengujian: impor valid dan persetujuan eksplisit

- [ ] Selesai diperiksa.
- Lokasi: Produk → Impor Excel → pilih file → centang persetujuan → Konfirmasi impor.
- Persiapan: preview valid dari file contoh dan nama produk belum ada.
- Langkah: pilih ulang file. Pastikan tombol konfirmasi terkunci sebelum persetujuan. Centang persetujuan, tekan Konfirmasi impor; boleh mencoba dua klik cepat. Setelah sukses, muat ulang halaman Produk dan buka Stok.
- Hasil yang diharapkan: tepat 4 produk/6 varian baru, pesan sukses, tetap ada setelah refresh. Produk baru berstatus stok belum diatur, bukan saldo rekaan. Tidak ada kategori/satuan baru otomatis atau duplikat dari dua klik.
- Tanda gagal: tersimpan sebagian, hasil berlipat, produk lama ditimpa, stok bertambah otomatis, atau konfirmasi bisa dijalankan sebelum persetujuan.
- Prioritas: WAJIB.

### Pengujian: kesalahan baris dan konflik impor

- [ ] Selesai diperiksa.
- Lokasi: Produk → Impor Excel.
- Persiapan: salinan file contoh; jangan memakai file/data penting.
- Langkah: buat nama produk baru pada semua kelompok agar tidak tertahan konflik lama. Ubah salah satu harga menjadi -1, satu isi menjadi 0, dua barcode sama, dan kosongkan satu Nama Produk. Pilih file. Ulangi dengan barcode bertipe angka, kategori yang belum dibuat, file .xls, lalu file valid yang produknya sudah diimpor.
- Hasil yang diharapkan: nomor baris Excel dan pesan mudah dipahami; konfirmasi terkunci jika ada kesalahan. File lama/format salah ditolak. File produk lama ditolak sebagai konflik; tidak menimpa data. Perbaiki file dan pilih ulang sebelum mencoba.
- Tanda gagal: baris lain tersimpan walaupun masih ada kesalahan, barcode ganda lolos, file terpilih langsung menulis, atau konflik memperbarui master lama.
- Prioritas: WAJIB.

### Pengujian: perubahan produk saat preview terbuka

- [ ] Selesai diperiksa.
- Lokasi: dua tab origin uji → Produk.
- Persiapan: file valid dengan nama/SKU/barcode baru.
- Langkah: tab pertama pilih file hingga preview. Di tab kedua edit nama satu produk uji dan simpan. Kembali tab pertama, centang persetujuan dan konfirmasi impor.
- Hasil yang diharapkan: impor ditolak karena data berubah; tidak ada produk impor tersimpan. Pilih ulang file untuk memuat preview baru.
- Tanda gagal: perubahan tab kedua ditimpa atau sebagian produk impor muncul setelah penolakan.
- Prioritas: OPSIONAL; perlindungan transaksi juga diuji otomatis.

### Pengujian: snapshot modal dari checkout tunai baru

- [ ] Selesai diperiksa.
- Lokasi: Stok → Kasir → Dashboard → Laporan → Laba Kotor.
- Persiapan: origin uji dengan Bensin Uji F6 modal Rp10.000 per Liter; atur stok awal 20 Liter melalui Stok. Catat bahwa langkah ini menguji integrasi snapshot baru, bukan mengulang semua skenario checkout lama.
- Langkah: jual **1 Botol 1,5 L** secara tunai Rp18.000, uang diserahkan Rp20.000. Buka Laporan Hari Ini. Kemudian edit modal master menjadi Rp11.000/Liter dan buka kembali laporan, tanpa transaksi kedua.
- Hasil yang diharapkan: penjualan Rp18.000, Uang Diterima Rp18.000 sesudah kembalian, HPP Rp15.000, Laba Kotor Rp3.000. Setelah edit master, transaksi ini tetap HPP Rp15.000/laba Rp3.000, stok 18,5 Liter. Membaca/ekspor laporan tidak mengurangi stok lagi.
- Tanda gagal: HPP hanya Rp10.000, laba berubah setelah edit master, Uang Diterima Rp20.000, atau laporan mengurangi stok.
- Prioritas: WAJIB.

### Pengujian: Bon dan cicilan tidak menggandakan penjualan

- [ ] Selesai diperiksa.
- Lokasi: Pelanggan & Bon → Kasir → Dashboard / Laporan → Piutang.
- Persiapan: pelanggan rekaan aktif dan stok uji tersedia. Kembalikan modal Bensin Uji F6 ke Rp10.000/Liter sebelum transaksi contoh ini jika ingin HPP yang sama. Ini hanya integrasi agregasi baru, bukan seluruh pengujian Bon Fase 5.
- Langkah: catat Bon **1 Botol 1,5 L** Rp18.000. Catat perubahan kartu penjualan, kas, dan sisa piutang. Bayar cicilan Rp5.000 melalui tagihan yang sama, lalu kembali Laporan/Dashboard. Buka nomor tagihan dan salah satu bukti melalui tab Piutang.
- Hasil yang diharapkan: Bon menambah penjualan Rp18.000 dan piutang Rp18.000, belum menambah Uang Diterima. Cicilan menambah Uang Diterima Rp5.000 dan mengurangi Sisa Piutang menjadi Rp13.000; penjualan, jumlah transaksi, HPP dan stok tidak berubah lagi. Status sebagian dibayar, struk/bukti dapat dibuka melalui alur lama.
- Tanda gagal: cicilan menambah penjualan/jumlah transaksi atau mengurangi stok lagi; kas dihitung sama dengan seluruh nilai Bon.
- Prioritas: WAJIB.

### Pengujian: periode dan metode konsisten

- [ ] Selesai diperiksa.
- Lokasi: Dashboard dan Laporan → Periode / Metode pembayaran.
- Persiapan: dua penjualan contoh dari langkah sebelumnya. Bila tidak ada data tanggal lain, gunakan rentang tanggal yang mencakup hari ini dan rentang yang tidak mencakupnya.
- Langkah: bandingkan Hari Ini, 7 Hari Terakhir, Bulan Ini dan Rentang Tanggal dengan tanggal awal/akhir yang sama. Bandingkan kartu kedua halaman untuk periode/metode yang sama. Pilih Tunai, lalu Bon, lalu Tunai + Bon. Isi tanggal awal setelah tanggal akhir.
- Hasil yang diharapkan: penjualan/jumlah/metode sama antarhalaman dengan filter yang sama; rentang tanpa transaksi menampilkan nol. Tunai mengecualikan cicilan; Bon menyertakan cicilan pada periode tetapi bukan sebagai penjualan baru. Tanggal tidak valid menampilkan error tanpa angka lama yang menyesatkan. Saldo piutang/stok tetap saat ini dan diberi label.
- Tanda gagal: tanggal akhir menghilangkan transaksi di hari itu, filter berbeda antarhalaman, nilai lama tetap ditampilkan saat error, atau piutang saat ini disalahartikan sebagai saldo historis.
- Prioritas: WAJIB.

### Pengujian: laba parsial dan transaksi lama

- [ ] Selesai diperiksa.
- Lokasi: Laporan → Laba Kotor; Dashboard → Laba Kotor.
- Persiapan: produk Tanpa Modal Uji F6 dengan stok uji. Alternatif: laporan lama pada origin operasional boleh dibaca saja, tanpa membuat transaksi/modifikasi.
- Langkah: di origin uji jual satu produk tanpa modal. Baca laporan laba. Setelahnya isi modal master dan buka laporan transaksi yang sama lagi.
- Hasil yang diharapkan: peringatan PARSIAL/baris tanpa modal; baris tersebut dikecualikan dari penjualan bermodal dan HPP/laba diketahui. Mengisi modal sesudah transaksi tidak menambal histori. Sale lama sebelum Fase 6 juga ditandai parsial bila belum punya snapshot.
- Tanda gagal: barang tanpa modal dianggap seluruh harga jualnya sebagai laba pasti, modal terbaru mengganti histori, atau label parsial tidak ada.
- Prioritas: WAJIB.

### Pengujian: ekspor CSV sesuai tab/filter

- [ ] Selesai diperiksa.
- Lokasi: Laporan → Penjualan / Laba Kotor / Piutang → Ekspor CSV.
- Persiapan: transaksi uji dan aplikasi Excel/pembaca CSV tersedia.
- Langkah: pilih periode dan metode, ekspor masing-masing tab. Buka unduhan dan bandingkan total, nomor struk dan status dengan layar. Coba dua klik cepat pada tombol ekspor. Jika Excel membuka satu kolom, gunakan Data → Dari Teks/CSV dan pilih delimiter koma/UTF-8.
- Hasil yang diharapkan: file terunduh dengan nama tab/periode; isi sesuai tab. Penjualan tidak berisi HPP/laba. Ekspor laba mencantumkan PARSIAL jika perlu. CSV Piutang berisi seluruh tagihan saat ini serta pembayaran periode/metode utama; pencarian/status lokal daftar bukan filter ekspornya. Satu proses ekspor aktif; tidak ada perubahan saldo/stok.
- Tanda gagal: omzet memasukkan pembayaran lagi, harga/modal terbaru mengganti historis, isi lintas tab tertukar, atau file kosong/rusak.
- Prioritas: WAJIB.

### Pengujian: akses pengembangan dan informasi aplikasi

- [ ] Selesai diperiksa.
- Lokasi: Dashboard → Laba Kotor; Laporan → Laba Kotor; Produk → Impor Excel; Pengaturan → Informasi aplikasi.
- Persiapan: tidak perlu akun/PIN; gunakan data tidak sensitif.
- Langkah: buka lokasi-lokasi tersebut dan baca keterangan akses/status.
- Hasil yang diharapkan: fitur dapat diakses tanpa login sesuai keputusan pengguna; ada penjelasan pembatasan pemilik belum diterapkan; informasi aplikasi Fase 6 dan laporan nyata. Tidak ada klaim OWNER sudah terlindungi.
- Tanda gagal: muncul PIN/login/role palsu, fitur diklaim aman untuk banyak pengguna, atau laporan masih dilabeli DEMO.
- Prioritas: WAJIB.

### Pengujian: upgrade data lama hanya-baca

- [ ] Selesai diperiksa.
- Lokasi: origin lama → Dashboard / Laporan / satu struk yang sudah ada.
- Persiapan: catat satu nomor struk dan saldo produk sebelum memakai build baru; jangan menghapus data atau membuat transaksi nyata. Migrasi v4→v5 sudah diuji otomatis pada data terisolasi.
- Langkah: buka aplikasi baru pada origin/profil lama, muat ulang tab lama jika diminta. Buka laporan dan struk yang dicatat; periksa saldo yang sama tanpa mutasi.
- Hasil yang diharapkan: struk/saldo/master tetap ada. Data lama belum memiliki modal snapshot, sehingga laba parsial adalah wajar. Tidak ada seed/reset/data hilang.
- Tanda gagal: struk lama hilang, saldo berganti, upgrade meminta menghapus data, atau laba lama direka dari modal terkini.
- Prioritas: WAJIB untuk integrasi data lama; cukup cek sampel, bukan mengulang semua Fase 1–5.

## 4. Tablet Testing — dilakukan pengguna jika perangkat tersedia

### Pengujian: navigasi, filter, tabel, dan modal impor Fase 6

- [ ] Selesai diperiksa pada tablet: __________; ukuran/orientasi: __________.
- Lokasi: Dashboard; Menu → Laporan; Menu → Produk → Impor Excel.
- Persiapan: origin LAN/profil **uji** tablet; file contoh tersedia di perangkat. Data tablet tidak otomatis sama dengan localhost desktop.
- Langkah: coba portrait dan landscape, pilih periode/metode, pindah tab laporan, geser tabel horizontal, buka detail struk lalu kembali. Pada impor buka petunjuk, pilih file, baca preview/kesalahan, gulir ke persetujuan dan tombol; batalkan bila tidak ingin menyimpan.
- Hasil yang diharapkan: filter/tombol dapat disentuh, angka tidak bertumpuk, hanya area tabel bergeser, dialog bisa digulir hingga tombol, keyboard tidak menutupi tindakan, navigasi kembali tetap tersedia. Gunakan Tab/Escape pada desktop sebagai pemeriksaan fokus dasar.
- Tanda gagal: tombol terpotong/tidak dapat dicapai, halaman melebar tanpa kendali, keyboard mengunci dialog, atau menu/detail tidak bisa ditutup.
- Prioritas: WAJIB jika tablet tersedia; jika belum tersedia tandai BELUM DIUJI, jangan menganggap tes DOM sebagai kelulusan perangkat.

## 5. Area lama yang perlu/tidak perlu diuji ulang

| Area terdampak langsung | Mengapa cukup integrasi singkat |
| --- | --- |
| Satu checkout CASH dan BON | Commit sekarang menambah snapshot biaya atomik; cek HPP dan stok sekali saja |
| Satu cicilan | Laporan kini membaca kas/piutang; cek tidak menjadi penjualan kedua |
| Struk/tagihan lama dan satu saldo | Upgrade additive perlu verifikasi sampel data pengguna tetap terbaca |
| Produk/varian hasil impor | Jalur pembuatan baru memakai aturan lama, perlu cocokkan satuan/harga/stok belum diatur |
| Menu desktop/tablet | Laporan diganti dan impor menambah dialog/tombol |

Tidak perlu mengulang manual seluruh tambah/edit/arsip pelanggan, semua kombinasi inventory/koreksi, seluruh recovery checkout/pembayaran, semua kebijakan kemasan lama, pagination riwayat, QRIS nonaktif, atau pengaturan printer/warung lama. Logika tersebut tidak diubah Fase 6 dan regresinya tetap dijalankan otomatis. Bila ditemukan gejala baru pada integrasi singkat, catat lokasi/langkah/angka yang terlihat untuk investigasi.

## 6. Catatan hasil pengguna

Tanggal/perangkat/origin: __________

- [ ] Seluruh pengujian WAJIB browser lulus.
- [ ] Tablet lulus, atau [ ] belum tersedia/belum diuji.
- [ ] Tidak memakai transaksi uang nyata atau data sensitif untuk demo.
- [ ] Data operasional tidak dihapus/reset.

Temuan: nomor pengujian, langkah, hasil aktual dan hasil yang diharapkan: __________

Tidak ada commit/push otomatis atau kelanjutan Fase 7/Authentication & Authorization sebelum evaluasi pengguna.
