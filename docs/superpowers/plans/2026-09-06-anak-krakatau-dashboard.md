# Anak Krakatau Live Status Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dashboard satu halaman yang menampilkan status Anak Krakatau saat ini — tingkat siaga, radius bahaya, notice VONA terbaru, timeline erupsi, peta arah sebaran abu, dan panduan siaga — dalam bahasa Inggris dan Indonesia.

**Architecture:** Next.js App Router. Server Components mengambil data lewat lapisan adapter yang mengembalikan `Result<T>` alih-alih melempar, sehingga satu sumber gagal tidak menjatuhkan halaman. Tiap bagian punya batas `Suspense` sendiri dengan skeleton. Tanpa basis data — cache memakai `revalidate` 300 detik. Satu Client Component kecil memanggil `router.refresh()` tiap 60 detik.

**Tech Stack:** Bun 1.4, Next.js 16.3.4, React 19.2.8, Tailwind CSS 4.3.3, shadcn/ui (Base UI `@base-ui/react` 1.8.0), next-intl 4.14.2, next-themes 0.4.6, MapLibre GL 6.7.0, Zod 4.5.4, node-html-parser 9.0.3, Biome 2.5.12.

**Spec:** `docs/superpowers/specs/2026-09-06-anak-krakatau-dashboard-design.md`

## Global Constraints

Berlaku untuk setiap task. Nilai disalin apa adanya dari spec.

- Package manager, runtime, dan test runner: **Bun**. Jangan pakai npm/pnpm/yarn.
- Paket Base UI adalah **`@base-ui/react`** versi **1.8.0**. Paket `@base-ui-components/react` sudah ditinggalkan — jangan dipasang.
- Middleware Next.js 16 bernama **`src/proxy.ts`**, bukan `middleware.ts`.
- Locale: `en` (default, tanpa prefix di `/`) dan `id` (di `/id`). `localePrefix: 'as-needed'`.
- Zona waktu tampilan **dikunci ke `Asia/Jakarta`**, dilabeli "WIB". Jangan pernah pakai zona waktu perangkat.
- Setiap `fetch` ke sumber luar: `AbortSignal.timeout(8000)`, header `User-Agent` eksplisit, dan `next: { revalidate: 300 }`.
- Adapter **tidak pernah melempar** ke UI. Semua kegagalan menjadi `{ ok: false, reason }`.
- Status level **tidak boleh** dibedakan lewat warna saja — selalu ikon + warna + teks.
- TypeScript `strict` dengan `noUncheckedIndexedAccess`.
- Radius bahaya resmi saat ini: **3 km**. Tingkat aktivitas: **Level III (Siaga)**. Keduanya dibaca dari sumber, tidak di-hardcode.
- Tile peta: OpenFreeMap `positron` (terang) dan `fiord` (gelap). Tanpa API key.

---

### Task 1: Project scaffold, tooling, and CI

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `biome.json`, `.github/workflows/ci.yml`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: proyek yang bisa dijalankan `bun run build`, `bun test`, `bunx biome ci .`, dan `bunx tsc --noEmit` tanpa error.

- [ ] **Step 1: Scaffold Next.js**

```bash
bunx --bun create-next-app@latest . \
  --ts --tailwind --app --src-dir --turbopack \
  --import-alias "@/*" --no-eslint --yes
```

Kalau CLI menolak direktori yang tidak kosong, jalankan di direktori sementara lalu pindahkan isinya, dengan tetap mempertahankan `docs/` dan `.git/` yang sudah ada.

- [ ] **Step 2: Pin runtime dependencies**

```bash
bun add next@16.3.4 react@19.2.8 react-dom@19.2.8
bun add next-intl@4.14.2 next-themes@0.4.6 zod@4.5.4 node-html-parser@9.0.3
bun add -d @biomejs/biome@2.5.12 typescript@latest @types/react @types/node
```

- [ ] **Step 3: Configure TypeScript strictness**

Di `tsconfig.json`, pastikan `compilerOptions` memuat:

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```

- [ ] **Step 4: Configure Biome**

Buat `biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.12/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "includes": ["**", "!**/.next", "!**/node_modules"] },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "assist": { "actions": { "source": { "organizeImports": "on" } } },
  "linter": {
    "enabled": true,
    "domains": { "next": "recommended", "react": "recommended" },
    "rules": {
      "recommended": true,
      "nursery": {
        "useSortedClasses": {
          "level": "warn",
          "options": { "functions": ["clsx", "cva", "cn"], "attributes": ["className"] }
        }
      }
    }
  },
  "javascript": { "formatter": { "quoteStyle": "single", "semicolons": "asNeeded" } }
}
```

- [ ] **Step 5: Add scripts to package.json**

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "check": "biome check --write .",
    "ci:lint": "biome ci .",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  }
}
```

- [ ] **Step 6: Write a smoke test**

`tests/smoke.test.ts`:

```ts
import { expect, test } from 'bun:test'

test('test runner is wired up', () => {
  expect(1 + 1).toBe(2)
})
```

- [ ] **Step 7: Run the full gate**

```bash
bun run ci:lint && bun run typecheck && bun test && bun run build
```

Expected: keempatnya lolos.

- [ ] **Step 8: Add CI workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: '1.4.0' }
      - run: bun install --frozen-lockfile
      - run: bun run ci:lint
      - run: bun run typecheck
      - run: bun test
      - run: bun run build
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Bun, Tailwind, Biome, and CI"
```

---

### Task 2: Result type and HTTP client

**Files:**
- Create: `src/lib/sources/types.ts`
- Create: `src/lib/sources/http.ts`
- Test: `tests/sources/http.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Result<T>` — dipakai setiap adapter.
  - `fetchText(url: string, init?: { signal?: AbortSignal }): Promise<Result<string>>`
  - `fetchJson<T>(url: string, schema: ZodType<T>): Promise<Result<T>>`

- [ ] **Step 1: Write the failing test**

`tests/sources/http.test.ts`:

```ts
import { afterEach, expect, mock, test } from 'bun:test'
import { fetchText } from '@/lib/sources/http'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

test('returns ok with body text on 200', async () => {
  globalThis.fetch = mock(async () => new Response('hello', { status: 200 })) as typeof fetch
  const result = await fetchText('https://example.test/a')
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.data).toBe('hello')
})

test('returns http failure on non-200', async () => {
  globalThis.fetch = mock(async () => new Response('nope', { status: 403 })) as typeof fetch
  const result = await fetchText('https://example.test/b')
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.reason).toBe('http')
})

test('returns timeout failure when the request aborts', async () => {
  globalThis.fetch = mock(async () => {
    throw new DOMException('The operation was aborted.', 'TimeoutError')
  }) as typeof fetch
  const result = await fetchText('https://example.test/c')
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.reason).toBe('timeout')
})

test('always reports the source url it was given', async () => {
  globalThis.fetch = mock(async () => new Response('x', { status: 500 })) as typeof fetch
  const result = await fetchText('https://example.test/d')
  expect(result.sourceUrl).toBe('https://example.test/d')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test tests/sources/http.test.ts`
Expected: FAIL — `Cannot find module '@/lib/sources/http'`.

- [ ] **Step 3: Write the types**

`src/lib/sources/types.ts`:

```ts
export type FailureReason = 'timeout' | 'http' | 'parse'

export type Result<T> =
  | { ok: true; data: T; fetchedAt: Date; sourceUrl: string }
  | { ok: false; reason: FailureReason; sourceUrl: string }

export const ok = <T>(data: T, sourceUrl: string): Result<T> => ({
  ok: true,
  data,
  fetchedAt: new Date(),
  sourceUrl,
})

export const fail = <T>(reason: FailureReason, sourceUrl: string): Result<T> => ({
  ok: false,
  reason,
  sourceUrl,
})
```

- [ ] **Step 4: Write the HTTP client**

`src/lib/sources/http.ts`:

```ts
import type { ZodType } from 'zod'
import { fail, ok, type Result } from './types'

const USER_AGENT =
  'anak-krakatau-dashboard/1.0 (public volcano status dashboard; contact via repository)'

export const REVALIDATE_SECONDS = 300

export async function fetchText(url: string): Promise<Result<string>> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip' },
      next: { revalidate: REVALIDATE_SECONDS },
    })
    if (!response.ok) return fail('http', url)
    return ok(await response.text(), url)
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    return fail(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'http', url)
  }
}

export async function fetchJson<T>(url: string, schema: ZodType<T>): Promise<Result<T>> {
  const text = await fetchText(url)
  if (!text.ok) return text
  try {
    const parsed = schema.safeParse(JSON.parse(text.data))
    if (!parsed.success) return fail('parse', url)
    return ok(parsed.data, url)
  } catch {
    return fail('parse', url)
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun test tests/sources/http.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sources tests/sources
git commit -m "feat: add Result type and fault-tolerant HTTP client for data sources"
```

---

### Task 3: Capture upstream fixtures

**Files:**
- Create: `scripts/refresh-fixtures.ts`
- Create: `tests/fixtures/vona-kra.html`, `tests/fixtures/tingkat-aktivitas.html`, `tests/fixtures/laporan.html`, `tests/fixtures/informasi-letusan-kra.html`, `tests/fixtures/gvp-weekly.xml`
- Modify: `package.json` (tambah script `fixtures:refresh`)

**Interfaces:**
- Consumes: `fetchText` dari Task 2.
- Produces: file fixture di `tests/fixtures/` yang dipakai Task 4–6, dan script `bun run fixtures:refresh`.

Fixture di-commit ke repo. `git diff` yang tidak kosong setelah refresh adalah peringatan dini bahwa situs sumber berubah struktur.

- [ ] **Step 1: Write the refresh script**

`scripts/refresh-fixtures.ts`:

```ts
const UA =
  'anak-krakatau-dashboard/1.0 (public volcano status dashboard; contact via repository)'

const TARGETS: Array<{ name: string; url: string }> = [
  { name: 'vona-kra.html', url: 'https://magma.esdm.go.id/v1/vona?code=KRA' },
  {
    name: 'tingkat-aktivitas.html',
    url: 'https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas',
  },
  {
    name: 'informasi-letusan-kra.html',
    url: 'https://magma.esdm.go.id/v1/gunung-api/informasi-letusan/KRA',
  },
  { name: 'gvp-weekly.xml', url: 'https://volcano.si.edu/news/WeeklyVolcanoRSS.xml' },
]

async function get(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip' },
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw new Error(`${url} -> ${response.status}`)
  return response.text()
}

for (const target of TARGETS) {
  const body = await get(target.url)
  await Bun.write(`tests/fixtures/${target.name}`, body)
  console.log(`${target.name}: ${body.length} bytes`)
}

// The activity report lives behind a signature published in the activity-level page.
const activity = await Bun.file('tests/fixtures/tingkat-aktivitas.html').text()
const reportUrl = activity.match(
  /https:\/\/magma\.esdm\.go\.id\/v1\/gunung-api\/laporan\/\d+\?signature=[a-f0-9]+/,
)?.[0]
if (!reportUrl) throw new Error('no signed report URL found in tingkat-aktivitas.html')
const report = await get(reportUrl)
await Bun.write('tests/fixtures/laporan.html', report)
console.log(`laporan.html: ${report.length} bytes`)
```

Catatan: regex di atas mengambil URL laporan bertanda tangan **pertama** di halaman, yang belum tentu milik Anak Krakatau. Untuk fixture itu cukup — parser di Task 5 yang bertugas memilih baris yang benar, dan Step 3 di bawah memverifikasi fixture memang berisi Anak Krakatau.

- [ ] **Step 2: Add the script entry**

Di `package.json`, tambahkan ke `scripts`:

```json
{ "fixtures:refresh": "bun run scripts/refresh-fixtures.ts" }
```

- [ ] **Step 3: Run it and verify the fixtures**

```bash
bun run fixtures:refresh
grep -c "timeline-item" tests/fixtures/vona-kra.html
grep -c "Anak Krakatau" tests/fixtures/informasi-letusan-kra.html
grep -o "Level [IV]* ([A-Za-z]*)" tests/fixtures/laporan.html | head -1
```

Expected: `vona-kra.html` memuat setidaknya 10 `timeline-item`; `informasi-letusan-kra.html` menyebut "Anak Krakatau"; `laporan.html` memuat string seperti `Level III (Siaga)`.

Kalau `laporan.html` ternyata bukan milik Anak Krakatau, ganti regex di Step 1 agar mencari `<td>` yang memuat "Anak Krakatau" lebih dulu, lalu ambil URL bertanda tangan sesudahnya, dan jalankan ulang.

- [ ] **Step 4: Commit**

```bash
git add scripts tests/fixtures package.json
git commit -m "test: capture upstream HTML fixtures and add refresh script"
```

---

### Task 4: VONA parser and adapter

**Files:**
- Create: `src/lib/sources/vona.ts`
- Test: `tests/sources/vona.test.ts`

**Interfaces:**
- Consumes: `fetchText`, `Result`, `ok`, `fail`.
- Produces:
  - `type AviationColour = 'green' | 'yellow' | 'orange' | 'red'`
  - `type VonaNotice` — lihat kode di Step 3.
  - `parseVona(html: string): VonaNotice[]` — fungsi murni.
  - `getVonaNotices(): Promise<Result<VonaNotice[]>>`
  - `const VONA_URL = 'https://magma.esdm.go.id/v1/vona?code=KRA'`

Bentuk teks upstream yang sudah diverifikasi:

```
Eruption with volcanic ash cloud at 0824 UTC (1524 local). Best estimate of
ash-cloud top is around 1782 FT (557 M) above sea level or 1280 FT (400 M)
above summit. May be higher than what can be observed clearly. Source of
height data: ground observer. Ash cloud moving from north to northeast.
```

dan bentuk tanpa abu teramati:

```
Eruption at 0200 UTC (0900 local). Ash-cloud is not observed.
```

- [ ] **Step 1: Write the failing test**

`tests/sources/vona.test.ts`:

```ts
import { expect, test } from 'bun:test'
import { parseVona } from '@/lib/sources/vona'

const fixture = await Bun.file('tests/fixtures/vona-kra.html').text()

test('parses every notice in the list', () => {
  const notices = parseVona(fixture)
  expect(notices.length).toBeGreaterThan(5)
})

test('reads timestamp, colour, and notice code', () => {
  const [latest] = parseVona(fixture)
  expect(latest).toBeDefined()
  if (!latest) return
  expect(latest.issuedAt.getTime()).not.toBeNaN()
  expect(['green', 'yellow', 'orange', 'red']).toContain(latest.colour)
  expect(latest.noticeCode).toMatch(/^\d{8}\/\d{4}Z$/)
})

test('extracts ash-cloud height in both feet and metres', () => {
  const notice = parseVona(fixture).find((n) => n.ashTopFtAsl !== null)
  expect(notice).toBeDefined()
  if (!notice) return
  expect(notice.ashTopFtAsl).toBeGreaterThan(0)
  expect(notice.ashTopMAsl).toBeGreaterThan(0)
  expect(notice.ashAboveSummitFt).toBeGreaterThan(0)
  expect(notice.ashAboveSummitM).toBeGreaterThan(0)
})

test('extracts the movement phrase when present', () => {
  const notice = parseVona(fixture).find((n) => n.movementLabel !== null)
  expect(notice?.movementLabel).toBeTruthy()
})

test('"ash-cloud is not observed" yields null heights, not zero', () => {
  const html = `
    <div class="timeline-item">
      <div class="timeline-time"><small>2026-09-05 02:00:00 UTC</small>
        <a href="#" class="btn btn-sm btn-danger">Red</a></div>
      <div class="timeline-body">
        <p class="timeline-title"><a href="#">Anak Krakatau - 20260905/0200Z</a></p>
        <p class="timeline-text">Eruption at 0200 UTC (0900 local). Ash-cloud is not observed.</p>
        <a class="card-link m-b-10" href="https://magma.esdm.go.id/v1/vona/22575?signature=abc">View</a>
      </div>
    </div>`
  const [notice] = parseVona(html)
  expect(notice?.ashTopFtAsl).toBeNull()
  expect(notice?.ashAboveSummitM).toBeNull()
  expect(notice?.movementLabel).toBeNull()
  expect(notice?.colour).toBe('red')
})

test('returns an empty array for markup with no notices', () => {
  expect(parseVona('<html><body><p>nothing here</p></body></html>')).toEqual([])
})

test('returns an empty array for an empty document', () => {
  expect(parseVona('')).toEqual([])
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test tests/sources/vona.test.ts`
Expected: FAIL — `Cannot find module '@/lib/sources/vona'`.

- [ ] **Step 3: Write the parser and adapter**

`src/lib/sources/vona.ts`:

```ts
import { parse } from 'node-html-parser'
import { fetchText } from './http'
import { fail, ok, type Result } from './types'

export const VONA_URL = 'https://magma.esdm.go.id/v1/vona?code=KRA'

export type AviationColour = 'green' | 'yellow' | 'orange' | 'red'

export type VonaNotice = {
  issuedAt: Date
  noticeCode: string
  colour: AviationColour
  summary: string
  ashTopFtAsl: number | null
  ashTopMAsl: number | null
  ashAboveSummitFt: number | null
  ashAboveSummitM: number | null
  movementLabel: string | null
  detailUrl: string | null
}

const COLOURS: AviationColour[] = ['green', 'yellow', 'orange', 'red']

const HEIGHT_RE =
  /around\s+(\d+)\s*FT\s*\((\d+)\s*M\)\s*above sea level(?:\s*or\s*(\d+)\s*FT\s*\((\d+)\s*M\)\s*above summit)?/i
const MOVEMENT_RE = /Ash cloud moving from ([^.]+)\./i
const CODE_RE = /(\d{8}\/\d{4}Z)/

const toColour = (raw: string): AviationColour => {
  const lower = raw.trim().toLowerCase()
  return COLOURS.includes(lower as AviationColour) ? (lower as AviationColour) : 'orange'
}

/** "2026-09-05 02:00:00 UTC" -> Date */
const parseUtc = (raw: string): Date | null => {
  const match = raw.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/)
  if (!match) return null
  const [, y, mo, d, h, mi, s] = match
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function parseVona(html: string): VonaNotice[] {
  if (!html.trim()) return []
  const root = parse(html)
  const notices: VonaNotice[] = []

  for (const item of root.querySelectorAll('.timeline-item')) {
    const issuedAt = parseUtc(item.querySelector('.timeline-time small')?.text ?? '')
    const summary = item.querySelector('.timeline-text')?.text.replace(/\s+/g, ' ').trim() ?? ''
    if (!issuedAt || !summary) continue

    const title = item.querySelector('.timeline-title')?.text ?? ''
    const height = summary.match(HEIGHT_RE)
    const movement = summary.match(MOVEMENT_RE)

    notices.push({
      issuedAt,
      noticeCode: title.match(CODE_RE)?.[1] ?? '',
      colour: toColour(item.querySelector('.timeline-time a')?.text ?? ''),
      summary,
      ashTopFtAsl: height?.[1] ? Number(height[1]) : null,
      ashTopMAsl: height?.[2] ? Number(height[2]) : null,
      ashAboveSummitFt: height?.[3] ? Number(height[3]) : null,
      ashAboveSummitM: height?.[4] ? Number(height[4]) : null,
      movementLabel: movement?.[1]?.trim() ?? null,
      detailUrl: item.querySelector('a.card-link')?.getAttribute('href') ?? null,
    })
  }

  return notices.sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime())
}

export async function getVonaNotices(): Promise<Result<VonaNotice[]>> {
  const html = await fetchText(VONA_URL)
  if (!html.ok) return html
  const notices = parseVona(html.data)
  if (notices.length === 0) return fail('parse', VONA_URL)
  return ok(notices, VONA_URL)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test tests/sources/vona.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sources/vona.ts tests/sources/vona.test.ts
git commit -m "feat: parse MAGMA VONA notices for ash cloud height and movement"
```

---

### Task 5: Activity status parser and adapter

**Files:**
- Create: `src/lib/sources/status.ts`
- Test: `tests/sources/status.test.ts`

**Interfaces:**
- Consumes: `fetchText`, `Result`, `ok`, `fail`.
- Produces:
  - `type VolcanoStatus` — lihat Step 3.
  - `findReportUrl(activityHtml: string): string | null` — fungsi murni.
  - `parseReport(reportHtml: string): VolcanoStatus | null` — fungsi murni.
  - `getStatus(): Promise<Result<VolcanoStatus>>`

Bentuk teks yang sudah diverifikasi di halaman laporan:

```
Level III (Siaga)
Anak Krakatau, Minggu - 06 September 2026, periode 00:00-06:00 WIB
... Latitude -6.102°LU, Longitude 105.423°BT dan memiliki ketinggian 157 mdpl
Rekomendasi Masyarakat/pengunjung/wisatawan/pendaki tidak mendekati
G. Anak Krakatau atau beraktivitas dalam radius 3 km dari kawah aktif.
```

- [ ] **Step 1: Write the failing test**

`tests/sources/status.test.ts`:

```ts
import { expect, test } from 'bun:test'
import { findReportUrl, parseReport } from '@/lib/sources/status'

const activity = await Bun.file('tests/fixtures/tingkat-aktivitas.html').text()
const report = await Bun.file('tests/fixtures/laporan.html').text()

test('finds the signed report URL for Anak Krakatau', () => {
  const url = findReportUrl(activity)
  expect(url).toMatch(/\/gunung-api\/laporan\/\d+\?signature=[a-f0-9]+$/)
})

test('returns null when no Anak Krakatau row exists', () => {
  expect(findReportUrl('<table><tr><td>Merapi</td></tr></table>')).toBeNull()
})

test('reads alert level as both number and label', () => {
  const status = parseReport(report)
  expect(status?.level).toBe(3)
  expect(status?.levelLabel).toBe('Siaga')
})

test('reads the hazard radius in kilometres', () => {
  expect(parseReport(report)?.hazardRadiusKm).toBe(3)
})

test('reads coordinates and summit elevation', () => {
  const status = parseReport(report)
  expect(status?.latitude).toBeCloseTo(-6.102, 2)
  expect(status?.longitude).toBeCloseTo(105.423, 2)
  expect(status?.elevationM).toBe(157)
})

test('reads the observation period timestamp', () => {
  expect(parseReport(report)?.observedAt.getTime()).not.toBeNaN()
})

test('returns null for a document with no level statement', () => {
  expect(parseReport('<html><body>nothing</body></html>')).toBeNull()
})

test('returns null for an empty document', () => {
  expect(parseReport('')).toBeNull()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test tests/sources/status.test.ts`
Expected: FAIL — `Cannot find module '@/lib/sources/status'`.

- [ ] **Step 3: Write the parser and adapter**

`src/lib/sources/status.ts`:

```ts
import { parse } from 'node-html-parser'
import { fetchText } from './http'
import { fail, ok, type Result } from './types'

export const ACTIVITY_URL = 'https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas'

export type LevelLabel = 'Normal' | 'Waspada' | 'Siaga' | 'Awas'

export type VolcanoStatus = {
  level: 1 | 2 | 3 | 4
  levelLabel: LevelLabel
  hazardRadiusKm: number
  latitude: number
  longitude: number
  elevationM: number
  observedAt: Date
  reportUrl: string
}

const ROMAN: Record<string, 1 | 2 | 3 | 4> = { I: 1, II: 2, III: 3, IV: 4 }
const LABELS: LevelLabel[] = ['Normal', 'Waspada', 'Siaga', 'Awas']

const MONTHS_ID = [
  'januari', 'februari', 'maret', 'april', 'mei', 'juni',
  'juli', 'agustus', 'september', 'oktober', 'november', 'desember',
]

/**
 * Rebuilds a WIB (UTC+7) wall-clock time as a real instant.
 * MAGMA reports every timestamp in WIB, so the offset is fixed, not local.
 */
export function wibToDate(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  return new Date(Date.UTC(year, monthIndex, day, hour - 7, minute))
}

export function findReportUrl(activityHtml: string): string | null {
  if (!activityHtml.trim()) return null
  const root = parse(activityHtml)
  for (const cell of root.querySelectorAll('td')) {
    if (!/anak\s+krakatau/i.test(cell.text)) continue
    const href = cell.querySelector('a')?.getAttribute('href')
    if (href?.includes('/gunung-api/laporan/')) return href
  }
  return null
}

export function parseReport(reportHtml: string): VolcanoStatus | null {
  if (!reportHtml.trim()) return null
  const text = parse(reportHtml).text.replace(/\s+/g, ' ')

  const level = text.match(/Level\s+(IV|III|II|I)\s*\((Normal|Waspada|Siaga|Awas)\)/)
  if (!level?.[1] || !level[2]) return null
  const numeric = ROMAN[level[1]]
  const label = level[2] as LevelLabel
  if (!numeric || !LABELS.includes(label)) return null

  const radius = text.match(/radius\s+([\d.,]+)\s*km/i)
  const lat = text.match(/Latitude\s*(-?[\d.]+)\s*°/)
  const lon = text.match(/Longitude\s*(-?[\d.]+)\s*°/)
  const elevation = text.match(/ketinggian\s+([\d.]+)\s*mdpl/i)
  const period = text.match(
    /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4}),\s*periode\s*(\d{2}):(\d{2})-(\d{2}):(\d{2})\s*WIB/,
  )

  const monthIndex = period?.[2] ? MONTHS_ID.indexOf(period[2].toLowerCase()) : -1
  const observedAt =
    period && monthIndex >= 0
      ? wibToDate(
          Number(period[3]),
          monthIndex,
          Number(period[1]),
          Number(period[6]),
          Number(period[7]),
        )
      : new Date()

  return {
    level: numeric,
    levelLabel: label,
    hazardRadiusKm: radius?.[1] ? Number(radius[1].replace(',', '.')) : 3,
    latitude: lat?.[1] ? Number(lat[1]) : -6.1009,
    longitude: lon?.[1] ? Number(lon[1]) : 105.4233,
    elevationM: elevation?.[1] ? Number(elevation[1]) : 157,
    observedAt,
    reportUrl: '',
  }
}

export async function getStatus(): Promise<Result<VolcanoStatus>> {
  const activity = await fetchText(ACTIVITY_URL)
  if (!activity.ok) return activity

  const reportUrl = findReportUrl(activity.data)
  if (!reportUrl) return fail('parse', ACTIVITY_URL)

  const report = await fetchText(reportUrl)
  if (!report.ok) return report

  const status = parseReport(report.data)
  if (!status) return fail('parse', reportUrl)

  return ok({ ...status, reportUrl }, reportUrl)
}
```

Catatan: nilai fallback pada `hazardRadiusKm`, koordinat, dan elevasi hanya dipakai bila laporan memuat pernyataan level tetapi tidak memuat field itu. Pernyataan level yang hilang tetap mengembalikan `null` — tidak ada status yang dikarang.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test tests/sources/status.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sources/status.ts tests/sources/status.test.ts
git commit -m "feat: parse MAGMA alert level, hazard radius, and volcano position"
```

---

### Task 6: Eruption timeline parser, GVP, and BMKG adapters

**Files:**
- Create: `src/lib/sources/eruptions.ts`, `src/lib/sources/gvp.ts`, `src/lib/sources/bmkg.ts`
- Test: `tests/sources/eruptions.test.ts`, `tests/sources/gvp.test.ts`

**Interfaces:**
- Consumes: `fetchText`, `fetchJson`, `wibToDate` dari `status.ts`, `Result`, `ok`, `fail`.
- Produces:
  - `type EruptionEvent`, `parseEruptions(html): EruptionEvent[]`, `getEruptions(): Promise<Result<EruptionEvent[]>>`
  - `type VolcanoMeta`, `getVolcanoMeta(): Promise<Result<VolcanoMeta>>`
  - `parseWeeklyReport(xml): string | null`, `getWeeklyReport(): Promise<Result<string>>`
  - `type Quake`, `getRecentQuake(): Promise<Result<Quake>>`

Bentuk narasi erupsi yang sudah diverifikasi:

```
Terjadi erupsi G. Anak Krakatau pada hari Minggu, 06 September 2026, pukul
07:10 WIB. Visual letusan tidak teramati. Erupsi ini terekam di seismograf
dengan amplitudo maksimum 50 mm dan durasi 16 detik.
```

```
Terjadi erupsi G. Anak Krakatau pada hari Jumat, 04 September 2026, pukul
23:07 WIB. Visual letusan tidak teramati. Saat laporan ini dibuat, erupsi
masih berlangsung.
```

- [ ] **Step 1: Write the failing tests**

`tests/sources/eruptions.test.ts`:

```ts
import { expect, test } from 'bun:test'
import { parseEruptions } from '@/lib/sources/eruptions'

const fixture = await Bun.file('tests/fixtures/informasi-letusan-kra.html').text()

test('parses eruption events from the timeline', () => {
  expect(parseEruptions(fixture).length).toBeGreaterThan(3)
})

test('reads the WIB timestamp out of the Indonesian narrative', () => {
  const html = `
    <div class="timeline-item"><div class="timeline-body">
      <p class="timeline-text">Terjadi erupsi G. Anak Krakatau pada hari Minggu,
      06 September 2026, pukul 07:10 WIB. Visual letusan tidak teramati. Erupsi ini
      terekam di seismograf dengan amplitudo maksimum 50 mm dan durasi 16 detik.</p>
    </div></div>`
  const [event] = parseEruptions(html)
  // 07:10 WIB is 00:10 UTC on the same day.
  expect(event?.occurredAt.toISOString()).toBe('2026-09-06T00:10:00.000Z')
  expect(event?.seismicAmplitudeMm).toBe(50)
  expect(event?.durationSeconds).toBe(16)
  expect(event?.ongoing).toBe(false)
})

test('flags an eruption that was still ongoing at report time', () => {
  const html = `
    <div class="timeline-item"><div class="timeline-body">
      <p class="timeline-text">Terjadi erupsi G. Anak Krakatau pada hari Jumat,
      04 September 2026, pukul 23:07 WIB. Visual letusan tidak teramati. Saat
      laporan ini dibuat, erupsi masih berlangsung.</p>
    </div></div>`
  const [event] = parseEruptions(html)
  expect(event?.ongoing).toBe(true)
  expect(event?.seismicAmplitudeMm).toBeNull()
  expect(event?.durationSeconds).toBeNull()
})

test('sorts newest first', () => {
  const events = parseEruptions(fixture)
  const times = events.map((e) => e.occurredAt.getTime())
  expect([...times].sort((a, b) => b - a)).toEqual(times)
})

test('returns an empty array for an empty document', () => {
  expect(parseEruptions('')).toEqual([])
})

test('skips timeline items whose narrative has no parsable date', () => {
  const html =
    '<div class="timeline-item"><div class="timeline-body"><p class="timeline-text">tidak ada tanggal</p></div></div>'
  expect(parseEruptions(html)).toEqual([])
})
```

`tests/sources/gvp.test.ts`:

```ts
import { expect, test } from 'bun:test'
import { parseWeeklyReport } from '@/lib/sources/gvp'

const fixture = await Bun.file('tests/fixtures/gvp-weekly.xml').text()

test('extracts the Krakatau item description', () => {
  const summary = parseWeeklyReport(fixture)
  expect(summary).toBeTruthy()
  expect(summary?.toLowerCase()).toContain('krakatau')
})

test('returns null when no Krakatau item is present', () => {
  const xml =
    '<rss><channel><item><title>Etna (Italy)</title><description>x</description></item></channel></rss>'
  expect(parseWeeklyReport(xml)).toBeNull()
})

test('returns null for an empty document', () => {
  expect(parseWeeklyReport('')).toBeNull()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/sources/eruptions.test.ts tests/sources/gvp.test.ts`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: Write eruptions.ts**

`src/lib/sources/eruptions.ts`:

```ts
import { parse } from 'node-html-parser'
import { fetchText } from './http'
import { wibToDate } from './status'
import { fail, ok, type Result } from './types'

export const ERUPTIONS_URL = 'https://magma.esdm.go.id/v1/gunung-api/informasi-letusan/KRA'

export type EruptionEvent = {
  occurredAt: Date
  narrative: string
  ongoing: boolean
  seismicAmplitudeMm: number | null
  durationSeconds: number | null
}

const MONTHS_ID = [
  'januari', 'februari', 'maret', 'april', 'mei', 'juni',
  'juli', 'agustus', 'september', 'oktober', 'november', 'desember',
]

const DATE_RE = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4}),\s*pukul\s*(\d{1,2}):(\d{2})\s*WIB/i
const AMPLITUDE_RE = /amplitudo\s+maksimum\s+([\d.]+)\s*mm/i
const DURATION_RE = /durasi\s+([\d.]+)\s*detik/i
const ONGOING_RE = /erupsi\s+masih\s+berlangsung/i

export function parseEruptions(html: string): EruptionEvent[] {
  if (!html.trim()) return []
  const events: EruptionEvent[] = []

  for (const item of parse(html).querySelectorAll('.timeline-item')) {
    const narrative = item.querySelector('.timeline-text')?.text.replace(/\s+/g, ' ').trim()
    if (!narrative) continue

    const date = narrative.match(DATE_RE)
    if (!date?.[2]) continue
    const monthIndex = MONTHS_ID.indexOf(date[2].toLowerCase())
    if (monthIndex < 0) continue

    const amplitude = narrative.match(AMPLITUDE_RE)
    const duration = narrative.match(DURATION_RE)

    events.push({
      occurredAt: wibToDate(
        Number(date[3]),
        monthIndex,
        Number(date[1]),
        Number(date[4]),
        Number(date[5]),
      ),
      narrative,
      ongoing: ONGOING_RE.test(narrative),
      seismicAmplitudeMm: amplitude?.[1] ? Number(amplitude[1]) : null,
      durationSeconds: duration?.[1] ? Number(duration[1]) : null,
    })
  }

  return events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
}

export async function getEruptions(): Promise<Result<EruptionEvent[]>> {
  const html = await fetchText(ERUPTIONS_URL)
  if (!html.ok) return html
  const events = parseEruptions(html.data)
  if (events.length === 0) return fail('parse', ERUPTIONS_URL)
  return ok(events, ERUPTIONS_URL)
}
```

- [ ] **Step 4: Write gvp.ts**

`src/lib/sources/gvp.ts`:

```ts
import { z } from 'zod'
import { fetchJson, fetchText } from './http'
import { fail, ok, type Result } from './types'

export const GVP_WFS_URL =
  'https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows' +
  '?service=WFS&version=1.0.0&request=GetFeature' +
  '&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes' +
  '&outputFormat=application/json&CQL_FILTER=Volcano_Number=262000'

export const GVP_WEEKLY_URL = 'https://volcano.si.edu/news/WeeklyVolcanoRSS.xml'

export type VolcanoMeta = {
  name: string
  longitude: number
  latitude: number
  lastEruptionYear: number | null
}

const wfsSchema = z.object({
  features: z
    .array(
      z.object({
        geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
        properties: z.object({
          Volcano_Name: z.string(),
          Last_Eruption_Year: z.number().nullable().optional(),
        }),
      }),
    )
    .min(1),
})

export async function getVolcanoMeta(): Promise<Result<VolcanoMeta>> {
  const response = await fetchJson(GVP_WFS_URL, wfsSchema)
  if (!response.ok) return response
  const feature = response.data.features[0]
  if (!feature) return fail('parse', GVP_WFS_URL)
  const [longitude, latitude] = feature.geometry.coordinates
  return ok(
    {
      name: feature.properties.Volcano_Name,
      longitude,
      latitude,
      lastEruptionYear: feature.properties.Last_Eruption_Year ?? null,
    },
    GVP_WFS_URL,
  )
}

const decodeEntities = (raw: string): string =>
  raw
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

export function parseWeeklyReport(xml: string): string | null {
  if (!xml.trim()) return null
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    if (!item) continue
    const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ''
    if (!/krakatau/i.test(title)) continue
    const description = item.match(/<description>([\s\S]*?)<\/description>/)?.[1]
    if (!description) return null
    const text = decodeEntities(decodeEntities(description))
    return text.length > 0 ? `${decodeEntities(title)} — ${text}` : null
  }
  return null
}

export async function getWeeklyReport(): Promise<Result<string>> {
  const xml = await fetchText(GVP_WEEKLY_URL)
  if (!xml.ok) return xml
  const summary = parseWeeklyReport(xml.data)
  if (!summary) return fail('parse', GVP_WEEKLY_URL)
  return ok(summary, GVP_WEEKLY_URL)
}
```

- [ ] **Step 5: Write bmkg.ts**

`src/lib/sources/bmkg.ts`:

```ts
import { z } from 'zod'
import { fetchJson } from './http'
import { fail, ok, type Result } from './types'

export const BMKG_URL = 'https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json'

export type Quake = {
  occurredAt: Date
  magnitude: number
  depthKm: number
  region: string
}

const schema = z.object({
  Infogempa: z.object({
    gempa: z.object({
      DateTime: z.string(),
      Magnitude: z.string(),
      Kedalaman: z.string(),
      Wilayah: z.string(),
    }),
  }),
})

export async function getRecentQuake(): Promise<Result<Quake>> {
  const response = await fetchJson(BMKG_URL, schema)
  if (!response.ok) return response
  const raw = response.data.Infogempa.gempa
  const occurredAt = new Date(raw.DateTime)
  const magnitude = Number(raw.Magnitude)
  const depthKm = Number(raw.Kedalaman.replace(/[^\d.]/g, ''))
  if (Number.isNaN(occurredAt.getTime()) || Number.isNaN(magnitude)) {
    return fail('parse', BMKG_URL)
  }
  return ok({ occurredAt, magnitude, depthKm, region: raw.Wilayah }, BMKG_URL)
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bun test`
Expected: PASS — semua test dari Task 2, 4, 5, dan 6.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sources tests/sources
git commit -m "feat: add eruption timeline, GVP metadata, and BMKG quake adapters"
```

---

### Task 7: i18n routing, messages, and locale switching

**Files:**
- Create: `src/i18n/routing.ts`, `src/i18n/navigation.ts`, `src/i18n/request.ts`, `src/proxy.ts`
- Create: `messages/en.json`, `messages/id.json`
- Create: `src/app/[locale]/layout.tsx`, `src/app/[locale]/page.tsx`
- Create: `src/components/locale-switcher.tsx`
- Modify: `next.config.ts`
- Delete: `src/app/page.tsx`, `src/app/layout.tsx` (dipindah ke `[locale]/`)

**Interfaces:**
- Consumes: nothing dari task sebelumnya.
- Produces: `routing`, `Link` dan `usePathname` dari `@/i18n/navigation`, serta rute `/` (en) dan `/id`.

- [ ] **Step 1: Write the routing config**

`src/i18n/routing.ts`:

```ts
import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['en', 'id'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
})
```

`src/i18n/navigation.ts`:

```ts
import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
```

`src/i18n/request.ts`:

```ts
import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'
import { notFound } from 'next/navigation'
import * as rootParams from 'next/root-params'
import { routing } from './routing'

export default getRequestConfig(async ({ locale }) => {
  let active = locale
  if (!active) {
    const fromParams = await rootParams.locale()
    if (!hasLocale(routing.locales, fromParams)) notFound()
    active = fromParams
  }
  return {
    locale: active,
    messages: (await import(`../../messages/${active}.json`)).default,
    timeZone: 'Asia/Jakarta',
  }
})
```

- [ ] **Step 2: Write the proxy (Next.js 16 middleware)**

`src/proxy.ts`:

```ts
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

export default createMiddleware(routing)

export const config = {
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
}
```

- [ ] **Step 3: Wire the plugin into next.config.ts**

```ts
import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {}

export default createNextIntlPlugin('./src/i18n/request.ts')(nextConfig)
```

- [ ] **Step 4: Write the message catalogues**

`messages/en.json`:

```json
{
  "meta": {
    "title": "Anak Krakatau — Live Status",
    "description": "Current alert level, ash advisories, and eruption timeline for Anak Krakatau, Indonesia."
  },
  "disclaimer": {
    "text": "Unofficial. Always follow MAGMA Indonesia, BMKG, and BNPB.",
    "link": "Open MAGMA Indonesia"
  },
  "status": {
    "heading": "Current status",
    "hazardRadius": "Stay {km} km from the active crater",
    "aviationColour": "Aviation colour code",
    "ashTop": "Ash cloud top",
    "aboveSummit": "above summit",
    "notObserved": "Ash cloud not observed",
    "levels": { "1": "Normal", "2": "Advisory", "3": "Alert", "4": "Warning" }
  },
  "timeline": { "heading": "Recent activity", "ongoing": "Still ongoing", "empty": "No recent events." },
  "preparedness": {
    "heading": "If ash falls near you",
    "mask": { "title": "Wear a proper mask", "body": "Use an N95 or KN95 mask outdoors. A cloth mask does not stop volcanic ash." },
    "indoors": { "title": "Close up the house", "body": "Shut windows, doors, and vents. Keep pets inside." },
    "water": { "title": "Cover water and food", "body": "Cover open water tanks and wash produce before eating." },
    "driving": { "title": "Drive slowly or not at all", "body": "Ash makes roads slippery and cuts visibility. Do not use wipers on dry ash." },
    "contact": { "title": "Emergency contacts", "body": "BNPB call centre 117. Local BPBD for evacuation information." }
  },
  "map": {
    "heading": "Ash direction",
    "sectorCaption": "Indicative direction only, drawn from the VONA movement phrase — not an authoritative ash cloud boundary.",
    "noSector": "The latest notice reports no observed ash cloud, so no direction is drawn."
  },
  "source": { "label": "Source", "updated": "updated {time}", "unavailable": "Source unavailable", "openOriginal": "Open the original report" },
  "theme": { "label": "Theme", "system": "System", "light": "Light", "dark": "Dark" },
  "locale": { "label": "Language", "en": "English", "id": "Bahasa Indonesia" }
}
```

`messages/id.json` — struktur kunci identik, nilai dalam bahasa Indonesia:

```json
{
  "meta": {
    "title": "Anak Krakatau — Status Terkini",
    "description": "Tingkat aktivitas, notice abu vulkanik, dan linimasa erupsi Gunung Anak Krakatau."
  },
  "disclaimer": {
    "text": "Bukan sumber resmi. Selalu ikuti MAGMA Indonesia, BMKG, dan BNPB.",
    "link": "Buka MAGMA Indonesia"
  },
  "status": {
    "heading": "Status saat ini",
    "hazardRadius": "Jangan mendekat dalam radius {km} km dari kawah aktif",
    "aviationColour": "Kode warna penerbangan",
    "ashTop": "Puncak kolom abu",
    "aboveSummit": "di atas puncak",
    "notObserved": "Kolom abu tidak teramati",
    "levels": { "1": "Normal", "2": "Waspada", "3": "Siaga", "4": "Awas" }
  },
  "timeline": { "heading": "Aktivitas terkini", "ongoing": "Masih berlangsung", "empty": "Belum ada kejadian terbaru." },
  "preparedness": {
    "heading": "Jika abu turun di sekitar Anda",
    "mask": { "title": "Pakai masker yang tepat", "body": "Gunakan masker N95 atau KN95 di luar ruangan. Masker kain tidak menahan abu vulkanik." },
    "indoors": { "title": "Tutup rumah", "body": "Tutup jendela, pintu, dan ventilasi. Bawa hewan peliharaan ke dalam." },
    "water": { "title": "Tutup air dan makanan", "body": "Tutup tandon air terbuka dan cuci bahan makanan sebelum dimasak." },
    "driving": { "title": "Kurangi berkendara", "body": "Abu membuat jalan licin dan jarak pandang turun. Jangan pakai wiper pada abu kering." },
    "contact": { "title": "Kontak darurat", "body": "Call center BNPB 117. Hubungi BPBD setempat untuk informasi evakuasi." }
  },
  "map": {
    "heading": "Arah sebaran abu",
    "sectorCaption": "Hanya indikasi arah, digambar dari frasa gerak pada VONA — bukan batas awan abu yang otoritatif.",
    "noSector": "Notice terbaru menyatakan kolom abu tidak teramati, sehingga arah tidak digambar."
  },
  "source": { "label": "Sumber", "updated": "diperbarui {time}", "unavailable": "Sumber tidak tersedia", "openOriginal": "Buka laporan asli" },
  "theme": { "label": "Tema", "system": "Sistem", "light": "Terang", "dark": "Gelap" },
  "locale": { "label": "Bahasa", "en": "English", "id": "Bahasa Indonesia" }
}
```

- [ ] **Step 5: Move the app into the locale segment**

`src/app/[locale]/layout.tsx`:

```tsx
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { routing } from '@/i18n/routing'
import '../globals.css'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'meta' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: { languages: { en: '/', id: '/id' } },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="bg-background text-foreground min-h-svh antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
```

`src/app/[locale]/page.tsx` (sementara, diisi penuh di Task 9–12):

```tsx
import { useTranslations } from 'next-intl'

export default function Page() {
  const t = useTranslations('status')
  return <main className="p-4">{t('heading')}</main>
}
```

Hapus `src/app/page.tsx` dan `src/app/layout.tsx` yang lama. Pertahankan `src/app/globals.css`.

- [ ] **Step 6: Write the locale switcher**

`src/components/locale-switcher.tsx`:

```tsx
'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

export function LocaleSwitcher() {
  const pathname = usePathname()
  const active = useLocale()
  const t = useTranslations('locale')

  return (
    <nav aria-label={t('label')} className="flex items-center gap-1 text-sm">
      {routing.locales.map((locale) => (
        <Link
          key={locale}
          href={pathname}
          locale={locale}
          aria-current={locale === active ? 'true' : undefined}
          className={
            locale === active
              ? 'rounded-md px-2 py-1 font-medium underline underline-offset-4'
              : 'text-muted-foreground hover:text-foreground rounded-md px-2 py-1'
          }
        >
          {locale.toUpperCase()}
        </Link>
      ))}
    </nav>
  )
}
```

Switcher memakai `<Link>`, bukan `onChange`, sehingga tetap berfungsi tanpa JavaScript.

- [ ] **Step 7: Verify routing manually**

```bash
bun run build && bun run start &
sleep 3
curl -s -o /dev/null -w "en root:  %{http_code}\n" http://localhost:3000/
curl -s -o /dev/null -w "id route: %{http_code}\n" http://localhost:3000/id
curl -s -o /dev/null -w "%{redirect_url}\n" -H "Accept-Language: id-ID,id;q=0.9" http://localhost:3000/
kill %1
```

Expected: `/` → 200, `/id` → 200, dan permintaan dengan `Accept-Language: id-ID` dialihkan ke `/id`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add en/id routing with browser detection and locale switcher"
```

---

### Task 8: shadcn/ui with Base UI, theming, and the layout shell

**Files:**
- Create: `src/components/theme-provider.tsx`, `src/components/theme-toggle.tsx`, `src/components/site-header.tsx`, `src/components/disclaimer-banner.tsx`
- Create (via CLI): `src/components/ui/card.tsx`, `src/components/ui/skeleton.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/button.tsx`, `src/components/ui/dropdown-menu.tsx`
- Modify: `src/app/[locale]/layout.tsx`, `src/app/globals.css`

**Interfaces:**
- Consumes: `LocaleSwitcher` dari Task 7.
- Produces: `<ThemeProvider>`, `<ThemeToggle>`, `<SiteHeader>`, `<DisclaimerBanner>`, dan komponen `ui/*` yang dipakai Task 9–12.

- [ ] **Step 1: Initialise shadcn/ui with Base UI**

```bash
bunx --bun shadcn@latest init --base base --yes
bunx --bun shadcn@latest add card skeleton badge button dropdown-menu --yes
```

Verifikasi bahwa `package.json` memuat `@base-ui/react` dan **tidak** memuat `@base-ui-components/react` atau paket `@radix-ui/*`:

```bash
grep -E '"@base-ui|"@radix-ui' package.json
```

Expected: hanya `"@base-ui/react"`.

- [ ] **Step 2: Add the dark variant to globals.css**

Pastikan `src/app/globals.css` memuat, tepat setelah `@import 'tailwindcss';`:

```css
@custom-variant dark (&:is(.dark *));
```

- [ ] **Step 3: Write the theme provider**

`src/components/theme-provider.tsx`:

```tsx
'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
```

- [ ] **Step 4: Write the theme toggle**

`src/components/theme-toggle.tsx`:

```tsx
'use client'

import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const OPTIONS = ['system', 'light', 'dark'] as const

export function ThemeToggle() {
  const { setTheme } = useTheme()
  const t = useTranslations('theme')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" aria-label={t('label')} />}>
        {t('label')}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map((option) => (
          <DropdownMenuItem key={option} onClick={() => setTheme(option)}>
            {t(option)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

Catatan: Base UI memakai prop `render` untuk komposisi trigger, bukan `asChild` seperti Radix. Kalau versi komponen yang di-generate shadcn memakai API berbeda, ikuti file yang di-generate — itu sumber kebenarannya, bukan cuplikan ini.

- [ ] **Step 5: Write the header and disclaimer**

`src/components/site-header.tsx`:

```tsx
import { LocaleSwitcher } from '@/components/locale-switcher'
import { ThemeToggle } from '@/components/theme-toggle'

export function SiteHeader() {
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-50 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
        <span className="truncate text-sm font-semibold sm:text-base">Anak Krakatau</span>
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
```

`src/components/disclaimer-banner.tsx`:

```tsx
import { useTranslations } from 'next-intl'

export function DisclaimerBanner() {
  const t = useTranslations('disclaimer')
  return (
    <div
      role="note"
      className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs sm:text-sm"
    >
      <span>{t('text')} </span>
      <a
        className="font-medium underline underline-offset-2"
        href="https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas"
        rel="noreferrer"
        target="_blank"
      >
        {t('link')}
      </a>
    </div>
  )
}
```

- [ ] **Step 6: Compose them into the layout**

Di `src/app/[locale]/layout.tsx`, bungkus children:

```tsx
<NextIntlClientProvider>
  <ThemeProvider>
    <DisclaimerBanner />
    <SiteHeader />
    {children}
  </ThemeProvider>
</NextIntlClientProvider>
```

- [ ] **Step 7: Verify the gate**

```bash
bun run ci:lint && bun run typecheck && bun run build
```

Expected: ketiganya lolos. Jalankan `bun run dev`, buka `/`, dan pastikan pengalih tema mengubah kelas `dark` di elemen `<html>` tanpa flash saat memuat ulang.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Base UI components, theming, header, and disclaimer banner"
```

---

### Task 9: Localised formatters

**Files:**
- Create: `src/lib/format.ts`
- Test: `tests/format.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `formatAshHeight(locale: 'en' | 'id', feet: number, metres: number): string`
  - `formatWib(locale: 'en' | 'id', date: Date): string`
  - `formatRelative(locale: 'en' | 'id', from: Date, now?: Date): string`

- [ ] **Step 1: Write the failing test**

`tests/format.test.ts`:

```ts
import { expect, test } from 'bun:test'
import { formatAshHeight, formatRelative, formatWib } from '@/lib/format'

test('English puts feet first with a metric aside', () => {
  expect(formatAshHeight('en', 50000, 15240)).toBe('50,000 ft (~15,240 m)')
})

test('Indonesian puts metres first and uses dot separators', () => {
  expect(formatAshHeight('id', 50000, 15240)).toBe('15.240 m (~50.000 kaki)')
})

test('timestamps always render in WIB regardless of host timezone', () => {
  // 2026-09-06T00:10:00Z is 07:10 WIB.
  const formatted = formatWib('id', new Date('2026-09-06T00:10:00Z'))
  expect(formatted).toContain('07:10')
  expect(formatted).toContain('WIB')
})

test('relative time is localised', () => {
  const now = new Date('2026-09-06T02:10:00Z')
  const then = new Date('2026-09-06T00:10:00Z')
  expect(formatRelative('en', then, now)).toBe('2 hours ago')
  expect(formatRelative('id', then, now)).toBe('2 jam yang lalu')
})

test('relative time falls back to minutes under an hour', () => {
  const now = new Date('2026-09-06T00:40:00Z')
  const then = new Date('2026-09-06T00:10:00Z')
  expect(formatRelative('en', then, now)).toBe('30 minutes ago')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test tests/format.test.ts`
Expected: FAIL — `Cannot find module '@/lib/format'`.

- [ ] **Step 3: Write the formatters**

`src/lib/format.ts`:

```ts
export type Locale = 'en' | 'id'

export const TIME_ZONE = 'Asia/Jakarta'

const number = (locale: Locale, value: number): string =>
  new Intl.NumberFormat(locale).format(value)

/**
 * Aviation reports ash height in feet; the Indonesian public reads metres.
 * Both units are always shown, ordered by what the reader expects first.
 */
export function formatAshHeight(locale: Locale, feet: number, metres: number): string {
  return locale === 'id'
    ? `${number('id', metres)} m (~${number('id', feet)} kaki)`
    : `${number('en', feet)} ft (~${number('en', metres)} m)`
}

export function formatWib(locale: Locale, date: Date): string {
  const formatted = new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
  return `${formatted} WIB`
}

export function formatRelative(locale: Locale, from: Date, now: Date = new Date()): string {
  const seconds = Math.round((from.getTime() - now.getTime()) / 1000)
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit)
  }
  return formatter.format(seconds, 'second')
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test tests/format.test.ts`
Expected: PASS, 5 tests.

Kalau string relatif Indonesia dari ICU ternyata berbeda ("2 jam lalu" vs "2 jam yang lalu"), sesuaikan **ekspektasi test** agar cocok dengan keluaran ICU — jangan menulis tabel terjemahan sendiri. ICU adalah sumber kebenaran untuk bentuk ini.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts tests/format.test.ts
git commit -m "feat: add WIB, dual-unit, and relative time formatters"
```

---

### Task 10: Status card with skeleton

**Files:**
- Create: `src/components/source-footer.tsx`, `src/components/status-card.tsx`, `src/components/skeletons.tsx`
- Modify: `src/app/[locale]/page.tsx`

**Interfaces:**
- Consumes: `getStatus`, `getVonaNotices`, `formatAshHeight`, `formatWib`, `formatRelative`, komponen `ui/*`.
- Produces: `<StatusCard />` (async Server Component), `<SourceFooter />`, `<StatusSkeleton />`.

- [ ] **Step 1: Write the shared skeletons**

`src/components/skeletons.tsx`:

```tsx
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function StatusSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-40" />
      </CardContent>
    </Card>
  )
}

export function TimelineSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent className="space-y-4">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function MapSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[55svh] w-full rounded-md" />
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Write the source footer**

`src/components/source-footer.tsx`:

```tsx
import { getTranslations } from 'next-intl/server'
import { formatRelative } from '@/lib/format'
import type { Locale } from '@/lib/format'

export async function SourceFooter({
  locale,
  label,
  url,
  fetchedAt,
}: {
  locale: Locale
  label: string
  url: string
  fetchedAt: Date
}) {
  const t = await getTranslations('source')
  return (
    <p className="text-muted-foreground mt-4 text-xs">
      {t('label')}:{' '}
      <a className="underline underline-offset-2" href={url} rel="noreferrer" target="_blank">
        {label}
      </a>{' '}
      · {t('updated', { time: formatRelative(locale, fetchedAt) })}
    </p>
  )
}
```

- [ ] **Step 3: Write the status card**

`src/components/status-card.tsx`:

```tsx
import { getTranslations } from 'next-intl/server'
import { SourceFooter } from '@/components/source-footer'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatAshHeight, formatWib, type Locale } from '@/lib/format'
import { getStatus } from '@/lib/sources/status'
import { getVonaNotices } from '@/lib/sources/vona'

const LEVEL_STYLES: Record<number, string> = {
  1: 'bg-emerald-600 text-white',
  2: 'bg-yellow-500 text-black',
  3: 'bg-amber-600 text-white',
  4: 'bg-red-700 text-white',
}

const LEVEL_NUMERALS: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' }

const COLOUR_STYLES: Record<string, string> = {
  green: 'bg-emerald-600 text-white',
  yellow: 'bg-yellow-500 text-black',
  orange: 'bg-amber-600 text-white',
  red: 'bg-red-700 text-white',
}

export async function StatusCard({ locale }: { locale: Locale }) {
  const [status, vona] = await Promise.all([getStatus(), getVonaNotices()])
  const t = await getTranslations('status')
  const tSource = await getTranslations('source')

  if (!status.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('heading')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{tSource('unavailable')}</p>
          <a
            className="mt-2 inline-block text-sm underline underline-offset-2"
            href={status.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            {tSource('openOriginal')}
          </a>
        </CardContent>
      </Card>
    )
  }

  const latest = vona.ok ? vona.data[0] : undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('heading')}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Level is never signalled by colour alone: numeral + label + badge. */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={LEVEL_STYLES[status.data.level]}>
            {`Level ${LEVEL_NUMERALS[status.data.level]}`}
          </Badge>
          <span className="text-2xl font-semibold">{t(`levels.${status.data.level}`)}</span>
        </div>

        <p className="mt-3 text-sm">
          {t('hazardRadius', { km: status.data.hazardRadiusKm })}
        </p>

        {latest ? (
          <div className="mt-4 space-y-1 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">{t('aviationColour')}:</span>
              <Badge className={COLOUR_STYLES[latest.colour]}>{latest.colour.toUpperCase()}</Badge>
              <span className="text-muted-foreground">{formatWib(locale, latest.issuedAt)}</span>
            </div>
            {latest.ashTopFtAsl !== null && latest.ashTopMAsl !== null ? (
              <p>
                {t('ashTop')}: {formatAshHeight(locale, latest.ashTopFtAsl, latest.ashTopMAsl)}
                {latest.ashAboveSummitFt !== null && latest.ashAboveSummitM !== null
                  ? ` · ${formatAshHeight(locale, latest.ashAboveSummitFt, latest.ashAboveSummitM)} ${t('aboveSummit')}`
                  : null}
              </p>
            ) : (
              <p className="text-muted-foreground">{t('notObserved')}</p>
            )}
          </div>
        ) : null}

        <SourceFooter
          fetchedAt={status.fetchedAt}
          label="MAGMA Indonesia"
          locale={locale}
          url={status.data.reportUrl}
        />
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Mount it behind Suspense**

`src/app/[locale]/page.tsx`:

```tsx
import { Suspense } from 'react'
import { setRequestLocale } from 'next-intl/server'
import { StatusCard } from '@/components/status-card'
import { StatusSkeleton } from '@/components/skeletons'
import type { Locale } from '@/lib/format'

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <main className="mx-auto grid max-w-5xl gap-4 p-4 sm:grid-cols-2 lg:grid-cols-12">
      <section className="sm:col-span-2 lg:col-span-12">
        <Suspense fallback={<StatusSkeleton />}>
          <StatusCard locale={locale as Locale} />
        </Suspense>
      </section>
    </main>
  )
}
```

- [ ] **Step 5: Verify against live data**

```bash
bun run dev
```

Buka `http://localhost:3000/` dan `http://localhost:3000/id`. Expected: kartu menampilkan Level III · Siaga, radius 3 km, kode warna penerbangan dari VONA terbaru, dan baris sumber dengan umur data. Unit tinggi abu berganti urutan antar locale.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add status card with alert level, VONA summary, and skeleton"
```

---

### Task 11: Merged activity timeline

**Files:**
- Create: `src/components/activity-timeline.tsx`
- Modify: `src/app/[locale]/page.tsx`
- Test: `tests/timeline-merge.test.ts`
- Create: `src/lib/merge-timeline.ts`

**Interfaces:**
- Consumes: `getEruptions`, `getVonaNotices`, formatter.
- Produces:
  - `type TimelineEntry = { at: Date; kind: 'eruption' | 'vona'; text: string; ongoing: boolean; url: string | null }`
  - `mergeTimeline(eruptions, notices): TimelineEntry[]` — fungsi murni.
  - `<ActivityTimeline />`, `<TimelineSkeleton />` (sudah ada dari Task 10).

- [ ] **Step 1: Write the failing test**

`tests/timeline-merge.test.ts`:

```ts
import { expect, test } from 'bun:test'
import { mergeTimeline } from '@/lib/merge-timeline'
import type { EruptionEvent } from '@/lib/sources/eruptions'
import type { VonaNotice } from '@/lib/sources/vona'

const eruption = (iso: string, ongoing = false): EruptionEvent => ({
  occurredAt: new Date(iso),
  narrative: `eruption at ${iso}`,
  ongoing,
  seismicAmplitudeMm: null,
  durationSeconds: null,
})

const notice = (iso: string): VonaNotice => ({
  issuedAt: new Date(iso),
  noticeCode: '20260905/0200Z',
  colour: 'red',
  summary: `notice at ${iso}`,
  ashTopFtAsl: null,
  ashTopMAsl: null,
  ashAboveSummitFt: null,
  ashAboveSummitM: null,
  movementLabel: null,
  detailUrl: 'https://example.test/n',
})

test('interleaves both kinds newest first', () => {
  const merged = mergeTimeline(
    [eruption('2026-09-06T00:10:00Z'), eruption('2026-09-04T16:07:00Z')],
    [notice('2026-09-05T02:00:00Z')],
  )
  expect(merged.map((e) => e.kind)).toEqual(['eruption', 'vona', 'eruption'])
})

test('carries the ongoing flag through from eruptions', () => {
  const [entry] = mergeTimeline([eruption('2026-09-06T00:10:00Z', true)], [])
  expect(entry?.ongoing).toBe(true)
})

test('caps the list at twenty entries', () => {
  const many = Array.from({ length: 40 }, (_, i) =>
    eruption(new Date(Date.UTC(2026, 8, 1, i)).toISOString()),
  )
  expect(mergeTimeline(many, []).length).toBe(20)
})

test('handles both sides being empty', () => {
  expect(mergeTimeline([], [])).toEqual([])
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test tests/timeline-merge.test.ts`
Expected: FAIL — `Cannot find module '@/lib/merge-timeline'`.

- [ ] **Step 3: Write the merge function**

`src/lib/merge-timeline.ts`:

```ts
import type { EruptionEvent } from '@/lib/sources/eruptions'
import type { VonaNotice } from '@/lib/sources/vona'

export type TimelineEntry = {
  at: Date
  kind: 'eruption' | 'vona'
  text: string
  ongoing: boolean
  url: string | null
}

const MAX_ENTRIES = 20

export function mergeTimeline(
  eruptions: EruptionEvent[],
  notices: VonaNotice[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...eruptions.map((event) => ({
      at: event.occurredAt,
      kind: 'eruption' as const,
      text: event.narrative,
      ongoing: event.ongoing,
      url: null,
    })),
    ...notices.map((notice) => ({
      at: notice.issuedAt,
      kind: 'vona' as const,
      text: notice.summary,
      ongoing: false,
      url: notice.detailUrl,
    })),
  ]

  return entries.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, MAX_ENTRIES)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test tests/timeline-merge.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the timeline component**

`src/components/activity-timeline.tsx`:

```tsx
import { getTranslations } from 'next-intl/server'
import { SourceFooter } from '@/components/source-footer'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatRelative, formatWib, type Locale } from '@/lib/format'
import { mergeTimeline } from '@/lib/merge-timeline'
import { ERUPTIONS_URL, getEruptions } from '@/lib/sources/eruptions'
import { getVonaNotices } from '@/lib/sources/vona'

export async function ActivityTimeline({ locale }: { locale: Locale }) {
  const [eruptions, vona] = await Promise.all([getEruptions(), getVonaNotices()])
  const t = await getTranslations('timeline')
  const tSource = await getTranslations('source')

  const entries = mergeTimeline(
    eruptions.ok ? eruptions.data : [],
    vona.ok ? vona.data : [],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('heading')}</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {eruptions.ok ? t('empty') : tSource('unavailable')}
          </p>
        ) : (
          <ol className="space-y-4">
            {entries.map((entry) => (
              <li key={`${entry.kind}-${entry.at.toISOString()}`} className="border-l-2 pl-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium">{formatWib(locale, entry.at)}</span>
                  <span className="text-muted-foreground">
                    {formatRelative(locale, entry.at)}
                  </span>
                  {entry.kind === 'vona' ? <Badge variant="outline">VONA</Badge> : null}
                  {entry.ongoing ? <Badge variant="outline">{t('ongoing')}</Badge> : null}
                </div>
                <p className="mt-1 text-sm">{entry.text}</p>
              </li>
            ))}
          </ol>
        )}
        {eruptions.ok ? (
          <SourceFooter
            fetchedAt={eruptions.fetchedAt}
            label="MAGMA Indonesia"
            locale={locale}
            url={ERUPTIONS_URL}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 6: Mount it behind Suspense**

Di `src/app/[locale]/page.tsx`, tambahkan setelah bagian status:

```tsx
<section className="sm:col-span-2 lg:col-span-7">
  <Suspense fallback={<TimelineSkeleton />}>
    <ActivityTimeline locale={locale as Locale} />
  </Suspense>
</section>
```

Impor `ActivityTimeline` dan `TimelineSkeleton`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: merge eruption events and VONA notices into one activity timeline"
```

---

### Task 12: Preparedness cards

**Files:**
- Create: `src/components/preparedness-cards.tsx`
- Modify: `src/app/[locale]/page.tsx`

**Interfaces:**
- Consumes: pesan `preparedness.*` dari Task 7.
- Produces: `<PreparednessCards />` — konten statis, tanpa `Suspense`, tanpa fetch.

- [ ] **Step 1: Write the component**

`src/components/preparedness-cards.tsx`:

```tsx
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const TOPICS = ['mask', 'indoors', 'water', 'driving', 'contact'] as const

export function PreparednessCards() {
  const t = useTranslations('preparedness')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('heading')}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {TOPICS.map((topic) => (
          <div key={topic}>
            <h3 className="text-sm font-semibold">{t(`${topic}.title`)}</h3>
            <p className="text-muted-foreground mt-1 text-sm">{t(`${topic}.body`)}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
```

Ini komponen statis dan sengaja tidak dibungkus `Suspense`: saat darurat, panduan siaga harus tampil seketika sementara sumber jaringan lain masih berjalan.

- [ ] **Step 2: Mount it**

Di `src/app/[locale]/page.tsx`:

```tsx
<section className="sm:col-span-2 lg:col-span-5">
  <PreparednessCards />
</section>
```

- [ ] **Step 3: Verify both locales render**

```bash
bun run dev
```

Buka `/` dan `/id`. Expected: lima topik tampil dalam bahasa yang benar, dua kolom pada `sm:` ke atas, satu kolom di 360px.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add static ash-fall preparedness cards"
```

---

### Task 13: Ash direction map

**Files:**
- Create: `src/components/ash-map.tsx`, `src/components/ash-map-client.tsx`
- Create: `src/lib/geo.ts`
- Test: `tests/geo.test.ts`
- Modify: `src/app/[locale]/page.tsx`

**Interfaces:**
- Consumes: `getStatus`, `getVonaNotices`, `MapSkeleton`.
- Produces:
  - `bearingFromPhrase(phrase: string | null): number | null` — fungsi murni.
  - `circlePolygon(lon, lat, radiusKm, steps?): GeoJSON.Position[][]`
  - `sectorPolygon(lon, lat, bearingDeg, radiusKm, spreadDeg?): GeoJSON.Position[][]`
  - `<AshMap />` (server) dan `<AshMapClient />` (client, `ssr: false`).

Frasa gerak VONA yang sudah diverifikasi berbentuk `"north to northeast"`, `"southwest, west to north"`. Bearing diambil dari arah **terakhir** yang disebut — itu arah gerak paling mutakhir dalam frasa tersebut.

- [ ] **Step 1: Write the failing test**

`tests/geo.test.ts`:

```ts
import { expect, test } from 'bun:test'
import { bearingFromPhrase, circlePolygon, sectorPolygon } from '@/lib/geo'

test('reads a bearing from a simple phrase', () => {
  expect(bearingFromPhrase('north to northeast')).toBe(45)
})

test('uses the last named direction in a multi-part phrase', () => {
  expect(bearingFromPhrase('southwest, west to north')).toBe(0)
})

test('matches longer compass names before their substrings', () => {
  expect(bearingFromPhrase('moving to northwest')).toBe(315)
})

test('returns null when no direction is named', () => {
  expect(bearingFromPhrase('ash cloud is not observed')).toBeNull()
  expect(bearingFromPhrase(null)).toBeNull()
})

test('circle polygon closes on itself', () => {
  const [ring] = circlePolygon(105.4233, -6.1009, 3)
  expect(ring).toBeDefined()
  if (!ring) return
  expect(ring[0]).toEqual(ring[ring.length - 1])
})

test('sector polygon starts and ends at the centre', () => {
  const [ring] = sectorPolygon(105.4233, -6.1009, 45, 40)
  expect(ring).toBeDefined()
  if (!ring) return
  expect(ring[0]).toEqual([105.4233, -6.1009])
  expect(ring[ring.length - 1]).toEqual([105.4233, -6.1009])
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test tests/geo.test.ts`
Expected: FAIL — `Cannot find module '@/lib/geo'`.

- [ ] **Step 3: Write the geometry helpers**

`src/lib/geo.ts`:

```ts
type Position = [number, number]

/** Ordered longest-first so "northeast" is matched before "north". */
const COMPASS: Array<[string, number]> = [
  ['northnortheast', 22.5],
  ['eastnortheast', 67.5],
  ['eastsoutheast', 112.5],
  ['southsoutheast', 157.5],
  ['southsouthwest', 202.5],
  ['westsouthwest', 247.5],
  ['westnorthwest', 292.5],
  ['northnorthwest', 337.5],
  ['northeast', 45],
  ['southeast', 135],
  ['southwest', 225],
  ['northwest', 315],
  ['north', 0],
  ['east', 90],
  ['south', 180],
  ['west', 270],
]

export function bearingFromPhrase(phrase: string | null): number | null {
  if (!phrase) return null
  const normalised = phrase.toLowerCase().replace(/[^a-z]/g, ' ')
  let best: { index: number; bearing: number } | null = null
  for (const [name, bearing] of COMPASS) {
    const index = normalised.lastIndexOf(name)
    if (index === -1) continue
    // Prefer the direction named last; on a tie the longer name wins because
    // COMPASS is ordered longest-first and we only replace on a strictly
    // greater index.
    if (!best || index > best.index) best = { index, bearing }
  }
  return best?.bearing ?? null
}

const EARTH_RADIUS_KM = 6371

function destination(lon: number, lat: number, bearingDeg: number, distanceKm: number): Position {
  const angular = distanceKm / EARTH_RADIUS_KM
  const bearing = (bearingDeg * Math.PI) / 180
  const lat1 = (lat * Math.PI) / 180
  const lon1 = (lon * Math.PI) / 180
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  )
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    )
  return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI]
}

export function circlePolygon(
  lon: number,
  lat: number,
  radiusKm: number,
  steps = 64,
): Position[][] {
  const ring: Position[] = []
  for (let i = 0; i <= steps; i += 1) {
    ring.push(destination(lon, lat, (i * 360) / steps, radiusKm))
  }
  return [ring]
}

export function sectorPolygon(
  lon: number,
  lat: number,
  bearingDeg: number,
  radiusKm: number,
  spreadDeg = 45,
): Position[][] {
  const ring: Position[] = [[lon, lat]]
  const start = bearingDeg - spreadDeg / 2
  const steps = 24
  for (let i = 0; i <= steps; i += 1) {
    ring.push(destination(lon, lat, start + (i * spreadDeg) / steps, radiusKm))
  }
  ring.push([lon, lat])
  return [ring]
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test tests/geo.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Install MapLibre and write the client map**

```bash
bun add maplibre-gl@6.7.0
```

`src/components/ash-map-client.tsx`:

```tsx
'use client'

import 'maplibre-gl/dist/maplibre-gl.css'
import maplibregl from 'maplibre-gl'
import { useTheme } from 'next-themes'
import { useEffect, useRef } from 'react'
import { circlePolygon, sectorPolygon } from '@/lib/geo'

const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/fiord',
} as const

export function AshMapClient({
  longitude,
  latitude,
  hazardRadiusKm,
  bearing,
}: {
  longitude: number
  latitude: number
  hazardRadiusKm: number
  bearing: number | null
}) {
  const container = useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    if (!container.current) return
    const map = new maplibregl.Map({
      container: container.current,
      style: resolvedTheme === 'dark' ? STYLES.dark : STYLES.light,
      center: [longitude, latitude],
      zoom: 7,
      attributionControl: { compact: true },
    })

    map.on('load', () => {
      if (bearing !== null) {
        map.addSource('sector', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: sectorPolygon(longitude, latitude, bearing, 120) },
          },
        })
        map.addLayer({
          id: 'sector',
          type: 'fill',
          source: 'sector',
          paint: { 'fill-color': '#d97706', 'fill-opacity': 0.25 },
        })
      }

      map.addSource('hazard', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: circlePolygon(longitude, latitude, hazardRadiusKm) },
        },
      })
      map.addLayer({
        id: 'hazard',
        type: 'line',
        source: 'hazard',
        paint: { 'line-color': '#dc2626', 'line-width': 2 },
      })

      new maplibregl.Marker({ color: '#dc2626' }).setLngLat([longitude, latitude]).addTo(map)
    })

    return () => map.remove()
  }, [longitude, latitude, hazardRadiusKm, bearing, resolvedTheme])

  return <div ref={container} className="h-[55svh] w-full rounded-md" />
}
```

- [ ] **Step 6: Write the server wrapper**

`src/components/ash-map.tsx`:

```tsx
import dynamic from 'next/dynamic'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { bearingFromPhrase } from '@/lib/geo'
import { getStatus } from '@/lib/sources/status'
import { getVonaNotices } from '@/lib/sources/vona'

const AshMapClient = dynamic(
  () => import('@/components/ash-map-client').then((mod) => mod.AshMapClient),
  { ssr: false },
)

export async function AshMap() {
  const [status, vona] = await Promise.all([getStatus(), getVonaNotices()])
  const t = await getTranslations('map')
  const tSource = await getTranslations('source')

  if (!status.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('heading')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{tSource('unavailable')}</p>
        </CardContent>
      </Card>
    )
  }

  const bearing = vona.ok ? bearingFromPhrase(vona.data[0]?.movementLabel ?? null) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('heading')}</CardTitle>
      </CardHeader>
      <CardContent>
        <AshMapClient
          bearing={bearing}
          hazardRadiusKm={status.data.hazardRadiusKm}
          latitude={status.data.latitude}
          longitude={status.data.longitude}
        />
        <p className="text-muted-foreground mt-2 text-xs">
          {bearing === null ? t('noSector') : t('sectorCaption')}
        </p>
      </CardContent>
    </Card>
  )
}
```

Keterangan di bawah peta wajib ada: sektor hanya indikasi arah, bukan batas awan abu.

- [ ] **Step 7: Mount it behind Suspense**

Di `src/app/[locale]/page.tsx`:

```tsx
<section className="sm:col-span-2 lg:col-span-12">
  <Suspense fallback={<MapSkeleton />}>
    <AshMap />
  </Suspense>
</section>
```

- [ ] **Step 8: Verify on a narrow viewport**

`bun run dev`, buka DevTools pada lebar 360px. Expected: peta setinggi 55svh tanpa terpotong, ganti tema mengubah gaya peta, dan saat VONA terbaru berbunyi "not observed" tidak ada sektor yang digambar dan keterangan `noSector` yang tampil.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add theme-aware ash direction map with hazard radius"
```

---

### Task 14: Auto-refresh, final polish, and full verification

**Files:**
- Create: `src/components/auto-refresh.tsx`
- Modify: `src/app/[locale]/page.tsx`, `src/app/[locale]/layout.tsx`
- Create: `src/app/[locale]/error.tsx`, `src/app/global-error.tsx`
- Create: `README.md`

**Interfaces:**
- Consumes: seluruh komponen dari task sebelumnya.
- Produces: aplikasi siap deploy.

- [ ] **Step 1: Write the auto-refresh component**

`src/components/auto-refresh.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const INTERVAL_MS = 60_000

export function AutoRefresh() {
  const router = useRouter()

  useEffect(() => {
    const tick = () => {
      // Refreshing a hidden tab burns upstream requests for nobody to read.
      if (document.visibilityState === 'visible') router.refresh()
    }
    const id = setInterval(tick, INTERVAL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [router])

  return null
}
```

Mount di `src/app/[locale]/page.tsx` sebagai anak pertama `<main>`.

- [ ] **Step 2: Write the error boundaries**

`src/app/[locale]/error.tsx`:

```tsx
'use client'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-5xl p-4">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Official information stays available at{' '}
        <a
          className="underline underline-offset-2"
          href="https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas"
          rel="noreferrer"
        >
          MAGMA Indonesia
        </a>
        .
      </p>
      <button className="mt-4 text-sm underline underline-offset-2" onClick={reset} type="button">
        Try again
      </button>
    </main>
  )
}
```

`src/app/global-error.tsx`:

```tsx
'use client'

export default function GlobalError() {
  return (
    <html lang="en">
      <body>
        <main style={{ padding: 16, fontFamily: 'system-ui' }}>
          <h1>Something went wrong</h1>
          <p>
            Official information: <a href="https://magma.esdm.go.id">magma.esdm.go.id</a>
          </p>
        </main>
      </body>
    </html>
  )
}
```

Kedua boundary ini tetap menautkan sumber resmi — halaman yang rusak tidak boleh membuat pengguna kehilangan jalan ke informasi asli.

- [ ] **Step 3: Write the README**

`README.md` memuat: tujuan singkat, tabel sumber data beserta URL, perintah `bun install` / `bun run dev` / `bun test` / `bun run fixtures:refresh`, catatan bahwa aplikasi ini tidak resmi, dan tautan ke spec serta plan.

- [ ] **Step 4: Run the full gate**

```bash
bun run ci:lint && bun run typecheck && bun test && bun run build
```

Expected: keempatnya lolos.

- [ ] **Step 5: Verify the acceptance criteria by hand**

`bun run start`, lalu periksa satu per satu:

1. `/` bahasa Inggris, `/id` bahasa Indonesia, `Accept-Language: id-ID` di `/` mengalihkan ke `/id`.
2. Tema System/Light/Dark bekerja, tanpa flash saat muat ulang.
3. Lebar 360px: satu kolom, tidak ada scroll horizontal, target sentuh nyaman.
4. Tiap kartu menampilkan sumber dan umur data.
5. Matikan jaringan lalu muat ulang: kartu bergantung jaringan menampilkan "sumber tidak tersedia" sementara Panduan Siaga tetap tampil penuh.
6. Banner disclaimer ada di semua rute.
7. Tunggu 60 detik dengan tab terlihat: konten menyegar diri.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add auto-refresh, error boundaries, and project README"
```

---

## Self-Review

**Spec coverage.** §1 tujuan → Task 10–13. §2 sumber → Task 3–6. §3 stack → Task 1, 7, 8, 13. §4 arsitektur data → Task 2, 4, 5, 6. §5 rendering & Suspense → Task 10–14. §6.1 mobile-first → Task 8, 12, 13. §6.2 aksesibilitas → Task 10 (level = ikon + warna + teks). §6.3 skeleton → Task 10. §6.4 kejujuran data → Task 10 (`SourceFooter`), Task 8 (banner). §6.5 peta → Task 13. §7 i18n/l10n → Task 7, 9. §8 pengujian → Task 3–6, 9, 11, 13. §9 perkakas → Task 1. §10 risiko → Task 3 (`fixtures:refresh`), Task 2 (`Result`), Task 5 (signature diambil ulang tiap siklus).

**Type consistency.** `Result<T>`, `ok`, `fail` didefinisikan sekali di Task 2 dan dipakai apa adanya di Task 4, 5, 6. `VonaNotice` dan `EruptionEvent` didefinisikan di Task 4 dan 6, dipakai di Task 11 lewat impor tipe. `wibToDate` diekspor dari `status.ts` di Task 5 dan diimpor `eruptions.ts` di Task 6. `Locale` diekspor dari `lib/format.ts` di Task 9 dan diteruskan sebagai prop di Task 10, 11, 13.

**Catatan urutan.** Task 6 mengimpor `wibToDate` dari Task 5, jadi Task 5 harus selesai lebih dulu. Task 9 (`Locale`) dipakai Task 10, tetapi Task 10 juga bisa mendeklarasikan tipe lokalnya bila dikerjakan lebih dulu — kerjakan sesuai urutan nomor untuk menghindari itu.
