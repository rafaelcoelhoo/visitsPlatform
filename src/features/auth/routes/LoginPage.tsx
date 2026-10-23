import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { signInWithPassword } from '../api/authApi'
import { useAuth } from '../api/authContext'
import { LoginForm } from '../components/LoginForm'

export function LoginPage() {
  const { t } = useTranslation()
  const auth = useAuth()
  useDocumentTitle(t('auth.login.title'))

  if (auth.status === 'signedIn') return <Navigate to="/" replace />

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-2xl font-semibold">{t('auth.login.title')}</h1>
      <LoginForm onSubmit={signInWithPassword} />
    </div>
  )
}
