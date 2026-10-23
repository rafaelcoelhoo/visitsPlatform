import type { Session } from '@supabase/supabase-js'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AuthContext } from '../api/authContext'
import type { AuthState } from '../api/authContext'
import { RequireAuth } from './RequireAuth'

function renderAt(state: AuthState) {
  const router = createMemoryRouter(
    [
      { path: '/entrar', element: <p>página de entrada</p> },
      { element: <RequireAuth />, children: [{ path: '/', element: <p>área privada</p> }] },
    ],
    { initialEntries: ['/'] },
  )
  render(
    <AuthContext.Provider value={state}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  )
}

describe('RequireAuth', () => {
  it('enquanto a sessão carrega, não mostra conteúdo privado nem redireciona', () => {
    renderAt({ status: 'loading' })
    expect(screen.getByRole('status')).toHaveTextContent('A carregar…')
    expect(screen.queryByText('área privada')).not.toBeInTheDocument()
    expect(screen.queryByText('página de entrada')).not.toBeInTheDocument()
  })

  it('sem sessão, redireciona para a entrada sem mostrar conteúdo privado', () => {
    renderAt({ status: 'signedOut' })
    expect(screen.getByText('página de entrada')).toBeInTheDocument()
    expect(screen.queryByText('área privada')).not.toBeInTheDocument()
  })

  it('com sessão, mostra a área privada', () => {
    renderAt({ status: 'signedIn', session: { user: { id: 'u1' } } as unknown as Session })
    expect(screen.getByText('área privada')).toBeInTheDocument()
  })
})
