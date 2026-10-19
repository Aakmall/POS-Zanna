# Zanna-Cell — POS-Zanna

Sistem Kasir Warung Campuran. **Revisi Fase 1: Modern Premium Retail POS** melanjutkan fondasi Fase 0 dengan ruang operasional responsif dan data DEMO. Tidak ada pembayaran nyata, backend, database, maupun transaksi yang disimpan permanen.

## Teknologi dan persyaratan

- React 19, TypeScript 6 strict, Vite 8.
- Tailwind CSS 4 melalui plugin Vite resmi, React Router 7, Lucide React.
- ESLint beserta React Hooks dan React Refresh dari konfigurasi awal.
- Node.js 22.13+ pada lini 22, atau Node LTS 24+ yang kompatibel. Lingkungan implementasi: Node 22.18.0, npm 10.9.3.
- Tidak ada dependency baru pada Fase 1. State memakai React state/context; pengujian logika memakai Node test runner dan compiler TypeScript yang sudah terpasang.

Versi dependency dikunci dalam `package-lock.json`. Tidak ada font CDN, library animasi, chart, atau komponen tambahan. Grafik sederhana menggunakan HTML/CSS dan label nilai yang dapat dibaca pembaca layar.

## Instal dan jalankan

```powershell
cd C:\04-Project-TOKO\POS-Zanna\frontend
npm ci
npm run dev
```

Buka alamat yang ditampilkan Vite (biasanya http://localhost:5173). Halaman welcome ada di `/`; pilih **Coba kasir DEMO** atau buka `/kasir` langsung.

Untuk mencoba tablet di jaringan lokal yang sama:

```powershell
npm run dev -- --host 0.0.0.0
```

Buka alamat Network dari terminal di tablet. Firewall komputer perlu mengizinkan port development server pada jaringan privat. Tidak memerlukan kamera, Bluetooth, atau printer untuk simulasi. Ini bukan PWA dan tidak menyediakan jaminan offline.

## Verifikasi kode

```powershell
npm run lint
npx tsc --noEmit -p tsconfig.app.json
node --test scripts/demo-logic.test.mjs
npm run build
```

`npm run build` memeriksa TypeScript aplikasi dan konfigurasi Vite sebelum membuat `dist/`. Gunakan `npm run preview` untuk pratinjau lokal hasil build. File `dist/` adalah hasil generate; edit sumber di `src/`.

Enam pengujian logika mencakup batas stok dan kuantitas, total harga termasuk solar, keranjang tidak valid, parsing uang, agregasi laporan, dan pengurangan kuantitas ketika stok/harga berubah. Pengujian ini bukan pengujian DOM atau visual browser.

## Halaman dan rute

| Rute | Isi |
| --- | --- |
| `/` | Welcome Fase 0 yang diperbarui dengan akses kasir DEMO |
| `/dashboard` | Empat kartu statistik, transaksi contoh, dan perhatian stok |
| `/kasir` | Katalog, kategori, pencarian, keranjang, dan alur pembayaran DEMO |
| `/produk` | Tabel, pencarian/filter, form tambah/edit produk sesi |
| `/stok` | Ringkasan stok, filter stok rendah, penyesuaian dan riwayat contoh |
| `/bon` | Pelanggan & Bon: pelanggan fiktif, rincian utang, simulasi cicilan |
| `/laporan` | Rentang tanggal, omzet/laba kotor contoh, grafik dan tabel |
| `/pengaturan` | Warung, pengguna, printer, backup, informasi aplikasi |
| Rute lainnya | 404 sisi klien dengan tautan ke beranda |

Hosting produksi memerlukan fallback permintaan URL aplikasi ke `index.html`, agar BrowserRouter bekerja ketika URL dibuka langsung atau di-refresh.

## Struktur dan tanggung jawab

```text
frontend/
├── scripts/demo-logic.test.mjs
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── routes.tsx
│   │   ├── navigation.ts
│   │   ├── DemoProvider.tsx
│   │   └── demoContext.ts
│   ├── assets/                 # Sprite SVG placeholder kategori lokal
│   ├── components/
│   │   ├── layout/             # Welcome shell dan operational shell
│   │   └── ui/                 # Button, Dialog, EmptyState, PageHeader, dll.
│   ├── features/
│   │   ├── cashier/            # Halaman, kartu produk, keranjang, pembayaran, logika
│   │   ├── credit/             # Bon dan dialog rincian/cicilan
│   │   ├── dashboard/
│   │   ├── home/
│   │   ├── not-found/
│   │   ├── products/           # Daftar dan form produk
│   │   ├── reports/
│   │   ├── settings/
│   │   └── stock/              # Daftar dan form penyesuaian
│   ├── hooks/useDemoStore.ts
│   ├── lib/                    # Format IDR, ID sesi, agregasi laporan
│   ├── mocks/                  # Produk, pelanggan, penjualan ilustrasi
│   ├── services/catalogRepository.ts
│   ├── styles/                 # globals.css dan tokens.css
│   ├── types/pos.ts
│   └── main.tsx
└── README.md
```

`CatalogRepository` adalah boundary pembacaan katalog. Implementasi `demoCatalogRepository` hanya menyalin data lokal, tanpa request jaringan dan tanpa mengklaim sebagai API/backend. Implementasi Spring Boot dapat diintegrasikan pada fase terpisah. Logika kuantitas dan perhitungan keranjang dipisahkan dalam `cartLogic.ts`.

Aset `src/assets/product-placeholders.svg` berisi ilustrasi placeholder lokal, tanpa foto atau identitas merek pihak lain. `ProductArtwork` memilih ilustrasi produk atau fallback kategori. Aplikasi tidak mengunduh gambar eksternal saat digunakan.

## Desain dan aksesibilitas

- Token bersama direvisi menjadi teal/turquoise, latar sangat terang, kartu putih, border halus, dan shadow lembut. Warna success, warning, dan danger tetap semantik; navy disimpan sebagai token sekunder. Identitas Zanna-Cell tetap mandiri.
- Mulai 1024px, sidebar menjadi rail ikon 80px untuk tablet landscape. Mulai 1280px, sidebar teal selebar 224px bisa diringkas lewat tombol. Layar lebih sempit memakai navigasi bawah Dashboard/Kasir/Produk dan dialog semua menu. Sidebar menampilkan identitas Operator Demo.
- Mulai 1024px, keranjang berada di kiri (320px; 340px pada desktop) dan katalog di kanan. Tablet portrait/ponsel memakai tombol ringkasan dan dialog keranjang. Jumlah kolom produk mengikuti lebar katalog melalui CSS container query.
- Dialog native menyediakan modal/focus containment, Escape, pemulihan fokus, serta penguncian scroll halaman. Tombol tutup selalu tersedia.
- Navigasi menggunakan active state dan label aksesibel saat sidebar diringkas. Kontrol sentuh minimal 44px, tombol utama 48px. Form diberi label, status/error memakai live region, dan tabel dapat digeser dengan keyboard pada layar sempit.
- Skip link, fokus keyboard, ikon dekoratif tersembunyi, font sistem, dan `prefers-reduced-motion` dipertahankan.
- Tailwind mengikuti [integrasi Vite resmi](https://tailwindcss.com/docs/installation/using-vite). Router menggunakan [mode deklaratif](https://reactrouter.com/start/declarative/installation).

## Data dan batas simulasi

Semua layar operasional menampilkan **DEMO** dan informasi bahwa tidak ada pembayaran nyata.

- Katalog berisi 14 produk contoh dalam kategori Sembako, Makanan, Minuman, Bensin, Solar, dan Eceran, termasuk kopi susu sachet. Filter Semua tersedia.
- Harga bensin dimulai sebagai `null` dengan teks **Harga belum diatur**. Produk tanpa harga tidak dapat masuk keranjang. Harga solar Rp13.000/liter mengikuti arahan; harga lain adalah ilustrasi DEMO.
- Kuantitas berupa satuan utuh. Bensin dikatalogkan per kemasan, solar per liter utuh. Penjualan kuantitas pecahan belum didukung.
- Harga dan nominal uang memakai rupiah bulat. Form nominal menerima angka tanpa titik/koma; nilai negatif, pecahan, dan angka tidak aman ditolak.
- Produk, stok, dan keranjang dibagikan selama berada di layout operasional. Berpindah antar-menu mempertahankannya. Refresh atau kembali ke welcome lalu masuk lagi mereset state operasional.
- Checkout memvalidasi ulang harga dan stok saat ini. Konfirmasi DEMO hanya menampilkan hasil; tidak mengurangi stok, menambahkan bon, atau memasukkan transaksi ke laporan. Selesai/menutup hasil sukses mengosongkan keranjang.
- QRIS hanya ikon penanda, bukan QR yang dapat dipindai. Bon meminta pelanggan fiktif; Tunai menampilkan contoh kembalian. Proses simulasi bisa dibatalkan dengan menutup dialog.
- Cetak struk hanya menampilkan informasi simulasi, tanpa perintah printer. Barcode tidak mengakses kamera atau scanner.
- Tombol **Coba state error** pada Kasir menampilkan error katalog. **Muat ulang katalog demo** menampilkan loading lalu mengembalikan produk/stok awal. Produk tambahan yang hilang dapat menyebabkan keranjang tidak valid; kosongkan keranjang untuk melanjutkan.
- Riwayat penyesuaian stok, cicilan bon, dan pengaturan bersifat lokal pada halaman masing-masing; meninggalkan halaman mereset bagian ini. Perubahan stok katalog tetap ada selama layout operasional aktif.
- Dashboard/laporan memakai sampel tetap **13–19 Oktober 2026**, bukan tanggal sistem atau hasil checkout sesi. Laba kotor berasal dari modal contoh; belum termasuk biaya operasional. Rentang tanpa sampel menampilkan empty state.
- Pengaturan warung adalah pratinjau form dan tidak mengubah identitas header. Pengguna tidak memiliki login atau hak akses nyata. Backup/pemulihan belum membuat atau membaca file.

## Checklist manual

Agen tidak melakukan pengujian visual browser atau tablet. Silakan periksa:

1. Buka welcome, akses Kasir, seluruh menu, URL tidak dikenal, back/forward, serta refresh URL langsung.
2. Desktop, tablet Android Tecno landscape/portrait, dan ponsel: navigasi, layout kartu, dialog, scroll tabel, tombol keranjang, safe-area, dan tidak ada scroll horizontal halaman.
3. Cari nama produk, filter tiap kategori, pencarian kosong/tidak cocok, stok habis, dan produk bensin tanpa harga.
4. Tambah item; tambah/kurangi hingga batas stok; hapus/kosongkan keranjang; pindah menu dan kembali ke Kasir.
5. Tambah/edit produk; coba SKU duplikat, harga kosong, negatif/pecahan, dan batas stok. Pastikan perubahan tampil di Kasir dan Stok.
6. Sesuaikan stok menjadi rendah/habis; lihat status dan riwayat. Periksa validasi checkout jika stok produk dalam keranjang diturunkan.
7. Tunai: uang kurang, uang pas, kembalian; QRIS: label simulasi; Bon: pelanggan belum dipilih dan sudah dipilih; loading, batal, hasil sukses, dan simulasi cetak.
8. Klik Coba state error, lalu muat ulang katalog; pastikan empty, loading, error, dan sukses mudah dipahami.
9. Bon: rincian pelanggan, cicilan lebih besar dari saldo, cicilan sebagian/lunas; pastikan label DEMO tetap jelas.
10. Laporan: rentang sampel, rentang kosong, tanggal terbalik, dan ringkasan mengikuti filter.
11. Pengaturan warung/printer, informasi pengguna, rancangan backup, dan informasi aplikasi.
12. Keyboard Tab/Shift+Tab, skip link, fokus dialog/Escape/kembali ke pemicu, zoom, kontras, sentuhan, dan reduced-motion.

## Batas fase

Tidak ada backend Spring Boot, IndexedDB/localStorage, autentikasi produksi, transaksi permanen, pembayaran sungguhan, sinkronisasi, service worker/PWA offline, atau integrasi printer/barcode. Backend akan dikembangkan secara terpisah melalui IntelliJ IDEA pada fase berikutnya. Fase 1 berhenti pada antarmuka DEMO; lanjut Fase 2 setelah pengujian manual pengguna.

## Revisi visual Fase 1

Komposisi referensi diterapkan sebagai arah tata letak, proporsi, dan ritme visual. Logo, nama, ilustrasi, dan konten tetap milik implementasi Zanna-Cell; tidak memakai aset PosyMart.

- Topbar menampilkan judul/deskripsi halaman, pencarian produk di Kasir (desktop), notifikasi nonaktif tanpa badge/server palsu, dan identitas demo. Tekan Enter pada pencarian topbar untuk menuju `/kasir?q=...`.
- Dashboard mengutamakan Total Penjualan, Total Transaksi, Jumlah Pelanggan, dan Produk Stok Rendah. Tanggal sampel tetap ditampilkan; tidak ada persentase tren yang dibuat-buat.
- Kasir memakai panel keranjang kiri, katalog kanan, thumbnail lokal, tombol tambah, kategori chips, dan pilihan Tunai/QRIS/Bon sebelum tombol **Bayar**. **Kosongkan** menampilkan feedback yang juga dibaca live region.
- Sidebar, Produk, Stok, Pelanggan & Bon, Laporan, Pengaturan, modal pembayaran, dan welcome mengikuti warna/treatment komponen bersama.

File baru revisi: `src/styles/retail.css`, `src/components/ui/ProductArtwork.tsx`, dan `src/assets/product-placeholders.svg`. File utama yang diubah: `OperationalLayout.tsx`, `CashierPage.tsx`, `CartPanel.tsx`, `ProductCard.tsx`, `DashboardPage.tsx`, `StatCard.tsx`, `ProductMark.tsx`, tokens/CSS global, navigation, types, mock products, ProductForm, CreditPage, HomePage, cartLogic, tes logika, metadata/favikon, dan README. Dependency tidak berubah.

Pemeriksaan manual tambahan:

1. Bandingkan komposisi Dashboard dan Kasir dengan referensi; periksa sidebar teal, kartu, tipografi, proporsi panel, dan kepadatan informasi.
2. Uji sidebar pada 1024px, desktop 1280px+, tombol ringkas/perluas, tooltip/label aksesibel, serta navigasi bawah pada tablet portrait.
3. Cari melalui topbar, tekan Enter, lalu ubah/reset pencarian katalog. Periksa filter Bensin, Solar, Eceran dan fallback ilustrasi produk baru.
4. Uji feedback tambah, perubahan jumlah, hapus/kosongkan, pemilihan metode, tombol Bayar, dialog, dan reduced-motion.
5. Periksa thumbnail pada hasil build dan pastikan tidak ada permintaan gambar ke domain eksternal.

Fondasi tipe `Product`, `CartLine`, nilai harga nullable, data mock terpisah, dan `CatalogRepository` tetap tersedia untuk fase database. Fase tersebut masih memerlukan skema, implementasi persistensi, validasi transaksi atomik, serta strategi migrasi/backup; belum ada implementasinya pada revisi ini.

