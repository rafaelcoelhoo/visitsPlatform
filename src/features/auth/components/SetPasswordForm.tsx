import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { LIMITS } from '@/config/limits'
import { errorText } from '@/lib/formErrors'
import { Button } from '@/ui/Button'
import { TextField } from '@/ui/TextField'
import type { AuthFailure, AuthOutcome } from '../domain/authErrors'
import { setPasswordSchema } from '../schemas'
import type { SetPasswordValues } from '../schemas'

interface SetPasswordFormProps {
  onSubmit: (password: string) => Promise<AuthOutcome>
}

export function SetPasswordForm({ onSubmit }: SetPasswordFormProps) {
  const { t } = useTranslation()
  const [failure, setFailure] = useState<AuthFailure | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetPasswordValues>({ resolver: zodResolver(setPasswordSchema) })

  const submit = handleSubmit(async ({ password }) => {
    setFailure(null)
    const outcome = await onSubmit(password)
    if (!outcome.ok) setFailure(outcome.reason)
  })

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="space-y-4">
      <TextField
        label={t('auth.setPassword.password')}
        hint={t('auth.setPassword.hint', { min: LIMITS.auth.passwordMinLength })}
        type="password"
        autoComplete="new-password"
        error={errorText(t, errors.password?.message)}
        {...register('password')}
      />
      <TextField
        label={t('auth.setPassword.confirm')}
        type="password"
        autoComplete="new-password"
        error={errorText(t, errors.confirm?.message)}
        {...register('confirm')}
      />
      {failure ? (
        <p role="alert" className="flex gap-1 font-medium text-red-800">
          <span aria-hidden="true">⚠</span>
          <span>{t(`auth.failure.${failure}`)}</span>
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className="w-full">
        {isSubmitting ? t('auth.setPassword.submitting') : t('auth.setPassword.submit')}
      </Button>
    </form>
  )
}
