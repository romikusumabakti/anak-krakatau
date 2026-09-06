export {}

const UA = 'anak-krakatau-dashboard/1.0 (public volcano status dashboard; contact via repository)'

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
  // Every international SIGMET, not just the volcanic-ash ones, so the
  // parser's own filtering is exercised against real noise.
  { name: 'isigmet.json', url: 'https://aviationweather.gov/api/data/isigmet?format=json' },
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
// Anak Krakatau's row must be located by name first: the page lists every Indonesian
// volcano at Level II and above, and the first signed URL on the page is not
// necessarily Anak Krakatau's.
const activity = await Bun.file('tests/fixtures/tingkat-aktivitas.html').text()
const rowMatch = activity.match(
  /<td[^>]*>\s*Anak Krakatau[\s\S]*?(https:\/\/magma\.esdm\.go\.id\/v1\/gunung-api\/laporan\/\d+\?signature=[a-f0-9]+)/,
)
const reportUrl = rowMatch?.[1]
if (!reportUrl)
  throw new Error('no signed report URL found for Anak Krakatau in tingkat-aktivitas.html')
const report = await get(reportUrl)
await Bun.write('tests/fixtures/laporan.html', report)
console.log(`laporan.html: ${report.length} bytes`)
