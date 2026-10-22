begin;
select plan(19);

-- A e B: consultores de orgs distintas. I: consultor desativado. O: sem membership.
select tests.create_auth_user('a1000000-0000-0000-0000-000000000001', 'a@example.com');
select tests.create_auth_user('b1000000-0000-0000-0000-000000000002', 'b@example.com');
select tests.create_auth_user('c1000000-0000-0000-0000-000000000003', 'i@example.com');
select tests.create_auth_user('d1000000-0000-0000-0000-000000000004', 'o@example.com');
select app.create_consultant('a1000000-0000-0000-0000-000000000001', 'a@example.com', 'Consultor A');
select app.create_consultant('b1000000-0000-0000-0000-000000000002', 'b@example.com', 'Consultor B');
select app.create_consultant('c1000000-0000-0000-0000-000000000003', 'i@example.com', 'Consultor I');
update public.organization_members set status = 'inactive'
where user_id = 'c1000000-0000-0000-0000-000000000003';

-- Consultor A -----------------------------------------------------------------
select tests.authenticate_as('a1000000-0000-0000-0000-000000000001');

select results_eq($$ select id from public.organizations $$,
  $$ select tests.org_id_of('a1000000-0000-0000-0000-000000000001') $$,
  'A lê apenas a sua org');
select is_empty($$
  select 1 from public.organizations where id = tests.org_id_of('b1000000-0000-0000-0000-000000000002')
$$, 'A não lê a org de B');
select results_eq($$ select user_id from public.organization_members $$,
  $$ values ('a1000000-0000-0000-0000-000000000001'::uuid) $$,
  'A lê apenas a sua própria membership');

select throws_ok($$ insert into public.organizations (display_name) values ('Nova') $$,
  '42501', null, 'authenticated não cria organizações');
select throws_ok($$
  insert into public.organization_members (organization_id, user_id, role, display_name)
  values (tests.org_id_of('b1000000-0000-0000-0000-000000000002'),
          'a1000000-0000-0000-0000-000000000001', 'consultant', 'Intruso')
$$, '42501', null, 'A não se insere na org de B');
select throws_ok($$ update public.organizations set display_name = 'x' $$,
  '42501', null, 'authenticated não altera organizações');
select throws_ok($$ update public.organization_members set status = 'active' $$,
  '42501', null, 'authenticated não altera memberships (não se pode reativar)');
select throws_ok($$ delete from public.organization_members $$,
  '42501', null, 'authenticated não apaga memberships');

select throws_ok($$ select * from public.audit_log $$, '42501', null, 'audit_log ilegível');
select throws_ok($$ insert into public.audit_log (action) values ('x') $$, '42501', null, 'audit_log: sem INSERT');
select throws_ok($$ update public.audit_log set action = 'x' $$, '42501', null, 'audit_log: sem UPDATE');
select throws_ok($$ delete from public.audit_log $$, '42501', null, 'audit_log: sem DELETE');
reset role;

-- Revogação imediata (sem cache em JWT) ---------------------------------------
update public.organization_members set status = 'inactive'
where user_id = 'a1000000-0000-0000-0000-000000000001';
select tests.authenticate_as('a1000000-0000-0000-0000-000000000001');
select is_empty($$ select 1 from public.organizations $$,
  'desativar A corta o acesso imediatamente, com o mesmo JWT');
reset role;

-- Consultor desativado --------------------------------------------------------
select tests.authenticate_as('c1000000-0000-0000-0000-000000000003');
select is_empty($$ select 1 from public.organizations $$, 'consultor inativo não lê a org');
select results_eq($$ select status from public.organization_members $$,
  $$ values ('inactive'::text) $$, 'consultor inativo vê só a própria linha (estado inactive)');
select is((select app.user_org_ids()), '{}'::uuid[], 'user_org_ids() vazio para consultor inativo');
reset role;

-- Utilizador sem membership ---------------------------------------------------
select tests.authenticate_as('d1000000-0000-0000-0000-000000000004');
select is_empty($$ select table_name from tests.visible_row_counts() where row_count > 0 $$,
  'utilizador sem membership lê 0 linhas em todas as tabelas de public');
reset role;

-- anon ------------------------------------------------------------------------
select tests.as_anon();
select throws_ok($$ select * from public.organizations $$, '42501', null, 'anon não lê organizations');
select is_empty($$ select table_name from tests.visible_row_counts() where row_count > 0 $$,
  'anon lê 0 linhas em todas as tabelas de public');
reset role;

select * from finish();
rollback;
