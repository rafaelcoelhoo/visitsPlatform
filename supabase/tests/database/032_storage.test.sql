begin;
select plan(16);

select tests.create_auth_user('a7000000-0000-0000-0000-000000000001', 'a@example.com');
select tests.create_auth_user('b7000000-0000-0000-0000-000000000002', 'b@example.com');
select tests.create_auth_user('c7000000-0000-0000-0000-000000000003', 'i@example.com');
select tests.create_auth_user('d7000000-0000-0000-0000-000000000004', 'x@example.com');
select app.create_consultant('a7000000-0000-0000-0000-000000000001', 'a@example.com', 'Consultor A');
select app.create_consultant('b7000000-0000-0000-0000-000000000002', 'b@example.com', 'Consultor B');
select app.create_consultant('c7000000-0000-0000-0000-000000000003', 'i@example.com', 'Consultor I');

insert into public.clients (id, organization_id, name, email)
values ('17000000-0000-4000-8000-000000000001', tests.org_id_of('a7000000-0000-0000-0000-000000000001'), 'Cliente X', 'x@example.com');
insert into public.client_links (client_id, organization_id, user_id, status, accepted_at)
values ('17000000-0000-4000-8000-000000000001', tests.org_id_of('a7000000-0000-0000-0000-000000000001'),
        'd7000000-0000-0000-0000-000000000004', 'active', now());

insert into public.properties (id, organization_id, title) values
  ('27000000-0000-4000-8000-0000000000a1', tests.org_id_of('a7000000-0000-0000-0000-000000000001'), 'Imóvel A1'),
  ('27000000-0000-4000-8000-0000000000b1', tests.org_id_of('b7000000-0000-0000-0000-000000000002'), 'Imóvel B1'),
  ('27000000-0000-4000-8000-0000000000c1', tests.org_id_of('c7000000-0000-0000-0000-000000000003'), 'Imóvel I1');

-- Reservas (como owner): A1 pending e ready, B1 pending, I1 pending
insert into public.property_images (id, property_id, organization_id, slot, status) values
  ('37000000-0000-4000-8000-000000000001', '27000000-0000-4000-8000-0000000000a1', tests.org_id_of('a7000000-0000-0000-0000-000000000001'), 1, 'pending'),
  ('37000000-0000-4000-8000-000000000002', '27000000-0000-4000-8000-0000000000a1', tests.org_id_of('a7000000-0000-0000-0000-000000000001'), 2, 'pending'),
  ('37000000-0000-4000-8000-000000000003', '27000000-0000-4000-8000-0000000000b1', tests.org_id_of('b7000000-0000-0000-0000-000000000002'), 1, 'pending'),
  ('37000000-0000-4000-8000-000000000004', '27000000-0000-4000-8000-0000000000c1', tests.org_id_of('c7000000-0000-0000-0000-000000000003'), 1, 'pending');
update public.organization_members set status = 'inactive' where user_id = 'c7000000-0000-0000-0000-000000000003';

-- Configuração do bucket -----------------------------------------------------------
select results_eq($$
  select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'property-images'
$$, $$ values (false, 1048576::bigint, array['image/webp']::text[]) $$,
  'bucket privado, limite de 1 MiB e só image/webp declarado');

-- Consultor A ----------------------------------------------------------------------
select tests.authenticate_as('a7000000-0000-0000-0000-000000000001');

select lives_ok($$
  insert into storage.objects (bucket_id, name, owner, metadata)
  values ('property-images', tests.org_id_of('a7000000-0000-0000-0000-000000000001') || '/27000000-0000-4000-8000-0000000000a1/37000000-0000-4000-8000-000000000001.webp',
          'a7000000-0000-0000-0000-000000000001', '{"mimetype":"image/webp"}')
$$, 'A carrega o ficheiro de uma reserva sua pending');
select throws_ok($$
  insert into storage.objects (bucket_id, name, metadata)
  values ('property-images', 'qualquer/coisa.webp', '{"mimetype":"image/webp"}')
$$, '42501', null, 'não se carrega um caminho sem reserva');
select throws_ok($$
  insert into storage.objects (bucket_id, name, metadata)
  values ('property-images', tests.org_id_of('b7000000-0000-0000-0000-000000000002') || '/27000000-0000-4000-8000-0000000000b1/37000000-0000-4000-8000-000000000003.webp',
          '{"mimetype":"image/webp"}')
$$, '42501', null, 'A não carrega para a reserva de B');
select throws_ok($$
  insert into storage.objects (bucket_id, name, metadata)
  values ('outro-bucket', tests.org_id_of('a7000000-0000-0000-0000-000000000001') || '/27000000-0000-4000-8000-0000000000a1/37000000-0000-4000-8000-000000000002.webp',
          '{"mimetype":"image/webp"}')
$$, '42501', null, 'a política não abre outros buckets');
select results_eq($$ select count(*)::int from storage.objects where bucket_id = 'property-images' $$,
  array[1], 'A lê o seu objeto');

update storage.objects set name = 'x/outro.webp' where bucket_id = 'property-images';
select throws_ok($$ delete from storage.objects where bucket_id = 'property-images' $$,
  '42501', null, 'apagar objetos por SQL direto é bloqueado pelo Storage (só pela Storage API / service_role)');
reset role;

select results_eq($$
  select count(*)::int from storage.objects where bucket_id = 'property-images' and name <> 'x/outro.webp'
$$, array[1], 'o objeto continua lá e o UPDATE de nome não teve efeito (sem política de UPDATE)');

-- Reservas já confirmadas deixam de aceitar uploads
update public.property_images set status = 'ready' where id = '37000000-0000-4000-8000-000000000001';
select tests.authenticate_as('a7000000-0000-0000-0000-000000000001');
select throws_ok($$
  insert into storage.objects (bucket_id, name, metadata)
  values ('property-images', tests.org_id_of('a7000000-0000-0000-0000-000000000001') || '/27000000-0000-4000-8000-0000000000a1/37000000-0000-4000-8000-000000000001.webp',
          '{"mimetype":"image/webp"}')
$$, '42501', null, 'uma reserva já confirmada (ready) não aceita novo upload');
reset role;

-- Consultor B ----------------------------------------------------------------------
select tests.authenticate_as('b7000000-0000-0000-0000-000000000002');
select is_empty($$ select 1 from storage.objects where bucket_id = 'property-images' $$, 'B não lê objetos de A');
reset role;

-- Consultor desativado ---------------------------------------------------------------
select tests.authenticate_as('c7000000-0000-0000-0000-000000000003');
select throws_ok($$
  insert into storage.objects (bucket_id, name, metadata)
  values ('property-images', tests.org_id_of('c7000000-0000-0000-0000-000000000003') || '/27000000-0000-4000-8000-0000000000c1/37000000-0000-4000-8000-000000000004.webp',
          '{"mimetype":"image/webp"}')
$$, '42501', null, 'consultor inativo não carrega ficheiros');
select is_empty($$ select 1 from storage.objects where bucket_id = 'property-images' $$, 'consultor inativo não lê objetos');
reset role;

-- Comprador ligado à org A -----------------------------------------------------------
select tests.authenticate_as('d7000000-0000-0000-0000-000000000004');
select is_empty($$ select 1 from storage.objects where bucket_id = 'property-images' $$,
  'comprador não lê as fotos só por estar ligado à org (o acesso virá com os roteiros)');
select throws_ok($$
  insert into storage.objects (bucket_id, name, metadata)
  values ('property-images', tests.org_id_of('a7000000-0000-0000-0000-000000000001') || '/27000000-0000-4000-8000-0000000000a1/37000000-0000-4000-8000-000000000002.webp',
          '{"mimetype":"image/webp"}')
$$, '42501', null, 'comprador não carrega fotos');
reset role;

-- anon: sem acesso direto ao Storage ----------------------------------------------------
select tests.as_anon();
select is_empty($$ select 1 from storage.objects where bucket_id = 'property-images' $$, 'anon não lê objetos');
select throws_ok($$
  insert into storage.objects (bucket_id, name, metadata)
  values ('property-images', tests.org_id_of('a7000000-0000-0000-0000-000000000001') || '/27000000-0000-4000-8000-0000000000a1/37000000-0000-4000-8000-000000000002.webp',
          '{"mimetype":"image/webp"}')
$$, '42501', null, 'anon não carrega ficheiros');
reset role;

select * from finish();
rollback;
