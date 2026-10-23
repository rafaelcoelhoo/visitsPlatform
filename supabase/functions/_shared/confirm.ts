import { PHOTO_LIMITS } from './limits.ts'
import { validateWebp } from './webp.ts'

export interface ImageRow {
  id: string
  storagePath: string
  status: 'pending' | 'ready'
}

export interface ConfirmDeps {
  findImage(id: string): Promise<ImageRow | null>
  download(path: string): Promise<Uint8Array | null>
  removeObject(path: string): Promise<void>
  markReady(id: string): Promise<boolean>
}

export interface HttpResult {
  status: number
  body: Record<string, unknown>
}

// Confirma uma foto: valida o ficheiro real (magic bytes, tamanho, dimensões) antes de a marcar ready.
// `findImage` corre com o JWT do utilizador (RLS): uma foto de outra organização "não existe" (404).
export async function confirmImage(deps: ConfirmDeps, imageId: string): Promise<HttpResult> {
  const image = await deps.findImage(imageId)
  if (!image) return { status: 404, body: { error: 'image_not_found' } }
  if (image.status === 'ready') return { status: 200, body: { status: 'ready' } }

  const bytes = await deps.download(image.storagePath)
  if (!bytes) return { status: 409, body: { error: 'upload_not_found' } }

  const rejection = validateWebp(bytes, PHOTO_LIMITS)
  if (rejection) {
    // O ficheiro inválido é apagado; a reserva fica pending para o cliente voltar a carregar.
    await deps.removeObject(image.storagePath)
    return { status: 422, body: { error: rejection } }
  }

  const updated = await deps.markReady(image.id)
  return updated ? { status: 200, body: { status: 'ready' } } : { status: 409, body: { error: 'not_pending' } }
}
