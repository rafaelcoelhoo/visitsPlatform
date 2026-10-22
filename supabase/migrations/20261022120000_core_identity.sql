-- =============================================================================
-- 20261022120000_core_identity
-- organizations, organization_members, user_profiles, audit_log
-- app.user_org_ids(), app.create_consultant(), public.admin_create_consultant()
--
-- Invariante do MVP: um consultor = uma organização
--   (índice único em organization_members(user_id)).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Schema privado para funções. NÃO está em [api].schemas -> não é RPC pública.
-- -----------------------------------------------------------------------------
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- O Postgres concede EXECUTE a PUBLIC por omissão. Desligar para funções futuras.
alter default privileges in schema app revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public, anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------
create table public.organizations (
  id           uuid primary key default gen_random_uuid(),
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  created_by   uuid references auth.users (id) on delete set null,  -- auditoria apenas
  created_at   timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            text not null check (role in ('consultant')),
  status          text not null default 'active' check (status in ('active', 'inactive')),
  display_name    text not null check (length(btrim(display_name)) between 1 and 120),
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)  -- índice com organization_id como 1.ª coluna
);

-- Invariante MVP + chave de idempotência de app.create_consultant().
-- Remover na Fase 3 (equipas / várias orgs por utilizador).
create unique index organization_members_one_org_per_user_uidx
  on public.organization_members (user_id);

-- Suporta app.user_org_ids() (index-only scan).
create index organization_members_active_user_idx
  on public.organization_members (user_id) include (organization_id)
  where status = 'active';

create table public.user_profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or length(btrim(display_name)) between 1 and 120),
  avatar_url   text,
  locale       text not null default 'pt-PT' check (locale in ('pt-PT')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Append-only. Só ids: sem jsonb livre, para não acumular dados pessoais por descuido.
create table public.audit_log (
  id              bigint generated always as identity primary key,
  organization_id uuid references public.organizations (id) on delete set null,
  actor_user_id   uuid,  -- sem FK: id pseudónimo que sobrevive à eliminação; NULL = sistema/admin
  action          text not null check (length(action) between 1 and 80),
  target_table    text,
  target_id       uuid,
  created_at      timestamptz not null default now()
);
create index audit_log_organization_id_idx on public.audit_log (organization_id);

-- -----------------------------------------------------------------------------
-- Funções
-- -----------------------------------------------------------------------------
create function app.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end
$$;

create trigger user_profiles_touch_updated_at
  before update on public.user_profiles
  for each row execute function app.touch_updated_at();

-- Lookup em tabela (não JWT) -> revogação de acesso imediata.
-- SECURITY DEFINER: lê organization_members sem passar pelo RLS dessa tabela.
create function app.user_org_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(pg_catalog.array_agg(m.organization_id), '{}')
  from public.organization_members m
  where m.user_id = (select auth.uid())
    and m.status = 'active'
$$;

-- Onboarding de consultor. Único caminho de criação de orgs (admin agora, signup público depois).
-- Idempotente por user_id. Nunca lê raw_user_meta_data. Nunca reativa um membro inativo.
create function app.create_consultant(
  p_user_id          uuid,
  p_email            text,
  p_display_name     text,
  p_org_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  -- Verificação de consistência: protege contra um script a correr com o id errado.
  if not exists (
    select 1 from auth.users u
    where u.id = p_user_id
      and pg_catalog.lower(u.email) = pg_catalog.lower(pg_catalog.btrim(p_email))
  ) then
    raise exception 'create_consultant: user_id/email mismatch' using errcode = '22023';
  end if;

  -- Serializa chamadas concorrentes para o mesmo utilizador.
  -- O índice único em organization_members(user_id) é a segunda linha de defesa.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('app.create_consultant:' || p_user_id::text, 0)
  );

  select m.organization_id into v_org_id
  from public.organization_members m
  where m.user_id = p_user_id;

  if v_org_id is null then
    insert into public.organizations (display_name, created_by)
    values (coalesce(p_org_display_name, p_display_name), p_user_id)
    returning id into v_org_id;

    insert into public.organization_members (organization_id, user_id, role, status, display_name)
    values (v_org_id, p_user_id, 'consultant', 'active', p_display_name);

    insert into public.audit_log (organization_id, actor_user_id, action, target_table, target_id)
    values (v_org_id, (select auth.uid()), 'consultant.created', 'organizations', v_org_id);
  end if;

  insert into public.user_profiles (user_id, display_name)
  values (p_user_id, p_display_name)
  on conflict (user_id) do nothing;

  return v_org_id;
end
$$;

-- Ponto de entrada RPC para o script de admin. INVOKER: o service_role já ignora RLS.
create function public.admin_create_consultant(
  p_user_id          uuid,
  p_email            text,
  p_display_name     text,
  p_org_display_name text default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select app.create_consultant(p_user_id, p_email, p_display_name, p_org_display_name)
$$;

-- -----------------------------------------------------------------------------
-- Privilégios de funções (explícitos, além dos default privileges)
-- -----------------------------------------------------------------------------
revoke execute on function app.touch_updated_at() from public, anon, authenticated;
revoke execute on function app.user_org_ids() from public, anon;
revoke execute on function app.create_consultant(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.admin_create_consultant(uuid, text, text, text) from public, anon, authenticated;

grant execute on function app.user_org_ids() to authenticated;
grant execute on function app.create_consultant(uuid, text, text, text) to service_role;
grant execute on function public.admin_create_consultant(uuid, text, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- Privilégios de tabelas (mínimo necessário; o RLS é a segunda camada)
-- -----------------------------------------------------------------------------
revoke all on public.organizations, public.organization_members,
              public.user_profiles, public.audit_log
  from anon, authenticated;
revoke all on sequence public.audit_log_id_seq from anon, authenticated;

grant select on public.organizations, public.organization_members to authenticated;
grant select, update (display_name, avatar_url, locale) on public.user_profiles to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.organizations        enable row level security;
alter table public.organization_members enable row level security;
alter table public.user_profiles        enable row level security;
alter table public.audit_log            enable row level security;  -- zero políticas = sem acesso

-- Só leitura: o Postgres não aceita WITH CHECK em políticas FOR SELECT.
-- As escritas ficam negadas por falta de política e de grant (provado nos testes).
create policy organizations_select_member on public.organizations
  for select to authenticated
  using ( id = any ((select app.user_org_ids())::uuid[]) );

-- Só self-read. Não chama app.user_org_ids() (evita recursão 42P17).
-- Um membro inativo continua a ver a própria linha -> UI "acesso desativado".
create policy organization_members_select_self on public.organization_members
  for select to authenticated
  using ( user_id = (select auth.uid()) );

-- Perfil global: só o próprio. INSERT/DELETE bloqueados por grants.
create policy user_profiles_own on public.user_profiles
  for all to authenticated
  using      ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );
