import { describe, expect, it } from 'vitest'
import { classifyAuthError } from './authErrors'

describe('classifyAuthError', () => {
  it.each([
    [{ code: 'invalid_credentials', status: 400 }, 'invalidCredentials'],
    [{ code: 'over_request_rate_limit', status: 429 }, 'rateLimited'],
    [{ status: 429 }, 'rateLimited'],
    [{ code: 'weak_password', status: 422 }, 'weakPassword'],
    [{ code: 'same_password', status: 422 }, 'samePassword'],
    [{ name: 'AuthRetryableFetchError', status: 0 }, 'network'],
    [{ status: 0 }, 'network'],
    [{ code: 'qualquer_coisa', status: 500 }, 'unknown'],
    [{}, 'unknown'],
  ] as const)('%j -> %s', (error, expected) => {
    expect(classifyAuthError(error)).toBe(expected)
  })

  it('credenciais inválidas não distinguem email inexistente de password errada', () => {
    expect(classifyAuthError({ code: 'invalid_credentials' })).toBe(classifyAuthError({ code: 'invalid_credentials', status: 400 }))
  })
})
