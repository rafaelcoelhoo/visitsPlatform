begin;
select plan(24);

select tests.create_auth_user('a5000000-0000-0000-0000-000000000001', 'a@example.com');
select tests.create_auth_user('b5000000-0000-0000-0000-000000000002', 'b@example.com');
select tests.create_auth_user('c5000000-0000-0000-0000-000000000003', 'i@example.com');
select tests.create_auth_user('d5000000-0000-0000-0000-000000000004', 'x@example.com');
select app.create_consultant('a5000000-0000-0000-0000-000000000001', 'a@example.com', 'Consultor A');
select app.create_consultant('b5000000-0000-0000-0000-000000000002', 'b@example.com', 'Consultor B');
select app.create_consultant('c5000000-0000-0000-0000-000000000003', 'i@example.com', 'Consultor I');
update public.organization_members set status = 'inactive' where user_id = 'c5000000-0000-0000-0000-000000000003';

-- Comprador X: cliente ativo da org A
insert into public.clients (id, organization_id, name, email)
values ('15000000-0000-4000-8000-000000000001', tests.org_id_of('a5000000-0000-0000-0000-000000000001'), 'Cliente X', 'x@example.com');
insert into public.client_links (client_id, organization_id, user_id, status, accepted_at)
values ('15000000-0000-4000-8000-000000000001', tests.org_id_of('a5000000-0000-0000-0000-000000000001'),
        'd5000000-0000-0000-0000-000000000004', 'active', now());

insert into public.properties (id, organization_id, title, price_eur, area_m2, created_at, updated_at) values
  ('25000000-0000-4000-8000-0000000000a1', tests.org_id_of('a5000000-0000-0000-0000-000000000001'), 'Imóvel A1', 250000, 90,
   now() - interval '1 day', now() - interval '1 day'),
  ('25000000-0000-4000-8000-0000000000b1', tests.org_id_of('b5000000-0000-0000-0000-000000000002'), 'Imóvel B1', 300000, 100, now(), now()),
  ('25000000-0000-4000-8000-0000000000c1', tests.org_id_of('c5000000-0000-0000-0000-000000000003'), 'Imóvel I1', 100000, 50, now(), now());

-- Consultor A -----------------------------------------------------------------
select tests.authenticate_as('a5000000-0000-0000-0000-000000000001');

select results_eq($$ select title from public.properties $$, $$ values ('Imóvel A1'::text) $$,
  'A lê apenas os imóveis da sua org');
select is_empty($$ select 1 from public.properties where title = 'Imóvel B1' $$, 'A não lê imóveis da org B');

select lives_ok($$
  insert into public.properties (organization_id, title)
  values (tests.org_id_of('a5000000-0000-0000-0000-000000000001'), 'Só título')
$$, 'criação rápida: só o título é obrigatório');
select results_eq($$
  select price_eur is null, location_text is null, typology is null, area_m2 is null, monthly_charges_eur is null
  from public.properties where title = 'Só título'
$$, $$ values (true, true, true, true, true) $$, 'dados em falta ficam NULL, nunca 0 nem string vazia');
select results_eq($$ select created_by from public.properties where title = 'Só título' $$,
  $$ values ('a5000000-0000-0000-0000-000000000001'::uuid) $$, 'created_by é preenchido pelo servidor');

select throws_ok($$
  insert into public.properties (organization_id, title)
  values (tests.org_id_of('b5000000-0000-0000-0000-000000000002'), 'Intruso')
$$, '42501', null, 'INSERT com organization_id alheio é rejeitado (WITH CHECK)');
select throws_ok($$
  insert into public.properties (organization_id, title, created_by)
  values (tests.org_id_of('a5000000-0000-0000-0000-000000000001'), 'Forjado', 'b5000000-0000-0000-0000-000000000002')
$$, '42501', null, 'created_by não é forjável (sem grant na coluna)');
select throws_ok($$
  update public.properties set organization_id = tests.org_id_of('b5000000-0000-0000-0000-000000000002')
  where title = 'Imóvel A1'
$$, '42501', null, 'organization_id é imutável');
select throws_ok($$ delete from public.properties $$, '42501', null, 'sem DELETE direto (arquivar em vez de apagar)');

update public.properties set title = 'Pirata' where title = 'Imóvel B1';

select lives_ok($$ update public.properties set price_eur = 260000, typology = 'T3', monthly_charges_eur = 0 where title = 'Imóvel A1' $$,
  'A edita um imóvel seu (encargos 0 é um valor legítimo)');
select lives_ok($$ update public.properties set archived_at = now() where title = 'Só título' $$, 'A arquiva um imóvel seu');

select throws_ok($$ update public.properties set price_eur = 0 where title = 'Imóvel A1' $$,
  '23514', null, 'preço 0 é rejeitado (desconhecido é NULL)');
select throws_ok($$ update public.properties set area_m2 = 0 where title = 'Imóvel A1' $$,
  '23514', null, 'área 0 é rejeitada (desconhecida é NULL)');
select throws_ok($$ update public.properties set monthly_charges_eur = -1 where title = 'Imóvel A1' $$,
  '23514', null, 'encargos negativos são rejeitados');
select throws_ok($$ update public.properties set typology = 'Casa' where title = 'Imóvel A1' $$,
  '23514', null, 'tipologia inválida é rejeitada');
select throws_ok($$ update public.properties set location_text = '' where title = 'Imóvel A1' $$,
  '23514', null, 'localização em falta é NULL, nunca string vazia');
select throws_ok($$
  insert into public.properties (organization_id, title)
  values (tests.org_id_of('a5000000-0000-0000-0000-000000000001'), '   ')
$$, '23514', null, 'título em branco é rejeitado');
reset role;

select results_eq($$ select title from public.properties where id = '25000000-0000-4000-8000-0000000000b1' $$,
  $$ values ('Imóvel B1'::text) $$, 'UPDATE ao imóvel da org B não teve efeito');
select ok((select updated_at > created_at from public.properties where title = 'Imóvel A1'),
  'updated_at é atualizado pelo trigger');

-- Consultor B ------------------------------------------------------------------
select tests.authenticate_as('b5000000-0000-0000-0000-000000000002');
select results_eq($$ select title from public.properties $$, $$ values ('Imóvel B1'::text) $$,
  'B lê apenas os seus imóveis');
reset role;

-- Consultor desativado ----------------------------------------------------------
select tests.authenticate_as('c5000000-0000-0000-0000-000000000003');
select is_empty($$ select 1 from public.properties $$, 'consultor inativo não lê imóveis');
select throws_ok($$
  insert into public.properties (organization_id, title)
  values (tests.org_id_of('c5000000-0000-0000-0000-000000000003'), 'Novo')
$$, '42501', null, 'consultor inativo não cria imóveis');
reset role;

-- Comprador ligado à org A (ainda sem roteiros) -----------------------------------
select tests.authenticate_as('d5000000-0000-0000-0000-000000000004');
select is_empty($$ select 1 from public.properties $$,
  'comprador não lê imóveis só por estar ligado à org (o acesso virá com os roteiros)');
reset role;

-- anon ------------------------------------------------------------------------
select tests.as_anon();
select throws_ok($$ select * from public.properties $$, '42501', null, 'anon não lê properties');
reset role;

select * from finish();
rollback;
