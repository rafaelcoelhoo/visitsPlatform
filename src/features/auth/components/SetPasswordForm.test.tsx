import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LIMITS } from '@/config/limits'
import { SetPasswordForm } from './SetPasswordForm'

const valid = 'casa verde perto do mar'

describe('SetPasswordForm', () => {
  it('descreve a regra da password no campo e usa new-password', () => {
    render(<SetPasswordForm onSubmit={vi.fn()} />)
    const field = screen.getByLabelText('Nova password')
    expect(field).toHaveAttribute('autocomplete', 'new-password')
    expect(field).toHaveAccessibleDescription(`Pelo menos ${LIMITS.auth.passwordMinLength} caracteres. Pode usar uma frase.`)
  })

  it('rejeita uma password curta mantendo a regra e o erro na descrição do campo', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<SetPasswordForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Nova password'), 'curta')
    await user.type(screen.getByLabelText('Confirmar password'), 'curta')
    await user.click(screen.getByRole('button', { name: 'Guardar password' }))

    const field = screen.getByLabelText('Nova password')
    await waitFor(() => {
      expect(field).toHaveAttribute('aria-invalid', 'true')
    })
    expect(field).toHaveAccessibleDescription(/Pelo menos 12 caracteres.*A password é demasiado curta\./)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('exige que a confirmação coincida', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<SetPasswordForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Nova password'), valid)
    await user.type(screen.getByLabelText('Confirmar password'), `${valid}!`)
    await user.click(screen.getByRole('button', { name: 'Guardar password' }))

    expect(await screen.findByText('As passwords não coincidem.')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirmar password')).toHaveAttribute('aria-invalid', 'true')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('envia só a password (a confirmação não sai do formulário)', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue({ ok: true })
    render(<SetPasswordForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Nova password'), valid)
    await user.type(screen.getByLabelText('Confirmar password'), valid)
    await user.click(screen.getByRole('button', { name: 'Guardar password' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(valid)
    })
  })

  it('anuncia a falha do servidor com role=alert', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue({ ok: false, reason: 'weakPassword' })
    render(<SetPasswordForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Nova password'), valid)
    await user.type(screen.getByLabelText('Confirmar password'), valid)
    await user.click(screen.getByRole('button', { name: 'Guardar password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Password demasiado fraca.')
  })
})
