import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AuthOutcome } from '../domain/authErrors'
import { LoginForm } from './LoginForm'

const ok: AuthOutcome = { ok: true }

describe('LoginForm', () => {
  it('liga cada campo ao seu rótulo e define autocomplete para gestores de passwords', () => {
    render(<LoginForm onSubmit={vi.fn()} />)
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password')
  })

  it('mostra erros associados aos campos (aria-describedby, aria-invalid) e foca o primeiro inválido', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<LoginForm onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    const email = screen.getByLabelText('Email')
    const password = screen.getByLabelText('Password')
    expect(onSubmit).not.toHaveBeenCalled()
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveAccessibleDescription('Indique o email.')
    expect(password).toHaveAttribute('aria-invalid', 'true')
    expect(password).toHaveAccessibleDescription('Indique a password.')
    await waitFor(() => {
      expect(email).toHaveFocus()
    })
  })

  it('rejeita email inválido sem chamar o servidor', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<LoginForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Email'), 'sem-arroba')
    await user.type(screen.getByLabelText('Password'), 'x')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText(/email válido/)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('envia os valores com o email sem espaços', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(ok)
    render(<LoginForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Email'), '  ana@example.com ')
    await user.type(screen.getByLabelText('Password'), 'uma-password')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'uma-password' })
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('anuncia o erro de credenciais com role=alert e uma mensagem única para email ou password errados', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue({ ok: false, reason: 'invalidCredentials' } satisfies AuthOutcome)
    render(<LoginForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Password'), 'errada')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email ou password incorretos.')
  })

  it('desativa o botão e indica ocupado enquanto envia, evitando duplo envio', async () => {
    const user = userEvent.setup()
    let release: (outcome: AuthOutcome) => void = () => undefined
    const onSubmit = vi.fn().mockReturnValue(
      new Promise<AuthOutcome>((resolve) => {
        release = resolve
      }),
    )
    render(<LoginForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Password'), 'uma-password')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    const busy = await screen.findByRole('button', { name: 'A entrar…' })
    expect(busy).toBeDisabled()
    expect(busy).toHaveAttribute('aria-busy', 'true')

    release(ok)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
    })
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})
