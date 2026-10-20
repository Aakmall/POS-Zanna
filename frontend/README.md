# Zanna-Cell — POS-Zanna

Sistem Kasir Warung Campuran. **Fase 2: Responsive Cart, IndexedDB & Product Management** melanjutkan desain teal Fase 1. Master produk/kategori/varian tersimpan lokal; Kasir dan pembayaran tetap DEMO.

## Jalankan

Node.js 22.13+ pada lini 22 atau LTS 24+ yang kompatibel. Lingkungan implementasi Node 22.18.0, npm 10.9.3.

```powershell
cd C:\04-Project-TOKO\POS-Zanna\frontend
npm ci
npm run dev
```

Buka alamat dari Vite, biasanya http://localhost:5173. `/produk` adalah manajemen produk lokal; `/kasir` adalah simulasi belanja. Database produk mulai kosong. Tambahkan kategori/produk sendiri atau tekan **Isi Data Demo** dan konfirmasi.

Untuk tablet pada LAN yang sama:

```powershell
npm run dev -- --host 0.0.0.0
```

Gunakan alamat Network di terminal dan izinkan firewall jaringan privat bila diperlukan. **localhost, IP LAN, port lain, browser lain, dan perangkat lain memiliki database berbeda.** Data belum disinkronkan.

## Pemeriksaan kode

```powershell
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run typecheck
npm test
npm run build
```

Typecheck memeriksa aplikasi, konfigurasi Vite, dan test TypeScript. Tes menggunakan Node runner, tsx, fake-indexeddb, dan jsdom. Hasil build tersedia di `dist/`; gunakan `npm run preview` untuk pratinjau. Edit sumber di `src/`, bukan hasil build. Hosting memerlukan fallback SPA ke `index.html` untuk pembukaan langsung rute.

Tes DOM mensimulasikan breakpoint 390, 768, 1024, dan 1366px; **bukan pengujian visual browser/Android**. Ukuran pixel, overlap, native focus trap, dan keyboard virtual harus diperiksa manual.

## Teknologi

React 19, TypeScript 6 strict, Vite 8, Tailwind 4, React Router 7, Lucide React. Fase 2 menambahkan **Dexie 4** untuk IndexedDB. Dependency development: fake-indexeddb (IndexedDB pada tes Node), tsx (menjalankan TS/TSX), jsdom dan tipenya (tes DOM). Tidak ada state management library, backend, database cloud, atau library sinkronisasi.

## Halaman

| Rute | Perilaku |
| --- | --- |
| `/` | Welcome dan akses master lokal / Kasir DEMO |
| `/dashboard` | Penjualan sampel tetap; stok aktual belum dihitung |
| `/produk` | CRUD lokal, detail, aktif/nonaktif, pencarian/filter, kategori, varian, seed eksplisit |
| `/kasir` | Katalog varian dari IndexedDB; keranjang/pembayaran DEMO |
| `/stok` | Konfigurasi minimum stok dari master; tidak ada saldo/ledger |
| `/bon` | Pelanggan dan cicilan fiktif pada state halaman |
| `/laporan` | Sampel tetap 13–19 Oktober 2026, bukan checkout sesi |
| `/pengaturan` | Rancangan preferensi, printer, backup, informasi aplikasi |
| Rute lainnya | 404 sisi klien |

## Struktur

```text
frontend/
├── docs/
│   ├── PRODUCT-DATA-MODEL.md
│   └── PHASE-2-LEARNING.md
├── scripts/                    # Tes logika, repository, DOM + loader aset tes
├── src/
│   ├── app/                    # Provider/context, navigasi, router
│   ├── assets/                 # Ilustrasi placeholder SVG lokal
│   ├── components/{layout,ui}/
│   ├── data/                   # Dexie, skema v1, satuan, repository lokal, seed
│   ├── domain/                 # Model, repository interface, UUID, validasi, parser
│   ├── features/               # Produk, Kasir, Dashboard, Stok, Bon, dst.
│   ├── hooks/                  # Context dan breakpoint tunggal Kasir
│   ├── lib/                    # Formatting dan agregasi demo
│   ├── mocks/                  # Fixture seed eksplisit / laporan fiktif
│   ├── services/               # Composition root dan proyeksi katalog
│   ├── styles/                 # Tokens, base, responsive retail
│   ├── types/                  # Read model CatalogItem dan tipe demo UI
│   └── main.tsx
└── package.json
```

## Arsitektur dan belajar

- [Model produk, satuan, barcode, database v1, kebijakan demo, Future Backend & Synchronization](docs/PRODUCT-DATA-MODEL.md)
- [Penjelasan file, alur Component → Repository → Dexie → IndexedDB, contoh pemanggilan, dan tiga latihan](docs/PHASE-2-LEARNING.md)

Master memakai UUID stabil, metadata ISO UTC, harga integer rupiah, serta kuantitas integer berskala 1000. Modal tidak diketahui dan harga belum diatur memakai null. Barcode/SKU hanya pada varian, unik termasuk yang nonaktif. Satuan dasar tidak diganti setelah tersimpan. Tidak ada hard delete produk.

Database `zanna-cell-db`, skema 1, terdiri dari products/categories/units/variants. Initialize hanya mengisi referensi satuan, tanpa produk/kategori otomatis. Isi Data Demo menambahkan 12 master dan 15 varian berlabel DEMO secara idempoten; tidak menimpa data pengguna. Bensin tetap tanpa harga, solar sampel Rp13.000/liter. Seluruh gambar berupa aset lokal/placeholder kategori.

## Checklist manual Fase 2

1. Uji 390×844, 768×1024, 1024×768, 1366×768. Pada layar sempit, tombol Keranjang harus terlihat di atas navigasi bawah dengan jumlah dan total. Pada layar lebar, panel kiri tersedia.
2. Tambahkan item, ubah orientasi/viewport, buka drawer, tambah/kurangi/hapus, Bayar, tutup dengan tombol/Escape/backdrop. Periksa safe-area, scroll, fokus kembali, keyboard Android, dan tidak ada overflow halaman.
3. Pada origin baru, pastikan katalog kosong. Tambah kategori, produk tanpa barcode/modal, lalu refresh dan tutup/buka browser pada origin sama; data harus tetap tersedia.
4. Edit nama/harga, detail UUID, status aktif/nonaktif. Cari nama/SKU/barcode, filter kategori/status; pastikan produk nonaktif tidak ditawarkan di Kasir.
5. Konfigurasi varian bungkus/dus, bensin 1/1,5/5 L, gram/kg dan ml/liter. Coba konversi nol/negatif/lintas dimensi, nama spasi, harga negatif/format ribuan, barcode/SKU duplikat.
6. Klik Isi Data Demo dua kali. Sampel tidak boleh bertambah dua kali atau menimpa produk pengguna. Jika terjadi konflik SKU, seed dibatalkan.
7. Masukkan produk ke keranjang, ubah harga/status dari menu atau tab lain, kembali ke Kasir: total mengikuti master dan produk nonaktif menghalangi pembayaran DEMO. Kuantitas aktual variable belum dapat dijual.
8. Pastikan checkout DEMO tidak menambah transaksi/bon atau mengurangi stok. Refresh mengosongkan keranjang, bukan master.
9. Periksa loading/error, izin penyimpanan browser, fokus keyboard, zoom, kontras dan reduced-motion. Pengujian visual/tablet belum dilakukan agen.

## Keterbatasan

IndexedDB bukan backup permanen. Menghapus site data, mode privat, eviction atau kerusakan perangkat bisa menghilangkan data. Backup/restore belum dibuat. Tidak ada proteksi owner terhadap harga modal, autentikasi produksi, API, Spring Boot, PostgreSQL, sync engine, background sync, ledger, stok otomatis, transaksi nyata, pembayaran, PWA, impor Excel, atau printer/scanner nyata.

Fase 2 berhenti di sini. Evaluasi manual pengguna diperlukan sebelum fase berikutnya.

## File Fase 2

Baru:

- `src/domain/{product,productRepository,quantity,validation,id}.ts`
- `src/data/{database,units,demoSeed,dexieProductRepository}.ts`
- `src/services/productRepository.ts`, `src/hooks/useWideCashier.ts`
- `src/features/products/{VariantFields,CategoryManager,ProductDetails}.tsx`
- `scripts/{product-repository.test.ts,cart-ui.test.tsx,test-assets.mjs,asset-loader.mjs}`
- `tsconfig.tests.json`, `docs/PRODUCT-DATA-MODEL.md`, `docs/PHASE-2-LEARNING.md`

Perubahan utama:

- `src/app/{DemoProvider.tsx,demoContext.ts}`: snapshot database dan satu state keranjang.
- `src/services/catalogRepository.ts`, `src/types/pos.ts`, `src/mocks/products.ts`: proyeksi CatalogItem dan pemisahan identitas varian/master.
- `src/features/products/{ProductsPage,ProductForm}.tsx`: CRUD lokal nyata.
- `src/features/cashier/{CashierPage,CartPanel,ProductCard,PaymentDialog}.tsx`, `cartLogic.ts`, `useCart.ts`: responsive cart, master lokal, validasi status/harga terbaru.
- `src/components/ui/{Dialog,CatalogState,ProductArtwork,ProductMark}.tsx`: mode lokal/demo, viewport, error data dan fallback kategori dinamis.
- `src/features/{stock/StockPage,dashboard/DashboardPage,home/HomePage,settings/SettingsPage}.tsx` serta layout welcome/operasional: batas Fase 2 dan label data lokal.
- `src/styles/{globals,retail}.css`, `scripts/demo-logic.test.mjs`, `package.json`, `package-lock.json`, README.
- Import tipe UI di fitur pendukung mengikuti nama `CatalogItem`; domain `Product` terpisah.

`StockAdjustment.tsx` demo lama dilepas karena stok aktual/ledger belum dibuat. Tidak ada pengurangan/penyesuaian stok permanen pada Fase 2. `dist/` diperbarui melalui build, bukan diedit manual. Tidak ada Git commit.

## Membuka pembayaran pada layar kecil

Panel keranjang desktop berubah menjadi drawer saat lebar layar di bawah 1024px. Gunakan **Keranjang & Bayar** di bawah layar atau di bagian atas katalog. Tambahkan produk, buka keranjang, pilih Tunai/QRIS/Bon, lalu tekan **Bayar**. Saat keranjang kosong, pembayaran belum dapat dilanjutkan. Kedua tombol membuka keranjang dan total yang sama.
