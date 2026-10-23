-- =============================================================================
-- Dados FICTÍCIOS de desenvolvimento local (supabase db reset). Nunca dados reais.
-- Password de dev de todos os utilizadores: visitbook-dev-1234  (só local)
--
-- Os auth users são inseridos diretamente porque é ambiente local. Em produção os
-- consultores são criados por inviteUserByEmail + public.admin_create_consultant().
-- As tabelas da app são preenchidas SÓ através de app.create_consultant().
-- =============================================================================

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ana.consultora@example.com',
   extensions.crypt('visitbook-dev-1234', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'joao.consultor@example.com',
   extensions.crypt('visitbook-dev-1234', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), u.id, u.id::text, 'email',
       json_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true)::jsonb,
       now(), now(), now()
from auth.users u
where u.id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222');

select app.create_consultant('11111111-1111-4111-8111-111111111111', 'ana.consultora@example.com',
                             'Ana Martins', 'Ana Martins · Imobiliária Atlântico');
select app.create_consultant('22222222-2222-4222-8222-222222222222', 'joao.consultor@example.com',
                             'João Ferreira', 'João Ferreira (independente)');

-- Comprador de desenvolvimento: sem password (entra por OTP; o código aparece no Mailpit).
insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values (
  '33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'marta.compradora@example.com', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);
insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
values (
  gen_random_uuid(), '33333333-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333', 'email',
  '{"sub":"33333333-3333-4333-8333-333333333333","email":"marta.compradora@example.com","email_verified":true}',
  now(), now(), now()
);

-- Clientes e ligações. Inseridos diretamente porque a Edge Function de convites ainda não existe;
-- em produção só ela (service_role) escreve em client_links.
-- Marta é cliente das duas consultoras (testa o seletor de consultor); Pedro está apenas convidado.
insert into public.clients (id, organization_id, name, email) values
  ('c1111111-1111-4111-8111-111111111111',
   (select organization_id from public.organization_members where user_id = '11111111-1111-4111-8111-111111111111'),
   'Marta Oliveira', 'marta.compradora@example.com'),
  ('c2222222-2222-4222-8222-222222222222',
   (select organization_id from public.organization_members where user_id = '22222222-2222-4222-8222-222222222222'),
   'Marta Oliveira', 'marta.compradora@example.com'),
  ('c3333333-3333-4333-8333-333333333333',
   (select organization_id from public.organization_members where user_id = '11111111-1111-4111-8111-111111111111'),
   'Pedro Santos', 'pedro.convidado@example.com');

insert into public.client_links (client_id, organization_id, user_id, status, accepted_at)
select c.id, c.organization_id, '33333333-3333-4333-8333-333333333333', 'active', now()
from public.clients c
where c.email = 'marta.compradora@example.com';
insert into public.client_links (client_id, organization_id, status)
select c.id, c.organization_id, 'invited'
from public.clients c
where c.email = 'pedro.convidado@example.com';

-- Imóveis fictícios (sem fotos). Ana: um completo e um criado "em 90 segundos" (só alguns campos, o resto NULL).
insert into public.properties (organization_id, created_by, title, price_eur, location_text, typology, area_m2, monthly_charges_eur)
select m.organization_id, m.user_id, v.title, v.price_eur, v.location_text, v.typology, v.area_m2, v.monthly_charges_eur
from public.organization_members m
join (values
  ('11111111-1111-4111-8111-111111111111'::uuid, 'T3 com varanda em Alvalade', 395000::numeric, 'Alvalade, Lisboa', 'T3', 112::numeric, 85::numeric),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'T2 para remodelar na Graça', 280000::numeric, 'Graça, Lisboa', 'T2', null::numeric, null::numeric),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'Moradia T4 com jardim em Cascais', 890000::numeric, 'Birre, Cascais', 'T4', 240::numeric, 0::numeric)
) as v(user_id, title, price_eur, location_text, typology, area_m2, monthly_charges_eur) on v.user_id = m.user_id;

-- Segredos do Vault SÓ para desenvolvimento local (o job de reconciliação lê-os; ver docs/SECURITY.md para produção).
-- O host é o contentor do Kong na rede Docker do Supabase local.
select vault.create_secret('http://supabase_kong_visitbook:8000/functions/v1', 'functions_base_url', 'URL base das Edge Functions (local)');
select vault.create_secret('local-dev-only-reconcile-secret', 'reconcile_secret', 'Segredo do job de reconciliação (local; igual a RECONCILE_SECRET em supabase/functions/dev.env)');
