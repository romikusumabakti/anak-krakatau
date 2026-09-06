import { getTranslations } from 'next-intl/server'
import { SourceFooter } from '@/components/source-footer'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatAshHeight, formatWib, type Locale } from '@/lib/format'
import { getStatus } from '@/lib/sources/status'
import { getVonaNotices } from '@/lib/sources/vona'
import { COLOUR_STYLES, LEVEL_NUMERALS, LEVEL_STYLES } from '@/lib/status-presentation'

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
          {status.data.hazardRadiusKm !== null
            ? t('hazardRadius', { km: status.data.hazardRadiusKm })
            : t('hazardRadiusUnknown')}
        </p>

        {latest ? (
          <div className="mt-4 space-y-1 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">{t('aviationColour')}:</span>
              <Badge className={COLOUR_STYLES[latest.colour]}>
                {latest.colour === 'unknown'
                  ? t('aviationColourUnknown')
                  : latest.colour.toUpperCase()}
              </Badge>
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
        ) : (
          <div className="mt-4 space-y-1 text-sm">
            <p className="text-muted-foreground">{tSource('unavailable')}</p>
            <a
              className="inline-block underline underline-offset-2"
              href={vona.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              {tSource('openOriginal')}
            </a>
          </div>
        )}

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
