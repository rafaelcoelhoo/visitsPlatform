begin;
select plan(35);

-- Consultores: A, B, C. Compradores: X (em A e B), Y (em A), R (ligação revogada em A).
select tests.create_auth_user('a4000000-0000-0000-0000-000000000001', 'a@example.com');
select tests.create_auth_user('b4000000-0000-0000-0000-000000000002', 'b@example.com');
select tests.create_auth_user('c4000000-0000-0000-0000-000000000003', 'c@example.com');
select tests.create_auth_user('d4000000-0000-0000-0000-000000000004', 'x@example.com');
select tests.create_auth_user('e4000000-0000-0000-0000-000000000005', 'y@example.com');
select tests.create_auth_user('f4000000-0000-0000-0000-000000000006', 'r@example.com');
select app.create_consultant('a4000000-0000-0000-0000-000000000001', 'a@example.com', 'Consultor A');
select app.create_consultant('b4000000-0000-0000-0000-000000000002', 'b@example.com', 'Consultor B');
select app.create_consultant('c4000000-0000-0000-0000-000000000003', 'c@example.com', 'Consultor C');
insert into public.user_profiles (user_id, display_name)
values ('d4000000-0000-0000-0000-000000000004', 'Comprador X');

insert into public.clients (id, organization_id, name, email) values
  ('10000000-0000-4000-8000-000000000001', tests.org_id_of('a4000000-0000-0000-0000-000000000001'), 'Cliente X (A)', 'x@example.com'),
  ('10000000-0000-4000-8000-000000000002', tests.org_id_of('a4000000-0000-0000-0000-000000000001'), 'Cliente Y (A)', 'y@example.com'),
  ('10000000-0000-4000-8000-000000000003', tests.org_id_of('a4000000-0000-0000-0000-000000000001'), 'Cliente R (A)', 'r@example.com'),
  ('10000000-0000-4000-8000-000000000004', tests.org_id_of('a4000000-0000-0000-0000-000000000001'), 'Cliente Convidado (A)', 'convidado@example.com'),
  ('10000000-0000-4000-8000-000000000005', tests.org_id_of('b4000000-0000-0000-0000-000000000002'), 'Cliente X (B)', 'x@example.com'),
  ('10000000-0000-4000-8000-000000000006', tests.org_id_of('b4000000-0000-0000-0000-000000000002'), 'Consultor A como comprador (B)', 'a@example.com');

insert into public.client_links (client_id, organization_id, user_id, status, accepted_at) values
  ('10000000-0000-4000-8000-000000000001', tests.org_id_of('a4000000-0000-0000-0000-000000000001'), 'd4000000-0000-0000-0000-000000000004', 'active', now()),
  ('10000000-0000-4000-8000-000000000002', tests.org_id_of('a4000000-0000-0000-0000-000000000001'), 'e4000000-0000-0000-0000-000000000005', 'active', now()),
  ('10000000-0000-4000-8000-000000000003', tests.org_id_of('a4000000-0000-0000-0000-000000000001'), 'f4000000-0000-0000-0000-000000000006', 'revoked', now()),
  ('10000000-0000-4000-8000-000000000005', tests.org_id_of('b4000000-0000-0000-0000-000000000002'), 'd4000000-0000-0000-0000-000000000004', 'active', now()),
  ('10000000-0000-4000-8000-000000000006', tests.org_id_of('b4000000-0000-0000-0000-000000000002'), 'a4000000-0000-0000-0000-000000000001', 'active', now());
insert into public.client_links (client_id, organization_id, status) values
  ('10000000-0000-4000-8000-000000000004', tests.org_id_of('a4000000-0000-0000-0000-000000000001'), 'invited');

-- Comprador X (cliente em A e em B) -----------------------------------------------
select tests.authenticate_as('d4000000-0000-0000-0000-000000000004');

select results_eq($$ select name from public.clients order by name $$,
  $$ values ('Cliente X (A)'::text), ('Cliente X (B)'::text) $$,
  'X lê apenas os seus próprios registos de cliente, nas duas orgs');
select is_empty($$ select 1 from public.clients where email = 'y@example.com' $$,
  'X não lê os dados de outro cliente da mesma org');
select results_eq($$ select display_name from public.organizations order by display_name $$,
  $$ values ('Consultor A'::text), ('Consultor B'::text) $$,
  'X lê o display_name das duas orgs onde está ligado (seletor)');
select is_empty($$
  select 1 from public.organizations where id = tests.org_id_of('c4000000-0000-0000-0000-000000000003')
$$, 'X não lê a org C (sem ligação)');
select results_eq($$ select display_name from public.organization_members order by display_name $$,
  $$ values ('Consultor A'::text), ('Consultor B'::text) $$,
  'X lê o nome do consultor das orgs onde está ligado');
select is_empty($$
  select 1 from public.organization_members where user_id = 'c4000000-0000-0000-0000-000000000003'
$$, 'X não lê o consultor da org C');
select results_eq($$ select count(*)::int from public.client_links $$, array[2],
  'X lê apenas as suas 2 ligações');

select throws_ok($$
  insert into public.clients (organization_id, name, email)
  values (tests.org_id_of('a4000000-0000-0000-0000-000000000001'), 'Falso', 'falso@example.com')
$$, '42501', null, 'comprador não cria clientes na org onde está ligado');
update public.clients set name = 'Adulterado';
delete from public.clients;
select throws_ok($$
  insert into public.client_links (client_id, organization_id, user_id, status, accepted_at)
  values ('10000000-0000-4000-8000-000000000004', tests.org_id_of('a4000000-0000-0000-0000-000000000001'),
          'd4000000-0000-0000-0000-000000000004', 'active', now())
$$, '42501', null, 'comprador não cria ligações');
select throws_ok($$ update public.client_links set status = 'revoked' $$,
  '42501', null, 'comprador não altera o estado da ligação (sem grant)');
select throws_ok($$ update public.client_links set user_id = 'e4000000-0000-0000-0000-000000000005' $$,
  '42501', null, 'comprador não reatribui a ligação (sem grant)');
select throws_ok($$ delete from public.client_links $$, '42501', null, 'comprador não apaga ligações');
select lives_ok($$ update public.client_links set last_seen_at = now() $$,
  'comprador regista last_seen_at nas suas ligações');
reset role;

select results_eq($$ select name from public.clients where id = '10000000-0000-4000-8000-000000000001' $$,
  $$ values ('Cliente X (A)'::text) $$, 'UPDATE/DELETE de clients pelo comprador não teve efeito');
select results_eq($$
  select count(*)::int from public.client_links where last_seen_at is not null
$$, array[2], 'last_seen_at atualizado só nas 2 ligações de X');

-- Revogação imediata (mesmo JWT) ------------------------------------------------
update public.client_links set status = 'revoked'
where client_id = '10000000-0000-4000-8000-000000000005';
select tests.authenticate_as('d4000000-0000-0000-0000-000000000004');
select results_eq($$ select display_name from public.organizations $$, $$ values ('Consultor A'::text) $$,
  'revogar a ligação a B corta o acesso à org B imediatamente');
select results_eq($$ select count(*)::int from public.clients $$, array[1],
  'e deixa de ler o registo de cliente em B');
reset role;

-- Comprador Y ------------------------------------------------------------------
select tests.authenticate_as('e4000000-0000-0000-0000-000000000005');
select results_eq($$ select name from public.clients $$, $$ values ('Cliente Y (A)'::text) $$,
  'Y lê apenas o seu registo');
select results_eq($$ select display_name from public.organizations $$, $$ values ('Consultor A'::text) $$,
  'Y lê apenas a org A');
reset role;

-- Comprador com ligação revogada ---------------------------------------------------
select tests.authenticate_as('f4000000-0000-0000-0000-000000000006');
select is_empty($$ select 1 from public.organizations $$, 'ligação revogada: não lê organizations');
select is_empty($$ select 1 from public.organization_members $$, 'ligação revogada: não lê membros');
select is_empty($$ select 1 from public.clients $$, 'ligação revogada: não lê o seu registo de cliente');
select is_empty($$ select 1 from public.client_links $$, 'ligação revogada: não lê ligações');
reset role;

-- Consultor A (também comprador em B) ----------------------------------------------
select tests.authenticate_as('a4000000-0000-0000-0000-000000000001');
select results_eq($$
  select count(*)::int from public.client_links where organization_id = tests.org_id_of('a4000000-0000-0000-0000-000000000001')
$$, array[4], 'A lê as 4 ligações da sua org');
select results_eq($$
  select count(*)::int from public.client_links where organization_id = tests.org_id_of('b4000000-0000-0000-0000-000000000002')
$$, array[1], 'em B, A lê só a ligação em que é comprador, não as de outros clientes de B');
select results_eq($$ select count(*)::int from public.organizations $$, array[2],
  'A lê as orgs onde é consultor e onde é comprador');
select results_eq($$
  select count(*)::int from public.clients where organization_id = tests.org_id_of('a4000000-0000-0000-0000-000000000001')
$$, array[4], 'A lê os 4 clientes da sua org');
select is_empty($$ select 1 from public.user_profiles where user_id = 'd4000000-0000-0000-0000-000000000004' $$,
  'consultor com cliente ligado não lê o user_profiles desse cliente');
select throws_ok($$
  insert into public.client_links (client_id, organization_id, status)
  values ('10000000-0000-4000-8000-000000000003', tests.org_id_of('a4000000-0000-0000-0000-000000000001'), 'invited')
$$, '42501', null, 'consultor não cria ligações (só Edge Function/service_role)');
select throws_ok($$ update public.client_links set status = 'active' $$,
  '42501', null, 'consultor não altera ligações');
select throws_ok($$ delete from public.client_links $$, '42501', null, 'consultor não apaga ligações');
reset role;

-- Constraints (como owner) ----------------------------------------------------------
select throws_ok($$
  insert into public.clients (id, organization_id, name, email)
  values ('10000000-0000-4000-8000-000000000008', tests.org_id_of('a4000000-0000-0000-0000-000000000001'), 'Sem ligação', 'sem-ligacao@example.com');
  insert into public.client_links (client_id, organization_id, status)
  values ('10000000-0000-4000-8000-000000000008', tests.org_id_of('b4000000-0000-0000-0000-000000000002'), 'invited')
$$, '23503', null, 'FK composta: a ligação não pode apontar para outra org que a do cliente');
select throws_ok($$
  insert into public.clients (organization_id, name, email)
  values (tests.org_id_of('a4000000-0000-0000-0000-000000000001'), 'Sem user', 'semuser@example.com');
  insert into public.client_links (client_id, organization_id, status, accepted_at)
  select id, organization_id, 'active', now() from public.clients where email = 'semuser@example.com'
$$, '23514', null, 'ligação ativa exige user_id');
select throws_ok($$
  insert into public.clients (id, organization_id, name, email)
  values ('10000000-0000-4000-8000-000000000007', tests.org_id_of('a4000000-0000-0000-0000-000000000001'), 'Y duplicado', 'y2@example.com');
  insert into public.client_links (client_id, organization_id, user_id, status, accepted_at)
  values ('10000000-0000-4000-8000-000000000007', tests.org_id_of('a4000000-0000-0000-0000-000000000001'),
          'e4000000-0000-0000-0000-000000000005', 'active', now())
$$, '23505', null, 'uma conta é no máximo um cliente por organização');

-- Eliminar a conta remove a ligação mas não o registo da organização -----------------
delete from auth.users where id = 'd4000000-0000-0000-0000-000000000004';
select results_eq($$
  select
    (select count(*)::int from public.client_links where user_id = 'd4000000-0000-0000-0000-000000000004'),
    (select count(*)::int from public.clients where email = 'x@example.com')
$$, $$ values (0, 2) $$, 'eliminar a conta apaga as ligações; o registo de cliente da org mantém-se');

select * from finish();
rollback;
