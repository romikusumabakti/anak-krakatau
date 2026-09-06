import { getTranslations } from 'next-intl/server'
import { SourceFooter } from '@/components/source-footer'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatRelative, formatWib, type Locale } from '@/lib/format'
import { mergeTimeline, timelineKey } from '@/lib/merge-timeline'
import { getEruptions } from '@/lib/sources/eruptions'
import { getVonaNotices } from '@/lib/sources/vona'
import { ERUPTIONS_URL, VONA_URL } from '@/lib/urls'

export async function ActivityTimeline({ locale }: { locale: Locale }) {
  const [eruptions, vona] = await Promise.all([getEruptions(), getVonaNotices()])
  const t = await getTranslations('timeline')
  const tSource = await getTranslations('source')

  const entries = mergeTimeline(eruptions.ok ? eruptions.data : [], vona.ok ? vona.data : [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('heading')}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* `entries` is empty only when BOTH feeds failed: getEruptions and
            getVonaNotices each return `fail('parse', ...)` rather than an
            empty success, so `eruptions.ok` here always implies at least
            one entry. The old `eruptions.ok ? t('empty') : ...` arm was
            unreachable, and it encoded a belief that a successful fetch can
            mean "no recent events" -- which, if an adapter were ever
            "fixed" to return empty successes, would print "No recent
            events." in the middle of an eruption. The per-source footers
            below carry the failure detail and the links out. */}
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">{tSource('unavailable')}</p>
        ) : (
          <ol className="space-y-4">
            {entries.map((entry) => (
              <li key={timelineKey(entry)} className="border-l-2 pl-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium">{formatWib(locale, entry.at)}</span>
                  <span className="text-muted-foreground">{formatRelative(locale, entry.at)}</span>
                  {/* Eruption narratives are Indonesian prose from MAGMA; VONA
                      summaries are English aviation text from PVMBG. Neither is
                      translated (that would attribute invented wording to a
                      government source), so a badge naming the issuing feed on
                      every row is the only honest way to tell a reader which
                      authority is speaking before they read the sentence. */}
                  <Badge variant="outline">{entry.kind === 'vona' ? 'VONA' : 'MAGMA'}</Badge>
                  {entry.ongoing ? <Badge variant="outline">{t('ongoing')}</Badge> : null}
                </div>
                <p className="mt-1 text-sm">{entry.text}</p>
                {entry.url ? (
                  <a
                    className="mt-1 inline-block text-xs underline underline-offset-2"
                    href={entry.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {tSource('openOriginal')}
                  </a>
                ) : null}
              </li>
            ))}
          </ol>
        )}

        {/* Two independent upstream sources feed this one card, and each can
            fail or go stale on its own -- so each gets its own source line and
            age, per the "every card shows its source and its data age; a
            failed source must say so and link out" rule. Reusing SourceFooter
            for the success case keeps this consistent with every other card;
            the failure branches are written out here since SourceFooter only
            models the "we have data" state. */}
        {eruptions.ok ? (
          <SourceFooter
            fetchedAt={eruptions.fetchedAt}
            label="MAGMA Indonesia"
            locale={locale}
            url={ERUPTIONS_URL}
          />
        ) : (
          <p className="text-muted-foreground mt-4 text-xs">
            {tSource('label')}: MAGMA Indonesia — {tSource('unavailable')} ·{' '}
            <a
              className="underline underline-offset-2"
              href={eruptions.sourceUrl}
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
          <p className="text-muted-foreground mt-1 text-xs">
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
