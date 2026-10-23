begin;
select plan(19);

select tests.create_auth_user('a3000000-0000-0000-0000-000000000001', 'a@example.com');
select tests.create_auth_user('b3000000-0000-0000-0000-000000000002', 'b@example.com');
select tests.create_auth_user('c3000000-0000-0000-0000-000000000003', 'i@example.com');
select app.create_consultant('a3000000-0000-0000-0000-000000000001', 'a@example.com', 'Consultor A');
select app.create_consultant('b3000000-0000-0000-0000-000000000002', 'b@example.com', 'Consultor B');
select app.create_consultant('c3000000-0000-0000-0000-000000000003', 'i@example.com', 'Consultor I');

insert into public.clients (organization_id, name, email) values
  (tests.org_id_of('a3000000-0000-0000-0000-000000000001'), 'Cliente A1', 'a1@example.com'),
  (tests.org_id_of('b3000000-0000-0000-0000-000000000002'), 'Cliente B1', 'b1@example.com'),
  (tests.org_id_of('c3000000-0000-0000-0000-000000000003'), 'Cliente I1', 'i1@example.com');
update public.organization_members set status = 'inactive'
where user_id = 'c3000000-0000-0000-0000-000000000003';

-- Consultor A ------------------------------------------------------------------
select tests.authenticate_as('a3000000-0000-0000-0000-000000000001');

select results_eq($$ select name from public.clients $$, $$ values ('Cliente A1'::text) $$,
  'A lê apenas os clientes da sua org');
select is_empty($$ select 1 from public.clients where email = 'b1@example.com' $$,
  'A não lê clientes da org B');

select lives_ok($$
  insert into public.clients (organization_id, name, email, phone)
  values (tests.org_id_of('a3000000-0000-0000-0000-000000000001'), 'Cliente A2', 'a2@example.com', null)
$$, 'A cria cliente na sua org com nome + email');
select throws_ok($$
  insert into public.clients (organization_id, name, email)
  values (tests.org_id_of('b3000000-0000-0000-0000-000000000002'), 'Intruso', 'intruso@example.com')
$$, '42501', null, 'INSERT com organization_id alheio é rejeitado (WITH CHECK)');
select throws_ok($$
  update public.clients set organization_id = tests.org_id_of('b3000000-0000-0000-0000-000000000002')
  where email = 'a1@example.com'
$$, '42501', null, 'organization_id é imutável (sem grant de UPDATE na coluna)');

update public.clients set name = 'Pirata' where email = 'b1@example.com';
delete from public.clients where email = 'b1@example.com';

select lives_ok($$ update public.clients set name = 'Cliente A1 Editado' where email = 'a1@example.com' $$,
  'A edita um cliente seu');
select throws_ok($$ update public.clients set email = 'A2@Example.com' where email = 'a1@example.com' $$,
  '23505', null, 'email duplicado na mesma org é rejeitado, sem distinção de maiúsculas');
select throws_ok($$
  insert into public.clients (organization_id, name, email)
  values (tests.org_id_of('a3000000-0000-0000-0000-000000000001'), 'Outro', 'A1@EXAMPLE.COM')
$$, '23505', null, 'INSERT duplicado (maiúsculas diferentes) é rejeitado');
select throws_ok($$
  insert into public.clients (organization_id, name, email)
  values (tests.org_id_of('a3000000-0000-0000-0000-000000000001'), '   ', 'x@example.com')
$$, '23514', null, 'nome em branco é rejeitado');
select throws_ok($$
  insert into public.clients (organization_id, name, email, phone)
  values (tests.org_id_of('a3000000-0000-0000-0000-000000000001'), 'Sem Telefone', 'y@example.com', '')
$$, '23514', null, 'telefone em falta é NULL, nunca string vazia');
select throws_ok($$
  insert into public.clients (organization_id, name, email)
  values (tests.org_id_of('a3000000-0000-0000-0000-000000000001'), 'Sem Arroba', 'sem-arroba')
$$, '23514', null, 'email sem @ é rejeitado');
select lives_ok($$ delete from public.clients where email = 'a2@example.com' $$, 'A apaga um cliente seu');
reset role;

select results_eq($$ select name from public.clients where email = 'b1@example.com' $$,
  $$ values ('Cliente B1'::text) $$, 'UPDATE/DELETE ao cliente da org B não tiveram efeito');

-- A mesma pessoa (email) pode ser cliente em duas orgs ------------------------------
select tests.authenticate_as('b3000000-0000-0000-0000-000000000002');
select lives_ok($$
  insert into public.clients (organization_id, name, email)
  values (tests.org_id_of('b3000000-0000-0000-0000-000000000002'), 'Cliente A1 em B', 'a1@example.com')
$$, 'o mesmo email pode existir em orgs diferentes');
select results_eq($$ select count(*)::int from public.clients $$, array[2],
  'B lê apenas os seus 2 clientes');
reset role;

-- Consultor desativado --------------------------------------------------------
select tests.authenticate_as('c3000000-0000-0000-0000-000000000003');
select is_empty($$ select 1 from public.clients $$, 'consultor inativo não lê clientes');
select throws_ok($$
  insert into public.clients (organization_id, name, email)
  values (tests.org_id_of('c3000000-0000-0000-0000-000000000003'), 'Novo', 'novo@example.com')
$$, '42501', null, 'consultor inativo não cria clientes');
reset role;

-- anon ------------------------------------------------------------------------
select tests.as_anon();
select throws_ok($$ select * from public.clients $$, '42501', null, 'anon não lê clients');
select throws_ok($$ select * from public.client_links $$, '42501', null, 'anon não lê client_links');
reset role;

select * from finish();
rollback;
