// Código específico do runtime Deno das Edge Functions (fora do tsc do projeto; ver docs/ARCHITECTURE.md).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { jsonResponse, logEvent } from '../_shared/http.ts'

export function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`variável de ambiente em falta: ${name}`)
  return value
}

export const allowedOrigins = (): string[] =>
  (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } }

export function serviceClient() {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), clientOptions)
}

// Autentica o chamador: valida o JWT no servidor de Auth (funciona com chaves simétricas e assimétricas)
// e devolve um cliente que corre com o JWT do utilizador, para o RLS decidir o que ele pode ver.
export async function authenticate(req: Request) {
  const header = req.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice('Bearer '.length)
  const client = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    ...clientOptions,
    global: { headers: { Authorization: header } },
  })
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return null
  return { client, userId: data.user.id }
}

// Nunca devolve detalhes de erros internos ao chamador, nem os escreve nos logs (podem conter dados pessoais).
export async function guarded(fn: string, handler: () => Promise<Response>, cors: Record<string, string> = {}): Promise<Response> {
  try {
    return await handler()
  } catch (error) {
    logEvent(fn, { status: 500, error: error instanceof Error ? error.name : 'unknown' })
    return jsonResponse(500, { error: 'internal_error' }, cors)
  }
}
