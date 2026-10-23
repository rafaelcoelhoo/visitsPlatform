import { describe, expect, it } from 'vitest'
import { parseEnv } from './parseEnv'

const valid = {
  VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_exemplo',
}

describe('parseEnv', () => {
  it('aceita uma configuração válida', () => {
    expect(parseEnv(valid)).toEqual(valid)
  })

  it('ignora variáveis desconhecidas do Vite', () => {
    expect(parseEnv({ ...valid, MODE: 'test', DEV: true })).toEqual(valid)
  })

  it('rejeita URL em falta e diz qual o campo, sem expor valores', () => {
    expect(() => parseEnv({ VITE_SUPABASE_PUBLISHABLE_KEY: 'segredo-123' })).toThrow(/VITE_SUPABASE_URL/)
    expect(() => parseEnv({ VITE_SUPABASE_PUBLISHABLE_KEY: 'segredo-123' })).not.toThrow(/segredo-123/)
  })

  it('rejeita URL inválido', () => {
    expect(() => parseEnv({ ...valid, VITE_SUPABASE_URL: 'não é um url' })).toThrow(/VITE_SUPABASE_URL/)
  })

  it('rejeita chave vazia', () => {
    expect(() => parseEnv({ ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: '' })).toThrow(/VITE_SUPABASE_PUBLISHABLE_KEY/)
  })

  it.each(['VITE_SUPABASE_SERVICE_ROLE_KEY', 'VITE_SERVICE_ROLE', 'VITE_supabase-service-role'])(
    'rejeita %s no frontend',
    (key) => {
      expect(() => parseEnv({ ...valid, [key]: 'x' })).toThrow(/service_role/)
    },
  )
})
