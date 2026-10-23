import { allowedOrigins, authenticate, guarded, serviceClient } from '../_deno/clients.ts'
import { confirmImage } from '../_shared/confirm.ts'
import { corsHeaders, isUuid, jsonResponse, logEvent } from '../_shared/http.ts'
import { PHOTO_LIMITS } from '../_shared/limits.ts'

const FN = 'confirm-property-image'

Deno.serve((req) => {
  const cors = corsHeaders(req.headers.get('Origin'), allowedOrigins())
  if (req.method === 'OPTIONS') return Promise.resolve(new Response(null, { status: 204, headers: cors }))
  if (req.method !== 'POST') return Promise.resolve(jsonResponse(405, { error: 'method_not_allowed' }, cors))

  return guarded(
    FN,
    async () => {
      const auth = await authenticate(req)
      if (!auth) return jsonResponse(401, { error: 'unauthorized' }, cors)

      const body = (await req.json().catch(() => null)) as { image_id?: unknown } | null
      if (!isUuid(body?.image_id)) return jsonResponse(400, { error: 'invalid_request' }, cors)

      const service = serviceClient()
      const bucket = service.storage.from(PHOTO_LIMITS.bucket)

      const result = await confirmImage(
        {
          findImage: async (id) => {
            const { data, error } = await auth.client.from('property_images').select('id, storage_path, status').eq('id', id).maybeSingle()
            if (error) throw error
            return data ? { id: data.id, storagePath: data.storage_path, status: data.status } : null
          },
          download: async (path) => {
            const { data, error } = await bucket.download(path)
            return error || !data ? null : new Uint8Array(await data.arrayBuffer())
          },
          removeObject: async (path) => {
            await bucket.remove([path])
          },
          markReady: async (id) => {
            const { data, error } = await service.from('property_images').update({ status: 'ready' }).eq('id', id).eq('status', 'pending').select('id')
            if (error) throw error
            return (data?.length ?? 0) > 0
          },
        },
        body.image_id,
      )

      logEvent(FN, { status: result.status, imageId: body.image_id })
      return jsonResponse(result.status, result.body, cors)
    },
    cors,
  )
})
