import { z } from 'zod'

const rowSchema = z.object({
  organization_id: z.guid(),
  display_name: z.string().min(1),
  status: z.enum(['active', 'inactive']),
  role: z.enum(['consultant']),
})

export interface Membership {
  organizationId: string
  displayName: string
  status: 'active' | 'inactive'
  role: 'consultant'
}

export function toMembership(row: unknown): Membership | null {
  if (row === null) return null
  const parsed = rowSchema.parse(row)
  return {
    organizationId: parsed.organization_id,
    displayName: parsed.display_name,
    status: parsed.status,
    role: parsed.role,
  }
}
