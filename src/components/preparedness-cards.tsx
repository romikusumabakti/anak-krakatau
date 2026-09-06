import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const TOPICS = ['mask', 'indoors', 'water', 'driving', 'contact'] as const

export function PreparednessCards() {
  const t = useTranslations('preparedness')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('heading')}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {TOPICS.map((topic) => (
          <div key={topic}>
            <h3 className="text-sm font-semibold">{t(`${topic}.title`)}</h3>
            <p className="text-muted-foreground mt-1 text-sm">{t(`${topic}.body`)}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
