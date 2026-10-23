import { describe, expect, it } from 'vitest'
import { LIMITS } from '../../../src/config/limits.ts'
import { corsHeaders, isUuid } from './http.ts'
import { PHOTO_LIMITS } from './limits.ts'
import { safeEqual } from './secret.ts'

describe('limites das Edge Functions', () => {
  it('espelham src/config/limits.ts (o bundler das funções não pode importar de src/)', () => {
    expect(PHOTO_LIMITS.maxPerProperty).toBe(LIMITS.photos.maxPerProperty)
    expect(PHOTO_LIMITS.maxLongSidePx).toBe(LIMITS.photos.maxLongSidePx)
  })
})

describe('safeEqual', () => {
  it('iguais e diferentes', async () => {
    expect(await safeEqual('segredo', 'segredo')).toBe(true)
    expect(await safeEqual('segredo', 'segredo ')).toBe(false)
    expect(await safeEqual('segredo', '')).toBe(false)
    expect(await safeEqual('', '')).toBe(true)
  })
})

describe('isUuid', () => {
  it('aceita UUIDs e rejeita o resto', () => {
    expect(isUuid('11111111-1111-4111-8111-111111111111')).toBe(true)
    expect(isUuid('1; drop table x')).toBe(false)
    expect(isUuid(42)).toBe(false)
    expect(isUuid(null)).toBe(false)
  })
})

describe('corsHeaders', () => {
  const allowed = ['https://visitbook.netlify.app']

  it('permite apenas origens configuradas', () => {
    expect(corsHeaders('https://visitbook.netlify.app', allowed)['Access-Control-Allow-Origin']).toBe('https://visitbook.netlify.app')
    expect(corsHeaders('https://evil.example', allowed)['Access-Control-Allow-Origin']).toBeUndefined()
    expect(corsHeaders(null, allowed)['Access-Control-Allow-Origin']).toBeUndefined()
  })

  it('nunca devolve *', () => {
    expect(Object.values(corsHeaders('https://visitbook.netlify.app', allowed))).not.toContain('*')
  })

  it('sem origens configuradas não permite nenhuma', () => {
    expect(corsHeaders('https://visitbook.netlify.app', [])['Access-Control-Allow-Origin']).toBeUndefined()
  })
})
