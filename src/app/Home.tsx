import { useTranslation } from 'react-i18next'

export function Home() {
  const { t } = useTranslation()
  return (
    <>
      <h1 className="text-2xl font-semibold">{t('app.name')}</h1>
      <p className="mt-2">{t('app.tagline')}</p>
    </>
  )
}
