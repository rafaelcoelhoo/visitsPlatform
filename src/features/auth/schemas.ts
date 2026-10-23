import { z } from 'zod'
import { LIMITS } from '@/config/limits'

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'auth.errors.emailRequired').pipe(z.email({ error: 'auth.errors.emailInvalid' })),
  password: z.string().min(1, 'auth.errors.passwordRequired'),
})

export type LoginValues = z.infer<typeof loginSchema>

export const setPasswordSchema = z
  .object({
    password: z.string().min(LIMITS.auth.passwordMinLength, 'auth.errors.passwordTooShort'),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    path: ['confirm'],
    error: 'auth.errors.passwordMismatch',
  })

export type SetPasswordValues = z.infer<typeof setPasswordSchema>
