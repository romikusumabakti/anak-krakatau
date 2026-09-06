# Anak Krakatau Live Status Dashboard — Design

Tanggal: 2026-09-06
Status: Disetujui untuk masuk tahap perencanaan implementasi

## 1. Tujuan

Web app satu halaman yang menjawab satu pertanyaan: **"Anak Krakatau sekarang bagaimana?"**

Pengguna sasaran: publik umum di Jabodetabek, Banten, dan Lampung yang terdampak
sebaran abu, plus siapa pun yang memantau erupsi berjalan sejak 4 September 2026.

Kriteria sukses:

1. Dari membuka URL sampai tahu status level dan tinggi kolom abu terakhir:
   di bawah 3 detik pada koneksi 4G lambat.
2. Setiap angka yang ditampilkan punya sumber dan umur data yang terlihat.
3. Satu sumber data mati tidak membuat halaman lain ikut mati.
4. Bisa dibaca dengan nyaman di layar 360px maupun desktop lebar.

Non-tujuan (v1):

- Notifikasi push, akun pengguna, langganan email.
- Riwayat/grafik tren jangka panjang (butuh basis data — lihat §4).
- Data penerbangan dan status bandara (sumber rapuh, lisensi tidak jelas).
- Peliputan gunung api Indonesia lain. Fokus tunggal: Anak Krakatau.

## 2. Batasan yang menentukan desain

Hasil probe langsung terhadap sumber data (2026-09-06):

| Sumber | Endpoint | Hasil | Catatan |
|---|---|---|---|
| MAGMA VONA (Anak Krakatau) | `magma.esdm.go.id/v1/vona?code=KRA` | `200`, 12KB HTML | **Sumber utama data abu.** 15 notice terbaru, format ICAO bernomor. |
| MAGMA tingkat aktivitas | `magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas` | `200`, 48KB HTML | Level siaga + tautan bertanda tangan ke laporan terbaru. |
| MAGMA laporan aktivitas | `magma.esdm.go.id/v1/gunung-api/laporan/<id>?signature=<sig>` | `200` (`403` tanpa `signature`) | Level, radius rekomendasi, koordinat, elevasi. `signature` diterbitkan di HTML tingkat aktivitas. |
| MAGMA informasi letusan | `magma.esdm.go.id/v1/gunung-api/informasi-letusan/KRA` | `200`, 51KB HTML | Timeline kejadian erupsi, narasi Indonesia, waktu WIB. |
| Smithsonian GVP (WFS) | `webservices.volcano.si.edu/geoserver/GVP-VOTW/ows` | `200`, JSON | Krakatau = `Volcano_Number` 262000, koordinat `105.4233, -6.1009`. |
| Smithsonian GVP (RSS mingguan) | `volcano.si.edu/news/WeeklyVolcanoRSS.xml` | `200`, XML | Narasi Inggris mingguan. Tertinggal beberapa hari — konteks, bukan status langsung. |
| BMKG TEWS | `data.bmkg.go.id/DataMKG/TEWS/autogempa.json` | `200`, JSON | Gempa terkini; konteks seismik Selat Sunda. |

**Darwin VAAC (BoM) ditolak setelah pengujian.** `bom.gov.au/products/IDD41270.shtml`
mengembalikan `200` tetapi isinya "This Volcanic Ash Advisory does not currently
exist" — halaman slot kosong. Daftar advisory `IDD41400.shtml` mengembalikan
"You do not have the correct authorisation to access this page". Produk advisory
BoM berada di balik autentikasi dan tidak bisa dipakai.

VONA menggantikannya dan lebih baik di setiap sisi: diterbitkan PVMBG sendiri
(otoritas resmi Indonesia untuk gunung ini), berbahasa Inggris, dan memakai
format ICAO bernomor `(2)`–`(16)` yang jauh lebih stabil daripada struktur tabel
HTML. Halaman daftar sudah memuat data inti, sehingga fetch ke halaman detail
bertanda tangan tidak diperlukan untuk jalur utama.

Konsekuensi: **sebagian besar sumber adalah HTML scraping.** Struktur halaman
bisa berubah tanpa pemberitahuan. Ketahanan terhadap kegagalan parse adalah
persyaratan utama, bukan penyempurnaan.

## 3. Tumpukan teknologi

Versi diverifikasi dari npm registry pada 2026-09-06:

| Paket | Versi | Alasan |
|---|---|---|
| Next.js | 16.3.4 | App Router, RSC, streaming Suspense. |
| React | 19.2.8 | Mengikuti Next 16. |
| `@base-ui/react` | 1.8.0 | Primitif shadcn/ui. |
| shadcn CLI | 4.21.0 | `init --base base`. |
| Tailwind CSS | 4.3.3 | Konfigurasi CSS-first. |
| next-intl | 4.14.2 | i18n + l10n App Router. |
| next-themes | 0.4.6 | Mode system/light/dark. |
| maplibre-gl | 6.7.0 | Peta, tanpa API key. |
| Biome | 2.5.12 | Lint + format, pengganti ESLint & Prettier. |
| Bun | 1.4.0 | Runtime, package manager, test runner. |

Dua jebakan versi yang harus dipatuhi:

- Paket Base UI adalah **`@base-ui/react`** (1.8.0). Paket lama
  `@base-ui-components/react` berhenti di `1.0.0-rc.0` (Des 2025) dan sudah
  ditinggalkan. Jangan dipasang.
- Next.js 16 mengganti nama `middleware.ts` menjadi **`proxy.ts`**. Middleware
  next-intl harus diletakkan di `proxy.ts`.

Sejak changelog shadcn/ui Juli 2026, Base UI adalah default; `shadcn init` tanpa
flag sudah memilih Base UI. Kita tetap menulis `--base base` secara eksplisit
supaya build non-interaktif deterministik.

Deploy: Vercel. `revalidate` dan streaming RSC berjalan native tanpa konfigurasi
tambahan.

## 4. Arsitektur data

### 4.1 Prinsip

Ambil data di server, cache lewat Next.js, tanpa basis data. Konsekuensi yang
diterima secara sadar: **tidak ada riwayat milik sendiri.** Yang ditampilkan
hanyalah kondisi sekarang plus arsip yang sudah disediakan upstream. Menambah
Postgres + cron demi grafik tren berarti menambah infrastruktur nyata untuk
dirawat; itu keputusan terpisah untuk v2.

### 4.2 Kontrak adapter

```
lib/sources/types.ts
lib/sources/vona.ts       notice VONA (tinggi & arah abu, aviation colour code)
lib/sources/status.ts     tingkat aktivitas + laporan bertanda tangan
lib/sources/eruptions.ts  timeline informasi letusan
lib/sources/gvp.ts        metadata WFS + narasi mingguan RSS
lib/sources/bmkg.ts       gempa Selat Sunda
```

Setiap adapter mengekspor satu fungsi async yang mengembalikan `Result`:

```ts
export type Result<T> =
  | { ok: true; data: T; fetchedAt: Date; sourceUrl: string }
  | { ok: false; reason: 'timeout' | 'http' | 'parse'; sourceUrl: string }
```

Aturan yang tidak bisa ditawar:

- Adapter **tidak pernah melempar** ke lapisan UI. Semua kegagalan menjadi
  `ok: false`.
- Setiap `fetch` memakai `AbortSignal.timeout(8000)`, header `User-Agent`
  eksplisit, dan `Accept-Encoding: gzip` (MAGMA menyajikan gzip; tanpa
  dekompresi hasilnya biner — sudah terbukti saat pengujian sumber).
- Setiap `fetch` memakai `next: { revalidate: 300 }`. Ini membatasi trafik ke
  server pemerintah pada maksimum 12 permintaan per jam per sumber.
- Hasil parse divalidasi dengan skema Zod sebelum dikembalikan. Kegagalan
  validasi menjadi `reason: 'parse'`, bukan data separuh benar.

### 4.3 Tipe domain

```ts
type VolcanoStatus = {
  level: 1 | 2 | 3 | 4
  levelLabel: 'Normal' | 'Waspada' | 'Siaga' | 'Awas'
  hazardRadiusKm: number
  observedAt: Date
}

type AviationColour = 'green' | 'yellow' | 'orange' | 'red'

type VonaNotice = {
  issuedAt: Date          // UTC, dari kolom waktu daftar VONA
  noticeCode: string      // mis. "20260905/0200Z"
  colour: AviationColour
  summary: string         // teks ringkasan apa adanya
  // null saat notice berbunyi "Ash-cloud is not observed"
  ashTopFtAsl: number | null
  ashTopMAsl: number | null
  ashAboveSummitFt: number | null
  ashAboveSummitM: number | null
  movementLabel: string | null   // mis. "north to northeast"
  detailUrl: string
}

type EruptionEvent = {
  occurredAt: Date        // WIB, dirakit dari tanggal Indonesia di narasi
  narrative: string
  ongoing: boolean        // "erupsi masih berlangsung"
  seismicAmplitudeMm: number | null
  durationSeconds: number | null
}

type VolcanoMeta = {
  name: string
  coordinates: [lon: number, lat: number]
  elevationM: number
  lastEruptionYear: number
}

type Quake = {
  occurredAt: Date
  magnitude: number
  depthKm: number
  coordinates: [lon: number, lat: number]
  region: string
}
```

Tipe-tipe ini adalah satu-satunya kontrak antara adapter dan komponen UI.
Komponen tidak pernah melihat HTML, XML, atau bentuk mentah dari upstream.

### 4.4 Parsing

Fungsi parse dipisahkan dari fungsi fetch dan berupa **fungsi murni**:
`(raw: string) => T`. Ini yang membuatnya bisa diuji terhadap fixture dan
dikembangkan secara TDD.

- VONA: pecah daftar menjadi blok `timeline-item`; per blok ambil waktu UTC,
  aviation colour code, kode notice, dan teks ringkasan. Angka tinggi dan arah
  gerak diambil dari teks ringkasan dengan regex atas frasa ICAO yang tetap
  ("Best estimate of ash-cloud top is around N FT (M M) above sea level or
  N FT (M M) above summit", "Ash cloud moving from X to Y").
- Status: parse tabel HTML tingkat aktivitas, ambil baris Anak Krakatau beserta
  URL laporan bertanda tangan, lalu fetch laporan itu untuk level dan radius.
- Letusan: pecah `informasi-letusan/KRA` menjadi blok `timeline-item`; parse
  tanggal Indonesia ("Minggu, 06 September 2026, pukul 07:10 WIB") dari narasi,
  bukan dari label tanggal terpisah — narasinya memuat tanggal lengkap.
- GVP: `JSON.parse` atas respons WFS untuk metadata; parse RSS mingguan dan
  saring `<item>` yang judulnya memuat "Krakatau".
- BMKG: `JSON.parse`, saring gempa dalam radius Selat Sunda.

Data VONA dan angka yang beredar di media bisa berbeda: VONA melaporkan estimasi
pengamat darat PVMBG, sedangkan angka seperti "50.000 kaki" berasal dari estimasi
satelit VAAC. Aplikasi menampilkan angka VONA apa adanya dengan atribusi sumber,
dan **tidak** mencoba merekonsiliasi keduanya.

## 5. Struktur halaman & rendering

```
app/
  [locale]/
    layout.tsx        ThemeProvider, NextIntlClientProvider, font, header
    page.tsx          Server Component, komposisi section
    error.tsx         jaring pengaman terakhir
  global-error.tsx
proxy.ts              middleware next-intl (Next 16)
```

`page.tsx` menyusun empat bagian, masing-masing dibungkus `Suspense` sendiri:

| Bagian | Sumber | Fallback |
|---|---|---|
| `StatusCard` — level, radius bahaya, aviation colour code, tinggi abu terakhir | status + VONA | `StatusSkeleton` |
| `Timeline` — kejadian erupsi & notice VONA tergabung, terurut waktu | letusan + VONA | `TimelineSkeleton` |
| `AshMap` — peta sebaran | GVP WFS + VONA | `MapSkeleton` |
| `PreparednessCards` — panduan siaga | statis | tanpa Suspense |

Karena tiap bagian punya batas Suspense sendiri, kartu Panduan Siaga tampil
seketika sementara sumber MAGMA masih diambil. Ini penting: saat darurat,
informasi yang paling cepat berguna justru yang paling murah disajikan.

Kesegaran data: satu Client Component kecil (`<AutoRefresh />`) memanggil
`router.refresh()` setiap 60 detik. Satu jalur data, tanpa cache klien terpisah,
tanpa duplikasi logika fetch. Refresh dijeda saat tab tidak terlihat
(`document.visibilityState`).

Peta: `dynamic(() => import('./ash-map'), { ssr: false })`. Bundle MapLibre
(~200KB) tidak menghalangi paint pertama.

## 6. Antarmuka

### 6.1 Mobile-first

- Satu kolom sebagai dasar; `sm:` dua kolom; `lg:` grid 12 kolom.
- Header sticky berisi indikator level, pengalih tema, pengalih bahasa.
- Tinggi peta `h-[55svh]` — satuan `svh`, bukan `vh`, supaya tidak terpotong
  bilah alamat browser mobile.
- Target sentuh minimum 44×44px.

### 6.2 Aksesibilitas

Status level **tidak boleh** dibedakan lewat warna saja. Setiap tampilan level
menggabungkan ikon, warna, dan teks: "Level III · Siaga". Amber untuk Level III,
merah untuk Level IV, keduanya lolos kontras 4.5:1 pada mode terang dan gelap.

### 6.3 Skeleton

Skeleton mencerminkan bentuk kartu aslinya (jumlah baris, proporsi), bukan
spinner generik. Memakai komponen `Skeleton` dari shadcn/ui.

### 6.4 Kejujuran data

Setiap kartu menampilkan sumber dan umur data: "MAGMA · 12 menit lalu".
Saat adapter mengembalikan `ok: false`, kartu berubah menjadi status "sumber
tidak tersedia" dengan tautan ke halaman resmi — bukan angka kosong, bukan
angka basi tanpa penanda.

Banner permanen di seluruh halaman: aplikasi ini **tidak resmi**; rujukan resmi
adalah MAGMA Indonesia, BMKG, dan BNPB. Setiap kartu menautkan sumber aslinya.

### 6.5 Peta

MapLibre GL dengan tile OpenFreeMap, tanpa API key dan tanpa batas kuota:

- Mode terang: `https://tiles.openfreemap.org/styles/positron`
- Mode gelap: `https://tiles.openfreemap.org/styles/fiord`

Gaya peta mengikuti tema aktif. Lapisan: marker Krakatau pada
`105.4233, -6.1009`, lingkaran radius bahaya 3 km, dan sektor arah sebaran abu
yang diturunkan dari arah gerak pada notice VONA terbaru.

Sektor abu adalah **indikasi arah, bukan poligon otoritatif.** Ia digambar dari
frasa arah gerak pada VONA ("moving from north to northeast"), bukan dari
koordinat batas awan abu. Peta memberi label eksplisit demikian, dan menautkan
notice VONA aslinya. Saat VONA terbaru berbunyi "Ash-cloud is not observed",
sektor tidak digambar sama sekali dan peta menyatakan itu. Menggambar
bentuk yang terlihat presisi dari data yang tidak presisi adalah kesalahan
desain, bukan penyempurnaan visual.

## 7. i18n dan l10n

Routing next-intl dengan `localePrefix: 'as-needed'`:

- `/` melayani bahasa Inggris (default). Tidak ada awalan `/en`.
- `/id` melayani bahasa Indonesia.
- `proxy.ts` membaca `Accept-Language`; browser `id-*` yang membuka `/`
  dialihkan ke `/id`.
- Cookie `NEXT_LOCALE` menyimpan pilihan manual dan menang atas header browser.
- Pengalih bahasa memakai `<Link>` dari `next-intl/navigation`, sehingga
  berfungsi tanpa JavaScript.
- `setRequestLocale()` dan `generateStaticParams()` menjaga kerangka halaman
  tetap statis; hanya bagian berdata yang dinamis.

Pesan disimpan di `messages/en.json` dan `messages/id.json`.

Lokalisasi yang sebenarnya, lewat `useFormatter`:

- **Zona waktu dikunci ke `Asia/Jakarta`**, ditampilkan sebagai "WIB". Seluruh
  laporan PVMBG dan BMKG memakai WIB; merender dengan zona waktu perangkat
  pengguna menghasilkan salah baca saat darurat.
- Waktu relatif terlokalisasi: "2 hours ago" / "2 jam lalu".
- Tinggi abu ditampilkan ganda dengan urutan mengikuti locale:
  `50,000 ft (~15 km)` untuk `en`, `50.000 kaki (~15 km)` untuk `id`.
- Pemisah ribuan mengikuti `Intl.NumberFormat` per locale.

SEO: `generateMetadata` per locale, `alternates.languages` untuk `en` dan `id`.

## 8. Pengujian

Menggunakan `bun test` — bawaan Bun, tanpa konfigurasi.

Prioritas tertinggi adalah **parser diuji terhadap fixture HTML asli** yang
disimpan di `tests/fixtures/`. Parser adalah fungsi murni, cocok dikerjakan
secara TDD.

Kasus uji yang wajib ada per parser:

1. Masukan normal — mengembalikan nilai yang benar.
2. Dokumen kosong — mengembalikan kegagalan parse, bukan crash.
3. Struktur berubah (baris/kolom hilang) — kegagalan parse.
4. VONA berbunyi "Ash-cloud is not observed" — kondisi valid; field tinggi
   menjadi `null`, bukan `0` dan bukan kesalahan parse.
5. Timeout dan HTTP non-200 — memetakan ke `reason` yang tepat.

Formatter l10n diuji terpisah: konversi kaki↔kilometer, rendering WIB, waktu
relatif dalam `en` dan `id`.

Skrip `bun run fixtures:refresh` mengunduh ulang HTML upstream ke
`tests/fixtures/`. `git diff` yang tidak kosong menjadi peringatan dini bahwa
situs sumber berubah struktur.

Playwright **sengaja tidak dipakai di v1**. Satu halaman dengan empat kartu
belum sepadan dengan biaya infrastruktur E2E. Ditambahkan saat muncul alur
interaktif yang nyata.

## 9. Perkakas

- Bun sebagai runtime, package manager, dan test runner.
- Biome 2.5.12 menggantikan ESLint dan Prettier: lint, format, pengurutan
  import, dan `useSortedClasses` untuk mengurutkan class Tailwind (menggantikan
  `prettier-plugin-tailwindcss`).
- TypeScript `strict` dengan `noUncheckedIndexedAccess`.
- CI GitHub Actions: `bun install --frozen-lockfile` → `biome ci` →
  `tsc --noEmit` → `bun test` → `next build`.
- Direktori belum berupa repositori git; `git init` adalah langkah pertama
  implementasi.

## 10. Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Struktur HTML MAGMA berubah | Kartu status mati | `Result` + skema Zod; kartu jadi "tidak tersedia"; `fixtures:refresh` mendeteksi lebih awal |
| MAGMA jadi satu titik kegagalan tunggal | Tiga dari empat kartu mati sekaligus | Diterima secara sadar: MAGMA adalah otoritas resmi untuk gunung ini; sumber lain berarti data non-otoritatif. GVP RSS tetap memberi konteks independen saat MAGMA tumbang. |
| `signature` pada URL laporan kedaluwarsa | Level & radius tidak terambil | Signature selalu diambil ulang dari HTML tingkat aktivitas pada setiap siklus revalidate, tidak pernah di-hardcode |
| Pengguna mengira app ini resmi | Bahaya nyata saat darurat | Banner permanen + tautan sumber di setiap kartu |
| Bundle MapLibre membengkak | Paint pertama lambat di 4G | Import dinamis `ssr: false`, di luar jalur render kritis |
| OpenFreeMap tumbang | Peta kosong | Peta gagal mandiri; tiga kartu lain tidak terpengaruh |
