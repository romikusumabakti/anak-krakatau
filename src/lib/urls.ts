/**
 * Stable, public, unsigned MAGMA page URLs.
 *
 * These live apart from the adapter modules for two reasons. First, the
 * client-side error boundary (`app/[locale]/error.tsx`) and the disclaimer
 * banner both need the activity URL as an escape hatch, and importing it
 * from `lib/sources/status` would drag `node-html-parser` -- a server-only
 * scraping dependency -- into a client bundle. Second, these are the URLs
 * we hand to a *reader* when something fails, so they must never be the
 * signed report URLs: a MAGMA `?signature=` link returns 403 once the
 * signature expires, which would reproduce the failure for the person
 * trying to escape it.
 */
export const ACTIVITY_URL = 'https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas'
export const VONA_URL = 'https://magma.esdm.go.id/v1/vona?code=KRA'
export const ERUPTIONS_URL = 'https://magma.esdm.go.id/v1/gunung-api/informasi-letusan/KRA'
