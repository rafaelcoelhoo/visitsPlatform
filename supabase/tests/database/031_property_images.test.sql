begin;
select plan(28);

select tests.create_auth_user('a6000000-0000-0000-0000-000000000001', 'a@example.com');
select tests.create_auth_user('b6000000-0000-0000-0000-000000000002', 'b@example.com');
select tests.create_auth_user('c6000000-0000-0000-0000-000000000003', 'i@example.com');
select app.create_consultant('a6000000-0000-0000-0000-000000000001', 'a@example.com', 'Consultor A');
select app.create_consultant('b6000000-0000-0000-0000-000000000002', 'b@example.com', 'Consultor B');
select app.create_consultant('c6000000-0000-0000-0000-000000000003', 'i@example.com', 'Consultor I');

insert into public.properties (id, organization_id, title) values
  ('26000000-0000-4000-8000-0000000000a1', tests.org_id_of('a6000000-0000-0000-0000-000000000001'), 'Imóvel A1'),
  ('26000000-0000-4000-8000-0000000000a2', tests.org_id_of('a6000000-0000-0000-0000-000000000001'), 'Imóvel A2'),
  ('26000000-0000-4000-8000-0000000000b1', tests.org_id_of('b6000000-0000-0000-0000-000000000002'), 'Imóvel B1'),
  ('26000000-0000-4000-8000-0000000000c1', tests.org_id_of('c6000000-0000-0000-0000-000000000003'), 'Imóvel I1');
update public.organization_members set status = 'inactive' where user_id = 'c6000000-0000-0000-0000-000000000003';

-- Reservar slots ---------------------------------------------------------------
select tests.authenticate_as('a6000000-0000-0000-0000-000000000001');

select results_eq($$
  select slot::int, status from public.reserve_property_image('26000000-0000-4000-8000-0000000000a1')
$$, $$ values (1, 'pending'::text) $$, 'a primeira reserva ocupa o slot 1, pending');

select ok((
  select r.storage_path = r.organization_id::text || '/' || r.property_id::text || '/' || r.id::text || '.webp'
  from public.reserve_property_image('26000000-0000-4000-8000-0000000000a1') r
), 'storage_path determinístico {org}/{imóvel}/{id}.webp, gerado pelo servidor');

select is((
  select count(*)::int from (
    select public.reserve_property_image('26000000-0000-4000-8000-0000000000a1') from generate_series(1, 6)
  ) s
), 6, 'mais 6 reservas');
select results_eq($$
  select slot::int from public.property_images
  where property_id = '26000000-0000-4000-8000-0000000000a1' order by slot
$$, $$ select generate_series(1, 8) $$, 'os 8 slots estão ocupados, sem repetidos');

select throws_ok($$ select public.reserve_property_image('26000000-0000-4000-8000-0000000000a1') $$,
  '53400', 'photo_limit_reached', 'a 9.ª foto é recusada pelo servidor');
select is((select count(*)::int from public.property_images where property_id = '26000000-0000-4000-8000-0000000000a1'),
  8, 'continuam 8 fotos depois de a 9.ª ser recusada');

select throws_ok($$
  insert into public.property_images (property_id, organization_id, slot)
  values ('26000000-0000-4000-8000-0000000000a2', tests.org_id_of('a6000000-0000-0000-0000-000000000001'), 9)
$$, '23514', null, 'INSERT direto com slot 9 é rejeitado pelo check');
select throws_ok($$
  insert into public.property_images (property_id, organization_id, slot)
  values ('26000000-0000-4000-8000-0000000000a1', tests.org_id_of('a6000000-0000-0000-0000-000000000001'), 3)
$$, '23505', null, 'INSERT direto no mesmo slot é rejeitado pelo índice único');

-- Isolamento entre organizações --------------------------------------------------
select throws_ok($$ select public.reserve_property_image('26000000-0000-4000-8000-0000000000b1') $$,
  'P0002', 'property_not_found', 'A não reserva fotos num imóvel de B (para A, esse imóvel não existe)');
select throws_ok($$
  insert into public.property_images (property_id, organization_id, slot)
  values ('26000000-0000-4000-8000-0000000000b1', tests.org_id_of('b6000000-0000-0000-0000-000000000002'), 1)
$$, '42501', null, 'INSERT com organization_id alheio é rejeitado (WITH CHECK)');
select throws_ok($$
  insert into public.property_images (property_id, organization_id, slot)
  values ('26000000-0000-4000-8000-0000000000b1', tests.org_id_of('a6000000-0000-0000-0000-000000000001'), 1)
$$, '23503', null, 'FK composta: imóvel de B com organization_id de A é rejeitado');
select throws_ok($$
  insert into public.property_images (property_id, organization_id, slot, storage_path)
  values ('26000000-0000-4000-8000-0000000000a2', tests.org_id_of('a6000000-0000-0000-0000-000000000001'), 1, 'x/y/z.webp')
$$, '428C9', null, 'storage_path é gerado: o cliente não o pode definir');
select throws_ok($$ update public.property_images set slot = 8 where slot = 1 $$,
  '42501', null, 'o slot não pode ser alterado');
select throws_ok($$ delete from public.property_images $$, '42501', null, 'sem DELETE direto (Edge Function limpa linha e ficheiro)');
reset role;

-- Confirmar: o cliente da API não pode; o service_role só com ficheiro real, WebP --------------
select tests.authenticate_as('a6000000-0000-0000-0000-000000000001');
select throws_ok($$
  update public.property_images set status = 'ready'
  where property_id = '26000000-0000-4000-8000-0000000000a1' and slot = 3
$$, '42501', null, 'o cliente da API não confirma fotos (só a Edge Function, depois de validar os magic bytes)');
reset role;

set local role service_role;
select throws_ok($$
  update public.property_images set status = 'ready'
  where property_id = '26000000-0000-4000-8000-0000000000a1' and slot = 3
$$, '55000', 'upload_not_found', 'não confirma sem o ficheiro no bucket');
reset role;

insert into storage.objects (bucket_id, name, metadata)
select 'property-images', storage_path, '{"mimetype":"image/jpeg","size":1000}'::jsonb
from public.property_images where property_id = '26000000-0000-4000-8000-0000000000a1' and slot = 4;
insert into storage.objects (bucket_id, name, metadata)
select 'property-images', storage_path, '{"mimetype":"image/webp","size":1000}'::jsonb
from public.property_images where property_id = '26000000-0000-4000-8000-0000000000a1' and slot = 3;

set local role service_role;
select throws_ok($$
  update public.property_images set status = 'ready'
  where property_id = '26000000-0000-4000-8000-0000000000a1' and slot = 4
$$, '55000', 'upload_not_found', 'não confirma um ficheiro que não é image/webp');
select lives_ok($$
  update public.property_images set status = 'ready'
  where property_id = '26000000-0000-4000-8000-0000000000a1' and slot = 3
$$, 'confirma depois de o ficheiro WebP existir');
select throws_ok($$
  update public.property_images set status = 'pending'
  where property_id = '26000000-0000-4000-8000-0000000000a1' and slot = 3
$$, '55000', 'status_regression', 'uma foto ready nunca regride a pending');
reset role;

-- Reutilização de slots libertados ---------------------------------------------------
delete from public.property_images where property_id = '26000000-0000-4000-8000-0000000000a1' and slot = 2;
select tests.authenticate_as('a6000000-0000-0000-0000-000000000001');
select results_eq($$ select slot::int from public.reserve_property_image('26000000-0000-4000-8000-0000000000a1') $$,
  $$ values (2) $$, 'o slot libertado é o próximo a ser reservado');
select throws_ok($$ select public.reserve_property_image('26000000-0000-4000-8000-0000000000a1') $$,
  '53400', 'photo_limit_reached', 'e o limite continua a ser 8');
reset role;

-- Leitura ---------------------------------------------------------------------
select tests.authenticate_as('b6000000-0000-0000-0000-000000000002');
select is_empty($$ select 1 from public.property_images $$, 'B não lê fotos de A');
select lives_ok($$ select public.reserve_property_image('26000000-0000-4000-8000-0000000000b1') $$,
  'B reserva no seu imóvel');
reset role;

select tests.authenticate_as('c6000000-0000-0000-0000-000000000003');
select throws_ok($$ select public.reserve_property_image('26000000-0000-4000-8000-0000000000c1') $$,
  'P0002', 'property_not_found', 'consultor inativo não reserva fotos');
select is_empty($$ select 1 from public.property_images $$, 'consultor inativo não lê fotos');
reset role;

select tests.as_anon();
select throws_ok($$ select * from public.property_images $$, '42501', null, 'anon não lê property_images');
select throws_ok($$ select public.reserve_property_image('26000000-0000-4000-8000-0000000000a1') $$,
  '42501', null, 'anon não executa reserve_property_image');
reset role;

-- Cascata ---------------------------------------------------------------------
delete from public.properties where id = '26000000-0000-4000-8000-0000000000a1';
select is((select count(*)::int from public.property_images where property_id = '26000000-0000-4000-8000-0000000000a1'),
  0, 'apagar o imóvel apaga as linhas das fotos (os ficheiros ficam para o job de reconciliação)');

select * from finish();
rollback;
