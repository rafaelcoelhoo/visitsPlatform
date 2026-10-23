import { z } from 'zod'

const schema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
})

export type Env = z.infer<typeof schema>

const FORBIDDEN_KEY = /service[_-]?role/i

export function parseEnv(raw: Record<string, unknown>): Env {
  if (Object.keys(raw).some((key) => FORBIDDEN_KEY.test(key))) {
    throw new Error('Configuração inválida: a chave service_role não pode estar no frontend')
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ')
    throw new Error(`Configuração inválida: ${fields}`)
  }
  return result.data
}
