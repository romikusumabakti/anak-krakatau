import { getTranslations } from 'next-intl/server'
import { AshMapLoader } from '@/components/ash-map-loader'
import { SourceFooter } from '@/components/source-footer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatRelative, formatWib, type Locale } from '@/lib/format'
import { bearingFromPhrase } from '@/lib/geo'
import { getStatus } from '@/lib/sources/status'
import { ashCloudNotObserved, getVonaNotices } from '@/lib/sources/vona'
import { VONA_URL } from '@/lib/urls'

export async function AshMap({ locale }: { locale: Locale }) {
  const [status, vona] = await Promise.all([getStatus(), getVonaNotices()])
  const t = await getTranslations('map')
  const tStatus = await getTranslations('status')
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

  // VONA can fail independently of the status report (it's a separate
  // upstream feed). A fetch failure is a different fact from "the latest
  // notice reports no observed ash cloud" -- the former must say the
  // source failed and link out, the latter is map.noSector. Conflating
  // them would silently misreport an outage as "nothing to see here".
  const latest = vona.ok ? vona.data[0] : undefined
  const bearing = bearingFromPhrase(latest?.movementLabel ?? null)
  // Third state. A null bearing has two very different causes: the notice
  // said the ash cloud was not observed, or we could not read a direction
  // out of wording our compass regex doesn't cover ("moving to the sea"
  // parses to a movementLabel with no compass point in it). Only the first
  // is a hazard-negative, and only the notice text can establish it.
  const notObserved = latest ? ashCloudNotObserved(latest) : false

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('heading')}</CardTitle>
      </CardHeader>
      <CardContent>
        <AshMapLoader
          bearing={bearing}
          hazardRadiusKm={status.data.hazardRadiusKm}
          latitude={status.data.latitude}
          longitude={status.data.longitude}
        />

        {/* Both shapes on this map are colour-only encodings of claims of
            completely different weight: one is an official evacuation
            instruction, the other is a direction inferred from a five-word
            phrase. Each is named in text, and only when it is actually
            drawn -- a legend entry for a shape that isn't there would be
            its own small lie. */}
        {bearing !== null || status.data.hazardRadiusKm !== null ? (
          <>
            <p className="mt-2 font-medium text-xs">{t('legendHeading')}</p>
            <ul className="mt-1 space-y-0.5 text-muted-foreground text-xs">
              {bearing !== null ? <li>{t('legendSector')}</li> : null}
              {status.data.hazardRadiusKm !== null ? <li>{t('legendHazard')}</li> : null}
            </ul>
          </>
        ) : null}

        {latest ? (
          <>
            <p className="mt-2 text-muted-foreground text-xs">
              {bearing !== null
                ? t('sectorCaption')
                : notObserved
                  ? t('noSector')
                  : t('directionUnreadable')}
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
        {status.data.hazardRadiusKm === null ? (
          <p className="mt-1 text-muted-foreground text-xs">{tStatus('hazardRadiusUnknown')}</p>
        ) : null}

        {/* Every other card names its source and its data age; this one
            draws two geometries and, until now, named neither. Both feeds
            that shape the map get a footer, as in activity-timeline. */}
        <SourceFooter
          fetchedAt={status.fetchedAt}
          label="MAGMA Indonesia"
          locale={locale}
          url={status.data.reportUrl}
        />
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
      </CardContent>
    </Card>
  )
}
