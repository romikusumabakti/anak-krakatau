import { Car, Droplets, House, Phone, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const TOPICS = [
  { key: 'mask', Icon: ShieldCheck },
  { key: 'indoors', Icon: House },
  { key: 'water', Icon: Droplets },
  { key: 'driving', Icon: Car },
  { key: 'contact', Icon: Phone },
] as const

export function PreparednessCards() {
  const t = useTranslations('preparedness')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert aria-hidden="true" className="size-5 shrink-0" />
          {t('heading')}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {TOPICS.map(({ key, Icon }) => (
          <div key={key}>
            {/* Icon reinforces the instruction; it never carries it. Every
                topic keeps its own title and body text. */}
            <h3 className="flex items-center gap-2 font-semibold text-sm">
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              {t(`${key}.title`)}
            </h3>
            <p className="mt-1 text-muted-foreground text-sm">{t(`${key}.body`)}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
