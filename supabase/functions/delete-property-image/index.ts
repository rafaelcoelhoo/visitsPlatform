import { allowedOrigins, authenticate, guarded, serviceClient } from '../_deno/clients.ts'
import { deleteImage } from '../_shared/deleteImage.ts'
import { corsHeaders, isUuid, jsonResponse, logEvent } from '../_shared/http.ts'
import { PHOTO_LIMITS } from '../_shared/limits.ts'

const FN = 'delete-property-image'

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

      const result = await deleteImage(
        {
          // Permissão: com o JWT do utilizador, o RLS só devolve fotos da(s) sua(s) organização(ões) ativa(s).
          findImage: async (id) => {
            const { data, error } = await auth.client.from('property_images').select('id, storage_path').eq('id', id).maybeSingle()
            if (error) throw error
            return data ? { id: data.id, storagePath: data.storage_path } : null
          },
          deleteRow: async (id) => {
            const { data, error } = await service.from('property_images').delete().eq('id', id).select('id')
            if (error) throw error
            return (data?.length ?? 0) > 0
          },
          removeObject: async (path) => {
            const { error } = await service.storage.from(PHOTO_LIMITS.bucket).remove([path])
            if (error) throw error
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
