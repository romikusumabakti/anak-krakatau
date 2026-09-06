import { Waves } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BMKG_URL } from '@/lib/urls'

/**
 * Coastal tsunami guidance.
 *
 * Anak Krakatau's deadliest event was not ashfall: on 22 December 2018 part
 * of its flank collapsed into the sea and the resulting tsunami killed 437
 * people along the Banten and Lampung coasts -- the exact coastlines most of
 * this dashboard's readers live on. Every other card here answers "ash is
 * falling on me"; none answered "I am on the coast and the volcano just did
 * something big".
 *
 * Deliberately static, and deliberately NOT a warning feed. This app does not
 * monitor tsunami risk and must never look as though it does -- BMKG issues
 * tsunami warnings for Indonesia. The card carries context and standing
 * guidance, and points at the authority.
 */
const POINTS = ['history', 'noWarning', 'action'] as const

export async function CoastalCard() {
  const t = await getTranslations('coastal')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Waves aria-hidden="true" className="size-5 shrink-0" />
          {t('heading')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {POINTS.map((point) => (
          <p key={point} className="text-sm">
            {t(point)}
          </p>
        ))}
        <p className="text-muted-foreground text-sm">
          {t('authority')}{' '}
          <a
            className="underline underline-offset-2"
            href={BMKG_URL}
            rel="noreferrer"
            target="_blank"
          >
            {t('authorityLink')}
          </a>
        </p>
      </CardContent>
    </Card>
  )
}
