import type { HttpResult } from './confirm.ts'

export interface DeleteDeps {
  findImage(id: string): Promise<{ id: string; storagePath: string } | null>
  deleteRow(id: string): Promise<boolean>
  removeObject(path: string): Promise<void>
}

// Apaga a linha (liberta o slot) e depois o ficheiro. Se o ficheiro falhar, a linha já não existe:
// o objeto fica órfão e o job de reconciliação apaga-o. Nunca fica uma linha a apontar para um ficheiro inexistente.
export async function deleteImage(deps: DeleteDeps, imageId: string): Promise<HttpResult> {
  const image = await deps.findImage(imageId)
  if (!image) return { status: 404, body: { error: 'image_not_found' } }

  if (!(await deps.deleteRow(image.id))) return { status: 404, body: { error: 'image_not_found' } }

  try {
    await deps.removeObject(image.storagePath)
    return { status: 200, body: { deleted: true, file: 'removed' } }
  } catch {
    return { status: 200, body: { deleted: true, file: 'deferred' } }
  }
}
