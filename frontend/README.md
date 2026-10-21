# Zanna-Cell — POS-Zanna

Sistem Kasir Warung Campuran. **Fase 3: Inventory Management, Stock Movement Ledger & Unit Conversion.** Master produk dan persediaan tersimpan di IndexedDB. Kasir, pembayaran, Bon, serta laporan penjualan tetap DEMO.

## Menjalankan proyek

Gunakan Node.js 22.13+ pada lini 22 atau LTS 24+ yang kompatibel. Lingkungan implementasi: Node 22.18.0, npm 10.9.3.

```powershell
cd C:\04-Project-TOKO\POS-Zanna\frontend
npm ci
npm run dev
```

Buka alamat yang ditampilkan Vite, biasanya http://localhost:5173. Untuk tablet pada LAN yang sama:

```powershell
npm run dev -- --host 0.0.0.0
```

Gunakan alamat Network dari terminal. **localhost, IP LAN, port, profil browser, dan perangkat berbeda mempunyai penyimpanan berbeda.** Data belum disinkronkan. Operasi persediaan tidak memerlukan API/internet setelah frontend tersedia; membuka ulang aplikasi tanpa server/aset yang tersedia belum dijamin karena PWA/service worker belum dibuat.

## Alur penggunaan Fase 3

1. Buka `/produk`, buat kategori dan produk beserta satuan dasar/varian. Pilih jenis persediaan dan kemasan yang sah; BBM wajib dasar Liter/ml. Produk lama perlu review kebijakan sebelum kemasan tambahan dipakai lagi. Database baru mulai tanpa produk; **Isi Data Demo** hanya berjalan atas tindakan dan konfirmasi pengguna.
2. Buka `/stok`. Produk lama maupun baru berstatus **Belum diatur** sampai stok awal dibuat. Stok awal 0 diperbolehkan dan berbeda dengan belum diatur.
3. Atur stok awal sekali. Selanjutnya gunakan Tambah Stok atau Koreksi Stok. Koreksi wajib alasan; koreksi keluar memerlukan konfirmasi dan tidak boleh melebihi saldo.
4. Pilih satuan yang sesuai dan periksa pratinjau konversi. Isi dus/jeriken ditentukan pengguna atau konfigurasi varian, bukan ditebak aplikasi.
5. Buka Riwayat untuk melihat saldo sebelum/sesudah, alasan, UUID operasi, dan snapshot konversi. Tidak ada edit/hapus ledger melalui UI.
6. Produk dan Kasir membaca saldo yang sama. Varian berbagi stok dasar produk; batas keranjang memperhitungkan gabungan varian. Menambah keranjang dan pembayaran DEMO tidak mengubah persediaan.

Pada layar di bawah 1024px, gunakan **Keranjang & Bayar** di bagian atas katalog atau tombol tetap di atas navigasi bawah. Keduanya membuka drawer dengan keranjang yang sama.

## Pemeriksaan kode

```powershell
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run typecheck
npm run test:unit
npm run test:inventory
npm test
npm run build
```

`typecheck` mencakup aplikasi, konfigurasi Vite, dan tests. `npm test` menjalankan seluruh tes logika, repository, migrasi, dan DOM memakai Node runner, tsx, fake-indexeddb, serta jsdom. Database tes memakai fake-indexeddb terisolasi, bukan IndexedDB browser pengguna. Build menghasilkan `dist/`; edit sumber `src/`, bukan hasil build. `npm run preview` menyajikan hasil build. Hosting SPA memerlukan fallback rute ke `index.html`.

Tes DOM mensimulasikan breakpoint 390, 768, 1024, dan 1366px. Ini bukan pengujian visual browser/Android. Fokus native, keyboard virtual, safe-area, overlap, dan tampilan tablet tetap diperiksa manual oleh pengguna.

## Teknologi

React 19, TypeScript 6 strict, Vite 8, Tailwind CSS 4, React Router 7, Lucide React, serta Dexie **4.4.6** untuk IndexedDB. Fase 3 memakai dependency yang sudah ada; tidak menambah package baru. State aplikasi memakai React context/hooks. Backend Java Spring Boot dan PostgreSQL dibuat pada fase terpisah.

## Halaman

| Rute | Perilaku |
| --- | --- |
| `/` | Welcome dan akses fitur lokal / Kasir DEMO |
| `/dashboard` | Ringkasan penjualan sampel; indikator stok memakai inventory aktual |
| `/produk` | CRUD master lokal, kategori, varian, barcode/SKU, status aktif, saldo dan status stok |
| `/stok` | Saldo aktual, stok awal/masuk, koreksi masuk/keluar, ledger, pencarian/filter |
| `/kasir` | Katalog dan stok lokal; keranjang/pembayaran DEMO tanpa mutasi stok |
| `/bon` | Pelanggan dan cicilan fiktif pada state halaman |
| `/laporan` | Sampel tetap 13–19 Oktober 2026, bukan transaksi nyata |
| `/pengaturan` | Rancangan preferensi, printer, backup, dan informasi aplikasi |
| Rute lainnya | 404 sisi klien |

## Struktur

```text
frontend/
├── docs/
│   ├── PHASE-3-BUSINESS-HARDENING.md
│   ├── INVENTORY-DATA-MODEL.md
│   ├── PHASE-3-INVENTORY-LEARNING.md
│   ├── PHASE-3-REPORT.md
│   ├── PRODUCT-DATA-MODEL.md       # Referensi master / riwayat Fase 2
│   └── PHASE-2-LEARNING.md
├── scripts/                      # Logika, repository, migrasi, dan tes DOM
├── src/
│   ├── app/                      # Router, context, subscription master/saldo
│   ├── assets/                   # Ilustrasi SVG lokal
│   ├── components/{layout,ui}/    # Layout dan komponen bersama
│   ├── data/                     # Dexie v1→v2, singleton DB, adapter repository
│   ├── domain/                   # Model, kontrak, validasi, aturan konversi
│   ├── features/                 # Produk, Stok, Kasir, dan halaman pendukung
│   ├── hooks/                    # Inventory, riwayat, breakpoint Kasir
│   ├── lib/                      # Formatting dan agregasi demo
│   ├── mocks/                    # Sampel eksplisit / laporan fiktif
│   ├── services/                 # Inventory service, pilihan satuan, composition root
│   ├── styles/                   # Tokens, base, responsive retail
│   ├── types/                    # Read model dan tipe UI
│   └── main.tsx
└── package.json
```

## Database dan integritas

Database tetap **`zanna-cell-db`**. Skema v1 (`products`, `categories`, `units`, `variants`) dipertahankan. Skema v2 menambahkan `inventoryBalances` dan `stockMovements` tanpa menghapus/mereset data lama, mengubah UUID/barcode, atau otomatis memberi stok nol.

Identitas memakai UUID; waktu ISO UTC; harga integer rupiah; kuantitas integer berskala **1000 per satuan dasar** sesuai Fase 2. `minimumStock` menggunakan skala yang sama; `null` berarti belum diatur. Satuan dasar tidak dapat diganti setelah produk dibuat. Stok diskret tidak menerima pecahan. Perhitungan konversi memakai BigInt sementara untuk validasi presisi; nilai tersimpan tetap number integer aman.

Setiap perubahan saldo dan penambahan ledger berada dalam satu transaksi Dexie. `operationId` unik dan fingerprint input mencegah operasi identik diproses dua kali, termasuk retry. Snapshot menyimpan konversi saat kejadian sehingga edit varian tidak mengubah arti riwayat lama. Tidak ada saldo fisik kedua pada Product atau varian.

## Dokumentasi pembelajaran

- [Hardening satuan/kemasan: policy per produk, review legacy, dan koreksi saldo](docs/PHASE-3-BUSINESS-HARDENING.md)
- [Laporan Fase 3: 22 bagian, perubahan, hasil pemeriksaan, batasan](docs/PHASE-3-REPORT.md)
- [Panduan belajar: 20 konsep, file/fungsi, alur, perintah, DevTools, lima latihan, checklist manual](docs/PHASE-3-INVENTORY-LEARNING.md)
- [Kontrak inventory, fixed-point, migrasi, concurrency, Future Backend & Synchronization](docs/INVENTORY-DATA-MODEL.md)
- [Model master produk Fase 2](docs/PRODUCT-DATA-MODEL.md)
- [Panduan belajar Fase 2](docs/PHASE-2-LEARNING.md)

## Pemeriksaan manual pengguna

Checklist lengkap yang belum ditandai lulus tersedia di panduan belajar. Periksa setidaknya: data lama tetap ada, stok awal 0/30, tambah 10, koreksi keluar 2 menghasilkan 38, alasan wajib, penolakan saldo negatif, ledger, konversi dus/kg/L/mL/jeriken, minimum stok, refresh, serta Console tanpa error. Uji keranjang dan pembayaran DEMO di 390×844, 768×1024, 1024×768, dan 1366×768; pastikan saldo tidak berubah oleh DEMO.

## Keterbatasan dan tahap berikutnya

IndexedDB bukan backup permanen: penghapusan site data, eviction, mode privat, atau kerusakan perangkat dapat menghilangkan data. Backup/restore dan autentikasi tepercaya belum tersedia. Pembatasan UI bukan proteksi owner terhadap pengguna yang menguasai browser/DevTools. Ledger tidak memiliki audit server atau proteksi kriptografis.

Belum ada checkout nyata, reservasi stok keranjang, pengurangan stok otomatis penjualan, SALE/RETURN, supplier/pembelian, transaksi QRIS/Bon nyata, scanner/printer, PWA, deployment, Spring Boot, PostgreSQL, atau sinkronisasi. Penjualan volume variabel di Kasir tetap di luar cakupan; inventory menerima volume presisi. Riwayat ditampilkan bertahap, tetapi subscription masih membaca seluruh riwayat satu produk.

**Berhenti pada Fase 3.** Pengembangan Fase 4 menunggu pengujian dan persetujuan pengguna. Tidak ada Git commit/push otomatis.
