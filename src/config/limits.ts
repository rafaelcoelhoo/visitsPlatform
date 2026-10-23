export const RATING_CRITERIA = [
  'location',
  'condition',
  'naturalLight',
  'noise',
  'space',
  'valueForMoney',
] as const

export type RatingCriterion = (typeof RATING_CRITERIA)[number]

export const INTEREST_LEVELS = ['hot', 'warm', 'excluded'] as const

export type InterestLevel = (typeof INTEREST_LEVELS)[number]

export const LIMITS = {
  photos: {
    maxPerProperty: 8,
    maxLongSidePx: 1600,
    quality: 0.8,
    targetSizeKb: 500,
    outputMimeType: 'image/webp',
    signedUrlTtlSeconds: 600,
  },
  auth: { passwordMinLength: 12, otpLength: 6 },
  tour: { minProperties: 2, maxProperties: 5 },
  comparison: { minProperties: 2, maxProperties: 4 },
  ratings: { min: 1, max: 5 },
  drafts: { debounceMs: 500, keyPrefix: 'rascunho-visita-' },
} as const
