# Anak Krakatau — Live Status Dashboard

A public status page for the ongoing Anak Krakatau (Krakatoa) eruption: current
alert level, ash advisories, recent activity, and preparedness guidance for
people near the volcano.

**This app is unofficial.** It is not produced by, endorsed by, or affiliated
with PVMBG, MAGMA Indonesia, BMKG, or BNPB. It republishes public data those
agencies already publish, reformatted for readability, and links back to the
originals on every card. For evacuation orders and authoritative guidance,
always follow MAGMA Indonesia, BMKG, and BNPB directly — this dashboard says
so on every page.

## Data sources

All data is scraped server-side from MAGMA Indonesia (PVMBG), the Indonesian
government's official volcano-monitoring platform. Nothing is fetched
client-side, and nothing is stored beyond the request lifetime.

| Source | URL | Used for |
| --- | --- | --- |
| MAGMA activity level list | `https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas` | Finds the current signed report for Anak Krakatau |
| MAGMA signed activity report | linked from the row above, under `/v1/gunung-api/laporan/...` | Alert level (I–IV), hazard radius, summit coordinates, observation time |
| MAGMA VONA notices | `https://magma.esdm.go.id/v1/vona?code=KRA` | Aviation colour code, ash cloud height, ash movement direction |
| MAGMA eruption timeline | `https://magma.esdm.go.id/v1/gunung-api/informasi-letusan/KRA` | Recent eruption events shown in the activity timeline |

Two adapters were built and deliberately removed during development:

- **Darwin VAAC** (the ash-advisory source in the original design spec) —
  probing it showed the advisory endpoints require authentication or return
  "does not currently exist" for a live target. MAGMA VONA replaced it; see
  the plan for the investigation.
- **GVP weekly reports** and **BMKG** — cut as unused once MAGMA alone covered
  every card. `tests/fixtures/gvp-weekly.xml` stays committed on purpose, as
  a record of that decision, even though nothing reads it anymore.

### Why fixtures are committed

`tests/fixtures/*.html` are real, saved copies of MAGMA's pages. Tests parse
these fixtures instead of the network, so the suite is fast and doesn't hit
government servers on every run — servers that, during this eruption, have
been intermittently returning `502`.

Run `bun run fixtures:refresh` occasionally to re-download them. A `git diff`
afterwards is the early-warning signal that a source changed its HTML
structure: if the parsers still pass against updated fixtures, nothing is
wrong; if a fixture's shape moved and a test now fails, that's the adapter
that needs attention before it silently breaks in production.

## Getting started

```bash
bun install
bun run dev
```

Then open `http://localhost:3000` (English) or `http://localhost:3000/id`
(Indonesian).

## Commands

| Command | Purpose |
| --- | --- |
| `bun install` | Install dependencies |
| `bun run dev` | Start the dev server (Turbopack) |
| `bun run build` | Production build |
| `bun run start` | Run the production build |
| `bun test` | Run the test suite (parses committed fixtures, no network) |
| `bun run check` | Format + lint, writing fixes |
| `bun run ci:lint` | Lint in CI mode (no writes) |
| `bun run typecheck` | Generate route types, then `tsc --noEmit` |
| `bun run fixtures:refresh` | Re-download the HTML fixtures tests parse against |

If `typecheck` fails citing files that no longer exist, delete the stale
build cache first: `rm -rf .next`.

## Stack

Next.js (App Router) on Bun, TypeScript in strict mode with
`noUncheckedIndexedAccess`, next-intl for English/Indonesian localisation,
Tailwind CSS, and MapLibre GL for the ash-direction map. The display timezone
is locked to `Asia/Jakarta` regardless of visitor location, since a hazard
report timed to the wrong zone is worse than no time at all.

## Design documents

- [Design spec](docs/superpowers/specs/2026-09-06-anak-krakatau-dashboard-design.md)
- [Implementation plan](docs/superpowers/plans/2026-09-06-anak-krakatau-dashboard.md)

## Deploying

The app needs no environment variables and no API keys: every source is a
public MAGMA page, and the tile provider requires no token.

Vercel Functions are pinned to `sin1` (Singapore) in `vercel.json`. This is
not a preference. The server fetches MAGMA in Indonesia, and MAGMA is slow
under eruption load — measured at 4.5–8.8s per request from inside Indonesia
during the September 2026 eruption, against a 20s timeout. Vercel's default
region is `iad1` (Washington DC), which would add a trans-Pacific round trip
to every one of those requests and push the slow tail past the timeout, so
the alert level and ash direction cards would go dark while MAGMA was merely
slow. Singapore is the closest region to the Sunda Strait.

Hobby plans may select any single region, so this works without a paid plan.

### Two things the Vercel build logs revealed

**Direct dependencies are pinned exactly, on purpose.** Vercel's build image
runs Bun 1.3.14, which cannot read the `lockfileVersion: 2` that Bun 1.4
writes. It logs `Unknown lockfile version`, warns `Ignoring lockfile`, and
resolves every dependency fresh. `packageManager: "bun@1.4.0"` does not
change this. With the lockfile ignored, a caret range would let an untested
minor release reach production on its own — so every direct dependency is
pinned to an exact version. Transitive packages can still drift; this only
removes the largest and most likely source. Once Vercel's image ships Bun
1.4 the lockfile will be honoured again and the pins simply stop mattering.

**Builds run in `iad1`, not `sin1`.** The `regions` setting places Vercel
Functions, not the build. So the build-time prerender fetches MAGMA from
Washington DC, where the trans-Pacific round trip on top of MAGMA's own
latency often exceeds the 20s timeout — a freshly deployed page can ship
showing "Source unavailable". This is not a failure state to fix: the first
ISR revalidation runs in `sin1` and the page heals itself within a minute.
Observed on the first production deploy and confirmed to recover.

### Ash areas come from SIGMETs, not from VONA

The map draws the ash-affected area from volcanic-ash SIGMETs
(`aviationweather.gov/api/data/isigmet`, a public NOAA/NWS feed, no key).
Each carries the area as coordinates issued by the responsible meteorological
watch office — for the Sunda Strait that is BMKG's Jakarta office, so this is
an Indonesian authority rather than a foreign estimate.

This replaced a wedge the map used to infer from VONA's prose movement phrase.
Two things made the change worth making. A SIGMET states the area rather than
implying it, so the shape earns a hard edge. And VONA notices go quiet for days
while SIGMETs keep being issued: relying on VONA alone let the page state that
no ash cloud was observed while an active BMKG SIGMET said the opposite, which
is the worst thing this dashboard can do.

Two properties the UI must keep. A SIGMET describes **airspace**, not ashfall
on the ground, and says so on the card. And SIGMETs expire after a few hours;
expired ones are dropped rather than dimmed, because a polygon with no issuing
authority behind it is the same lie as a stale timestamp.
