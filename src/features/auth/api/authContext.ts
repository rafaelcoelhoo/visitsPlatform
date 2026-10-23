import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AuthState = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; session: Session }

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const state = useContext(AuthContext)
  if (!state) throw new Error('useAuth fora do AuthProvider')
  return state
}
