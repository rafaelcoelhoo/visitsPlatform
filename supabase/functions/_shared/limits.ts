// Espelho de src/config/limits.ts para as Edge Functions: o bundler das funções só inclui supabase/functions,
// por isso não pode importar de src/. O teste limits.test.ts garante que não divergem.
export const PHOTO_LIMITS = {
  bucket: 'property-images',
  maxBytes: 1048576,
  maxLongSidePx: 1600,
  maxPerProperty: 8,
} as const
