/**
 * Copies MapLibre's tile-parsing worker into `public/` so it can be served
 * from our own origin.
 *
 * MapLibre locates its worker with:
 *
 *   let e = import.meta.url
 *   if (!/^https?:/.test(e)) return ``
 *   return new URL(`./maplibre-gl-worker.mjs`, e).href
 *
 * Inside a bundled chunk `import.meta.url` is not an http(s) URL, so that
 * returns an empty string, `new Worker("")` resolves against the document
 * base, and the worker is handed the page's own HTML. It dies instantly and
 * silently -- no console error, no failed request. The style, the TileJSON
 * and the sprites all load, so the map looks like it is working right up
 * until no tile ever renders.
 *
 * Copying at build time rather than committing the file keeps it in lockstep
 * with whatever maplibre-gl version actually got installed, which matters
 * more than usual here because Vercel's build ignores our lockfile.
 */
// Both files, side by side: the worker does `import "./maplibre-gl-shared.mjs"`,
// so copying it alone leaves that import 404ing and the worker dies on load --
// which looks identical to the bug this script exists to fix.
const FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']

for (const name of FILES) {
  const source = Bun.file(`node_modules/maplibre-gl/dist/${name}`)
  if (!(await source.exists())) {
    throw new Error(`${name} is missing. maplibre-gl must be installed before this runs.`)
  }
  const destination = `public/${name}`
  await Bun.write(destination, source)
  console.log(`${destination}: ${Bun.file(destination).size} bytes`)
}

// Top-level await needs this file to be a module (TS1375).
export {}
