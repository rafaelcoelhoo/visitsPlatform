import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { errorText } from '@/lib/formErrors'
import { Button } from '@/ui/Button'
import { TextField } from '@/ui/TextField'
import type { AuthFailure, AuthOutcome } from '../domain/authErrors'
import { loginSchema } from '../schemas'
import type { LoginValues } from '../schemas'

interface LoginFormProps {
  onSubmit: (values: LoginValues) => Promise<AuthOutcome>
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  const { t } = useTranslation()
  const [failure, setFailure] = useState<AuthFailure | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  const submit = handleSubmit(async (values) => {
    setFailure(null)
    const outcome = await onSubmit(values)
    if (!outcome.ok) setFailure(outcome.reason)
  })

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="space-y-4">
      <TextField
        label={t('auth.login.email')}
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        error={errorText(t, errors.email?.message)}
        {...register('email')}
      />
      <TextField
        label={t('auth.login.password')}
        type="password"
        autoComplete="current-password"
        error={errorText(t, errors.password?.message)}
        {...register('password')}
      />
      {failure ? (
        <p role="alert" className="flex gap-1 font-medium text-red-800">
          <span aria-hidden="true">⚠</span>
          <span>{t(`auth.failure.${failure}`)}</span>
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className="w-full">
        {isSubmitting ? t('auth.login.submitting') : t('auth.login.submit')}
      </Button>
    </form>
  )
}
