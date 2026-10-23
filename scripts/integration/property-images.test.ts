// Testes de integração contra o Supabase LOCAL, por HTTP e com ligações paralelas reais.
// O pgTAP corre numa só ligação e não consegue provar concorrência nem o comportamento do Storage.
// Pré-requisitos: pnpm db:start (seed com Ana e João). Corre com: pnpm test:integration
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database.ts'
import { loadEnv } from './env.ts'

type Client = SupabaseClient<Database>

const BUCKET = 'property-images'
const DEV_PASSWORD = 'visitbook-dev-1234'
// WebP 1x1 válido (RIFF....WEBP)
const WEBP = Buffer.from('UklGRhoAAABXRUJQVlA4TA4AAAAvAAAAAAfQ//73v/+BiOh/AAA=', 'base64')

const env = loadEnv()
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const newClient = (key: string): Client => createClient<Database>(env.url, key, options)

async function signIn(email: string): Promise<Client> {
  const client = newClient(env.publishableKey)
  const { error } = await client.auth.signInWithPassword({ email, password: DEV_PASSWORD })
  if (error) throw new Error(`login falhou (${error.code}) — o seed está aplicado?`)
  return client
}

const service = newClient(env.serviceRoleKey)
const anon = newClient(env.publishableKey)
const createdProperties: string[] = []
const uploadedPaths: string[] = []
let ana: Client
let joao: Client
let anaOrg: string

async function createProperty(client: Client, organizationId: string): Promise<string> {
  const { data, error } = await client
    .from('properties')
    .insert({ organization_id: organizationId, title: `Integração ${crypto.randomUUID().slice(0, 8)}` })
    .select('id')
    .single()
  assert.equal(error, null, `criar imóvel: ${error?.message}`)
  const id = data?.id ?? ''
  createdProperties.push(id)
  return id
}

async function reserve(client: Client, propertyId: string) {
  return client.rpc('reserve_property_image', { p_property_id: propertyId })
}

before(async () => {
  ana = await signIn('ana.consultora@example.com')
  joao = await signIn('joao.consultor@example.com')
  const { data, error } = await ana.from('organization_members').select('organization_id').single()
  assert.equal(error, null)
  anaOrg = data?.organization_id ?? ''
})

after(async () => {
  if (uploadedPaths.length > 0) await service.storage.from(BUCKET).remove(uploadedPaths)
  if (createdProperties.length > 0) await service.from('properties').delete().in('id', createdProperties)
})

describe('concorrência: o limite de 8 fotos é do Postgres, não de uma contagem', () => {
  it('12 reservas simultâneas ocupam exatamente os slots 1..8 e as outras 4 são recusadas (5 rondas)', async () => {
    for (let round = 1; round <= 5; round++) {
      const propertyId = await createProperty(ana, anaOrg)
      const results = await Promise.all(Array.from({ length: 12 }, () => reserve(ana, propertyId)))

      const ok = results.filter((r) => r.error === null)
      const refused = results.filter((r) => r.error !== null)
      assert.equal(ok.length, 8, `ronda ${round}: reservas aceites`)
      assert.equal(refused.length, 4, `ronda ${round}: reservas recusadas`)
      assert.ok(refused.every((r) => r.error?.message.includes('photo_limit_reached')), `ronda ${round}: motivo da recusa`)
      assert.deepEqual(
        ok.map((r) => r.data?.slot).sort((a, b) => (a ?? 0) - (b ?? 0)),
        [1, 2, 3, 4, 5, 6, 7, 8],
        `ronda ${round}: slots distintos de 1 a 8`,
      )

      const { count } = await service.from('property_images').select('*', { count: 'exact', head: true }).eq('property_id', propertyId)
      assert.equal(count, 8, `ronda ${round}: linhas na base de dados`)
    }
  })

  it('20 inserções diretas simultâneas no mesmo slot: só uma vence e as outras falham com 23505', async () => {
    const propertyId = await createProperty(ana, anaOrg)
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        ana.from('property_images').insert({ property_id: propertyId, organization_id: anaOrg, slot: 1 }),
      ),
    )
    assert.equal(results.filter((r) => r.error === null).length, 1)
    assert.ok(results.filter((r) => r.error !== null).every((r) => r.error?.code === '23505'))
  })

  it('uma 9.ª foto é recusada e uma inserção direta com slot 9 também', async () => {
    const propertyId = await createProperty(ana, anaOrg)
    await Promise.all(Array.from({ length: 8 }, () => reserve(ana, propertyId)))
    const ninth = await reserve(ana, propertyId)
    assert.ok(ninth.error?.message.includes('photo_limit_reached'))
    const direct = await ana.from('property_images').insert({ property_id: propertyId, organization_id: anaOrg, slot: 9 })
    assert.equal(direct.error?.code, '23514')
  })
})

describe('Storage: bucket privado, só reservas, só WebP, só até 1 MiB', () => {
  let propertyId = ''
  let path = ''
  let imageId = ''

  before(async () => {
    propertyId = await createProperty(ana, anaOrg)
    const { data, error } = await reserve(ana, propertyId)
    assert.equal(error, null)
    path = data?.storage_path ?? ''
    imageId = data?.id ?? ''
    uploadedPaths.push(path)
    assert.ok(path.startsWith(`${anaOrg}/${propertyId}/`) && path.endsWith('.webp'))
  })

  it('não carrega para um caminho sem reserva', async () => {
    const { error } = await ana.storage.from(BUCKET).upload(`${anaOrg}/${propertyId}/${crypto.randomUUID()}.webp`, WEBP, { contentType: 'image/webp' })
    assert.ok(error, 'devia ter sido recusado')
  })

  it('não carrega para a reserva de outra organização', async () => {
    const { error } = await joao.storage.from(BUCKET).upload(path, WEBP, { contentType: 'image/webp' })
    assert.ok(error, 'devia ter sido recusado')
  })

  it('recusa um tipo que não seja image/webp (regras do bucket)', async () => {
    const { error } = await ana.storage.from(BUCKET).upload(path, WEBP, { contentType: 'image/jpeg' })
    assert.ok(error, 'devia ter sido recusado')
  })

  it('recusa ficheiros acima de 1 MiB (regras do bucket)', async () => {
    const { error } = await ana.storage.from(BUCKET).upload(path, Buffer.alloc(2 * 1024 * 1024, 1), { contentType: 'image/webp' })
    assert.ok(error, 'devia ter sido recusado')
  })

  it('não confirma sem o ficheiro carregado (upload_not_found)', async () => {
    const { error } = await ana.from('property_images').update({ status: 'ready' }).eq('id', imageId)
    assert.equal(error?.code, '55000')
  })

  it('carrega o ficheiro reservado e confirma', async () => {
    const upload = await ana.storage.from(BUCKET).upload(path, WEBP, { contentType: 'image/webp' })
    assert.equal(upload.error, null, `upload: ${upload.error?.message}`)
    const { error } = await ana.from('property_images').update({ status: 'ready' }).eq('id', imageId)
    assert.equal(error, null, `confirmar: ${error?.message}`)
  })

  it('o URL público do bucket privado não serve o ficheiro', async () => {
    const response = await fetch(`${env.url}/storage/v1/object/public/${BUCKET}/${path}`)
    assert.notEqual(response.status, 200)
  })

  it('anon, mesmo com o caminho exato, não lê o objeto nem gera signed URL', async () => {
    const read = await fetch(`${env.url}/storage/v1/object/${BUCKET}/${path}`, { headers: { apikey: env.publishableKey } })
    assert.notEqual(read.status, 200)
    const signed = await anon.storage.from(BUCKET).createSignedUrl(path, 60)
    assert.ok(signed.error, 'anon não devia gerar signed URL')
  })

  it('outra organização, com sessão válida, não lê o objeto nem gera signed URL', async () => {
    const download = await joao.storage.from(BUCKET).download(path)
    assert.ok(download.error, 'João não devia descarregar')
    const signed = await joao.storage.from(BUCKET).createSignedUrl(path, 60)
    assert.ok(signed.error, 'João não devia gerar signed URL')
  })

  it('a própria organização gera um signed URL que serve exatamente o ficheiro', async () => {
    const signed = await ana.storage.from(BUCKET).createSignedUrl(path, 60)
    assert.equal(signed.error, null)
    const response = await fetch(signed.data?.signedUrl ?? '')
    assert.equal(response.status, 200)
    const bytes = Buffer.from(await response.arrayBuffer())
    assert.deepEqual(bytes, WEBP)
  })

  it('o cliente da API não apaga objetos (só a Edge Function com service_role)', async () => {
    await ana.storage.from(BUCKET).remove([path])
    const { data } = await service.storage.from(BUCKET).list(`${anaOrg}/${propertyId}`)
    assert.ok(data?.some((file) => path.endsWith(file.name)), 'o objeto devia continuar lá')
  })
})
