import { useTranslation } from 'react-i18next'
import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../api/authContext'

export function RequireAuth() {
  const { t } = useTranslation()
  const auth = useAuth()

  if (auth.status === 'loading') return <p role="status">{t('app.loading')}</p>
  if (auth.status === 'signedOut') return <Navigate to="/entrar" replace />
  return <Outlet />
}
