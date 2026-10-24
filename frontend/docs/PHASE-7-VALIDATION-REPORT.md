# Validasi Fase 7 — PWA, Offline, Backup & Restore

24 Oktober 2026. Baseline Git `56379e7498f514fa68021feb9eb00549cdd5bd05`, working tree awal bersih. Status **Selesai dengan Catatan**; pengujian native/manual pengguna masih pending.

## A. Automated Tests — dijalankan agen

| Perintah final | Hasil aktual |
| --- | --- |
| `npm run lint` | Lulus, exit 0; tanpa error/warning ESLint |
| `npm run typecheck` | Lulus, exit 0; aplikasi, konfigurasi Vite/tooling dan seluruh tes |
| `npm test` | **363 lulus, 0 gagal, 0 skipped/cancelled**; 27 file |
| `npm run test:phase7` | **50 lulus, 0 gagal**, subset suite penuh |
| `npm run build` | Lulus, exit 0; Vite 8.3.4, 2206 modules, manifest/public icons/SW tersedia |
| `npm run test:pwa:production` | **1 lulus, 0 gagal**; server Vite preview HTTP sementara + cache/worker emulator atas output produksi |
| `git diff --check` | Lulus, tanpa error whitespace; Git masih memberi pemberitahuan LF/CRLF |

**364 tes unik** = 363 suite utama + 1 integrasi production preview. Suite 50 Fase 7 sudah termasuk dalam 363, tidak dijumlah ulang. Baseline Fase 1–6 sebanyak 313 tetap lulus; ditambah 50 tes baru (33 backup/restore/offline bisnis, 6 koordinasi maintenance, 6 manifest/worker, 5 DOM/runtime). Tidak menulis ulang atau menghapus assertion finansial baseline. Tidak menambah testing framework/dependency.

Log TEMP Windows:
- `pos-zanna-phase7-final-tests.log`
- `pos-zanna-phase7-final-focused.log`
- `pos-zanna-phase7-final-build.log`
- `pos-zanna-phase7-final-production.log`

Final suite utama dan Fase 7 tidak mencetak warning React act/TypeError pada run tersebut. Harness lama dapat sesekali memberi warning pada kombinasi run lain; tidak ada suppression atau klaim perbaikan harness di luar scope.

## B. Cakupan validasi

| Area | Bukti otomatis |
| --- | --- |
| Manifest/icon | POS-Zanna standalone, scope/start, PNG 192/512 benar-benar memiliki dimensi yang diminta |
| Worker/install | Cache shell/lazy assets, gagal install tidak menghapus cache lama, tidak skipWaiting otomatis |
| Offline/cache | Deep link Dashboard/Kasir/Bon/Laporan/Pengaturan dan chunk Excel dari cache, POST/API/backup/external tidak dicache |
| Update | Aktivasi atas pesan eksplisit, multi-window ditolak, cache status dicek, hanya prefix cache POS-Zanna lama dibersihkan |
| Registrasi/runtime | register sw.js production dengan updateViaCache none, instalasi didukung/fallback, indikator online/offline |
| Backup | Seluruh 14 tabel, metadata/counts/checksum, source readonly, snapshot koheren saat write bersamaan |
| Format | JSON rusak, format/schema tidak didukung, checksum berubah, count/type/unique/referensi invalid ditolak |
| Graph | Sale/Item/intent/SALE, Bon/event pembayaran/intent, HPP, master dan stok awal/rantai ledger/saldo akhir |
| Restore | Preview tanpa write, current backup wajib, konfirmasi ketik, plan privat/satu kali, stale target dan PREPARED target ditolak |
| Rollback | Fault pada product/item/movement/payment/cost, readback yang diubah hook; seluruh target kembali identik |
| Koordinasi | Dua tab, jendela versi lama, shared write aktif, tab baru saat maintenance, reload-required dan kegagalan gate |
| Offline bisnis | Fetch sengaja dibuat gagal; stok, CASH, BON, cicilan, laporan, HPP, backup/restore tetap berhasil tanpa satu permintaan jaringan |
| UI | Unduh JSON tervalidasi, preview read-only, file rusak, checkbox/teks, double click, cart belum kosong dan notifikasi jaringan |
| Legacy | Master tanpa policy review dan modal historis kosong dipertahankan, schema tetap v5 |
| Regresi | Semua tes produk/unit/inventory/CASH/BON/credit/recovery/riwayat/Dashboard/HPP/impor Excel Fase 1–6 |

Semua pengujian data memakai fake-indexeddb/database proses uji acak. Tidak membaca, menghapus atau mengubah IndexedDB browser pengguna. Server preview hanya menyajikan aset; ditutup setelah tes selesai.

## C. Production preview versus browser native

Tes production memakai **build nyata**, menyajikannya lewat Vite preview localhost, mem-fetch SW/manifest/11 aset, memeriksa status/MIME/cache headers dan fallback deep link. Aset respons produksi dimasukkan ke emulator Cache Storage/SW; setelah jaringan emulator dimatikan, shell dan seluruh chunk JS tetap terbaca.

Ini integrasi build/HTTP/worker emulator, **bukan pengujian Service Worker native pada Chrome/Android**. Tidak mengklaim instalasi, real offline reopening, power loss, durability media, file picker/unduhan Android atau tablet telah lulus. Manual Browser Testing dan Tablet Testing dilakukan pengguna berdasarkan [panduan khusus Fase 7](PHASE-7-MANUAL-TEST-GUIDE.md).

## D. Build final dan dependency

- JS utama `index-OSOc2tnQ.js`: **671,66 kB**, gzip **198,40 kB**.
- CSS `index-Fe2VhJSx.css`: **40,50 kB**, gzip **8,67 kB**.
- `sw.js`: **2,39 kB**, cache build **92e2d785210a3d215b6a**.
- Chunk dinamis Excel tetap diprecache: 15,24 / 40,64 / 59,25 kB.
- Warning Vite chunk utama >500 kB tetap terlihat; tidak menaikkan ambang untuk menyembunyikannya.
- Tidak menambah dependency. package-lock.json, schema database, konfigurasi ESLint/TypeScript dan .gitignore tidak berubah.
- Plugin SW kecil memanfaatkan Vite yang sudah ada. Source berada di tooling/, bukan build/ yang diabaikan Git.
- Cache-Control no-cache dikonfigurasi pada preview. Deployment aktual harus menyajikan sw.js/HTML/manifest dengan revalidasi dan memiliki HTTPS tepercaya/root origin; hosting tidak diimplementasikan.

## E. Temuan/perbaikan selama implementasi

1. Perlindungan restore membutuhkan semua writer: 15 transaksi rw pada enam repository lama mendapat shared write lease. Nested call tetap di transaksi Dexie tanpa await Web Lock baru; regresi membuktikan tidak memutus import/seed/checkout/payment.
2. Current backup tervalidasi dan fingerprint target diwajibkan, untuk mencegah penggantian berdasar preview usang atau tanpa file kondisi sekarang.
3. Expected canonical source dibekukan sebelum write: hook yang mengubah objek input tidak dapat mengubah nilai pembanding readback. Tes modifikasi hook membuktikan rollback.
4. Begitu update disetujui worker, halaman lama wajib reload bahkan jika aktivasi timeout; tidak kembali mengizinkan write pada versi aset campuran.
5. Restore/update memeriksa satu window melalui SW termasuk uncontrolled clients, sehingga tab aplikasi versi lama yang belum mempunyai lease ikut memblokir.
6. Format backup menolak tabel/kolom/version tak dikenal dan tidak melakukan repair/backfill; nilai null/nol/historis dipertahankan.
7. Percobaan verifikasi sempat menemukan sintaks ASI pada tes worker dan Promise.withResolvers yang tidak sesuai target ES2023. Keduanya diperbaiki pada tes, tanpa menaikkan target TypeScript.
8. Source plugin awal berada pada folder build yang terkena ignore Java. Dipindah ke tooling; .gitignore tidak diubah dan source penting kini tercatat dalam daftar file.

Semua hasil tabel A berasal dari eksekusi final sesudah perbaikan. Tidak ada klaim tes awal yang gagal sebagai kelulusan final.

## F. Daftar file

**29 file baru, 17 diubah, total 46; tidak ada penghapusan file tracked.** Path relatif frontend/. Source tooling dan ikon PNG ikut daftar, bukan tersembunyi sebagai output build.

| File | Status |
| --- | --- |
| `docs/PHASE-7-FINAL-REPORT.md` | Baru |
| `docs/PHASE-7-MANUAL-TEST-GUIDE.md` | Baru |
| `docs/PHASE-7-VALIDATION-REPORT.md` | Baru |
| `docs/PROJECT-BACKLOG.md` | Diubah |
| `index.html` | Diubah |
| `package.json` | Diubah |
| `public/manifest.webmanifest` | Baru |
| `public/pwa-192.png` | Baru |
| `public/pwa-512.png` | Baru |
| `README.md` | Diubah |
| `scripts/app-safety.test.ts` | Baru |
| `scripts/backup-restore.test.ts` | Baru |
| `scripts/phase7-ui.test.tsx` | Baru |
| `scripts/pwa-fixtures.ts` | Baru |
| `scripts/pwa-production.test.ts` | Baru |
| `scripts/pwa.test.ts` | Baru |
| `src/app/App.tsx` | Diubah |
| `src/components/layout/AppLayout.tsx` | Diubah |
| `src/components/layout/OperationalLayout.tsx` | Diubah |
| `src/data/dexieBackupRepository.ts` | Baru |
| `src/data/dexieCheckoutRepository.ts` | Diubah |
| `src/data/dexieCreditRepository.ts` | Diubah |
| `src/data/dexieCustomerRepository.ts` | Diubah |
| `src/data/dexieInventoryRepository.ts` | Diubah |
| `src/data/dexieProductImportRepository.ts` | Diubah |
| `src/data/dexieProductRepository.ts` | Diubah |
| `src/data/guardedWrite.ts` | Baru |
| `src/domain/backup.ts` | Baru |
| `src/domain/backupFormat.ts` | Baru |
| `src/domain/backupInventory.ts` | Baru |
| `src/domain/backupValidation.ts` | Baru |
| `src/features/home/HomePage.tsx` | Diubah |
| `src/features/settings/AppOfflinePanel.tsx` | Baru |
| `src/features/settings/BackupPanel.tsx` | Baru |
| `src/features/settings/SettingsPage.tsx` | Diubah |
| `src/main.tsx` | Diubah |
| `src/pwa/pwaRuntime.ts` | Baru |
| `src/pwa/PwaStatus.tsx` | Baru |
| `src/pwa/SafetyBoundary.tsx` | Baru |
| `src/services/appSafety.ts` | Baru |
| `src/services/backupOperations.ts` | Baru |
| `src/services/backupService.ts` | Baru |
| `src/services/recoverySafety.ts` | Baru |
| `tooling/pwaPlugin.ts` | Baru |
| `tooling/serviceWorker.ts` | Baru |
| `vite.config.ts` | Diubah |

Output dist/cache build diabaikan Git. Folder backend, data browser nyata, Git HEAD dan staging tidak diubah oleh agen. Tidak commit/push.

## G. Risiko tersisa dan kesiapan

**Bug kritis dalam scope yang diketahui:** tidak ada yang tersisa dari audit/pengujian tersebut. Tetap tidak menjamin setiap kondisi browser/perangkat/media telah diuji.

**Batas keamanan:** autentikasi OWNER belum tersedia, backup belum terenkripsi, checksum bukan tanda tangan, aplikasi belum siap operasional multiuser. Permission rancangan backups.export/backups.restore hanya titik integrasi masa depan.

**Batas platform/data:** secure context + Web Locks + SW cache siap diperlukan untuk restore/update; HTTP LAN biasa tidak cukup. Restore hanya format1/schema5, target konsisten, backup kondisi sekarang, satu window dan tanpa operasi tertunda. Batas 50 MB/100.000 catatan; tidak merge, tidak repair data korup, tidak memulihkan state simulasi pengaturan. IndexedDB/cache bukan backup permanen dan perangkat berbeda tidak otomatis sinkron.

**Nonkritis/warning:** bundle >500 kB; biaya validasi graph/canonical untuk data besar; unduhan/media/HTTPS tablet/native install/offline/update masih menunggu pengguna. Lihat PROJECT-BACKLOG BL-027–032 dan BL-001.

Fase 7 siap untuk **pengujian manual terisolasi dan finalisasi dengan catatan**. Panduan hanya fitur baru/berubah dan integrasi langsung; tidak meminta seluruh Fase 1–6 diuji ulang. Tidak melanjutkan fase berikutnya atau autentikasi sebelum evaluasi pengguna.

