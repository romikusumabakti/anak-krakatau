import { getTranslations } from 'next-intl/server'
import { AshMapLoader } from '@/components/ash-map-loader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { bearingFromPhrase } from '@/lib/geo'
import { getStatus } from '@/lib/sources/status'
import { getVonaNotices } from '@/lib/sources/vona'

export async function AshMap() {
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
  const bearing = vona.ok ? bearingFromPhrase(vona.data[0]?.movementLabel ?? null) : null

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

        {vona.ok ? (
          <p className="mt-2 text-muted-foreground text-xs">
            {bearing === null ? t('noSector') : t('sectorCaption')}
          </p>
        ) : (
          <p className="mt-2 text-muted-foreground text-xs">
            {tSource('unavailable')} ·{' '}
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

        {/* hazardRadiusKm is never defaulted (see VolcanoStatus.hazardRadiusKm)
            -- when MAGMA's report doesn't state one, no exclusion circle is
            drawn, and that omission is stated here rather than left as an
            unmarked blank. Reuses status.hazardRadiusUnknown: the two message
            catalogues are structurally identical across locales and this key
            already says exactly this fact. */}
        {status.data.hazardRadiusKm === null ? (
          <p className="mt-1 text-muted-foreground text-xs">{tStatus('hazardRadiusUnknown')}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
