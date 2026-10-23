export interface ReconcileDeps {
  expirePending(olderThanSeconds: number): Promise<string[]>
  listOrphans(olderThanSeconds: number): Promise<string[]>
  removeObjects(paths: string[]): Promise<void>
}

export interface ReconcileReport {
  expiredReservations: number
  orphanObjects: number
  removedObjects: number
}

const BATCH = 100

// 1) apaga reservas pending antigas (liberta os slots); 2) apaga os ficheiros dessas reservas e
// qualquer objeto do bucket sem linha correspondente. Idempotente: pode correr várias vezes.
export async function reconcile(deps: ReconcileDeps, olderThanSeconds: number): Promise<ReconcileReport> {
  const expired = await deps.expirePending(olderThanSeconds)
  const orphans = await deps.listOrphans(olderThanSeconds)
  const all = [...new Set([...expired, ...orphans])]

  for (let start = 0; start < all.length; start += BATCH) {
    await deps.removeObjects(all.slice(start, start + BATCH))
  }

  return { expiredReservations: expired.length, orphanObjects: orphans.length, removedObjects: all.length }
}
