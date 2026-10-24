# Fase 7 — PWA, Offline-First, Backup & Restore

24 Oktober 2026. Status: **selesai dengan catatan**, menunggu validasi manual browser/tablet pengguna. Hasil eksekusi dan daftar file ada pada [laporan validasi](PHASE-7-VALIDATION-REPORT.md); langkah uji terisolasi ada pada [panduan manual](PHASE-7-MANUAL-TEST-GUIDE.md).

## 1. Audit awal dan keputusan

Baseline: Fase 6 dengan 313 tes; Git HEAD `56379e7498f514fa68021feb9eb00549cdd5bd05`, working tree awal bersih. Dokumentasi Fase 5/6, model master/inventory, transaksi, Bon, recovery, konfigurasi Vite/routing dan seluruh tabel diperiksa. Belum ada SW/cache/PWA, backup atau restore. Pengaturan warung/printer hanya simulasi state halaman, bukan data bisnis permanen. Autentikasi masih ditunda.

Tidak ada perubahan schema: Dexie **v5, 14 tabel**, database `zanna-cell-db`. Tidak membuat database bisnis kedua, backend, sinkronisasi, login/PIN, role palsu atau fase berikutnya. Tidak mengakses/mengubah database browser pengguna; pengujian data memakai fake-indexeddb terisolasi. Tidak commit/push.

## 2. Peta perubahan UI

| No. | Menu/Halaman | Fitur | Lokasi di Website | Jenis Perubahan |
| --- | --- | --- | --- | --- |
| 1 | Semua halaman operasional | Indikator jaringan dan penjelasan bukan status cadangan | Di bawah header | BARU |
| 2 | Pengaturan | Kesiapan offline dan instalasi PWA | Pengaturan → Aplikasi & Offline → Pasang POS-Zanna (jika didukung browser) | BARU |
| 3 | Pengaturan | Notifikasi dan penerapan update atas persetujuan | Banner Pembaruan tersedia → Pengaturan → Aplikasi & Offline → centang persetujuan → Terapkan Pembaruan → Muat ulang sekarang | BARU |
| 4 | Pengaturan | Unduh backup JSON lengkap | Pengaturan → Backup & Pemulihan → Cadangkan Data | BARU |
| 5 | Pengaturan | Pemeriksaan file, perbandingan jumlah dan pending operation | Pengaturan → Backup & Pemulihan → Pilih File Cadangan; pemeriksaan otomatis | BARU |
| 6 | Pengaturan | Restore penuh, persetujuan dan konfirmasi ketik | Backup & Pemulihan → centang persetujuan → ketik PULIHKAN DATA → Konfirmasi Pemulihan → Muat ulang sekarang | BARU |
| 7 | Welcome/layout/about | Status Fase 7/PWA dan jalur fitur | Welcome, footer, Pengaturan → Informasi aplikasi | DIPERBARUI |
| 8 | Tidak ada menu/tombol tersendiri | Cache seluruh aset build, lease penulisan, pengaman tab dan validasi graph | Internal saat load/update, write dan restore | INTERNAL SAJA |

Tampilan fitur lama tidak dirombak. Form pengaturan warung/printer tetap simulasi; backup/restore dan panel aplikasi kini nyata. Seluruh fitur sensitif tetap terbuka untuk development/testing sesuai keputusan autentikasi ditunda.

## 3. Arsitektur dan file penting

```text
Pengaturan / BackupPanel
  → BackupService (create / inspect / restore)
    → format, checksum dan validasi graph domain
      → DexieBackupRepository (snapshot r / replace rw seluruh tabel)
        → IndexedDB v5

Seluruh repository write lama → guardedWrite → AppSafety shared write lease
Restore/update → AppSafety exclusive tab + write leases → pemeriksaan SW windows

Vite tooling/pwaPlugin → asset list + hash build → dist/sw.js
main → PwaRuntime / AppSafety → indikator / instalasi / update terkontrol
```

| File/kelompok | Fungsi |
| --- | --- |
| tooling/pwaPlugin.ts | Plugin Vite kecil tanpa dependency baru; hash semua output/public assets dan emit SW saat production build |
| tooling/serviceWorker.ts | Sumber SW: precache, navigasi offline, status cache/client, update eksplisit dan cleanup cache aset versi lama |
| public/manifest.webmanifest, pwa-192.png, pwa-512.png | Manifest POS-Zanna standalone serta ikon PNG nyata, termasuk safe area maskable |
| src/pwa/pwaRuntime.ts | Registrasi production/secure, status, beforeinstallprompt, pemeriksaan worker dan aktivasi update |
| src/pwa/PwaStatus.tsx | Indikator jaringan; tautan update tanpa reload paksa |
| src/pwa/SafetyBoundary.tsx | Mencegah interaksi saat maintenance; setelah restore/update wajib reload untuk meninggalkan state/form lama |
| domain/backup.ts | Whitelist tabel, format v1/schema5, kontrak service/repository/gate dan preview |
| domain/backupFormat.ts | Serialisasi canonical, counts, SHA-256, metadata, parse ketat, batas ukuran dan pending operasi |
| domain/backupValidation.ts | Master, uniqueness, Sale/Item/intent, Bon/pembayaran/biaya dan relasi antarentitas |
| domain/backupInventory.ts | Konversi historis, fingerprint manual, stok awal, seluruh rantai mutasi dan saldo akhir |
| data/dexieBackupRepository.ts | Snapshot konsisten; replacement atomik dengan preflight target dan readback sebelum commit |
| services/backupOperations.ts | Preview privat satu kali, backup kondisi sekarang, konfirmasi eksplisit dan koordinasi restore |
| services/backupService.ts | Composition root lokal; titik otorisasi masa depan |
| services/appSafety.ts, data/guardedWrite.ts | Web Locks lintas tab, gate maintenance dan larangan write state lama |
| services/recoverySafety.ts | Pemeriksaan jurnal/pointer checkout dan pembayaran; cleanup shortcut setelah sukses |
| features/settings/{BackupPanel,AppOfflinePanel}.tsx | UX backup/restore/install/update, loading/error/empty/konfirmasi |
| scripts/{backup-restore,app-safety,pwa}.test.ts, phase7-ui.test.tsx | Pengujian domain/integrasi/koordinasi/worker emulator/DOM |
| scripts/pwa-production.test.ts, pwa-fixtures.ts | HTTP production preview sementara dan emulator cache memakai output build sungguhan |

Kode tooling diletakkan pada `tooling/` karena aturan Git `**/build/` mengabaikan folder bernama build. Tidak mengubah .gitignore atau menyimpan source penting pada folder output yang diabaikan.

## 4. Cache aset dan offline

Manifest: POS-Zanna, bahasa Indonesia, display standalone, id/scope `/`, start `/dashboard`, theme teal, ikon 192/512 PNG. Deployment saat ini pada **root origin `/`**, sesuai routing proyek. Plugin menolak base subpath yang belum didukung, agar tidak menghasilkan PWA dengan cache/routing salah.

SW dihasilkan saat build, bukan development server. Daftar cache mencakup index HTML, JS/CSS, ilustrasi, favicon, manifest, ikon, serta seluruh chunk dinamis Excel. Tidak membutuhkan library PWA tambahan. Semua route navigasi aplikasi dapat memakai shell yang sama ketika offline setelah precache berhasil.

Cache Storage hanya aset yang tercantum dalam build. POST, URL API, cadangan JSON, data bisnis dan permintaan lintas origin tidak masuk strategi cache. Data master/transaksi tetap di IndexedDB; localStorage tetap hanya jurnal/pointer recovery lama, bukan database transaksi baru. Tidak ada runtime cache respons transaksi atau cloud sync palsu.

Install gagal tidak mengaktifkan SW baru dan cache parsial versinya dibuang; cache versi lama tetap tersedia. Saat activate, cleanup hanya nama cache `pos-zanna-app-*`; tidak menghapus IndexedDB atau cache aplikasi lain. Hash versi berubah bila aset berubah. HTML memakai shell versi SW aktif agar lazy chunk sejalan.

Offline siap hanya setelah SW memeriksa seluruh aset precache tersedia. `navigator.onLine` sekadar indikator jaringan, bukan jaminan internet, backup, atau sinkronisasi. Tidak ada CDN/font/API eksternal wajib untuk operasi bisnis lokal.

**HTTPS atau localhost diperlukan** untuk SW dan Web Locks. Alamat `http://192.168...` pada LAN biasa bukan secure context; jangan mengklaim PWA/restore aman berfungsi di sana. Instalasi Android memerlukan origin HTTPS tepercaya di tablet. Petunjuk fallback browser tampil jika beforeinstallprompt tidak tersedia; tombol tidak berfungsi tidak ditampilkan.

## 5. Backup lengkap dan format

Whitelist seluruh tabel aktual:

1. products
2. categories
3. units
4. variants
5. inventoryBalances
6. stockMovements
7. sales
8. saleItems
9. checkoutIntents
10. customers
11. receivables
12. creditPayments
13. creditPaymentIntents
14. saleItemCosts

Metadata file JSON: format POS_ZANNA_BACKUP, formatVersion 1, schemaVersion 5, appVersion phase-7, UUID file, createdAt UTC, jumlah per tabel, data, dan checksum SHA-256. Nama file mencantumkan POS-Zanna dan waktu. Versi lain ditolak bila belum ada migrasi file yang aman.

Snapshot dibaca melalui satu transaksi readonly seluruh tabel. Semua graph divalidasi sebelum file dibuat; byte JSON yang akan diunduh diparse/divalidasi kembali. Pembuatan backup tidak menulis database sumber. Write bersamaan tidak menghasilkan gabungan setengah commit. Pengaturan bisnis permanen belum tersedia; state simulasi printer/warung tidak diperlakukan sebagai setting tersimpan. Cache aset, kredensial, jurnal/pointer UI, filter dan keranjang tidak dimasukkan ke cadangan bisnis. Intent persisten ikut, sehingga operasi PREPARED dalam cadangan tetap dapat ditinjau melalui recovery setelah restore.

Nilai optional undefined tidak ditulis JSON (setara field optional tidak ada); nilai bisnis null/nol/boolean, UUID, timestamp, scaled integer, fingerprint dan snapshot dipertahankan. Tidak menebak modal kosong, harga, stok atau konversi. Objek siklik, kedalaman berlebihan, kolom/tabel tak dikenal, angka non-finite, file >50 MB atau >100.000 catatan ditolak. Data besar membutuhkan mekanisme terpisah, bukan restore parsial.

Checksum mendeteksi perubahan byte/logika isi yang tidak cocok, **bukan tanda tangan keaslian** dan bukan enkripsi. Orang yang mengubah file dapat menghitung ulang checksum; gunakan hanya cadangan tepercaya. File memuat informasi pelanggan, transaksi dan keuangan. Aplikasi menyiapkan dan memvalidasi file, tetapi tidak dapat memastikan pengguna benar-benar menyelesaikan unduhan atau media simpan tetap sehat.

## 6. Validasi data dan kompatibilitas

- UUID/metadata/type/status, unique primary/index, barcode/SKU dan relasi master diperiksa.
- Domain checkout yang sudah ada memvalidasi Sale ↔ SaleItem ↔ intent ↔ SALE movement berdasarkan snapshot historis, bukan harga/nama master terbaru.
- Bon/payment graph yang sudah ada memvalidasi saldo, event pembayaran immutable, receipt, fingerprint dan intent. Tombstone pembayaran CANCELLED sebelum prepare boleh tidak memiliki tagihan, sesuai kontrak yang telah ada; tidak mempunyai efek uang.
- Snapshot modal diverifikasi terhadap SaleItem. Baris lama tanpa snapshot tetap diizinkan sebagai laba parsial; tidak dibackfill dari master terkini.
- Per produk, ledger dimulai tepat satu OPENING_BALANCE, setiap before/delta/after berantai, waktu monoton dan saldo terakhir/initializedAt/updatedAt cocok dengan InventoryBalance. Tidak menafsirkan saldo tanpa riwayat sebagai nol.
- Metadata master legacy tanpa unitPolicy yang pernah direview tetap dipertahankan tanpa membuat kebijakan palsu; transaksi baru tetap tunduk validasi Fase 3–6.

Cadangan dengan referensi putus atau target yang sudah tidak konsisten ditolak, tanpa auto-repair. Fase 7 bukan alat memperbaiki database korup dengan menebak. Migrasi DB v1–v5 lama tidak diubah. Belum ada format cadangan lama resmi sebelum Fase 7; file eksternal/versi lain tidak otomatis diimpor.

## 7. Restore penuh yang fail-safe

1. Cadangkan kondisi sekarang dan simpan unduhannya. Service mencatat fingerprint kondisi yang sudah dibuat/divalidasi dalam sesi ini; bukan bukti file tersimpan di disk.
2. Pilih file backup, parse/checksum/validasi graph seluruhnya. Hanya pembacaan, tanpa write.
3. Tampilkan waktu, jumlah per tabel sekarang/cadangan, dan operasi tertunda dari source.
4. Wajib centang persetujuan dan ketik PULIHKAN DATA persis. Keranjang harus kosong. Tutup semua tab/jendela aplikasi lainnya dan selesaikan recovery/jurnal yang ada.
5. Service menyimpan plan privat di WeakMap; objek preview UI tidak dapat mengganti payload. Plan dikonsumsi sebelum await, mencegah double submit. Setelah kegagalan harus periksa file lagi.
6. Dapatkan lease tab dan write eksklusif; probe SW wajib melihat tepat satu window origin ini termasuk yang belum dikontrol/versi lama. Bila ada tab lain, write aktif, browser tanpa dukungan, atau aset belum siap, **tolak sebelum write**.
7. Dalam satu transaksi rw seluruh 14 tabel: baca target lagi, bandingkan kondisi target dengan preview, pastikan tidak ada PREPARED target, clear/isi tabel, baca ulang, validasi graph dan bandingkan dengan canonical source yang telah dibekukan sebelum write.
8. Semua tabel commit bersama atau seluruh clear/insert rollback. Tidak menjalankan Dexie.delete/database delete, merge, commit parsial, atau reset sebelum validasi.
9. Setelah sukses UI lama dikunci dan pengguna menekan Muat ulang sekarang. Pointer struk/jurnal per-tab yang sudah tidak relevan dibersihkan terbatas pada key aplikasi yang dikenal, bukan seluruh localStorage. Source PREPARED tidak dijalankan otomatis.

Seluruh 15 transaksi rw lama pada repository master/inventory/checkout/customer/payment/impor dibungkus shared write lease. Pemanggilan nested di transaksi Dexie yang sama tidak meminta lock browser baru, untuk mencegah premature commit. Rumus checkout, stock movement, saldo piutang dan idempotency tidak diganti.

AppSafety menahan shared tab lease sepanjang dokumen hidup. Tab yang dibuka saat restore/update berlangsung ditandai wajib reload, bukan dibiarkan menulis state lama sesudah maintenance. Tab yang ditutup melepaskan lease melalui lifecycle browser. SW menghitung juga window versi lama yang belum memasang lease. Tidak menggunakan TTL atau localStorage lock yang dapat kedaluwarsa di tengah transaksi.

Tidak ada jaminan terhadap tindakan DevTools, browser yang melanggar API, media rusak/power loss, atau aplikasi versi nonkooperatif di luar model ini. Web Locks dan client probe adalah koordinasi, bukan autentikasi. Jika browser tidak mendukungnya, backup/preview tetap ada tetapi restore/update terkontrol dinonaktifkan.

## 8. Update aman

SW baru precache di background lalu menunggu. Tidak memanggil skipWaiting pada install dan tidak reload paksa saat pengguna mengisi form/transaksi. Banner mengarahkan ke Pengaturan → Aplikasi & Offline; berpindah halaman dan menyelesaikan pekerjaan adalah pilihan pengguna.

Terapkan Pembaruan memerlukan centang persetujuan, keranjang kosong, recovery/intent selesai, satu window dan lease write eksklusif. Worker juga memeriksa kembali client count sebelum menerima aktivasi. Begitu aktivasi disetujui, UI versi lama dikunci meskipun aktivasi kemudian timeout; tidak kembali mengizinkan write dengan aset/schema campuran. Setelah selesai, Muat ulang sekarang memuat build baru. Tidak membersihkan database saat membersihkan cache.

DB versionchange lama tetap menutup koneksi jika versi schema berubah di masa depan. Fase 7 sendiri tidak menaikkan schema; kompatibilitas fase masa depan harus diaudit lagi, bukan menganggap PWA menggantikan migrasi aman.

## 9. Authentication & Authorization — Deferred

Tidak ada login, PIN OWNER, sesi/role sementara, backend atau proteksi multiuser. Backup/restore/laba/modal terbuka untuk development/testing. Aplikasi belum boleh dianggap aman untuk operasional banyak pengguna.

Titik izin masa depan: BackupService.create → backups.export; inspect/restore → backups.restore, dengan pemeriksaan OWNER pada service/API saat backend tersedia. Jangan memasukkan rahasia autentikasi saat menambah schema/format baru; whitelist schema dan field harus ditinjau. Penjagaan UI saja tidak cukup. Jangan membagikan file cadangan sensitif dalam demo publik.

## 10. Risiko dan kesiapan

Penyimpanan browser bukan backup permanen; eviction/site-data-clear/kerusakan perangkat tetap berisiko. File backup lokal perlu pengelolaan media/salinan yang aman; belum terenkripsi. Offline PWA bukan sinkronisasi dan tidak otomatis menyatukan data perangkat/origin/profil berbeda. HTTPS tablet adalah prasyarat deployment pengguna, belum disiapkan hosting/cloud pada fase ini.

Pemeriksaan graph penuh/canonical memerlukan memori dan waktu; batas 50 MB/100.000 catatan sengaja fail-safe. Download, install, native offline, power-loss dan tablet harus diperiksa pengguna. Hasil emulator/HTTP preview tidak diklaim sebagai pengujian offline browser nyata. Bundle/harness warning tetap tercatat pada backlog.

Referensi API primer: [lifecycle Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers), [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API), [request ifAvailable](https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request), dan [risiko aktivasi update](https://web.dev/learn/pwa/update).

Selesai dengan catatan dan siap pengujian manual Fase 7. Tunggu evaluasi; tidak commit/push atau melanjutkan fase berikutnya.
