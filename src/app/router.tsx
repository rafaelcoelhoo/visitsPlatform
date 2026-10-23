import { createBrowserRouter } from 'react-router'
import { LoginPage } from '@/features/auth/routes/LoginPage'
import { RequireAuth } from '@/features/auth/routes/RequireAuth'
import { SetPasswordPage } from '@/features/auth/routes/SetPasswordPage'
import { Home } from './Home'
import { Layout } from './Layout'
import { NotFound } from './NotFound'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/entrar', element: <LoginPage /> },
      { path: '/definir-password', element: <SetPasswordPage /> },
      { element: <RequireAuth />, children: [{ path: '/', element: <Home /> }] },
      { path: '*', element: <NotFound /> },
    ],
  },
])
