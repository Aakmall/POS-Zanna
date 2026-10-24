# Pengujian manual khusus Fase 7

24 Oktober 2026. **Belum dijalankan oleh agen.** Fase 1–6 sudah diuji manual pemilik proyek menurut instruksi terbaru; panduan ini tidak meminta pengulangan seluruh fitur lama. Hasil otomatis terpisah pada [laporan validasi](PHASE-7-VALIDATION-REPORT.md).

## A. Persiapan terisolasi — wajib sebelum restore

Jangan melakukan uji restore pada database berisi data penting. Jangan menghapus/reset site data operasional atau mengimpor file contoh ke sana. Gunakan profil browser khusus **Uji POS-Zanna**, origin/port uji yang belum dipakai untuk toko, serta nama/barang/pelanggan rekaan.

Fitur PWA harus diperiksa melalui build/preview, bukan hanya npm run dev:

```powershell
cd C:\04-Project-TOKO\POS-Zanna\frontend
npm run build
npm run preview -- --host 127.0.0.1 --port 4174 --strictPort
```

Buka **http://localhost:4174** pada profil uji. Localhost adalah secure context yang didukung browser. Port/profil/origin berbeda berarti database berbeda. Pastikan profil/port ini memang belum pernah dipakai untuk data penting. Aplikasi menampilkan origin melalui alamat browser; versi PWA terpasang dapat menyembunyikan address bar, jadi catat profil/origin yang digunakan.

Untuk menguji restore ke profil lain, buat **profil browser Uji Pemulihan** dan buka origin localhost:4174 yang sama dari profil tersebut. Data kedua profil terpisah, sedangkan file cadangan dapat dipindahkan melalui folder unduhan. Jangan membuka profil toko untuk pengujian ini.

Pada tablet Android: `http://192.168...` LAN biasa tidak memenuhi syarat SW/Web Locks. Gunakan origin **HTTPS tepercaya** dengan sertifikat yang diterima perangkat, deployment pada root `/`. Hosting/TLS tidak dibuat otomatis pada fase ini. Jika belum tersedia, tandai tes PWA/tablet BELUM DIUJI; jangan mematikan keamanan browser atau menganggap HTTP LAN mendukungnya. Jangan menguji offline sebelum Aset aplikasi menunjukkan siap.

Siapkan data uji kecil melalui UI yang sudah tersedia:

- satu kategori/produk uji, satuan dasar Bungkus, harga Rp3.000, modal Rp2.500;
- stok awal 10 Bungkus;
- pelanggan rekaan Pelanggan Uji;
- satu checkout CASH satu Bungkus dan satu Bon satu Bungkus;
- cicilan Bon Rp1.000 jika ingin membandingkan piutang/riwayat. Semua ini hanya data uji, tanpa uang/transaksi nyata.

Catat: penjualan Rp6.000, Uang Diterima Rp4.000, sisa Bon Rp2.000, stok 8 Bungkus, HPP Rp5.000/laba Rp1.000. Jika menggunakan data uji berbeda, catat angka aktual sebelum backup. Baca struk/tagihan untuk pembanding. Tidak perlu menguji semua variasi checkout/recovery lama.

## B. Peta fitur

| Fitur | Lokasi | Jenis |
| --- | --- | --- |
| Online/offline dan tautan update | Di bawah header halaman operasional | BARU |
| Kesiapan aset, instalasi dan update | Pengaturan → Aplikasi & Offline | BARU |
| Backup lengkap | Pengaturan → Backup & Pemulihan → Cadangkan Data | BARU |
| Validasi/preview file | Backup & Pemulihan → Pilih File Cadangan | BARU |
| Pemulihan penuh | Centang persetujuan → ketik PULIHKAN DATA → Konfirmasi Pemulihan | BARU |
| Pengunci setelah restore/update | Layar Muat ulang sekarang | BARU |
| Label fase dan status PWA | Welcome/footer/Informasi aplikasi | DIPERBARUI |
| Lease writes dan cache aset | Tidak ada menu tersendiri | INTERNAL SAJA |

## C. Manual Browser Testing — dilakukan pengguna

### Pengujian: instalasi dan kesiapan PWA

- [ ] Hasil dicatat.
- Lokasi: origin/profil uji → Pengaturan → Aplikasi & Offline.
- Persiapan: production preview berjalan dan jaringan tersedia untuk load pertama.
- Langkah: buka aplikasi, tunggu Aset aplikasi menjadi siap. Jika tombol Pasang POS-Zanna muncul, tekan dan selesaikan dialog browser. Jika tidak muncul, periksa menu browser → Pasang aplikasi/Tambahkan ke layar utama bila tersedia. Buka aplikasi yang dipasang.
- Hasil yang diharapkan: nama POS-Zanna, ikon tas/Z, tampilan standalone pada browser yang mendukung. Jika instalasi tidak didukung, ada petunjuk dan tidak ada tombol palsu yang tidak berfungsi.
- Tanda gagal: manifest/icon gagal dimuat, tombol tidak melakukan apa pun padahal browser mendukung, tampilan blank, atau ready ditampilkan sebelum load aset berhasil.
- Prioritas: WAJIB pada browser desktop/Android yang mendukung; bila platform tidak mendukung catat kondisi tersebut.

### Pengujian: buka ulang/deep link ketika offline

- [ ] Hasil dicatat.
- Lokasi: Dashboard, Kasir, Pelanggan & Bon, Laporan, Pengaturan.
- Persiapan: aset siap pada profil uji; produk/stok/pelanggan uji tersedia. Jangan menghapus cache/data.
- Langkah: matikan koneksi perangkat atau gunakan mode Offline di alat pengembang browser. Buka beberapa menu, muat ulang `/kasir` dan `/laporan`, lalu tutup/buka kembali PWA atau tab dengan origin yang sama. Coba membuka modal Impor Excel dan mengunduh template tanpa mengimpor data baru; ini mengecek chunk dinamis ikut tersedia.
- Hasil yang diharapkan: aplikasi tetap terbuka, route bekerja, data uji ada, indikator offline tampil; laporan/Excel tidak memerlukan unduhan modul dari internet lagi. Tidak ada klaim tersinkronisasi atau sudah dicadangkan.
- Tanda gagal: blank/halaman jaringan gagal, lazy chunk tidak tersedia, data menghilang setelah reload, atau status jaringan disamakan dengan backup.
- Prioritas: WAJIB.

### Pengujian: integrasi transaksi lokal offline

- [ ] Hasil dicatat.
- Lokasi: Kasir → Pelanggan & Bon → Dashboard/Laporan pada profil uji.
- Persiapan: tetap offline; stok uji cukup dan pelanggan rekaan aktif. Semua transaksi hanya contoh.
- Langkah: lakukan satu transaksi uji tunai dan satu Bon; lakukan satu cicilan uji. Catat struk, stok dan piutang. Muat ulang lalu baca hasil yang sama.
- Hasil yang diharapkan: penjualan/struk tersimpan, stok berkurang sekali per penjualan, cicilan hanya mengurangi utang/menambah kas, tidak menambah omzet kedua; data tetap setelah refresh offline.
- Tanda gagal: operasi menunggu internet/API, klik menghasilkan duplikat, cicilan mengurangi stok lagi, atau hasil hilang saat reload.
- Prioritas: WAJIB. Ini integrasi offline singkat, bukan mengulang seluruh Fase 1–6.

### Pengujian: membuat dan memeriksa file cadangan

- [ ] Hasil dicatat.
- Lokasi: Pengaturan → Backup & Pemulihan → Cadangkan Data.
- Persiapan: catat beberapa angka/struk/stok uji sebelum klik. Bisa dilakukan offline setelah aset siap.
- Langkah: tekan Cadangkan Data sekali; coba dua klik cepat bila ingin menguji guard. Selesaikan dialog/unduhan browser, simpan file. Buka salinan file dengan editor teks hanya untuk membaca (jangan ubah file asli). Periksa nama POS-Zanna-cadangan dan waktu, format POS_ZANNA_BACKUP, schemaVersion 5, counts/data 14 kelompok, checksum. Baca lagi angka sumber.
- Hasil yang diharapkan: file JSON valid dengan seluruh kategori data; sumber tidak berubah. Pesan aplikasi menyatakan file disiapkan/diperiksa, bukan mengklaim disk atau enkripsi terjamin.
- Tanda gagal: file kosong/rusak, data sumber berubah, hanya produk yang tercakup, atau file diklaim terenkripsi padahal teks terbaca.
- Prioritas: WAJIB.

### Pengujian: preview tanpa restore dan pembatalan

- [ ] Hasil dicatat.
- Lokasi: profil **Uji Pemulihan** → Pengaturan → Backup & Pemulihan.
- Persiapan: profil kedua bukan toko; beri satu produk rekaan berbeda agar terlihat bahwa nanti datanya diganti. Catat jumlah/angka sekarang. Buat dan simpan cadangan kondisi profil kedua melalui Cadangkan Data.
- Langkah: pilih file dari profil sumber. Baca jumlah Sekarang vs Cadangan dan waktu. Jangan menyetujui/mengetik konfirmasi; kembali Dashboard atau muat ulang.
- Hasil yang diharapkan: file hanya diperiksa; seluruh data profil kedua tetap, belum ada data sumber masuk. Tombol pemulihan terkunci sampai semua konfirmasi terpenuhi.
- Tanda gagal: data langsung berubah saat file dipilih atau preview dibuka, atau tombol bisa dijalankan tanpa persetujuan.
- Prioritas: WAJIB.

### Pengujian: restore penuh dan verifikasi hasil

- [ ] Hasil dicatat.
- Lokasi: hanya profil **Uji Pemulihan**, pada Backup & Pemulihan.
- Persiapan: cadangan sumber valid; sudah Cadangkan Data kondisi profil kedua dalam sesi ini dan menyimpan file; keranjang kosong; tidak ada recovery/intent tertunda. Tutup semua jendela/tab origin ini lainnya pada profil kedua.
- Langkah: pilih ulang file sumber. Baca perbandingan. Centang persetujuan bahwa file kondisi sekarang sudah disimpan; ketik **PULIHKAN DATA** persis; tekan Konfirmasi Pemulihan satu kali. Tunggu, lalu tekan Muat ulang sekarang. Baca Produk/Stok/Pelanggan & Bon/Riwayat/Laporan dan buka satu struk/bukti.
- Hasil yang diharapkan: seluruh data hasil restore sama dengan source saat snapshot dibuat. Produk rekaan target yang tidak ada pada cadangan hilang karena penggantian penuh yang disetujui, bukan merge. Stok/piutang/penjualan/HPP/struk sesuai catatan; pembacaan tidak mencatat transaksi baru. UI lama terkunci sampai reload.
- Tanda gagal: data campuran source/target, jumlah tabel/relasi tidak cocok, stok/utang berubah sendiri, snapshot historis berubah, atau masih bisa bertransaksi lewat UI lama setelah restore.
- Prioritas: WAJIB. Jangan jalankan pada profil operasional/data penting.

### Pengujian: file rusak/versi salah ditolak

- [ ] Hasil dicatat.
- Lokasi: profil Uji Pemulihan → Backup & Pemulihan.
- Persiapan: salinan cadangan uji, jangan edit cadangan asli. Catat data target.
- Langkah: pada salinan, ubah satu angka tanpa memperbarui checksum dan simpan nama berbeda; pilih file. Ulangi dengan file JSON berisi `{}` atau formatVersion/schemaVersion yang tidak didukung.
- Hasil yang diharapkan: pesan file/versi/keutuhan tidak valid, tidak ada tombol konfirmasi restore valid, data target tetap. Tidak ada tebakan nilai atau instruksi reset data.
- Tanda gagal: file diterima lalu sebagian data ditulis, aplikasi mengubah nilai otomatis, atau data target hilang.
- Prioritas: WAJIB. Duplikat/referensi rusak/fault write rinci diuji otomatis; tidak perlu merusak database lewat DevTools.

### Pengujian: tab lain memblokir restore

- [ ] Hasil dicatat.
- Lokasi: dua tab origin sama pada profil Uji Pemulihan → Backup & Pemulihan.
- Persiapan: target/source uji; buat cadangan kondisi sekarang, preview valid.
- Langkah: buka tab kedua aplikasi. Pada tab pertama berikan persetujuan dan konfirmasi pemulihan. Setelah ditolak, tutup tab kedua, periksa ulang file dan ulangi hanya pada profil uji.
- Hasil yang diharapkan: percobaan pertama ditolak sebelum perubahan, meminta menutup jendela/tab lain. Setelah ditutup dan diperiksa ulang barulah dapat memulihkan. Jendela PWA standalone dihitung juga, bukan hanya tab browser.
- Tanda gagal: restore mengganti data saat tab kedua masih bisa menyimpan dengan state lama.
- Prioritas: WAJIB.

### Pengujian: keranjang/recovery dan perubahan sejak preview

- [ ] Hasil dicatat.
- Lokasi: profil uji → Kasir lalu Pengaturan → Backup & Pemulihan.
- Persiapan: bukan data toko; file valid.
- Langkah: isi satu barang ke keranjang, buka panel pemulihan dan preview. Tombol restore harus terkunci. Kosongkan keranjang. Untuk stale preview, buat cadangan/preview, lalu pindah ke Produk dan edit nama produk uji sebelum kembali/periksa lagi; pastikan preview baru diperlukan. Jika UI menunjukkan operasi tertunda normal, gunakan Periksa hasil/pemulihan untuk menyelesaikannya, bukan membuat fault lewat DevTools.
- Hasil yang diharapkan: keranjang atau jurnal/intent aktif tidak dilewati; target yang berubah sejak preview tidak ditimpa berdasarkan plan lama. Tidak ada perintah execute otomatis saat restore/reload.
- Tanda gagal: restore berjalan sambil checkout aktif atau perubahan terbaru tertimpa tanpa pemeriksaan ulang.
- Prioritas: OPSIONAL untuk variasi stale/intent; guard sudah diuji otomatis. Pemeriksaan keranjang sederhana dianjurkan.

### Pengujian: pembaruan tanpa kehilangan data

- [ ] Hasil dicatat.
- Lokasi: profil uji → banner Pembaruan tersedia → Pengaturan → Aplikasi & Offline.
- Persiapan: aplikasi build pertama sudah dibuka/terpasang, catat data uji dan simpan backup. Pengujian update membutuhkan build versi berbeda. Boleh ubah sementara teks deskripsi aplikasi pada salinan/worktree khusus uji, build lagi dan restart preview di port yang sama, lalu kembalikan perubahan uji; jangan melakukan eksperimen deployment pada data penting. Alternatif lebih mudah: uji ketika pembaruan berikutnya benar-benar tersedia.
- Langkah: biarkan aplikasi lama terbuka saat build baru disajikan; hubungkan jaringan kembali atau buka ulang untuk pemeriksaan versi. Amati bahwa halaman tidak reload paksa. Buka panel update setelah pekerjaan selesai. Buka tab kedua dan coba menerapkan untuk memastikan ditolak; tutup tab kedua, kosongkan keranjang, centang persetujuan dan Terapkan Pembaruan. Setelah proses selesai tekan Muat ulang sekarang.
- Hasil yang diharapkan: banner/aksi jelas, tidak reload saat form/transaksi belum selesai, data uji tetap, aset versi baru berjalan. Tidak ada clear IndexedDB. Jika aktivasi terlambat, halaman lama tetap memerlukan reload dan tidak kembali menulis dengan aset campuran.
- Tanda gagal: reload otomatis tanpa tindakan, data hilang, tab lama tetap dapat menyimpan sesudah update diterapkan, atau lazy chunk versi lama/baru tercampur.
- Prioritas: WAJIB ketika tersedia dua build; jika belum tersedia tandai BELUM DIUJI. Tes emulator update bukan kelulusan browser nyata.

## D. Tablet Testing — dilakukan pengguna jika perangkat tersedia

### Pengujian: instalasi, file picker, offline dan tombol pada tablet

- [ ] Perangkat: __________; origin HTTPS: __________; portrait/landscape: __________.
- Lokasi: header, Pengaturan → Aplikasi & Offline / Backup & Pemulihan.
- Persiapan: HTTPS tepercaya pada origin/profil uji tablet, satu file backup uji tersedia dan aset siap. Jangan pakai data sensitif.
- Langkah: instal bila didukung; matikan jaringan dan buka ulang. Coba portrait/landscape, menu, gulir tabel perbandingan 14 jenis data, pilih file, baca error/preview, ketik konfirmasi pada keyboard Android; batalkan jika belum ingin restore. Coba unduh cadangan dan temukan file di pengelola unduhan. Jika menguji restore, hanya profil/origin uji yang boleh diganti.
- Hasil yang diharapkan: kontrol dapat disentuh, kolom tabel bisa digeser, keyboard tidak menutup tombol/konfirmasi, tidak ada tombol hilang, file unduhan dapat ditemukan, akses offline stabil.
- Tanda gagal: tombol terpotong, dialog/file picker macet, input tidak dapat dijangkau, data hilang atau terduplikasi.
- Prioritas: WAJIB bila tablet dan HTTPS tersedia; bila tidak, catat BELUM DIUJI.

## E. Area lama yang terdampak dan yang tidak perlu diulang

| Integrasi singkat | Alasan |
| --- | --- |
| Satu CASH, Bon dan cicilan offline | Memastikan cache aplikasi dan pengaman write tetap memakai service lokal yang sama |
| Sampel inventory/struk/piutang/HPP setelah restore | Replacement 14 tabel harus menjaga semua relasi |
| Buka modal/template Excel offline | Modul lazy harus ikut precache |
| Menu/fokus/tabel Pengaturan | Panel dan notifikasi baru memerlukan pemeriksaan native |

Tidak perlu mengulang manual seluruh CRUD/arsip pelanggan, semua konversi varian, semua jenis koreksi stok, seluruh recovery/fault checkout, semua filter/ekspor laporan, seluruh validasi impor Excel, atau pengaturan printer simulasi yang tidak diubah. Seluruh regresi otomatis Fase 1–6 tetap dijalankan. Jika gejala baru muncul pada integrasi singkat, laporkan langkah konkret dan angka sebelum/sesudah.

## F. Catatan hasil pemilik

Tanggal/browser/profil/origin: __________

- [ ] Seluruh pengujian WAJIB browser yang tersedia lulus.
- [ ] Update dua build lulus / [ ] belum tersedia.
- [ ] Tablet lulus / [ ] belum tersedia/HTTPS belum siap.
- [ ] Restore hanya dilakukan pada profil/origin uji.
- [ ] Tidak menghapus/reset data operasional dan tidak melakukan transaksi uang nyata.
- [ ] Cadangan asli disimpan dengan aman; file sensitif tidak dibagikan publik.

Temuan: nama pengujian, langkah, hasil aktual dan hasil yang diharapkan: __________

Jangan menyamakan online, PWA terpasang, atau cache siap dengan backup permanen/sinkronisasi. Autentikasi/enkripsi backup belum tersedia. Tunggu evaluasi sebelum commit/push atau fase berikutnya.
