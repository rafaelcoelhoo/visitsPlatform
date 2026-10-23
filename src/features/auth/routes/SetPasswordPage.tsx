import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { setPassword } from '../api/authApi'
import { useAuth } from '../api/authContext'
import { SetPasswordForm } from '../components/SetPasswordForm'

export function SetPasswordPage() {
  const { t } = useTranslation()
  const auth = useAuth()
  const navigate = useNavigate()
  useDocumentTitle(t('auth.setPassword.title'))

  if (auth.status === 'loading') return <p role="status">{t('app.loading')}</p>

  if (auth.status === 'signedOut') {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="mb-2 text-2xl font-semibold">{t('auth.setPassword.title')}</h1>
        <p>{t('auth.setPassword.invalidLink')}</p>
        <Link to="/entrar" className="mt-4 inline-flex min-h-11 items-center underline">
          {t('auth.setPassword.toLogin')}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-2 text-2xl font-semibold">{t('auth.setPassword.title')}</h1>
      <p className="mb-4">{t('auth.setPassword.intro')}</p>
      <SetPasswordForm
        onSubmit={async (password) => {
          const outcome = await setPassword(password)
          if (outcome.ok) await navigate('/', { replace: true })
          return outcome
        }}
      />
    </div>
  )
}
