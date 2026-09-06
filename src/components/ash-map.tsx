import { Wind } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { AshMapLoader } from '@/components/ash-map-loader'
import { SourceFooter } from '@/components/source-footer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatRelative, formatWib, type Locale } from '@/lib/format'
import { getAshSigmets, SIGMET_URL } from '@/lib/sources/sigmet'
import { ANAK_KRAKATAU_SUMMIT, getStatus } from '@/lib/sources/status'
import { ashCloudNotObserved, getVonaNotices } from '@/lib/sources/vona'
import { ACTIVITY_URL, VONA_URL } from '@/lib/urls'

export async function AshMap({ locale }: { locale: Locale }) {
  const [status, vona, sigmets] = await Promise.all([
    getStatus(),
    getVonaNotices(),
    getAshSigmets(),
  ])
  const t = await getTranslations('map')
  const tStatus = await getTranslations('status')
  const tSource = await getTranslations('source')

  // MAGMA failing must not take the ash polygons with it. They come from a
  // completely different authority, they are the thing this card exists to
  // show, and MAGMA is the flakiest source here -- bailing out entirely meant
  // the areas vanished exactly as often as the volcano's own site hiccuped.
  // The volcano's position is a fixed fact, so the map still has a centre;
  // only the exclusion ring, which depends on a live instruction, is dropped.
  const centre = status.ok
    ? { latitude: status.data.latitude, longitude: status.data.longitude }
    : ANAK_KRAKATAU_SUMMIT
  const hazardRadiusKm = status.ok ? status.data.hazardRadiusKm : null

  // VONA can fail independently of the status report (it's a separate
  // upstream feed). A fetch failure is a different fact from "the latest
  // notice reports no observed ash cloud" -- the former must say the
  // source failed and link out, the latter is map.noSector. Conflating
  // them would silently misreport an outage as "nothing to see here".
  const latest = vona.ok ? vona.data[0] : undefined
  const ashAreas = sigmets.ok ? sigmets.data : []
  // Third state. A null bearing has two very different causes: the notice
  // said the ash cloud was not observed, or we could not read a direction
  // out of wording our compass regex doesn't cover ("moving to the sea"
  // parses to a movementLabel with no compass point in it). Only the first
  // is a hazard-negative, and only the notice text can establish it.
  const notObserved = latest ? ashCloudNotObserved(latest) : false

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wind aria-hidden="true" className="size-5 shrink-0" />
          {t('heading')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <AshMapLoader
          ashAreas={ashAreas.map((s) => s.polygon)}
          hazardRadiusKm={hazardRadiusKm}
          latitude={centre.latitude}
          longitude={centre.longitude}
        />

        {/* Both shapes on this map are colour-only encodings of claims of
            completely different weight: one is an official evacuation
            instruction, the other is a direction inferred from a five-word
            phrase. Each is named in text, and only when it is actually
            drawn -- a legend entry for a shape that isn't there would be
            its own small lie. */}
        {ashAreas.length > 0 || hazardRadiusKm !== null ? (
          <>
            <p className="mt-2 font-medium text-xs">{t('legendHeading')}</p>
            <ul className="mt-1 space-y-0.5 text-muted-foreground text-xs">
              {ashAreas.length > 0 ? <li>{t('legendSigmet')}</li> : null}
              {hazardRadiusKm !== null ? <li>{t('legendHazard')}</li> : null}
            </ul>
          </>
        ) : null}

        {/* The SIGMET block, not the VONA one, is what now answers "where is
            the ash". Each area names its issuing FIR, its altitude band and
            when it stops being in force -- a polygon whose authority has
            expired is exactly as misleading as a stale timestamp. */}
        <p className="mt-3 font-medium text-xs">{t('sigmetHeading')}</p>
        {ashAreas.length > 0 ? (
          <>
            <ul className="mt-1 space-y-0.5 text-muted-foreground text-xs">
              {ashAreas.map((area) => (
                <li key={`${area.firName}-${area.validTo.toISOString()}`}>
                  {t('sigmetDetail', {
                    fir: area.firName,
                    base: area.baseFt === 0 ? t('surface') : `${area.baseFt} ft`,
                    top: `${area.topFt} ft`,
                    until: formatWib(locale, area.validTo),
                  })}
                  {area.movement ? ` · ${t('sigmetMoving', { movement: area.movement })}` : ''}
                  {area.intensifying ? ` · ${t('sigmetIntensifying')}` : ''}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-muted-foreground text-xs">{t('sigmetGroundCaveat')}</p>
          </>
        ) : (
          <p className="mt-1 text-muted-foreground text-xs">
            {sigmets.ok ? t('sigmetNone') : tSource('unavailable')}
          </p>
        )}

        {latest ? (
          <>
            <p className="mt-2 text-muted-foreground text-xs">
              {notObserved ? t('noSector') : t('directionUnreadable')}
            </p>
            {/* The wedge is 120 km wide over populated Banten and Lampung
                and is inferred from ONE notice. Without that notice's own
                age and link, a wedge drawn from a three-day-old phrase
                looks identical to one from twenty minutes ago. */}
            <p className="mt-1 text-muted-foreground text-xs">
              {tSource('issued', { time: formatWib(locale, latest.issuedAt) })} ·{' '}
              {formatRelative(locale, latest.issuedAt)} ·{' '}
              <a
                className="underline underline-offset-2"
                href={latest.detailUrl ?? VONA_URL}
                rel="noreferrer"
                target="_blank"
              >
                {tSource('openNotice')}
              </a>
            </p>
          </>
        ) : (
          <p className="mt-2 text-muted-foreground text-xs">
            {tSource('unavailable')} ·{' '}
            <a
              className="underline underline-offset-2"
              href={vona.ok ? VONA_URL : vona.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              {tSource('openOriginal')}
            </a>
          </p>
        )}

        {/* hazardRadiusKm is never defaulted (see VolcanoStatus.hazardRadiusKm)
            -- when MAGMA's report doesn't state one, no exclusion circle is
            drawn, and that omission is stated here rather than left as an
            unmarked blank. Reuses status.hazardRadiusUnknown: the two message
            catalogues are structurally identical across locales and this key
            already says exactly this fact. */}
        {hazardRadiusKm === null ? (
          <p className="mt-1 text-muted-foreground text-xs">{tStatus('hazardRadiusUnknown')}</p>
        ) : null}

        {/* Every other card names its source and its data age; this one
            draws two geometries and, until now, named neither. Both feeds
            that shape the map get a footer, as in activity-timeline. */}
        {status.ok ? (
          <SourceFooter
            fetchedAt={status.fetchedAt}
            label="MAGMA Indonesia"
            locale={locale}
            url={ACTIVITY_URL}
          />
        ) : (
          <p className="mt-4 text-muted-foreground text-xs">
            {tSource('label')}: MAGMA Indonesia — {tSource('unavailable')} ·{' '}
            <a
              className="underline underline-offset-2"
              href={ACTIVITY_URL}
              rel="noreferrer"
              target="_blank"
            >
              {tSource('openOriginal')}
            </a>
          </p>
        )}
        {vona.ok ? (
          <SourceFooter
            fetchedAt={vona.fetchedAt}
            label="PVMBG VONA"
            locale={locale}
            url={VONA_URL}
          />
        ) : (
          <p className="mt-1 text-muted-foreground text-xs">
            {tSource('label')}: PVMBG VONA — {tSource('unavailable')} ·{' '}
            <a
              className="underline underline-offset-2"
              href={vona.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              {tSource('openOriginal')}
            </a>
          </p>
        )}
        {sigmets.ok && ashAreas.length > 0 ? (
          <SourceFooter
            fetchedAt={sigmets.fetchedAt}
            label="Aviation SIGMET"
            locale={locale}
            url={SIGMET_URL}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}
