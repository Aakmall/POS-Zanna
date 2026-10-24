# Fase 8 — Daftar validasi manual tertunda

24 Oktober 2026. **DITUNDA atas keputusan pengguna. Tidak ada pengujian manual browser/tablet yang dilakukan atau diklaim lulus. Dokumen ini untuk saat pengguna memilih melakukan validasi, bukan permintaan menguji sekarang.** Fase 1–6 yang stabil tidak perlu diuji ulang seluruhnya.

Gunakan profil/origin uji tanpa data sensitif. Jangan reset site data toko. Restore hanya di profil uji terpisah, setelah membuat dan menyimpan cadangan kondisi sekarang. Langkah prasyarat rinci ada pada [panduan Fase 7](PHASE-7-MANUAL-TEST-GUIDE.md).

```powershell
cd C:\04-Project-TOKO\POS-Zanna\frontend
npm run build
npm run preview -- --host 127.0.0.1 --port 4174 --strictPort
```

Localhost:4174 pada profil uji adalah origin tersendiri. Tablet membutuhkan HTTPS tepercaya pada root `/`; HTTP LAN biasa bukan pengganti secure context. Production build/SW diperlukan untuk validasi offline; dev server saja tidak cukup. Jangan menghapus cache bisnis untuk memaksa tes error.

## A. Pengujian manual Fase 7 yang belum selesai

Seluruh baris berstatus BELUM DIUJI. Daftar lengkap/skenario negatif tetap disimpan pada panduan Fase 7, tidak dihapus atau dicentang otomatis.

| Status | Lokasi | Pemeriksaan saat dijadwalkan | Hasil yang diharapkan |
| --- | --- | --- | --- |
| [ ] | Pengaturan → Aplikasi & Offline | Kesiapan aset, pemasangan dari browser, buka standalone desktop/Android | Nama/ikon benar; ready setelah precache; petunjuk jujur bila instalasi tidak didukung |
| [ ] | PWA/tab pada origin uji | Matikan jaringan setelah siap; tutup/buka ulang, refresh deep link dan kunjungi halaman | Shell/data lokal tersedia; tidak ada klaim backup/sinkronisasi |
| [ ] | Kasir → Bon → Laporan | Satu CASH, satu Bon dan satu cicilan contoh ketika offline, baca setelah refresh | Stok/penjualan sekali, cicilan hanya menambah kas/mengurangi utang |
| [ ] | Pengaturan → Backup & Pemulihan | Unduh file nyata, simpan media, pilih ulang untuk preview lalu batal | File valid, preview tidak menulis, unduhan/media benar-benar diperiksa pengguna |
| [ ] | Profil Uji Pemulihan → Backup & Pemulihan | Cadangkan target, preview source, centang, ketik PULIHKAN DATA, restore dan reload | Semua tabel sesuai source; UI lama terkunci; tidak ada data campuran |
| [ ] | Backup & Pemulihan | File rusak/versi salah, cart/recovery tertunda, jendela/tab lain | Ditolak sebelum write; target tetap; tidak ada saran reset |
| [ ] | Aplikasi & Offline | Update build, tetap bekerja dahulu, persetujuan/single-window lalu reload | Tidak reload paksa; state lama terkunci setelah aktivasi diterima |
| [ ] | Android/tablet | File picker/download/media, native install/offline, orientasi, keyboard dan dialog | Tombol terjangkau, isi terbaca, fokus/gulir tidak terperangkap |

## B. Pengujian manual baru Fase 8

| Status | Lokasi | Langkah terfokus | Hasil yang diharapkan |
| --- | --- | --- | --- |
| [ ] | Semua menu operasional | Pada profil uji/build baru, pindah setiap menu; bila perlu perlambat jaringan sebelum SW siap | Loading “Memuat halaman…” pada pemuatan tertunda; menu tetap bisa dipakai; tidak blank |
| [ ] | Desktop dan Menu mobile | Pindah Dashboard, Kasir, Produk, Stok, Riwayat, Bon, Laporan, Pengaturan lalu kembali | Path/title/konten benar; fokus utama dan navigasi keyboard layak; tidak perlu tombol baru untuk splitting |
| [ ] | Halaman yang gagal dimuat pada profil uji | Bila ingin simulasi, blokir satu lazy request hanya pada profil baru tanpa data penting; jangan hapus site data | Fallback Indonesia, tidak ada stack; Dashboard bisa dibuka; reload memerlukan konfirmasi dan menjelaskan draft/cart |
| [ ] | Produk → Tambah/Edit → Modal, Harga jual, Barcode | Masukkan harga 1,5 atau negatif; barcode dengan spasi/simbol; perbaiki ke 15.000 / barcode sah | Bantuan langsung, border dan aria-invalid sesuai; submit tidak menulis data tidak valid; kosong modal tetap belum diketahui |
| [ ] | Produk → Tambah/Edit/Kategori/konfirmasi aktif | Dua tekan cepat Simpan atau Ya, lanjutkan | Satu pemanggilan simpan; tombol sibuk; draft tetap terlihat jika gagal |
| [ ] | Stok → Tambah Stok/Koreksi | Dua tekan cepat; periksa preview dan hasil saldo; koreksi keluar tetap konfirmasi | Satu mutasi; satuan/faktor/saldo sama dengan aturan sebelumnya |
| [ ] | Produk → Detail → Varian | Baca varian berat/volume aktual dan bantuan dampak stok | Tidak lagi menyebut variable belum tersedia; bantuan menyebut tunai dan Bon |
| [ ] | Riwayat Penjualan | Baca empty state/penjelasan bawah | Menyebut tunai+Bon dan Laporan nyata; tidak menyebut Laporan DEMO |
| [ ] | Error penyimpanan yang terjadi pada profil uji | Baca pesan katalog/form/laporan/Bon/backup; jangan merusak database toko untuk simulasi | Pesan dengan tindakan, tidak stack native; tidak berubah menjadi metrik nol palsu; retry baca tidak menulis bisnis |
| [ ] | Pengaturan → Aplikasi & Offline | Amati bila probe aset gagal saat maintenance atau pemeriksaan update gagal | Ready tidak tetap true setelah probe gagal; ada petunjuk jaringan/reload; tidak memulihkan data sebagian |
| [ ] | Dialog form/tablet | Gunakan Tab, Shift+Tab, Escape, tutup, keyboard desimal dan reduced-motion | Fokus terlihat/kembali wajar, tombol bisa disentuh, dialog tidak tertutup ketika write berjalan, animasi menghormati preferensi |

Error yang sukar direproduksi aman sudah memiliki fault injection otomatis; tidak perlu merusak IndexedDB/cache/perangkat untuk meniru setiap exception. Bila tidak dijalankan, catat BELUM DIUJI, bukan LULUS.

## C. Integrasi lintas fase yang langsung terdampak

| Status | Skenario | Hasil yang diharapkan |
| --- | --- | --- |
| [ ] | Tambah satu baris cart → pindah Produk/Laporan/Bon/Pengaturan → kembali Kasir | Cart tetap, belum ada Sale atau stok berkurang. Draft halaman yang ditinggalkan bukan cart persisten |
| [ ] | Setelah aset siap, offline lalu buka kesembilan halaman termasuk yang belum pernah dikunjungi | Lazy chunks tersedia; tidak menunggu internet. Template Excel tetap bisa dimuat |
| [ ] | Satu CASH dan satu Bon contoh setelah navigasi → cicilan → struk/riwayat/Dashboard/Laporan | Total, konversi, stok, utang, uang diterima, HPP/snapshot tetap konsisten; pembacaan tidak menulis stok |
| [ ] | Dengan data contoh, refresh saat recovery diperlukan | ID lama dibuka untuk diperiksa; tidak autoexecute atau menerima uang ulang karena reload/boundary |
| [ ] | Backup/restore contoh setelah build baru, lalu baca struk/modal historis | Format v1/schema5 tetap diterima dan snapshot tidak berubah; update tidak menghapus IndexedDB |

Tidak meminta pengulangan semua kombinasi Fase 1–6. Catat browser/versi/perangkat/origin, langkah, expected vs aktual dan bukti saat validasi nanti dilakukan. Hasil otomatis ada pada [laporan validasi](PHASE-8-VALIDATION-REPORT.md).
