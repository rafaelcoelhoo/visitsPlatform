-- =============================================================================
-- 20261022150000_clients
-- clients (o cliente DENTRO de uma org), client_links (clients.id <-> user_id)
-- app.user_client_ids(), app.user_client_org_ids()
-- Políticas para o comprador ler a org e o nome do consultor com ligação ativa.
-- =============================================================================

create extension if not exists citext with schema extensions;

-- Novas tabelas não herdam grants implícitos: tudo é explícito.
alter default privileges in schema public revoke all on tables from authenticated;

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------
-- Registo da organização sobre uma pessoa (não é a pessoa: essa é auth.users/user_profiles).
create table public.clients (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (length(btrim(name)) between 1 and 120),
  email           extensions.citext not null check (length(email::text) <= 254 and position('@' in email::text) > 1),
  phone           text check (phone is null or length(btrim(phone)) between 3 and 30),
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (organization_id, email),   -- também é o índice de organization_id
  unique (id, organization_id)       -- alvo da FK composta de client_links
);

-- Relação conta <-> cliente. user_id só é preenchido quando o convite é aceite.
-- Escrita só por service_role / Edge Function (convite, aceitação, revogação).
create table public.client_links (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null,
  organization_id uuid not null,
  user_id         uuid references auth.users (id) on delete cascade,
  status          text not null default 'invited' check (status in ('invited', 'active', 'revoked')),
  accepted_at     timestamptz,
  last_seen_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (client_id),
  foreign key (client_id, organization_id)
    references public.clients (id, organization_id) on delete cascade,
  check (status <> 'active' or (user_id is not null and accepted_at is not null))
);

create index client_links_organization_id_idx on public.client_links (organization_id);
-- Uma conta é no máximo um cliente por organização.
create unique index client_links_org_user_uidx
  on public.client_links (organization_id, user_id) where user_id is not null;
-- Suporta as funções app.user_client_*_ids() (index-only scan).
create index client_links_active_user_idx
  on public.client_links (user_id) include (client_id, organization_id) where status = 'active';

-- -----------------------------------------------------------------------------
-- Funções (lookup em tabela -> revogação imediata)
-- -----------------------------------------------------------------------------
create function app.user_client_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(pg_catalog.array_agg(l.client_id), '{}')
  from public.client_links l
  where l.user_id = (select auth.uid())
    and l.status = 'active'
$$;

create function app.user_client_org_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(pg_catalog.array_agg(l.organization_id), '{}')
  from public.client_links l
  where l.user_id = (select auth.uid())
    and l.status = 'active'
$$;

revoke execute on function app.user_client_ids() from public, anon;
revoke execute on function app.user_client_org_ids() from public, anon;
grant execute on function app.user_client_ids() to authenticated;
grant execute on function app.user_client_org_ids() to authenticated;

-- -----------------------------------------------------------------------------
-- Privilégios
-- -----------------------------------------------------------------------------
revoke all on public.clients, public.client_links from anon, authenticated;

-- organization_id é imutável depois de criado (sem grant de UPDATE na coluna).
grant select, delete on public.clients to authenticated;
grant insert (organization_id, name, email, phone) on public.clients to authenticated;
grant update (name, email, phone, archived_at) on public.clients to authenticated;

-- Membros e clientes só leem. O cliente só atualiza last_seen_at.
grant select on public.client_links to authenticated;
grant update (last_seen_at) on public.client_links to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.clients      enable row level security;
alter table public.client_links enable row level security;

create policy clients_org_members on public.clients
  for all to authenticated
  using      ( organization_id = any ((select app.user_org_ids())::uuid[]) )
  with check ( organization_id = any ((select app.user_org_ids())::uuid[]) );

-- O comprador lê o seu próprio registo (o que o consultor escreveu sobre ele).
create policy clients_select_own on public.clients
  for select to authenticated
  using ( id = any ((select app.user_client_ids())::uuid[]) );

create policy client_links_select_org_members on public.client_links
  for select to authenticated
  using ( organization_id = any ((select app.user_org_ids())::uuid[]) );

create policy client_links_select_own on public.client_links
  for select to authenticated
  using ( user_id = (select auth.uid()) and status = 'active' );

create policy client_links_update_own_last_seen on public.client_links
  for update to authenticated
  using      ( user_id = (select auth.uid()) and status = 'active' )
  with check ( user_id = (select auth.uid()) and status = 'active' );

-- Identidade do consultor vista pelo comprador: só nas orgs com ligação ativa.
-- Políticas permissivas somam-se (OR) às de membros definidas na migração anterior.
create policy organizations_select_client on public.organizations
  for select to authenticated
  using ( id = any ((select app.user_client_org_ids())::uuid[]) );

create policy organization_members_select_client on public.organization_members
  for select to authenticated
  using ( status = 'active'
          and organization_id = any ((select app.user_client_org_ids())::uuid[]) );
