import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth/api/authContext'
import { useMembership } from '@/features/auth/api/useMembership'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { Button } from '@/ui/Button'

export function Home() {
  const { t } = useTranslation()
  const auth = useAuth()
  const userId = auth.status === 'signedIn' ? auth.session.user.id : ''
  const membership = useMembership(userId)
  useDocumentTitle(t('app.name'))

  if (membership.isPending) return <p role="status">{t('app.loading')}</p>

  if (membership.isError) {
    return (
      <>
        <p role="alert">{t('home.loadError')}</p>
        <Button className="mt-4" onClick={() => void membership.refetch()}>
          {t('home.retry')}
        </Button>
      </>
    )
  }

  const data = membership.data

  if (data === null) {
    return (
      <>
        <h1 className="text-2xl font-semibold">{t('home.noAccess.title')}</h1>
        <p className="mt-2">{t('home.noAccess.body')}</p>
      </>
    )
  }

  if (data.status === 'inactive') {
    return (
      <>
        <h1 className="text-2xl font-semibold">{t('home.inactive.title')}</h1>
        <p className="mt-2">{t('home.inactive.body')}</p>
      </>
    )
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">{t('home.greeting', { name: data.displayName })}</h1>
      <p className="mt-2">{t('app.tagline')}</p>
    </>
  )
}
