import { describe, expect, it } from 'vitest'
import { FIXTURES } from './fixtures.ts'
import { readWebp, validateWebp } from './webp.ts'

const LIMITS = { maxBytes: 1048576, maxLongSidePx: 1600 }

const REAL_WEBP = FIXTURES.lossless1x1

function riff(chunk: string, payload: number[]): Uint8Array {
  const body = [...'WEBP'].map((c) => c.charCodeAt(0)).concat([...chunk].map((c) => c.charCodeAt(0)), [payload.length, 0, 0, 0], payload)
  const size = body.length
  return Uint8Array.from([...'RIFF'].map((c) => c.charCodeAt(0)).concat([size & 0xff, (size >> 8) & 0xff, 0, 0], body))
}

const le24 = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff]

const vp8x = (w: number, h: number): Uint8Array => riff('VP8X', [0, 0, 0, 0, ...le24(w - 1), ...le24(h - 1), 0, 0, 0, 0, 0, 0])

const vp8 = (w: number, h: number): Uint8Array =>
  riff('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, w & 0xff, (w >> 8) & 0x3f, h & 0xff, (h >> 8) & 0x3f, 0, 0, 0, 0])

describe('readWebp', () => {
  it('lê WebPs reais gerados pelo libwebp (VP8L e VP8)', () => {
    expect(readWebp(FIXTURES.lossless1x1)).toEqual({ width: 1, height: 1 })
    expect(readWebp(FIXTURES.lossy1x1)).toEqual({ width: 1, height: 1 })
    expect(readWebp(FIXTURES.lossy1600x900)).toEqual({ width: 1600, height: 900 })
    expect(readWebp(FIXTURES.lossy1601x100)).toEqual({ width: 1601, height: 100 })
  })

  it('lê as dimensões de VP8X e de VP8', () => {
    expect(readWebp(vp8x(1600, 900))).toEqual({ width: 1600, height: 900 })
    expect(readWebp(vp8(800, 600))).toEqual({ width: 800, height: 600 })
  })

  it.each([
    ['JPEG (FF D8 FF)', Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...new Array<number>(40).fill(0)])],
    ['PNG', Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array<number>(40).fill(0)])],
    ['HEIC (ftypheic)', Uint8Array.from([0, 0, 0, 0x18, ...'ftypheic'].map((c) => (typeof c === 'string' ? c.charCodeAt(0) : c)).concat(new Array<number>(40).fill(0)))],
    ['texto', new TextEncoder().encode('isto não é uma imagem, mas tem mais de trinta bytes de comprimento')],
    ['vazio', new Uint8Array()],
    ['demasiado curto', Uint8Array.from([0x52, 0x49, 0x46, 0x46])],
  ])('rejeita %s', (_name, bytes) => {
    expect(readWebp(bytes)).toBeNull()
  })

  it('rejeita RIFF/WAVE (mesmo contentor, outro formato)', () => {
    const wave = riff('fmt ', new Array<number>(20).fill(0))
    wave.set([...'WAVE'].map((c) => c.charCodeAt(0)), 8)
    expect(readWebp(wave)).toBeNull()
  })

  it('rejeita um WebP com dados anexados no fim (polyglot)', () => {
    const withTail = new Uint8Array([...REAL_WEBP, ...new TextEncoder().encode('<script>alert(1)</script>')])
    expect(readWebp(withTail)).toBeNull()
  })

  it('rejeita um WebP truncado', () => {
    expect(readWebp(REAL_WEBP.slice(0, REAL_WEBP.length - 4))).toBeNull()
  })

  it('rejeita assinatura VP8 sem start code', () => {
    const broken = vp8(100, 100)
    broken[23] = 0
    expect(readWebp(broken)).toBeNull()
  })
})

describe('validateWebp', () => {
  it('aceita um WebP válido dentro dos limites', () => {
    expect(validateWebp(REAL_WEBP, LIMITS)).toBeNull()
    expect(validateWebp(FIXTURES.lossy1x1, LIMITS)).toBeNull()
    expect(validateWebp(vp8x(1600, 1200), LIMITS)).toBeNull()
  })

  it('rejeita acima do tamanho máximo, mesmo que seja WebP', () => {
    expect(validateWebp(REAL_WEBP, { ...LIMITS, maxBytes: 10 })).toBe('file_too_large')
  })

  it('rejeita o que não é WebP', () => {
    expect(validateWebp(new TextEncoder().encode('x'.repeat(100)), LIMITS)).toBe('not_webp')
  })

  it('o limite é exato: 1600 px passa, 1601 px não (ficheiros reais)', () => {
    expect(validateWebp(FIXTURES.lossy1600x900, LIMITS)).toBeNull()
    expect(validateWebp(FIXTURES.lossy1601x100, LIMITS)).toBe('dimensions_too_large')
  })

  it('rejeita dimensões acima do limite (lado maior), seja largura ou altura', () => {
    expect(validateWebp(vp8x(1601, 100), LIMITS)).toBe('dimensions_too_large')
    expect(validateWebp(vp8x(100, 5000), LIMITS)).toBe('dimensions_too_large')
  })
})
