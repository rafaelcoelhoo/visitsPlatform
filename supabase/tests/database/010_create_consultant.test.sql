begin;
select plan(17);

select tests.create_auth_user('a0000000-0000-0000-0000-000000000001', 'ana@example.com');
select tests.create_auth_user('b0000000-0000-0000-0000-000000000002', 'joao@example.com');
select tests.create_auth_user('c0000000-0000-0000-0000-000000000003', 'rita@example.com');

-- Criação ---------------------------------------------------------------------
select lives_ok($$
  select app.create_consultant('a0000000-0000-0000-0000-000000000001', 'Ana@Example.com ',
                               'Ana Silva', 'Ana Silva Imobiliária')
$$, 'create_consultant cria consultor (email sem distinção de maiúsculas/espaços)');

select results_eq($$
  select role, status, display_name from public.organization_members
  where user_id = 'a0000000-0000-0000-0000-000000000001'
$$, $$ values ('consultant'::text, 'active'::text, 'Ana Silva'::text) $$,
  'consultor tem exatamente uma membership consultant/active');

select results_eq($$
  select o.display_name, o.created_by from public.organizations o
  where o.id = tests.org_id_of('a0000000-0000-0000-0000-000000000001')
$$, $$ values ('Ana Silva Imobiliária'::text, 'a0000000-0000-0000-0000-000000000001'::uuid) $$,
  'org criada com display_name e created_by');

select results_eq($$
  select display_name from public.user_profiles where user_id = 'a0000000-0000-0000-0000-000000000001'
$$, $$ values ('Ana Silva'::text) $$, 'user_profiles criado');

select results_eq($$
  select count(*)::int from public.audit_log
  where action = 'consultant.created'
    and target_id = tests.org_id_of('a0000000-0000-0000-0000-000000000001')
$$, array[1], 'criação registada em audit_log');

-- Idempotência ----------------------------------------------------------------
select is(
  app.create_consultant('a0000000-0000-0000-0000-000000000001', 'ana@example.com', 'Ana Silva'),
  tests.org_id_of('a0000000-0000-0000-0000-000000000001'),
  'segunda chamada devolve a mesma org'
);

select results_eq($$
  select
    (select count(*)::int from public.organizations where created_by = 'a0000000-0000-0000-0000-000000000001'),
    (select count(*)::int from public.organization_members where user_id = 'a0000000-0000-0000-0000-000000000001'),
    (select count(*)::int from public.user_profiles where user_id = 'a0000000-0000-0000-0000-000000000001'),
    (select count(*)::int from public.audit_log where action = 'consultant.created'
       and target_id = tests.org_id_of('a0000000-0000-0000-0000-000000000001'))
$$, $$ values (1, 1, 1, 1) $$, 'segunda chamada não duplica org, membro, perfil nem audit');

update public.organization_members set status = 'inactive'
where user_id = 'a0000000-0000-0000-0000-000000000001';
select app.create_consultant('a0000000-0000-0000-0000-000000000001', 'ana@example.com', 'Ana Silva');
select results_eq($$
  select status from public.organization_members where user_id = 'a0000000-0000-0000-0000-000000000001'
$$, $$ values ('inactive'::text) $$, 'nova chamada NÃO reativa um membro desativado');

-- Validação -------------------------------------------------------------------
select throws_ok($$
  select app.create_consultant('a0000000-0000-0000-0000-000000000001', 'outra@example.com', 'X')
$$, '22023', null, 'email que não coincide com o user_id é rejeitado');

select throws_ok($$
  select app.create_consultant('ffffffff-ffff-ffff-ffff-ffffffffffff', 'ana@example.com', 'X')
$$, '22023', null, 'user_id inexistente é rejeitado');

select throws_ok($$
  select app.create_consultant('c0000000-0000-0000-0000-000000000003', 'rita@example.com', '   ')
$$, '23514', null, 'display_name em branco é rejeitado (check constraint)');

select is_empty($$
  select 1 from public.organizations where created_by = 'c0000000-0000-0000-0000-000000000003'
$$, 'falha a meio não deixa org órfã (transação atómica)');

-- Permissões de execução ------------------------------------------------------
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select throws_ok($$
  select public.admin_create_consultant('b0000000-0000-0000-0000-000000000002', 'joao@example.com', 'João')
$$, '42501', null, 'authenticated não executa admin_create_consultant');
select throws_ok($$
  select app.create_consultant('b0000000-0000-0000-0000-000000000002', 'joao@example.com', 'João')
$$, '42501', null, 'authenticated não executa app.create_consultant');
reset role;

select tests.as_anon();
select throws_ok($$
  select public.admin_create_consultant('b0000000-0000-0000-0000-000000000002', 'joao@example.com', 'João')
$$, '42501', null, 'anon não executa admin_create_consultant');
reset role;

set local role service_role;
select lives_ok($$
  select public.admin_create_consultant('b0000000-0000-0000-0000-000000000002', 'joao@example.com',
                                        'João Pereira')
$$, 'service_role executa admin_create_consultant');
reset role;

select results_eq($$
  select count(*)::int from public.organization_members
  where user_id = 'b0000000-0000-0000-0000-000000000002' and role = 'consultant' and status = 'active'
$$, array[1], 'consultor criado via service_role tem membership ativa');

select * from finish();
rollback;
