import { describe, expect, it } from 'vitest'
import { toMembership } from './membership'

const row = {
  organization_id: '11111111-1111-4111-8111-111111111111',
  display_name: 'Ana Martins',
  status: 'active',
  role: 'consultant',
}

describe('toMembership', () => {
  it('converte uma linha válida', () => {
    expect(toMembership(row)).toEqual({
      organizationId: row.organization_id,
      displayName: 'Ana Martins',
      status: 'active',
      role: 'consultant',
    })
  })

  it('sem linha não há membership (conta sem acesso de consultor)', () => {
    expect(toMembership(null)).toBeNull()
  })

  it('mantém o estado inativo', () => {
    expect(toMembership({ ...row, status: 'inactive' })?.status).toBe('inactive')
  })

  it.each([
    { ...row, status: 'suspended' },
    { ...row, role: 'admin' },
    { ...row, organization_id: 'nao-e-um-uuid' },
    { ...row, display_name: '' },
  ])('rejeita dados fora do contrato: %j', (invalid) => {
    expect(() => toMembership(invalid)).toThrow()
  })
})
