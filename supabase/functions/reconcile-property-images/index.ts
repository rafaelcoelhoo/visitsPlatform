import { guarded, requireEnv, serviceClient } from '../_deno/clients.ts'
import { jsonResponse, logEvent } from '../_shared/http.ts'
import { PHOTO_LIMITS } from '../_shared/limits.ts'
import { reconcile } from '../_shared/reconcile.ts'
import { safeEqual } from '../_shared/secret.ts'

const FN = 'reconcile-property-images'
const DEFAULT_OLDER_THAN_SECONDS = 3600
const MAX_OLDER_THAN_SECONDS = 7 * 24 * 3600

// Chamada pelo pg_cron (via pg_net) com um segredo dedicado, não pela service_role nem por utilizadores.
Deno.serve((req) => {
  if (req.method !== 'POST') return Promise.resolve(jsonResponse(405, { error: 'method_not_allowed' }))

  return guarded(FN, async () => {
    const expected = requireEnv('RECONCILE_SECRET')
    if (expected.length < 16) throw new Error('RECONCILE_SECRET demasiado curto')
    if (!(await safeEqual(req.headers.get('x-reconcile-secret') ?? '', expected))) {
      logEvent(FN, { status: 401 })
      return jsonResponse(401, { error: 'unauthorized' })
    }

    const body = (await req.json().catch(() => ({}))) as { older_than_seconds?: unknown } | null
    const requested = body?.older_than_seconds ?? DEFAULT_OLDER_THAN_SECONDS
    if (!Number.isInteger(requested) || (requested as number) < 0 || (requested as number) > MAX_OLDER_THAN_SECONDS) {
      return jsonResponse(400, { error: 'invalid_request' })
    }

    const service = serviceClient()
    const bucket = service.storage.from(PHOTO_LIMITS.bucket)

    const report = await reconcile(
      {
        expirePending: async (seconds) => {
          const { data, error } = await service.rpc('admin_expire_pending_images', { p_older_than: `${seconds} seconds` })
          if (error) throw error
          return ((data ?? []) as { storage_path: string }[]).map((row) => row.storage_path)
        },
        listOrphans: async (seconds) => {
          const { data, error } = await service.rpc('admin_orphan_property_objects', { p_older_than: `${seconds} seconds` })
          if (error) throw error
          return ((data ?? []) as { name: string }[]).map((row) => row.name)
        },
        removeObjects: async (paths) => {
          const { error } = await bucket.remove(paths)
          if (error) throw error
        },
      },
      requested as number,
    )

    logEvent(FN, { status: 200, ...report })
    return jsonResponse(200, report)
  })
})
