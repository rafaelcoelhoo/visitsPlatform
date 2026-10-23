// Integração das Edge Functions de fotos contra o Supabase LOCAL.
// Pré-requisitos: pnpm db:start e, noutro terminal, pnpm functions:serve.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { after, before, describe, it } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database.ts'
import { loadEnv } from './env.ts'

type Client = SupabaseClient<Database>

const BUCKET = 'property-images'
const DEV_PASSWORD = 'visitbook-dev-1234'
const RECONCILE_SECRET = 'local-dev-only-reconcile-secret'
const fixture = (name: string): Buffer => readFileSync(new URL(`../../supabase/functions/_shared/fixtures/${name}`, import.meta.url))
const GOOD = fixture('lossy-1x1.webp')
const TOO_WIDE = fixture('lossy-1601x100.webp')
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array<number>(60).fill(1)])
const POLYGLOT = Buffer.concat([GOOD, Buffer.from('<script>alert(1)</script>')])

const env = loadEnv()
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const service: Client = createClient<Database>(env.url, env.serviceRoleKey, options)
const createdProperties: string[] = []

async function signIn(email: string): Promise<{ client: Client; token: string }> {
  const client = createClient<Database>(env.url, env.publishableKey, options)
  const { data, error } = await client.auth.signInWithPassword({ email, password: DEV_PASSWORD })
  if (error || !data.session) throw new Error(`login falhou (${error?.code})`)
  return { client, token: data.session.access_token }
}

async function callFn(name: string, body: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`${env.url}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  return { status: response.status, body: (await response.json().catch(() => null)) as Record<string, unknown> | null }
}

const asUser = (token: string) => ({ Authorization: `Bearer ${token}` })
const confirm = (token: string, imageId: string) => callFn('confirm-property-image', { image_id: imageId }, asUser(token))
const remove = (token: string, imageId: string) => callFn('delete-property-image', { image_id: imageId }, asUser(token))
const reconcileFn = (body: unknown, secret: string | null = RECONCILE_SECRET) =>
  callFn('reconcile-property-images', body, secret === null ? {} : { 'x-reconcile-secret': secret })

let ana: { client: Client; token: string }
let joao: { client: Client; token: string }
let anaOrg = ''

async function newProperty(): Promise<string> {
  const { data, error } = await ana.client
    .from('properties')
    .insert({ organization_id: anaOrg, title: `Funções ${crypto.randomUUID().slice(0, 8)}` })
    .select('id')
    .single()
  assert.equal(error, null)
  createdProperties.push(data?.id ?? '')
  return data?.id ?? ''
}

async function reserve(propertyId: string) {
  const { data, error } = await ana.client.rpc('reserve_property_image', { p_property_id: propertyId })
  assert.equal(error, null, `reservar: ${error?.message}`)
  assert.ok(data?.storage_path, 'storage_path devia vir preenchido (coluna gerada)')
  return { id: data.id, slot: data.slot, storage_path: data.storage_path }
}

const upload = (path: string, bytes: Buffer, contentType = 'image/webp') => ana.client.storage.from(BUCKET).upload(path, bytes, { contentType })

async function objectExists(path: string): Promise<boolean> {
  const folder = path.slice(0, path.lastIndexOf('/'))
  const { data, error } = await service.storage.from(BUCKET).list(folder)
  assert.equal(error, null)
  return (data ?? []).some((file) => path.endsWith(`/${file.name}`))
}

async function rowStatus(imageId: string): Promise<string | null> {
  const { data } = await service.from('property_images').select('status').eq('id', imageId).maybeSingle()
  return data?.status ?? null
}

before(async () => {
  ana = await signIn('ana.consultora@example.com')
  joao = await signIn('joao.consultor@example.com')
  const { data } = await ana.client.from('organization_members').select('organization_id').single()
  anaOrg = data?.organization_id ?? ''
})

after(async () => {
  if (createdProperties.length === 0) return
  const { data } = await service.from('property_images').select('storage_path').in('property_id', createdProperties)
  const paths = (data ?? []).flatMap((row) => (row.storage_path ? [row.storage_path] : []))
  if (paths.length > 0) await service.storage.from(BUCKET).remove(paths)
  await service.from('properties').delete().in('id', createdProperties)
})

describe('confirm-property-image', () => {
  it('sem token, com token inválido ou com a chave pública: 401', async () => {
    const image = await reserve(await newProperty())
    assert.equal((await callFn('confirm-property-image', { image_id: image.id })).status, 401)
    assert.equal((await confirm('isto-nao-e-um-jwt', image.id)).status, 401)
    assert.equal((await confirm(env.publishableKey, image.id)).status, 401)
  })

  it('pedido mal formado: 400', async () => {
    assert.equal((await callFn('confirm-property-image', {}, asUser(ana.token))).status, 400)
    assert.equal((await callFn('confirm-property-image', { image_id: "1'; drop table x;--" }, asUser(ana.token))).status, 400)
  })

  it('o cliente da API já não consegue confirmar diretamente (só a função, depois dos magic bytes)', async () => {
    const image = await reserve(await newProperty())
    assert.equal((await upload(image.storage_path, JPEG)).error, null)
    const { error } = await ana.client.from('property_images').update({ status: 'ready' }).eq('id', image.id)
    assert.equal(error?.code, '42501')
    assert.equal(await rowStatus(image.id), 'pending')
  })

  it('sem ficheiro carregado: 409 e a reserva fica pending', async () => {
    const image = await reserve(await newProperty())
    const result = await confirm(ana.token, image.id)
    assert.equal(result.status, 409)
    assert.equal(result.body?.['error'], 'upload_not_found')
    assert.equal(await rowStatus(image.id), 'pending')
  })

  it('outra organização: 404, como se a foto não existisse', async () => {
    const image = await reserve(await newProperty())
    assert.equal((await upload(image.storage_path, GOOD)).error, null)
    assert.equal((await confirm(joao.token, image.id)).status, 404)
    assert.equal(await rowStatus(image.id), 'pending')
  })

  it('um JPEG enviado como image/webp é recusado, apagado, e a reserva permite novo upload', async () => {
    const image = await reserve(await newProperty())
    assert.equal((await upload(image.storage_path, JPEG)).error, null, 'o bucket só vê o Content-Type declarado')

    const refused = await confirm(ana.token, image.id)
    assert.equal(refused.status, 422)
    assert.equal(refused.body?.['error'], 'not_webp')
    assert.equal(await rowStatus(image.id), 'pending')
    assert.equal(await objectExists(image.storage_path), false, 'o ficheiro inválido foi apagado')

    assert.equal((await upload(image.storage_path, GOOD)).error, null, 'a reserva continua utilizável')
    assert.equal((await confirm(ana.token, image.id)).status, 200)
    assert.equal(await rowStatus(image.id), 'ready')
  })

  it('um WebP com dados anexados (polyglot) é recusado', async () => {
    const image = await reserve(await newProperty())
    assert.equal((await upload(image.storage_path, POLYGLOT)).error, null)
    const result = await confirm(ana.token, image.id)
    assert.equal(result.status, 422)
    assert.equal(result.body?.['error'], 'not_webp')
  })

  it('um WebP com mais de 1600 px é recusado', async () => {
    const image = await reserve(await newProperty())
    assert.equal((await upload(image.storage_path, TOO_WIDE)).error, null)
    const result = await confirm(ana.token, image.id)
    assert.equal(result.status, 422)
    assert.equal(result.body?.['error'], 'dimensions_too_large')
    assert.equal(await objectExists(image.storage_path), false)
  })

  it('confirma um WebP válido e é idempotente', async () => {
    const image = await reserve(await newProperty())
    assert.equal((await upload(image.storage_path, GOOD)).error, null)
    assert.deepEqual((await confirm(ana.token, image.id)).body, { status: 'ready' })
    assert.equal(await rowStatus(image.id), 'ready')
    assert.equal((await confirm(ana.token, image.id)).status, 200)
  })
})

describe('delete-property-image', () => {
  it('sem token: 401', async () => {
    const image = await reserve(await newProperty())
    assert.equal((await callFn('delete-property-image', { image_id: image.id })).status, 401)
  })

  it('o cliente da API não apaga linhas diretamente', async () => {
    const image = await reserve(await newProperty())
    const { error } = await ana.client.from('property_images').delete().eq('id', image.id)
    assert.equal(error?.code, '42501')
  })

  it('outra organização: 404 e nada é apagado', async () => {
    const image = await reserve(await newProperty())
    assert.equal((await upload(image.storage_path, GOOD)).error, null)
    assert.equal((await remove(joao.token, image.id)).status, 404)
    assert.equal(await rowStatus(image.id), 'pending')
    assert.equal(await objectExists(image.storage_path), true)
  })

  it('apaga a linha e o ficheiro, liberta o slot e é 404 à segunda vez', async () => {
    const propertyId = await newProperty()
    const image = await reserve(propertyId)
    assert.equal((await upload(image.storage_path, GOOD)).error, null)
    assert.equal((await confirm(ana.token, image.id)).status, 200)

    const result = await remove(ana.token, image.id)
    assert.equal(result.status, 200)
    assert.deepEqual(result.body, { deleted: true, file: 'removed' })
    assert.equal(await rowStatus(image.id), null)
    assert.equal(await objectExists(image.storage_path), false)

    const next = await reserve(propertyId)
    assert.equal(next.slot, image.slot, 'o slot libertado é reutilizado')
    assert.equal((await remove(ana.token, image.id)).status, 404)
  })
})

describe('reconcile-property-images', () => {
  it('sem segredo ou com segredo errado: 401; um JWT de utilizador não serve', async () => {
    assert.equal((await reconcileFn({}, null)).status, 401)
    assert.equal((await reconcileFn({}, 'segredo-errado')).status, 401)
    assert.equal((await callFn('reconcile-property-images', {}, asUser(ana.token))).status, 401)
    assert.equal((await callFn('reconcile-property-images', {}, asUser(env.serviceRoleKey))).status, 401)
  })

  it('rejeita limiares inválidos', async () => {
    assert.equal((await reconcileFn({ older_than_seconds: -1 })).status, 400)
    assert.equal((await reconcileFn({ older_than_seconds: 'x' })).status, 400)
    assert.equal((await reconcileFn({ older_than_seconds: 99999999 })).status, 400)
  })

  it('apaga reservas pending antigas (e o seu ficheiro) e órfãos; poupa o que é recente ou confirmado', async () => {
    const propertyId = await newProperty()

    const stale = await reserve(propertyId)
    assert.equal((await upload(stale.storage_path, GOOD)).error, null)
    await service.from('property_images').update({ created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString() }).eq('id', stale.id)

    const fresh = await reserve(propertyId)
    assert.equal((await upload(fresh.storage_path, GOOD)).error, null)

    const confirmed = await reserve(propertyId)
    assert.equal((await upload(confirmed.storage_path, GOOD)).error, null)
    assert.equal((await confirm(ana.token, confirmed.id)).status, 200)
    await service.from('property_images').update({ created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString() }).eq('id', confirmed.id)

    const orphan = await reserve(propertyId)
    assert.equal((await upload(orphan.storage_path, GOOD)).error, null)
    assert.equal((await confirm(ana.token, orphan.id)).status, 200)
    await service.from('property_images').delete().eq('id', orphan.id)

    const withDefault = await reconcileFn({})
    assert.equal(withDefault.status, 200)
    assert.ok(Number(withDefault.body?.['expiredReservations']) >= 1)
    assert.equal(await rowStatus(stale.id), null, 'reserva pending antiga apagada')
    assert.equal(await objectExists(stale.storage_path), false, 'e o seu ficheiro também')
    assert.equal(await rowStatus(fresh.id), 'pending', 'reserva recente poupada')
    assert.equal(await objectExists(fresh.storage_path), true)
    assert.equal(await rowStatus(confirmed.id), 'ready', 'foto confirmada nunca é apagada, por antiga que seja')
    assert.equal(await objectExists(confirmed.storage_path), true)
    assert.equal(await objectExists(orphan.storage_path), true, 'um órfão recente ainda não é apagado (pode estar a ser carregado)')

    await sleep(2000)
    const aggressive = await reconcileFn({ older_than_seconds: 1 })
    assert.equal(aggressive.status, 200)
    assert.equal(await objectExists(orphan.storage_path), false, 'órfão sem linha apagado')
    assert.equal(await rowStatus(confirmed.id), 'ready')
    assert.equal(await objectExists(confirmed.storage_path), true)

    const idempotent = await reconcileFn({ older_than_seconds: 1 })
    assert.equal(idempotent.status, 200)
    assert.equal(idempotent.body?.['orphanObjects'], 0)
  })
})
