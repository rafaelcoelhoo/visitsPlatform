import { describe, expect, it, vi } from 'vitest'
import { reconcile } from './reconcile.ts'
import type { ReconcileDeps } from './reconcile.ts'

function deps(overrides: Partial<ReconcileDeps> = {}): ReconcileDeps {
  return {
    expirePending: vi.fn().mockResolvedValue([]),
    listOrphans: vi.fn().mockResolvedValue([]),
    removeObjects: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('reconcile', () => {
  it('sem trabalho, não chama o Storage', async () => {
    const d = deps()
    expect(await reconcile(d, 3600)).toEqual({ expiredReservations: 0, orphanObjects: 0, removedObjects: 0 })
    expect(d.removeObjects).not.toHaveBeenCalled()
  })

  it('passa o limiar de idade às duas consultas', async () => {
    const d = deps()
    await reconcile(d, 120)
    expect(d.expirePending).toHaveBeenCalledWith(120)
    expect(d.listOrphans).toHaveBeenCalledWith(120)
  })

  it('apaga os ficheiros das reservas expiradas e os órfãos, sem duplicados', async () => {
    const d = deps({
      expirePending: vi.fn().mockResolvedValue(['a.webp', 'b.webp']),
      listOrphans: vi.fn().mockResolvedValue(['b.webp', 'c.webp']),
    })
    expect(await reconcile(d, 3600)).toEqual({ expiredReservations: 2, orphanObjects: 2, removedObjects: 3 })
    expect(d.removeObjects).toHaveBeenCalledTimes(1)
    expect(d.removeObjects).toHaveBeenCalledWith(['a.webp', 'b.webp', 'c.webp'])
  })

  it('apaga em lotes de 100', async () => {
    const paths = Array.from({ length: 250 }, (_, i) => `${i}.webp`)
    const d = deps({ listOrphans: vi.fn().mockResolvedValue(paths) })
    await reconcile(d, 3600)
    const calls = (d.removeObjects as ReturnType<typeof vi.fn>).mock.calls as string[][][]
    expect(calls.map((c) => c[0]?.length)).toEqual([100, 100, 50])
  })

  it('apaga as linhas expiradas antes de listar os órfãos', async () => {
    const order: string[] = []
    const d = deps({
      expirePending: vi.fn().mockImplementation(() => {
        order.push('expire')
        return Promise.resolve([])
      }),
      listOrphans: vi.fn().mockImplementation(() => {
        order.push('orphans')
        return Promise.resolve([])
      }),
    })
    await reconcile(d, 3600)
    expect(order).toEqual(['expire', 'orphans'])
  })
})
