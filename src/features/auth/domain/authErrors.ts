export type AuthFailure =
  | 'invalidCredentials'
  | 'rateLimited'
  | 'network'
  | 'weakPassword'
  | 'samePassword'
  | 'unknown'

export type AuthOutcome = { ok: true } | { ok: false; reason: AuthFailure }

interface AuthErrorLike {
  name?: string | undefined
  status?: number | undefined
  code?: string | undefined
}

export function classifyAuthError(error: AuthErrorLike): AuthFailure {
  if (error.code === 'invalid_credentials') return 'invalidCredentials'
  if (error.code === 'over_request_rate_limit' || error.status === 429) return 'rateLimited'
  if (error.code === 'weak_password') return 'weakPassword'
  if (error.code === 'same_password') return 'samePassword'
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) return 'network'
  return 'unknown'
}
