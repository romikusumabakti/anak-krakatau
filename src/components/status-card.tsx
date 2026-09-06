import { getTranslations } from 'next-intl/server'
import { SourceFooter } from '@/components/source-footer'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  formatAshHeight,
  formatRelative,
  formatWib,
  formatWibRange,
  type Locale,
} from '@/lib/format'
import { getStatus } from '@/lib/sources/status'
import { ashCloudNotObserved, getVonaNotices } from '@/lib/sources/vona'
import { COLOUR_STYLES, LEVEL_NUMERALS, LEVEL_STYLES } from '@/lib/status-presentation'
import { ACTIVITY_URL, VONA_URL } from '@/lib/urls'

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
          {/* status.sourceUrl is the stable, unsigned activity page -- never
              the signed report URL that just failed. See lib/urls.ts. */}
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
  // A hazard-negative is only ever stated because the notice states it.
  // A null ash height means HEIGHT_RE didn't match, which is a fact about
  // our regex, not about the sky.
  const notObserved = latest ? ashCloudNotObserved(latest) : false

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
          <span className="font-semibold text-2xl">{t(`levels.${status.data.level}`)}</span>
        </div>

        <p className="mt-3 text-sm">
          {status.data.hazardRadiusKm !== null
            ? t('hazardRadius', { km: status.data.hazardRadiusKm })
            : t('hazardRadiusUnknown')}
        </p>

        {/* The alert level's real age. MAGMA reports a six-hour observation
            window, not an instant, so it is shown as a window; when the
            report doesn't state one that omission is stated rather than
            filled in with the current time. */}
        <p className="mt-1 text-muted-foreground text-sm">
          {status.data.observationPeriod !== null ? (
            <>
              {t('observationPeriod', {
                range: formatWibRange(
                  locale,
                  status.data.observationPeriod.start,
                  status.data.observationPeriod.end,
                ),
              })}
              {' · '}
              {formatRelative(locale, status.data.observationPeriod.end)}
            </>
          ) : (
            t('observationPeriodUnknown')
          )}
        </p>

        <SourceFooter
          fetchedAt={status.fetchedAt}
          label="MAGMA Indonesia"
          locale={locale}
          url={ACTIVITY_URL}
        />

        {/* The aviation colour and ash figures come from a different feed on
            a different publication clock than the report above, and can be
            days older. They get their own age and their own source line
            rather than sheltering under MAGMA's footer. */}
        <div className="mt-4 border-t pt-3">
          {latest ? (
            <div className="space-y-1 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">{t('aviationColour')}:</span>
                <Badge className={COLOUR_STYLES[latest.colour]}>
                  {latest.colour === 'unknown'
                    ? t('aviationColourUnknown')
                    : latest.colour.toUpperCase()}
                </Badge>
                <span className="text-muted-foreground">
                  {tSource('issued', { time: formatWib(locale, latest.issuedAt) })} ·{' '}
                  {formatRelative(locale, latest.issuedAt)}
                </span>
              </div>
              {latest.ashTopFtAsl !== null && latest.ashTopMAsl !== null ? (
                <p>
                  {t('ashTop')}: {formatAshHeight(locale, latest.ashTopFtAsl, latest.ashTopMAsl)}
                  {latest.ashAboveSummitFt !== null && latest.ashAboveSummitM !== null
                    ? ` · ${formatAshHeight(locale, latest.ashAboveSummitFt, latest.ashAboveSummitM)} ${t('aboveSummit')}`
                    : null}
                </p>
              ) : notObserved ? (
                <p className="text-muted-foreground">{t('notObserved')}</p>
              ) : (
                <p className="text-muted-foreground">
                  {t('ashHeightUnreadable')}{' '}
                  <a
                    className="underline underline-offset-2"
                    href={latest.detailUrl ?? VONA_URL}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {tSource('openNotice')}
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
              ) : null}
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">{tSource('unavailable')}</p>
              <a
                className="inline-block underline underline-offset-2"
                href={vona.ok ? VONA_URL : vona.sourceUrl}
                rel="noreferrer"
                target="_blank"
              >
                {tSource('openOriginal')}
              </a>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
