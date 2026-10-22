-- Helpers de teste. Ficam no schema `tests`, que só existe na base local/CI
-- (nunca está em migrações). Criados fora de transação para ficarem disponíveis
-- aos ficheiros seguintes (executados por ordem alfabética).

create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

-- Cria um utilizador em auth.users com id determinístico.
create or replace function tests.create_auth_user(p_id uuid, p_email text)
returns uuid
language plpgsql
as $$
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          p_email, '{}'::jsonb, '{}'::jsonb, now(), now());
  return p_id;
end
$$;

-- Simula um pedido PostgREST autenticado (role + claims do JWT), até ao fim da transação.
create or replace function tests.authenticate_as(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
end
$$;

create or replace function tests.as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end
$$;

-- Org de um utilizador, para usar em asserções feitas como `authenticated`
-- (que não consegue resolver ids de outras orgs).
create or replace function tests.org_id_of(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id from public.organization_members where user_id = p_user_id
$$;

-- Conta as linhas visíveis ao role atual em TODAS as tabelas de public.
-- Sem privilégio de SELECT conta como 0 (não consegue ler).
-- Cobre automaticamente as tabelas acrescentadas em migrações futuras.
create or replace function tests.visible_row_counts()
returns table (table_name text, row_count bigint)
language plpgsql
as $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
    order by c.relname
  loop
    table_name := r.relname;
    if has_table_privilege(format('public.%I', r.relname), 'select') then
      execute format('select count(*) from public.%I', r.relname) into row_count;
    else
      row_count := 0;
    end if;
    return next;
  end loop;
end
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

begin;
select plan(1);
select has_function('tests', 'authenticate_as', array['uuid'], 'helpers de teste instalados');
select * from finish();
rollback;
