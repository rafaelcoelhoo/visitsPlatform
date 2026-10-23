import { describe, expect, it, vi } from 'vitest'
import { deleteImage } from './deleteImage.ts'
import type { DeleteDeps } from './deleteImage.ts'

const image = { id: 'img-1', storagePath: 'org/prop/img-1.webp' }

function deps(overrides: Partial<DeleteDeps> = {}): DeleteDeps {
  return {
    findImage: vi.fn().mockResolvedValue(image),
    deleteRow: vi.fn().mockResolvedValue(true),
    removeObject: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('deleteImage', () => {
  it('apaga a linha e o ficheiro', async () => {
    const d = deps()
    expect(await deleteImage(d, 'img-1')).toEqual({ status: 200, body: { deleted: true, file: 'removed' } })
    expect(d.removeObject).toHaveBeenCalledWith(image.storagePath)
  })

  it('imagem inexistente ou de outra organização: 404 e não apaga nada', async () => {
    const d = deps({ findImage: vi.fn().mockResolvedValue(null) })
    expect((await deleteImage(d, 'x')).status).toBe(404)
    expect(d.deleteRow).not.toHaveBeenCalled()
    expect(d.removeObject).not.toHaveBeenCalled()
  })

  it('a linha é apagada antes do ficheiro (nunca uma linha a apontar para um ficheiro inexistente)', async () => {
    const order: string[] = []
    const d = deps({
      deleteRow: vi.fn().mockImplementation(() => {
        order.push('row')
        return Promise.resolve(true)
      }),
      removeObject: vi.fn().mockImplementation(() => {
        order.push('file')
        return Promise.resolve()
      }),
    })
    await deleteImage(d, 'img-1')
    expect(order).toEqual(['row', 'file'])
  })

  it('se o Storage falhar, a linha já foi apagada e o ficheiro fica para a reconciliação', async () => {
    const d = deps({ removeObject: vi.fn().mockRejectedValue(new Error('storage em baixo')) })
    expect(await deleteImage(d, 'img-1')).toEqual({ status: 200, body: { deleted: true, file: 'deferred' } })
  })

  it('se a linha já não existe (corrida), 404 e não toca no ficheiro', async () => {
    const d = deps({ deleteRow: vi.fn().mockResolvedValue(false) })
    expect((await deleteImage(d, 'img-1')).status).toBe(404)
    expect(d.removeObject).not.toHaveBeenCalled()
  })
})
