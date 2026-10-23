import { describe, expect, it, vi } from 'vitest'
import { confirmImage } from './confirm.ts'
import { FIXTURES } from './fixtures.ts'
import type { ConfirmDeps, ImageRow } from './confirm.ts'

const REAL_WEBP = FIXTURES.lossy1x1
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...new Array<number>(60).fill(1)])

const pending: ImageRow = { id: 'img-1', storagePath: 'org/prop/img-1.webp', status: 'pending' }

function deps(overrides: Partial<ConfirmDeps> = {}): ConfirmDeps {
  return {
    findImage: vi.fn().mockResolvedValue(pending),
    download: vi.fn().mockResolvedValue(REAL_WEBP),
    removeObject: vi.fn().mockResolvedValue(undefined),
    markReady: vi.fn().mockResolvedValue(true),
    ...overrides,
  }
}

describe('confirmImage', () => {
  it('confirma um WebP válido', async () => {
    const d = deps()
    expect(await confirmImage(d, 'img-1')).toEqual({ status: 200, body: { status: 'ready' } })
    expect(d.markReady).toHaveBeenCalledWith('img-1')
    expect(d.removeObject).not.toHaveBeenCalled()
  })

  it('imagem inexistente ou de outra organização (RLS): 404 sem tocar no Storage', async () => {
    const d = deps({ findImage: vi.fn().mockResolvedValue(null) })
    expect(await confirmImage(d, 'x')).toEqual({ status: 404, body: { error: 'image_not_found' } })
    expect(d.download).not.toHaveBeenCalled()
    expect(d.markReady).not.toHaveBeenCalled()
  })

  it('já confirmada: 200 idempotente, sem voltar a descarregar', async () => {
    const d = deps({ findImage: vi.fn().mockResolvedValue({ ...pending, status: 'ready' }) })
    expect((await confirmImage(d, 'img-1')).status).toBe(200)
    expect(d.download).not.toHaveBeenCalled()
  })

  it('sem upload: 409 e a reserva fica pending', async () => {
    const d = deps({ download: vi.fn().mockResolvedValue(null) })
    expect(await confirmImage(d, 'img-1')).toEqual({ status: 409, body: { error: 'upload_not_found' } })
    expect(d.markReady).not.toHaveBeenCalled()
  })

  it('um JPEG com Content-Type image/webp é recusado e apagado; a reserva fica pending', async () => {
    const d = deps({ download: vi.fn().mockResolvedValue(JPEG) })
    expect(await confirmImage(d, 'img-1')).toEqual({ status: 422, body: { error: 'not_webp' } })
    expect(d.removeObject).toHaveBeenCalledWith(pending.storagePath)
    expect(d.markReady).not.toHaveBeenCalled()
  })

  it('acima de 1 MiB é recusado e apagado', async () => {
    const huge = new Uint8Array(1048577)
    huge.set(REAL_WEBP)
    const d = deps({ download: vi.fn().mockResolvedValue(huge) })
    expect(await confirmImage(d, 'img-1')).toEqual({ status: 422, body: { error: 'file_too_large' } })
    expect(d.removeObject).toHaveBeenCalled()
  })

  it('corrida: alguém confirmou entretanto -> 409', async () => {
    const d = deps({ markReady: vi.fn().mockResolvedValue(false) })
    expect(await confirmImage(d, 'img-1')).toEqual({ status: 409, body: { error: 'not_pending' } })
  })
})
