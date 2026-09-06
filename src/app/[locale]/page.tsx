import { useTranslations } from 'next-intl'

export default function Page() {
  const t = useTranslations('status')
  return <main className="p-4">{t('heading')}</main>
}
