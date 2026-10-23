import { execSync } from 'node:child_process'

export interface IntegrationEnv {
  url: string
  publishableKey: string
  serviceRoleKey: string
}

function fromCli(): Record<string, string> {
  const output = execSync('pnpm --silent supabase status -o env', { encoding: 'utf8' })
  const entries = output
    .split('\n')
    .map((line) => /^([A-Z_]+)="?(.*?)"?$/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => [match[1] ?? '', match[2] ?? ''] as const)
  return Object.fromEntries(entries)
}

export function loadEnv(): IntegrationEnv {
  const cli = process.env['SUPABASE_URL'] ? {} : fromCli()
  const url = process.env['SUPABASE_URL'] ?? cli['API_URL'] ?? ''
  const publishableKey = process.env['SUPABASE_PUBLISHABLE_KEY'] ?? cli['PUBLISHABLE_KEY'] ?? ''
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? cli['SERVICE_ROLE_KEY'] ?? ''
  if (!url || !publishableKey || !serviceRoleKey) throw new Error('Supabase local não está a correr (pnpm db:start)')
  if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
    throw new Error('Os testes de integração criam e apagam dados: só correm contra o Supabase local')
  }
  return { url, publishableKey, serviceRoleKey }
}
