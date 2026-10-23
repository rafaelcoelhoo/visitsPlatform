import { describe, expect, it } from 'vitest'
import { INTEREST_LEVELS, LIMITS, RATING_CRITERIA } from './limits'

describe('LIMITS', () => {
  it('tem 6 critérios de classificação únicos', () => {
    expect(RATING_CRITERIA).toHaveLength(6)
    expect(new Set(RATING_CRITERIA).size).toBe(6)
  })

  it('tem os 3 níveis de interesse', () => {
    expect([...INTEREST_LEVELS]).toEqual(['hot', 'warm', 'excluded'])
  })

  it('mantém os intervalos coerentes', () => {
    expect(LIMITS.tour.minProperties).toBeLessThanOrEqual(LIMITS.tour.maxProperties)
    expect(LIMITS.comparison.minProperties).toBeLessThanOrEqual(LIMITS.comparison.maxProperties)
    expect(LIMITS.ratings.min).toBeLessThan(LIMITS.ratings.max)
  })

  it('limita as fotos a 8 por imóvel, como o check do slot na base de dados', () => {
    expect(LIMITS.photos.maxPerProperty).toBe(8)
  })

  it('comprime para WebP', () => {
    expect(LIMITS.photos.outputMimeType).toBe('image/webp')
  })
})
