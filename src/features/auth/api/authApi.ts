import { queryClient } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'
import { classifyAuthError } from '../domain/authErrors'
import type { AuthOutcome } from '../domain/authErrors'
import type { LoginValues } from '../schemas'

export async function signInWithPassword({ email, password }: LoginValues): Promise<AuthOutcome> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return error ? { ok: false, reason: classifyAuthError(error) } : { ok: true }
}

export async function setPassword(password: string): Promise<AuthOutcome> {
  const { error } = await supabase.auth.updateUser({ password })
  return error ? { ok: false, reason: classifyAuthError(error) } : { ok: true }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
  queryClient.clear()
}
