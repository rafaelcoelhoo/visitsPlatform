// Cria um consultor: convite por email (o consultor define a própria password) + organização.
// Uso: pnpm admin:create-consultant -- --email ana@exemplo.pt --name "Ana Martins" [--org-name "Imobiliária X"] [--yes]
// Variáveis (exportar na shell; nunca em ficheiros do repositório):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_URL (opcional; base do link do convite)
import { parseArgs } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database.ts'

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])

function fail(message: string): never {
  console.error(`Erro: ${message}`)
  process.exit(1)
}

const args = process.argv.slice(2)
if (args[0] === '--') args.shift()

const { values } = parseArgs({
  args,
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    'org-name': { type: 'string' },
    yes: { type: 'boolean', default: false },
  },
})

const email = values.email?.trim().toLowerCase()
const name = values.name?.trim()
const orgName = values['org-name']?.trim()

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('--email em falta ou inválido')
if (!name || name.length > 120) fail('--name em falta ou com mais de 120 caracteres')
if (orgName !== undefined && (orgName.length < 1 || orgName.length > 120)) fail('--org-name tem de ter entre 1 e 120 caracteres')

const url = process.env['SUPABASE_URL']
const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
const siteUrl = (process.env['SITE_URL'] ?? 'http://127.0.0.1:5173').replace(/\/$/, '')

if (!url || !serviceKey) fail('definir SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na shell')

if (!LOCAL_HOSTS.has(new URL(url).hostname) && !values.yes) {
  fail('SUPABASE_URL não é local. Confirme que é o projeto pretendido e repita com --yes')
}

const supabase = createClient<Database>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function findUserIdByEmail(target: string): Promise<string | undefined> {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) fail(`não foi possível listar utilizadores (${error.code ?? error.status})`)
    const match = data.users.find((user) => user.email?.toLowerCase() === target)
    if (match) return match.id
    if (data.users.length < 200) return undefined
  }
}

const invite = await supabase.auth.admin.inviteUserByEmail(email, { redirectTo: `${siteUrl}/definir-password` })

let userId: string | undefined
let invited = false
if (invite.error) {
  if (invite.error.code !== 'email_exists') fail(`convite falhou (${invite.error.code ?? invite.error.status})`)
  userId = await findUserIdByEmail(email)
} else {
  userId = invite.data.user.id
  invited = true
}
if (!userId) fail('utilizador não encontrado depois de o convite indicar que já existe')

const { data: orgId, error } = await supabase.rpc('admin_create_consultant', {
  p_user_id: userId,
  p_email: email,
  p_display_name: name,
  ...(orgName === undefined ? {} : { p_org_display_name: orgName }),
})
if (error) fail(`admin_create_consultant falhou (${error.code})`)

console.log(invited ? 'Convite enviado.' : 'Utilizador já existia: não foi enviado novo convite.')
console.log(`user_id=${userId}`)
console.log(`organization_id=${orgId}`)
