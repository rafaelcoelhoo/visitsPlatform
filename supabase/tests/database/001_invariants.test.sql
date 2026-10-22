-- Invariantes de esquema. Valem para TODAS as tabelas/funções, presentes e futuras.
begin;
select plan(10);

select is_empty($$
  select c.relname::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
$$, 'RLS ativo em todas as tabelas de public');

select is_empty($$
  select c.relname::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attname = 'organization_id' and not a.attisdropped
  where n.nspname = 'public' and c.relkind in ('r', 'p')
    and not exists (select 1 from pg_index i where i.indrelid = c.oid and i.indkey[0] = a.attnum)
$$, 'organization_id é a 1.ª coluna de um índice em todas as tabelas tenant-scoped');

select is_empty($$
  select table_name::text || ':' || privilege_type
  from information_schema.role_table_grants
  where grantee = 'anon' and table_schema = 'public'
$$, 'anon não tem privilégios em tabelas de public');

select is_empty($$
  select privilege_type::text
  from information_schema.role_table_grants
  where grantee = 'authenticated' and table_schema = 'public' and table_name = 'audit_log'
$$, 'authenticated não tem privilégios em audit_log');

select is_empty($$
  select p.oid::regprocedure::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
$$, 'nenhuma função SECURITY DEFINER em public (schema exposto)');

select is_empty($$
  select p.oid::regprocedure::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'app')
    and not coalesce(p.proconfig, '{}') @> array['search_path=""']
$$, 'todas as funções de app/public fixam search_path vazio');

select is_empty($$
  select p.oid::regprocedure::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'app') and has_function_privilege('public', p.oid, 'execute')
$$, 'PUBLIC não tem EXECUTE em funções de app/public');

select is_empty($$
  select c.relname::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
    and not coalesce(c.reloptions, '{}') @> array['security_invoker=true']
$$, 'todas as views de public são security_invoker');

select ok(has_function_privilege('authenticated', 'app.user_org_ids()', 'execute'),
          'authenticated pode executar app.user_org_ids()');
select ok(not has_function_privilege('anon', 'app.user_org_ids()', 'execute'),
          'anon não pode executar app.user_org_ids()');

select * from finish();
rollback;
