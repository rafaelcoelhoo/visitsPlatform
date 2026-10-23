import { describe, expect, it } from 'vitest'
import { LIMITS } from '@/config/limits'
import { loginSchema, setPasswordSchema } from './schemas'

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? []

describe('loginSchema', () => {
  it('aceita email e password e corta espaços no email', () => {
    const result = loginSchema.safeParse({ email: '  ana@example.com ', password: 'x' })
    expect(result.success && result.data.email).toBe('ana@example.com')
  })

  it('exige email e password', () => {
    expect(messages(loginSchema.safeParse({ email: '', password: '' }))).toEqual([
      'auth.errors.emailRequired',
      'auth.errors.passwordRequired',
    ])
  })

  it('rejeita email inválido', () => {
    expect(messages(loginSchema.safeParse({ email: 'sem-arroba', password: 'x' }))).toEqual(['auth.errors.emailInvalid'])
  })

  it('não impõe regras de composição à password de login', () => {
    expect(loginSchema.safeParse({ email: 'a@example.com', password: 'a' }).success).toBe(true)
  })
})

describe('setPasswordSchema', () => {
  const min = LIMITS.auth.passwordMinLength

  it(`exige pelo menos ${min} caracteres`, () => {
    const short = 'a'.repeat(min - 1)
    expect(messages(setPasswordSchema.safeParse({ password: short, confirm: short }))).toEqual(['auth.errors.passwordTooShort'])
  })

  it(`aceita exatamente ${min} caracteres`, () => {
    const ok = 'a'.repeat(min)
    expect(setPasswordSchema.safeParse({ password: ok, confirm: ok }).success).toBe(true)
  })

  it('aceita uma frase com espaços (gestores de passwords e passphrases)', () => {
    const phrase = 'casa verde perto do mar'
    expect(setPasswordSchema.safeParse({ password: phrase, confirm: phrase }).success).toBe(true)
  })

  it('exige que a confirmação coincida', () => {
    const password = 'a'.repeat(min)
    expect(messages(setPasswordSchema.safeParse({ password, confirm: `${password}x` }))).toEqual(['auth.errors.passwordMismatch'])
  })
})
