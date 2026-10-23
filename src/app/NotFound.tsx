import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

export function NotFound() {
  const { t } = useTranslation()
  return (
    <>
      <h1 className="text-2xl font-semibold">{t('notFound.title')}</h1>
      <p className="mt-2">{t('notFound.body')}</p>
      <Link
        to="/"
        className="mt-4 inline-flex min-h-11 items-center rounded bg-brand-700 px-4 text-white"
      >
        {t('notFound.home')}
      </Link>
    </>
  )
}
